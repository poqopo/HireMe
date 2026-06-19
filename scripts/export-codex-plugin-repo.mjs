#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const targetRoot = path.resolve(
  repoRoot,
  args.find((arg) => !arg.startsWith("--")) || "../hireme-codex-plugin",
);
const gatewayUrl = readFlag("--gateway-url") || process.env.HIREME_MCP_GATEWAY_URL || "";
const repositoryUrl =
  readFlag("--repository-url") || "https://github.com/poqopo/hireme-codex-plugin";

const sourcePluginDir = path.join(repoRoot, "plugins", "hireme");
const targetPluginDir = path.join(targetRoot, "plugins", "hireme");
const targetMarketplaceDir = path.join(targetRoot, ".agents", "plugins");

await fs.mkdir(targetRoot, { recursive: true });
await fs.rm(targetPluginDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(targetPluginDir), { recursive: true });
await fs.cp(sourcePluginDir, targetPluginDir, {
  recursive: true,
  verbatimSymlinks: true,
});

await updatePluginManifest();
await updateMcpConfig();
await writeMarketplace();
await writeReadme();
await writeGitignore();

console.log(`Exported HireMe Codex plugin repo to ${targetRoot}`);
console.log("");
console.log("Next:");
console.log(`  cd ${targetRoot}`);
console.log("  git init");
console.log("  git add .");
console.log('  git commit -m "Initial HireMe Codex plugin bundle"');
console.log("  git remote add origin <plugin-repo-url>");
console.log("  git push -u origin main");

function readFlag(name) {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1] || "";
  return "";
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function updatePluginManifest() {
  const manifestPath = path.join(targetPluginDir, ".codex-plugin", "plugin.json");
  const manifest = await readJson(manifestPath);
  manifest.repository = repositoryUrl;
  manifest.homepage = "https://hireme.local";
  manifest.interface = {
    ...manifest.interface,
    websiteURL: "https://hireme.local",
    privacyPolicyURL: "https://hireme.local/privacy",
    termsOfServiceURL: "https://hireme.local/terms",
  };
  await writeJson(manifestPath, manifest);
}

async function updateMcpConfig() {
  if (!gatewayUrl) return;
  const mcpPath = path.join(targetPluginDir, ".mcp.json");
  const mcpConfig = await readJson(mcpPath);
  const server = mcpConfig.mcpServers?.["hireme-creator"];
  if (!server) {
    throw new Error("Expected mcpServers.hireme-creator in exported .mcp.json");
  }
  server.env = {
    ...(server.env || {}),
    HIREME_MCP_GATEWAY_URL: gatewayUrl.replace(/\/$/, ""),
    HIREME_MCP_GATEWAY_REQUIRED: "1",
    HIREME_MCP_GATEWAY_TIMEOUT_MS: "30000",
  };
  await writeJson(mcpPath, mcpConfig);
}

async function writeMarketplace() {
  const marketplace = {
    name: "hireme-creator",
    interface: {
      displayName: "HireMe Creator Plugin Marketplace",
    },
    plugins: [
      {
        name: "hireme-creator",
        source: {
          source: "local",
          path: "./plugins/hireme",
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Developer Tools",
      },
    ],
  };
  await writeJson(path.join(targetMarketplaceDir, "marketplace.json"), marketplace);
}

async function writeReadme() {
  const gatewayLine = gatewayUrl
    ? `This export pins \`HIREME_MCP_GATEWAY_URL=${gatewayUrl.replace(/\/$/, "")}\` in \`plugins/hireme/.mcp.json\`.`
    : "This export keeps the plugin's default Render gateway. For another deployment, re-export with `--gateway-url https://your-gateway.example`.";
  const readme = `# HireMe Creator Codex Plugin

This repository is the distribution bundle for the HireMe Creator Codex plugin. It intentionally contains only the Codex-installable creator plugin and marketplace metadata.

It does not contain the HireMe web app, gateway server, Supabase migrations, Walrus scripts, or example Agent Harness folders. Those stay in the main HireMe service repository.

${gatewayLine}

## Install From Codex

\`\`\`bash
codex plugin marketplace add poqopo/hireme-codex-plugin --ref main
codex plugin add hireme-creator --marketplace hireme-creator
\`\`\`

Then restart Codex and check:

\`\`\`bash
/plugins
/mcp
\`\`\`

## Update This Repo From The Main Repo

From the main HireMe service repo:

\`\`\`bash
npm run plugin:export -- ../hireme-codex-plugin --gateway-url https://hireme-gateway.onrender.com
\`\`\`

Then commit and push from this plugin repo.

## Layout

\`\`\`txt
.agents/plugins/marketplace.json
plugins/hireme/
  .codex-plugin/plugin.json
  .mcp.json
  mcp/server.mjs
  skills/hireme/SKILL.md
  assets/icon.svg
  assets/logo.svg
\`\`\`
`;
  await fs.writeFile(path.join(targetRoot, "README.md"), readme);
}

async function writeGitignore() {
  const gitignore = `.DS_Store
node_modules/
.env
.env.local
`;
  await fs.writeFile(path.join(targetRoot, ".gitignore"), gitignore);
}
