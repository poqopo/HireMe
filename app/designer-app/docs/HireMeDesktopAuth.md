# HireMe Desktop Authentication

## Identity Boundary

HireMe identity and the AI used for work are separate.

```text
Google account
  -> Supabase Auth
  -> auth.users.id
  -> HireMe UUID
  -> profiles.id

HireMe UUID
  -> Agents, conversations, memory, access, and runs
  -> required AI choice after the first login
```

Google email is not used as a primary key. AI accounts are not matched to
Google by email. The Supabase UUID is the only HireMe ownership key.

## Desktop Flow

1. Electron main process creates a Supabase client with PKCE enabled.
2. The renderer asks main process to start Google login through a narrow IPC
   method.
3. Main process opens the Supabase authorization URL in the system browser.
4. Supabase returns to `hireme://auth/callback?code=...`.
5. Electron receives the deep link and exchanges the one-time code for a
   session in main process.
6. The database trigger creates `profiles.id = auth.users.id`.
7. The renderer receives only safe profile data and the HireMe UUID.
8. A first-login dialog asks the user to choose `ChatGPT account` or `On this
   computer` without exposing the internal Provider concept.
9. Chat runs receive `--user-id <uuid>` and use UUID-specific runtime and AI
   credential directories.

The OAuth code and verifier must be exchanged on the same device. Access and
refresh tokens never cross the preload boundary.

## Local Session Storage

Supabase Auth uses a custom storage adapter backed by Electron `safeStorage`.
Each Supabase storage key is hashed into a filename and the value is encrypted
before it is written under the Electron user-data directory.

The renderer cannot read, write, list, or export these values. IPC exposes only:

- safe auth state
- start Google login
- local logout
- auth-state change events

AI settings use a separate narrow IPC surface for status, connect, cancel,
disconnect, and save. The renderer receives connection state and installed
Ollama model names, never OAuth tokens or local credential paths.

## AI Connection Flow

### ChatGPT account

The desktop main process locates the installed Codex executable and runs
`codex login` with a UUID-specific `CODEX_HOME`. After login, the same OAuth
identity is prepared for the native `gpt-image-2` bridge. Chat runs receive the
resolved Codex executable, `CODEX_HOME`, and image bridge environment only from
main process.

```text
<Electron userData>/providers/<HireMe UUID>/codex
  -> auth.json
  -> hireme-image-auth.json
```

### On this computer

The app checks only the loopback Ollama endpoint at `127.0.0.1:11434`, reads
installed models from `/api/tags`, and requires the user to choose an available
model. Local Ollama does not require an API key. Arbitrary renderer-provided
URLs are not accepted.

## Minimal Database

| Table | Responsibility |
| --- | --- |
| `profiles` | HireMe UUID, public profile, default AI preference, first setup flag |
| `agents` | Current public and creator-owned Agent record |
| `agent_versions` | Immutable package and manifest version metadata |
| `agent_access` | Trial, purchase, or subscription access |
| `conversations` | User-owned chat and optional Provider override |
| `messages` | Conversation messages and safe artifact metadata |
| `runs` | Trusted execution, usage, charge, and creator earning facts |

AI credentials are device-local. Private Agent packages remain behind the
protected runtime reference. Authenticated clients cannot insert billing runs;
only trusted backend execution may do that.

## Configuration

Required local secrets and public settings:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-anon-key>
HIREME_GOOGLE_CLIENT_ID=<google-web-client-id>
HIREME_GOOGLE_CLIENT_SECRET=<google-web-client-secret>
```

Google Cloud must authorize this callback:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Supabase Auth must allow these app redirects:

```text
hireme://auth/callback
hireme-dev://auth/callback
```

`app/supabase/config.toml` references the Google secret through environment
variables. `npm run desktop:config:required` packages only the Supabase URL and
publishable anon key.

## Verification

```bash
npm run desktop:auth:smoke
npm run desktop:ai:smoke
npm run deploy:check
supabase migration list
supabase inspect db table-stats --linked
```

The smoke tests verify encrypted storage, Google PKCE routing, automatic UUID
profile creation, first AI setup, UUID-isolated Codex OAuth, image auth handoff,
local Ollama routing, cancellation, untrusted billing-write refusal, cleanup,
and the seven-table schema.
