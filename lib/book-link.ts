// The MCP claimUrl opens /my-book/preview, but the founder's real book
// preview/editor is /my-book/creer. Derive the editor link from the claim
// link: same origin + language, bookId only (the claim token is not an
// editor parameter; the book is saved in the user's AdvenBook account).

/** Replace any /my-book/preview claim URL in text with the creer editor URL. */
export function rewritePreviewLinks(text: string): string {
  return text.replace(
    /https?:\/\/[^\s)"']*\/my-book\/preview\?[^\s)"']*/g,
    (match) => editorUrlFromClaim(match) ?? match,
  );
}

/**
 * Remove raw AdvenBook connect/preview URLs from agent text. The buttons
 * carry those links; a bare URL invites copy-paste into the address bar,
 * which replaces the agent page and lands on /preview.
 */
export function stripAdvenBookUrls(text: string): string {
  return text
    // Markdown links to AdvenBook first: unwrap to their plain label so
    // no "[Connecter mon Strava]()" empty link is left behind. Buttons
    // carry the real links; text must never contain one.
    .replace(
      /\[([^\]]*)\]\(\s*https?:\/\/[^\s)]*advenbook\.com[^\s)]*\)/gi,
      "$1",
    )
    .replace(/\[([^\]]*)\]\(\s*\)/g, "$1")
    .replace(/https?:\/\/[^\s)"']*\/strava\/ai-connect\?[^\s)"']*/g, "")
    .replace(/https?:\/\/[^\s)"']*\/my-book\/(preview|creer)\?[^\s)"']*/g, "")
    .replace(/https?:\/\/[^\s)"']*advenbook\.com\/[^\s)"']*(order|checkout|payment|paiement|commande)[^\s)"']*/gi, "")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The editor URL only when the book belongs to a Strava-connected
 * account. Without a Strava connection there is no AdvenBook account and
 * the editor page would show the site's demo book instead of the
 * visitor's, so no editor URL is derived: the claim link is their book.
 */
export function editorUrlForBook(
  claimUrl: string,
  hasStravaConnection: boolean,
): string | undefined {
  return hasStravaConnection ? editorUrlFromClaim(claimUrl) ?? undefined : undefined;
}

/** The URL the "Open my book" button must open for this book. */
export function openBookUrl(claimUrl: string, hasStravaConnection: boolean): string {
  return editorUrlForBook(claimUrl, hasStravaConnection) ?? claimUrl;
}

export function editorUrlFromClaim(claimUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(claimUrl);
  } catch {
    return null;
  }
  const match = url.pathname.match(/^\/([a-z]{2})\/my-book\/preview$/);
  if (!match) return null;
  const bookId = url.searchParams.get("bookId");
  if (!bookId) return null;
  return `${url.origin}/${match[1]}/my-book/creer?bookId=${encodeURIComponent(bookId)}`;
}
