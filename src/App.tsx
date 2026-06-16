import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { getSession, isGoogleWallet } from "@mysten/enoki";
import {
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useWallets,
} from "@mysten/dapp-kit";
import {
  AlertTriangle,
  Bot,
  Braces,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LockKeyhole,
  LogIn,
  LogOut,
  PackageOpen,
  Search,
  ServerCog,
  Terminal,
  TrendingUp,
  UploadCloud,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { agents as fallbackAgents, categories } from "@/lib/agents";
import {
  loadMarketplaceAgents,
  type AgentDataSource,
} from "@/lib/agentRepository";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  createLocalSealedHarnessRecord,
  type SealedHarnessRecord,
} from "@/lib/sealWalrus";
import { isEnokiConfigured, suiNetwork } from "@/lib/sui";
import type { Agent, AgentTeam } from "@/types/agent";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const makeAgentSteps = [
  {
    icon: PackageOpen,
    title: "Install HireMe",
    copy: "Download the HireMe Codex plugin and connect it to your local Codex session.",
  },
  {
    icon: Terminal,
    title: "Ask for a template",
    copy: "Tell Codex: make me an example Agent template. It creates the starter folder for you.",
  },
  {
    icon: UploadCloud,
    title: "Build the Harness",
    copy: "Add AGENTS.md, skills, examples, prompts, rubrics, and any workflow rules that make it good.",
  },
  {
    icon: WalletCards,
    title: "Upload",
    copy: "Upload it to HireMe. We register the public card and keep the private Harness protected.",
  },
];

const creatorIpLayers = [
  {
    label: "What buyers can see",
    items: ["Name", "Skills", "Price", "Typical result", "Version notes"],
  },
  {
    label: "What buyers can't see",
    items: ["AGENTS.md", "Private prompts", "Rubrics", "Harness logic", "Updated versions"],
  },
];

const docsToc = [
  { id: "overview", label: "Overview" },
  { id: "problem", label: "Problem" },
  { id: "product", label: "Product model" },
  { id: "harness", label: "Agent Harness" },
  { id: "architecture", label: "Architecture" },
  { id: "privacy", label: "Privacy & IP" },
  { id: "roadmap", label: "Roadmap" },
];

const authStorageKey = "hireme-demo-auth-user";
const accessStorageKey = "hireme-demo-agent-access-v1";
const gatewayUrl = (
  import.meta.env.VITE_HIREME_GATEWAY_URL || "http://localhost:8787"
).replace(/\/$/, "");
const gatewayApiKey = import.meta.env.VITE_HIREME_GATEWAY_API_KEY || "";
const hiddenMarketplaceAgentIds = new Set(["codex-builder"]);
const hiddenMarketplaceAgentHandles = new Set(["@agents/codex-builder"]);
const topicFilters = categories.filter(
  (category): category is Agent["category"] => category !== "All",
);
const catalogViews = [
  { id: "teams", label: "Teams" },
  { id: "agents", label: "Agent" },
] as const;
const creatorModelOptions = [
  {
    id: "gpt-5.5",
    label: "GPT 5.5",
    description: "Highest quality for complex agent execution",
    basePricePerCallUsd: 0.015,
  },
  {
    id: "gpt-5.4",
    label: "GPT 5.4",
    description: "Balanced quality and cost",
    basePricePerCallUsd: 0.005,
  },
  {
    id: "gpt-5.3",
    label: "GPT 5.3",
    description: "Lower-cost execution for simpler agents",
    basePricePerCallUsd: 0.002,
  },
] as const;

type CatalogView = (typeof catalogViews)[number]["id"];
type CreatorModelId = (typeof creatorModelOptions)[number]["id"];

type AuthUser = {
  id?: string;
  displayName?: string;
  email: string;
  wallet: string;
  provider?: string;
};

type AgentAccessType = "trial" | "hired";

type AgentAccessRecord = {
  id: string;
  agentId: string;
  hirerId: string;
  status: "active" | "expired";
  accessType: AgentAccessType;
  receiptObjectId: string;
  trialCallsRemaining: number | null;
  pricePerCallUsd: number;
  ownerSuiAddress?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  source: "gateway" | "local";
  gatewayError?: string;
};

type GatewayPublicAgent = {
  id?: string;
  name?: string;
  handle?: string;
  creator?: string;
  category?: Agent["category"];
  status?: Agent["status"];
  headline?: string;
  publicSummary?: string;
  publicSkills?: string[];
  publicContract?: string;
  memwalPolicy?: string;
  hiddenAssetClasses?: string[];
  sealedHarness?: Agent["sealedHarness"];
  pricePerCallUsd?: number;
  freeCalls?: number;
  rating?: number;
  historicalCalls?: number;
  medianLatencyMs?: number;
};

type GatewayAccessPayload = Omit<Partial<AgentAccessRecord>, "source"> & {
  source?: string;
  storageSource?: string;
  agent?: GatewayPublicAgent;
};

function isMarketplaceAgentVisible(agent: Agent) {
  return (
    !hiddenMarketplaceAgentIds.has(agent.id) &&
    !hiddenMarketplaceAgentHandles.has(agent.handle) &&
    agent.name !== "Codex Builder"
  );
}

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(readStoredAuthUser);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const updateAuthUser = (user: AuthUser | null) => {
    setAuthUser(user);
    writeStoredAuthUser(user);
  };

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function applySession() {
      const { data } = await supabase!.auth.getSession();
      if (!data.session) return;
      const user = authUserFromSupabaseSession(data.session);
      await syncGatewayWebSession(data.session.access_token);
      if (!cancelled) {
        setAuthUser(user);
        writeStoredAuthUser(user);
      }
    }

    void applySession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthUser(null);
        writeStoredAuthUser(null);
        return;
      }
      const user = authUserFromSupabaseSession(session);
      setAuthUser(user);
      writeStoredAuthUser(user);
      void syncGatewayWebSession(session.access_token);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    await clearGatewayWebSession();
    updateAuthUser(null);
  }

  return (
    <BrowserRouter>
      <TopNav
        user={authUser}
        onLoginClick={() => setIsLoginOpen(true)}
        onLogout={() => {
          void logout();
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route
          path="/login"
          element={<LoginPage onLogin={updateAuthUser} />}
        />
        <Route
          path="/auth/callback"
          element={<AuthCallbackPage onLogin={updateAuthUser} />}
        />
        <Route path="/auth/enoki/callback" element={<EnokiCallbackPage />} />
        <Route
          path="/agents"
          element={
            <ExploreAgentsPage
              onRequireLogin={() => setIsLoginOpen(true)}
              user={authUser}
            />
          }
        />
        <Route
          path="/my"
          element={
            <MyAgentsPage
              onWalletLinked={(wallet) => {
                if (!authUser) return;
                updateAuthUser({ ...authUser, wallet });
              }}
              onRequireLogin={() => setIsLoginOpen(true)}
              user={authUser}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
      <LoginDialog
        onLogin={updateAuthUser}
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSignedIn={() => setIsLoginOpen(false)}
      />
      <ProfileNameDialog
        key={authUser?.id || "signed-out"}
        onSaved={(displayName) => {
          if (!authUser) return;
          updateAuthUser({ ...authUser, displayName });
        }}
        user={authUser}
      />
    </BrowserRouter>
  );
}

function readStoredAuthUser() {
  try {
    const raw = window.localStorage.getItem(authStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredAuthUser(user: AuthUser | null) {
  try {
    if (!user) {
      window.localStorage.removeItem(authStorageKey);
      return;
    }
    window.localStorage.setItem(authStorageKey, JSON.stringify(user));
  } catch {
    // Local demo auth can still work without storage.
  }
}

function authUserFromSupabaseSession(session: Session): AuthUser {
  const metadata = session.user.user_metadata || {};
  return {
    id: session.user.id,
    displayName: String(metadata.hireme_display_name || ""),
    email:
      session.user.email ||
      String(metadata.email || metadata.full_name || "unknown@hireme.local"),
    wallet: String(metadata.sui_address || metadata.wallet || ""),
    provider:
      session.user.app_metadata?.provider ||
      session.user.app_metadata?.providers?.[0] ||
      "supabase",
  };
}

async function syncGatewayWebSession(
  accessToken: string,
  suiAddress?: string,
  displayName?: string,
) {
  const response = await fetch(`${gatewayUrl}/oauth/web-session`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      access_token: accessToken,
      sui_address: suiAddress || undefined,
      display_name: displayName || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway web session failed: ${await response.text()}`);
  }
}

async function syncGatewaySuiWallet(suiAddress: string, displayName?: string) {
  if (!supabase) {
    throw new Error("Supabase Auth is not configured.");
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    throw new Error("Login before connecting a Sui wallet.");
  }
  await syncGatewayWebSession(data.session.access_token, suiAddress, displayName);
}

async function saveProfileDisplayName(displayName: string, suiAddress?: string) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }
  if (normalized.length > 40) {
    throw new Error("Name must be 40 characters or fewer.");
  }
  if (!supabase) return normalized;

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session) {
    throw new Error("Login before setting your name.");
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      hireme_display_name: normalized,
    },
  });
  if (error) throw error;

  await syncGatewayWebSession(
    session.access_token,
    suiAddress || String(session.user.user_metadata?.sui_address || ""),
    normalized,
  );
  return normalized;
}

async function clearGatewayWebSession() {
  try {
    await fetch(`${gatewayUrl}/oauth/web-session`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Supabase logout still clears the browser session.
  }
}

async function signInWithGoogle(returnTo?: string | null) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase Auth is not configured.");
  }
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  if (returnTo) {
    callbackUrl.searchParams.set("return_to", returnTo);
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error("Supabase did not return a Google login URL.");
  }
  window.location.assign(data.url);
}

type EnokiWallets = ReturnType<typeof useWallets>;
type ConnectWallet = ReturnType<typeof useConnectWallet>["mutateAsync"];

async function signInWithGoogleAndSui({
  connectWallet,
  returnTo,
  wallets,
}: {
  connectWallet: ConnectWallet;
  returnTo?: string | null;
  wallets: EnokiWallets;
}): Promise<AuthUser | null> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase Auth is not configured.");
  }

  if (!isEnokiConfigured) {
    await signInWithGoogle(returnTo);
    return null;
  }

  const googleWallet = wallets.find((wallet) => isGoogleWallet(wallet));
  if (!googleWallet) {
    throw new Error("Enoki Google wallet is not available.");
  }

  const connectResult = await connectWallet({ wallet: googleWallet });
  const account = connectResult.accounts[0];
  if (!account?.address) {
    throw new Error("No Sui address was returned from Enoki.");
  }

  const enokiSession = await getSession(googleWallet, { network: suiNetwork });
  if (!enokiSession?.jwt) {
    throw new Error("Enoki did not return a Google ID token.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: enokiSession.jwt,
  });
  if (error) throw error;

  const supabaseSession =
    data.session || (await supabase.auth.getSession()).data.session;
  if (!supabaseSession) {
    throw new Error("No Supabase session was returned.");
  }

  await supabase.auth.updateUser({
    data: {
      sui_address: account.address,
    },
  });

  await syncGatewayWebSession(
    supabaseSession.access_token,
    account.address,
    String(supabaseSession.user.user_metadata?.hireme_display_name || ""),
  );

  return {
    ...authUserFromSupabaseSession(supabaseSession),
    wallet: account.address,
  };
}

function safeReturnTo(value: string | null) {
  if (!value) return null;
  try {
    const target = new URL(value);
    const gateway = new URL(gatewayUrl);
    if (
      target.origin === gateway.origin &&
      target.pathname === "/oauth/authorize"
    ) {
      return target.toString();
    }
    if (target.origin === window.location.origin) {
      return target.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function hirerIdFor(user: AuthUser) {
  return normalizeHirerId(user.wallet || user.email || "local-hirer");
}

function normalizeHirerId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._@-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "local-hirer";
}

function gatewayRequestHeaders() {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (gatewayApiKey) {
    headers.authorization = `Bearer ${gatewayApiKey}`;
    headers["x-hireme-gateway-key"] = gatewayApiKey;
  }
  return headers;
}

function readAllAgentAccess() {
  try {
    const raw = window.localStorage.getItem(accessStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentAccessRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUserAgentAccess(user: AuthUser) {
  const hirerId = hirerIdFor(user);
  return readAllAgentAccess().filter((record) => record.hirerId === hirerId);
}

function writeUserAgentAccess(user: AuthUser, records: AgentAccessRecord[]) {
  try {
    const hirerId = hirerIdFor(user);
    const others = readAllAgentAccess().filter((record) => record.hirerId !== hirerId);
    window.localStorage.setItem(
      accessStorageKey,
      JSON.stringify([...others, ...records]),
    );
  } catch {
    // My Page can still show the in-memory state for this render.
  }
}

function upsertAccessRecord(
  records: AgentAccessRecord[],
  nextRecord: AgentAccessRecord,
) {
  const withoutCurrent = records.filter(
    (record) => record.agentId !== nextRecord.agentId,
  );
  return [nextRecord, ...withoutCurrent].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

async function createAgentAccessRecord({
  accessType,
  agent,
  user,
}: {
  accessType: AgentAccessType;
  agent: Agent;
  user: AuthUser;
}) {
  const hirerId = hirerIdFor(user);
  const payload = {
    agent_id: agent.id,
    hirer_id: hirerId,
    wallet_address: user.wallet,
    email: user.email,
    source: accessType === "trial" ? "web_try" : "web_hire",
  };
  const endpoint = accessType === "trial" ? "/v1/agents/try" : "/v1/agents/hire";

  try {
    const response = await fetch(`${gatewayUrl}${endpoint}`, {
      method: "POST",
      headers: gatewayRequestHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      return mapGatewayAccessRecord(result.access, agent, "gateway");
    }
    return createLocalAccessRecord({
      accessType,
      agent,
      hirerId,
      gatewayError: `Gateway ${response.status}: ${await response.text()}`,
    });
  } catch (error) {
    return createLocalAccessRecord({
      accessType,
      agent,
      hirerId,
      gatewayError:
        error instanceof Error ? error.message : "Gateway request failed",
    });
  }
}

async function loadGatewayMyAgentAccess(user: AuthUser) {
  const hirerId = hirerIdFor(user);
  const response = await fetch(`${gatewayUrl}/v1/my/agents`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      hirer_id: hirerId,
      wallet_address: user.wallet,
      email: user.email,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    agents?: GatewayAccessPayload[];
  };
  const agents: Agent[] = [];
  const records = (result.agents || []).map((item) => {
    const agent = mapGatewayPublicAgentToAgent(item.agent);
    agents.push(agent);
    return mapGatewayAccessRecord(item, agent, "gateway");
  });

  return { agents, records };
}

function mapGatewayAccessRecord(
  access: GatewayAccessPayload | undefined,
  agent: Agent,
  source: AgentAccessRecord["source"],
): AgentAccessRecord {
  const fallback = createLocalAccessRecord({
    accessType: access?.accessType || "trial",
    agent,
    hirerId: access?.hirerId || "local-hirer",
  });

  return {
    ...fallback,
    ...access,
    accessType: access?.accessType === "hired" ? "hired" : "trial",
    status: access?.status === "expired" ? "expired" : "active",
    receiptObjectId: access?.receiptObjectId || fallback.receiptObjectId,
    trialCallsRemaining:
      access?.trialCallsRemaining === undefined
        ? fallback.trialCallsRemaining
        : access.trialCallsRemaining,
    pricePerCallUsd: access?.pricePerCallUsd ?? agent.pricePerCallUsd,
    source,
  };
}

function mapGatewayPublicAgentToAgent(agent: GatewayPublicAgent | undefined): Agent {
  const id = agent?.id || "unknown-agent";
  const skills = agent?.publicSkills?.length ? agent.publicSkills : ["MCP"];
  const headline = agent?.headline || "Protected HireMe Agent.";
  const pricePerCallUsd = agent?.pricePerCallUsd ?? 0;
  const latencyMs = agent?.medianLatencyMs ?? 0;

  return {
    id,
    name: agent?.name || id,
    handle: agent?.handle || `@agents/${id}`,
    creator: agent?.creator || "Unknown creator",
    team: {
      id,
      name: `${agent?.name || id} Team`,
      handle: `@teams/${id}`,
      owner: agent?.creator || "Unknown owner",
      headline,
      publicSummary: agent?.publicSummary || headline,
      agentCount: 1,
      accent: "from-[#533afd] to-[#6ee7f9]",
      billing: {
        unit: "per_agent",
        basePriceUsd: pricePerCallUsd,
        includedCalls: agent?.freeCalls ?? 0,
        overagePricePerCallUsd: pricePerCallUsd,
        note: `${formatAgentPrice(pricePerCallUsd)} through the executing agent ledger.`,
      },
    },
    teamRole: "Specialist",
    listedIndividually: true,
    category: agent?.category || "Ops",
    status: agent?.status || "Available",
    headline,
    publicSummary: agent?.publicSummary || headline,
    publicContract: agent?.publicContract || "hireme_agent(task)",
    memwalPolicy: agent?.memwalPolicy || "Gateway-managed protected Agent.",
    skills,
    protectedAssets: agent?.hiddenAssetClasses || ["AGENTS.md", "skills/**"],
    sealedHarness:
      agent?.sealedHarness || {
        network: "walrus-testnet",
        sealPolicyId: `platform:agent:${id}`,
        walrusBlobId: `gateway-managed:${id}`,
        suiObjectId: "pending",
        ciphertextDigest: "registered-with-protected-artifacts",
        visibility:
          "Protected artifact details are resolved by the gateway at call time.",
      },
    pricePerCallUsd,
    freeCalls: agent?.freeCalls ?? 0,
    rating: agent?.rating ?? 0,
    calls: agent?.historicalCalls ?? 0,
    latencyMs,
    avgInputTokens: 800,
    avgOutputTokens: 700,
    resultPreview: {
      title: `${skills[0]} result`,
      summary: `Returns safe ${agent?.publicContract || "hireme_agent(task)"} output with gateway authorization metadata.`,
      sample: `${headline} Typical response includes action items, constraints, and verification notes.`,
    },
    mcpPackage: `mcp://hireme/${id}`,
    accent: "from-[#533afd] to-[#6ee7f9]",
  };
}

function mergeAgentCatalog(current: Agent[], incoming: Agent[]) {
  const byId = new Map(current.map((agent) => [agent.id, agent]));
  for (const agent of incoming) {
    byId.set(agent.id, { ...byId.get(agent.id), ...agent });
  }
  return [...byId.values()];
}

function createLocalAccessRecord({
  accessType,
  agent,
  gatewayError,
  hirerId,
}: {
  accessType: AgentAccessType;
  agent: Agent;
  gatewayError?: string;
  hirerId: string;
}): AgentAccessRecord {
  const now = new Date();
  return {
    id: `local_${accessType}_${agent.id}_${now.getTime().toString(36)}`,
    agentId: agent.id,
    hirerId,
    status: "active",
    accessType,
    receiptObjectId: `hire_receipt_${accessType}_${agent.id}_${hirerId}`,
    trialCallsRemaining: accessType === "trial" ? 3 : null,
    pricePerCallUsd: agent.pricePerCallUsd,
    ownerSuiAddress: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt:
      accessType === "trial"
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    source: "local",
    gatewayError,
  };
}

function TopNav({
  user,
  onLoginClick,
  onLogout,
}: {
  user: AuthUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/92 px-4 backdrop-blur md:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        <Link className="flex items-center gap-2" to="/">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#1c1e54] text-white">
            <Bot className="size-4" />
          </span>
          <span className="text-sm font-medium text-[#0d253d]">HireMe</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" type="button" variant="ghost">
              <Link to="/my">
                <UserRound /> My Agents
              </Link>
            </Button>
            <div className="hidden max-w-72 items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-[#273951] sm:flex">
              <UserRound className="size-3.5 text-primary" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-[#1c1e54]">
                  {displayNameFor(user)}
                </span>
                <span className="block truncate text-muted-foreground">
                  {user.email}
                  {user.wallet ? ` · ${shortAddress(user.wallet)}` : ""}
                </span>
              </span>
            </div>
            <Button onClick={onLogout} size="sm" type="button" variant="secondary">
              <LogOut /> Logout
            </Button>
          </div>
        ) : (
          <Button onClick={onLoginClick} size="sm" type="button">
            <LogIn /> Login
          </Button>
        )}
      </div>
    </header>
  );
}

function ConnectSuiButton({
  user,
  onWalletLinked,
  variant = "default",
}: {
  user: AuthUser | null;
  onWalletLinked: (wallet: string) => void;
  variant?: "default" | "secondary";
}) {
  const wallets = useWallets();
  const currentAccount = useCurrentAccount();
  const currentWallet = useCurrentWallet();
  const connectWallet = useConnectWallet();
  const [error, setError] = useState<string | null>(null);
  const googleWallet = wallets.find((wallet) => isGoogleWallet(wallet));
  const connectedWithGoogle =
    currentWallet.isConnected && isGoogleWallet(currentWallet.currentWallet);
  const linkedAddress =
    user?.wallet || (connectedWithGoogle ? currentAccount?.address : "");
  const isBusy = connectWallet.isPending;

  async function connectSui() {
    if (!user) return;
    setError(null);
    try {
      let address =
        connectedWithGoogle && currentAccount?.address
          ? currentAccount.address
          : "";
      if (!address) {
        if (!googleWallet) {
          throw new Error("Enoki Google wallet is not available.");
        }
        const result = await connectWallet.mutateAsync({ wallet: googleWallet });
        address = result.accounts[0]?.address || "";
      }
      if (!address) {
        throw new Error("No Sui address was returned from Enoki.");
      }
      await syncGatewaySuiWallet(address, user.displayName);
      onWalletLinked(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sui wallet connection failed.");
    }
  }

  return (
    <div className="relative">
      <Button
        disabled={!isEnokiConfigured || isBusy}
        onClick={() => {
          void connectSui();
        }}
        size="sm"
        title={error || undefined}
        type="button"
        variant={variant}
      >
        <WalletCards />
        {linkedAddress ? shortAddress(linkedAddress) : "Connect Sui"}
      </Button>
    </div>
  );
}

function ProfileNameDialog({
  user,
  onSaved,
}: {
  user: AuthUser | null;
  onSaved: (displayName: string) => void;
}) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const open = Boolean(user && !user.displayName);

  if (!open) return null;

  async function submitName() {
    setIsSubmitting(true);
    setError(null);
    try {
      const savedName = await saveProfileDisplayName(displayName, user?.wallet);
      onSaved(savedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d253d]/38 px-4 py-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 app-shadow">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <UserRound className="size-5" />
          </span>
          <div>
            <div className="text-sm font-medium text-[#1c1e54]">
              Set your HireMe name
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This is the name shown in HireMe and Codex account views.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="display-name">
            Name
          </label>
          <Input
            autoFocus
            className="mt-2"
            id="display-name"
            maxLength={40}
            onChange={(event) => setDisplayName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submitName();
              }
            }}
            placeholder="Han Labs"
            value={displayName}
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-sm text-[#9f1239]">
            {error}
          </div>
        ) : null}

        <Button
          className="mt-5 w-full"
          disabled={isSubmitting || displayName.trim().length < 2}
          onClick={() => {
            void submitName();
          }}
          type="button"
        >
          Save name
        </Button>
      </div>
    </div>
  );
}

function LoginDialog({
  onLogin,
  open,
  onClose,
  onSignedIn,
}: {
  onLogin: (user: AuthUser | null) => void;
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const wallets = useWallets();
  const connectWallet = useConnectWallet();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function submitGoogleLogin() {
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await signInWithGoogleAndSui({
        connectWallet: connectWallet.mutateAsync,
        wallets,
      });
      if (user) {
        onLogin(user);
        writeStoredAuthUser(user);
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d253d]/38 px-4 py-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 app-shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
              <UserRound className="size-4 text-primary" />
              Login
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in with Google. HireMe will also connect your Enoki
              zkLogin Sui address for this account.
            </p>
          </div>
          <Button onClick={onClose} size="icon" type="button" variant="ghost">
            <X />
          </Button>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-sm text-[#9f1239]">
            {error}
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={isSubmitting || !isSupabaseConfigured}
            onClick={() => {
              void submitGoogleLogin();
            }}
            type="button"
          >
            <LogIn /> Continue with Google
          </Button>
        </div>
        {!isSupabaseConfigured ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Supabase Auth is not configured in this environment.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: AuthUser | null) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("return_to"));
  const wallets = useWallets();
  const connectWallet = useConnectWallet();
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(
    Boolean(returnTo && supabase),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!returnTo || !supabase) {
      return;
    }

    const targetReturnTo = returnTo;
    let cancelled = false;
    async function resumeExistingSession() {
      const { data } = await supabase!.auth.getSession();
      if (!data.session) {
        if (!cancelled) setIsCheckingSession(false);
        return;
      }
      await syncGatewayWebSession(data.session.access_token);
      const user = authUserFromSupabaseSession(data.session);
      onLogin(user);
      writeStoredAuthUser(user);
      window.location.assign(targetReturnTo);
    }

    void resumeExistingSession().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not resume login.");
        setIsCheckingSession(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [onLogin, returnTo]);

  async function submitGoogleLogin() {
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await signInWithGoogleAndSui({
        connectWallet: connectWallet.mutateAsync,
        returnTo,
        wallets,
      });
      if (!user) return;
      onLogin(user);
      writeStoredAuthUser(user);
      if (returnTo) {
        window.location.assign(returnTo);
        return;
      }
      navigate("/my", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100svh-5rem)] items-center justify-center bg-secondary px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-border bg-white p-6 app-shadow">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
          <UserRound className="size-4 text-primary" />
          Login
        </div>
        <h1 className="mt-4 text-3xl font-light leading-tight text-[#0d253d]">
          Sign in to HireMe
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Codex uses this same web session. Google login also connects your
          Enoki zkLogin Sui address to the HireMe account.
        </p>
        {error ? (
          <div className="mt-5 rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-sm text-[#9f1239]">
            {error}
          </div>
        ) : null}
        <Button
          className="mt-6 w-full"
          disabled={isSubmitting || isCheckingSession || !isSupabaseConfigured}
          onClick={() => {
            void submitGoogleLogin();
          }}
          type="button"
        >
          <LogIn /> Continue with Google
        </Button>
        {!isSupabaseConfigured ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Supabase Auth is not configured in this environment.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function AuthCallbackPage({
  onLogin,
}: {
  onLogin: (user: AuthUser | null) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function completeLogin() {
      if (!supabase) {
        throw new Error("Supabase Auth is not configured.");
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        throw new Error("No Supabase session was returned.");
      }
      await syncGatewayWebSession(data.session.access_token);
      const user = authUserFromSupabaseSession(data.session);
      onLogin(user);
      writeStoredAuthUser(user);

      const params = new URLSearchParams(location.search);
      const returnTo = safeReturnTo(params.get("return_to"));
      if (returnTo) {
        window.location.assign(returnTo);
        return;
      }
      if (!cancelled) navigate("/my", { replace: true });
    }

    void completeLogin().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not complete login.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, onLogin]);

  return (
    <main className="flex min-h-[calc(100svh-5rem)] items-center justify-center bg-secondary px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-border bg-white p-6 app-shadow">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
          <UserRound className="size-4 text-primary" />
          Login
        </div>
        <h1 className="mt-4 text-3xl font-light leading-tight text-[#0d253d]">
          Connecting account
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Finalizing your HireMe web session for Codex.
        </p>
        {error ? (
          <div className="mt-5 rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-sm text-[#9f1239]">
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function EnokiCallbackPage() {
  return (
    <main className="flex min-h-[calc(100svh-5rem)] items-center justify-center bg-secondary px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-border bg-white p-6 app-shadow">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
          <WalletCards className="size-4 text-primary" />
          Enoki zkLogin
        </div>
        <h1 className="mt-4 text-3xl font-light leading-tight text-[#0d253d]">
          Connecting Sui address
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This popup will close after Enoki finishes the Google zkLogin flow.
        </p>
      </section>
    </main>
  );
}

function LandingPage() {
  return (
    <main>
      <section className="hero-visual relative overflow-hidden px-4 py-12 md:px-8 md:py-16 xl:py-20">
        <div className="mx-auto flex min-h-[calc(100svh-15rem)] max-w-7xl items-center">
          <div className="max-w-3xl py-10">
            <h1 className="balanced-text max-w-4xl text-5xl font-normal leading-[1.03] text-[#0d253d] md:text-6xl">
              Make your AI earn money!
            </h1>
            <p className="pretty-text mt-6 max-w-2xl text-base font-normal leading-7 text-[#20364f] md:text-lg">
              Turn your best AI Agent into a paid tool. Upload the private
              folder that makes it special, protect it on Walrus, set a per-call
              price, and let Codex users Try! or Hire! it without copying your
              prompts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/agents">
                  <Bot /> Explore Agents
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/docs">
                  <Braces /> View More
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <AgentPerformanceSection />
      <MakeAgentSection />
      <CreatorIpSection />
      <LandingFooter />
    </main>
  );
}

function AgentPerformanceSection() {
  return (
    <section id="agent-performance" className="bg-[#fbfdff] px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div>
          <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#15325c]">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">
              <TrendingUp className="size-5" />
            </span>
            Agent performance
          </div>
          <h2 className="balanced-text max-w-2xl text-3xl font-normal leading-tight text-[#0d253d] md:text-5xl">
            Same prompt. Better output.
          </h2>
          <p className="pretty-text mt-5 max-w-2xl text-base font-normal leading-7 text-[#324a63]">
            A Harness is the difference between a generic answer and a
            production-ready result. It carries taste, examples, rubrics,
            constraints, and repeatable workflow so the Agent knows what good
            looks like.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <HarnessImageCard
            caption="Same prompt without Harness"
            image="/assets/harness-before.svg"
            label="Before"
          />
          <HarnessImageCard
            caption="Same prompt with Harness"
            image="/assets/harness-after.svg"
            label="After"
          />
        </div>

        <div className="mt-6 rounded-xl border border-[#93b4ff]/40 bg-[#eef4ff] p-5">
          <div className="text-sm font-semibold text-[#15325c]">
            Why Harness matters
          </div>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[#273951] md:grid-cols-3">
            <div>It defines taste and quality standards before generation starts.</div>
            <div>It gives the Agent reusable examples, structure, and product rules.</div>
            <div>It makes the same prompt produce a result closer to shipping quality.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HarnessImageCard({
  caption,
  image,
  label,
}: {
  caption: string;
  image: string;
  label: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-white app-shadow">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <figcaption className="text-sm font-medium text-[#1c1e54]">
          {caption}
        </figcaption>
        <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-primary">
          {label}
        </span>
      </div>
      <img
        alt={caption}
        className="block aspect-[3/2] w-full object-cover"
        src={image}
      />
    </figure>
  );
}

function MakeAgentSection() {
  return (
    <section id="make-agent" className="bg-[#f8f5ff] px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
        <div>
          <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#2e2b8c]">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white text-[#533afd]">
              <UploadCloud className="size-5" />
            </span>
            How to create one
          </div>
          <h2 className="balanced-text text-3xl font-normal leading-tight text-[#171452] md:text-5xl">
            Make an Agent in four steps.
          </h2>
          <p className="pretty-text mt-5 max-w-2xl text-base font-normal leading-7 text-[#3f3b6f]">
            You do not need to start from a blank folder. Use Codex to scaffold
            the template, fill in the Harness, then upload it to HireMe.
          </p>
        </div>

        <div className="rounded-xl border border-[#d9d5ff] bg-white p-5 app-shadow">
          <div className="space-y-5">
            {makeAgentSteps.map((step) => (
              <div
                className="border-b border-border pb-5 last:border-b-0 last:pb-0"
                key={step.title}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#eeeaff] text-[#533afd]">
                    <step.icon className="size-5" />
                  </span>
                  <h3 className="text-xl font-normal text-[#171452]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#4e5d77]">
                  {step.copy}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[#533afd]/20 bg-[#f0edff] p-4 font-mono text-xs leading-6 text-[#171452]">
            <div>{">"} codex: HireMe 플러그인 설치</div>
            <div>{">"} codex: 예시 템플릿 생성해줘</div>
            <div>{">"} creator: Agent Harness 작성</div>
            <div>{">"} hireme: upload and publish</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorIpSection() {
  return (
    <section id="creator-ip" className="bg-[#15133f] px-4 py-14 text-white md:px-8 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <div>
          <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#d8ddff]">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/12 text-[#aebaff]">
              <LockKeyhole className="size-5" />
            </span>
            Creator IP
          </div>
          <h2 className="balanced-text max-w-xl text-3xl font-normal leading-tight md:text-5xl">
            Protect your Agent IP.
          </h2>
          <p className="pretty-text mt-5 max-w-2xl text-base font-normal leading-7 text-white/82">
            Your Agent Harness is the product: prompts, skills, rubrics,
            examples, and workflow taste. HireMe lets people pay to use it
            without copying it, and you can keep shipping updated versions as
            your Agent gets better.
          </p>
        </div>

        <div className="rounded-xl border border-white/15 bg-white/9 p-5 app-shadow">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <CreatorIpPanel layer={creatorIpLayers[0]} />
            <div className="flex items-center justify-center">
              <div className="rounded-full border border-[#8da2ff]/40 bg-[#8da2ff]/10 px-4 py-2 text-xs font-medium text-[#c6d4ff]">
                gateway boundary
              </div>
            </div>
            <CreatorIpPanel layer={creatorIpLayers[1]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorIpPanel({
  layer,
}: {
  layer: (typeof creatorIpLayers)[number];
}) {
  return (
    <div className="rounded-xl border border-white/12 bg-[#202052] p-4">
      <div className="mb-4 text-sm font-semibold text-[#d8ddff]">
        {layer.label}
      </div>
      <div className="space-y-2">
        {layer.items.map((item) => (
          <div
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/86"
            key={item}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#090d24] px-4 py-8 text-white md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="size-4 text-[#8da2ff]" />
            HireMe
          </div>
          <p className="mt-2 max-w-xl text-xs font-medium leading-5 text-white/70">
            Build protected Agent Harnesses, publish them as paid tools, and let
            Codex users hire them without copying your private IP.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-white/76">
          <Link className="hover:text-white" to="/agents">
            Explore agents
          </Link>
          <a className="hover:text-white" href="#make-agent">
            Make an Agent
          </a>
          <span className="text-white/40">Sui + Walrus MVP</span>
        </div>
      </div>
    </footer>
  );
}

function DocsPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <section className="border-b border-border bg-white px-4 py-12 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-[#2e2b8c]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#eeeaff] text-[#533afd]">
              <Braces className="size-5" />
            </span>
            HireMe Docs
          </div>
          <h1 className="balanced-text max-w-4xl text-4xl font-normal leading-tight text-[#0d253d] md:text-6xl">
            A whitepaper for paid AI Agents.
          </h1>
          <p className="pretty-text mt-5 max-w-3xl text-base font-normal leading-7 text-[#324a63] md:text-lg">
            HireMe is a marketplace and execution layer for protected Agent
            Harnesses. Creators package useful Agent behavior, buyers hire it
            from Codex, and the platform keeps IP, access, usage, and result
            memory organized.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-white p-4 lg:sticky lg:top-24">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
            Contents
          </div>
          <nav className="grid gap-1">
            {docsToc.map((item) => (
              <a
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#273951] hover:bg-secondary hover:text-primary"
                href={`#${item.id}`}
                key={item.id}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="rounded-xl border border-border bg-white px-5 py-6 app-shadow md:px-8 md:py-8">
          <DocsArticleSection
            id="overview"
            kicker="01 / Overview"
            title="HireMe turns Agent skill into a paid product."
          >
            <p>
              기존 AI 사용 경험은 대부분 “좋은 프롬프트를 가진 사람이 직접
              실행한다”에 머물러 있습니다. HireMe의 가정은 다릅니다. 좋은
              Agent는 단순 프롬프트가 아니라 반복 가능한 Harness, 예시, 규칙,
              평가 기준, tool routing, memory policy의 조합입니다.
            </p>
            <p>
              HireMe는 이 조합을 하나의 보호된 Agent 상품으로 등록하고, Codex
              사용자가 `Try!` 또는 `Hire!`로 호출할 수 있게 만드는 플랫폼입니다.
            </p>
          </DocsArticleSection>

          <DocsArticleSection
            id="problem"
            kicker="02 / Problem"
            title="Agent creators need a way to sell without leaking."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <DocsMiniBlock
                title="Creator IP"
                copy="AGENTS.md, prompts, skills, eval notes, examples가 노출되면 Agent의 핵심 가치가 복제됩니다."
              />
              <DocsMiniBlock
                title="Buyer trust"
                copy="고용주는 어떤 Agent가 빠르고 좋은지, 어떤 결과를 내는지 비교할 기준이 필요합니다."
              />
              <DocsMiniBlock
                title="Usage flow"
                copy="Try/Hire 권한, Codex 호출, 결과 기록, 과금 metadata가 하나의 흐름으로 이어져야 합니다."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="product"
            kicker="03 / Product model"
            title="Public card outside. Protected Harness inside."
          >
            <p>
              Marketplace에는 Agent 이름, 설명, 카테고리, skills, typical result,
              가격 같은 buyer-facing 정보만 노출됩니다. 실제로 성능 차이를
              만드는 Harness folder는 보호된 artifact로 저장됩니다.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsMiniBlock
                title="Try!"
                copy="고용 전 낮은 마찰로 Agent를 테스트하는 entry path입니다."
              />
              <DocsMiniBlock
                title="Hire!"
                copy="권한이 생기면 Codex MCP를 통해 Agent를 호출할 수 있습니다."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="harness"
            kicker="04 / Agent Harness"
            title="The Harness is the real product."
          >
            <p>
              Agent Harness는 `AGENTS.md`, `skills/**`, private prompts,
              examples, rubrics, design constraints, workflow rules로 구성됩니다.
              같은 모델과 같은 prompt라도 Harness가 있으면 결과의 구조와
              품질이 달라집니다.
            </p>
            <ol className="grid gap-3">
              {[
                "Codex에서 HireMe plugin을 설치합니다.",
                "예시 Agent template을 생성해달라고 요청합니다.",
                "Agent Harness에 private knowledge와 examples를 채웁니다.",
                "HireMe에 업로드하면 public card와 protected artifact가 등록됩니다.",
              ].map((step, index) => (
                <li className="flex gap-3 text-sm leading-6 text-[#273951]" key={step}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eeeaff] text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </DocsArticleSection>

          <DocsArticleSection
            id="architecture"
            kicker="05 / Technical architecture"
            title="Codex calls one MCP server. HireMe coordinates the rest."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DocsMiniBlock
                title="Web app"
                copy="Marketplace, login, Try/Hire, My Agents, creator registration flow를 제공합니다."
              />
              <DocsMiniBlock
                title="Gateway"
                copy="OAuth MCP, entitlement check, protected Agent execution, ledger metadata를 담당합니다."
              />
              <DocsMiniBlock
                title="Supabase"
                copy="Agent metadata, entitlements, OAuth sessions, memWal result records를 저장합니다."
              />
              <DocsMiniBlock
                title="Walrus"
                copy="보호된 Harness artifact와 result memory의 portable storage layer입니다."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="privacy"
            kicker="06 / Privacy & IP"
            title="The MVP boundary is platform-managed execution."
          >
            <p>
              현재 MVP는 gateway를 trusted execution boundary로 둡니다. 즉,
              플랫폼은 Agent folder를 복호화해 실행하지만, creator의 private
              source를 buyer에게 반환하지 않습니다. Buyer 결과는 hirer-scoped
              memWal record로 관리합니다.
            </p>
            <div className="rounded-xl border border-[#533afd]/20 bg-[#f8f5ff] p-4 text-sm leading-6 text-[#273951]">
              Long-term 방향은 더 강한 검증 가능성입니다. TEE, attestable runner,
              encrypted input 같은 옵션은 roadmap에 남겨두되, MVP는 가장 빠르게
              작동하는 gateway-based product loop를 우선합니다.
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="roadmap"
            kicker="07 / Roadmap"
            title="From local MVP to a durable Agent economy."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <DocsMiniBlock
                title="MVP"
                copy="Paid Agent cards, Try/Hire entitlement, OAuth MCP, protected Harness upload, gateway execution."
              />
              <DocsMiniBlock
                title="Next"
                copy="Creator dashboard, version updates, richer evaluation examples, memWal result browser."
              />
              <DocsMiniBlock
                title="Later"
                copy="On-chain settlement, stronger proof of execution, optional TEE runner, portable Agent teams."
              />
            </div>
          </DocsArticleSection>
        </article>
      </div>
    </main>
  );
}

function DocsArticleSection({
  children,
  id,
  kicker,
  title,
}: {
  children: ReactNode;
  id: string;
  kicker: string;
  title: string;
}) {
  return (
    <section className="scroll-mt-24 border-b border-border py-8 first:pt-0 last:border-b-0 last:pb-0" id={id}>
      <div className="mb-4 text-xs font-semibold uppercase text-primary">
        {kicker}
      </div>
      <h2 className="balanced-text max-w-3xl text-2xl font-normal leading-tight text-[#0d253d] md:text-4xl">
        {title}
      </h2>
      <div className="pretty-text mt-5 grid gap-4 text-sm leading-7 text-[#324a63] md:text-base">
        {children}
      </div>
    </section>
  );
}

function DocsMiniBlock({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="border-l border-[#533afd]/30 pl-4">
      <div className="text-sm font-semibold text-[#1c1e54]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[#4e5d77]">{copy}</p>
    </div>
  );
}

function ExploreAgentsPage({
  user,
  onRequireLogin,
}: {
  user: AuthUser | null;
  onRequireLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [catalogView, setCatalogView] = useState<CatalogView>("agents");
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<Agent["category"][]>(
    topicFilters,
  );
  const [marketplaceAgents, setMarketplaceAgents] =
    useState<Agent[]>(fallbackAgents);
  const [accessSnapshot, setAccessSnapshot] =
    useState<AgentAccessRecord[]>(readAllAgentAccess);
  const [dataSource, setDataSource] = useState<{
    source: AgentDataSource;
    message?: string;
  }>({ source: "mock", message: "Loading Supabase marketplace..." });

  useEffect(() => {
    let isCurrent = true;

    void loadMarketplaceAgents().then((result) => {
      if (!isCurrent) return;
      const nextAgents = result.agents.length ? result.agents : fallbackAgents;
      setMarketplaceAgents(nextAgents);
      setDataSource({ source: result.source, message: result.message });
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredAgents = useMemo(() => {
    return marketplaceAgents.filter((agent) => {
      if (!isMarketplaceAgentVisible(agent)) return false;
      if (!isPaidAgent(agent)) return false;
      const matchesTopic = selectedTopics.includes(agent.category);
      const text = `${agent.team.name} ${agent.team.handle} ${agent.team.owner} ${agent.team.publicSummary} ${agent.name} ${agent.handle} ${agent.headline} ${agent.publicSummary} ${agent.skills.join(" ")}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      return matchesTopic && matchesQuery;
    });
  }, [marketplaceAgents, query, selectedTopics]);
  const accessRecords = useMemo(
    () =>
      user
        ? accessSnapshot.filter((record) => record.hirerId === hirerIdFor(user))
        : [],
    [accessSnapshot, user],
  );

  const agentResults = filteredAgents;
  const teamResults = useMemo(() => {
    const byTeam = new Map<string, { team: AgentTeam; agents: Agent[] }>();

    for (const agent of filteredAgents) {
      const current = byTeam.get(agent.team.id);
      if (current) {
        current.agents.push(agent);
      } else {
        byTeam.set(agent.team.id, { team: agent.team, agents: [agent] });
      }
    }

    return Array.from(byTeam.values());
  }, [filteredAgents]);
  const resultCount =
    catalogView === "teams" ? teamResults.length : agentResults.length;

  function resetFilters() {
    setSelectedTopics(topicFilters);
  }

  async function updateAgentAccess(agent: Agent, accessType: AgentAccessType) {
    if (!user) {
      onRequireLogin();
      return;
    }

    const record = await createAgentAccessRecord({
      agent,
      user,
      accessType,
    });
    const nextRecords = upsertAccessRecord(readUserAgentAccess(user), record);
    writeUserAgentAccess(user, nextRecords);
    setAccessSnapshot(readAllAgentAccess());
  }

  function accessFor(agent: Agent) {
    return accessRecords.find(
      (record) => record.agentId === agent.id && record.status === "active",
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-xl border border-border bg-white p-4 app-shadow">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-full bg-white pl-10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search agents, skills, contracts, memory scopes"
                  value={query}
                />
              </div>
              <Button
                onClick={() => setIsCreatorModalOpen(true)}
                type="button"
              >
                <PackageOpen /> Create Agent
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-medium uppercase text-muted-foreground">
                  Type
                </span>
                {catalogViews.map((view) => {
                  const isSelected = catalogView === view.id;
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium leading-none transition ${
                        isSelected
                          ? "border-[#533afd] text-[#1c1e54] shadow-[inset_0_0_0_1px_rgba(83,58,253,0.22)]"
                          : "border-border text-[#273951] hover:border-[#533afd]/45 hover:bg-secondary"
                      }`}
                      key={view.id}
                      onClick={() => setCatalogView(view.id)}
                      type="button"
                    >
                      {view.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="mr-1 text-[11px] font-medium uppercase text-muted-foreground">
                  Category
                </span>
                {topicFilters.map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium leading-none transition ${
                        isSelected
                          ? "border-[#533afd] text-[#1c1e54] shadow-[inset_0_0_0_1px_rgba(83,58,253,0.22)]"
                          : "border-border text-[#273951] hover:border-[#533afd]/45 hover:bg-secondary"
                      }`}
                      key={topic}
                      onClick={() =>
                        setSelectedTopics(toggleFilter(selectedTopics, topic))
                      }
                      type="button"
                    >
                      {topic}
                    </button>
                  );
                })}
                <Button
                  className="h-7 px-2.5 text-[11px]"
                  onClick={resetFilters}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Reset
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-[#1c1e54]">
                {resultCount} {catalogView === "teams" ? "teams" : "agents"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-[#1c1e54]">
                {dataSource.source === "supabase"
                  ? "Supabase live"
                  : "Local demo data"}
              </span>
              {dataSource.message ? (
                <span className="leading-5 text-muted-foreground">
                  {dataSource.message}
                </span>
              ) : null}
            </div>
          </div>

          {catalogView === "teams" ? (
            teamResults.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {teamResults.map((result) => (
                  <TeamMarketCard
                    agents={result.agents}
                    key={result.team.id}
                    team={result.team}
                  />
                ))}
              </div>
            ) : (
              <EmptyResult label="No teams match the current filters." />
            )
          ) : agentResults.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agentResults.map((agent) => (
                <AgentMarketCard
                  access={accessFor(agent)}
                  agent={agent}
                  key={agent.id}
                  onHire={() => void updateAgentAccess(agent, "hired")}
                  onTry={() => void updateAgentAccess(agent, "trial")}
                />
              ))}
            </div>
          ) : (
            <EmptyResult label="No agents match the current filters." />
          )}
        </div>
      </section>

      <CreatorConsole
        onClose={() => setIsCreatorModalOpen(false)}
        open={isCreatorModalOpen}
        user={user}
      />
    </main>
  );
}

function MyAgentsPage({
  user,
  onRequireLogin,
  onWalletLinked,
}: {
  user: AuthUser | null;
  onRequireLogin: () => void;
  onWalletLinked: (wallet: string) => void;
}) {
  const [marketplaceAgents, setMarketplaceAgents] =
    useState<Agent[]>(fallbackAgents);
  const [accessRecords, setAccessRecords] = useState<AgentAccessRecord[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void loadMarketplaceAgents().then((result) => {
      if (!isCurrent) return;
      setMarketplaceAgents(result.agents.length ? result.agents : fallbackAgents);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    if (!user) return () => {
      isCurrent = false;
    };

    void loadGatewayMyAgentAccess(user)
      .then((result) => {
        if (!isCurrent) return;
        setAccessError(null);
        setAccessRecords(result.records);
        setMarketplaceAgents((current) =>
          mergeAgentCatalog(current, result.agents),
        );
      })
      .catch((error) => {
        if (!isCurrent) return;
        setAccessError(
          error instanceof Error ? error.message : "Gateway request failed",
        );
        setAccessRecords(readUserAgentAccess(user));
      });

    return () => {
      isCurrent = false;
    };
  }, [user]);

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f6f9fc] px-4 py-16 md:px-8">
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-6 app-shadow">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <UserRound className="size-5" />
            </span>
            <div>
              <h1 className="text-3xl font-light text-[#1c1e54]">
                My Agents
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Login to see which paid agents are ready to call from Codex.
              </p>
              <Button className="mt-5" onClick={onRequireLogin} type="button">
                <LogIn /> Login
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const hirerId = hirerIdFor(user);
  const activeRecords = accessRecords.filter(
    (record) => record.status === "active",
  );

  function resolveAgent(record: AgentAccessRecord) {
    return (
      marketplaceAgents.find((agent) => agent.id === record.agentId) ||
      fallbackAgents.find((agent) => agent.id === record.agentId)
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-light leading-tight text-[#1c1e54] md:text-5xl">
              My Agents
            </h1>
            <p className="mt-4 max-w-2xl text-base font-light leading-7 text-muted-foreground">
              Agents you tried or hired are tied to your hirer_id. The gateway
              checks this access record before running an MCP call.
            </p>
          </div>
          <div className="w-full max-w-xl rounded-xl border border-border bg-secondary p-4 text-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                <UserRound className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-light leading-tight text-[#1c1e54]">
                  {displayNameFor(user)}
                </h2>
                <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                  <div className="grid gap-2 sm:grid-cols-[88px_1fr]">
                    <span>Email</span>
                    <span className="truncate font-medium text-[#273951]">
                      {user.email}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[88px_1fr]">
                    <span>Sui Address</span>
                    {user.wallet ? (
                      <code className="truncate rounded-md bg-white px-2 py-1 text-[11px] text-[#1c1e54]">
                        {user.wallet}
                      </code>
                    ) : (
                      <ConnectSuiButton
                        onWalletLinked={onWalletLinked}
                        user={user}
                        variant="default"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          {accessError ? (
            <div className="mb-4 rounded-xl border border-[#ea2261]/20 bg-[#fff8fb] p-4 text-sm leading-6 text-[#9f1239]">
              Gateway my-agents read failed. Showing local fallback only.
              <div className="mt-1 font-mono text-xs">{accessError}</div>
            </div>
          ) : null}

          {activeRecords.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {activeRecords.map((record) => {
                const agent = resolveAgent(record);
                if (!agent) return null;
                const callSnippet = `hireme_call_agent({\n  "agent_id": "${agent.id}",\n  "task": "<your task>",\n  "hirer_id": "${hirerId}",\n  "hire_receipt_object_id": "${record.receiptObjectId}"\n})`;

                return (
                  <Card key={record.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-12">
                            <AvatarFallback
                              className={`bg-gradient-to-br ${agent.accent} text-white`}
                            >
                              {agent.name
                                .split(" ")
                                .map((word) => word[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-xl">
                              {agent.name}
                            </CardTitle>
                            <CardDescription>{agent.handle}</CardDescription>
                          </div>
                        </div>
                        <div className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-[#1c1e54]">
                          {record.accessType === "hired" ? "Hired" : "Trial"}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <p className="text-sm leading-6 text-[#273951]">
                        {agent.headline}
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <Metric
                          icon={CircleDollarSign}
                          label="Call"
                          value={formatAgentPrice(record.pricePerCallUsd)}
                        />
                        <Metric
                          icon={Clock3}
                          label="Access"
                          value={
                            record.accessType === "trial"
                              ? `${record.trialCallsRemaining ?? 0} left`
                              : "Active"
                          }
                        />
                        <Metric
                          icon={ServerCog}
                          label="Expires"
                          value={formatAccessDate(record.expiresAt)}
                        />
                      </div>

                      <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
                          <Terminal className="size-4 text-primary" />
                          Natural language
                        </div>
                        <div className="rounded-lg bg-white px-3 py-3 text-xs leading-5 text-[#1c1e54]">
                          HireMe MCP에서 {agent.id} agent를 호출해줘.
                          hirer_id는 {hirerId}로 써.
                        </div>
                        {record.source === "local" ? (
                          <div className="mb-3 rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-xs leading-5 text-[#9f1239]">
                            Local UI-only access. Start the gateway and press
                            Try! or Hire! again so Codex calls can be authorized.
                            {record.gatewayError ? (
                              <div className="mt-2 font-mono text-[11px] leading-4">
                                {record.gatewayError}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <details className="mt-4 rounded-lg border border-border bg-white">
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-[#1c1e54] [&::-webkit-details-marker]:hidden">
                            <Braces className="size-4 text-primary" />
                            Code
                          </summary>
                          <code className="block whitespace-pre-wrap break-all border-t border-border px-3 py-3 text-xs leading-5 text-[#1c1e54]">
                            {callSnippet}
                          </code>
                        </details>
                      </div>

                      <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-white px-3 py-2">
                          Receipt:{" "}
                          <span className="font-mono text-[#273951]">
                            {record.receiptObjectId}
                          </span>
                        </div>
                        <div className="rounded-lg border border-border bg-white px-3 py-2">
                          Source:{" "}
                          <span className="font-medium text-[#273951]">
                            {record.source === "gateway"
                              ? "Gateway"
                              : "Local demo"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white p-6 app-shadow">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-light text-[#1c1e54]">
                    No active agents yet
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Try or hire an agent from the marketplace. It will appear
                    here with the receipt and hirer_id Codex needs.
                  </p>
                </div>
                <Button asChild type="button">
                  <Link to="/agents">
                    <Bot /> Browse agents
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function EmptyResult({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground app-shadow">
      {label}
    </div>
  );
}

function TeamMarketCard({
  agents,
  team,
}: {
  agents: Agent[];
  team: AgentTeam;
}) {
  const categories = Array.from(new Set(agents.map((agent) => agent.category)));
  const totalRuns = agents.reduce((total, agent) => total + agent.calls, 0);
  const startingPrice = agents.length
    ? Math.min(...agents.map((agent) => agent.pricePerCallUsd))
    : 0;

  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-[rgba(0,55,112,0.08)_0_8px_24px]">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            <AvatarFallback className={`bg-gradient-to-br ${team.accent} text-white`}>
              {team.name
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{team.name}</CardTitle>
            <CardDescription>{team.handle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 text-xs leading-5 text-muted-foreground">
          {team.owner} · {categories.join(" / ")}
        </div>

        <p className="min-h-14 text-sm leading-relaxed text-[#273951]">
          {team.headline}
        </p>

        <div className="mt-4 rounded-lg border border-border bg-secondary p-3 text-xs leading-5 text-muted-foreground">
          {team.publicSummary}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric
            icon={BriefcaseBusiness}
            label="Agents"
            value={(agents.length || team.agentCount).toString()}
          />
          <Metric
            icon={CircleDollarSign}
            label="From"
            value={formatAgentPrice(startingPrice)}
          />
          <Metric icon={TrendingUp} label="Runs" value={formatRuns(totalRuns)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {agents.slice(0, 4).map((agent) => (
            <span
              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-[#273951]"
              key={agent.id}
            >
              {agent.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentMarketCard({
  access,
  agent,
  onHire,
  onTry,
}: {
  access?: AgentAccessRecord;
  agent: Agent;
  onHire: () => void;
  onTry: () => void;
}) {
  const isHired = access?.accessType === "hired";
  const isTrying = access?.accessType === "trial";
  const hasGatewayAccess = access?.source === "gateway";

  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-[rgba(0,55,112,0.08)_0_8px_24px]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback
                className={`bg-gradient-to-br ${agent.accent} text-white`}
              >
                {agent.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <CardDescription>{agent.handle}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 text-xs leading-5 text-muted-foreground">
          {agent.category} · {formatRuns(agent.calls)} runs
        </div>

        <p className="min-h-16 text-sm leading-relaxed text-[#273951]">
          {agent.headline}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">Builder: {agent.creator}</span>
          <span className="number-cell shrink-0">{agent.rating.toFixed(1)} rating</span>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-secondary p-3">
          <div className="text-xs font-medium text-[#1c1e54]">
            {agent.resultPreview.title}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {agent.resultPreview.summary}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5 text-sm">
          <Metric
            icon={CircleDollarSign}
            label="Call"
            value={formatAgentPrice(agent.pricePerCallUsd)}
          />
          <Metric
            icon={Clock3}
            label="Time"
            value={formatDuration(agent.latencyMs)}
          />
          <Metric
            icon={Braces}
            label="Tokens"
            value={formatTokens(totalAverageTokens(agent))}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            className="w-full"
            disabled={hasGatewayAccess && (isTrying || isHired)}
            onClick={onTry}
            type="button"
            variant="secondary"
          >
            <Terminal /> Try!
          </Button>
          <Button
            className="w-full"
            disabled={hasGatewayAccess && isHired}
            onClick={onHire}
            type="button"
          >
            <PackageOpen /> Hire!
          </Button>
        </div>
        {access ? (
          <div className="mt-3 rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>
                {access.source === "local"
                  ? "Saved locally. Start gateway and press again for Codex access."
                  : isHired
                    ? "Hired. Available from Codex through your hirer_id."
                    : `Trial ready. ${access.trialCallsRemaining ?? 0} calls left.`}
              </span>
              <Link className="shrink-0 font-medium text-primary" to="/my">
                My Agents
              </Link>
            </div>
            {access.source === "local" && access.gatewayError ? (
              <div className="mt-2 truncate font-mono text-[11px] text-[#9f1239]">
                {access.gatewayError}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="number-cell font-medium text-[#0d253d]">{value}</div>
    </div>
  );
}

function toggleFilter<T>(filters: T[], value: T) {
  return filters.includes(value)
    ? filters.filter((item) => item !== value)
    : [...filters, value];
}

function isPaidAgent(agent: Agent) {
  return (
    agent.pricePerCallUsd > 0 ||
    agent.team.billing.basePriceUsd > 0 ||
    agent.team.billing.overagePricePerCallUsd > 0
  );
}

function totalAverageTokens(agent: Agent) {
  return agent.avgInputTokens + agent.avgOutputTokens;
}

function formatTokens(tokens: number) {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}K`;
  }
  return tokens.toLocaleString();
}

function formatRuns(runs: number) {
  if (runs >= 1_000_000) return `${(runs / 1_000_000).toFixed(1)}M`;
  if (runs >= 1000) return `${(runs / 1000).toFixed(runs >= 10_000 ? 0 : 1)}K`;
  return runs.toLocaleString();
}

function formatDuration(ms: number) {
  if (!ms) return "N/A";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatAgentPrice(price: number) {
  return `$${price.toFixed(3)}/call`;
}

function formatAccessDate(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortAddress(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function displayNameFor(user: AuthUser) {
  return user.displayName?.trim() || "Set display name";
}

function slugifyAgentName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function CreatorConsole({
  onClose,
  open,
  user,
}: {
  onClose: () => void;
  open: boolean;
  user: AuthUser | null;
}) {
  const [draft, setDraft] = useState({
    agentName: "Private Code Reviewer",
    description: "Reviews pull requests and returns implementation risks, fixes, and verification steps.",
    modelId: "gpt-5.4" as CreatorModelId,
    creatorFeePerCallUsd: "0.005",
  });
  const [agentFiles, setAgentFiles] = useState<File[]>([]);
  const [exampleFiles, setExampleFiles] = useState<File[]>([]);
  const [sealedRecord, setSealedRecord] = useState<SealedHarnessRecord>();
  const [isSealing, setIsSealing] = useState(false);
  const selectedModel =
    creatorModelOptions.find((model) => model.id === draft.modelId) ??
    creatorModelOptions[1];
  const creatorFeePerCallUsd = Math.max(
    0,
    Number.parseFloat(draft.creatorFeePerCallUsd) || 0,
  );
  const totalPricePerCallUsd =
    selectedModel.basePricePerCallUsd + creatorFeePerCallUsd;
  const agentSlug = slugifyAgentName(draft.agentName) || "new-agent";
  const publicCapability = `${agentSlug}(task, context, budget_calls)`;
  const memWalScope = `agent:${agentSlug}`;

  async function sealHarness() {
    setIsSealing(true);
    try {
      const record = await createLocalSealedHarnessRecord({
        agentName: draft.agentName,
        description: draft.description,
        modelId: selectedModel.id,
        modelLabel: selectedModel.label,
        creatorAddress: user?.wallet || user?.email || "connected-creator",
        publicCapability,
        policyRule: `Caller must hold an active AgentHireReceipt. Results commit safe summaries and artifact digests to ${memWalScope}.`,
        basePricePerCallUsd: selectedModel.basePricePerCallUsd,
        creatorFeePerCallUsd,
        pricePerCallUsd: totalPricePerCallUsd,
        epochs: 3,
        files: [...agentFiles, ...exampleFiles],
      });
      setSealedRecord(record);
    } finally {
      setIsSealing(false);
    }
  }

  const updateDraft =
    (field: keyof typeof draft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0d253d]/38 px-4 py-6">
      <div className="mx-auto flex min-h-full max-w-3xl items-start justify-center">
        <div
          aria-modal="true"
          className="max-h-[calc(100svh-3rem)] w-full overflow-y-auto rounded-xl border border-border bg-white p-5 app-shadow"
          role="dialog"
        >
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
                <PackageOpen className="size-4 text-primary" />
                Create Agent
              </div>
              <h2 className="mt-3 text-3xl font-light leading-tight text-[#0d253d]">
                Create Agent
              </h2>
            </div>
            <Button onClick={onClose} size="icon" type="button" variant="ghost">
              <X />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Agent name">
              <Input value={draft.agentName} onChange={updateDraft("agentName")} />
            </Field>
            <Field label="Model">
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                onChange={updateDraft("modelId")}
                value={draft.modelId}
              >
                {creatorModelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                {selectedModel.description}
              </span>
            </Field>
            <Field className="md:col-span-2" label="Description">
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onChange={updateDraft("description")}
                placeholder="What does this Agent do?"
                value={draft.description}
              />
            </Field>
            <Field label="Base price">
              <div className="rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1c1e54]">
                {formatAgentPrice(selectedModel.basePricePerCallUsd)}
              </div>
            </Field>
            <Field label="Your fee">
              <Input
                min="0"
                step="0.001"
                type="number"
                value={draft.creatorFeePerCallUsd}
                onChange={updateDraft("creatorFeePerCallUsd")}
              />
            </Field>
            <div className="rounded-lg border border-[#533afd]/20 bg-secondary p-3 md:col-span-2">
              <div className="text-xs font-medium text-muted-foreground">
                Final call price
              </div>
              <div className="mt-1 number-cell text-2xl font-light text-[#1c1e54]">
                {formatAgentPrice(totalPricePerCallUsd)}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {formatAgentPrice(selectedModel.basePricePerCallUsd)} base +{" "}
                {formatAgentPrice(creatorFeePerCallUsd)} creator fee
              </div>
            </div>
            <Field label="Agent file">
              <input
                accept=".zip,.gz,.tgz,.tar.gz,application/zip,application/gzip"
                className="block w-full rounded-md border border-dashed border-input bg-white px-3 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                onChange={(event) =>
                  setAgentFiles(Array.from(event.target.files ?? []))
                }
                type="file"
              />
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                Upload a zipped or gzipped Agent Harness.
              </span>
            </Field>
            <Field label="Example output file">
              <input
                className="block w-full rounded-md border border-dashed border-input bg-white px-3 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                multiple
                onChange={(event) =>
                  setExampleFiles(Array.from(event.target.files ?? []))
                }
                type="file"
              />
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                Optional. Attach example deliverables such as HTML, Markdown,
                PDF, screenshots, or sample JSON.
              </span>
            </Field>
          </div>

          <div className="mt-6 flex justify-center">
            <Button disabled={isSealing} onClick={sealHarness} type="button">
              <UploadCloud /> {isSealing ? "Creating..." : "Create Agent"}
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <AlertTriangle className="size-4 shrink-0 text-[#ea2261]" />
            Local preview only; production encrypts this archive before Walrus upload.
          </div>

          {sealedRecord ? <SealedRecordPreview record={sealedRecord} /> : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SealedRecordPreview({ record }: { record: SealedHarnessRecord }) {
  const artifactName = `${record.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")}.seal.json`;
  const walrusCommand = `walrus store ${artifactName} --context testnet`;

  return (
    <div className="mt-5 rounded-xl border border-[#533afd]/20 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="size-4 text-primary" />
          Protected public record
        </div>
        <span className="text-xs text-muted-foreground">{record.network}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <RecordCell label="Model" value={record.modelLabel || "N/A"} />
        <RecordCell label="Call price" value={formatAgentPrice(record.pricePerCallUsd)} />
        <RecordCell label="Provider" value={record.sealProvider} />
        <RecordCell label="KMS key" value={record.platformKmsKeyId} />
        <RecordCell label="Policy" value={record.sealPolicyId} />
        <RecordCell label="Identity" value={record.encryptionId} />
        <RecordCell label="Walrus blob" value={record.walrusBlobId} />
        <RecordCell label="Sui object" value={record.suiObjectId} />
        <RecordCell label="Ciphertext" value={record.sealCiphertextFormat} />
        <RecordCell label="Digest" value={record.ciphertextDigest} />
      </div>

      <div className="mt-4 rounded-lg bg-secondary p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Local Walrus command
        </div>
        <code className="block break-all font-mono text-xs leading-5 text-[#1c1e54]">
          {walrusCommand}
        </code>
      </div>

      <div className="mt-3 rounded-lg bg-[#fff8fb] p-3">
        <div className="mb-1 text-xs font-medium text-[#9f1239]">
          Not returned to hirers
        </div>
        <p className="text-xs leading-5 text-[#573144]">
          {record.fileName}, plaintext AGENTS.md, creator skills, private plugin
          code, and backup decryption material stay outside hirer Codex.
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-white p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Folder entries protected in preview
        </div>
        <div className="flex flex-wrap gap-2">
          {record.entryPreview.map((entry) => (
            <span
              className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-[#273951]"
              key={entry}
            >
              {entry}
            </span>
          ))}
          {record.fileCount > record.entryPreview.length ? (
            <span className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-[#273951]">
              +{record.fileCount - record.entryPreview.length} more
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RecordCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-[#1c1e54]">{value}</div>
    </div>
  );
}

export default App;
