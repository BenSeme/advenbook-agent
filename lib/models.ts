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
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Model API returned no message.");
  return message;
}
