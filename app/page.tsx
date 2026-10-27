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
  | { kind: "book"; bookId: string; claimUrl: string; estimatedPages?: number; price?: unknown };

type Msg = { role: "user" | "assistant"; content: string; ui?: UiEvent[] };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! Tell me what book you want — for example “My summer in the Pyrenees” or “Mes courses de 2025”. I’ll connect your Strava, pick the outings, ask you a couple of questions, and draft the book for you.",
};

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
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
        if (e.kind === "connect" && e.connectionId) setConnectionId(e.connectionId);
        if (e.kind === "activities") {
          setSelected(
            Object.fromEntries(e.activities.map((a) => [a.strava_activity_id, true])),
          );
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
    );
  }

  return (
    <div className="shell">
      <header>
        <h1>AdvenBook Agent</h1>
        <p>Your Strava outings, turned into a printed book — without the sorting and writing.</p>
      </header>

      <main aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className={m.role === "user" ? "msg user" : "msg assistant"}>
              {m.content}
            </div>
            {(m.ui ?? []).map((e, j) => {
              if (e.kind === "connect") {
                return (
                  <div className="card" key={j}>
                    <h2>Connect your Strava</h2>
                    <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                      This link is valid for 24 hours. Connect, then come back and tell me “done”.
                    </p>
                    <a className="btn" href={e.connectUrl} target="_blank" rel="noreferrer">
                      Connect Strava
                    </a>
                  </div>
                );
              }
              if (e.kind === "activities") {
                return (
                  <div className="card" key={j}>
                    <h2>Your outings — untick any you don’t want</h2>
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
                  <a className="btn" href={e.claimUrl} target="_blank" rel="noreferrer">
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
          placeholder="What book do you want? e.g. My summer in the Pyrenees"
          aria-label="Your message"
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
      <div className="hint">M1: text chat. Photos and voice come in later milestones.</div>
    </div>
  );
}
