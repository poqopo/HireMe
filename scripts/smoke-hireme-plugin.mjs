import { spawn } from "node:child_process";
import { once } from "node:events";

const child = spawn("node", ["plugins/hireme/mcp/server.mjs"], {
  env: {
    ...process.env,
    HIREME_MCP_GATEWAY_DISABLED: "1",
  },
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
  {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "hireme_validate_sealed_harness",
      arguments: {
        hire_receipt_object_id: "hire_receipt_local_paid_demo",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "hireme_request",
      arguments: {
        request:
          "example-landing-designer에게 핸드폰 상세 랜딩페이지 하나 만들어달라고 해",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "hireme_call_walrus_agent",
      arguments: {
        agent_id: "wal-test1",
        task: "Describe this Walrus Agent folder",
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
const validateResult = responses.find((response) => response.id === 5);
const naturalResult = responses.find((response) => response.id === 6);
const walrusResult = responses.find((response) => response.id === 7);

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_call_agent")) {
  throw new Error("hireme_call_agent was not advertised by tools/list");
}

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_request")) {
  throw new Error("hireme_request was not advertised by tools/list");
}

if (
  !toolList?.result?.tools?.some(
    (tool) => tool.name === "hireme_validate_sealed_harness",
  )
) {
  throw new Error("hireme_validate_sealed_harness was not advertised by tools/list");
}

if (
  !toolList?.result?.tools?.some(
    (tool) => tool.name === "hireme_call_walrus_agent",
  )
) {
  throw new Error("hireme_call_walrus_agent was not advertised by tools/list");
}

if (!callResult?.result?.content?.[0]?.text?.includes('"agent"')) {
  throw new Error("hireme_call_agent did not return the expected call result");
}

if (
  !validateResult?.result?.content?.[0]?.text?.includes('"status": "gateway_required"')
) {
  throw new Error("hireme_validate_sealed_harness did not preserve gateway-only decrypt boundary");
}

if (
  !naturalResult?.result?.content?.[0]?.text?.includes(
    '"inferredAgentId": "example-landing-designer"',
  )
) {
  throw new Error("hireme_request did not infer the landing designer");
}

if (
  !walrusResult?.result?.content?.[0]?.text?.includes(
    '"status": "gateway_required"',
  )
) {
  throw new Error("hireme_call_walrus_agent did not preserve gateway-only read boundary");
}

console.log("HireMe plugin MCP smoke test passed.");
