// Proof for the shared budget/rate-limit layer: a fake Upstash/KV REST
// server + SEPARATE node processes (simulating separate server
// instances). Process B must see what process A counted — that is the
// exact property production needs, proven locally with no real store.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  signedVisitorValue,
  visitorIdFromCookieHeader,
  VISITOR_COOKIE,
} from "../lib/visitor.ts";
import { visitorDailyCap } from "../lib/budget.ts";

const exec = promisify(execFile);
const store = new Map();
let server;
let kvUrl;
let tmp;

function kvHandler(req, res) {
  const parts = decodeURIComponent(req.url).split("/").filter(Boolean);
  const [cmd, key, a, b] = parts;
  let result = null;
  if (cmd === "GET") result = store.get(key) ?? null;
  if (cmd === "INCR") result = (Number(store.get(key)) || 0) + 1;
  if (cmd === "INCRBY") result = (Number(store.get(key)) || 0) + Number(a);
  if (cmd === "SET") result = "OK";
  if (cmd === "EXPIRE") result = 1;
  if (cmd === "SET" || cmd === "INCR" || cmd === "INCRBY") {
    store.set(key, cmd === "SET" ? a : result);
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ result }));
}

async function runChild(code, extraEnv = {}) {
  const file = join(tmp, `child-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, code);
  const { stdout } = await exec(process.execPath, [file], {
    env: {
      ...process.env,
      KV_REST_API_URL: kvUrl,
      KV_REST_API_TOKEN: "test-token",
      DAILY_TOKEN_BUDGET: "1000",
      VISITOR_DAILY_TOKEN_BUDGET: "1000",
      ...extraEnv,
    },
  });
  return stdout.trim();
}

const budgetUrl = pathToFileURL(join(process.cwd(), "lib", "budget.ts")).href;
const rateUrl = pathToFileURL(join(process.cwd(), "lib", "rate-limit.ts")).href;

before(async () => {
  // Workspace-local temp: some sandboxes block the OS temp dir.
  tmp = mkdtempSync(join(process.cwd(), ".kv-proof-"));
  server = createServer(kvHandler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  kvUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test("visitor cookie is signed and tamper-proof", () => {
  const value = signedVisitorValue("visitor-123");
  assert.equal(
    visitorIdFromCookieHeader(`${VISITOR_COOKIE}=${value}`),
    "visitor-123",
  );
  assert.equal(
    visitorIdFromCookieHeader(`${VISITOR_COOKIE}=visitor-999.${value.split(".")[1]}`),
    null,
  );
  assert.equal(visitorIdFromCookieHeader(null), null);
  assert.equal(visitorIdFromCookieHeader("other=1"), null);
});

test("visitor caps: anonymous slice, trusted x5", () => {
  delete process.env.VISITOR_DAILY_TOKEN_BUDGET;
  assert.equal(visitorDailyCap(false), 250_000);
  assert.equal(visitorDailyCap(true), 1_250_000);
});

test("two instances share the global budget through KV", async () => {
  const a = await runChild(`
    import { addTokenUsage, withVisitorContext } from ${JSON.stringify(budgetUrl)};
    await withVisitorContext("visitor-1", async () => {
      addTokenUsage(700, 0);
      await new Promise((r) => setTimeout(r, 500));
    });
    console.log("A_DONE");
  `);
  assert.ok(a.includes("A_DONE"), a);
  const b = await runChild(`
    import { overDailyBudget, visitorTokensUsed, overVisitorBudget } from ${JSON.stringify(budgetUrl)};
    console.log(JSON.stringify({
      overGlobal: await overDailyBudget(),
      visitorUsed: await visitorTokensUsed("visitor-1"),
      visitorOver: await overVisitorBudget("visitor-1", false),
    }));
  `);
  const seen = JSON.parse(b);
  assert.equal(seen.overGlobal, false, "700 < 1000 global, not over yet");
  assert.equal(seen.visitorUsed, 700, "instance B sees A's visitor usage");
  assert.equal(seen.visitorOver, false);
  const c = await runChild(`
    import { addTokenUsage, overDailyBudget } from ${JSON.stringify(budgetUrl)};
    addTokenUsage(400, 0);
    await new Promise((r) => setTimeout(r, 500));
    console.log(await overDailyBudget());
  `);
  assert.ok(c.endsWith("true"), `700 + 400 >= 1000 shared global cap, got: ${c}`);
});

test("two instances share rate-limit counters through KV", async () => {
  const a = await runChild(`
    import { rateLimited } from ${JSON.stringify(rateUrl)};
    const out = [];
    for (let i = 0; i < 3; i++) out.push(await rateLimited("proof-key", 2, 60000));
    console.log(JSON.stringify(out));
  `);
  assert.equal(a, "[false,false,true]");
  const b = await runChild(`
    import { rateLimited } from ${JSON.stringify(rateUrl)};
    console.log(await rateLimited("proof-key", 2, 60000));
  `);
  assert.equal(b, "true", "instance B is limited by A's hits");
});
