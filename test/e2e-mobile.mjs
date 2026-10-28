// Committed browser smoke test (mobile 360px). Requires a system
// Chrome/Edge and a running server (BASE_URL, default localhost:3100).
// Backend Strava/chat calls are fixture-intercepted at the network layer;
// engine-level behaviour is covered by API tests elsewhere.
//   npm run build && npm run start -- -p 3100 &  npm run test:e2e
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

const acts = Array.from({ length: 89 }, (_, i) => ({
  strava_activity_id: String(1000 + i),
  title: i % 5 === 4 ? `Echauffement ${i}` : `Sortie ${i}`,
  date: `2026-07-${String((i % 27) + 1).padStart(2, "0")}`,
  sport: "Run",
  distance_km: i % 5 === 4 ? 2 : 20,
  elevation_gain_m: 900,
  photos: i % 9,
  has_route: true,
  is_race: i % 7 === 0,
}));

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.endsWith("/api/strava/activities")) {
      return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ activities: acts }) });
    }
    if (url.endsWith("/api/chat")) {
      return req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Votre livre est prêt.",
          detectedLang: "fr",
          ui: [{
            kind: "book",
            bookId: "B1",
            claimUrl: "https://www.advenbook.com/fr/my-book/preview?bookId=B1&claim=X",
            editorUrl: "https://www.advenbook.com/fr/my-book/creer?bookId=B1",
            orderUrl: "https://www.advenbook.com/fr/my-book/order?bookId=B1",
            estimatedPages: 42,
            price: { eur: "45,00 €" },
          }],
          toolEvents: [],
        }),
      });
    }
    return req.continue();
  });
  await page.evaluateOnNewDocument(() => localStorage.setItem("ab-connection-id", "e2e"));
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });

  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const start = performance.now();
        const loop = () => {
          n++;
          if (performance.now() - start < 2000) requestAnimationFrame(loop);
          else res(Math.round(n / 2));
        };
        requestAnimationFrame(loop);
      }),
  );
  assert.ok(fps >= 30, `FPS too low: ${fps}`);

  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Continuer"))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("cochées sur 89"), { timeout: 15000 });
  const checked = await page.evaluate(
    () => [...document.querySelectorAll("main")].length >= 0 && document.body.innerText.match(/(\d+) cochées sur 89/)?.[1],
  );
  assert.ok(Number(checked) > 0, "some outings ticked by default");

  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /liste|list/i.test(b.innerText))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const boxes = await page.evaluate(() => document.querySelectorAll('.check input[type="checkbox"]').length);
  assert.equal(boxes, 89, "full list renders all outings");

  await page.type("form.composer input", "Crée mon livre");
  await page.click('form.composer button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.includes("Commander mon livre"), { timeout: 15000 });
  const bookLinks = await page.evaluate(() =>
    [...document.querySelectorAll(".card.book a.btn")].map((a) => ({
      text: a.innerText.trim(),
      href: a.href,
      target: a.target,
    })),
  );
  const open = bookLinks.find((l) => l.text.includes("Ouvrir mon livre"));
  const order = bookLinks.find((l) => l.text.includes("Commander mon livre"));
  assert.ok(open, "Open my book button present");
  assert.equal(open.href, "https://www.advenbook.com/fr/my-book/creer?bookId=B1");
  assert.ok(order, "Order my book button present next to Open my book");
  assert.equal(order.href, "https://www.advenbook.com/fr/my-book/order?bookId=B1");
  assert.equal(order.target, "_blank", "order opens in a new tab, agent page stays");
  console.log(`E2E OK — fps=${fps}, ticked=${checked}/89, checkboxes=${boxes}, orderBtn=${order.href}`);
} finally {
  await browser.close();
}
