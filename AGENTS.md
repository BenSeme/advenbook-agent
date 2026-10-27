# AdvenBook Agent: build brief

> **En bref (pour Benoit)** : ce fichier est la consigne que Muse lit pour coder l'agent.
> L'agent est une petite appli web publique. On parle au sportif, il choisit ses sorties Strava,
> lui pose quelques questions, choisit et recadre ses photos, puis crée le livre sur AdvenBook
> par la prise publique (serveur MCP) qui existe déjà. Le code d'AdvenBook reste privé.

You are building the **AdvenBook Agent**, our entry to the Meta Global AI Developer Hackathon
(Startup track). Read this whole file before writing code.

## 1. Context

AdvenBook (https://www.advenbook.com) is live in production. Athletes connect Strava or upload GPX
files and photos. AdvenBook then prints a book with a route map, an elevation profile, stats,
photos and a story for each outing.

**The problem we solve:** users start a book and never finish it. The hard part is not printing.
It is the work before: choosing outings among hundreds, sorting photos, writing texts.

**The agent removes that work.** The athlete says: *"Make a book of my summer in the Pyrenees,
with my summit photos."* The agent does the rest and hands back a link to a finished book draft
they can order.

### How we are judged (official rules)
- Impact 30 %: a real problem, real users, could become something people use.
- **Use of Meta AI tooling 25 %:** go beyond a basic integration and show unexpected capabilities.
- Demo 25 %: a working, impressive demo that holds up live, plus the demo video.
- Technical depth 20 %: sound, refined engineering.

**Deadline:** Wednesday 4 November 2026, 21:00 ET. Aim to be finished and deployed by
**Monday 2 November** so the founder can record the video.

## 2. What to build

A small web app (chat UI plus a server), deployable on Vercel. **Everything lives in this repo**
(`advenbook-agent`). Never create or edit files in any other folder, in particular not in the
private AdvenBook repo. The UI is **one full-screen page** (`app/page.tsx`): a conversation
thread, an input box, and a result card with the "Open my book" link. Later, advenbook.com will
link to it with a button. It must be mobile friendly. The
agent answers in the user's language: English by default, French if the user writes in French.

### The flow (this is also the demo script)
1. **Ask.** The user types or dictates what book they want.
2. **Connect Strava.** Call the AdvenBook tool `connect_strava` and show its link as a button.
   When the user says it is done, call `list_strava_activities` (filter by dates when the request
   names a period).
3. **Choose.** **Muse Spark** picks the outings that match the request and says why in one line
   each, for example "Tourmalet: your biggest climb of the summer". The user can untick or add
   outings in a simple checklist.
4. **Interview.** For each chosen outing, ask 1 or 2 short, warm questions: who was there, a
   highlight, how they felt. Answers can be typed or spoken. For spoken answers, transcribe with
   **Muse Voice Transcribe**. From the answers, write a 2–4 sentence story in the first person,
   in the user's own words. **Never invent facts.** If the user skips, write no story.
5. **Photos.** Photos already on Strava are added by AdvenBook itself, so do nothing for those.
   The user can also drop extra photos from their phone:
   - Read each photo's EXIF date and GPS **in the browser**, and match it to an outing by date.
   - Use **Muse Spark** (vision) to keep the best 4–10 photos per outing: sharp, varied, no
     near-duplicates. Give a one-line reason for each choice.
   - Use **SAM 3.1** to find the main subject (prompts like "person", "mountain summit",
     "bicycle") and crop each photo to a print ratio without cutting the subject.
   - Upload the crops to public storage (Vercel Blob) and pass their public https URLs as
     `photo_urls`.
6. **Create the book.** Call `create_adventure_book` with `strava_connection_id`, each outing's
   `strava_activity_id`, the stories, the `photo_urls` and `language`. Then show a big
   "Open my book" button (`claimUrl`) and the estimated price. **Never say the book is ordered or
   paid:** it is a draft the user orders on advenbook.com.

### Milestones (each one must work on its own and be committed)
- **M1. Text agent, end to end:** chat, Muse Spark with tool calling, the 4 AdvenBook tools, and a
  real book draft created from real Strava activities. **M1 alone is already a valid demo.** Stop
  after M1 and show the founder.
- **M2. Photos:** EXIF matching, Muse Spark photo choice, SAM 3.1 crops, Vercel Blob upload.
- **M3. Voice:** dictate the request and the interview answers with Muse Voice Transcribe.
- **M4. Polish and ship:** clean UI, error states, deployment on Vercel, and the README for
  the judges.

## 3. AdvenBook: how to talk to it

Use **only** the public MCP server. It needs no API key:

```
https://www.advenbook.com/api/mcp
```

- Connect with the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`, Streamable HTTP
  client). The server is stateless: **POST only** (GET returns 405).
- Call `tools/list` at runtime and give those tool definitions to the model as they are. Their
  descriptions contain the usage rules, so do not rewrite or hard-code them.
- Tools:
  - `connect_strava({ language })` → `{ connectUrl, connection_id, expiresAt }`. The link is
    valid 24 h.
  - `list_strava_activities({ connection_id, after?, before?, limit? })` →
    `activities[{ strava_activity_id, title, date, sport, distance_km, elevation_gain_m,
    duration, photos, has_route, is_race }]`. Dates are `YYYY-MM-DD`.
  - `create_adventure_book({ title, strava_connection_id, language, data_source,
    activities[{ title, date, distance_km, elevation_gain_m, duration, sport, story,
    strava_activity_id, photo_urls }] })` → `{ bookId, claimUrl, estimatedPages, price }`.
    1 to 50 activities. Keep Strava titles unchanged unless the user asks.
  - `get_book_price({ format?, pages? })` for prices. **Never hard-code prices.**
- Limits: about 60 MCP calls per hour and 10 books per hour per IP. Do not loop and do not retry
  blindly.
- Do **not** call `/api/agent/v1` (it is key-protected and private). Do not try to reach
  anything else on advenbook.com.

## 4. Meta models

- Facts from the official overview (https://dev.meta.ai/docs/overview):
  - Base URL `https://api.meta.ai/v1`, auth `Authorization: Bearer $MODEL_API_KEY`.
  - Drop-in compatible with the OpenAI SDK (Chat Completions and Responses) and the Anthropic SDK
    (Messages).
  - Chat models: `muse-spark-1.3` (standard). `muse-spark-1.3-contributor` is up to 95 % cheaper
    but only in select countries, and its inputs are used for training.
  - SAM: model `sam-3.1`, via `POST /v1/responses` and `POST /v1/files`; returns boxes and masks.
  - Voice: model `muse-voice-transcribe-1.0`, file endpoint `POST /v1/asr/transcribe`, realtime
    `wss://api.meta.ai/v1/asr/realtime`.
- For request and response details, read the docs pages "Tool calling", "Image understanding",
  "Media segmentation" and "Speech to text" before coding each part. **Do not guess.**
- Conversation and tool calling: **Muse Spark 1.3**. Photo choice: Muse Spark (vision).
  Segmentation and crops: **SAM 3.1**. Voice: **Muse Voice Transcribe**. Do not use Muse Wonder
  inside the app: it is too expensive for a per-user service.
- Put every model call behind **one small module** (`lib/models.ts`). Model ids and base URL come
  from env vars. After the hackathon, the founder must be able to switch the chat model to
  another provider (for example DeepSeek through an OpenAI-compatible endpoint) by changing env
  vars only.
- The API key is `MODEL_API_KEY` in `.env.local`. It is already there; the founder pasted it.
  Only the server reads it: **never in client code, never logged, never committed.** Provide an
  `.env.example` without values.

## 5. Rules

- **This repo will be public**, and the hackathon gives Meta a licence on the submission. Never
  put secrets, personal data, or real users' photos in it.
- **Credits are free, and Meta may use what is sent.** Test only with the founder's own Strava
  account and photos.
- Keep dependencies few. Use TypeScript strict mode, Next.js App Router and plain CSS or Tailwind.
- Mobile-first, clean outdoor look. Show progress while tools run, for example "Reading your
  Strava…" or "Choosing your best photos…". Never leave a frozen screen.
- Handle errors honestly: Strava not connected yet, link expired, no activities in that period,
  photo upload failed. Say what happened and what to do.
- Commit after each working step with a clear message. Do not push. The founder will create the
  GitHub repo and connect Vercel.
- Work in small steps: credits are limited (Muse Wonder is billed per token). Do not rewrite
  working code without a reason.

## 6. README (for the judges, at M4)

In English:
- What it does, in 3 lines.
- A short demo GIF or video link (placeholder until recorded).
- A Mermaid diagram: user → agent (Muse Spark, SAM 3.1, Voice Transcribe) → AdvenBook MCP → book.
- **"How we use Meta AI"**: one paragraph per model, saying what it does in the flow and why it
  matters.
- Setup: env vars and `npm run dev`.
- Licence: MIT (already in the repo).
