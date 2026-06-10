import { spawn } from "node:child_process";
import { once } from "node:events";

const child = spawn("node", ["plugins/hireme/mcp/server.mjs"], {
  stdio: ["pipe", "pipe", "inherit"],
});

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "hireme-plugin-smoke", version: "0.1.0" },
    },
  },
  {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "hireme_select_agent",
      arguments: { agent_id: "codex-builder" },
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "hireme_call_agent",
      arguments: {
        task: "Create a billing ledger schema",
        budget_calls: 3,
      },
    },
  },
];

let stdout = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});

for (const request of requests) {
  child.stdin.write(`${JSON.stringify(request)}\n`);
}
child.stdin.end();

const [exitCode] = await once(child, "exit");
if (exitCode !== 0) {
  throw new Error(`MCP server exited with code ${exitCode}`);
}

const responses = stdout
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const toolList = responses.find((response) => response.id === 2);
const callResult = responses.find((response) => response.id === 4);

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_call_agent")) {
  throw new Error("hireme_call_agent was not advertised by tools/list");
}

if (!callResult?.result?.content?.[0]?.text?.includes('"agent"')) {
  throw new Error("hireme_call_agent did not return the expected call result");
}

console.log("HireMe plugin MCP smoke test passed.");
