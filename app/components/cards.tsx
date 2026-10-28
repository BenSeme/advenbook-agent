"use client";

import type { MouseEvent } from "react";
import { activityBadges, isHighlight, isLikelyWarmup } from "@/lib/highlights";
import { fmtDistance, fmtElevation, fmtPrice, t, type Lang } from "@/lib/i18n";
import type { Activity, UiEvent } from "@/lib/chat-types";

type ConnectEvent = Extract<UiEvent, { kind: "connect" }>;
type ActivitiesEvent = Extract<UiEvent, { kind: "activities" }>;
type BookEvent = Extract<UiEvent, { kind: "book" }>;

export function ConnectCard({
  e,
  lang,
  busy,
  onConnected,
}: {
  e: ConnectEvent;
  lang: Lang;
  busy: boolean;
  onConnected: () => void;
}) {
  return (
    <div className="card">
      <h2>{t(lang, "connectTitle")}</h2>
      <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
        <li>{t(lang, "connectStep1").replace("{connect}", t(lang, "connectBtn"))}</li>
        <li>{t(lang, "connectStep2")}</li>
        <li>{t(lang, "connectStep3").replace("{connected}", t(lang, "connectedBtn"))}</li>
      </ol>
      <div className="row" style={{ marginTop: 0 }}>
        <a className="btn" href={e.connectUrl} target="_blank" rel="noreferrer">
          {t(lang, "connectBtn")}
        </a>
        <button className="btn secondary" disabled={busy} onClick={onConnected}>
          {t(lang, "connectedBtn")}
        </button>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "#5a6b52" }}>
        {t(lang, "connectNote")}
      </p>
    </div>
  );
}

export function ActivitiesCard({
  e,
  lang,
  busy,
  listOpen,
  onToggleList,
  selected,
  onToggleActivity,
  onConfirm,
}: {
  e: ActivitiesEvent;
  lang: Lang;
  busy: boolean;
  listOpen: boolean;
  onToggleList: () => void;
  selected: Record<string, boolean>;
  onToggleActivity: (a: Activity, checked: boolean) => void;
  onConfirm: (skipInterview: boolean) => void;
}) {
  const chosenCount = e.activities.filter((a) => selected[a.strava_activity_id]).length;
  const highlights = e.activities.filter(isHighlight);
  return (
    <div className="card">
      <h2>{t(lang, "outingsTitle")}</h2>
      <p style={{ margin: "0 0 6px", fontSize: 14 }}>
        <strong>{chosenCount} {t(lang, "ticked")}</strong> {t(lang, "on")} {e.activities.length}
        {highlights.length > 0 ? ` · ${highlights.length} ${t(lang, "toHighlight")}` : ""}
        . Course de chaque jour cochée, échauffements décochés — vous pouvez tout valider tel quel, sans ouvrir la liste.
      </p>
      {highlights.length > 0 && (
        <p style={{ margin: "0 0 6px", fontSize: 13 }}>
          {highlights.slice(0, 3).map((a) => a.title).join(" · ")}
          {highlights.length > 3 ? "…" : ""}
        </p>
      )}
      <button className="btn secondary" onClick={onToggleList} aria-expanded={listOpen}>
        {listOpen ? t(lang, "hideList") : `${t(lang, "showList")} (${e.activities.length})`}
      </button>
      {listOpen &&
        e.activities.map((a) => (
          <label className={isHighlight(a) ? "check highlight" : "check"} key={a.strava_activity_id}>
            <input
              type="checkbox"
              checked={!!selected[a.strava_activity_id]}
              onChange={(ev) => onToggleActivity(a, ev.target.checked)}
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
                {isLikelyWarmup(a, e.activities) ? " · échauffement probable — décoché par défaut" : ""}
              </small>
            </span>
          </label>
        ))}
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => onConfirm(false)}>
          {t(lang, "continueSelected")}
        </button>
        <button className="btn secondary" disabled={busy} onClick={() => onConfirm(true)}>
          {t(lang, "skipCreate")}
        </button>
      </div>
    </div>
  );
}

export function BookCard({
  e,
  lang,
  copiedBook,
  onCopied,
}: {
  e: BookEvent;
  lang: Lang;
  copiedBook: string;
  onCopied: (id: string) => void;
}) {
  const url = e.editorUrl ?? e.claimUrl;
  const copy = () => {
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    onCopied(e.bookId || "1");
  };
  const openExternal = (target: string) => (ev: MouseEvent) => {
    ev.preventDefault();
    // Funnel counting only (no book id, no URL sent).
    void fetch("/api/metrics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: target === url ? "open_click" : "order_click",
      }),
      keepalive: true,
    }).catch(() => undefined);
    const w = window.open(target, "_blank", "noopener,noreferrer");
    if (!w) {
      void navigator.clipboard?.writeText(target).catch(() => undefined);
      if (target === url) onCopied(e.bookId || "1");
    }
  };
  return (
    <div className="card book">
      <h2>{t(lang, "bookReady")}</h2>
      <p className="price">
        {e.estimatedPages ? `~${e.estimatedPages} ${t(lang, "aboutPages")}. ` : ""}
        {fmtPrice(e.price, lang) ? `${t(lang, "estPrice")} : ${fmtPrice(e.price, lang)}. ` : ""}
        {t(lang, "draftNote")}
      </p>
      <div className="row" style={{ marginTop: 0 }}>
        <a
          className="btn cta"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openExternal(url)}
        >
          {t(lang, "openBook")}
        </a>
        {e.orderUrl && (
          <a
            className="btn"
            href={e.orderUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openExternal(e.orderUrl)}
          >
            {t(lang, "orderBook")}
          </a>
        )}
        <button className="btn secondary" onClick={copy}>
          {copiedBook === (e.bookId || "1")
            ? lang === "en" ? "Link copied" : "Lien copié"
            : lang === "en" ? "Copy the book link" : "Copier le lien du livre"}
        </button>
      </div>
      {e.orderUrl && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--brand-ink)" }}>
          {t(lang, "orderNote")}
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--brand-muted)" }}>
        {lang === "en"
          ? "If this preview replaces the agent page (embedded browser), copy the link and open it in Chrome or Safari — nothing is lost, the book is saved."
          : "Si cet aperçu remplace la page de l’agent (navigateur intégré), copiez le lien et ouvrez-le dans Chrome ou Safari — rien n’est perdu, le livre est enregistré."}
      </p>
    </div>
  );
}
