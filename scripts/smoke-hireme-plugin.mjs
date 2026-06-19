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
      name: "hireme_call_agent",
      arguments: {
        task: "안녕이라고 인사해줘",
        budget_calls: 1,
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 6,
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
    id: 7,
    method: "tools/call",
    params: {
      name: "hireme_request",
      arguments: {
        request: "launch-operator에게 제품 출시 페이지 방향을 잡아달라고 해",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "hireme_call_walrus_agent",
      arguments: {
        agent_id: "wal-test1",
        task: "Describe this Walrus Agent folder",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: {
      name: "hireme_read_memwal",
      arguments: {
        agent_id: "walrus-researcher",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "hireme_register_agent",
      arguments: {
        agent_id: "plugin-local-registrar",
        name: "Plugin Local Registrar",
        creator: "HireMe Smoke",
        category: "Code",
        headline: "Registers a protected Agent in local MCP fallback mode.",
        public_summary:
          "A plugin-only smoke registration that does not expose creator plaintext.",
        public_mcp_contract: "plugin_local_register(task)",
        skills: ["Registration", "Local fallback", "MCP metadata"],
        protected_asset_classes: ["AGENTS.md", "skills/**", "harness/**"],
        price_per_1m_tokens_sui: 5,
        walrus_blob_id: "walrus_plugin_local_registrar_ciphertext",
        sui_object_id:
          "0xcb8c3f72c5b1459b830f4efb7f8fa3451ac682a66d9848f71149af79aca721ab",
        ciphertext_digest:
          "sha256:8bf5774be175515698a2842fddc3fbda8176272ccbb03a341168fa998245c3af",
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      name: "hireme_whoami",
      arguments: {},
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
const greetingResult = responses.find((response) => response.id === 5);
const validateResult = responses.find((response) => response.id === 6);
const naturalResult = responses.find((response) => response.id === 7);
const walrusResult = responses.find((response) => response.id === 8);
const memwalResult = responses.find((response) => response.id === 9);
const registerResult = responses.find((response) => response.id === 10);
const whoamiResult = responses.find((response) => response.id === 11);

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_whoami")) {
  throw new Error("hireme_whoami was not advertised by tools/list");
}

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_call_agent")) {
  throw new Error("hireme_call_agent was not advertised by tools/list");
}

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_request")) {
  throw new Error("hireme_request was not advertised by tools/list");
}

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_list_my_agents")) {
  throw new Error("hireme_list_my_agents was not advertised by tools/list");
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

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_read_memwal")) {
  throw new Error("hireme_read_memwal was not advertised by tools/list");
}

if (!toolList?.result?.tools?.some((tool) => tool.name === "hireme_register_agent")) {
  throw new Error("hireme_register_agent was not advertised by tools/list");
}

if (
  !toolList?.result?.tools?.some(
    (tool) => tool.name === "hireme_update_agent_from_folder",
  )
) {
  throw new Error("hireme_update_agent_from_folder was not advertised by tools/list");
}

if (!callResult?.result?.content?.[0]?.text?.includes('"agent"')) {
  throw new Error("hireme_call_agent did not return the expected call result");
}

if (
  !callResult?.result?.content?.[0]?.text?.includes(
    '"schema": "hireme.protected_agent_json_output.v1"',
  )
) {
  throw new Error("hireme_call_agent did not return protected Agent JSON output");
}

if (
  !callResult?.result?.content?.[0]?.text?.includes(
    '"responseMode": "local_codex_execution_brief"',
  )
) {
  throw new Error("hireme_call_agent did not preserve the inferred response mode");
}

if (!callResult?.result?.content?.[0]?.text?.includes('"shouldAct": false')) {
  throw new Error("hireme_call_agent should expose Agent output without automatic local execution");
}

if (
  !greetingResult?.result?.content?.[0]?.text?.includes('"responseMode": "direct_answer"') ||
  !greetingResult?.result?.content?.[0]?.text?.includes('"shouldAct": false')
) {
  throw new Error("hireme_call_agent did not return the direct answer mode");
}

if (
  !validateResult?.result?.content?.[0]?.text?.includes('"status": "gateway_required"')
) {
  throw new Error("hireme_validate_sealed_harness did not preserve gateway-only decrypt boundary");
}

if (
  !naturalResult?.result?.content?.[0]?.text?.includes(
    '"inferredAgentId": "launch-operator"',
  )
) {
  throw new Error("hireme_request did not infer launch-operator");
}

if (
  !walrusResult?.result?.content?.[0]?.text?.includes(
    '"status": "gateway_required"',
  )
) {
  throw new Error("hireme_call_walrus_agent did not preserve gateway-only read boundary");
}

if (
  !memwalResult?.result?.content?.[0]?.text?.includes(
    '"status": "gateway_required"',
  )
) {
  throw new Error("hireme_read_memwal did not preserve gateway-only read boundary");
}

if (
  !registerResult?.result?.content?.[0]?.text?.includes(
    '"registrationMode": "mcp_local_fallback"',
  ) ||
  !registerResult?.result?.content?.[0]?.text?.includes('"display": "5 SUI/1M tokens"')
) {
  throw new Error("hireme_register_agent did not register through local fallback");
}

if (
  !whoamiResult?.result?.content?.[0]?.text?.includes(
    '"mode": "stdio_plugin_local"',
  ) ||
  !whoamiResult?.result?.content?.[0]?.text?.includes('"hirerId": "local-hirer"') ||
  !whoamiResult?.result?.content?.[0]?.text?.includes('"tokenReturned": false')
) {
  throw new Error("hireme_whoami did not return the local safe identity");
}

console.log("HireMe plugin MCP smoke test passed.");
