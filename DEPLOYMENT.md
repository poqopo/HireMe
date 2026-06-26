# HireMe Deployment

HireMe is split into three deployable pieces.

1. `apps/web`: public React/Vite web app.
2. `apps/gateway`: private Node gateway for MCP calls, protected Agent execution, payment checks, and memWal/Walrus work.
3. `plugins/hireme`: Codex MCP plugin package that points to the gateway.

The web app can be deployed as static files. The gateway must be deployed as a separate server because it holds secrets and runs protected Agent logic.

## Recommended Layout

```txt
apps/web        public frontend
apps/gateway    private gateway service
plugins/hireme  Codex MCP plugin
scripts          local smoke/deploy helper scripts
supabase         database migrations
move             Sui Move package experiments
```

## Local Check

Run this before deploying:

```bash
npm install
npm run deploy:check
```

`deploy:check` builds the web app and checks the gateway and plugin entrypoints for syntax errors.

For local development:

```bash
npm run web:dev
npm run gateway:dev
```

Default local URLs:

```txt
web:     http://localhost:5173
gateway: http://localhost:8787
```

## Web Deployment

Use the repository root as the deploy root.

Build command:

```bash
npm run web:build
```

Output directory:

```txt
apps/web/dist
```

Vercel is configured with `vercel.json`:

```json
{
  "buildCommand": "npm run web:build",
  "outputDirectory": "apps/web/dist"
}
```

Netlify-style SPA routing is also covered by `apps/web/public/_redirects`.

### Web Environment Variables

Only put public browser-safe values in the web deploy.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_HIREME_GATEWAY_URL=https://your-gateway.example.com
VITE_ENOKI_PUBLIC_API_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_SUI_NETWORK=testnet
VITE_SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
VITE_HIREME_TYPICAL_OUTPUT_BUCKET=hireme-agent-media
```

Do not set `VITE_HIREME_GATEWAY_API_KEY` in production. Any `VITE_` value is shipped to the browser.

## Gateway Deployment

Deploy `apps/gateway` as a Node service. The service start command can be either:

```bash
npm run gateway:start
```

from the repository root, or:

```bash
npm run start
```

from `apps/gateway`.

The gateway should be deployed somewhere that supports a long-running Node HTTP service, for example Render, Fly.io, Railway, a VM, or a container platform.

### Render Blueprint

This repo includes `render.yaml` for the gateway. Render reads this file from the Git repository root and creates a Node web service named `hireme-gateway`.

Render settings:

```txt
runtime: node
buildCommand: npm install
startCommand: npm run gateway:start
healthCheckPath: /health
```

The gateway reads `PORT` when running on Render, with `HIREME_GATEWAY_PORT` still available for local override.

To deploy on Render:

1. Push the current repo changes to GitHub.
2. In Render, create a new Blueprint from `https://github.com/poqopo/HireMe`.
3. Review the `hireme-gateway` service created from `render.yaml`.
4. Fill every `sync: false` environment variable.
5. Deploy and check `https://<render-service>.onrender.com/health`.
6. Set Vercel `VITE_HIREME_GATEWAY_URL` to the Render URL and redeploy the web app.

### Gateway Environment Variables

Use server-only secrets here.

```bash
HIREME_GATEWAY_PORT=8787
HIREME_GATEWAY_API_KEY=
HIREME_OAUTH_TOKEN_TTL=2592000
HIREME_WEB_APP_URL=https://your-web.example.com

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

SUI_NETWORK=testnet
SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
HIREME_PLATFORM_TREASURY_SUI_ADDRESS=
HIREME_DEFAULT_CREATOR_SUI_ADDRESS=
HIREME_DEFAULT_HIRE_PRICE_SUI=0.05
HIREME_PLATFORM_FEE_BPS=0

WALRUS_NETWORK=testnet
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
WALRUS_UPLOAD_RELAY_URL=
WALRUS_UPLOAD_RELAY_TIP_MAX_MIST=1000
HIREME_WALRUS_REQUIRED=1
HIREME_WALRUS_PAYER_PRIVATE_KEY=
HIREME_WALRUS_DELETABLE=0
HIREME_WALRUS_READ_TIMEOUT_MS=30000
HIREME_ALLOW_LOCAL_WALRUS_FALLBACK=0

HIREME_PLATFORM_KMS_KEY=
HIREME_PLATFORM_KMS_KEY_ID=platform:production-key
HIREME_SEAL_PACKAGE_ID=
HIREME_SEAL_KEY_SERVER_IDS=

MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_PRIVATE_KEY=
MEMWAL_ACCOUNT_ID=
HIREME_MEMWAL_REMEMBER_ASYNC=0
HIREME_MEMWAL_REMEMBER_TIMEOUT_MS=75000
HIREME_SAVE_LOCAL_AGENT_RESULTS=0

HIREME_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=
OLLAMA_MODEL=gemma4:31b-cloud
HIREME_RESPONSE_MODE_CLASSIFIER=llm
HIREME_RESPONSE_MODE_CLASSIFIER_PROVIDER=ollama
HIREME_RESPONSE_MODE_CLASSIFIER_MODEL=gemma4:31b-cloud
HIREME_IMAGE_GENERATION_PROVIDER=openai
```

### Render Walrus SDK Payer Wallet

The gateway uploads Walrus blobs through the `@mysten/walrus` TypeScript SDK
and upload relay. Runtime reads use the Walrus HTTP aggregator to avoid opening
hundreds of storage-node requests during an Agent call. Render does not need the
`walrus` CLI, a Sui keystore file, or a Walrus client config file.

For a short-lived demo, create a disposable Sui testnet wallet, fund it with the
testnet SUI/WAL needed for storage, and set:

```bash
HIREME_WALRUS_PAYER_PRIVATE_KEY=suiprivkey...
WALRUS_NETWORK=testnet
SUI_NETWORK=testnet
SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
WALRUS_UPLOAD_RELAY_URL=https://upload-relay.testnet.walrus.space
WALRUS_UPLOAD_RELAY_TIP_MAX_MIST=1000
HIREME_WALRUS_REQUIRED=1
HIREME_WALRUS_READ_TIMEOUT_MS=30000
```

`HIREME_WALRUS_REQUIRED=1` makes failed Walrus uploads fail the Agent creation
request instead of silently falling back to local storage. Keep it enabled for a
demo where you need to prove Render is writing to Walrus.

Set `WALRUS_AGGREGATOR_URLS` to a comma-separated list if you want read
failover across multiple aggregators. `HIREME_WALRUS_SDK_READ_FALLBACK=1` can
re-enable SDK reads for local debugging, but it is intentionally off by default
because SDK reads create many network requests.

If `HIREME_GATEWAY_API_KEY` is set, MCP/plugin calls must send the same key. Keep that value out of the public web bundle.

## Codex Plugin Export

After the gateway has a public URL, export the Codex plugin with that URL pinned:

```bash
HIREME_MCP_GATEWAY_URL=https://your-gateway.example.com npm run plugin:export
```

The plugin should receive server/plugin environment values, not browser `VITE_` values:

```bash
HIREME_MCP_GATEWAY_URL=https://your-gateway.example.com
HIREME_GATEWAY_API_KEY=
HIREME_MCP_GATEWAY_REQUIRED=1
```

## Deployment Order

1. Push Supabase migrations and configure Auth/storage.
2. Deploy `apps/gateway` with server secrets.
3. Confirm `GET /health` on the gateway.
4. Deploy `apps/web` with `VITE_HIREME_GATEWAY_URL` pointing to the gateway.
5. Export and install the Codex plugin.
6. Run `npm run gateway:smoke` and `npm run plugin:smoke` against the deployed gateway when the production data is ready.

## Current Trust Boundary

The current MVP uses the HireMe gateway as the trusted executor. Buyers should not receive creator Harness files, and creators should not receive buyer raw inputs by default. The long-term roadmap is a more platform-free protocol where TEE, ICP/blockchain settlement, Seal, Walrus, and decentralized execution reduce the amount of trust placed in the platform.
