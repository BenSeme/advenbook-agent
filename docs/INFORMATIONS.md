# AdvenBook Agent — informations de passation

Tout ce qu'un développeur (ou une IA) doit savoir pour travailler sur cet agent
sans redécouvrir ce qui a été appris, souvent à la dure. À jour au 2026-10-27.
Le brief produit original est dans [AGENTS.md](../AGENTS.md) ; le guide de
marque officiel dans [brand/BRAND.md](../brand/BRAND.md).

## 1. Ce que c'est

Une page web de chat. Un sportif décrit le livre qu'il veut (écrit ou dicté,
dans sa langue), l'agent choisit ses sorties Strava (ou ses fichiers GPX et
photos), lui pose quelques questions, puis crée un **brouillon de livre**
AdvenBook via le serveur MCP public. L'agent ne prend jamais de carte ni
d'adresse : la carte livre affiche un bouton « Commander mon livre »
(`orderUrl` renvoyé par le MCP) qui crée le compte en un clic puis ouvre la
page de paiement Stripe sécurisée sur advenbook.com.

Stack : Next.js 15 (App Router, TypeScript strict), React 19, zéro base de
données. État côté navigateur : conversation en mémoire, identifiant de
connexion Strava en `localStorage` (clé `ab-connection-id`).

## 2. Architecture et fichiers

| Fichier | Rôle |
|---|---|
| [app/page.tsx](../app/page.tsx) | UI complète : chat, cartes (connexion Strava, sorties, livre), voix, zone GPX/photos, i18n |
| [app/api/chat/route.ts](../app/api/chat/route.ts) | Entrée conversation : budget, rate limit, historique borné → agent |
| [lib/agent.ts](../lib/agent.ts) | Boucle Muse Spark + outils MCP ; garde-fous mécaniques à la création |
| [lib/models.ts](../lib/models.ts) | TOUS les appels modèles Meta (chat, vision, voix, SAM) — seul point d'accès |
| [lib/mcp.ts](../lib/mcp.ts) | Client MCP officiel (`@modelcontextprotocol/sdk`), outils récupérés en direct, cache 10 min |
| [lib/selection.ts](../lib/selection.ts) | Filtre « sélection confirmée » (cf. §5) |
| [lib/highlights.ts](../lib/highlights.ts) | Détection des belles sorties (photos, course, beau tracé, dénivelé) |
| [lib/gpx.ts](../lib/gpx.ts) | Parseur GPX navigateur/serveur : distance, dénivelé, polyline encodée |
| [lib/crop.ts](../lib/crop.ts) | Géométrie de recadrage 3:2 contenant le sujet SAM |
| [lib/i18n.ts](../lib/i18n.ts) | 6 langues d'interface, unités/monnaies, détection langue et appareil |
| [lib/budget.ts](../lib/budget.ts) · [lib/rate-limit.ts](../lib/rate-limit.ts) · [lib/visitor.ts](../lib/visitor.ts) · [lib/turnstile.ts](../lib/turnstile.ts) | Plafond quotidien global + par visiteur (cookie signé) ; limites visiteur + IP ; contrôle humain seulement en cas d'abus |
| [app/api/photos/](../app/api/photos/) | `select` (vision) et `process` (SAM + sharp + Vercel Blob) |
| [app/api/transcribe/route.ts](../app/api/transcribe/route.ts) | Dictée vocale → Muse Voice Transcribe |
| [app/api/strava/activities/route.ts](../app/api/strava/activities/route.ts) | Lecture Strava déterministe après connexion (sans LLM) |
| [lib/tracking.ts](../lib/tracking.ts) | Suivi réel par conversation (consigne 28/10) : id anonyme `c_…`, coûts par appel modèle, étapes, résumé journalier dans `GET /api/metrics` |

Tests : `npm test` (node:test, fichiers dans [test/](../test/)). Build :
`npm run build`. Serveur : `npm run start -- -p 3100` en local.

## 3. Faits vérifiés sur le MCP AdvenBook (relu en direct, 2026-10-27)

Serveur : `https://www.advenbook.com/api/mcp`, public, sans clé, POST seul,
limites ~60 appels/h et 10 livres/h par IP. Ne jamais coder les définitions
d'outils en dur : `tools/list` à l'exécution, descriptions = règles d'usage.

Outils : `connect_strava`, `list_strava_activities`,
`create_adventure_book`, `get_book_price`.

Champs création qui comptent (`create_adventure_book`, schéma relu en entier) :
- `activities` : **minItems 1, maxItems 150 par appel** (revérifié en
  direct le 2026-10-27 ; AdvenBook l'a relevé de 50 à 150) — c'est une
  reliure par **volume**, pas une limite produit chez nous. La sélection
  par défaut garde **toutes** les sorties confirmées (hors échauffements) :
  il n'existe aucune règle « garder les 50 plus fortes ». Au-delà du
  maximum lu dans le schéma de l'outil (`activities.maxItems`, lu en
  direct — ne jamais coder le nombre en dur), l'agent découpe en volumes
  chronologiques (« <titre> — Volume 1 », …) et crée chaque volume. Ne
  jamais supprimer des sorties confirmées pour « rentrer » dans un chiffre.
- `gps_polyline` : « sans lui, la page n'a pas de carte ». La doc de l'outil
  conseille `include_polyline: true` sur la liste, mais
  `list_strava_activities` n'a **pas** ce paramètre (incohérence côté
  AdvenBook, à corriger là-bas ; en attendant, l'agent recopie toute
  polyline présente dans la réponse de liste).
- `strava_activity_id` + `strava_connection_id` : c'est ce qui permet à
  AdvenBook d'ajouter cartes et photos Strava lui-même. Les assistants ne
  peuvent pas passer les photos Strava.
- `data_source` enum : `strava_connector`, `gpx_files`, `typed_list`,
  `manual_entry`, `strava_export_photos` + variantes. Langues de livre :
  `en, fr, es, de, it, eu` (pas de chinois possible tant que l'enum ne bouge pas).
- `claimUrl` pointe sur `/<lang>/my-book/preview?bookId=…&claim=…`. La vraie
  page d'aperçu/édition du fondateur est `/<lang>/my-book/creer?bookId=…`.
  L'agent dérive la seconde de la première ([lib/book-link.ts](../lib/book-link.ts))
  et réécrit/supprime tout lien preview brut dans les textes (un lien copié
  dans la barre d'adresse écrase la page de l'agent — source réelle de bugs
  signalés par le fondateur).
- `orderUrl` (renvoyé par `create_adventure_book`) : la carte livre affiche
  « Commander mon livre » à côté de « Ouvrir mon livre ». Compte créé en un
  clic, puis page de paiement Stripe sécurisée sur advenbook.com. L'outil
  lui-même ne commande ni ne facture rien. Jamais de carte/adresse dans le
  chat. Un lien orderUrl brut dans les textes est supprimé comme les autres
  liens AdvenBook ([lib/book-link.ts](../lib/book-link.ts)).
- **Aucun paramètre** couleur de couverture, typographie, forme d'image
  (carrée/arrondie), ni mise en page dans le schéma.
  Si AdvenBook ajoute `cover_color`, `typography`, `photo_shape`,
  `photo_layout`, l'agent peut les
  brancher en quelques lignes : le prompt pose déjà format/carte/couverture.
- `get_book_price` renvoie `{ usd, eur }` par format (carnet/softcover/
  premium, paliers 24/50/…/400 pages). Ne jamais coder un prix en dur.

## 4. Modèles Meta — faits et prix (doc officielle, 2026-10-27)

Base `https://api.meta.ai/v1`, clé `MODEL_API_KEY` (serveur uniquement,
jamais loggée, jamais côté client). Tous les appels passent par
[lib/models.ts](../lib/models.ts) ; fournisseur changeable par env
(`MODEL_BASE_URL`, `CHAT_MODEL`, `VOICE_MODEL`, `SAM_MODEL`).

- **Muse Spark 1.3** (`muse-spark-1.3`) : conversation + tool calling
  (Chat Completions, format OpenAI imbriqué `tools[].function`), et vision
  (messages `image_url` en data URLs). Prix standard : **1,25 $/1M tokens
  entrée, 4,25 $/1M sortie**, entrée cachée 0,15 $/1M.
- **SAM 3.1** (`sam-3.1`) : `POST /v1/responses`, `stream: true`,
  image en data URL. Sortie en texte à tokens spéciaux ; on extrait les
  boîtes `<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>` (0–1000 relatif) par
  regex et on garde la plus grande. Concepts utilisés : `person`,
  `mountain summit`, `bicycle`, `mountain`.
- **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) :
  `POST /v1/asr/transcribe` en multipart, partie `request` (JSON) + partie
  `audio` (**WAV mono PCM 16 bits, 16 ou 24 kHz uniquement**). Réponse :
  champ `transcript`. Le navigateur enregistre donc en WebAudio et encode
  un WAV 16 kHz maison (voir `encodeWav` dans page.tsx). Mode `PUSH_TO_TALK`.
- Coût mesuré en réel : une demande de livre simple = **9 115 tokens**
  (≈ 0,013 $). Une conversation complète moyenne : 100k–250k tokens
  (≈ 0,15–0,35 $). Chaque appel journalise `llm usage: in=… out=…` et le
  compteur `llm budget: X/DAILY_TOKEN_BUDGET`.

## 5. Garde-fous mécaniques (ne pas « corriger » en simples consignes)

Ces règles existent parce que le modèle seul s'est trompé en réel ; elles
sont appliquées dans le code, testées, et doivent le rester :

1. **Sélection verrouillée** : au clic « Continuer », la page envoie les
   identifiants cochés (`context.confirmedIds`). À la création, le serveur
   retire physiquement toute activité Strava hors liste
   ([lib/selection.ts](../lib/selection.ts)). Une re-liste ultérieure ne
   recoche jamais rien.
2. **Lecture Strava déterministe** : le bouton « C'est connecté —
   continuer » (et « c'est fait » tapé) appelle directement
   `list_strava_activities` via `/api/strava/activities`, sans passer par
   le modèle. L'identifiant survit aux rechargements (`localStorage`) et
   une carte de reprise s'affiche si la personne revient d'un onglet écrasé.
3. **Liens** : les URL AdvenBook brutes sont supprimées des textes de
   l'agent ; seuls les boutons portent les liens (nouvel onglet), le bouton
   livre pointe sur `creer`, pas `preview`.
4. **Langue** : détection sur le premier message + navigateur + sélecteur ;
   la langue française détectée est forcée dans `language` à la création
   (le modèle avait envoyé `en` pour un francophone). Les messages générés
   par les boutons ne doivent jamais changer la langue d'interface (ils ont
   un `display` court ; la détection ne lit que la frappe libre).
5. **Coûts** : rate limits par IP (chat 24/10 min, voix 30, analyses
   photo 12, envois 40 — voir routes), historique ≤ 30 messages × 4 000
   caractères, résultats d'outils tronqués à 12 000, max 8 tours d'outils
   par réponse, cache outils MCP 10 min, **plafond quotidien**
   `DAILY_TOKEN_BUDGET` (défaut 5 000 000 ; au-delà, 503 « budget du jour
   atteint », zéro appel modèle — vérifié en réel avec un plafond à 100).
   Compteur en mémoire : remis à zéro au redémarrage du serveur.
6. **Volumes déterministes** : si un appel de création dépasse le
   `maxItems` lu dans le schéma live de l'outil, le serveur découpe
   lui-même en volumes chronologiques (`chunkVolumes`,
   [lib/selection.ts](../lib/selection.ts)) et crée chaque volume — le
   modèle ne peut ni fusionner ni perdre de sorties.
7. **Budget partagé** : avec `KV_REST_API_URL`/`KV_REST_API_TOKEN` (ou
   Upstash) configurés, budget quotidien et rate limits passent par le
   store partagé (toutes instances) ; sans lui, compteurs en mémoire.
   L'interface est découpée : `app/components/cards.tsx` (cartes),
   `app/components/FilesPanel.tsx` (GPX/photos), `lib/voice.ts`,
   `lib/files.ts`, `lib/chat-types.ts` — `app/page.tsx` ne garde que
   l'état et l'orchestration. Un test navigateur commité
   (`npm run test:e2e`, Chrome/Edge requis, viewport 360 px) couvre
   chargement, FPS et liste complète.
8. **Budget serveur** : pour tester le plafond, écrire
   `DAILY_TOKEN_BUDGET=100` dans `.env.local` (via un vrai éditeur —
   `echo X=1>> fichier` en cmd mange le `1` comme descripteur), redémarrer,
   le 2ᵉ appel doit être 503 sans nouvelle ligne `llm usage`.
9. **Comptes et anti-bot (modèle « identité au moment de valeur »)** :
   aucun compte n'est demandé pour créer. Le visiteur reçoit un cookie
   signé `ab-vid` (aléatoire, httpOnly, aucune donnée personnelle —
   [lib/visitor.ts](../lib/visitor.ts)) qui porte un **plafond individuel**
   `VISITOR_DAILY_TOKEN_BUDGET` (défaut 250 000 tokens/jour, soit ~0,40 $
   maximum par bot et par jour). Deux ancres de confiance levent le
   plafond ×5 : la connexion Strava (le compte AdvenBook est alors créé
   par Strava côté AdvenBook) et un contrôle humain Turnstile, montré
   **uniquement** quand le plafond anonyme est atteint et seulement si
   `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` sont
   configurés ([lib/turnstile.ts](../lib/turnstile.ts) ; inerte sinon, le
   message propose alors Strava ou demain). Sans Strava, le compte naît au
   moment de commander : bouton « Commander » (`orderUrl`) = compte en un
   clic puis paiement Stripe chez AdvenBook. L'agent ne stocke aucun mot
   de passe, aucune carte, aucune adresse. C'est le schéma des grandes
   marques : essai anonyme plafonné, identité quand il y a de la valeur
   (connexion du service source ou paiement), fournisseur de paiement
   certifié pour l'argent. Rate limits en double couche : par visiteur
   (24/10 min) + par IP (60/10 min) sur le chat, 20/10 min sur la lecture
   Strava directe.
10. **Production** : erreurs centralisées en JSON structuré
    ([lib/monitor.ts](../lib/monitor.ts), filtre `monitor` dans les logs)
    + push optionnel vers `ALERT_WEBHOOK_URL` (Discord/Slack) avec alertes
    budget à 50/80/100 % ; santé sur `/api/health` (MCP, modèle, Blob,
    KV, Turnstile — à pinger par un moniteur externe gratuit). En-têtes de
    sécurité dans [next.config.ts](../next.config.ts) (CSP avec micro
    autorisé en self pour la voix, Turnstile whitelisté). CI GitHub
    Actions prête (`.github/workflows/ci.yml` : typecheck, tests, build à
    chaque commit dès que le dépôt privé existe) + Dependabot hebdo.
    Audit dépendances : 5 alertes « high » transitives sans correctif
    amont (postcss via next, zod via @vercel/blob) — outils de build/SDK,
    pas d'entrée utilisateur ; `npm audit` en CI à titre informatif.
11. **Chiffres produit** : compteurs anonymes ([lib/metrics.ts](../lib/metrics.ts))
    `chat_turn`, `book_created` (côté serveur), `open_click`,
    `order_click` (clics, aucun identifiant envoyé), `visitor_cap_hit`.
    Lecture protégée : `GET /api/metrics` avec `METRICS_TOKEN`
    (404 si non configuré), ratios livres/100 tours et commandes/livre
    inclus. Le taux de commande **payée** reste chez AdvenBook tant qu'il
    n'expose pas de statut de commande.
12. **KV prouvé en local** : `test/kv-budget.test.mjs` lance un faux
    serveur KV REST et des processus Node séparés (simulant plusieurs
    instances serveur) : le processus B voit les tokens et les hits
    comptés par A, pour le budget global, le budget visiteur et les rate
    limits. Activation réelle (5 min) : créer un store gratuit Vercel KV
    ou Upstash, coller `KV_REST_API_URL` + `KV_REST_API_TOKEN` dans
    l'environnement Vercel, redéployer. Sans KV, les compteurs sont en
    mémoire par instance (suffisant en local/démo, pas de garantie
    globale en production multi-instances).
13. **Suivi réel (28/10, pour le bilan du 5/11)** : chaque conversation a
    un id anonyme `c_` + 16 caractères (session navigateur, jamais nom /
    e-mail / id Strava). [lib/tracking.ts](../lib/tracking.ts) trace, dans
    le store partagé KV (TTL 30 jours, mémoire sinon), uniquement des
    compteurs : date, langue, source UTM assainie, tours, et pour CHAQUE
    appel modèle (Spark chat/vision, SAM, Voice) tokens/images/secondes
    audio, coût $ (prix dans [.env.example](../.env.example)), durée, code
    d'erreur court — jamais contenu, photo, URL ou message d'erreur brut
    (testé : [test/tracking.test.mjs](../test/tracking.test.mjs), dont
    preuve multi-instances KV). Étapes : `strava_connected`,
    `existing_book_found`, `book_created`, `book_continued`, `open_click`,
    `order_click`, `visitor_cap_hit`. L'id part en `agent_session_id`
    dans `create_adventure_book` ET `add_to_adventure_book` (champ relu
    en direct dans `tools/list` le 28/10 ; client MCP = clientInfo
    `advenbook-agent` + User-Agent `advenbook-agent/1.0`, testé contre un
    faux serveur MCP). `GET /api/metrics?date=YYYY-MM-DD` ajoute `daily` :
    conversations par source, entonnoir, coût total / par modèle / par
    conversation / par livre créé, tokens moyens, et la liste des ids de
    conversations ayant créé ou continué un livre (rapprochement avec les
    commandes payées côté AdvenBook).

## 6. Photos et GPX (M2), état réel

- GPX : parseur maison testé (distance haversine, D+ sur `ele`, durée,
  polyline Google préc. 5, échantillonnage ≤ 400 points).
- Photos : EXIF lu **dans le navigateur** (`exifr`) ; rattachement par date
  au jour près. « Photo libre » (aucune sortie) est un état normal :
  analysée comme groupe propre, recadrée/envoyée sans analyse préalable,
  puis l'agent demande où la mettre : rattachée, **page photo à part**
  (activité autonome titre + photo), ou couverture.
- Sélection vision : lots ≤ 12 images redimensionnées (≤ 900 px) en data
  URLs ; verdict JSON `{keep:[{id,reason}], drop:[…]}` parsé défensivement.
- Recadrage : SAM → plus grande boîte → crop 3:2 contenant le sujet
  (expansion 18 %, clampé) via `sharp`, JPEG ≤ 1600 px.
- Hébergement : Vercel Blob (`@vercel/blob`, jeton `BLOB_READ_WRITE_TOKEN`,
  accès public). **Après une création réussie** (claimUrl présente),
  l'agent supprime les copies Blob des `photo_urls` du livre (AdvenBook a
  copié les photos) ; en cas d'échec, il les garde. Vérifié : URL en 200
  avant, 404 après création.
- Sans jeton Blob, `/api/photos/process` répond 501 avec un message honnête
  (recadrage OK, envoi non configuré). Ne jamais simuler un envoi.
- Appareils : la détection iPhone/Android/bureau se fait **dans le
  navigateur** (`navigator.userAgent`, [lib/i18n.ts](../lib/i18n.ts)) —
  aucun réseau, aucun coût. Sur iPhone le sélecteur système ouvre la
  photothèque Apple ; sur Android la galerie/Google Photos. Apple n'offre
  aucune API web d'accès direct à la photothèque aux sites tiers ; le
  sélecteur système EST la voie officielle. Limite connue : HEIC iPhone OK
  sous Safari, parfois KO sous Chrome/Windows.

## 7. Interface et marque

Charte officielle : [brand/BRAND.md](../brand/BRAND.md) fait foi (Bleu
Ardoise `#1B2D45`, Cuivre Patiné `#D4956B`, Pierre Claire `#F8F5F0`, Crème
Papier `#F4EDE4`, Playfair Display + Inter via `next/font/google`, logos
dans [public/](../public/), favicon `app/icon.png`). Toute couleur passe
par les variables `--brand-*` en tête de [app/globals.css](../app/globals.css).
Mobile d'abord : sous 640 px, boutons pleine largeur empilés, composer sur
deux rangées, grille photos 2 colonnes, viewport explicite dans
[app/layout.tsx](../app/layout.tsx). Dépôt **privé et propriétaire** :
aucune licence libre, aucun remote Git ne doit être ajouté, ne jamais pousser.

Messages d'erreur : toujours dans la langue d'interface (clés `netError`,
`serverError` de lib/i18n.ts). Ne jamais réintroduire de texte d'erreur
codé en dur dans une seule langue — c'est un bug déjà vécu (« Sorry I
couldn't reach the server » servi à un francophone).

## 8. Ce qui reste, et où ça se joue

Dans ce dépôt : rien de bloquant. Hors de ce dépôt :
- Déploiement : le fondateur crée le dépôt GitHub privé + projet Vercel
  et y met les variables d'environnement (§2 de [.env.example](../.env.example)).
- Côté AdvenBook (leur code privé) : paramètre `include_polyline` effectif
  ou traces dans la liste Strava, mise en page photos pleine page par défaut, bug « carte
  détaillée plein écran » quand une activité n'a que carte ou que photo,
  paramètres `cover_color`/`typography`/`photo_shape` dans le MCP,
  redirection éventuelle `creer`→`preview` pour sessions non reconnues.
- Validation finale : parcours complet avec le vrai compte Strava du
  fondateur et de vraies photos, puis vidéo de démo (emplacement prévu
  dans [README.md](../README.md)).

## 9. Commandes utiles

```bash
npm install
npm run dev            # développement (port 3000 par défaut)
npm run build          # build de production (obligatoire avant start)
npm run start -- -p 3100
npm test               # 16+ tests : liens, sélection, highlights, GPX/crop, i18n
npx tsc --noEmit       # typecheck
```

Pièges Windows déjà rencontrés : `git` exige
`-c safe.directory=C:/Users/semer/advenbook-agent` (propriété du dossier),
le cache npm doit pointer hors de `AppData\Roaming`
(`npm_config_cache` vers un dossier accessible), et un serveur `next start`
sur un port déjà pris échoue silencieusement dans les logs — vérifier
`netstat -ano | findstr 3100` avant de conclure.
