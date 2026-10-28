// Browser E2E for the production bug: after Strava connects, the user
// asks for a NEW book and clicks "Create directly". The agent must not
// ask continue-or-new again, must not call get_my_books again, and must
// create exactly one book with exactly the 80 ticked outings (not 182).
//   npm run build && npm run start -- -p 3100 &  npm run test:e2e:book-choice
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
if (!exe) {
  console.log("SKIP: no Chrome/Edge found (set CHROME_PATH).");
  process.exit(0);
}
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";

const acts = Array.from({ length: 182 }, (_, i) => ({
  strava_activity_id: String(2000 + i),
  title: `Sortie ${i}`,
  date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
  sport: "Ride",
  distance_km: 40,
  elevation_gain_m: 800,
  photos: 0,
  has_route: true,
  is_race: false,
}));

const createPayloads = [];
let chatCalls = 0;
let stravaCalls = 0;

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.endsWith("/api/strava/activities")) {
      stravaCalls++;
      return req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          activities: acts,
          books: [{
            book_id: "BK-OLD",
            title: "Été 2025",
            status: "draft",
            activities: 12,
            editorUrl: "https://www.advenbook.com/fr/my-book/creer?bookId=BK-OLD",
            orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=BK-OLD",
          }],
        }),
      });
    }
    if (url.endsWith("/api/books/create")) {
      const sent = JSON.parse(req.postData() || "{}");
      createPayloads.push(sent);
      return req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Votre livre est prêt.",
          books: [{
            kind: "book",
            bookId: "BK80",
            title: "Nouveau livre",
            claimUrl: "https://www.advenbook.com/fr/my-book/preview?bookId=BK80&claim=X",
            editorUrl: "https://www.advenbook.com/fr/my-book/creer?bookId=BK80",
            orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=BK80",
            estimatedPages: 120,
            price: { eur: "85,00 €" },
          }],
        }),
      });
    }
    if (url.endsWith("/api/chat")) {
      chatCalls++;
      return req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "OK", ui: [], toolEvents: [] }),
      });
    }
    return req.continue();
  });
  await page.evaluateOnNewDocument(() => localStorage.setItem("ab-connection-id", "e2e-conn"));
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });

  // Connect step (mechanical resume button).
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /continuer|continue/i.test(b.innerText))?.click();
  });
  // Continue-or-new card appears exactly once, with the existing book.
  await page.waitForFunction(
    () => document.body.innerText.includes("Été 2025"),
    { timeout: 15000 },
  );
  // Choose NEW.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /nouveau livre|new book/i.test(b.innerText))?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  // Card is gone and stays gone; no chat turn was needed to record it.
  const cardAfterChoice = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => /nouveau livre|continuer ce livre/i.test(b.innerText)).length,
  );
  assert.equal(cardAfterChoice, 0, "continue-or-new card must disappear once new is chosen");
  assert.equal(chatCalls, 0, "choosing new must not trigger a model turn");

  // Open the checklist, tick exactly 80 of 182.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /liste|list/i.test(b.innerText))?.click();
  });
  await page.waitForFunction(() => document.querySelectorAll('.check input[type="checkbox"]').length === 182, { timeout: 15000 });
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.check input[type="checkbox"]')];
    boxes.forEach((box, i) => {
      const want = i < 80;
      if (box.checked !== want) box.click();
    });
  });
  await page.waitForFunction(
    () => /80 coch/.test(document.body.innerText) || /80 ticked/.test(document.body.innerText),
    { timeout: 15000 },
  );

  // Create directly.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /créer maintenant|create now/i.test(b.innerText))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("Ouvrir mon livre") || document.body.innerText.includes("Open my book"), { timeout: 15000 });

  assert.equal(createPayloads.length, 1, "exactly one direct-create call");
  assert.equal(createPayloads[0].activities.length, 80, "created with exactly the 80 ticked outings, not 182");
  assert.deepEqual(
    createPayloads[0].activities.map((a) => a.strava_activity_id),
    acts.slice(0, 80).map((a) => a.strava_activity_id),
  );
  assert.equal(createPayloads[0].bookChoice.kind, "new");
  assert.equal(chatCalls, 0, "Create directly must not ask the model");

  const links = await page.evaluate(() =>
    [...document.querySelectorAll(".card.book a.btn")].map((a) => ({ text: a.innerText.trim(), href: a.href })),
  );
  const open = links.find((l) => /ouvrir|open/i.test(l.text));
  const order = links.find((l) => /commander|order/i.test(l.text));
  assert.ok(open, "Open my book button present");
  assert.equal(open.href, "https://www.advenbook.com/fr/my-book/creer?bookId=BK80");
  assert.ok(order, "Order my book button present");
  assert.equal(order.href, "https://www.advenbook.com/fr/my-book/order?bookId=BK80");

  // A later turn must not resurrect the choice card.
  await page.type("form.composer input", "Merci");
  await page.click('form.composer button[type="submit"]');
  await new Promise((r) => setTimeout(r, 800));
  const cardLater = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => /nouveau livre|continuer ce livre/i.test(b.innerText)).length,
  );
  assert.equal(cardLater, 0, "continue-or-new card must never reappear");

  console.log(`E2E book-choice OK — stravaCalls=${stravaCalls}, createPayloads=${createPayloads.length}, activities=${createPayloads[0].activities.length}, open=${open.href}, order=${order.href}`);
} finally {
  await browser.close();
}
