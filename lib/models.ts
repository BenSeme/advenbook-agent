import { addTokenUsage } from "./budget";

// Every model call goes through this module (AGENTS.md §4).
// Provider is switched by env vars only: MODEL_BASE_URL + CHAT_MODEL + MODEL_API_KEY.
// OpenAI-compatible Chat Completions (docs: "Tool calling", Chat Completions format).

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type FunctionTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

function config() {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set on the server (.env.local).");
  return {
    apiKey,
    baseUrl: (process.env.MODEL_BASE_URL ?? "https://api.meta.ai/v1").replace(/\/$/, ""),
    model: process.env.CHAT_MODEL ?? "muse-spark-1.3",
  };
}

/** Muse Voice Transcribe: WAV (mono, 16-bit PCM, 16/24 kHz) -> transcript text. */
export async function transcribeAudio(wav: ArrayBuffer): Promise<string> {
  const { apiKey, baseUrl } = config();
  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          mode: "PUSH_TO_TALK",
          model: process.env.VOICE_MODEL ?? "muse-voice-transcribe-1.0",
          audioEncoding: "WAV",
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("audio", new Blob([wav], { type: "audio/wav" }), "audio.wav");
  const res = await fetch(`${baseUrl}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Voice API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    transcript?: string;
    turns?: { transcript?: string }[];
  };
  const text =
    data.transcript?.trim() ||
    (data.turns ?? []).map((t) => t.transcript ?? "").join(" ").trim();
  return text;
}

export type PhotoVerdict = { keep: { id: string; reason: string }[]; drop: string[] };

/** Muse Spark (vision): keep the best photos of one outing, with reasons. */
export async function selectPhotosWithVision(
  outingTitle: string,
  images: { id: string; dataUrl: string }[],
): Promise<PhotoVerdict> {
  const { apiKey, baseUrl, model } = config();
  const content: unknown[] = [
    {
      type: "text",
      text: `You curate photos for a printed outdoor book, outing "${outingTitle}". From the ${images.length} attached photos (in order, ids ${images.map((i) => i.id).join(", ")}), keep the best ones: sharp, varied, no near-duplicates, strong subjects. Keep at most 10, at least 1 if any is usable. Reply with ONLY JSON: {"keep":[{"id":"...","reason":"one short line"}],"drop":["id",...]}`,
    },
    ...images.map((i) => ({
      type: "image_url",
      image_url: { url: i.dataUrl },
    })),
  ];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vision API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Vision reply was not JSON.");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as PhotoVerdict;
  const ids = new Set(images.map((i) => i.id));
  return {
    keep: (parsed.keep ?? []).filter((k) => ids.has(k.id)),
    drop: (parsed.drop ?? []).filter((id) => ids.has(id)),
  };
}

export type SamBox = { x1: number; y1: number; x2: number; y2: number; w: number; h: number };

/** SAM 3.1 (Responses, streamed): largest subject box for a text prompt. */
export async function segmentSubject(
  imageDataUrl: string,
  prompt: string,
): Promise<SamBox | null> {
  const { apiKey, baseUrl } = config();
  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: process.env.SAM_MODEL ?? "sam-3.1",
      stream: true,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`SAM API ${res.status}: ${text.slice(0, 400)}`);
  }
  const text = await res.text();
  let lane = "";
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const ev = JSON.parse(payload) as { type?: string; delta?: string };
      if (ev.type === "response.output_text.delta" && ev.delta) lane += ev.delta;
    } catch {
      // ignore non-JSON stream lines
    }
  }
  const boxes: SamBox[] = [];
  const re = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=[\d.]+)?\|>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lane)) !== null) {
    boxes.push({
      x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], w: +m[5], h: +m[6],
    });
  }
  if (boxes.length === 0) return null;
  boxes.sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1));
  return boxes[0];
}

export async function chatCompletion(
  messages: ChatMessage[],
  tools: FunctionTool[],
): Promise<ChatMessage> {
  const { apiKey, baseUrl, model } = config();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Model API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: ChatMessage }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (data.usage) {
    console.log(
      `llm usage: in=${data.usage.prompt_tokens ?? "?"} out=${data.usage.completion_tokens ?? "?"}`,
    );
    addTokenUsage(data.usage.prompt_tokens, data.usage.completion_tokens);
  }
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Model API returned no message.");
  return message;
}
