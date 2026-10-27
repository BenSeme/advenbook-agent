// The MCP claimUrl opens /my-book/preview, but the founder's real book
// preview/editor is /my-book/creer. Derive the editor link from the claim
// link: same origin + language, bookId only (the claim token is not an
// editor parameter; the book is saved in the user's AdvenBook account).

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
