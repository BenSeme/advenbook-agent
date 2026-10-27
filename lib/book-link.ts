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
    .replace(/https?:\/\/[^\s)"']*\/strava\/ai-connect\?[^\s)"']*/g, "")
    .replace(/https?:\/\/[^\s)"']*\/my-book\/(preview|creer)\?[^\s)"']*/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
