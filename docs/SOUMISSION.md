# Soumission au hackathon Meta — textes prêts à copier

Portail : https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit
Rendu : **mercredi 4 novembre 2026, 21 h ET = jeudi 5/11 à 3 h du matin à Paris**.
Donc, en pratique : **soumettre mercredi 4/11 avant minuit, heure de Paris**.

Le formulaire peut avoir d'autres champs ou d'autres noms. Pour chaque champ, coller le
bloc qui y ressemble le plus. Les textes sont en anglais (jury international), avec la
traduction française en dessous, pour toi seulement.

---

## Avant de remplir (5 min)

1. **La vidéo est en ligne** sur YouTube, en « Non répertoriée » (plan de tournage dans
   [VIDEO_JURY.md](VIDEO_JURY.md)). Copier son lien.
2. **Coller le lien de la vidéo dans le README** : à la ligne « Demo video: _(placeholder…)_ »
   de [README.md](../README.md). Ou dire à Claude : « voici le lien de la vidéo, mets-le dans le README et pousse ».
3. **Le dépôt `github.com/BenSeme/advenbook-agent` reste privé.** Si le formulaire demande
   un accès au code, ajouter les juges comme lecteurs (s'il donne leurs comptes GitHub) ; sinon
   le lien de la démo en ligne suffit.
4. Track : **Startup** (choisi à l'inscription).

---

## Project name

```
AdvenBook Agent
```

## Tagline (one line)

```
Say "make a book of my summer in the Pyrenees" — the agent picks your Strava outings, interviews you, and creates a printed book draft.
```

*Traduction : Dis « fais un livre de mon été dans les Pyrénées » : l'agent choisit tes sorties Strava, te pose quelques questions et crée le brouillon d'un livre imprimé.*

## Live demo

```
https://agent.advenbook.com/
```

## Code

```
https://github.com/BenSeme/advenbook-agent
```

## Demo video

```
[coller le lien YouTube]
```

---

## Description (long)

```
THE PROBLEM
Athletes log hundreds of runs, rides and hikes on Strava, with photos on their phone. They would love a printed book of a season or a trip, but building it means sorting hundreds of activities, choosing photos and writing stories. That work is where people give up. AdvenBook (www.advenbook.com) is a live product that prints these books; the empty page is our biggest drop-off.

WHAT WE BUILT
AdvenBook Agent removes that work. The athlete types or simply says what book they want, in English or French. The agent connects Strava (or takes GPX files and photos), proposes a shortlist of outings with a one-line reason for each (races first, warm-ups unticked, standout outings badged), asks one or two warm questions per outing, and turns the answers into short first-person stories without inventing facts. It then makes the design calls once (format, map, cover, with real prices) and creates a real book draft through AdvenBook's public MCP server. One click opens the book; one more orders it.

HOW WE USE META AI
- Muse Spark 1.3 is the art director. It runs the whole conversation as a tool-calling agent over the AdvenBook MCP tools: it understands the request, chooses which outings belong in the book and explains why, interviews the athlete, writes the stories, and picks the book's style (template, typography, photo shape, cover) from the data. With vision, it also curates dropped photos: sharp, varied, no near-duplicates, with a one-line reason per keeper.
- SAM 3.1 is the careful cropper. For every kept photo it segments the main subject from a text prompt ("person", "mountain summit", "bicycle"), and the app crops to a print ratio around it, so no head or summit gets cut. Without SAM these would be blind centre crops.
- Muse Voice Transcribe makes the interview hands-free. Athletes dictate the request and their memories instead of typing. Speech is where the memories are; typing them was the friction that made people abandon their book.

ENGINEERING
Next.js 15 + TypeScript on Vercel, no database. The agent talks to AdvenBook only through its public MCP server, like any third-party client. Mechanical safeguards in code (not just prompts) stop the model from creating a book before the user has chosen, from sending unticked outings, or from claiming a book is paid. Photo EXIF dates and GPS are read in the browser to match photos to outings. Every model call is costed in anonymous per-conversation traces (no personal data) linked to the book by an anonymous session id, so we know the real cost per book created.

WHAT'S NEXT
The agent is already live behind a "Create your book by talking" bubble on advenbook.com. Next: measure how many conversations become ordered books, and bring the same agent to voice-first and mobile.
```

*Traduction (pour toi) :*
*LE PROBLÈME. Les sportifs enregistrent des centaines de sorties sur Strava, avec des photos sur leur téléphone. Ils aimeraient un livre imprimé d'une saison ou d'un voyage, mais il faut trier des centaines d'activités, choisir les photos et écrire des récits. C'est là qu'ils abandonnent. AdvenBook est un produit en ligne qui imprime ces livres ; la page blanche est notre plus grosse perte.*
*CE QU'ON A CONSTRUIT. L'agent fait ce travail. Le sportif écrit ou dit le livre qu'il veut. L'agent connecte Strava (ou prend des GPX et des photos), propose une sélection de sorties en disant pourquoi pour chacune, pose une ou deux questions par sortie et en fait de courts récits à la première personne sans rien inventer. Il fait les choix de mise en page une fois (format, carte, couverture, avec les vrais prix), puis crée un vrai brouillon de livre par le serveur MCP public d'AdvenBook. Un clic ouvre le livre, un autre le commande.*
*META AI. Muse Spark mène la conversation, choisit les sorties, interroge, écrit les récits, choisit le style du livre, et trie les photos (vision). SAM 3.1 trouve le sujet de chaque photo pour la recadrer sans couper une tête ou un sommet. Muse Voice Transcribe permet de dicter au lieu de taper.*
*TECHNIQUE. Next.js 15 sur Vercel, sans base de données ; l'agent passe uniquement par le MCP public ; des garde-fous dans le code empêchent le modèle de créer un livre trop tôt, d'envoyer des sorties décochées ou de dire qu'un livre est payé ; chaque appel de modèle est chiffré dans des traces anonymes.*
*ET APRÈS. L'agent est déjà en ligne derrière la bulle « Crée ton livre en parlant » sur advenbook.com. Ensuite : mesurer combien de conversations deviennent des livres commandés, et passer à la voix d'abord et au mobile.*

## Short description (si le formulaire limite à ~300 caractères)

```
An agent that turns "make a book of my summer" into a printed book draft: Muse Spark picks your Strava outings and interviews you, Muse Voice lets you dictate memories, SAM 3.1 crops photos without cutting heads or summits. Live at agent.advenbook.com.
```

*Traduction : Un agent qui transforme « fais un livre de mon été » en brouillon de livre imprimé : Muse Spark choisit tes sorties Strava et t'interroge, Muse Voice te laisse dicter tes souvenirs, SAM 3.1 recadre les photos sans couper les têtes ni les sommets. En ligne sur agent.advenbook.com.*

## Meta models used (si case à cocher ou champ libre)

```
Muse Spark 1.3 (chat, tool calling, vision), SAM 3.1 (segmentation), Muse Voice Transcribe 1.0 (speech-to-text)
```

## Built with / tech stack

```
Next.js 15, TypeScript, React 19, Vercel, Vercel Blob, Model Context Protocol (MCP), Strava API, Meta Model API
```

## Team

```
Solo founder — AdvenBook (github.com/BenSeme)
```

## Challenges (si le formulaire le demande)

```
Keeping a language model honest in a real purchase flow. Prompts alone were not enough: the model sometimes created a book before the athlete had chosen, or included outings they had unticked. We moved those rules into code — the book can only be created from the athlete's confirmed checklist — and the agent never says a book is ordered or paid.
```

*Traduction : Garder un modèle honnête dans un vrai parcours d'achat. Les consignes ne suffisaient pas : le modèle créait parfois le livre avant le choix du sportif, ou y mettait des sorties décochées. On a mis ces règles dans le code : le livre ne peut être créé qu'à partir de la liste confirmée, et l'agent ne dit jamais qu'un livre est commandé ou payé.*
