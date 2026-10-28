# Choix du modèle d'IA — rapport prix / qualité

*Établi le 28 octobre 2026, prix publics vérifiés ce jour-là (sources en fin
de document). À relire avant tout changement : les grilles bougent vite.*

## 1. De quoi notre agent a réellement besoin

Quatre travaux, pas un seul :

1. **Conversation + enchaînement d'outils** : connecter Strava, lister,
   créer le livre (jusqu'à 8 tours d'appels), recopier des identifiants
   exacts sans en inventer. C'est le travail le plus exigeant en fiabilité.
2. **Écriture chaude en français** (et es/de/it/eu) : questions, récits de
   2-4 phrases à partir des réponses, sans jamais inventer de faits.
3. **Vision** : choisir les photos à garder, répondre en JSON strict.
4. **Voix et recadrage** : transcription et segmentation SAM. Ces deux-là
   restent chez Meta quoi qu'il arrive — aucun concurrent ne les remplace
   dans notre code, et ils sont facturés séparément du modèle de chat.

Point clé : notre serveur porte déjà une partie de l'intelligence
(filtre mécanique sur la sélection confirmée, découpage en volumes,
langue forcée, plafonds). Le modèle n'a donc **pas** besoin d'être le
plus fort du marché ; il doit être fiable sur les outils, bon en français,
et voir les images.

## 2. Les prix, ramenés à un livre

Hypothèse mesurée sur notre agent : une conversation complète ≈
120 000 tokens en entrée (l'historique est renvoyé à chaque tour) et
8 000 en sortie. Coût = entrée × prix entrée + sortie × prix sortie.

| Modèle | $ / 1M entrée | $ / 1M sortie | ≈ $ par livre | Vision | Outils |
|---|---|---|---|---|---|
| Muse Spark 1.3 Contributor (Meta) | 0,10 | 0,20 | **0,014** | oui | oui |
| Gemini 2.5 Flash-Lite (Google) | 0,10 | 0,40 | **0,015** | oui | oui |
| Claude Haiku 5.5 (Anthropic) | 0,10 | 0,50 | **0,016** | oui | oui |
| DeepSeek Flash V4.1 (DeepSeek) | 0,15 | 0,60 | **0,023** (0,046 aux heures de pointe) | oui | oui |
| Mistral Small 4 (Mistral) | 0,15 | 0,60 | **0,023** | oui | oui |
| GPT-5.4 nano (OpenAI) | 0,20 | 1,25 | **0,034** | oui | oui |
| Gemini 3.1 Flash-Lite (Google) | 0,25 | 1,50 | **0,042** | oui | oui |
| GPT-5 mini (OpenAI) | 0,25 | 2,00 | **0,046** | oui | oui |
| Mistral Large 3 (Mistral) | 0,50 | 1,50 | **0,072** | oui | oui |
| GPT-5.4 mini (OpenAI) | 0,75 | 4,50 | **0,126** | oui | oui |
| Claude Haiku 4.5 (Anthropic) | 1,00 | 5,00 | **0,160** | oui | oui |
| **Muse Spark 1.3 standard (Meta) — actuel** | 1,25 | 4,25 | **0,184** | oui | oui |
| Mistral Medium 3.5 (Mistral) | 1,50 | 7,50 | **0,240** | oui | oui |
| Claude Sonnet 5 (Anthropic) | 2,00 | 10,00 | **0,320** | oui | oui |
| Muse Wonder (Meta, haut de gamme) | 4,00 | 20,00 | **0,640** | oui | oui |

À comparer au prix d'un livre : 45 à 95 €. Même le modèle actuel
représente moins de 0,5 % du prix de vente. Le coût d'IA ne devient un
sujet que multiplié par les visiteurs qui ne commandent pas — d'où les
plafonds par visiteur déjà en place.

## 3. Le niveau d'IA nécessaire, par gamme

**Bas de gamme (nano / lite / contributor, ~0,015 $/livre).**
Capables de tenir la conversation simple. Risques réels chez nous :
étapes d'outils sautées ou répétées, identifiants recopiés de travers
(notre filtre serveur en rattrape une partie), français plus plat,
verdicts photo en JSON parfois malformés (notre parseur défensif aide).
Verdict : utilisables grâce à nos garde-fous mécaniques, mais plus
d'échecs silencieux et de support. Le **Contributor de Meta est à exclure
pour de vrais clients** : son prix s'explique par l'utilisation de vos
données (conversations et photos d'utilisateurs) pour entraîner Meta.
Inacceptable pour notre page de transparence.

**Milieu de gamme « small » (DeepSeek Flash, Mistral Small 4, Haiku 5.5,
GPT-5 mini, ~0,02-0,05 $/livre).**
Le meilleur rapport qualité/prix pour ce travail précis : appels
d'outils fiables, bon français, vision correcte. 4 à 9 fois moins cher
que notre modèle actuel, pour une différence de qualité faible sur des
tâches structurées comme les nôtres.

**Haut de gamme (Sonnet, Medium, Wonder, ~0,24-0,64 $/livre).**
Pensé pour le raisonnement difficile et le code. Notre agent ne fait ni
l'un ni l'autre : le gain serait invisible pour l'utilisateur, le coût
3 à 30 fois supérieur. À réserver à un éventuel usage ponctuel, jamais
en modèle par défaut d'un service grand public.

## 4. Les critères qui ne sont pas dans les prix

- **Hackathon (maintenant)** : 25 % de la note juge l'usage de Meta AI.
  Muse Spark + SAM + Voice chez Meta, c'est l'argument maximal.
  On ne change rien avant la fin du hackathon.
- **Données européennes** : Mistral est le seul hébergeur européen du
  tableau (argument RGPD simple à raconter). DeepSeek est le moins
  cher des crédibles, mais hébergement en Chine : question de transfert
  de données à assumer devant des clients européens. Meta, OpenAI,
  Anthropic, Google : États-Unis.
- **Branchement chez nous** : notre code parle le format « Chat
  Completions » d'OpenAI via trois variables (`MODEL_BASE_URL`,
  `CHAT_MODEL`, `MODEL_API_KEY` dans [lib/models.ts](../lib/models.ts)).
  DeepSeek, Mistral, OpenAI et Gemini (endpoint compatible) se branchent
  **sans toucher au code**. Claude passe par sa couche de compatibilité
  OpenAI : à valider avant de promettre.
- **Vision** : vérifier que le modèle choisi accepte les images au
  format que nous envoyons. DeepSeek V4 **Pro** ne voit pas ; la version
  Flash, oui.
- **Cache d'entrée** : notre prompt système et les outils sont renvoyés
  à chaque tour ; les tarifs « cached input » (très bas chez Meta et
  DeepSeek) réduisent encore la facture réelle.

## 5. Recommandation

1. **Jusqu'à la fin du hackathon : Muse Spark 1.3 standard** (actuel).
   Prouvé de bout en bout chez nous, coût maîtrisé (~0,18 $ par livre),
   et c'est le choix qui sert la note Meta.
2. **Après le hackathon, si le volume monte** : tester en conditions
   réelles DeepSeek Flash contre Mistral Small 4 (une journée, que des
   variables d'environnement à changer). Choisir Mistral si l'argument
   « données en Europe » compte commercialement, DeepSeek si seul le
   prix compte. Garder Spark en solution de repli.
3. **Jamais** : le Contributor pour des données clients, et aucun modèle
   haut de gamme en standard.

## 6. Protocole de test avant de changer (1 heure)

1. Changer `MODEL_BASE_URL`, `CHAT_MODEL`, `MODEL_API_KEY` dans
   `.env.local`, redémarrer.
2. Faire 5 conversations complètes en français : Strava, refus de
   Strava avec GPX, photos à choisir, création directe, création après
   questions.
3. Noter : livre créé du premier coup ? identifiants exacts ? prix dans
   la bonne devise ? verdicts photo en JSON valide ? ton en français ?
4. Lire les lignes `llm usage` du journal serveur : coût réel par livre.
5. Ne décider que sur ces mesures, pas sur les benchmarks publics —
   ils mesurent du code et des maths, pas notre parcours.

## Sources (vérifiées le 28 octobre 2026)

- Meta, tarifs officiels : https://dev.meta.ai/docs/pricing-rate-limits
- DeepSeek, tarifs officiels : https://api-docs.deepseek.com/quick_start/pricing
- Mistral, tarifs officiels : https://docs.mistral.ai/inference/pricing
- OpenAI : https://openai.com/api/pricing/ (séries GPT-5 mini/nano,
  GPT-5.4 mini/nano)
- Anthropic : https://claude.com/pricing (Haiku, Sonnet)
- Google : https://ai.google.dev/gemini-api/docs/pricing (Flash-Lite)
