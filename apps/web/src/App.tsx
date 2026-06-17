import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
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
  useParams,
} from "react-router-dom";
import { isGoogleWallet } from "@mysten/enoki";
import {
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useSignAndExecuteTransaction,
  useWallets,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
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
  Star,
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
import type { SealedHarnessRecord } from "@/lib/sealWalrus";
import { isEnokiConfigured } from "@/lib/sui";
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
  { id: "meet", label: "Meet HireMe" },
  { id: "why", label: "Why It Matters" },
  {
    id: "features",
    label: "Features",
    children: [
      { id: "feature-harness", label: "Protected Harness" },
      { id: "feature-mcp", label: "MCP-native hiring" },
      { id: "feature-memory", label: "Shared memory" },
      { id: "feature-payouts", label: "Creator payouts" },
    ],
  },
  { id: "hire", label: "How to Hire" },
  { id: "publish", label: "How to Publish" },
  { id: "paid", label: "How to Get Paid" },
  { id: "roadmap", label: "Roadmap" },
] as const;

const authStorageKey = "hireme-demo-auth-user";
const accessStorageKey = "hireme-demo-agent-access-v1";
const createdAgentsStorageKey = "hireme-demo-created-agents-v1";
const typicalOutputStorageBucket =
  import.meta.env.VITE_HIREME_TYPICAL_OUTPUT_BUCKET || "hireme-agent-media";
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
    basePricePerCallUsd: 15,
  },
  {
    id: "gpt-5.4",
    label: "GPT 5.4",
    description: "Balanced quality and cost",
    basePricePerCallUsd: 5,
  },
  {
    id: "gpt-5.3",
    label: "GPT 5.3",
    description: "Lower-cost execution for simpler agents",
    basePricePerCallUsd: 2,
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
  paymentIntentId?: string | null;
  paymentTxDigest?: string | null;
  paymentAmountMist?: string | null;
  paymentAmountSui?: string | null;
  paymentCurrency?: string | null;
  paymentNetwork?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  source: "gateway" | "local";
  gatewayError?: string;
};

type CreatedAgentRecord = {
  id: string;
  creatorId: string;
  creatorEmail: string;
  agentName: string;
  agentSlug: string;
  headline?: string;
  description: string;
  howToUse?: string;
  typicalOutputTitle?: string;
  typicalOutputSummary?: string;
  typicalOutputSample?: string;
  typicalOutputMediaUrl?: string;
  typicalOutputMediaPath?: string;
  typicalOutputMediaType?: "image" | "video";
  avgLatencyMs?: number;
  avgTokenCount?: number;
  activeUsers?: number;
  modelId?: string;
  modelLabel?: string;
  pricePerCallUsd: number;
  basePricePerCallUsd?: number;
  creatorFeePerCallUsd?: number;
  walrusBlobId: string;
  suiObjectId: string;
  ciphertextDigest: string;
  fileCount: number;
  createdAt: string;
  status: "Local Draft" | "Published";
  source: "local" | "gateway";
  gatewayError?: string;
};

type GatewayAgentRegistrationResult = {
  status?: string;
  registeredAt?: string;
  publicAgent?: GatewayPublicAgent;
  protectedArtifact?: {
    network?: "walrus-testnet" | "walrus-mainnet";
    encryptionProvider?: string;
    platformKmsKeyId?: string;
    ciphertextFormat?: string;
    sealPolicyId?: string;
    sealEncryptionId?: string;
    sealThreshold?: number | null;
    sealKeyServerIds?: string[];
    walrusBlobId?: string;
    suiObjectId?: string;
    ciphertextDigest?: string;
    folderManifestDigest?: string;
  };
  upload?: {
    storageProvider?: string;
    ciphertextSizeBytes?: number;
    plaintextArchiveSizeBytes?: number;
    entryPreview?: string[];
    entryCount?: number;
    folderManifestDigest?: string;
    walrusStoreError?: string | null;
  };
  supabase?: {
    status?: string;
    reason?: string;
    error?: string;
  };
};

type MyPageTab = "registered" | "hired" | "activity";

type MyActivityItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  timestamp: string;
  tone: "registered" | "hired" | "trial" | "result" | "payment" | "failed";
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
  pricePer1MTokensSui?: number;
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

type GatewayMemWalResultPayload = {
  id?: string;
  callId?: string;
  agentId?: string;
  hirerId?: string;
  createdAt?: string;
  visibility?: string;
  requestDigest?: string;
  responseDigest?: string;
  ciphertextDigest?: string;
  ciphertextFormat?: string;
  encryptionProvider?: string;
  recordPath?: string;
  safeSummary?: {
    type?: string;
    resultKeys?: string[];
    jsonOutputSchema?: string | null;
    rawResultReturnedInRecord?: boolean;
  };
};

type GatewaySuiPaymentActivityPayload = {
  verificationId?: string;
  intentId?: string;
  agentId?: string;
  hirerId?: string;
  txDigest?: string;
  status?: "verified" | "failed" | "skipped" | string;
  verificationMode?: string;
  network?: string;
  expectedAmountMist?: string;
  expectedAmountSui?: string;
  observedRecipientAmountMist?: string | null;
  observedRecipientAmountSui?: string | null;
  effectStatus?: string | null;
  failureReason?: string | null;
  createdAt?: string;
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
      await syncGatewayWebSession(
        data.session.access_token,
        user.wallet,
        user.displayName,
      );
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
      void syncGatewayWebSession(
        session.access_token,
        user.wallet,
        user.displayName,
      );
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
        onLogout={() => {
          void logout();
        }}
        user={authUser}
        onLoginClick={() => setIsLoginOpen(true)}
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
          path="/agents/create"
          element={<CreateAgentPage user={authUser} />}
        />
        <Route
          path="/agents/:agentId"
          element={
            <AgentDetailPage
              onRequireLogin={() => setIsLoginOpen(true)}
              user={authUser}
            />
          }
        />
        <Route
          path="/my"
          element={
            <MyAgentsPage
              onLogout={() => {
                void logout();
              }}
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
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
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
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      sui_address: suiAddress,
    },
  });
  if (updateError) throw updateError;
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
type SignAndExecuteTransaction = ReturnType<
  typeof useSignAndExecuteTransaction
>["mutateAsync"];

async function connectEnokiGoogleAddress({
  connectWallet,
  wallets,
}: {
  connectWallet: ConnectWallet;
  wallets: EnokiWallets;
}) {
  if (!isEnokiConfigured) {
    throw new Error("Enoki is not configured.");
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
  return account.address;
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

function creatorIdFor(user: AuthUser) {
  return normalizeHirerId(user.wallet || user.email || user.displayName || "local-creator");
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

function gatewayAuthHeaders() {
  const headers: Record<string, string> = {};
  if (gatewayApiKey) {
    headers.authorization = `Bearer ${gatewayApiKey}`;
    headers["x-hireme-gateway-key"] = gatewayApiKey;
  }
  return headers;
}

async function createAgentWithGatewayUpload({
  draft,
  agentSlug,
  selectedModel,
  creatorFeePerCallUsd,
  totalPricePerCallUsd,
  publicCapability,
  typicalOutputUpload,
  harnessFile,
  user,
}: {
  draft: {
    agentName: string;
    headline: string;
    description: string;
    howToUse: string;
    typicalOutputTitle: string;
    typicalOutputSummary: string;
    typicalOutputSample: string;
  };
  agentSlug: string;
  selectedModel: (typeof creatorModelOptions)[number];
  creatorFeePerCallUsd: number;
  totalPricePerCallUsd: number;
  publicCapability: string;
  typicalOutputUpload: {
    path: string;
    type: "image" | "video";
    url: string;
  } | null;
  harnessFile: File;
  user: AuthUser | null;
}): Promise<GatewayAgentRegistrationResult> {
  const creator =
    user?.displayName || user?.email || user?.wallet || "Web creator";
  const metadata = {
    agent_id: agentSlug,
    name: draft.agentName,
    handle: `@agents/${agentSlug}`,
    creator,
    category: "Code",
    status: "Available",
    headline: draft.headline,
    public_summary: draft.description || draft.headline,
    public_mcp_contract: publicCapability,
    memwal_policy:
      "Hirer-visible results are stored in hirer-scoped memWal records. Creator private files stay behind the gateway.",
    skills: [selectedModel.label, "Protected Harness", "Codex MCP"],
    protected_asset_classes: [
      "Agent Harness archive",
      "AGENTS.md",
      "skills/**",
      "private prompts",
    ],
    price_per_1m_tokens_sui: totalPricePerCallUsd,
    base_price_per_1m_tokens_sui: selectedModel.basePricePerCallUsd,
    creator_fee_per_1m_tokens_sui: creatorFeePerCallUsd,
    price_per_1m_tokens_usd: totalPricePerCallUsd,
    price_per_call_usd: totalPricePerCallUsd,
    base_price_per_1m_tokens_usd: selectedModel.basePricePerCallUsd,
    creator_fee_per_1m_tokens_usd: creatorFeePerCallUsd,
    storage_network: "walrus-testnet",
    result_title: draft.typicalOutputTitle,
    result_summary: draft.typicalOutputSummary,
    result_sample: draft.typicalOutputSample,
    result_media_url: typicalOutputUpload?.url,
    result_media_type: typicalOutputUpload?.type,
    metadata: {
      source: "web_create_agent",
      modelId: selectedModel.id,
      modelLabel: selectedModel.label,
      howToUse: draft.howToUse,
      typicalOutputMediaPath: typicalOutputUpload?.path,
    },
  };
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(metadata));
  formData.append("harness", harnessFile, harnessFile.name);

  const response = await fetch(`${gatewayUrl}/v1/agents/create`, {
    method: "POST",
    headers: gatewayAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as GatewayAgentRegistrationResult;
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

function readAllCreatedAgents() {
  try {
    const raw = window.localStorage.getItem(createdAgentsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreatedAgentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUserCreatedAgents(user: AuthUser) {
  const creatorId = creatorIdFor(user);
  return readAllCreatedAgents()
    .filter((record) => record.creatorId === creatorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeCreatedAgentRecord(record: CreatedAgentRecord) {
  try {
    const records = readAllCreatedAgents().filter((item) => item.id !== record.id);
    window.localStorage.setItem(
      createdAgentsStorageKey,
      JSON.stringify([record, ...records]),
    );
    window.dispatchEvent(new Event("hireme-created-agents-updated"));
  } catch {
    // The sealed preview still renders even when local persistence is unavailable.
  }
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

async function createPaidAgentAccessRecord({
  agent,
  signAndExecuteTransaction,
  user,
}: {
  agent: Agent;
  signAndExecuteTransaction: SignAndExecuteTransaction;
  user: AuthUser;
}) {
  const hirerId = hirerIdFor(user);
  if (!user.wallet) {
    throw new Error("Connect your SUI wallet before pressing Hire!.");
  }

  const intentResponse = await fetch(`${gatewayUrl}/v1/payments/sui/intent`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      agent_id: agent.id,
      hirer_id: hirerId,
      wallet_address: user.wallet,
      email: user.email,
    }),
  });

  if (!intentResponse.ok) {
    throw new Error(`Gateway ${intentResponse.status}: ${await intentResponse.text()}`);
  }

  const intentResult = (await intentResponse.json()) as {
    intent?: {
      intentId?: string;
      amountMist?: string;
      recipientAddress?: string;
    };
    transaction?: {
      amountMist?: string;
      recipientAddress?: string;
    };
  };
  const intentId = intentResult.intent?.intentId;
  const amountMist =
    intentResult.transaction?.amountMist || intentResult.intent?.amountMist || "";
  const recipientAddress =
    intentResult.transaction?.recipientAddress ||
    intentResult.intent?.recipientAddress ||
    "";

  if (!intentId || !amountMist || !recipientAddress) {
    throw new Error("Gateway did not return a complete SUI payment intent.");
  }

  const tx = new Transaction();
  const [paymentCoin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.transferObjects([paymentCoin], recipientAddress);
  const execution = await signAndExecuteTransaction({ transaction: tx });
  const txDigest = "digest" in execution ? execution.digest : "";
  if (!txDigest) {
    throw new Error("SUI wallet did not return a transaction digest.");
  }

  const confirmResponse = await fetch(`${gatewayUrl}/v1/payments/sui/confirm`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      intent_id: intentId,
      tx_digest: txDigest,
      agent_id: agent.id,
      hirer_id: hirerId,
      wallet_address: user.wallet,
      email: user.email,
    }),
  });

  if (!confirmResponse.ok) {
    throw new Error(`Gateway ${confirmResponse.status}: ${await confirmResponse.text()}`);
  }

  const confirmResult = (await confirmResponse.json()) as {
    access?: GatewayAccessPayload;
  };
  return mapGatewayAccessRecord(confirmResult.access, agent, "gateway");
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

async function loadGatewayMyMemWalResults(user: AuthUser) {
  const hirerId = hirerIdFor(user);
  const response = await fetch(`${gatewayUrl}/v1/my/memwal-results`, {
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
    results?: GatewayMemWalResultPayload[];
  };
  return result.results || [];
}

async function loadGatewayMyPaymentActivity(user: AuthUser) {
  const hirerId = hirerIdFor(user);
  const response = await fetch(`${gatewayUrl}/v1/my/payment-activity`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      hirer_id: hirerId,
      wallet_address: user.wallet,
      email: user.email,
      limit: 50,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    results?: GatewaySuiPaymentActivityPayload[];
  };
  return result.results || [];
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
  const pricePerCallUsd = agent?.pricePer1MTokensSui ?? agent?.pricePerCallUsd ?? 0;
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
    categories: [agent?.category || "Ops"],
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
    pricePer1MTokensSui: pricePerCallUsd,
    freeCalls: agent?.freeCalls ?? 0,
    rating: agent?.rating ?? 0,
    calls: agent?.historicalCalls ?? 0,
    latencyMs,
    avgInputTokens: 800,
    avgOutputTokens: 700,
    resultPreview: {
      title: `${skills[0]} result`,
      summary: `Returns safe ${agent?.publicContract || "hireme_agent(task)"} output with gateway authorization metadata.`,
      sample: `${headline} Response includes action items, constraints, and verification notes.`,
    },
    mcpPackage: `mcp://hireme/${id}`,
    accent: "from-[#533afd] to-[#6ee7f9]",
  };
}

function mapCreatedAgentRecordToAgent(record: CreatedAgentRecord): Agent {
  const creator = record.creatorEmail || "Local creator";
  const headline = record.headline || record.description;
  const publicContract = `${record.agentSlug}(task, context, budget_calls)`;
  const isPublished = record.status === "Published";

  return {
    id: record.agentSlug,
    name: record.agentName,
    handle: `@agents/${record.agentSlug}`,
    creator,
    team: {
      id: `local-${record.creatorId}`,
      name: isPublished ? "My Published Agents" : "My Draft Agents",
      handle: isPublished ? "@teams/my-published" : "@teams/my-drafts",
      owner: creator,
      headline: isPublished
        ? "Protected Agents registered through the gateway."
        : "Locally created protected Agent drafts.",
      publicSummary:
        isPublished
          ? "Agents created from the web UI and registered through the HireMe gateway."
          : "Draft Agents created from the web UI before production registration.",
      agentCount: 1,
      accent: "from-[#533afd] to-[#00b7a8]",
      billing: {
        unit: "per_agent",
        basePriceUsd: record.pricePerCallUsd,
        includedCalls: 0,
        overagePricePerCallUsd: record.pricePerCallUsd,
        note: `${formatAgentPrice(record.pricePerCallUsd)} through the executing Agent ledger.`,
      },
    },
    teamRole: isPublished ? "Registered Agent" : "Draft Agent",
    listedIndividually: true,
    category: "Code",
    categories: ["Code"],
    status: "Available",
    headline,
    publicSummary: record.description,
    publicContract,
    memwalPolicy:
      "Gateway-managed results are stored as hirer-scoped memWal metadata.",
    skills: [
      record.modelLabel || "MCP",
      "Protected Harness",
      isPublished ? "Gateway Registered" : "Local Draft",
    ],
    protectedAssets: ["Agent Harness archive", "private prompts", "skills/**"],
    sealedHarness: {
      network: "walrus-testnet",
      sealPolicyId: `platform:agent:${record.agentSlug}`,
      walrusBlobId: record.walrusBlobId,
      suiObjectId: record.suiObjectId,
      ciphertextDigest: record.ciphertextDigest,
      visibility:
        isPublished
          ? "This Agent was registered through the gateway. Hirers receive public metadata and safe results only."
          : "This local draft exposes only public metadata until production registration.",
    },
    pricePerCallUsd: record.pricePerCallUsd,
    freeCalls: 0,
    rating: 0,
    calls: 0,
    latencyMs: 0,
    avgInputTokens: 0,
    avgOutputTokens: 0,
    resultPreview: {
      title: record.typicalOutputTitle || `${record.agentName} result`,
      summary:
        record.typicalOutputSummary ||
        "Shows the expected result shape for this locally created Agent.",
      sample: record.typicalOutputSample || record.howToUse || headline,
      mediaUrl: record.typicalOutputMediaUrl,
      mediaType: record.typicalOutputMediaType,
    },
    mcpPackage: `mcp://hireme/${record.agentSlug}`,
    accent: "from-[#533afd] to-[#00b7a8]",
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
  onLogout,
  user,
  onLoginClick,
}: {
  onLogout: () => void;
  user: AuthUser | null;
  onLoginClick: () => void;
}) {
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const isAgents = location.pathname === "/agents";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/92 px-4 backdrop-blur md:px-8">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 py-2">
        <Link className="flex items-center gap-2" to="/">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#1c1e54] text-white">
            <Bot className="size-4" />
          </span>
          <span className="text-sm font-medium text-[#0d253d]">HireMe</span>
        </Link>

        {isLanding ? (
          <nav className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild size="sm" type="button" variant="secondary">
              <Link to="/docs">
                <Braces /> View Docs
              </Link>
            </Button>
            <Button asChild size="sm" type="button">
              <Link to="/agents">
                <Bot /> Explore Agents
              </Link>
            </Button>
          </nav>
        ) : null}

        {isAgents ? (
          user ? (
            <div className="flex items-center gap-2">
              <Link
                className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-[#273951] transition hover:border-[#533afd]/45 hover:bg-white"
                to="/my"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                  <UserRound className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block max-w-44 truncate font-medium text-[#1c1e54]">
                    {user.email}
                  </span>
                  {user.wallet ? (
                    <span className="hidden truncate text-muted-foreground sm:block">
                      {shortAddress(user.wallet)}
                    </span>
                  ) : null}
                </span>
              </Link>
              <Button onClick={onLogout} size="sm" type="button" variant="secondary">
                <LogOut /> Logout
              </Button>
            </div>
          ) : (
            <Button onClick={onLoginClick} size="sm" type="button">
              <LogIn /> Login
            </Button>
          )
        ) : null}
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
        address = await connectEnokiGoogleAddress({
          connectWallet: connectWallet.mutateAsync,
          wallets,
        });
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
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function submitGoogleLogin() {
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
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
              Sign in with Google. You can connect your Enoki zkLogin Sui
              address from My Agents after login.
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
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("return_to"));
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
      await signInWithGoogle(returnTo);
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
          Codex uses this same web session. After Google login, connect your
          Enoki zkLogin Sui address from My Agents.
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
      const user = authUserFromSupabaseSession(data.session);
      await syncGatewayWebSession(
        data.session.access_token,
        user.wallet,
        user.displayName,
      );
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
              Hire Agents that already know the job.
            </h1>
            <p className="pretty-text mt-6 max-w-2xl text-base font-normal leading-7 text-[#20364f] md:text-lg">
              Use prepared AI Agents from Codex without rebuilding their
              playbooks. Creators keep private Harness files protected, buyers
              get the result, and strong Agents can earn money.
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
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-white p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
            Contents
          </div>
          <nav className="grid gap-1.5">
            {docsToc.map((item) => (
              <div key={item.id}>
                <a
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-[#273951] hover:bg-secondary hover:text-primary"
                  href={`#${item.id}`}
                >
                  {item.label}
                </a>
                {"children" in item ? (
                  <div className="ml-3 grid gap-0.5 border-l border-border pl-3">
                    {item.children.map((child) => (
                      <a
                        className="block rounded-md px-2 py-1.5 text-xs font-medium text-[#5f6f85] hover:bg-secondary hover:text-primary"
                        href={`#${child.id}`}
                        key={child.id}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        <article className="rounded-xl border border-border bg-white px-5 py-6 app-shadow md:px-8 md:py-8">
          <DocsArticleSection
            id="meet"
            kicker="01 / Meet HireMe"
            title="Hire Agents that already know the job."
          >
            <p>
              HireMe lets you hire AI Agents that are already prepared for a
              job. You do not have to teach every rule from scratch. A creator
              has already built the Agent's private working folder with
              instructions, examples, skills, and checks.
            </p>
            <p>
              It should feel closer to hiring a specialist than using a blank
              chatbot. It can cost more, but once the Agent fits your work, it
              can save a lot of setup time.
            </p>
            <p>
              The important idea is simple: the creator owns the know-how, and
              the buyer hires the result of that know-how. A buyer does not need
              to copy the creator's prompts, skills, examples, or review rules.
              They just ask the Agent to do the work from Codex.
            </p>
            <div className="rounded-xl border border-[#533afd]/20 bg-[#f8f5ff] p-4 font-mono text-xs leading-6 text-[#1c1e54]">
              Creators upload protected Agent files.
              <br />
              Buyers try or hire the Agent.
              <br />
              Codex calls HireMe through MCP.
              <br />
              HireMe runs the Agent and returns the result.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsMiniBlock
                id="meet-creators"
                title="For creators"
                copy="Turn private prompts, skills, examples, review rules, and tool habits into a paid Agent. The buyer can hire the Agent, but does not get the original folder."
              />
              <DocsMiniBlock
                id="meet-buyers"
                title="For buyers"
                copy="Use a ready Agent from Codex without building it from scratch. You pay more than a raw model call, but you skip the repeated training and setup work."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="why"
            kicker="02 / Why It Matters"
            title="Your work and the creator's playbook should stay separate."
          >
            <p>
              HireMe creates a safer way to use another person's Agent. The
              buyer sends work to HireMe, not directly to the creator. The
              creator's private Agent files stay protected and are not sent to
              the buyer.
            </p>
            <p>
              For example, a buyer can ask a code-review Agent to inspect a
              private migration. The creator does not need to see that
              migration. At the same time, the buyer does not receive the
              creator's hidden checklist, examples, or review playbook.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsMiniBlock
                id="why-buyers"
                title="Buyer benefit"
                copy="Spend less time explaining the same rules. Try a prepared Agent, use it from Codex, and keep your task input away from the creator by default."
              />
              <DocsMiniBlock
                id="why-creators"
                title="Creator benefit"
                copy="Earn from a useful Agent while keeping AGENTS.md, skills, prompts, examples, rubrics, and work rules behind HireMe."
              />
            </div>
            <div className="rounded-xl border border-border bg-secondary p-4 font-mono text-xs leading-6 text-[#273951]">
              Buyer input -&gt; HireMe runner -&gt; result
              <br />
              Creator files -&gt; encrypted storage -&gt; gateway-only run
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="features"
            kicker="03 / Features"
            title="Four things make HireMe different."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <DocsMiniBlock
                id="feature-harness"
                title="Protected Agent Harness"
                copy="The creator's private Agent folder is encrypted and stored with Walrus. The MVP gateway runs it for buyers, and Seal is the long-term direction for stronger access control. Buyers get results, not the raw Harness."
              />
              <DocsMiniBlock
                id="feature-mcp"
                title="MCP-Native Agent Hiring"
                copy="Use hired Agents from Codex, Claude, and other MCP tools. HireMe is not a closed editor. It is the hiring and running layer for Agents you already want to call from your own AI workspace."
              />
              <DocsMiniBlock
                id="feature-memory"
                title="Memory Sharing With Team Agents"
                copy="When several Agents work as a Team, HireMe uses memWal to share approved project memory. Research, design, code, and eval Agents can pass context forward while each creator's private files stay hidden."
              />
              <DocsMiniBlock
                id="feature-payouts"
                title="Creator Payouts"
                copy="If your Agent helps people, it can earn money. Creators can see usage and earnings in My Page, then redeem available money to their wallet."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="hire"
            kicker="04 / How to Hire"
            title="Try it first. Hire it when it fits."
          >
            <p>
              Start from the marketplace. The Agent card shows what the Agent
              does, how much it costs, and which public skill it offers. The
              private files that make the Agent good stay hidden.
            </p>
            <DocsScreenshot
              alt="HireMe marketplace showing Agent cards with Try and Hire buttons."
              caption="Browse Agents, compare cards, press Try first, then Hire when the Agent is useful."
              src="/docs/how-to-hire.png"
            />
            <ol className="grid gap-3">
              {[
                "Log in so HireMe can connect your web account, wallet, and MCP identity.",
                "Find an Agent you like by checking its card, sample result, price, and public skill.",
                "Press Try to test the Agent before paying for full access.",
                "Open Codex and call the HireMe MCP server on a real task.",
                "If the Agent is useful, add enough money to your connected wallet.",
                "Press Hire and keep using the Agent through MCP.",
              ].map((step, index) => (
                <li className="flex gap-3 text-sm leading-6 text-[#273951]" key={step}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eeeaff] text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-xl border border-border bg-secondary p-4 font-mono text-xs leading-6 text-[#273951]">
              Use my HireMe code-review Agent to review this migration diff.
            </div>
            <p>
              This is the buyer promise: you can use a more prepared Agent
              without asking the creator to manually join your project or read
              your private input.
            </p>
          </DocsArticleSection>

          <DocsArticleSection
            id="publish"
            kicker="05 / How to Publish"
            title="Publish from the web or from Codex through MCP."
          >
            <p>
              Both paths have the same goal: show what the Agent can do without
              giving buyers the creator's private Agent files.
            </p>
            <DocsScreenshot
              alt="HireMe Create Agent form for publishing a paid Agent."
              caption="The web form collects the public card, example output, private Harness upload, model choice, and creator fee."
              src="/docs/how-to-publish.png"
            />
            <div className="grid gap-5 md:grid-cols-2">
              <DocsMiniBlock
                id="publish-web"
                title="Method 1: Web"
                copy="Log in, write the public Agent card, add usage instructions, upload the protected Harness archive, choose the model, set your creator fee, review the final price, and submit."
              />
              <DocsMiniBlock
                id="publish-mcp"
                title="Method 2: MCP"
                copy="Ask Codex to make a HireMe Agent template, edit AGENTS.md and skills locally, then publish the folder with hireme_create_agent_from_folder. If the artifact is already encrypted, register it with hireme_register_agent."
              />
            </div>
            <p>
              Buyers see the Agent card, sample output, price, and public MCP
              tools. They do not receive the original `AGENTS.md`, private
              skills, prompts, examples, or work rules.
            </p>
            <p>
              This is why the Agent can be shared safely. The creator is not
              selling a prompt file. The creator is selling access to a prepared
              worker that runs behind HireMe.
            </p>
          </DocsArticleSection>

          <DocsArticleSection
            id="paid"
            kicker="06 / How to Get Paid"
            title="If your Agent works well, it should earn for you."
          >
            <p>
              Creators earn when buyers use or hire their Agents. The flow is
              simple: check earnings in My Page, then redeem available money to
              your wallet.
            </p>
            <DocsScreenshot
              alt="HireMe My Agents page showing registered Agents, hired Agents, and activity."
              caption="My Agents is where creators track published Agents, paid hires, usage activity, and payout state."
              src="/docs/how-to-get-paid.png"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <DocsMiniBlock
                id="paid-earnings"
                title="Check earnings"
                copy="My Page shows your Agents, paid hires, usage, available money, and money that is still being settled. This is where creators can see whether an Agent is becoming valuable."
              />
              <DocsMiniBlock
                id="paid-redeem"
                title="Redeem"
                copy="When money is ready, press Redeem. HireMe checks the payment and usage records, then sends available money to your connected wallet."
              />
              <DocsMiniBlock
                id="paid-records"
                title="Payment records"
                copy="Payouts are based on usage and payment records. The payout view does not need raw prompts, private outputs, or private Agent files."
              />
            </div>
            <p>
              The product point is direct: if someone builds a strong Agent,
              that work can become a paid asset. HireMe gives the creator a way
              to keep improving the Agent while still earning from each hire or
              paid run.
            </p>
          </DocsArticleSection>

          <DocsArticleSection
            id="roadmap"
            kicker="07 / Trust & Roadmap"
            title="The goal is a platform-free Agent hiring protocol."
          >
            <p>
              Today, HireMe still uses a platform gateway. The gateway checks
              access, runs protected Agents, and keeps creator files away from
              buyers. This is the current step, not the final goal.
            </p>
            <p>
              The final goal is bigger than a marketplace. HireMe is moving
              toward a platform-free Agent hiring protocol where Agent access,
              private execution, memory, and payouts can work without trusting
              one central platform forever.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsMiniBlock
                id="roadmap-goal"
                title="Final goal"
                copy="A platform-free, decentralized Agent hiring protocol where access, running Agents, memory, and payouts depend less on HireMe over time."
              />
              <DocsMiniBlock
                id="roadmap-privacy"
                title="Long-term privacy"
                copy="TEE, ICP blockchain, Seal, and similar systems can move HireMe toward a future where even the platform cannot read plain user or creator data."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DocsMiniBlock
                id="roadmap-2026-06-17"
                title="Week of 2026-06-17"
                copy="Docs, Features section, Try/Hire flow, publish flows, creator payout flow, token pricing, Sui payment direction, and platform encryption defaults."
              />
              <DocsMiniBlock
                id="roadmap-2026-06-10"
                title="Week of 2026-06-10"
                copy="MVP base: database shape, protected Agent files, Agent Teams, OAuth MCP sessions, Try/Hire access, Walrus records, memWal records, and gateway runner."
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

function DocsMiniBlock({
  copy,
  id,
  title,
}: {
  copy: string;
  id?: string;
  title: string;
}) {
  return (
    <div className="scroll-mt-24 border-l border-[#533afd]/30 pl-4" id={id}>
      <h3 className="text-sm font-semibold text-[#1c1e54]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#4e5d77]">{copy}</p>
    </div>
  );
}

function DocsScreenshot({
  alt,
  caption,
  src,
}: {
  alt: string;
  caption: string;
  src: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-white shadow-[rgba(15,23,42,0.05)_0_10px_30px]">
      <img
        alt={alt}
        className="aspect-[1280/820] w-full bg-secondary object-cover object-top"
        loading="lazy"
        src={src}
      />
      <figcaption className="border-t border-border bg-secondary px-4 py-3 text-xs leading-5 text-[#52637a]">
        {caption}
      </figcaption>
    </figure>
  );
}

function ExploreAgentsPage({
  user,
  onRequireLogin,
}: {
  user: AuthUser | null;
  onRequireLogin: () => void;
}) {
  const signAndExecuteTransaction = useSignAndExecuteTransaction();
  const [query, setQuery] = useState("");
  const [catalogView, setCatalogView] = useState<CatalogView>("agents");
  const [selectedTopics, setSelectedTopics] = useState<Agent["category"][]>(
    topicFilters,
  );
  const [marketplaceAgents, setMarketplaceAgents] =
    useState<Agent[]>(fallbackAgents);
  const [accessSnapshot, setAccessSnapshot] =
    useState<AgentAccessRecord[]>(readAllAgentAccess);
  const [createdAgentRecords, setCreatedAgentRecords] = useState<
    CreatedAgentRecord[]
  >(() => readAllCreatedAgents());
  const [dataSource, setDataSource] = useState<{
    source: AgentDataSource;
    message?: string;
  }>({ source: "mock", message: "Loading Supabase marketplace..." });
  const [accessActionError, setAccessActionError] = useState<string | null>(null);
  const [accessActionKey, setAccessActionKey] = useState<string | null>(null);

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

  useEffect(() => {
    const refreshCreatedRecords = () => {
      setCreatedAgentRecords(readAllCreatedAgents());
    };

    window.addEventListener(
      "hireme-created-agents-updated",
      refreshCreatedRecords,
    );
    window.addEventListener("storage", refreshCreatedRecords);

    return () => {
      window.removeEventListener(
        "hireme-created-agents-updated",
        refreshCreatedRecords,
      );
      window.removeEventListener("storage", refreshCreatedRecords);
    };
  }, []);

  const localCreatedAgents = useMemo(
    () => createdAgentRecords.map(mapCreatedAgentRecordToAgent),
    [createdAgentRecords],
  );
  const catalogAgents = useMemo(
    () => mergeAgentCatalog(marketplaceAgents, localCreatedAgents),
    [marketplaceAgents, localCreatedAgents],
  );

  const filteredAgents = useMemo(() => {
    return catalogAgents.filter((agent) => {
      if (!isMarketplaceAgentVisible(agent)) return false;
      if (!isPaidAgent(agent)) return false;
      const categories = agentCategories(agent);
      const matchesTopic = categories.some((category) =>
        selectedTopics.includes(category),
      );
      const text = `${categories.join(" ")} ${agent.team.name} ${agent.team.handle} ${agent.team.owner} ${agent.team.publicSummary} ${agent.name} ${agent.handle} ${agent.headline} ${agent.publicSummary} ${agent.skills.join(" ")}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      return matchesTopic && matchesQuery;
    });
  }, [catalogAgents, query, selectedTopics]);
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

    setAccessActionError(null);
    setAccessActionKey(`${agent.id}:${accessType}`);
    try {
      const record =
        accessType === "hired"
          ? await createPaidAgentAccessRecord({
              agent,
              user,
              signAndExecuteTransaction: signAndExecuteTransaction.mutateAsync,
            })
          : await createAgentAccessRecord({
              agent,
              user,
              accessType,
            });
      const nextRecords = upsertAccessRecord(readUserAgentAccess(user), record);
      writeUserAgentAccess(user, nextRecords);
      setAccessSnapshot(readAllAgentAccess());
    } catch (error) {
      setAccessActionError(
        error instanceof Error ? error.message : "Agent access request failed.",
      );
    } finally {
      setAccessActionKey(null);
    }
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
              <Button asChild type="button">
                <Link to="/agents/create">
                  <PackageOpen /> Create Agent
                </Link>
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-none transition ${
                        isSelected
                          ? "border-[#533afd] bg-[#533afd] text-white shadow-[rgba(83,58,253,0.20)_0_6px_16px]"
                          : "border-border bg-white text-[#273951] hover:border-[#533afd]/45 hover:bg-secondary"
                      }`}
                      key={view.id}
                      onClick={() => setCatalogView(view.id)}
                      type="button"
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-white" : "bg-[#c9d3e2]"
                        }`}
                      />
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-none transition ${
                        isSelected
                          ? "border-[#533afd] bg-[#533afd] text-white shadow-[rgba(83,58,253,0.20)_0_6px_16px]"
                          : "border-border bg-white text-[#273951] hover:border-[#533afd]/45 hover:bg-secondary"
                      }`}
                      key={topic}
                      onClick={() =>
                        setSelectedTopics(toggleFilter(selectedTopics, topic))
                      }
                      type="button"
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-white" : "bg-[#c9d3e2]"
                        }`}
                      />
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
              {localCreatedAgents.length ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium text-[#1c1e54]">
                    {localCreatedAgents.length} web-created agent
                    {localCreatedAgents.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
              {dataSource.message ? (
                <span className="leading-5 text-muted-foreground">
                  {dataSource.message}
                </span>
              ) : null}
            </div>
          </div>

          {accessActionError ? (
            <div className="rounded-xl border border-[#ea2261]/25 bg-[#fff8fb] px-4 py-3 text-sm leading-6 text-[#9f1239]">
              {accessActionError}
            </div>
          ) : null}

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
                  isBusy={accessActionKey?.startsWith(`${agent.id}:`) || false}
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

    </main>
  );
}

function AgentDetailPage({
  user,
  onRequireLogin,
}: {
  user: AuthUser | null;
  onRequireLogin: () => void;
}) {
  const signAndExecuteTransaction = useSignAndExecuteTransaction();
  const { agentId = "" } = useParams();
  const [marketplaceAgents, setMarketplaceAgents] =
    useState<Agent[]>(fallbackAgents);
  const [accessSnapshot, setAccessSnapshot] =
    useState<AgentAccessRecord[]>(readAllAgentAccess);
  const [createdAgentRecords, setCreatedAgentRecords] = useState<
    CreatedAgentRecord[]
  >(() => readAllCreatedAgents());
  const [accessActionError, setAccessActionError] = useState<string | null>(null);
  const [accessActionType, setAccessActionType] = useState<AgentAccessType | null>(
    null,
  );

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
    const refreshCreatedRecords = () => {
      setCreatedAgentRecords(readAllCreatedAgents());
    };

    window.addEventListener(
      "hireme-created-agents-updated",
      refreshCreatedRecords,
    );
    window.addEventListener("storage", refreshCreatedRecords);

    return () => {
      window.removeEventListener(
        "hireme-created-agents-updated",
        refreshCreatedRecords,
      );
      window.removeEventListener("storage", refreshCreatedRecords);
    };
  }, []);

  const localCreatedAgents = useMemo(
    () => createdAgentRecords.map(mapCreatedAgentRecordToAgent),
    [createdAgentRecords],
  );
  const catalogAgents = useMemo(
    () => mergeAgentCatalog(marketplaceAgents, localCreatedAgents),
    [marketplaceAgents, localCreatedAgents],
  );

  const agent = catalogAgents.find(
    (item) =>
      isMarketplaceAgentVisible(item) &&
      (item.id === agentId ||
        item.handle.replace(/^@[^/]+\//, "") === agentId ||
        item.handle === agentId),
  );
  const access = user
    ? accessSnapshot.find(
        (record) =>
          record.agentId === agent?.id &&
          record.hirerId === hirerIdFor(user) &&
          record.status === "active",
      )
    : undefined;

  async function updateAgentAccess(accessType: AgentAccessType) {
    if (!agent) return;
    if (!user) {
      onRequireLogin();
      return;
    }

    setAccessActionError(null);
    setAccessActionType(accessType);
    try {
      const record =
        accessType === "hired"
          ? await createPaidAgentAccessRecord({
              agent,
              user,
              signAndExecuteTransaction: signAndExecuteTransaction.mutateAsync,
            })
          : await createAgentAccessRecord({
              agent,
              user,
              accessType,
            });
      const nextRecords = upsertAccessRecord(readUserAgentAccess(user), record);
      writeUserAgentAccess(user, nextRecords);
      setAccessSnapshot(readAllAgentAccess());
    } catch (error) {
      setAccessActionError(
        error instanceof Error ? error.message : "Agent access request failed.",
      );
    } finally {
      setAccessActionType(null);
    }
  }

  if (!agent) {
    return (
      <main className="min-h-screen bg-[#f6f9fc] px-4 py-12 md:px-8">
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-6 app-shadow">
          <h1 className="text-3xl font-light text-[#1c1e54]">
            Agent not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This Agent may be unavailable or hidden from the public marketplace.
          </p>
          <Button asChild className="mt-5" type="button">
            <Link to="/agents">
              <Bot /> Explore Agents
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  const isHired = access?.accessType === "hired";
  const isTrying = access?.accessType === "trial";
  const hasGatewayAccess = access?.source === "gateway";

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <Button asChild size="sm" type="button" variant="ghost">
            <Link to="/agents">
              <Search /> Back to agents
            </Link>
          </Button>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#533afd]/20 bg-secondary px-3 py-1 text-xs font-semibold text-[#1c1e54]">
                  {agent.category}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
                  {agent.status}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
                  {agent.team.name}
                </span>
              </div>

              <div className="mt-5 flex items-start gap-4">
                <Avatar className="size-16">
                  <AvatarFallback
                    className={`bg-gradient-to-br ${agent.accent} text-lg text-white`}
                  >
                    {agent.name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h1 className="balanced-text text-4xl font-light leading-tight text-[#1c1e54] md:text-5xl">
                    {agent.name}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {agent.handle} · by {agent.creator}
                  </p>
                </div>
              </div>

              <p className="pretty-text mt-6 max-w-3xl text-xl font-light leading-8 text-[#1c1e54]">
                {agent.headline}
              </p>
              <p className="pretty-text mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                {agent.publicSummary}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">
                  {formatAgentPrice(agent.pricePerCallUsd)}
                </CardTitle>
                <CardDescription>
                  Token-based fee for protected MCP execution from Codex.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <Metric icon={Clock3} label="Avg time" value={formatDuration(agent.latencyMs)} />
                  <Metric icon={Braces} label="Avg tokens" value={formatTokens(totalAverageTokens(agent))} />
                  <Metric icon={UserRound} label="Users" value={formatUsers(estimateActiveUsers(agent))} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button
                    className="w-full"
                    disabled={
                      Boolean(accessActionType) ||
                      (hasGatewayAccess && (isTrying || isHired))
                    }
                    onClick={() => {
                      void updateAgentAccess("trial");
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <Terminal /> Try!
                  </Button>
                  <Button
                    className="w-full"
                    disabled={Boolean(accessActionType) || (hasGatewayAccess && isHired)}
                    onClick={() => {
                      void updateAgentAccess("hired");
                    }}
                    type="button"
                  >
                    <PackageOpen /> Hire!
                  </Button>
                </div>
                {access ? (
                  <div className="mt-4 rounded-lg border border-border bg-secondary px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {access.source === "gateway"
                      ? "Authorized by gateway for Codex calls."
                      : "Saved locally. Start gateway and press Try! or Hire! again for Codex authorization."}
                  </div>
                ) : null}
                {accessActionError ? (
                  <div className="mt-4 rounded-lg border border-[#ea2261]/25 bg-[#fff8fb] px-3 py-2 text-xs leading-5 text-[#9f1239]">
                    {accessActionError}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>How to use</CardTitle>
                <CardDescription>
                  Use natural language in Codex after Try! or Hire! authorization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border bg-secondary p-4 text-sm leading-6 text-[#1c1e54]">
                  HireMe MCP에서 {agent.id} agent를 호출해서 원하는 작업을
                  맡겨줘.
                </div>
                <div className="mt-3 rounded-lg border border-border bg-white p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Public MCP contract
                  </div>
                  <code className="block break-all text-sm text-[#1c1e54]">
                    {agent.publicContract}
                  </code>
                </div>
                <div className="mt-4 rounded-lg border border-border bg-white p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Result preview
                  </div>
                  <div className="text-sm font-medium text-[#1c1e54]">
                    {agent.resultPreview.title}
                  </div>
                  {agent.resultPreview.mediaUrl ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-secondary">
                      {agent.resultPreview.mediaType === "video" ? (
                        <video
                          className="aspect-video w-full bg-black object-contain"
                          controls
                          src={agent.resultPreview.mediaUrl}
                        />
                      ) : (
                        <img
                          alt={`${agent.name} result preview`}
                          className="aspect-video w-full object-cover"
                          src={agent.resultPreview.mediaUrl}
                        />
                      )}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-[#273951]">
                    {agent.resultPreview.summary}
                  </p>
                  <div className="mt-4 rounded-lg border border-border bg-secondary p-4 text-sm leading-6 text-[#1c1e54]">
                    {agent.resultPreview.sample}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
                <CardDescription>
                  Recent marketplace averages from successful runs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric
                    icon={Clock3}
                    label="Thinking + answer"
                    value={formatDuration(agent.latencyMs)}
                  />
                  <Metric
                    icon={Braces}
                    label="Avg tokens"
                    value={formatTokens(totalAverageTokens(agent))}
                  />
                  <Metric
                    icon={UserRound}
                    label="Active users"
                    value={formatUsers(estimateActiveUsers(agent))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.skills.map((skill) => (
                    <span
                      className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-[#273951]"
                      key={skill}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Protected Harness</CardTitle>
                <CardDescription>{agent.sealedHarness.visibility}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-xs leading-5 text-muted-foreground">
                  <DetailMetaRow label="Network" value={agent.sealedHarness.network} />
                  <DetailMetaRow label="Walrus blob" value={agent.sealedHarness.walrusBlobId} />
                  <DetailMetaRow label="Sui object" value={agent.sealedHarness.suiObjectId} />
                  <DetailMetaRow label="Digest" value={agent.sealedHarness.ciphertextDigest} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hidden from hirers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.protectedAssets.map((asset) => (
                    <span
                      className="rounded-full border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-1 text-xs font-medium text-[#9f1239]"
                      key={asset}
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

function MyAgentsPage({
  user,
  onLogout,
  onRequireLogin,
  onWalletLinked,
}: {
  user: AuthUser | null;
  onLogout: () => void;
  onRequireLogin: () => void;
  onWalletLinked: (wallet: string) => void;
}) {
  const [marketplaceAgents, setMarketplaceAgents] =
    useState<Agent[]>(fallbackAgents);
  const [accessRecords, setAccessRecords] = useState<AgentAccessRecord[]>([]);
  const [memWalResults, setMemWalResults] = useState<GatewayMemWalResultPayload[]>([]);
  const [paymentActivities, setPaymentActivities] = useState<
    GatewaySuiPaymentActivityPayload[]
  >([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [memWalError, setMemWalError] = useState<string | null>(null);
  const [paymentActivityError, setPaymentActivityError] = useState<string | null>(
    null,
  );
  const [createdRecordsVersion, setCreatedRecordsVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<MyPageTab>("registered");
  const createdRecords = useMemo(
    () =>
      createdRecordsVersion >= 0 && user ? readUserCreatedAgents(user) : [],
    [createdRecordsVersion, user],
  );

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
        const localRecords = readUserAgentAccess(user);
        const gatewayAgentIds = new Set(
          result.records.map((record) => record.agentId),
        );
        const mergedRecords = [
          ...result.records,
          ...localRecords.filter(
            (record) => !gatewayAgentIds.has(record.agentId),
          ),
        ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setAccessError(null);
        setAccessRecords(mergedRecords);
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

  useEffect(() => {
    let isCurrent = true;
    if (!user) return () => {
      isCurrent = false;
    };

    void loadGatewayMyMemWalResults(user)
      .then((records) => {
        if (!isCurrent) return;
        setMemWalError(null);
        setMemWalResults(records);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setMemWalError(
          error instanceof Error ? error.message : "Gateway memWal request failed",
        );
        setMemWalResults([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [user]);

  useEffect(() => {
    let isCurrent = true;
    if (!user) return () => {
      isCurrent = false;
    };

    void loadGatewayMyPaymentActivity(user)
      .then((records) => {
        if (!isCurrent) return;
        setPaymentActivityError(null);
        setPaymentActivities(records);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setPaymentActivityError(
          error instanceof Error
            ? error.message
            : "Gateway payment activity request failed",
        );
        setPaymentActivities([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [user]);

  useEffect(() => {
    const refreshCreatedRecords = () => {
      setCreatedRecordsVersion((version) => version + 1);
    };

    window.addEventListener(
      "hireme-created-agents-updated",
      refreshCreatedRecords,
    );
    window.addEventListener("storage", refreshCreatedRecords);

    return () => {
      window.removeEventListener(
        "hireme-created-agents-updated",
        refreshCreatedRecords,
      );
      window.removeEventListener("storage", refreshCreatedRecords);
    };
  }, []);

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
  const hiredRecords = activeRecords.filter(
    (record) => record.accessType === "hired",
  );

  function resolveAgent(record: AgentAccessRecord) {
    return (
      marketplaceAgents.find((agent) => agent.id === record.agentId) ||
      fallbackAgents.find((agent) => agent.id === record.agentId)
    );
  }

  const creatorKeys = new Set(
    [
      user.email,
      user.email.split("@")[0],
      user.displayName,
      user.wallet,
    ]
      .map((value) => value?.trim().toLowerCase())
      .filter(
        (value): value is string =>
          Boolean(value) && value !== "set display name",
      ),
  );
  const registeredMarketplaceAgents = marketplaceAgents.filter((agent) =>
    [agent.creator, agent.team.owner, agent.handle, agent.id].some((value) =>
      creatorKeys.has(value.trim().toLowerCase()),
    ),
  );
  const activityItems: MyActivityItem[] = [
    ...createdRecords.map((record) => ({
      id: `created-${record.id}`,
      label: "Registered",
      title: record.agentName,
      description: `${record.modelLabel || "Model"} · ${formatAgentPriceShort(
        record.pricePerCallUsd,
      )} · ${record.status}`,
      timestamp: record.createdAt,
      tone: "registered" as const,
    })),
    ...activeRecords.map((record) => {
      const agent = resolveAgent(record);
      return {
        id: `access-${record.id}`,
        label: record.accessType === "hired" ? "Hired" : "Tried",
        title: agent?.name || record.agentId,
        description: `${
          record.source === "gateway" ? "Gateway" : "Local"
        } · ${formatAgentPriceShort(record.pricePerCallUsd)} · ${
          record.receiptObjectId
        }`,
        timestamp: record.updatedAt || record.createdAt,
        tone: (record.accessType === "hired"
          ? "hired"
          : "trial") as MyActivityItem["tone"],
      };
    }),
    ...memWalResults.map((record) => ({
      id: `memwal-${record.callId || record.id || record.ciphertextDigest}`,
      label: "memWal",
      title: record.agentId || "Agent result",
      description: `${record.visibility || "hirer-only"} · ${
        record.safeSummary?.type || "user_result"
      } · ${record.responseDigest || record.ciphertextDigest || "digest pending"}`,
      timestamp: record.createdAt || new Date(0).toISOString(),
      tone: "result" as const,
    })),
    ...paymentActivities.map((record) => ({
      id: `payment-${record.verificationId || record.txDigest || record.intentId}`,
      label:
        record.status === "verified"
          ? "Payment verified"
          : record.status === "failed"
            ? "Payment failed"
            : "Payment check",
      title: record.agentId || "SUI payment",
      description:
        record.status === "verified"
          ? `${record.expectedAmountSui || "0"} SUI · ${
              record.network || "sui"
            } · ${record.txDigest || "digest pending"}`
          : `${record.verificationMode || "sui_rpc"} · ${
              record.failureReason || record.effectStatus || "verification pending"
            } · ${record.txDigest || "digest pending"}`,
      timestamp: record.createdAt || new Date(0).toISOString(),
      tone: (record.status === "verified"
        ? "payment"
        : "failed") as MyActivityItem["tone"],
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const registeredCount =
    createdRecords.length + registeredMarketplaceAgents.length;
  const tabs: { id: MyPageTab; label: string; count: number }[] = [
    { id: "registered", label: "Registered Agents", count: registeredCount },
    { id: "hired", label: "Hired Agents", count: activeRecords.length },
    { id: "activity", label: "Activity", count: activityItems.length },
  ];

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-light leading-tight text-[#1c1e54] md:text-5xl">
              My Agents
            </h1>
            <p className="mt-4 max-w-2xl text-base font-light leading-7 text-muted-foreground">
              Manage the agents you registered, the agents you can call from
              Codex, and recent marketplace activity.
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
                <div className="mt-4 flex justify-end">
                  <Button onClick={onLogout} size="sm" type="button" variant="secondary">
                    <LogOut /> Logout
                  </Button>
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
          {memWalError ? (
            <div className="mb-4 rounded-xl border border-[#f59e0b]/20 bg-[#fffaf0] p-4 text-sm leading-6 text-[#92400e]">
              Gateway memWal activity read failed. Activity may omit recent
              protected result records.
              <div className="mt-1 font-mono text-xs">{memWalError}</div>
            </div>
          ) : null}
          {paymentActivityError ? (
            <div className="mb-4 rounded-xl border border-[#f59e0b]/20 bg-[#fffaf0] p-4 text-sm leading-6 text-[#92400e]">
              Gateway payment activity read failed. Activity may omit recent SUI
              verification logs.
              <div className="mt-1 font-mono text-xs">{paymentActivityError}</div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <DashboardSummaryCard
              icon={PackageOpen}
              label="Registered"
              value={registeredCount.toString()}
              description="Agents you created or published."
            />
            <DashboardSummaryCard
              icon={WalletCards}
              label="Hired"
              value={hiredRecords.length.toString()}
              description="Paid agents authorized for Codex calls."
            />
            <DashboardSummaryCard
              icon={Clock3}
              label="Activity"
              value={activityItems.length.toString()}
              description="Recent registrations, payments, trials, and hires."
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border bg-white p-2 app-shadow">
            {tabs.map((tab) => (
              <button
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "border-[#533afd] bg-white text-[#1c1e54] shadow-[inset_0_0_0_1px_rgba(83,58,253,0.22)]"
                    : "border-transparent text-muted-foreground hover:border-[#533afd]/30 hover:text-[#1c1e54]"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}{" "}
                <span className="number-cell ml-1 text-[11px]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === "registered" ? (
            registeredCount ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {createdRecords.map((record) => (
                  <CreatedAgentCard key={record.id} record={record} />
                ))}
                {registeredMarketplaceAgents.map((agent) => (
                  <RegisteredMarketplaceAgentCard
                    agent={agent}
                    key={agent.id}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-border bg-white p-6 app-shadow">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-light text-[#1c1e54]">
                      No registered agents yet
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      Create an agent from the marketplace page. Once its
                      protected record is generated, it will appear here.
                    </p>
                  </div>
                  <Button asChild type="button">
                    <Link to="/agents">
                      <PackageOpen /> Create Agent
                    </Link>
                  </Button>
                </div>
              </div>
            )
          ) : null}

          {activeTab === "hired" ? (
            activeRecords.length ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {activeRecords.map((record) => {
                  const agent = resolveAgent(record);
                  if (!agent) return null;
                  return (
                    <MyAgentAccessCard
                      agent={agent}
                      hirerId={hirerId}
                      key={record.id}
                      record={record}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-border bg-white p-6 app-shadow">
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
            )
          ) : null}

          {activeTab === "activity" ? (
            activityItems.length ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white app-shadow">
                {activityItems.map((item) => (
                  <ActivityRow item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <EmptyResult label="No activity yet." />
            )
          ) : null}
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

function DashboardSummaryCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: typeof PackageOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 app-shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="number-cell mt-3 text-3xl font-light text-[#1c1e54]">
        {value}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function CreatedAgentCard({ record }: { record: CreatedAgentRecord }) {
  const initials = record.agentName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="bg-gradient-to-br from-[#533afd] to-[#00b7a8] text-white">
                {initials || "AG"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">
                {record.agentName}
              </CardTitle>
              <CardDescription>@agents/{record.agentSlug}</CardDescription>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#533afd]/25 bg-secondary px-3 py-1 text-xs font-medium text-[#1c1e54]">
            {record.status}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm leading-6 text-[#273951]">
          {record.description}
        </p>

        {record.typicalOutputMediaUrl ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-secondary">
            {record.typicalOutputMediaType === "video" ? (
              <video
                className="aspect-video w-full bg-black object-contain"
                controls
                src={record.typicalOutputMediaUrl}
              />
            ) : (
              <img
                alt={`${record.agentName} result preview`}
                className="aspect-video w-full object-cover"
                src={record.typicalOutputMediaUrl}
              />
            )}
          </div>
        ) : null}

        {record.typicalOutputTitle || record.typicalOutputSummary ? (
          <div className="mt-5 rounded-lg border border-border bg-secondary p-3">
            <div className="text-xs font-medium text-[#1c1e54]">
              {record.typicalOutputTitle || "Result preview"}
            </div>
            {record.typicalOutputSummary ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {record.typicalOutputSummary}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric icon={Bot} label="Model" value={record.modelLabel || "N/A"} />
          <Metric
            icon={CircleDollarSign}
            label="Token fee"
            value={formatAgentPriceShort(record.pricePerCallUsd)}
          />
          <Metric
            icon={PackageOpen}
            label="Files"
            value={record.fileCount.toString()}
          />
        </div>

        <div className="mt-5 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary px-3 py-2">
            Walrus blob:{" "}
            <span className="font-mono text-[#273951]">
              {record.walrusBlobId}
            </span>
          </div>
          <div className="rounded-lg border border-border bg-secondary px-3 py-2">
            Sui object:{" "}
            <span className="font-mono text-[#273951]">
              {record.suiObjectId}
            </span>
          </div>
          <div className="rounded-lg border border-border bg-secondary px-3 py-2 sm:col-span-2">
            Ciphertext digest:{" "}
            <span className="font-mono text-[#273951]">
              {record.ciphertextDigest}
            </span>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Created {formatAccessDate(record.createdAt)} · {record.source}
        </div>
      </CardContent>
    </Card>
  );
}

function RegisteredMarketplaceAgentCard({ agent }: { agent: Agent }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
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
            <CardTitle className="text-xl">{agent.name}</CardTitle>
            <CardDescription>{agent.handle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm leading-6 text-[#273951]">{agent.headline}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric icon={CircleDollarSign} label="Token fee" value={formatAgentPriceShort(agent.pricePerCallUsd)} />
          <Metric icon={Clock3} label="Time" value={formatDuration(agent.latencyMs)} />
          <Metric icon={TrendingUp} label="Runs" value={formatRuns(agent.calls)} />
        </div>
        <div className="mt-4 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Published catalog agent · {agent.category} · {agent.creator}
        </div>
      </CardContent>
    </Card>
  );
}

function MyAgentAccessCard({
  agent,
  hirerId,
  record,
}: {
  agent: Agent;
  hirerId: string;
  record: AgentAccessRecord;
}) {
  const callSnippet = `hireme_call_agent({\n  "agent_id": "${agent.id}",\n  "task": "<your task>",\n  "hirer_id": "${hirerId}",\n  "hire_receipt_object_id": "${record.receiptObjectId}"\n})`;

  return (
    <Card>
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
              <CardTitle className="text-xl">{agent.name}</CardTitle>
              <CardDescription>{agent.handle}</CardDescription>
            </div>
          </div>
          <div className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-[#1c1e54]">
            {record.accessType === "hired" ? "Hired" : "Trial"}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm leading-6 text-[#273951]">{agent.headline}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={CircleDollarSign}
            label="Token fee"
            value={formatAgentPriceShort(record.pricePerCallUsd)}
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
            HireMe MCP에서 {agent.id} agent를 호출해줘. hirer_id는{" "}
            {hirerId}로 써.
          </div>
          {record.source === "local" ? (
            <div className="mb-3 mt-3 rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-xs leading-5 text-[#9f1239]">
              Local UI-only access. Start the gateway and press Try! or Hire!
              again so Codex calls can be authorized.
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
              {record.source === "gateway" ? "Gateway" : "Local demo"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item }: { item: MyActivityItem }) {
  const toneClass =
    item.tone === "registered"
      ? "border-[#533afd]/25 bg-secondary text-[#1c1e54]"
      : item.tone === "hired"
        ? "border-[#00b7a8]/30 bg-[#f2fffd] text-[#086b61]"
        : item.tone === "payment"
          ? "border-[#00b7a8]/30 bg-[#f2fffd] text-[#086b61]"
          : item.tone === "failed"
            ? "border-[#ea2261]/25 bg-[#fff8fb] text-[#9f1239]"
        : item.tone === "result"
          ? "border-[#f59e0b]/30 bg-[#fffaf0] text-[#92400e]"
          : "border-border bg-white text-[#273951]";

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
            {item.label}
          </span>
          <h3 className="truncate text-sm font-medium text-[#1c1e54]">
            {item.title}
          </h3>
        </div>
        <p className="mt-2 break-all text-xs leading-5 text-muted-foreground">
          {item.description}
        </p>
      </div>
      <div className="shrink-0 text-xs text-muted-foreground">
        {formatAccessDate(item.timestamp)}
      </div>
    </div>
  );
}

function DetailMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-[#273951]">{value}</div>
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
  const categories = Array.from(new Set(agents.flatMap(agentCategories)));
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
            value={formatAgentPriceShort(startingPrice)}
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
  isBusy,
  onHire,
  onTry,
}: {
  access?: AgentAccessRecord;
  agent: Agent;
  isBusy?: boolean;
  onHire: () => void;
  onTry: () => void;
}) {
  const isHired = access?.accessType === "hired";
  const isTrying = access?.accessType === "trial";
  const hasGatewayAccess = access?.source === "gateway";
  const navigate = useNavigate();

  function openDetails(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button,a,summary,details")) return;
    navigate(`/agents/${agent.id}`);
  }

  return (
    <Card
      className="cursor-pointer transition hover:-translate-y-0.5 hover:border-[#533afd]/35 hover:shadow-[rgba(0,55,112,0.08)_0_8px_24px]"
      onClick={openDetails}
    >
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
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <span className="number-cell inline-flex items-center gap-1 rounded-full border border-[#f5c451]/40 bg-[#fff9e8] px-2 py-0.5 text-xs font-medium text-[#7c5800]">
                  <Star className="size-3 fill-[#f5c451] text-[#f5c451]" />
                  {agent.rating.toFixed(1)}
                </span>
              </div>
              <CardDescription>{agent.handle}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 text-xs leading-5 text-muted-foreground">
          <div className="flex flex-wrap items-center gap-1.5">
            {agentCategories(agent).map((category) => (
              <span
                className="rounded-full border border-[#533afd]/15 bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-[#273951]"
                key={category}
              >
                {category}
              </span>
            ))}
            <span className="ml-1 text-xs text-muted-foreground">
              {formatRuns(agent.calls)} runs
            </span>
          </div>
        </div>

        <p className="min-h-16 text-sm leading-relaxed text-[#273951]">
          {agent.headline}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5 text-sm">
          <Metric
            icon={CircleDollarSign}
            label="Token(per 1M)"
            value={formatAgentPriceShort(agent.pricePerCallUsd)}
          />
          <Metric
            icon={Clock3}
            label="Average Time"
            value={formatDuration(agent.latencyMs)}
          />
          <Metric
            icon={Braces}
            label="Average Usage"
            value={formatTokenUsage(totalAverageTokens(agent))}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            className="w-full"
            disabled={isBusy || (hasGatewayAccess && (isTrying || isHired))}
            onClick={onTry}
            type="button"
            variant="secondary"
          >
            <Terminal /> Try!
          </Button>
          <Button
            className="w-full"
            disabled={isBusy || (hasGatewayAccess && isHired)}
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

function agentCategories(agent: Agent) {
  const categories = agent.categories?.length ? agent.categories : [agent.category];
  return Array.from(new Set(categories));
}

function formatTokens(tokens: number) {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}K`;
  }
  return tokens.toLocaleString();
}

function formatTokenUsage(tokens: number) {
  return `${formatTokens(tokens)} token`;
}

function formatRuns(runs: number) {
  if (runs >= 1_000_000) return `${(runs / 1_000_000).toFixed(1)}M`;
  if (runs >= 1000) return `${(runs / 1000).toFixed(runs >= 10_000 ? 0 : 1)}K`;
  return runs.toLocaleString();
}

function formatUsers(users: number) {
  if (users >= 1_000_000) return `${(users / 1_000_000).toFixed(1)}M`;
  if (users >= 1000) return `${(users / 1000).toFixed(users >= 10_000 ? 0 : 1)}K`;
  return users.toLocaleString();
}

function estimateActiveUsers(agent: Agent) {
  if (agent.activeUsers !== undefined) return agent.activeUsers;
  return Math.max(1, Math.round(agent.calls / 42));
}

function formatDuration(ms: number) {
  if (!ms) return "N/A";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  if (minutes > 0) return `${minutes} min`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatAgentPrice(price: number) {
  const displayPrice =
    price >= 1
      ? price.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
      : price.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
  return `${displayPrice} SUI/1M tokens`;
}

function formatAgentPriceShort(price: number) {
  const displayPrice =
    price >= 1
      ? price.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
      : price.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
  return `${displayPrice} SUI`;
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

function typicalOutputMediaType(file: File): "image" | "video" {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (file.type === "image/jpeg" || ["jpg", "jpeg"].includes(extension)) {
    return "image";
  }
  if (
    file.type.startsWith("video/") ||
    ["mp4", "webm", "mov"].includes(extension)
  ) {
    return "video";
  }
  throw new Error("Result media must be a JPG image or video file.");
}

function safeUploadFileName(file: File) {
  const fallbackExtension = file.type.startsWith("video/") ? "mp4" : "jpg";
  const extension = file.name.includes(".")
    ? file.name.split(".").pop() || fallbackExtension
    : fallbackExtension;
  const stem = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${stem || "typical-output"}.${extension.toLowerCase()}`;
}

async function uploadTypicalOutputMedia({
  agentSlug,
  file,
}: {
  agentSlug: string;
  file: File;
}) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase Storage is not configured.");
  }

  const mediaType = typicalOutputMediaType(file);
  const objectPath = `${agentSlug}/${Date.now()}-${crypto.randomUUID()}-${safeUploadFileName(file)}`;
  const { error } = await supabase.storage
    .from(typicalOutputStorageBucket)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(typicalOutputStorageBucket)
    .getPublicUrl(objectPath);

  return {
    path: objectPath,
    type: mediaType,
    url: data.publicUrl,
  };
}


function CreateAgentPage({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState({
    agentName: "Private Code Reviewer",
    headline: "Reviews pull requests and returns concrete risks, fixes, and verification steps.",
    description:
      "A protected code review Agent for product teams that need implementation feedback with consistent severity, fix guidance, and test recommendations.",
    howToUse:
      "Ask this Agent to review a pull request, migration, or implementation plan. Include the diff, repository context, and the kind of risk you want prioritized.",
    typicalOutputTitle: "Pull request risk review",
    typicalOutputSummary:
      "Returns prioritized findings, suggested patches, missing tests, and rollout notes.",
    typicalOutputSample:
      "High: RLS policy allows cross-tenant reads. Fix by scoping owner_id in the policy and add a regression test for rejected tenant access.",
    modelId: "gpt-5.4" as CreatorModelId,
    creatorFeePerCallUsd: "1.000",
  });
  const [agentFiles, setAgentFiles] = useState<File[]>([]);
  const [typicalOutputMedia, setTypicalOutputMedia] = useState<File | null>(null);
  const [typicalOutputMediaPreviewUrl, setTypicalOutputMediaPreviewUrl] =
    useState<string | null>(null);
  const [uploadedTypicalOutputMedia, setUploadedTypicalOutputMedia] = useState<{
    path: string;
    type: "image" | "video";
    url: string;
  } | null>(null);
  const [sealedRecord, setSealedRecord] = useState<SealedHarnessRecord>();
  const [isSealing, setIsSealing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
  const currentTypicalOutputMediaUrl =
    typicalOutputMediaPreviewUrl || uploadedTypicalOutputMedia?.url || "";
  const currentTypicalOutputMediaType = typicalOutputMedia
    ? typicalOutputMedia.type.startsWith("video/")
      ? "video"
      : "image"
    : uploadedTypicalOutputMedia?.type;

  useEffect(() => {
    return () => {
      if (typicalOutputMediaPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(typicalOutputMediaPreviewUrl);
      }
    };
  }, [typicalOutputMediaPreviewUrl]);

  async function sealHarness() {
    setIsSealing(true);
    setCreateError(null);
    try {
      const harnessFile = agentFiles[0];
      if (!harnessFile) {
        throw new Error("Upload a .tar.gz Agent Harness before creating.");
      }

      const typicalOutputUpload = typicalOutputMedia
        ? await uploadTypicalOutputMedia({
            agentSlug,
            file: typicalOutputMedia,
          })
        : uploadedTypicalOutputMedia;

      const gatewayRegistration = await createAgentWithGatewayUpload({
        draft,
        agentSlug,
        selectedModel,
        creatorFeePerCallUsd,
        totalPricePerCallUsd,
        publicCapability,
        typicalOutputUpload,
        harnessFile,
        user,
      });
      const registeredArtifact = gatewayRegistration.protectedArtifact;
      if (
        !registeredArtifact?.walrusBlobId ||
        !registeredArtifact.suiObjectId ||
        !registeredArtifact.ciphertextDigest
      ) {
        throw new Error("Gateway did not return a protected artifact record.");
      }

      const record: SealedHarnessRecord = {
        id: `gateway_${agentSlug}_${registeredArtifact.ciphertextDigest
          .replace(/^sha256:/, "")
          .slice(0, 12)}`,
        agentName: draft.agentName,
        description: draft.description || draft.headline,
        modelId: selectedModel.id,
        modelLabel: selectedModel.label,
        network: registeredArtifact.network || "walrus-testnet",
        sealProvider:
          registeredArtifact.encryptionProvider || "platform_encryption",
        platformKmsKeyId:
          registeredArtifact.platformKmsKeyId || "platform:local-dev-key",
        sealPolicyId:
          registeredArtifact.sealPolicyId || `platform:agent:${agentSlug}`,
        walrusBlobId: registeredArtifact.walrusBlobId,
        suiObjectId: registeredArtifact.suiObjectId,
        encryptionId:
          registeredArtifact.sealEncryptionId ||
          `hireme::agent-folder::${agentSlug}`,
        sealCiphertextFormat:
          registeredArtifact.ciphertextFormat ||
          "hireme.platform_encryption.v1",
        sealThreshold: registeredArtifact.sealThreshold ?? 0,
        sealKeyServerIds: registeredArtifact.sealKeyServerIds || [],
        ciphertextDigest: registeredArtifact.ciphertextDigest,
        fileName: harnessFile.name,
        fileSize:
          gatewayRegistration.upload?.ciphertextSizeBytes || harnessFile.size,
        fileCount: gatewayRegistration.upload?.entryCount || 1,
        entryPreview: gatewayRegistration.upload?.entryPreview || [
          harnessFile.name,
        ],
        epochs: 3,
        basePricePerCallUsd: selectedModel.basePricePerCallUsd,
        creatorFeePerCallUsd,
        pricePerCallUsd: totalPricePerCallUsd,
        policyRule: `Caller must hold an active AgentHireReceipt. Results commit safe summaries and artifact digests to ${memWalScope}.`,
        createdAt: gatewayRegistration.registeredAt || new Date().toISOString(),
      };

      writeCreatedAgentRecord({
        id: record.id,
        creatorId: user ? creatorIdFor(user) : "local-anonymous",
        creatorEmail: user?.email || "",
        agentName: draft.agentName,
        agentSlug,
        headline: draft.headline,
        description: draft.description || draft.headline,
        howToUse: draft.howToUse,
        typicalOutputTitle: draft.typicalOutputTitle,
        typicalOutputSummary: draft.typicalOutputSummary,
        typicalOutputSample: draft.typicalOutputSample,
        typicalOutputMediaUrl: typicalOutputUpload?.url,
        typicalOutputMediaPath: typicalOutputUpload?.path,
        typicalOutputMediaType: typicalOutputUpload?.type,
        modelId: selectedModel.id,
        modelLabel: selectedModel.label,
        pricePerCallUsd: totalPricePerCallUsd,
        basePricePerCallUsd: selectedModel.basePricePerCallUsd,
        creatorFeePerCallUsd,
        walrusBlobId: registeredArtifact.walrusBlobId,
        suiObjectId: registeredArtifact.suiObjectId,
        ciphertextDigest: registeredArtifact.ciphertextDigest,
        fileCount: record.fileCount,
        createdAt: record.createdAt,
        status: "Published",
        source: "gateway",
      });
      if (typicalOutputUpload) {
        setUploadedTypicalOutputMedia(typicalOutputUpload);
      }
      setSealedRecord(record);
      navigate(`/agents/${agentSlug}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create Agent.",
      );
    } finally {
      setIsSealing(false);
    }
  }

  const updateDraft =
    (field: keyof typeof draft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };

  function handleTypicalOutputMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setCreateError(null);
    setUploadedTypicalOutputMedia(null);
    if (!file) {
      setTypicalOutputMedia(null);
      setTypicalOutputMediaPreviewUrl(null);
      return;
    }

    try {
      typicalOutputMediaType(file);
      if (typicalOutputMediaPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(typicalOutputMediaPreviewUrl);
      }
      setTypicalOutputMedia(file);
      setTypicalOutputMediaPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setTypicalOutputMedia(null);
      setTypicalOutputMediaPreviewUrl(null);
      setCreateError(
        err instanceof Error ? err.message : "Unsupported media file.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <Button asChild size="sm" type="button" variant="ghost">
            <Link to="/agents">
              <Search /> Back to agents
            </Link>
          </Button>
          <div className="mt-6 max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
              <PackageOpen className="size-4 text-primary" />
              Create Agent
            </div>
            <h1 className="mt-3 text-4xl font-light leading-tight text-[#0d253d] md:text-5xl">
              Publish a paid Agent
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Define the public page, upload the protected Harness, and set a
              token-based fee for Codex users.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Start with the short public explanation buyers see first.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Agent name">
                  <Input value={draft.agentName} onChange={updateDraft("agentName")} />
                </Field>
                <Field label="One-line description">
                  <Input value={draft.headline} onChange={updateDraft("headline")} />
                </Field>
                <Field className="md:col-span-2" label="Description">
                  <textarea
                    className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={updateDraft("description")}
                    placeholder="What does this Agent do, and why should someone hire it?"
                    value={draft.description}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How to use</CardTitle>
                <CardDescription>
                  Tell buyers what to ask for, what context to provide, and
                  what kind of result they can expect.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <textarea
                  className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={updateDraft("howToUse")}
                  value={draft.howToUse}
                />
                <Field label="Result title">
                  <Input
                    value={draft.typicalOutputTitle}
                    onChange={updateDraft("typicalOutputTitle")}
                  />
                </Field>
                <Field label="Result summary">
                  <Input
                    value={draft.typicalOutputSummary}
                    onChange={updateDraft("typicalOutputSummary")}
                  />
                </Field>
                <Field label="Sample result">
                  <textarea
                    className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={updateDraft("typicalOutputSample")}
                    value={draft.typicalOutputSample}
                  />
                </Field>
                <Field label="Result image or video">
                  <input
                    accept=".jpg,.jpeg,video/*"
                    className="block w-full rounded-md border border-dashed border-input bg-white px-3 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                    onChange={handleTypicalOutputMediaChange}
                    type="file"
                  />
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    Stored in Supabase Storage when you create the Agent.
                  </span>
                </Field>
                {currentTypicalOutputMediaUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-secondary">
                    {currentTypicalOutputMediaType === "video" ? (
                      <video
                        className="aspect-video w-full bg-black object-contain"
                        controls
                        src={currentTypicalOutputMediaUrl}
                      />
                    ) : (
                      <img
                        alt="Result preview"
                        className="aspect-video w-full object-cover"
                        src={currentTypicalOutputMediaUrl}
                      />
                    )}
                    {uploadedTypicalOutputMedia ? (
                      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        Stored at {uploadedTypicalOutputMedia.path}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Harness files</CardTitle>
                <CardDescription>
                  Upload the private Harness archive.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
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
              </CardContent>
            </Card>
          </div>

          <aside className="top-24 h-fit space-y-5 lg:sticky">
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Fees are charged per million tokens used by this Agent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Base fee">
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
                </div>
                <div className="rounded-lg border border-[#533afd]/20 bg-secondary p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Final token fee
                  </div>
                  <div className="mt-1 number-cell text-2xl font-light text-[#1c1e54]">
                    {formatAgentPrice(totalPricePerCallUsd)}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {formatAgentPrice(selectedModel.basePricePerCallUsd)} base +{" "}
                    {formatAgentPrice(creatorFeePerCallUsd)} creator fee
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Statistics are calculated later by the gateway from real usage
                  logs and saved to the marketplace database.
                </div>
                <Button
                  className="w-full"
                  disabled={isSealing}
                  onClick={sealHarness}
                  type="button"
                >
                  <UploadCloud /> {isSealing ? "Creating..." : "Create Agent"}
                </Button>
                <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#ea2261]" />
                  Gateway validates AGENTS.md, encrypts the archive, stores the
                  protected artifact, and registers the Agent.
                </div>
                {createError ? (
                  <div className="rounded-lg border border-[#ea2261]/20 bg-[#fff8fb] px-3 py-2 text-xs leading-5 text-[#9f1239]">
                    {createError}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>

        {sealedRecord ? (
          <div className="mx-auto max-w-7xl">
            <SealedRecordPreview record={sealedRecord} />
          </div>
        ) : null}
      </section>
    </main>
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
  const walrusCommand = record.walrusBlobId.startsWith("local_walrus_")
    ? `cat .hireme/walrus/local-blobs/*${record.walrusBlobId.replace("local_walrus_", "").slice(0, 24)}*.platform-encryption.json`
    : `walrus read ${record.walrusBlobId} --out ${record.fileName}.platform-encryption.json`;

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
        <RecordCell label="Token fee" value={formatAgentPrice(record.pricePerCallUsd)} />
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
          Protected artifact read
        </div>
        <code className="block break-all font-mono text-xs leading-5 text-[#1c1e54]">
          {walrusCommand}
        </code>
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
