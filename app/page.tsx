"use client";

import { useEffect, useRef, useState } from "react";
import { activityBadges, isHighlight } from "@/lib/highlights";
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
import { parseGpx, type GpxActivity } from "@/lib/gpx";
import exifr from "exifr";

type ManualActivity = GpxActivity & { id: string };
type PhotoItem = {
  id: string;
  name: string;
  thumb: string;
  exifDate: string | null;
  activityId: string;
  kept: boolean | null;
  reason?: string;
  uploadedUrl?: string;
  status?: string;
};

async function fileToDataUrl(file: File, maxDim = 900): Promise<string> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
}

function fullDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type Activity = {
  strava_activity_id: string;
  title: string;
  date: string;
  sport?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  photos?: number;
  has_route?: boolean;
  is_race?: boolean;
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
    "Bonjour ! Dites-moi quel livre vous voulez — par exemple « Mon été dans les Pyrénées ». Vous pouvez parler au micro ou écrire. Je connecte votre Strava, je choisis les sorties avec vous, et je prépare le brouillon du livre. Pas de Strava ? Dites-le-moi : on partira d’une liste que vous me dictez.\n\nHi! Tell me what book you want — e.g. “My summer in the Pyrenees”. Speak or type; I’ll reply in your language. No Strava? Just say so — we’ll use a list you dictate.",
};

const WARMUP_RE =
  /échauffement|echauffement|warm.?up|cooldown|cool down|retour au calme|récup|recup|recovery|déblocage|deblocage/i;

/** Same-day rule: main outing ticked, warm-ups unticked. No count cap. */
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

function formatPrice(price: unknown, lang: Lang): string | null {
  return fmtPrice(price, lang);
}

export default function Home() {
  const [device, setDevice] = useState<DeviceKind>("desktop");
  const [lang, setLang] = useState<Lang>("fr");
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
      // Prepared photos leave the dropzone: they belong to the book now.
      // Only photos whose upload failed stay, with their status visible.
      setPhotos((prev) => prev.filter((p) => !uploaded.has(p.id)));
      for (const id of uploaded.keys()) photoFiles.current.delete(id);
      setPhotosOpen(false);
      await send(
        `Voici les photos préparées pour le livre (garde/photo_urls, recopie les liens sans les modifier). Rattachées :\n${lines.join("\n")}\nPlace toi-même les photos libres (rattachées à la bonne sortie, en pleine page, ou en page photo à part) et dis-moi en une ligne ce que tu as fait. Au moins 25% des photos en pleine page, sur au moins 25% des sorties qui ont des photos.`,
        lang === "en"
          ? `${uploaded.size} photo(s) ready — placing them in the book.`
          : `${uploaded.size} photo(s) prête(s) — je les place dans le livre.`,
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

  async function send(text: string, display?: string) {
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
          context: {
            ...(connectionId ? { connectionId } : {}),
            ...(confirmedIds.length ? { confirmedIds } : {}),
          },
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
          onChange={(e) => setLang(e.target.value as Lang)}
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
                  <div className="card" key={j}>
                    <h2>{t(lang, "connectTitle")}</h2>
                    <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
                      <li>Click “Connect Strava” below and authorise on Strava. That page is AdvenBook’s — it will not bring you back here by itself.</li>
                      <li>Come back here: at the top of your browser, click the other tab (« AdvenBook Agent » / localhost) — or close the Strava tab with its ×. This page stays open underneath, nothing is lost.</li>
                      <li>Click “I’ve connected — continue”. I’ll then read your outings.</li>
                    </ol>
                    <div className="row" style={{ marginTop: 0 }}>
                      <a className="btn" href={e.connectUrl} target="_blank" rel="noreferrer">
                        {t(lang, "connectBtn")}
                      </a>
                      <button
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void fetchActivities("C’est fait, je me suis connecté à Strava.")}
                      >
                        {t(lang, "connectedBtn")}
                      </button>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#5a6b52" }}>
                      Link valid 24 hours. If reading fails, the authorisation may not have finished — reconnect, then click continue again.
                    </p>
                  </div>
                );
              }
              if (e.kind === "activities") {
                const chosenCount = e.activities.filter(
                  (a) => selected[a.strava_activity_id],
                ).length;
                const highlights = e.activities.filter(isHighlight);
                return (
                  <div className="card" key={j}>
                    <h2>{t(lang, "outingsTitle")}</h2>
                    <p style={{ margin: "0 0 6px", fontSize: 14 }}>
                      <strong>{chosenCount} {t(lang, "ticked")}</strong> {t(lang, "on")} {e.activities.length}
                      {highlights.length > 0
                        ? ` · ${highlights.length} ${t(lang, "toHighlight")}`
                        : ""}
                      . Course de chaque jour cochée, échauffements décochés — vous pouvez
                      tout valider tel quel, sans ouvrir la liste.
                    </p>
                    {highlights.length > 0 && (
                      <p style={{ margin: "0 0 6px", fontSize: 13 }}>
                        {highlights
                          .slice(0, 3)
                          .map((a) => a.title)
                          .join(" · ")}
                        {highlights.length > 3 ? "…" : ""}
                      </p>
                    )}
                    <button
                      className="btn secondary"
                      onClick={() => setListOpen((v) => !v)}
                      aria-expanded={listOpen}
                    >
                      {listOpen
                        ? t(lang, "hideList")
                        : `${t(lang, "showList")} (${e.activities.length})`}
                    </button>
                    {listOpen &&
                      e.activities.map((a) => (
                      <label
                        className={isHighlight(a) ? "check highlight" : "check"}
                        key={a.strava_activity_id}
                      >
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
                          {isHighlight(a) && (
                            <span className="badges">
                              <span className="badge star">À mettre en valeur</span>
                              {activityBadges(a).map((b) => (
                                <span className="badge" key={b}>{b}</span>
                              ))}
                            </span>
                          )}
                          <small>
                            {a.date}
                            {a.sport ? ` · ${a.sport}` : ""}
                            {a.distance_km != null ? ` · ${fmtDistance(a.distance_km, lang)}` : ""}
                            {a.elevation_gain_m != null ? ` · ${fmtElevation(a.elevation_gain_m, lang)}` : ""}
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
                        {t(lang, "continueSelected")}
                      </button>
                      <button
                        className="btn secondary"
                        disabled={busy || !latestActivities}
                        onClick={() => confirmSelection(true)}
                      >
                        {t(lang, "skipCreate")}
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="card book" key={j}>
                  <h2>{t(lang, "bookReady")}</h2>
                  <p className="price">
                    {e.estimatedPages ? `~${e.estimatedPages} ${t(lang, "aboutPages")}. ` : ""}
                    {formatPrice(e.price, lang)
                      ? `${t(lang, "estPrice")} : ${formatPrice(e.price, lang)}. `
                      : ""}
                    {t(lang, "draftNote")}
                  </p>
                  <div className="row" style={{ marginTop: 0 }}>
                    <a
                      className="btn cta"
                      href={e.editorUrl ?? e.claimUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(ev) => {
                        // Embedded browsers (chat previews, webviews) often
                        // ignore target=_blank and replace this page. Try a
                        // real popup first; the copy button below is the
                        // guaranteed fallback.
                        ev.preventDefault();
                        const w = window.open(
                          e.editorUrl ?? e.claimUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                        if (!w) {
                          // Popup refused (embedded browser): do NOT replace
                          // this page — copy the link instead.
                          void navigator.clipboard
                            ?.writeText(e.editorUrl ?? e.claimUrl)
                            .catch(() => undefined);
                          setCopiedBook(e.bookId || "1");
                        }
                      }}
                    >
                      {t(lang, "openBook")}
                    </a>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        void navigator.clipboard
                          ?.writeText(e.editorUrl ?? e.claimUrl)
                          .catch(() => undefined);
                        setCopiedBook(e.bookId || "1");
                      }}
                    >
                      {copiedBook === (e.bookId || "1")
                        ? lang === "en"
                          ? "Link copied"
                          : "Lien copié"
                        : lang === "en"
                          ? "Copy the book link"
                          : "Copier le lien du livre"}
                    </button>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--brand-muted)" }}>
                    {lang === "en"
                      ? "If this preview replaces the agent page (embedded browser), copy the link and open it in Chrome or Safari — nothing is lost, the book is saved."
                      : "Si cet aperçu remplace la page de l’agent (navigateur intégré), copiez le lien et ouvrez-le dans Chrome ou Safari — rien n’est perdu, le livre est enregistré."}
                  </p>
                </div>
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

      <section
        className="files-panel"
        aria-label="Ajouter GPX et photos"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          const gpx = files.filter((f) => f.name.toLowerCase().endsWith(".gpx"));
          const imgs = files.filter((f) => f.type.startsWith("image/"));
          if (gpx.length) {
            const dt = new DataTransfer();
            gpx.forEach((f) => dt.items.add(f));
            void onGpxFiles(dt.files);
          }
          if (imgs.length) {
            const dt = new DataTransfer();
            imgs.forEach((f) => dt.items.add(f));
            void onPhotoFiles(dt.files);
          }
        }}
      >
        <p
          style={{ margin: "0 0 6px", fontSize: 12, color: "var(--brand-muted)" }}
          title={
            device === "iphone"
              ? t(lang, "hintIPhone")
              : device === "android"
                ? t(lang, "hintAndroid")
                : t(lang, "hintDesktop")
          }
        >
          {device === "iphone"
            ? lang === "en"
              ? "iPhone — Photos opens directly."
              : "iPhone — la photothèque s’ouvre directement."
            : device === "android"
              ? lang === "en"
                ? "Android — your gallery opens directly."
                : "Android — la galerie s’ouvre directement."
              : lang === "en"
                ? "Drop files here, or use the buttons."
                : "Glissez des fichiers ici, ou utilisez les boutons."}
        </p>
        <div className="row" style={{ marginTop: 0 }}>
          <label className="btn secondary" style={{ cursor: "pointer" }}>
            {t(lang, "addGpx")}
            <input
              type="file"
              accept=".gpx"
              multiple
              hidden
              onChange={(e) => {
                void onGpxFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="btn secondary" style={{ cursor: "pointer" }}>
            {t(lang, "addPhotos")}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void onPhotoFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {manual.length > 0 && (
            <button className="btn cta" disabled={busy} onClick={createManualBook}>
              {t(lang, "createWithMine")} ({manual.length})
            </button>
          )}
        </div>
        {manual.map((a) => (
          <p key={a.id} style={{ margin: "8px 0 0", fontSize: 13 }}>
            <strong>{a.title}</strong> · {a.date} · {fmtDistance(a.distanceKm, lang)} · {fmtElevation(a.elevationGainM, lang)} · GPS OK
            <button
              className="btn secondary"
              style={{ marginLeft: 8, minHeight: 32, padding: "4px 10px" }}
              onClick={() => setManual((m) => m.filter((x) => x.id !== a.id))}
            >
              {t(lang, "remove")}
            </button>
          </p>
        ))}
        {photos.length > 0 && (
          <>
            <div className="photo-strip" aria-label="Photos ajoutées">
              {photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.thumb}
                  alt={p.name}
                  title={`${p.name} — ${p.kept === true ? "gardée" : p.kept === false ? "écartée" : "ajoutée"}${p.reason ? ` : ${p.reason}` : ""}`}
                />
              ))}
              <span style={{ fontSize: 13, alignSelf: "center" }}>
                {photos.length} photo(s)
                {photos.some((p) => p.kept) ? ` · ${photos.filter((p) => p.kept).length} gardée(s)` : ""}
              </span>
              <button
                className="btn secondary"
                style={{ minHeight: 36, padding: "6px 10px" }}
                onClick={() => setPhotosOpen((v) => !v)}
                aria-expanded={photosOpen}
              >
                {photosOpen ? "Masquer le détail" : "Détail / ranger"}
              </button>
            </div>
            {photosOpen && (
              <div className="photo-grid">
                {photos.map((p) => (
                  <figure key={p.id} className="photo-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={p.name} />
                    <figcaption>
                      {p.exifDate ?? "date inconnue"}
                      {p.kept === true ? " · gardée" : p.kept === false ? " · écartée" : ""}
                      {p.reason ? ` — ${p.reason}` : ""}
                      {p.status ? ` · ${p.status}` : ""}
                      <select
                        value={p.activityId}
                        onChange={(e) =>
                          setPhotos((prev) =>
                            prev.map((x) =>
                              x.id === p.id ? { ...x, activityId: e.target.value } : x,
                            ),
                          )
                        }
                        aria-label="Sortie de cette photo"
                      >
                        <option value="">Photo libre — l’agent la place tout seul</option>
                        {knownDates().map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.title} ({k.date})
                          </option>
                        ))}
                      </select>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            <div className="row">
              <button className="btn cta" disabled={photoBusy || busy} onClick={() => void preparePhotos()}>
                {photoBusy
                  ? lang === "en"
                    ? "Preparing…"
                    : "Préparation en cours…"
                  : lang === "en"
                    ? "Use these photos in the book"
                    : "Utiliser ces photos dans le livre"}
              </button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--brand-muted)" }}>
              {lang === "en"
                ? "One tap: the AI keeps the best, crops them safely, sends them, and places free photos itself (attached, full page, or its own page)."
                : "Un seul toucher : l’IA garde les meilleures, les recadre sans couper le sujet, les envoie, et place elle-même les photos libres (rattachées, pleine page, ou page à part)."}
            </p>
          </>
        )}
      </section>

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
      </div>
    </div>
  );
}
