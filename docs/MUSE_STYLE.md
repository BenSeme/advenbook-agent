Second small task (do it after the import task is finished). Do not touch the import work.

1. CHANGE THE BOOK AFTER CREATION. The AdvenBook MCP server now has a tool `update_adventure_book`
   (it is listed by the MCP client at runtime, nothing to add in lib/mcp.ts). In the system prompt of
   lib/agent.ts:
   - Remove the sentence "Book colour is still set in the editor after creation: recommend it in one line
     if asked, never pretend you transmitted it."
   - Add: "After the book is created, if the user asks to change its look, title or format (darker,
     cream paper, other fonts, square photos, another cover layout, softcover, a new title...), call
     update_adventure_book with the claimUrl returned by create_adventure_book (or with
     strava_connection_id + book_id for a Strava book), passing ONLY what they asked to change. Then say in
     one line what changed and that they will see it when they open or refresh their book. Never say a
     change was made if the tool returned an error."
   - Add a tool status label for update_adventure_book in the same map as the others
     (e.g. "Updating your book…").

2. "OPEN MY BOOK" WITHOUT AN ACCOUNT. Today the book card always opens editorUrl
   (/my-book/creer?bookId=…), derived from claimUrl in lib/book-link.ts. For a visitor who did NOT
   connect Strava there is no AdvenBook account, and that editor page shows the site's demo book instead
   of theirs. Fix: when the book was created WITHOUT a strava_connection_id, the "Open my book" button must
   open the claimUrl (/my-book/preview?bookId=…&claim=…) unchanged; keep editorUrl only for books created
   or continued with a Strava connection. Keep the rule that raw AdvenBook URLs are never pasted in the
   agent's text (buttons only). Add a test in test/book-link.test.mjs or test/book-choice.test.mjs.

3. STRAVA STORIES. In the system prompt, add: "With a Strava connection, AdvenBook copies what the athlete
   wrote under each activity on Strava as its story when you leave the story empty. So before the
   interview, ask once: 'Did you write about some of these outings on Strava?' If yes, only ask about the
   outings they did not describe, and leave the story empty for the others."

Run npm test and npm run build, report the results and the changed files. Do not commit, do not push.
