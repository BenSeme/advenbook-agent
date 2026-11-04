# Brief pour Muse — mercredi 4/11 (dernier jour des crédits)

*Pour Benoit : ouvre Muse Code dans ce dossier (`C:\Users\semer\advenbook-agent`) et colle le bloc
ci-dessous tel quel. Ça ne touche qu'au texte des consignes de l'agent (`lib/agent.ts`) : petit
changement, peu de crédits. Quand Muse a fini, dis à Claude « relis ce que Muse a fait » avant de pousser.*

---

```
Small, prompt-only update in lib/agent.ts (system prompt). Do not change any other logic, UI or API route.
The AdvenBook site changed its offer since 28/10; the agent must now say these TRUE facts, briefly,
in the user's language, only at the right moment. Never invent anything beyond this list.

1. Right after the book is created (step 5, where you give the estimated price), add ONE short line:
   "Free delivery to your door in 15 to 20 days. Proud or refunded for 30 days, and you keep the book."
   (French: "Livraison offerte chez toi en 15 à 20 jours. Fier ou remboursé pendant 30 jours, et tu gardes le livre.")
   If the user mentions Christmas or a gift: "For Christmas, order before November 30."

2. When the user asks what is included, or hesitates about the price, say once (one line):
   every ordered book also comes with "Your season in 15 seconds" (a short video of their routes,
   numbers and best photos, emailed within an hour of the order) and the HD PDF of the book.
   For orders before November 30, a printable gift certificate to give on the 25th.

3. If the user says they have no time, don't want to do it themselves, or wants someone to do it:
   mention "Your Season, Done For You" in one line: the founder makes the book from their outings,
   photos and 3 memories, hardcover up to 400 pages, free delivery, they approve the preview before
   anything is printed ("You say yes, we print"). Price: EUR 199 until 14 November 2026, EUR 299 from
   15 November 2026. Limited to 5 books a month. It is ordered on www.advenbook.com (home page,
   "Your Season, Done For You" card). Do not create a special link for it; never push it if the user
   is happy doing it themselves.

4. In step 4b, replace the sentence "Book colour is still set in the editor after creation: recommend it
   in one line if asked, never pretend you transmitted it." with:
   "The template you pick also sets the book's colours (see the template descriptions of the tool);
   the user can change the look in one click on the book page."

5. Never say a person checks each book by hand. The true wording, only if asked about quality:
   "Every file goes through a print check (pages, images, cover) before it goes to the printer."

Keep every existing rule (no payment details in chat, never say ordered/paid, EUR for European users).
Run the existing tests (npm test) and tell me the result. Do not push.
```

---

## Brief 2 : « Essayer avec une saison d'exemple » (le plus utile pour le jury)

*Les juges n'ont pas forcément de compte Strava rempli, ni de fichiers GPX sous la main. Sans ce
bouton, beaucoup verront juste « connectez Strava » et partiront. Claude prépare les fichiers
d'exemple dans `public/demo/` (tes propres sorties, photos sans visage) avant que tu colles ce bloc.*

```
Add a "Try it with a sample season" path for visitors (and hackathon judges) who have no Strava account.

- On the welcome screen, under the input, add one discreet button: "No Strava? Try a sample season"
  (FR: "Pas de Strava ? Essayez une saison d'exemple"; use lib/i18n.ts for all 6 languages).
- Clicking it loads the files already present in public/demo/ (GPX files + JPG photos) exactly as if
  the user had dropped them: reuse the existing GPX drop and photo drop code paths (lib/gpx.ts,
  FilesPanel), do not write a second pipeline. Then send the agent one user message:
  "Make a book of this trail season. Full-page photos and full-page maps please."
  (in the UI language).
- Everything after that is the normal flow (shortlist, questions, photos with Spark vision + SAM,
  cover choice, create_adventure_book with data_source "gpx_files"). No Strava call in this path.
- Keep all existing safeguards and budgets. Add a test if a pure function is added.
Run npm test and npm run build, tell me the results. Do not push.
```

---

*Traduction (pour toi) : on ajoute dans les consignes de l'agent 1) livraison offerte 15–20 jours +
garantie « Fier ou remboursé, et tu gardes le livre » + Noël avant le 30/11, 2) les bonus (vidéo 15 s,
PDF HD, certificat avant le 30/11), 3) « Ta Saison Clé en Main » seulement si la personne n'a pas le
temps (199 € jusqu'au 14/11, 299 € dès le 15/11, 5 par mois, commande sur le site), 4) la phrase
fausse sur la couleur du livre (le modèle choisi règle maintenant aussi les couleurs), 5) jamais
« chaque livre vérifié à la main » : « contrôle d'impression » à la place.*
