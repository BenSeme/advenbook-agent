You are working in the AdvenBook Agent repo (Next.js 15 + TypeScript, see README.md and AGENTS.md).
Goal for today (hackathon judges test the live demo tonight): an athlete WITHOUT Strava must be able to
build a book from Garmin, Komoot, or simply a folder of GPX files + photos. Keep changes small, reuse the
existing code paths (lib/gpx.ts, app/components/FilesPanel.tsx, app/page.tsx GPX/photo handling,
photo processing with Spark vision + SAM), do not rewrite working code, do not touch book-creation
safeguards, budgets, tracking or the Strava flow.

1. DROP A WHOLE FOLDER.
   - In FilesPanel, accept a dropped FOLDER (use DataTransferItem.webkitGetAsEntry() and read directories
     recursively, max 300 files) as well as loose files. Add a "Choose a folder" button
     (<input type="file" webkitdirectory multiple>) next to the existing pickers.
   - Sort what is found: track files (.gpx, .tcx, .fit) go to the existing GPX import path, images
     (jpg, jpeg, png, heic if already supported, webp) go to the existing photo path. Ignore anything else
     silently, then show one line: "Found N outings and M photos".
   - Extend the existing photo-to-outing matching (EXIF date/GPS) so photos from the folder land on the
     right outing; if it already does this, just reuse it.

2. GARMIN FILES.
   - Garmin Connect exports .fit (original), .tcx and .gpx. Add parsing of .tcx (XML, Trackpoint
     LatitudeDegrees/LongitudeDegrees/AltitudeMeters/Time) and .fit (add the npm package
     "fit-file-parser", parse in the browser, records with position_lat/position_long/altitude/timestamp)
     into the SAME internal structure lib/gpx.ts already produces (points, distance, elevation gain, date,
     duration, sport if available). Add unit tests for the TCX parser with a tiny inline sample.
   - Use data_source "gpx_files" for these books (already in the MCP enum).

3. KOMOOT LINKS.
   - If the user pastes a Komoot link in the chat (komoot.com / komoot.de, tour link, short link
     komoot.de/..., or a public profile link), import it server-side in a new route app/api/komoot/route.ts:
     public API base https://api.komoot.de/v007, headers
     { "User-Agent": "AdvenBookAgent/1.0 (+https://agent.advenbook.com)", "Accept": "application/hal+json, application/json" }
     (the API answers 406 to Accept: application/json alone).
       - tour: GET /tours/{id}?_embedded=coordinates (add share_token=... from the link if present).
         Coordinates are in _embedded.coordinates.items [{lat,lng,alt,t}] (t = ms offset from start).
         name, date (ISO start), sport, distance (m), elevation_up (m), duration (s) are top-level fields.
       - photos: GET /tours/{id}/cover_images/?limit=100 (+share_token) -> _embedded.items[].src, a template
         "...?width={width}&height={height}&crop={crop}": replace with 1600 / 1600 / false; keep at most 20 per tour.
       - profile link komoot.com/user/{userId}: GET /users/{userId}/tours/?type=tour_recorded&status=public
         &sort_field=date&sort_direction=desc&limit=50&page=0 -> _embedded.tours[] (up to 4 pages), and show
         them as a checklist like Strava activities; import only the ticked ones.
       - private tour -> 401/403: tell the user in one line to make the tour public or use its share link,
         or to download the GPX from Komoot and drop it.
     Convert each tour to the same outing structure as a GPX file, then the normal flow continues
     (shortlist, questions, photos, cover, create_adventure_book with data_source "other").
     Rate limit: at most 5 Komoot requests per second, 200 per visitor per day, reuse lib/rate-limit.ts.

4. AGENT PROMPT (lib/agent.ts, system prompt): tell the agent it can work from Strava, Garmin files
   (.fit/.tcx/.gpx), Komoot links, or a dropped folder of tracks + photos, and to suggest those when the
   user has no Strava. Welcome message (all 6 languages in lib/i18n.ts / app/page.tsx): mention
   "Strava, Garmin, Komoot or a folder of GPX + photos". Also update README.md (one short section
   "Without Strava").

Never log or print any API key. Do not commit, do not push.
At the end run: npm install, npm test, npm run build, and report the results and the list of changed files.
