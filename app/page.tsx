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
import { parseGpx, parseTcx } from "@/lib/gpx";
import { parseFit } from "@/lib/fit";
import type { GpxActivity } from "@/lib/gpx";
import exifr from "exifr";
import type {
  Activity,
  ManualActivity,
  Msg,
  MyBook,
  PhotoItem,
  UiEvent,
} from "@/lib/chat-types";
import { upload } from "@vercel/blob/client";
import { blobPathnameFor, chunkItems, errorKeyForStatus, parseJsonText } from "@/lib/photo-payload";
import { encodeWav } from "@/lib/voice";
import { ActivitiesCard, BookCard, ConnectCard, CoverCard, MyBooksCard } from "./components/cards";
import {
  preserveSelection,
  selectTickedActivities,
  type BookChoice,
} from "@/lib/book-choice";
import { CelebrationCard, type CelebData } from "./components/CelebrationCard";
import { FilesPanel, isImageFile, isTrackFile } from "./components/FilesPanel";
import { KomootCard } from "./components/KomootCard";

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! Tell me what book you want — e.g. “My summer in the Pyrenees”. Speak or type; I’ll reply in your language. No Strava? No problem: Garmin, Komoot or a folder of GPX files + photos works too — drop them below or paste a Komoot link.",
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
  // Localised welcome (all 6 languages) until the conversation starts.
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].role === "assistant"
        ? [{ role: "assistant", content: t(lang, "welcome") }]
        : prev,
    );
  }, [lang]);
  const [input, setInput] = useState("");
  const createdBookRef = useRef<{ bookId: string; claimUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copiedBook, setCopiedBook] = useState("");
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const confirmedIdsRef = useRef<string[]>([]);
  const [challenge, setChallenge] = useState<{ text: string; display?: string } | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const coverUrlRef = useRef("");
  // Continue-or-new: asked at most once, stored here (+ sessionStorage).
  // Once set, the mybooks card is never shown and get_my_books is never
  // called again (server also filters those tools for the model).
  const [bookChoice, setBookChoiceState] = useState<BookChoice | null>(null);
  const bookChoiceRef = useRef<BookChoice | null>(null);
  const myBooksShownRef = useRef(false);
  function setBookChoice(choice: BookChoice | null) {
    bookChoiceRef.current = choice;
    setBookChoiceState(choice);
    try {
      if (choice) window.sessionStorage.setItem("ab-book-choice", JSON.stringify(choice));
      else window.sessionStorage.removeItem("ab-book-choice");
    } catch {
      // in-memory ref still keeps this conversation coherent
    }
  }
  const [celebration, setCelebration] = useState<CelebData | null>(null);
  const sessionStatsRef = useRef({ outings: 0, km: 0, elev: 0 });
  const preparedCelebPhotosRef = useRef<{ thumb: string; reason?: string }[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [photosOpen, setPhotosOpen] = useState(false);
  const [manual, setManual] = useState<ManualActivity[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const photosRef = useRef<PhotoItem[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
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

  const selectedRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // The Strava connection_id survives reloads / tab switches.
  useEffect(() => {
    const saved = window.localStorage.getItem("ab-connection-id");
    if (saved) setConnectionId(saved);
    try {
      const raw = window.sessionStorage.getItem("ab-book-choice");
      if (raw) {
        const parsed = JSON.parse(raw) as BookChoice;
        if (parsed.kind === "new" || (parsed.kind === "continue" && parsed.bookId)) {
          bookChoiceRef.current = parsed;
          setBookChoiceState(parsed);
          myBooksShownRef.current = true;
        }
      }
    } catch {
      // no stored choice: it will be asked once, after connecting
    }
  }, []);

  // Anonymous conversation id for cost/funnel tracking (c_ + 16 chars,
  // session-scoped, never any personal data) + first-touch UTM source.
  const conversationRef = useRef<{
    id: string;
    source: { utm_source: string; utm_medium: string; utm_content: string };
  } | null>(null);
  function conversationInfo() {
    if (conversationRef.current) return conversationRef.current;
    let id = "";
    let source = { utm_source: "", utm_medium: "", utm_content: "" };
    try {
      id = window.sessionStorage.getItem("ab-conversation-id") ?? "";
      const savedSource = window.sessionStorage.getItem("ab-conversation-source");
      if (savedSource) source = JSON.parse(savedSource) as typeof source;
    } catch {
      // storage unavailable: fall through to fresh values
    }
    if (!/^c_[A-Za-z0-9]{16}$/.test(id)) {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = `c_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
      const params = new URLSearchParams(window.location.search);
      source = {
        utm_source: params.get("utm_source") ?? "",
        utm_medium: params.get("utm_medium") ?? "",
        utm_content: params.get("utm_content") ?? "",
      };
      try {
        window.sessionStorage.setItem("ab-conversation-id", id);
        window.sessionStorage.setItem("ab-conversation-source", JSON.stringify(source));
      } catch {
        // in-memory ref below still keeps the conversation coherent
      }
    }
    conversationRef.current = { id, source };
    return conversationRef.current;
  }

  /** Read a fetch response as JSON without ever surfacing a raw parser
   *  error (Vercel answers 413 as plain text, not JSON). */
  async function parseResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const parsed = parseJsonText(text);
    if (!parsed.ok) {
      throw new Error(t(lang, errorKeyForStatus(res.status)));
    }
    return parsed.value as T;
  }

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
    setStatus(t(lang, "stravaReading"));
    try {
      const res = await fetch("/api/strava/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          lang,
          conversationId: conversationInfo().id,
          ...(bookChoiceRef.current ? { bookChoice: bookChoiceRef.current } : {}),
        }),
      });
      const data = await parseResponse<{
        activities?: Activity[];
        books?: MyBook[];
        error?: string;
      }>(res);
      if (!res.ok || data.error) {
        setMessages([
          ...base,
          {
            role: "assistant",
            content: data.error ?? t(lang, "stravaReadFailed"),
          },
        ]);
        return;
      }
      const activities = data.activities ?? [];
      const books = data.books ?? [];
      // Never lose a tick: existing ticks win, new ids get the suggestion.
      setSelected((prev) => preserveSelection(prev, activities, suggestedSelection(activities)));
      const firstDraft = books.find((b) => b.status === "draft");
      // Continue-or-new is asked at most once per conversation.
      const showBooks = books.length > 0 && !bookChoiceRef.current && !myBooksShownRef.current;
      if (showBooks) myBooksShownRef.current = true;
      setMessages([
        ...base,
        ...(showBooks
          ? [
              {
                role: "assistant" as const,
                content: firstDraft
                  ? t(lang, "foundBook")
                      .replace("{title}", firstDraft.title)
                      .replace("{n}", String(firstDraft.activities))
                  : t(lang, "orderedNote"),
                ui: [{ kind: "mybooks" as const, books }],
              },
            ]
          : []),
        {
          role: "assistant",
          content:
            activities.length === 0
              ? t(lang, "connectedNone")
              : t(lang, "connectedList").replace("{n}", String(activities.length)),
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
          content: t(lang, "stravaNetworkError"),
        },
      ]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  /** Parse GPX / TCX (Garmin) / FIT files into manual outings. Returns
   *  the outings created, so a folder drop can match photos right after. */
  async function importTrackFiles(files: File[]): Promise<ManualActivity[]> {
    const created: ManualActivity[] = [];
    for (const file of files) {
      try {
        const lower = file.name.toLowerCase();
        const parsed = lower.endsWith(".fit")
          ? await parseFit(await file.arrayBuffer(), file.name)
          : lower.endsWith(".tcx")
            ? parseTcx(await file.text())
            : parseGpx(await file.text());
        const activity: ManualActivity = { ...parsed, id: crypto.randomUUID() };
        created.push(activity);
        setManual((m) => [...m, activity]);
      } catch {
        setMessages((msgs) => [
          ...msgs,
          {
            role: "assistant",
            content: t(lang, "fileReadError").replace("{name}", file.name),
          },
        ]);
      }
    }
    return created;
  }

  async function onGpxFiles(files: FileList | File[] | null) {
    if (!files) return;
    await importTrackFiles(Array.from(files as File[]));
  }

  /** Whole folder (or mixed drop): tracks first, then photos matched to
   *  the outings just imported (EXIF date/GPS) plus the ones already known. */
  async function onFolderFiles(files: File[]) {
    const capped = files.slice(0, 300);
    const tracks = capped.filter(isTrackFile);
    const imgs = capped.filter(isImageFile);
    const created = tracks.length ? await importTrackFiles(tracks) : [];
    if (imgs.length) {
      const known = [
        ...manual.map((a) => ({ id: a.id, title: a.title, date: a.date })),
        ...created.map((a) => ({ id: a.id, title: a.title, date: a.date })),
      ];
      await onPhotoFiles(imgs, known);
    }
  }

  /** Komoot link pasted in chat: tour -> outing now, profile -> checklist. */
  async function importKomootUrl(url: string, userText: string) {
    const base: Msg[] = [...messages, { role: "user", content: userText }];
    setMessages(base);
    setBusy(true);
    setStatus(t(lang, "readingKomoot"));
    try {
      const res = await fetch("/api/komoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await parseResponse<{
        mode?: string;
        tours?: Extract<UiEvent, { kind: "komoot" }>["tours"];
        outings?: GpxActivity[];
        error?: string;
      }>(res);
      if (!res.ok || data.error) {
        setMessages([...base, { role: "assistant", content: data.error ?? t(lang, "komootReadError") }]);
        return;
      }
      if (data.mode === "profile" && data.tours?.length) {
        const shareToken = new URL(url).searchParams.get("share_token") ?? undefined;
        setMessages([
          ...base,
          {
            role: "assistant",
            content: t(lang, "komootFound").replace("{n}", String(data.tours.length)),
            ui: [{ kind: "komoot", tours: data.tours, ...(shareToken ? { shareToken } : {}) }],
          },
        ]);
        return;
      }
      const outings = data.outings ?? [];
      setManual((m) => [...m, ...outings.map((o) => ({ ...o, id: crypto.randomUUID() }))]);
      setMessages([
        ...base,
        {
          role: "assistant",
          content: t(lang, "komootAdded").replace("{n}", String(outings.length)),
        },
      ]);
    } catch {
      setMessages([...base, { role: "assistant", content: t(lang, "netError") }]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function importKomootTours(tourIds: string[], shareToken?: string) {
    if (busy || tourIds.length === 0) return;
    setBusy(true);
    setStatus(t(lang, "readingKomoot"));
    try {
      const res = await fetch("/api/komoot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourIds, ...(shareToken ? { shareToken } : {}) }),
      });
      const data = await parseResponse<{ outings?: GpxActivity[]; error?: string }>(res);
      if (!res.ok || data.error) {
        setMessages((msgs) => [...msgs, { role: "assistant", content: data.error ?? t(lang, "komootReadError") }]);
        return;
      }
      const outings = data.outings ?? [];
      setManual((m) => [...m, ...outings.map((o) => ({ ...o, id: crypto.randomUUID() }))]);
      setMessages((msgs) => [
        ...msgs,
        {
          role: "assistant",
          content: t(lang, "komootAdded").replace("{n}", String(outings.length)),
        },
      ]);
    } catch {
      setMessages((msgs) => [...msgs, { role: "assistant", content: t(lang, "netError") }]);
    } finally {
      setBusy(false);
      setStatus(null);
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

  async function onPhotoFiles(
    files: FileList | File[] | null,
    knownOverride?: { id: string; title: string; date: string }[],
  ) {
    if (!files) return;
    const known = knownOverride ?? knownDates();
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
    setStatus(t(lang, "choosingPhotos"));
    let firstError: string | null = null;
    const noteError = (err: unknown) => {
      if (!firstError) {
        firstError = err instanceof Error ? err.message : t(lang, "invalidResponse");
      }
    };
    try {
      const known = knownDates();
      // 1) Direct browser -> Vercel Blob upload, full quality, per photo.
      //    The bytes never pass through an API route, so no photo can be
      //    rejected for its size. Only the returned URL travels onwards.
      setStatus(t(lang, "uploadingPhotos"));
      const originals = new Map<string, string>();
      for (const p of photos) {
        if (p.originalUrl) {
          originals.set(p.id, p.originalUrl);
          continue;
        }
        const file = photoFiles.current.get(p.id);
        if (!file) continue;
        try {
          const blob = await upload(blobPathnameFor(p.id, p.name), file, {
            access: "public",
            handleUploadUrl: "/api/photos/upload",
            contentType: file.type || undefined,
            multipart: file.size >= 4 * 1024 * 1024,
          });
          originals.set(p.id, blob.url);
          setPhotos((prev) =>
            prev.map((x) => (x.id === p.id ? { ...x, originalUrl: blob.url } : x)),
          );
        } catch (err) {
          // This photo stays in the drop zone for a retry; others continue.
          noteError(err);
          const msg = err instanceof Error ? err.message : t(lang, "photoUploadFailed");
          setPhotos((prev) =>
            prev.map((x) => (x.id === p.id ? { ...x, status: msg } : x)),
          );
        }
      }
      // 2) Vision selection by URL only (tiny bodies, batched at the cap).
      setStatus(t(lang, "choosingPhotos"));
      const groups = new Map<string, PhotoItem[]>();
      for (const p of photos) {
        if (!originals.has(p.id)) continue;
        const key = p.activityId || "__free__";
        groups.set(key, [...(groups.get(key) ?? []), p]);
      }
      const keepIds = new Set<string>();
      const reasons = new Map<string, string>();
      for (const [activityId, group] of groups) {
        const title =
          activityId === "__free__"
            ? t(lang, "freePhotos")
            : (known.find((k) => k.id === activityId)?.title ?? t(lang, "outingFallback"));
        const images = group.map((p) => ({ id: p.id, url: originals.get(p.id) as string }));
        for (const batch of chunkItems(images)) {
          try {
            const res = await fetch("/api/photos/select", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ outingTitle: title, images: batch, conversationId: conversationInfo().id }),
            });
            const data = await parseResponse<{
              keep?: { id: string; reason: string }[];
              error?: string;
            }>(res);
            if (!res.ok || data.error) throw new Error(data.error ?? t(lang, "analysisFailed"));
            for (const k of data.keep ?? []) {
              keepIds.add(k.id);
              reasons.set(k.id, k.reason);
            }
          } catch (err) {
            // One failed batch must not stop the others: keep its photos.
            noteError(err);
            for (const img of batch) keepIds.add(img.id);
          }
        }
      }
      if (keepIds.size === 0) {
        for (const p of photos) keepIds.add(p.id); // vision kept none: keep all rather than block
      }
      setPhotos((prev) =>
        prev.map((p) => ({ ...p, kept: keepIds.has(p.id), reason: reasons.get(p.id) })),
      );
      // 3) SAM crop by URL only. If cropping fails for any reason, the
      //    full-quality original (already public on Blob) is used as-is:
      //    every kept photo reaches the book, whatever its size.
      setStatus(t(lang, "croppingUploading"));
      const uploaded = new Map<string, string>();
      for (const p of photos) {
        if (!keepIds.has(p.id)) continue;
        if (p.uploadedUrl) {
          uploaded.set(p.id, p.uploadedUrl);
          continue;
        }
        const originalUrl = originals.get(p.id);
        if (!originalUrl) continue; // upload failed above: stays for a retry
        try {
          const res = await fetch("/api/photos/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: originalUrl,
              fileName: p.name,
              conversationId: conversationInfo().id,
            }),
          });
          const data = await parseResponse<{ url?: string; error?: string; fallback?: boolean }>(res);
          const finalUrl = data.url ?? originalUrl;
          uploaded.set(p.id, finalUrl);
          setPhotos((prev) =>
            prev.map((x) =>
              x.id === p.id ? { ...x, uploadedUrl: finalUrl, status: t(lang, "photoReadyStatus") } : x,
            ),
          );
        } catch (err) {
          noteError(err);
          uploaded.set(p.id, originalUrl);
          setPhotos((prev) =>
            prev.map((x) =>
              x.id === p.id ? { ...x, uploadedUrl: originalUrl, status: t(lang, "photoReadyStatus") } : x,
            ),
          );
        }
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
      if (free.length) lines.push(`- ${t(lang, "freePhotos")} : ${free.join(", ")}`);
      const skippedCount = photos.length - uploaded.size;
      if (lines.length === 0) {
        // Single summary message for the whole run (never shown twice).
        setMessages((msgs) => [
          ...msgs,
          {
            role: "assistant",
            content: `${t(lang, "photosNoneReady").replace("{skipped}", String(skippedCount))}${firstError ? ` (${firstError})` : ""}`,
          },
        ]);
        return;
      }
      // Once used, EVERY photo of the batch leaves the dropzone: the
      // uploaded ones belong to the book now, and the ones the AI dropped
      // were considered and rejected — keeping them on screen trapped
      // the user in a re-analyse loop. Only photos the AI kept but whose
      // upload failed stay, with their status visible for a retry.
      const removed = photos.filter(
        (p) => uploaded.has(p.id) || !keepIds.has(p.id),
      );
      for (const p of removed) {
        // Uploaded photos keep their thumbnail alive: the cover-choice
        // card below displays them. Dropped ones are freed right away.
        if (!uploaded.has(p.id)) URL.revokeObjectURL(p.thumb);
        photoFiles.current.delete(p.id);
      }
      setPhotos((prev) =>
        prev.filter((p) => keepIds.has(p.id) && !uploaded.has(p.id)),
      );
      setPhotosOpen(false);
      await send(
        `Voici les photos préparées pour le livre (garde/photo_urls, recopie les liens sans les modifier). Rattachées :\n${lines.join("\n")}\nPlace toi-même les photos libres (rattachées à la bonne sortie, en pleine page, ou en page photo à part) et dis-moi en une ligne ce que tu as fait. Au moins 25% des photos en pleine page, sur au moins 25% des sorties qui ont des photos.`,
        t(lang, "photosReadySkipped")
          .replace("{ready}", String(uploaded.size))
          .replace("{skipped}", String(skippedCount)),
      );
      // The wow moment: show the best uploaded photos composed as real
      // covers. One tap picks the book's cover photo (cover_photo_url).
      const coverPhotos = photos
        .filter((p) => uploaded.has(p.id))
        .map((p) => ({ id: p.id, thumb: p.thumb, url: uploaded.get(p.id) as string }))
        .slice(0, 3);
      preparedCelebPhotosRef.current = photos
        .filter((p) => uploaded.has(p.id))
        .map((p) => ({ thumb: p.thumb, reason: reasons.get(p.id) }))
        .slice(0, 3);
      if (coverPhotos.length >= 2) {
        const firstAsk =
          messages.find((m) => m.role === "user")?.content ?? "Aventures";
        const coverTitle =
          firstAsk.length > 52 ? `${firstAsk.slice(0, 52).trim()}…` : firstAsk;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t(lang, "coverIntro"),
            ui: [{ kind: "cover", title: coverTitle, photos: coverPhotos }],
          },
        ]);
      }
    } catch (err) {
      // Unexpected whole-run failure: one message only, in the user's language.
      noteError(err);
      setMessages((msgs) => [
        ...msgs,
        {
          role: "assistant",
          content: `${t(lang, "photosNoneReady").replace("{skipped}", String(photos.length))}${firstError ? ` (${firstError})` : ""}`,
        },
      ]);
    } finally {
      setPhotoBusy(false);
      setStatus(null);
    }
  }

  function createManualBook() {
    if (manual.length === 0) return;
    const dataSource = manual.some((a) => a.source === "other") ? "other" : "gpx_files";
    const lines = manual.map((a) => {
      const urls = [
        ...(a.photoUrls ?? []),
        ...photos
          .filter((p) => p.activityId === a.id && p.uploadedUrl)
          .map((p) => p.uploadedUrl as string),
      ];
      return `- ${a.title} | date ${a.date} | ${a.distanceKm} km | ${a.elevationGainM} m D+ | ${a.duration || "?"} | sport ${a.sport ?? "Randonnée"} | gps_polyline: ${a.polyline}${urls.length ? ` | photo_urls: ${urls.join(", ")}` : ""}`;
    });
    const freeUrls = photos
      .filter((p) => !p.activityId && p.uploadedUrl)
      .map((p) => p.uploadedUrl as string);
    void send(
      `Crée un livre sans Strava (source ${dataSource}) avec exactement ces sorties, recopie chaque gps_polyline et photo_urls sans les modifier :\n${lines.join("\n")}${freeUrls.length ? `\nPhotos libres (pas encore rattachées) : ${freeUrls.join(", ")}. Place-les toi-même (rattachées à la bonne sortie, en pleine page, ou en page photo à part avec un titre court), sans me demander, et dis-moi en une ligne ce que tu as fait.` : ""}`,
      t(lang, "createManualDisplay").replace("{n}", String(manual.length)),
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
        form.append("conversationId", conversationInfo().id);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await parseResponse<{ text?: string; error?: string }>(res);
        if (!res.ok || data.error) throw new Error(data.error ?? t(lang, "invalidResponse"));
        if (data.text) {
          setInput((prev) => (prev ? `${prev} ${data.text}` : data.text ?? ""));
        }
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: t(lang, "transcriptionFailed").replace("{err}", err instanceof Error ? err.message : t(lang, "invalidResponse")),
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
          content: t(lang, "micUnavailable"),
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
    // A Komoot link pasted in chat is imported directly, no LLM guessing.
    const komootMatch = clean.match(/https?:\/\/(?:www\.)?komoot\.(?:com|de)\/[^\s)]+/i);
    if (komootMatch) {
      await importKomootUrl(komootMatch[0], clean);
      setInput("");
      return;
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
    setStatus(t(lang, "thinking"));
    try {
      const conv = conversationInfo();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conv.id,
          source: conv.source,
          lang,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: {
            ...(connectionId ? { connectionId } : {}),
            ...(confirmedIdsRef.current.length
              ? { confirmedIds: confirmedIdsRef.current }
              : confirmedIds.length
                ? { confirmedIds }
                : {}),
            ...(coverUrlRef.current ? { coverPhotoUrl: coverUrlRef.current } : {}),
            ...(bookChoiceRef.current ? { bookChoice: bookChoiceRef.current } : {}),
            ...(bookChoiceRef.current?.kind === "continue"
              ? { continueBookId: bookChoiceRef.current.bookId }
              : {}),
            pendingPhotos: photosRef.current.length,
            ...(createdBookRef.current ? { createdBook: createdBookRef.current } : {}),
          },
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      const data = await parseResponse<{
        reply?: string;
        ui?: UiEvent[];
        toolEvents?: { label: string }[];
        error?: string;
        code?: string;
        challenge?: boolean;
        detectedLang?: string;
      }>(res);
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
          // Never lose a tick between turns: existing ticks always win;
          // after a confirmation the selection is locked exactly as ticked.
          setSelected((prev) =>
            confirmedIdsRef.current.length > 0
              ? Object.fromEntries(
                  e.activities.map((a) => [
                    a.strava_activity_id,
                    confirmedIdsRef.current.includes(a.strava_activity_id),
                  ]),
                )
              : preserveSelection(prev, e.activities, suggestedSelection(e.activities)),
          );
        }
        if (e.kind === "book") {
          if (e.bookId && e.claimUrl) createdBookRef.current = { bookId: e.bookId, claimUrl: e.claimUrl };
          // Surprise card: real session data only (chosen outings' stats,
          // the photos Muse Spark kept, the real book title).
          const stats = sessionStatsRef.current;
          const firstAsk =
            next.find((m) => m.role === "user")?.content ?? "AdvenBook";
          setCelebration({
            bookId: e.bookId || e.title || "book",
            title: e.title ?? (firstAsk.length > 52 ? `${firstAsk.slice(0, 52).trim()}…` : firstAsk),
            outings: e.totalActivities ?? stats.outings,
            km: stats.km,
            elev: stats.elev,
            photos: preparedCelebPhotosRef.current,
            editorUrl: e.editorUrl ?? e.claimUrl,
            orderUrl: e.orderUrl,
          });
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

  // Real session stats for the celebration card: the outings the user
  // actually ticked (or the GPX outings they added) — never invented.
  useEffect(() => {
    if (latestActivities) {
      const chosen = latestActivities.activities.filter(
        (a) => selected[a.strava_activity_id],
      );
      sessionStatsRef.current = {
        outings: chosen.length,
        km: chosen.reduce((n, a) => n + (a.distance_km ?? 0), 0),
        elev: chosen.reduce((n, a) => n + (a.elevation_gain_m ?? 0), 0),
      };
    } else if (manual.length) {
      sessionStatsRef.current = {
        outings: manual.length,
        km: manual.reduce((n, a) => n + (a.distanceKm ?? 0), 0),
        elev: manual.reduce((n, a) => n + (a.elevationGainM ?? 0), 0),
      };
    }
  }, [selected, messages, manual]);

  /** Create directly: the server calls create/add itself with exactly
   *  the ticked outings. The model is not asked, so it cannot re-add
   *  the whole Strava list or re-ask continue-or-new. */
  async function createDirectBook(chosen: Activity[]) {
    if (busy || chosen.length === 0) return;
    const display = t(lang, "directCreateConfirmed").replace(
      "{n}",
      String(chosen.length),
    );
    const base: Msg[] = [...messages, { role: "user", content: display, display }];
    setMessages(base);
    setBusy(true);
    setStatus(t(lang, "creatingBook"));
    try {
      const firstAsk = messages.find((m) => m.role === "user")?.content ?? "AdvenBook";
      const res = await fetch("/api/books/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          bookChoice: bookChoiceRef.current ?? { kind: "new" },
          activities: chosen,
          lang,
          conversationId: conversationInfo().id,
          title: firstAsk.length > 80 ? firstAsk.slice(0, 80).trim() : firstAsk,
          ...(coverUrlRef.current ? { coverPhotoUrl: coverUrlRef.current } : {}),
        }),
      });
      const data = await parseResponse<{
        books?: Extract<UiEvent, { kind: "book" }>[];
        reply?: string;
        error?: string;
      }>(res);
      if (!res.ok || data.error || !data.books?.length) {
        setMessages([
          ...base,
          {
            role: "assistant",
            content: data.error ?? t(lang, "bookCreationFailed"),
          },
        ]);
        return;
      }
      for (const book of data.books) {
        setCelebration({
          bookId: book.bookId || book.title || "book",
          title: book.title ?? (firstAsk.length > 52 ? `${firstAsk.slice(0, 52).trim()}…` : firstAsk),
          outings: chosen.length,
          km: chosen.reduce((n, a) => n + (a.distance_km ?? 0), 0),
          elev: chosen.reduce((n, a) => n + (a.elevation_gain_m ?? 0), 0),
          photos: preparedCelebPhotosRef.current,
          editorUrl: book.editorUrl ?? book.claimUrl,
          orderUrl: book.orderUrl,
        });
      }
      setMessages([
        ...base,
        { role: "assistant", content: data.reply ?? t(lang, "bookReady"), ui: data.books },
      ]);
    } catch {
      setMessages([
        ...base,
        {
          role: "assistant",
          content: t(lang, "bookNetworkError"),
        },
      ]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function confirmSelection(skipInterview: boolean) {
    if (!latestActivities) return;
    // Read the live tick state (ref, not the stale render closure):
    // exactly the ticked outings, in list order.
    const chosen = selectTickedActivities(
      latestActivities.activities,
      Object.keys(selectedRef.current).length ? selectedRef.current : selected,
    );
    if (chosen.length === 0) return;
    // Locked synchronously, before any async turn can lose or widen it.
    confirmedIdsRef.current = chosen.map((a) => a.strava_activity_id);
    setConfirmedIds(confirmedIdsRef.current);
    if (skipInterview) {
      void createDirectBook(chosen);
      return;
    }
    const list = chosen
      .map((a) => `${a.title} (${a.date}, id ${a.strava_activity_id})`)
      .join("; ");
    send(
      `I confirm these outings: ${list}. Ask me your questions, one outing at a time.`,
      t(lang, "selectionConfirmed").replace("{n}", String(chosen.length)),
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
            <h2>{t(lang, "resumeTitle")}</h2>
            <p style={{ margin: "0 0 10px", fontSize: 14 }}>
              {t(lang, "resumeCardBody")}
            </p>
            <div className="row" style={{ marginTop: 0 }}>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void fetchActivities(t(lang, "stravaDone"))}
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
                    onConnected={() => void fetchActivities(t(lang, "stravaDone"))}
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
                    onToggleActivity={(a, checked) => {
                      selectedRef.current = { ...selectedRef.current, [a.strava_activity_id]: checked };
                      setSelected(selectedRef.current);
                    }}
                    onConfirm={(skip) => confirmSelection(skip)}
                  />
                );
              }
              if (e.kind === "mybooks") {
                // Asked at most once: once a choice is stored this card
                // never renders again, however many turns pass.
                if (bookChoice) return null;
                return (
                  <MyBooksCard
                    key={j}
                    e={e}
                    lang={lang}
                    busy={busy}
                    chosenBookId=""
                    onContinue={(book) => {
                      setBookChoice({ kind: "continue", bookId: book.book_id });
                      const display = t(lang, "continuingBookDisplay").replace("{title}", book.title);
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "user",
                          content: `Je continue mon livre existant « ${book.title} » (book_id ${book.book_id}) : ajoute les sorties confirmées à CE livre avec add_to_adventure_book, sans rien retirer ni écraser ses textes.`,
                          display,
                        },
                        {
                          role: "assistant",
                          content: t(lang, "continueBookReply"),
                        },
                      ]);
                    }}
                    onNewBook={() => {
                      setBookChoice({ kind: "new" });
                      const display = t(lang, "newBookDisplay");
                      setMessages((prev) => [
                        ...prev,
                        { role: "user", content: display, display },
                        {
                          role: "assistant",
                          content: t(lang, "newBookReply"),
                        },
                      ]);
                    }}
                  />
                );
              }
              if (e.kind === "komoot") {
                return (
                  <KomootCard
                    key={j}
                    e={e}
                    lang={lang}
                    busy={busy}
                    onImport={(ids) => void importKomootTours(ids, e.shareToken)}
                  />
                );
              }
              if (e.kind === "cover") {
                return (
                  <CoverCard
                    key={j}
                    e={e}
                    lang={lang}
                    pickedUrl={coverUrl}
                    onPick={(photo) => {
                      coverUrlRef.current = photo.url;
                      setCoverUrl(photo.url);
                      void send(
                        `Je choisis cette photo pour la couverture du livre : ${photo.url} (à passer comme cover_photo_url à la création).`,
                        t(lang, "coverChosenDisplay"),
                      );
                    }}
                  />
                );
              }
              const bookEvent = e as Extract<UiEvent, { kind: "book" }>;
              return (
                <div key={j} style={{ display: "contents" }}>
                  {celebration && celebration.bookId === (bookEvent.bookId || celebration.bookId) && (
                    <CelebrationCard
                      data={celebration}
                      lang={lang}
                      onClose={() => setCelebration(null)}
                    />
                  )}
                  <BookCard
                    e={bookEvent}
                    lang={lang}
                    copiedBook={copiedBook}
                    onCopied={setCopiedBook}
                    conversationId={conversationInfo().id}
                  />
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
        onFolderFiles={(f) => void onFolderFiles(f)}
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
          aria-label={t(lang, "yourMessage")}
          disabled={busy}
        />
        <button
          className="btn secondary"
          type="button"
          disabled={busy || transcribing}
          onClick={() => void toggleMic()}
          aria-label={recording ? t(lang, "micStop") : t(lang, "micStart")}
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
          {t(lang, "transparencyLink")}
        </a>
      </div>
    </div>
  );
}
