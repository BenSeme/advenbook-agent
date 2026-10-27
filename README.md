# AdvenBook Agent

Tell the agent what book you want (“My summer in the Pyrenees”).
It connects your Strava, picks the outings with you, asks a few short questions, and creates a draft AdvenBook you can open and order.

Status: **M1** — text chat end to end (Muse Spark + AdvenBook MCP tools). Photos (M2), voice (M3) and polish (M4) come later.

## Run it

```bash
npm install
npm run dev   # http://localhost:3000
```

Copy `.env.example` to `.env.local` and set `MODEL_API_KEY` (server-only).
Model provider is switched by env vars only (`MODEL_BASE_URL`, `CHAT_MODEL`) — see [lib/models.ts](lib/models.ts).

## How it works

User → chat UI (`app/page.tsx`) → `/api/chat` → Muse Spark tool-calling loop ([lib/agent.ts](lib/agent.ts)) → AdvenBook public MCP server (`https://www.advenbook.com/api/mcp`, tools fetched at runtime via [lib/mcp.ts](lib/mcp.ts)) → book draft link.

## Licence

MIT — see [LICENSE](LICENSE).
