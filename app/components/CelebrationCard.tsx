"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDistance, fmtElevation, t, type Lang } from "@/lib/i18n";

export type CelebData = {
  bookId: string;
  title: string;
  outings: number;
  km: number;
  elev: number;
  photos: { thumb: string; reason?: string }[];
  editorUrl: string;
  orderUrl?: string;
};

/**
 * ~10s in-browser celebration after a book is created or continued.
 * Real conversation data only: session stats, the photos Muse Spark
 * kept, the real book title. No film, no gift — just a moment.
 * Skippable in one tap; reduced-motion users get the final state at once.
 */
export function CelebrationCard({
  data,
  lang,
  onClose,
}: {
  data: CelebData;
  lang: Lang;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState(0); // 0 stats, 1 photos, 2 title+buttons
  const [photoIdx, setPhotoIdx] = useState(0);
  const [display, setDisplay] = useState({ outings: 0, km: 0, elev: 0 });
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedRef.current) {
      setDisplay({ outings: data.outings, km: data.km, elev: data.elev });
      setPhase(2);
      return;
    }
    const start = performance.now();
    const DURATION = 2600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay({
        outings: Math.round(data.outings * eased),
        km: data.km * eased,
        elev: Math.round(data.elev * eased),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (data.photos.length > 0) {
      timers.push(setTimeout(() => setPhase(1), 2900));
      data.photos.forEach((_, i) => {
        if (i > 0) timers.push(setTimeout(() => setPhotoIdx(i), 2900 + i * 1900));
      });
      timers.push(setTimeout(() => setPhase(2), 2900 + data.photos.length * 1900));
    } else {
      timers.push(setTimeout(() => setPhase(2), 3000));
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [data]);

  const photo = data.photos[Math.min(photoIdx, Math.max(0, data.photos.length - 1))];

  return (
    <div className="card celebration" role="status">
      <button
        type="button"
        className="cele-skip"
        onClick={() => (phase < 2 ? setPhase(2) : onClose())}
        aria-label={phase < 2 ? t(lang, "celebSkip") : t(lang, "celebClose")}
      >
        {phase < 2 ? `${t(lang, "celebSkip")} →` : "×"}
      </button>

      {phase === 0 && (
        <div className="cele-stats" aria-hidden={false}>
          <div className="cele-stat">
            <span className="cele-num">{display.outings}</span>
            <span className="cele-label">{t(lang, "outingsWord")}</span>
          </div>
          <div className="cele-stat">
            <span className="cele-num">{fmtDistance(Math.round(display.km * 10) / 10, lang) || "0"}</span>
            <span className="cele-label">{t(lang, "distanceLabel")}</span>
          </div>
          <div className="cele-stat">
            <span className="cele-num">{fmtElevation(display.elev, lang) || "0"}</span>
            <span className="cele-label">{t(lang, "elevationLabel")}</span>
          </div>
        </div>
      )}

      {phase === 1 && photo && (
        <figure className="cele-photo" key={photoIdx}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumb} alt="" />
          {photo.reason && <figcaption>{photo.reason}</figcaption>}
        </figure>
      )}

      {phase === 2 && (
        <div className="cele-final">
          <p className="cele-kicker">{t(lang, "bookReady")}</p>
          <h2 className="cele-title">{data.title}</h2>
          <p className="cele-sub">
            {data.outings} {t(lang, "outingsWord")} · {fmtDistance(data.km, lang)}
            {data.elev > 0 ? ` · ${fmtElevation(data.elev, lang)}` : ""}
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <a className="btn cta" href={data.editorUrl} target="_blank" rel="noopener noreferrer">
              {t(lang, "openBook")}
            </a>
            {data.orderUrl && (
              <a className="btn" href={data.orderUrl} target="_blank" rel="noopener noreferrer">
                {t(lang, "orderBook")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
