# Brief pour Muse — photos et textes en anglais (4/11)

*Pour Benoit : dans un terminal, `cd C:\Users\semer\advenbook-agent` puis `muse resume --last`,
et colle seulement : « Lis docs/BRIEF_MUSE_PHOTOS_4_11.md et exécute. »
Quand Muse a fini, dis à Claude « relis ce que Muse a fait » : Claude vérifie et pousse.*

---

Fix these 4 problems seen live on agent.advenbook.com (English visitor). Small, focused changes only.

## 1. "Photo preparation failed (Unexpected token 'R', "Request En"... is not valid JSON)"

Cause: Vercel refuses request bodies over ~4.5 MB ("Request Entity Too Large", plain text, not JSON).
`/api/photos/process` receives `fullDataUrl(file)` = the full-resolution phone photo in base64
(+33 %), and `/api/photos/select` receives all photos of one outing in a single request.

- RULE: every photo the user drops MUST end up in the book, whatever its size. Never refuse or skip
  a photo because it is big.
- Before `/api/photos/process`: resize in the browser (canvas) to max 3000 px on the long side, JPEG,
  quality 0.9; if the data URL is still over 3 MB, lower quality step by step (0.82, 0.75, 0.68…) and,
  only if needed, the size (2600, 2200 px) until it fits. 3000 px stays sharp on a full A4 page.
  This always succeeds, so no photo is ever lost.
- `/api/photos/select`: send the images in batches so each request body stays under 3 MB
  (thumbnails are already 900 px; batch by cumulative size).
- Every `fetch` in app/page.tsx that does `res.json()`: read `res.text()` first, try `JSON.parse`,
  and if it fails retry that photo once smaller; never show a raw parser error to the user.
- A network failure on one photo must not stop the others: retry it once, keep going, and only if it
  still fails say in one line, in the user's language, which photo to drop again.
- The error message was shown twice: show it once per run.

## 2. Everything in the visitor's language (6 languages via lib/i18n.ts)

Hard-coded French is still shown to English visitors. Move every user-visible string to
lib/i18n.ts (fr, en, es, de, it, eu), at least:
- app/components/FilesPanel.tsx: "gardée(s)", "Détail / ranger", "Masquer le détail",
  "Tout retirer" (the `lang === "en"` ternaries too), "date inconnue", " · gardée", " · écartée",
  "Sortie de cette photo", "Photo libre — l'agent la place tout seul", the "Trouvé … sortie(s)" line.
- app/page.tsx: photo statuses ("prête", "Échec envoi", "Recadrage et envoi…", "Analyse impossible"),
  "Photos libres", "Sortie", the Komoot messages and "Lecture de Komoot…", the file-read error message.
- Rename the "Détail / ranger" button so its purpose is obvious:
  en "See and sort photos" / fr "Voir et trier les photos" / es "Ver y ordenar las fotos" /
  de "Fotos ansehen und ordnen" / it "Vedi e ordina le foto" / eu "Ikusi eta ordenatu argazkiak".
  Its hide state: en "Hide photos" / fr "Masquer les photos" (and the 4 others).
- Then grep app/ and lib/ for remaining French words shown on screen (é, è, à, « ») and fix them.
  Messages sent to the model (prompts) can stay as they are.

## 3. "Use this photo to do a special page" → the agent says it sees no photo

The photos were already in the drop zone but not yet processed. Pass to the agent, in the known
state, how many photos are waiting in the drop zone. When photos are waiting, the agent must answer
in one line: tap "Use these photos in the book" below, and it will place them (a strong photo can
get its own full page). Never say "I don't see any photo" when some are waiting.

## 4. Checks

Add tests for the batching/size logic (pure functions) and for the i18n keys (all 6 languages present).
Run `npm test`, `npx tsc --noEmit` and `npm run build`. Tell me the results and the list of changed
files in 5 lines max. Do not commit, do not push.
