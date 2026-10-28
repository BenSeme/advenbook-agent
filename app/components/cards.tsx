"use client";

import { useState, type MouseEvent } from "react";
import { activityBadges, isHighlight, isLikelyWarmup } from "@/lib/highlights";
import { fmtDistance, fmtElevation, fmtPrice, t, type Lang } from "@/lib/i18n";
import type { Activity, MyBook, UiEvent } from "@/lib/chat-types";

type ConnectEvent = Extract<UiEvent, { kind: "connect" }>;
type ActivitiesEvent = Extract<UiEvent, { kind: "activities" }>;
type BookEvent = Extract<UiEvent, { kind: "book" }>;
type CoverEvent = Extract<UiEvent, { kind: "cover" }>;
type MyBooksEvent = Extract<UiEvent, { kind: "mybooks" }>;

export function MyBooksCard({
  e,
  lang,
  busy,
  chosenBookId,
  onContinue,
  onNewBook,
}: {
  e: MyBooksEvent;
  lang: Lang;
  busy: boolean;
  chosenBookId: string;
  onContinue: (book: MyBook) => void;
  onNewBook: () => void;
}) {
  const firstDraft = e.books.find((b) => b.status === "draft");
  return (
    <div className="card">
      {firstDraft && (
        <h2>
          {t(lang, "foundBook")
            .replace("{title}", firstDraft.title)
            .replace("{n}", String(firstDraft.activities))}
        </h2>
      )}
      {e.books.map((b) => (
        <div key={b.book_id} style={{ padding: "8px 0", borderTop: "1px solid var(--brand-line)" }}>
          <p style={{ margin: "0 0 6px", fontSize: 14 }}>
            <strong>{b.title}</strong> · {b.activities} {t(lang, "outingsWord")}
            {b.status === "ordered" ? ` · ${t(lang, "orderedBadge")}` : ""}
            {chosenBookId === b.book_id ? " ✓" : ""}
          </p>
          {b.status === "ordered" ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--brand-muted)" }}>{t(lang, "orderedNote")}</p>
          ) : (
            <button className="btn" disabled={busy} onClick={() => onContinue(b)}>
              {t(lang, "continueBookBtn")}
            </button>
          )}
        </div>
      ))}
      <div className="row">
        <button className="btn secondary" disabled={busy} onClick={onNewBook}>
          {t(lang, "newBookBtn")}
        </button>
      </div>
    </div>
  );
}

export function CoverCard({
  e,
  lang,
  pickedUrl,
  onPick,
}: {
  e: CoverEvent;
  lang: Lang;
  pickedUrl: string;
  onPick: (photo: { id: string; thumb: string; url: string }) => void;
}) {
  return (
    <div className="card book">
      <h2>{t(lang, "coverTitle")}</h2>
      <div className="cover-grid">
        {e.photos.map((p) => {
          const picked = pickedUrl === p.url;
          return (
            <button
              key={p.id}
              type="button"
              className={picked ? "cover-item picked" : "cover-item"}
              onClick={() => onPick(p)}
              aria-label={t(lang, "coverPick")}
              aria-pressed={picked}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" />
              <span className="cover-shade" aria-hidden />
              <span className="cover-brand">AdvenBook</span>
              <span className="cover-book-title">{e.title}</span>
              {picked && <span className="cover-chosen">✓ {t(lang, "coverChosen")}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    void navigator.clipboard?.writeText(e.connectUrl).catch(() => undefined);
    setCopied(true);
  };
  // Force a NEW tab/page for the Strava authorisation: the agent page
  // must stay open underneath. Some embedded browsers ignore
  // target="_blank" and replace the current page — window.open with
  // noopener either opens the new page, or returns null, and then we
  // fall back to copying the link with clear instructions.
  const openConnect = (ev: MouseEvent) => {
    ev.preventDefault();
    const w = window.open(e.connectUrl, "_blank", "noopener,noreferrer");
    if (!w) copyLink();
  };
  return (
    <div className="card">
      <h2>{t(lang, "connectTitle")}</h2>
      <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
        <li>{t(lang, "connectStep1").replace("{connect}", t(lang, "connectBtn"))}</li>
        <li>{t(lang, "connectStep2")}</li>
        <li>{t(lang, "connectStep3").replace("{connected}", t(lang, "connectedBtn"))}</li>
      </ol>
      <div className="row" style={{ marginTop: 0 }}>
        <a
          className="btn"
          href={e.connectUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openConnect}
        >
          {t(lang, "connectBtn")}
        </a>
        <button className="btn secondary" disabled={busy} onClick={onConnected}>
          {t(lang, "connectedBtn")}
        </button>
        <button className="btn secondary" onClick={copyLink}>
          {copied ? t(lang, "linkCopied") : t(lang, "copyConnectLink")}
        </button>
      </div>
      {copied && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--brand-ink)" }}>
          {t(lang, "connectCopiedNote")}
        </p>
      )}
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
