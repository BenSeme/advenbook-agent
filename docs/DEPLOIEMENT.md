# Déploiement et activations — guide fondateur

Tout le code est prêt. Ce qui suit demande **vos comptes** (GitHub, Vercel,
Cloudflare, Discord) : aucun agent ne peut cliquer à votre place. Comptez
30 à 45 minutes, une seule fois. Le dépôt doit rester **privé**, sans
exception.

## 1. Mettre le code sur GitHub (privé)

1. github.com → New repository → nom `advenbook-agent`, visibilité **Private**.
2. Dans le dossier du projet, un terminal :
   `git remote add origin <url-du-depot-prive>` puis `git push -u origin main`.
   (C'est vous qui poussez : la règle du projet interdit à l'agent d'ajouter
   un remote.)

## 2. Déployer sur Vercel

1. vercel.com → Add New → Project → importez le dépôt privé.
2. Framework : Next.js (détecté automatiquement). Ne changez rien d'autre.
3. Avant le premier déploiement, ajoutez les variables d'environnement
   (Settings → Environment Variables), voir tableau ci-dessous.
4. Deploy. L'adresse `https://advenbook-agent-….vercel.app` fonctionne.

| Variable | Obligatoire | Où l'obtenir |
|---|---|---|
| `MODEL_API_KEY` | oui | La clé Meta AI déjà dans votre `.env.local` |
| `BLOB_READ_WRITE_TOKEN` | oui (photos) | Déjà dans `.env.local` (Vercel Blob) |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | fortement conseillé | Étape 3 (gratuit) |
| `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | conseillé | Étape 4 (gratuit) |
| `ALERT_WEBHOOK_URL` | conseillé | Étape 5 (gratuit) |
| `METRICS_TOKEN` | conseillé | Une longue phrase secrète que vous inventez |
| `DAILY_TOKEN_BUDGET` | non | Défaut 5 000 000 tokens/jour |
| `VISITOR_DAILY_TOKEN_BUDGET` | non | Défaut 250 000 tokens/visiteur/jour |

Après chaque changement de variable, redéployez (Deployments → … → Redeploy).

## 3. Activer le compteur partagé (KV) — 5 minutes

Sans lui, budgets et limites sont comptés par serveur et oubliés au
redémarrage. Avec lui, le plafond est global et prouvé.

1. Dans le projet Vercel → onglet **Storage** → Create Database →
   choisissez **Upstash Redis** (Marketplace, offre gratuite).
2. Créez la base et **connectez-la au projet** : Vercel ajoute tout seul
   les variables (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   ou `KV_REST_API_URL` / `KV_REST_API_TOKEN` — le code accepte les deux).
3. Redéployez. Vérification : `https://<votre-adresse>/api/health` doit
   afficher `sharedKvStore: true`.

## 4. Activer le contrôle humain anti-bot — 5 minutes

Il n'apparaît que si un visiteur anonyme dépasse son plafond quotidien.
Invisible pour tous les autres.

1. dash.cloudflare.com → **Turnstile** → Add widget.
2. Nom libre, domaine = votre adresse Vercel (puis votre domaine final).
3. Copiez la **Site Key** dans `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et la
   **Secret Key** dans `TURNSTILE_SECRET_KEY` (Vercel → Environment).
4. Redéployez (la clé publique est intégrée au build).

## 5. Recevoir les erreurs et alertes budget — 3 minutes

1. Discord : votre serveur → Paramètres → Intégrations → Webhooks →
   Nouveau webhook → Copier l'URL. (Slack : même principe.)
2. Collez-la dans `ALERT_WEBHOOK_URL` sur Vercel, redéployez.
3. Vous recevrez : chaque erreur serveur, et une alerte quand le budget
   IA du jour atteint 50 %, 80 % puis 100 %. Sans webhook, les erreurs
   restent visibles dans Vercel → Logs (cherchez `monitor`).
4. Surveillance externe gratuite : créez un compte UptimeRobot et faites
   pinger `https://<votre-adresse>/api/health` toutes les 5 minutes.

## 6. Vérifications après déploiement (10 minutes)

1. `/api/health` → `ok: true`, `sharedKvStore: true`.
2. Conversation en français : réponse en français, prix en **euros**.
3. Créez un vrai petit livre avec votre Strava, ouvrez-le (nouvel onglet).
4. Cliquez **Commander mon livre** : compte en un clic, page Stripe —
   vous pouvez fermer avant de payer, le parcours est vérifié.
5. `https://<votre-adresse>/api/metrics?token=<votre-METRICS_TOKEN>` :
   vous devez voir conversations, livres créés et clics Commander.
   C'est ce rapport qui dit si l'agent transforme.
6. Testez sur votre téléphone, en 4G, pas seulement en Wi-Fi.

## 7. Plus tard

- Domaine personnalisé (Vercel → Domains), puis mettre à jour le widget
  Turnstile avec ce domaine.
- Mettre à jour ce guide avec l'adresse finale et la date de mise en ligne.

Alternative terminal : si vous tapez `npx vercel login` vous-même dans un
terminal, un agent peut ensuite lancer les déploiements (`npx vercel deploy
--prod`) depuis votre session, sans jamais toucher à vos identifiants.
