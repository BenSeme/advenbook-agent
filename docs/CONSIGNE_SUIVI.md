# Instructions: real tracking (28/10)

Goal: on 5/11, know exactly what the agent cost and what it brought in, without storing any personal data.

1. **Conversation id.** At the start of each conversation, create a random anonymous id (e.g. `c_` + 16 letters/digits; never the name, the email or the Strava id).
2. **Trace per conversation**, in the shared store (Redis), kept 30 days, counts only, never the content of messages or photos:
   - date, language, source (utm_source / utm_medium / utm_content of the arrival link: bubble, email, direct…);
   - number of turns;
   - for EVERY model call: model (Spark chat, Spark vision, SAM, Voice), input/output tokens (or seconds of audio, number of images), cost in $ computed with the prices in .env.example, duration, error if any;
   - steps reached: strava_connected, existing_book_found, book_created, book_continued, open_click, order_click, visitor_cap_hit.
3. **Link to AdvenBook.**
   - Send this id as `agent_session_id` in create_adventure_book and add_to_adventure_book (field live on the AdvenBook MCP).
   - Set the HTTP User-Agent to "advenbook-agent/1.0" and the MCP clientInfo name to "advenbook-agent".
4. **Daily summary** at GET /api/metrics (protected by METRICS_TOKEN), per day:
   - conversations, conversations by source, the funnel above;
   - total cost in $, cost per model;
   - cost per conversation, cost per book created, average tokens per conversation;
   - plus the list of the day's conversation ids that created or continued a book (so AdvenBook can match them with paid orders).
5. **Tests** for the cost calculation and for the absence of personal data in the traces.

Then build, test, commit and push.
