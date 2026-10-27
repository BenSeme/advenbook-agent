// AdvenBook public MCP server (AGENTS.md §3). Stateless, POST only, no API key.
// Tool definitions are fetched at runtime and passed to the model as-is.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FunctionTool } from "./models";

const MCP_URL =
  process.env.ADVENBOOK_MCP_URL ?? "https://www.advenbook.com/api/mcp";

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "advenbook-agent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

let toolCache: { at: number; tools: FunctionTool[] } | null = null;
const TOOL_CACHE_MS = 10 * 60 * 1000;

export async function listMcpTools(): Promise<FunctionTool[]> {
  if (toolCache && Date.now() - toolCache.at < TOOL_CACHE_MS) {
    return toolCache.tools;
  }
  const tools = await withClient(async (client) => {
    const { tools } = await client.listTools();
    return tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: (t.inputSchema ?? { type: "object", properties: {} }) as Record<
          string,
          unknown
        >,
      },
    }));
  });
  toolCache = { at: Date.now(), tools };
  return tools;
}

/** Executes one MCP tool and returns its parsed JSON payload (or raw text). */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withClient(async (client) => {
    const result = await client.callTool({ name, arguments: args });
    const structured = (result as { structuredContent?: unknown }).structuredContent;
    if (structured !== undefined) return structured;
    const content = (result as { content?: unknown }).content;
    if (Array.isArray(content)) {
      const texts = content
        .filter(
          (c): c is { type: string; text: string } =>
            typeof c === "object" && c !== null && "text" in c,
        )
        .map((c) => c.text);
      const joined = texts.join("\n").trim();
      try {
        return JSON.parse(joined) as unknown;
      } catch {
        return joined || result;
      }
    }
    return result;
  });
}
