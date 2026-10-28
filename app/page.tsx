"use client";

import { useEffect, useRef, useState } from "react";
import { activityBadges, isHighlight, isLikelyWarmup } from "@/lib/highlights";
import {
  t,
  LANGS,
  detectLangFromText,
  detectDevice,
  type DeviceKind,
  fmtDistance,
  fmtElevation,
  fmtPrice,
  type Lang,
} from "@/lib/i18n";
import { parseGpx } from "@/lib/gpx";
import exifr from "exifr";
import type {
  Activity,
  ManualActivity,
  Msg,
  PhotoItem,
  UiEvent,
} from "@/lib/chat-types";
import { fileToDataUrl, fullDataUrl } from "@/lib/files";
import { encodeWav } from "@/lib/voice";
import { ActivitiesCard, BookCard, ConnectCard } from "./components/cards";
import { FilesPanel } from "./components/FilesPanel";

const GREETING: Msg = {
  role: "assistant",
  content:
    "Bonjour ! Dites-moi quel livre vous voulez — par exemple « Mon été dans les Pyrénées ». Vous pouvez parler au micro ou écrire. Je connecte votre Strava, je choisis les sorties avec vous, et je prépare le brouillon du livre. Pas de Strava ? Dites-le-moi : on partira d’une liste que vous me dictez.\n\nHi! Tell me what book you want — e.g. “My summer in the Pyrenees”. Speak or type; I’ll reply in your language. No Strava? Just say so — we’ll use a list you dictate.",
};

/** Same-day rule: main outing ticked, warm-ups unticked. No count cap. */
function suggestedSelection(
  activities: Activity[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const a of activities) {
    out[a.strava_activity_id] = !isLikelyWarmup(a, activities);
  }
  return out;
}



const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Human check shown ONLY when the anonymous visitor cap is hit and
 *  Turnstile keys are configured. Invisible for everyone else. */
function HumanCheck({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const render = () => {
      const w = window as unknown as {
        turnstile?: {
          render: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
      if (w.turnstile && ref.current) {
        w.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
        });
      }
    };
    if (document.querySelector('script[src*="turnstile"]')) {
      render();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [onToken]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} style={{ margin: "8px 12px" }} />;
}

export default function Home() {
  const [device, setDevice] = useState<DeviceKind>("desktop");
  const [lang, setLang] = useState<Lang>("fr");
  const langTouched = useRef(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);

  useEffect(() => {
    const nav = navigator.language.slice(0, 2) as Lang;
    if ((LANGS as string[]).includes(nav)) setLang(nav);
    setDevice(detectDevice(navigator.userAgent));
  }, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copiedBook, setCopiedBook] = useState("");
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<{ text: string; display?: string } | null>(null);
  const [connectionId, setConnectionId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [photosOpen, setPhotosOpen] = useState(false);
  const [manual, setManual] = useState<ManualActivity[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoFiles = useRef(new Map<string, File>());
  const [listOpen, setListOpen] = useState(false);
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

  async function onGpxFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const parsed = parseGpx(await file.text());
        setManual((m) => [...m, { ...parsed, id: crypto.randomUUID() }]);
      } catch {
        setMessages((msgs) => [
          ...msgs,
          {
            role: "assistant",
            content: `Je n’ai pas pu lire le fichier GPX « ${file.name} » (trace introuvable). Vérifiez que c’est bien un .gpx avec des points GPS.`,
          },
        ]);
      }
    }
  }

  function knownDates(): { id: string; title: string; date: string }[] {
    const strava =
      latestActivitiesRef.current && latestActivities
        ? latestActivities.activities.map((a) => ({
            id: a.strava_activity_id,
            title: a.title,
            date: a.date,
          }))
        : [];
    return [
      ...manual.map((a) => ({ id: a.id, title: a.title, date: a.date })),
      ...strava,
    ];
  }

  async function onPhotoFiles(files: FileList | null) {
    if (!files) return;
    const known = knownDates();
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      photoFiles.current.set(id, file);
      let exifDate: string | null = null;
      try {
        const exif = (await exifr.parse(file, [
          "DateTimeOriginal",
          "CreateDate",
          "latitude",
          "longitude",
        ])) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
        const d = exif?.DateTimeOriginal ?? exif?.CreateDate;
        if (d instanceof Date && !Number.isNaN(d.getTime())) {
          exifDate = d.toISOString().slice(0, 10);
        }
      } catch {
        exifDate = null;
      }
      const matched = exifDate ? known.find((k) => k.date === exifDate) : undefined;
      setPhotos((p) => [
        ...p,
        {
          id,
          name: file.name,
          thumb: URL.createObjectURL(file),
          exifDate,
          activityId: matched?.id ?? "",
          kept: null,
        },
      ]);
    }
  }

  /** ONE button for photos: IA picks the best, SAM crops + uploads them,
   *  then the agent is told and places free photos itself. */
  async function preparePhotos() {
    if (photoBusy || photos.length === 0) return;
    setPhotoBusy(true);
    setStatus(lang === "en" ? "Choosing your best photos…" : "Choix de vos meilleures photos…");
    try {
      const known = knownDates();
      const groups = new Map<string, PhotoItem[]>();
      for (const p of photos) {
        const key = p.activityId || "__free__";
        groups.set(key, [...(groups.get(key) ?? []), p]);
      }
      const keepIds = new Set<string>();
      const reasons = new Map<string, string>();
      for (const [activityId, group] of groups) {
        const title =
          activityId === "__free__"
            ? "Photos libres"
            : (known.find((k) => k.id === activityId)?.title ?? "Sortie");
        const images = await Promise.all(
          group.map(async (p) => ({
            id: p.id,
            dataUrl: await fileToDataUrl(photoFiles.current.get(p.id) as File),
          })),
        );
        const res = await fetch("/api/photos/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outingTitle: title, images }),
        });
        const data = (await res.json()) as {
          keep?: { id: string; reason: string }[];
          error?: string;
        };
        if (!res.ok || data.error) throw new Error(data.error ?? "Analyse impossible");
        for (const k of data.keep ?? []) {
          keepIds.add(k.id);
          reasons.set(k.id, k.reason);
        }
      }
      if (keepIds.size === 0) {
        for (const p of photos) keepIds.add(p.id); // vision kept none: keep all rather than block
      }
      setPhotos((prev) =>
        prev.map((p) => ({ ...p, kept: keepIds.has(p.id), reason: reasons.get(p.id) })),
      );
      setStatus(lang === "en" ? "Cropping and uploading…" : "Recadrage et envoi…");
      const uploaded = new Map<string, string>();
      for (const p of photos) {
        if (!keepIds.has(p.id)) continue;
        if (p.uploadedUrl) {
          uploaded.set(p.id, p.uploadedUrl);
          continue;
        }
        const file = photoFiles.current.get(p.id);
        if (!file) continue;
        const res = await fetch("/api/photos/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: await fullDataUrl(file), fileName: p.name }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (data.url) uploaded.set(p.id, data.url);
        setPhotos((prev) =>
          prev.map((x) =>
            x.id === p.id
              ? data.url
                ? { ...x, uploadedUrl: data.url, status: "prête" }
                : { ...x, status: data.error ?? "Échec envoi" }
              : x,
          ),
        );
      }
      const byActivity = new Map<string, string[]>();
      const free: string[] = [];
      for (const p of photos) {
        const url = uploaded.get(p.id);
        if (!url) continue;
        if (p.activityId) {
          byActivity.set(p.activityId, [...(byActivity.get(p.activityId) ?? []), url]);
        } else free.push(url);
      }
      const lines: string[] = [];
      for (const [id, urls] of byActivity) {
        const title = known.find((k) => k.id === id)?.title ?? id;
        lines.push(`- "${title}" : ${urls.join(", ")}`);
      }
      if (free.length) lines.push(`- Photos libres : ${free.join(", ")}`);
      if (lines.length === 0) throw new Error("Aucune photo envoyée");
      // Once used, EVERY photo of the batch leaves the dropzone: the
      // uploaded ones belong to the book now, and the ones the AI dropped
      // were considered and rejected — keeping them on screen trapped
      // the user in a re-analyse loop. Only photos the AI kept but whose
      // upload failed stay, with their status visible for a retry.
      const droppedCount = photos.filter(
        (p) => !keepIds.has(p.id),
      ).length;
      const removed = photos.filter(
        (p) => uploaded.has(p.id) || !keepIds.has(p.id),
      );
      for (const p of removed) {
        URL.revokeObjectURL(p.thumb);
        photoFiles.current.delete(p.id);
      }
      setPhotos((prev) =>
        prev.filter((p) => keepIds.has(p.id) && !uploaded.has(p.id)),
      );
      setPhotosOpen(false);
      await send(
        `Voici les photos préparées pour le livre (garde/photo_urls, recopie les liens sans les modifier). Rattachées :\n${lines.join("\n")}\nPlace toi-même les photos libres (rattachées à la bonne sortie, en pleine page, ou en page photo à part) et dis-moi en une ligne ce que tu as fait. Au moins 25% des photos en pleine page, sur au moins 25% des sorties qui ont des photos.`,
        lang === "en"
          ? `${uploaded.size} photo(s) ready${droppedCount ? `, ${droppedCount} dropped by the AI` : ""} — placing them in the book.`
          : `${uploaded.size} photo(s) prête(s)${droppedCount ? `, ${droppedCount} écartée(s) par l’IA` : ""} — je les place dans le livre.`,
      );
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        {
          role: "assistant",
          content:
            lang === "en"
              ? `Photo preparation failed (${err instanceof Error ? err.message : "error"}). You can still create the book without them.`
              : `La préparation des photos a échoué (${err instanceof Error ? err.message : "erreur"}). Vous pouvez quand même créer le livre sans elles.`,
        },
      ]);
    } finally {
      setPhotoBusy(false);
      setStatus(null);
    }
  }

  function createManualBook() {
    if (manual.length === 0) return;
    const lines = manual.map((a) => {
      const urls = photos
        .filter((p) => p.activityId === a.id && p.uploadedUrl)
        .map((p) => p.uploadedUrl as string);
      return `- ${a.title} | date ${a.date} | ${a.distanceKm} km | ${a.elevationGainM} m D+ | ${a.duration || "?"} | sport Randonnée | gps_polyline: ${a.polyline}${urls.length ? ` | photo_urls: ${urls.join(", ")}` : ""}`;
    });
    const freeUrls = photos
      .filter((p) => !p.activityId && p.uploadedUrl)
      .map((p) => p.uploadedUrl as string);
    void send(
      `Crée un livre sans Strava (source gpx_files) avec exactement ces sorties, recopie chaque gps_polyline et photo_urls sans les modifier :\n${lines.join("\n")}${freeUrls.length ? `\nPhotos libres (pas encore rattachées) : ${freeUrls.join(", ")}. Place-les toi-même (rattachées à la bonne sortie, en pleine page, ou en page photo à part avec un titre court), sans me demander, et dis-moi en une ligne ce que tu as fait.` : ""}`,
      `Créer le livre avec mes ${manual.length} sortie(s) ajoutée(s) (GPX/photos).`,
    );
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

  async function send(text: string, display?: string, turnstileToken?: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    // Only the user's own typing changes the UI language — never the
    // generated messages behind buttons (they carry a short display).
    if (!display) {
      const detected = detectLangFromText(clean);
      if (detected && detected !== lang) setLang(detected);
    }
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
    // A human-check retry reuses the already-shown user message.
    const next: Msg[] = turnstileToken
      ? messages
      : [...messages, { role: "user", content: clean, display }];
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
          context: {
            ...(connectionId ? { connectionId } : {}),
            ...(confirmedIds.length ? { confirmedIds } : {}),
          },
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        ui?: UiEvent[];
        toolEvents?: { label: string }[];
        error?: string;
        code?: string;
        challenge?: boolean;
        detectedLang?: string;
      };
      // The conversation language wins over the browser language for the
      // whole UI (prices included) — unless the user picked a language.
      if (
        data.detectedLang &&
        (LANGS as string[]).includes(data.detectedLang) &&
        !langTouched.current &&
        data.detectedLang !== lang
      ) {
        setLang(data.detectedLang as Lang);
      }
      if (
        res.status === 429 &&
        data.code === "visitor_cap" &&
        data.challenge &&
        TURNSTILE_SITE_KEY &&
        !turnstileToken
      ) {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: `${t(lang, "serverError")}${data.error ?? ""}`,
          },
        ]);
        setChallenge({ text: clean, display });
        return;
      }
      if (!res.ok || data.error) {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: `${t(lang, "serverError")}${data.error ?? t(lang, "netError")}`,
          },
        ]);
        return;
      }
      const ui = data.ui ?? [];
      for (const e of ui) {
        if (e.kind === "connect" && e.connectionId) rememberConnection(e.connectionId);
        if (e.kind === "activities") {
          // After a confirmation the selection is locked — a re-list from
          // the model must never silently re-tick other outings.
          setSelected((prev) =>
            confirmedIds.length > 0 ? prev : suggestedSelection(e.activities),
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
          content: t(lang, "netError"),
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
    // Locked from here: the server will refuse any outing outside this list.
    setConfirmedIds(chosen.map((a) => a.strava_activity_id));
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
        <span className="logo-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_advenbook.svg" alt="AdvenBook" />
        </span>
        <div style={{ flex: 1 }}>
          <h1>AdvenBook Agent</h1>
          <p>{t(lang, "subtitle")}</p>
        </div>
        <select
          value={lang}
          onChange={(e) => {
            langTouched.current = true;
            setLang(e.target.value as Lang);
          }}
          aria-label="Language"
          style={{
            minHeight: 40,
            borderRadius: 8,
            border: "1px solid var(--brand-line)",
            background: "var(--brand-card)",
            color: "var(--brand-ink)",
            padding: "6px 8px",
          }}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
          <option value="it">Italiano</option>
          <option value="eu">Euskara</option>
        </select>
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
                {t(lang, "resumeBtn")}
              </button>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  window.localStorage.removeItem("ab-connection-id");
                  setConnectionId("");
                }}
              >
                {t(lang, "forgetBtn")}
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "contents" }}>
            {m.role === "user" ? (
              <div className="msg user">{m.display ?? m.content}</div>
            ) : (
              <div className="msgrow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="avatar" src="/logo_icone.png" alt="" aria-hidden />
                <div className="msg assistant">{m.content}</div>
              </div>
            )}
            {(m.ui ?? []).map((e, j) => {
              if (e.kind === "connect") {
                return (
                  <ConnectCard
                    key={j}
                    e={e}
                    lang={lang}
                    busy={busy}
                    onConnected={() => void fetchActivities("C’est fait, je me suis connecté à Strava.")}
                  />
                );
              }
              if (e.kind === "activities") {
                return (
                  <ActivitiesCard
                    key={j}
                    e={e}
                    lang={lang}
                    busy={busy}
                    listOpen={listOpen}
                    onToggleList={() => setListOpen((v) => !v)}
                    selected={selected}
                    onToggleActivity={(a, checked) =>
                      setSelected((prev) => ({ ...prev, [a.strava_activity_id]: checked }))
                    }
                    onConfirm={(skip) => confirmSelection(skip)}
                  />
                );
              }
              return (
                <BookCard
                  key={j}
                  e={e}
                  lang={lang}
                  copiedBook={copiedBook}
                  onCopied={setCopiedBook}
                />
              );
            })}
          </div>
        ))}
        {busy && (
          <div className="status" role="status">
            <span className="spinner" aria-hidden />
            {status ?? t(lang, "working")}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <FilesPanel
        lang={lang}
        device={device}
        busy={busy}
        photoBusy={photoBusy}
        manual={manual}
        photos={photos}
        photosOpen={photosOpen}
        known={knownDates()}
        onGpxFiles={(f) => void onGpxFiles(f)}
        onPhotoFiles={(f) => void onPhotoFiles(f)}
        onRemoveManual={(id) => setManual((m) => m.filter((x) => x.id !== id))}
        onCreateManual={createManualBook}
        onTogglePhotosOpen={() => setPhotosOpen((v) => !v)}
        onAssignPhoto={(id, activityId) =>
          setPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, activityId } : x)))
        }
        onPreparePhotos={() => void preparePhotos()}
        onRemovePhoto={(id) => {
          setPhotos((prev) => {
            const target = prev.find((p) => p.id === id);
            if (target) URL.revokeObjectURL(target.thumb);
            return prev.filter((p) => p.id !== id);
          });
          photoFiles.current.delete(id);
        }}
        onClearPhotos={() => {
          for (const p of photos) URL.revokeObjectURL(p.thumb);
          for (const p of photos) photoFiles.current.delete(p.id);
          setPhotos([]);
          setPhotosOpen(false);
        }}
      />

      {challenge && (
        <HumanCheck
          onToken={(token) => {
            const pending = challenge;
            setChallenge(null);
            if (pending) void send(pending.text, pending.display, token);
          }}
        />
      )}
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
          placeholder={t(lang, "placeholder")}
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
          {transcribing ? t(lang, "transcribing") : recording ? t(lang, "stop") : t(lang, "speak")}
        </button>
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          {t(lang, "send")}
        </button>
      </form>
      <div className="hint">
        {recording
          ? `${t(lang, "speak")}… → ${t(lang, "stop")}`
          : `${t(lang, "speak")} → ${t(lang, "send")} · GPX / photos ↓`}
        {" · "}
        <a href="/transparence">
          {lang === "en" ? "Transparency & your data" : "Transparence et vos données"}
        </a>
      </div>
    </div>
  );
}
