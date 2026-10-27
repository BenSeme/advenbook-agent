"use client";

import { useEffect, useRef, useState } from "react";

type Activity = {
  strava_activity_id: string;
  title: string;
  date: string;
  sport?: string;
  distance_km?: number;
  elevation_gain_m?: number;
};

type UiEvent =
  | { kind: "connect"; connectUrl: string; connectionId: string }
  | { kind: "activities"; activities: Activity[] }
  | {
      kind: "book";
      bookId: string;
      claimUrl: string;
      editorUrl?: string;
      estimatedPages?: number;
      price?: unknown;
    };

type Msg = {
  role: "user" | "assistant";
  content: string;
  display?: string;
  ui?: UiEvent[];
};

const GREETING: Msg = {
  role: "assistant",
  content:
    "Bonjour ! Dites-moi quel livre vous voulez — par exemple « Mon été dans les Pyrénées ». Vous pouvez parler au micro ou écrire. Je connecte votre Strava, je choisis les sorties avec vous, et je prépare le brouillon du livre.\n\nHi! Tell me what book you want — e.g. “My summer in the Pyrenees”. Speak or type; I’ll reply in your language.",
};

const WARMUP_RE =
  /échauffement|echauffement|warm.?up|cooldown|cool down|retour au calme|récup|recup|recovery|déblocage|deblocage/i;

/** Same-day rule: a race/main outing wins; its warm-up & cool-down start unticked. */
function suggestedSelection(
  activities: Activity[],
): Record<string, boolean> {
  const byDate = new Map<string, Activity[]>();
  for (const a of activities) {
    byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  }
  const out: Record<string, boolean> = {};
  for (const a of activities) {
    const sameDay = byDate.get(a.date) ?? [];
    const longest = Math.max(...sameDay.map((x) => x.distance_km ?? 0));
    const isWarmup =
      sameDay.length > 1 &&
      (WARMUP_RE.test(a.title) ||
        ((a.distance_km ?? 0) > 0 && (a.distance_km ?? 0) < longest * 0.35)) &&
      (a.distance_km ?? 0) < longest;
    out[a.strava_activity_id] = !isWarmup;
  }
  return out;
}

function isLikelyWarmup(
  a: Activity,
  activities: Activity[],
): boolean {
  const sameDay = activities.filter((x) => x.date === a.date);
  if (sameDay.length < 2) return false;
  const longest = Math.max(...sameDay.map((x) => x.distance_km ?? 0));
  return (
    (WARMUP_RE.test(a.title) ||
      ((a.distance_km ?? 0) > 0 && (a.distance_km ?? 0) < longest * 0.35)) &&
    (a.distance_km ?? 0) < longest
  );
}

/** Encode mono Float32 samples as a 16 kHz 16-bit PCM WAV (Voice API format). */
function encodeWav(samples: Float32Array, inputRate: number): ArrayBuffer {
  const ratio = inputRate / 16000;
  const outLength = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const s = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => view.setInt16(44 + i * 2, v, true));
  return buffer;
}

function formatPrice(price: unknown): string | null {
  if (price == null) return null;
  if (typeof price === "number" || typeof price === "string") return String(price);
  if (typeof price === "object") {
    const p = price as Record<string, unknown>;
    const amount = p.amount ?? p.price ?? p.total;
    const currency = p.currency ?? "€";
    if (amount != null) return `${amount} ${currency}`;
  }
  return null;
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const latestActivitiesRef = useRef<boolean>(false);
  const recorderRef = useRef<{
    ctx: AudioContext;
    stream: MediaStream;
    node: ScriptProcessorNode;
    chunks: Float32Array[];
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The Strava connection_id survives reloads / tab switches.
  useEffect(() => {
    const saved = window.localStorage.getItem("ab-connection-id");
    if (saved) setConnectionId(saved);
  }, []);

  function rememberConnection(id: string) {
    setConnectionId(id);
    window.localStorage.setItem("ab-connection-id", id);
  }

  /** Mechanical "I have connected" step: read Strava directly, no LLM guessing. */
  async function fetchActivities(userText?: string) {
    if (!connectionId || busy) return;
    const base: Msg[] = userText
      ? [...messages, { role: "user", content: userText }]
      : messages;
    setMessages(base);
    setBusy(true);
    setStatus("Lecture de vos sorties Strava…");
    try {
      const res = await fetch("/api/strava/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = (await res.json()) as {
        activities?: Activity[];
        error?: string;
      };
      if (!res.ok || data.error) {
        setMessages([
          ...base,
          {
            role: "assistant",
            content:
              data.error ??
              "La lecture Strava a échoué. Reconnectez-vous puis cliquez Continuer.",
          },
        ]);
        return;
      }
      const activities = data.activities ?? [];
      setSelected(suggestedSelection(activities));
      setMessages([
        ...base,
        {
          role: "assistant",
          content:
            activities.length === 0
              ? "Connexion bien reçue, mais je ne vois aucune sortie sur cette période. Dites-moi une autre période (par exemple « toutes mes sorties 2025 »), ou vérifiez que Strava est bien connecté."
              : `Connexion bien reçue — voici vos ${activities.length} sorties. La course principale de chaque jour est cochée, les échauffements sont décochés (recochables). Décochez ce que vous ne voulez pas, puis « Continuer ».`,
          ui: activities.length
            ? [{ kind: "activities", activities }]
            : undefined,
        },
      ]);
    } catch {
      setMessages([
        ...base,
        {
          role: "assistant",
          content:
            "Je n’ai pas pu joindre le serveur pour lire vos sorties. Réessayez dans un instant.",
        },
      ]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function toggleMic() {
    if (recording && recorderRef.current) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      setRecording(false);
      rec.node.disconnect();
      rec.stream.getTracks().forEach((t) => t.stop());
      const total = rec.chunks.reduce((n, c) => n + c.length, 0);
      const samples = new Float32Array(total);
      let off = 0;
      for (const c of rec.chunks) {
        samples.set(c, off);
        off += c.length;
      }
      const rate = rec.ctx.sampleRate;
      await rec.ctx.close().catch(() => undefined);
      if (total === 0) return;
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append("audio", new Blob([encodeWav(samples, rate)], { type: "audio/wav" }), "audio.wav");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "Transcription failed");
        if (data.text) {
          setInput((prev) => (prev ? `${prev} ${data.text}` : data.text ?? ""));
        }
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Désolé — la transcription a échoué (${err instanceof Error ? err.message : "erreur"}). Vous pouvez écrire votre réponse. / Sorry — transcription failed, please type instead.`,
          },
        ]);
      } finally {
        setTranscribing(false);
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      recorderRef.current = { ctx, stream, node, chunks };
      setRecording(true);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Je n’ai pas accès au micro (autorisation refusée ?). Vous pouvez écrire votre réponse. / Microphone unavailable — please type.",
        },
      ]);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string, display?: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    // "It's done / c'est fait" with a known connection: read Strava directly.
    if (
      connectionId &&
      !latestActivitiesRef.current &&
      /^(c'?est fait|fait|done|ok|connecté|connecte|déjà connecté|deja connecte|prêt|pret|je me suis connecté)/i.test(
        clean,
      )
    ) {
      await fetchActivities(clean);
      setInput("");
      return;
    }
    const next: Msg[] = [
      ...messages,
      { role: "user", content: clean, display },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    setStatus("Thinking…");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: connectionId ? { connectionId } : undefined,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        ui?: UiEvent[];
        toolEvents?: { label: string }[];
        error?: string;
      };
      if (!res.ok || data.error) {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: `Sorry — ${data.error ?? "something went wrong."} Check your connection and try again.`,
          },
        ]);
        return;
      }
      const ui = data.ui ?? [];
      for (const e of ui) {
        if (e.kind === "connect" && e.connectionId) rememberConnection(e.connectionId);
        if (e.kind === "activities") {
          setSelected(suggestedSelection(e.activities));
        }
      }
      if (data.toolEvents?.length) {
        setStatus(data.toolEvents[data.toolEvents.length - 1].label);
      }
      setMessages([...next, { role: "assistant", content: data.reply ?? "…", ui }]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Sorry — I couldn’t reach the server. Check your connection and try again.",
        },
      ]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const latestActivities = [...messages]
    .reverse()
    .flatMap((m) => m.ui ?? [])
    .find((e): e is Extract<UiEvent, { kind: "activities" }> => e.kind === "activities");
  latestActivitiesRef.current = Boolean(latestActivities);

  function confirmSelection(skipInterview: boolean) {
    if (!latestActivities) return;
    const chosen = latestActivities.activities.filter(
      (a) => selected[a.strava_activity_id],
    );
    if (chosen.length === 0) return;
    const list = chosen
      .map((a) => `${a.title} (${a.date}, id ${a.strava_activity_id})`)
      .join("; ");
    send(
      skipInterview
        ? `I confirm these outings: ${list}. Skip the questions and create the book now, with no stories.`
        : `I confirm these outings: ${list}. Ask me your questions, one outing at a time.`,
      skipInterview
        ? `Création directe demandée (${chosen.length} sorties, sans histoires).`
        : `Sélection confirmée (${chosen.length} sorties).`,
    );
  }

  return (
    <div className="shell">
      <header>
        <h1>AdvenBook Agent</h1>
        <p>Your Strava outings, turned into a printed book — without the sorting and writing.</p>
      </header>

      <main aria-live="polite">
        {connectionId && !latestActivities && (
          <div className="card">
            <h2>Strava : connexion détectée sur cet appareil</h2>
            <p style={{ margin: "0 0 10px", fontSize: 14 }}>
              Si vous avez déjà autorisé Strava sur la page AdvenBook (même si elle a
              remplacé cette page), cliquez Continuer : je lis vos sorties directement.
              Sinon, redemandez votre livre dans la conversation pour obtenir un lien
              de connexion.
            </p>
            <div className="row" style={{ marginTop: 0 }}>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void fetchActivities("C’est fait, je me suis connecté à Strava.")}
              >
                Continuer — lire mes sorties
              </button>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  window.localStorage.removeItem("ab-connection-id");
                  setConnectionId("");
                }}
              >
                Oublier cette connexion
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className={m.role === "user" ? "msg user" : "msg assistant"}>
              {m.role === "user" ? (m.display ?? m.content) : m.content}
            </div>
            {(m.ui ?? []).map((e, j) => {
              if (e.kind === "connect") {
                return (
                  <div className="card" key={j}>
                    <h2>Connect your Strava — 3 steps</h2>
                    <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
                      <li>Click “Connect Strava” below and authorise on Strava. That page is AdvenBook’s — it will not bring you back here by itself.</li>
                      <li>Come back here: at the top of your browser, click the other tab (« AdvenBook Agent » / localhost) — or close the Strava tab with its ×. This page stays open underneath, nothing is lost.</li>
                      <li>Click “I’ve connected — continue”. I’ll then read your outings.</li>
                    </ol>
                    <div className="row" style={{ marginTop: 0 }}>
                      <a className="btn" href={e.connectUrl} target="_blank" rel="noreferrer">
                        1. Connect Strava
                      </a>
                      <button
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void fetchActivities("C’est fait, je me suis connecté à Strava.")}
                      >
                        2. I’ve connected — continue
                      </button>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#5a6b52" }}>
                      Link valid 24 hours. If reading fails, the authorisation may not have finished — reconnect, then click continue again.
                    </p>
                  </div>
                );
              }
              if (e.kind === "activities") {
                return (
                  <div className="card" key={j}>
                    <h2>Sorties proposées — décochez / recochez librement</h2>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: "#5a6b52" }}>
                      Proposition de l’agent : la course principale de chaque jour est cochée.
                      Les échauffements et retours au calme du même jour démarrent décochés — recochez-les si vous les voulez dans le livre.
                    </p>
                    {e.activities.map((a) => (
                      <label className="check" key={a.strava_activity_id}>
                        <input
                          type="checkbox"
                          checked={!!selected[a.strava_activity_id]}
                          onChange={(ev) =>
                            setSelected((s) => ({
                              ...s,
                              [a.strava_activity_id]: ev.target.checked,
                            }))
                          }
                        />
                        <span>
                          {a.title}
                          <small>
                            {a.date}
                            {a.sport ? ` · ${a.sport}` : ""}
                            {a.distance_km != null ? ` · ${a.distance_km} km` : ""}
                            {a.elevation_gain_m != null ? ` · ${a.elevation_gain_m} m D+` : ""}
                            {isLikelyWarmup(a, e.activities)
                              ? " · échauffement probable — décoché par défaut"
                              : ""}
                          </small>
                        </span>
                      </label>
                    ))}
                    <div className="row">
                      <button
                        className="btn"
                        disabled={busy || !latestActivities}
                        onClick={() => confirmSelection(false)}
                      >
                        Continue with selected
                      </button>
                      <button
                        className="btn secondary"
                        disabled={busy || !latestActivities}
                        onClick={() => confirmSelection(true)}
                      >
                        Skip questions, create now
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="card book" key={j}>
                  <h2>Your book draft is ready</h2>
                  <p className="price">
                    {e.estimatedPages ? `About ${e.estimatedPages} pages. ` : ""}
                    {formatPrice(e.price)
                      ? `Estimated price: ${formatPrice(e.price)}. `
                      : ""}
                    This is a draft — you order it on advenbook.com, nothing is paid yet.
                  </p>
                  <a
                    className="btn"
                    href={e.editorUrl ?? e.claimUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open my book
                  </a>
                </div>
              );
            })}
          </div>
        ))}
        {busy && (
          <div className="status" role="status">
            <span className="spinner" aria-hidden />
            {status ?? "Working…"}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Parlez ou écrivez… e.g. Mon été dans les Pyrénées"
          aria-label="Your message"
          disabled={busy}
        />
        <button
          className="btn secondary"
          type="button"
          disabled={busy || transcribing}
          onClick={() => void toggleMic()}
          aria-label={recording ? "Arrêter l'enregistrement" : "Parler au micro"}
        >
          {transcribing ? "Transcription…" : recording ? "Arrêter" : "Parler"}
        </button>
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
      <div className="hint">
        {recording
          ? "Enregistrement en cours… cliquez Arrêter quand vous avez fini."
          : "Micro : parlez, la transcription s’écrit dans le champ — relisez, puis Send. Photos : bientôt (M2), dites-le dans la conversation en attendant."}
      </div>
    </div>
  );
}
