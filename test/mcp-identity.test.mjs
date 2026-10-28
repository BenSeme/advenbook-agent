// The MCP client must identify itself clearly so AdvenBook can count
// agent books: HTTP User-Agent "advenbook-agent/1.0" and MCP clientInfo
// name "advenbook-agent". Proven against a fake MCP server that captures
// what the real client (official SDK) actually sends.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const exec = promisify(execFile);
let server;
let tmp;
const seen = { userAgents: [], clientNames: [] };

function handler(req, res) {
  seen.userAgents.push(req.headers["user-agent"] ?? "");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let msg = {};
    try {
      msg = JSON.parse(body);
    } catch {
      // notifications may have no body we care about
    }
    if (msg.method === "initialize") {
      seen.clientNames.push(msg.params?.clientInfo?.name ?? "");
      res.setHeader("content-type", "application/json");
      return res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            protocolVersion: msg.params?.protocolVersion ?? "2025-03-26",
            capabilities: {},
            serverInfo: { name: "fake-advenbook", version: "1" },
          },
        }),
      );
    }
    if (msg.method === "tools/list") {
      res.setHeader("content-type", "application/json");
      return res.end(
        JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: [] } }),
      );
    }
    res.statusCode = 202;
    return res.end();
  });
}

before(async () => {
  tmp = mkdtempSync(join(process.cwd(), ".mcp-id-"));
  server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
});

after(() => {
  server?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test("MCP client sends advenbook-agent identity (UA + clientInfo)", async () => {
  const mcpUrl = pathToFileURL(join(process.cwd(), "lib", "mcp.ts")).href;
  const child = join(tmp, "child.mjs");
  writeFileSync(
    child,
    `import { listMcpTools } from ${JSON.stringify(mcpUrl)};\n` +
      `const tools = await listMcpTools();\n` +
      `console.log("TOOLS", tools.length);\n`,
  );
  const { stdout } = await exec(process.execPath, [child], {
    env: {
      ...process.env,
      ADVENBOOK_MCP_URL: `http://127.0.0.1:${server.address().port}/api/mcp`,
    },
  });
  assert.match(stdout, /TOOLS 0/);
  assert.ok(seen.userAgents.length > 0, "server saw requests");
  assert.ok(
    seen.userAgents.every((ua) => ua === "advenbook-agent/1.0"),
    `every request carries the agent UA, saw: ${JSON.stringify(seen.userAgents)}`,
  );
  assert.deepEqual(seen.clientNames, ["advenbook-agent"]);
});
