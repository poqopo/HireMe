import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
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
  ArrowUp,
  ArrowLeft,
  Bot,
  Braces,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  LockKeyhole,
  LogIn,
  LogOut,
  PackageOpen,
  Search,
  ServerCog,
  ShieldCheck,
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

const trialCallAllowance = 100;
const hiremeGatewayOrigin = "https://hireme-gateway.onrender.com";
const codexCreatorSetupCommand = [
  "# Install the HireMe Creator plugin",
  "codex plugin marketplace add poqopo/HireMe --ref main",
  "codex plugin add hireme-creator --marketplace hireme-local",
  "",
  "# Connect the hired-Agent MCP server to the Render gateway",
  "codex mcp remove hireme || true",
  `codex mcp add hireme --url ${hiremeGatewayOrigin}/mcp --oauth-resource ${hiremeGatewayOrigin}/mcp`,
  "codex mcp login --scopes hireme:agents,hireme:call,hireme:manage hireme",
].join("\n");

const makeAgentSteps = [
  {
    title: "Start with a template",
    copy: "Use a ready Agent folder instead of starting blank.",
  },
  {
    title: "Add your know-how",
    copy: "Add prompts, examples, rubrics, skills, and hidden checks.",
  },
  {
    title: "Protect the Harness",
    copy: "Upload private files without exposing them to buyers.",
  },
  {
    title: "Publish and earn",
    copy: "Set pricing and get paid when buyers use the Agent.",
  },
];

const creatorIpLayers = [
  {
    label: "Buyer sees",
    items: ["Skills", "Price", "Sample output", "Version notes"],
  },
  {
    label: "Creator keeps",
    items: ["AGENTS.md", "Prompts", "Rubrics", "Examples", "Hidden checks"],
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
  {
    id: "publish",
    label: "How to Publish",
    children: [{ id: "publish-codex-setup", label: "Codex setup" }],
  },
  { id: "paid", label: "How to Get Paid" },
  { id: "roadmap", label: "Roadmap" },
] as const;

function useScrollReveal(scopeRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = scopeRef.current;

    if (!scope) {
      return;
    }

    const targets = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    if (!targets.length) {
      return;
    }

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      targets.forEach((target) => {
        target.classList.add("reveal-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("reveal-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.16,
      },
    );

    targets.forEach((target) => {
      observer.observe(target);
    });

    return () => {
      observer.disconnect();
    };
  }, [scopeRef]);
}

function revealDelayStyle(delayMs: number): CSSProperties {
  const revealDelayProperty = "--reveal-delay" as const;
  return {
    [revealDelayProperty]: `${delayMs}ms`,
  } as CSSProperties;
}

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
  { id: "agents", label: "Single Agent" },
  { id: "teams", label: "Agent Team" },
] as const;

type CatalogView = (typeof catalogViews)[number]["id"];

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
  pricePerCallUsd: number;
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
  version?: {
    versionNumber?: number;
    releaseNotes?: string;
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
      <AppShell
        authUser={authUser}
        isLoginOpen={isLoginOpen}
        onHomeClick={() => {
          window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }}
        onLogin={updateAuthUser}
        onLoginClose={() => setIsLoginOpen(false)}
        onLoginOpen={() => setIsLoginOpen(true)}
        onLogout={() => {
          void logout();
        }}
        onProfileSaved={(displayName) => {
          if (!authUser) return;
          updateAuthUser({ ...authUser, displayName });
        }}
        onWalletLinked={(wallet) => {
          if (!authUser) return;
          updateAuthUser({ ...authUser, wallet });
        }}
      />
    </BrowserRouter>
  );
}

function AppShell({
  authUser,
  isLoginOpen,
  onHomeClick,
  onLogin,
  onLoginClose,
  onLoginOpen,
  onLogout,
  onProfileSaved,
  onWalletLinked,
}: {
  authUser: AuthUser | null;
  isLoginOpen: boolean;
  onHomeClick: () => void;
  onLogin: (user: AuthUser | null) => void;
  onLoginClose: () => void;
  onLoginOpen: () => void;
  onLogout: () => void;
  onProfileSaved: (displayName: string) => void;
  onWalletLinked: (wallet: string) => void;
}) {
  const location = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/") {
      return;
    }

    const threshold = 600;
    const updateVisibility = () => {
      setShowBackToTop(window.scrollY >= threshold);
    };

    const frame = window.requestAnimationFrame(updateVisibility);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [location.pathname]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <>
      <TopNav
        onHomeClick={onHomeClick}
        onLogout={onLogout}
        user={authUser}
        onLoginClick={onLoginOpen}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
        <Route
          path="/auth/callback"
          element={<AuthCallbackPage onLogin={onLogin} />}
        />
        <Route path="/auth/enoki/callback" element={<EnokiCallbackPage />} />
        <Route
          path="/agents"
          element={
            <ExploreAgentsPage
              onRequireLogin={onLoginOpen}
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
              onRequireLogin={onLoginOpen}
              user={authUser}
            />
          }
        />
        <Route
          path="/my"
          element={
            <MyAgentsPage
              onLogout={onLogout}
              onWalletLinked={onWalletLinked}
              onRequireLogin={onLoginOpen}
              user={authUser}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
      {location.pathname === "/" ? (
          <BackToTopButton
            onClick={scrollToTop}
            reducedMotion={reducedMotion}
            visible={location.pathname === "/" && showBackToTop}
          />
      ) : null}
      <LoginDialog open={isLoginOpen} onClose={onLoginClose} />
      <ProfileNameDialog
        key={authUser?.id || "signed-out"}
        onSaved={onProfileSaved}
        user={authUser}
      />
    </>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function BackToTopButton({
  onClick,
  reducedMotion,
  visible,
}: {
  onClick: () => void;
  reducedMotion: boolean;
  visible: boolean;
}) {
  return (
    <button
      aria-label="맨 위로 이동"
      className={[
        "fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 inline-flex size-11 items-center justify-center rounded-full border border-[rgba(49,130,246,0.18)] bg-[rgba(255,255,255,0.82)] text-[#3182f6] shadow-[0_16px_40px_rgba(15,52,96,0.14)] backdrop-blur-[14px] transition-[opacity,transform,box-shadow,background-color,border-color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(49,130,246,0.35)] focus-visible:ring-offset-2 md:right-6 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
        reducedMotion ? "" : "hover:-translate-y-0.5 hover:border-[rgba(49,130,246,0.26)] hover:bg-white",
        visible ? "pointer-events-auto opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-3",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <ArrowUp className="size-4" />
    </button>
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

function readAuthCallbackError(location: { hash: string; search: string }) {
  const searchParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const error =
    searchParams.get("error_description") ||
    hashParams.get("error_description") ||
    searchParams.get("error") ||
    hashParams.get("error");
  return error ? new Error(error) : null;
}

function formatAuthCallbackError(err: unknown) {
  const message =
    err instanceof Error ? err.message : "Could not complete Google sign-in.";
  if (message.includes("No Supabase session")) {
    return `Google returned to HireMe, but Supabase did not create a session. Add ${window.location.origin}/auth/callback to the Supabase Redirect URLs and try again.`;
  }
  if (message.includes("Gateway web session failed")) {
    return `Google sign-in worked, but HireMe could not sync the gateway session. Check the gateway Supabase keys and try again. ${message}`;
  }
  if (message.includes("Supabase Auth is not configured")) {
    return "Supabase Auth is not configured for this deployment.";
  }
  return message;
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
  return normalizeHirerId(user.email || user.wallet || "local-hirer");
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
    skills: ["Protected Harness", "Codex MCP"],
    protected_asset_classes: [
      "Agent Harness archive",
      "AGENTS.md",
      "skills/**",
      "private prompts",
    ],
    price_per_1m_tokens_sui: totalPricePerCallUsd,
    price_per_1m_tokens_usd: totalPricePerCallUsd,
    price_per_call_usd: totalPricePerCallUsd,
    free_calls: trialCallAllowance,
    storage_network: "walrus-testnet",
    result_title: draft.typicalOutputTitle,
    result_summary: draft.typicalOutputSummary,
    result_sample: draft.typicalOutputSample,
    result_media_url: typicalOutputUpload?.url,
    result_media_type: typicalOutputUpload?.type,
    metadata: {
      source: "web_create_agent",
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

async function updateAgentWithGatewayUpload({
  agent,
  harnessFile,
  releaseNotes,
  user,
}: {
  agent: Agent;
  harnessFile: File;
  releaseNotes: string;
  user: AuthUser | null;
}): Promise<GatewayAgentRegistrationResult> {
  const creator =
    agent.creator || user?.displayName || user?.email || user?.wallet || "Web creator";
  const tokenPrice = agent.pricePer1MTokensSui ?? agent.pricePerCallUsd;
  const metadata = {
    agent_id: agent.id,
    name: agent.name,
    handle: agent.handle,
    creator,
    category: agent.category,
    status: agent.status,
    headline: agent.headline,
    public_summary: agent.publicSummary || agent.headline,
    public_mcp_contract:
      agent.publicContract || `${agent.id}(task, context, budget_calls)`,
    memwal_policy: agent.memwalPolicy,
    skills: agent.skills,
    protected_asset_classes: agent.protectedAssets?.length
      ? agent.protectedAssets
      : ["AGENTS.md", "skills/**", "private prompts"],
    price_per_1m_tokens_sui: tokenPrice,
    price_per_1m_tokens_usd: tokenPrice,
    price_per_call_usd: tokenPrice,
    free_calls: trialCallAllowance,
    storage_network: "walrus-testnet",
    release_notes: releaseNotes || "Updated from the HireMe web creator UI.",
    result_title: agent.resultPreview.title,
    result_summary: agent.resultPreview.summary,
    result_sample: agent.resultPreview.sample,
    result_media_url: agent.resultPreview.mediaUrl,
    result_media_type: agent.resultPreview.mediaType,
    metadata: {
      source: "web_update_agent",
      updatedBy:
        user?.email || user?.wallet || user?.displayName || "anonymous-web-user",
    },
  };
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(metadata));
  formData.append("harness", harnessFile, harnessFile.name);

  const response = await fetch(`${gatewayUrl}/v1/agents/update`, {
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
    ...(accessType === "trial" ? { trial_calls: trialCallAllowance } : {}),
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
        includedCalls: trialCallAllowance,
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
      "Protected Harness",
      "Codex MCP",
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
    freeCalls: trialCallAllowance,
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
    trialCallsRemaining: accessType === "trial" ? trialCallAllowance : null,
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
  onHomeClick,
  onLogout,
  user,
  onLoginClick,
}: {
  onHomeClick: () => void;
  onLogout: () => void;
  user: AuthUser | null;
  onLoginClick: () => void;
}) {
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const isAgents = location.pathname === "/agents";

  return (
    <header className={`sticky top-0 z-40 border-b px-4 backdrop-blur-xl md:px-8 ${isLanding ? "border-[#bfdbfe]/50 bg-white/88" : "border-border bg-white/92"}`}>
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 py-2">
        {isLanding ? (
          <button
            aria-label="맨 위로 이동"
            className="flex items-center gap-2 text-left transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(49,130,246,0.35)] focus-visible:ring-offset-2"
            onClick={onHomeClick}
            type="button"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0753d6] to-[#38a8f7] text-white shadow-[rgba(7,83,214,0.24)_0_8px_20px]">
              <Bot className="size-4" />
            </span>
            <span className="text-sm font-medium text-[#082b63]">HireMe</span>
          </button>
        ) : (
          <Link className="flex items-center gap-2" to="/">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#1c1e54] text-white">
              <Bot className="size-4" />
            </span>
            <span className="text-sm font-medium text-[#0d253d]">HireMe</span>
          </Link>
        )}

        {isLanding ? (
          <Link
            className="text-xs font-medium text-[#42658f] transition hover:text-[#0753d6]"
            to="/docs"
          >
            Docs
          </Link>
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
  const locationHash = location.hash;
  const locationSearch = location.search;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      const callbackError = readAuthCallbackError({
        hash: locationHash,
        search: locationSearch,
      });
      if (callbackError) throw callbackError;

      if (!supabase) {
        throw new Error("Supabase Auth is not configured.");
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        throw new Error("No Supabase session was returned.");
      }

      if (cancelled) return;
      const user = authUserFromSupabaseSession(data.session);
      await syncGatewayWebSession(
        data.session.access_token,
        user.wallet,
        user.displayName,
      );

      if (cancelled) return;
      onLogin(user);
      writeStoredAuthUser(user);

      const params = new URLSearchParams(locationSearch);
      const returnTo = safeReturnTo(params.get("return_to"));
      if (cancelled) return;
      if (returnTo) {
        window.location.assign(returnTo);
        return;
      }
      if (!cancelled) navigate("/my", { replace: true });
    }

    void completeLogin().catch((err) => {
      if (!cancelled) {
        setError(formatAuthCallbackError(err));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [locationHash, locationSearch, navigate, onLogin]);

  return (
    <main className="flex min-h-[calc(100svh-5rem)] items-center justify-center bg-secondary px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-border bg-white p-6 app-shadow">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
          <UserRound className="size-4 text-primary" />
          Login
        </div>
        <h1 className="mt-4 text-3xl font-light leading-tight text-[#0d253d]">
          Signing you in
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Securing your HireMe session. This can take a few seconds.
        </p>
        <div className="mt-6" aria-live="polite">
          <div
            aria-label="Sign-in progress"
            className="h-2 overflow-hidden rounded-full bg-[#e8ebf3]"
            role={error ? "presentation" : "progressbar"}
          >
            <div
              className={`h-full rounded-full ${
                error
                  ? "w-1/3 bg-[#ea2261]"
                  : "auth-callback-progress bg-[#635bff] shadow-[0_0_18px_rgba(99,91,255,0.28)]"
              }`}
            />
          </div>
        </div>
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

function HeroAgentPreview() {
  return (
    <div
      aria-hidden="true"
      className="hero-demo-visual pointer-events-none relative mx-auto min-h-[410px] w-full max-w-[570px] select-none sm:min-h-[450px] lg:min-h-[510px]"
    >
      <div className="hero-demo-glow absolute inset-x-[10%] top-[16%] h-[64%] rounded-full bg-[rgba(124,92,255,0.15)] blur-[100px]" />

      <div className="absolute inset-x-[3%] top-1 flex items-center justify-between gap-2 sm:inset-x-[5%]">
        <div className="hero-demo-chip flex items-center gap-2 rounded-full border border-[rgba(124,92,255,0.09)] bg-white/[0.34] py-1.5 pl-1.5 pr-3 text-[10px] font-semibold text-[#756b8d] backdrop-blur-xl">
          <span className="flex size-7 items-center justify-center rounded-full bg-[rgba(124,92,255,0.08)] text-[#8475a8]">
            <UserRound className="size-3.5" />
          </span>
          You
        </div>
        <div className="hero-demo-chip hero-demo-chip-agent flex translate-y-2 items-center gap-2 rounded-full border border-[rgba(124,92,255,0.1)] bg-white/[0.38] py-1.5 pl-1.5 pr-3 text-[10px] font-semibold text-[#6e618b] backdrop-blur-xl">
          <span className="flex size-7 items-center justify-center rounded-full bg-[rgba(124,92,255,0.1)] text-[#7560b5]">
            <Bot className="size-3.5" />
          </span>
          Design Agent
        </div>
        <div className="hero-demo-chip flex translate-y-4 items-center gap-2 rounded-full border border-[rgba(124,92,255,0.09)] bg-white/[0.3] px-3 py-2 text-[10px] font-semibold text-[#756b8d] backdrop-blur-xl">
          Result ready
        </div>
      </div>

      <div className="absolute inset-x-[3%] top-[16%] h-[330px] sm:inset-x-0 sm:h-[350px] lg:top-[18%]">
        <div
          className="hero-demo-card hero-demo-card--task h-[300px] sm:h-[320px]"
          style={{ animationDelay: "0s" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7d7199]">Before: rough idea</span>
            <span className="text-[10px] font-medium text-[#a097b4]">01</span>
          </div>
          <div className="mt-5 text-xl font-bold tracking-[-0.025em] text-[#2d2740] sm:text-2xl">
            Make this landing page clearer.
          </div>
          <div className="mt-6 rounded-[20px] border border-[rgba(124,92,255,0.1)] bg-white/[0.36] p-4">
            <div className="h-2 w-[82%] rounded-full bg-[rgba(99,70,245,0.12)]" />
            <div className="mt-3 h-2 w-[64%] rounded-full bg-[rgba(99,70,245,0.08)]" />
            <div className="mt-5 inline-flex rounded-full border border-[rgba(124,92,255,0.1)] px-3 py-1.5 text-[10px] font-semibold text-[#807594]">
              Landing page review
            </div>
          </div>
        </div>

        <div
          className="hero-demo-card hero-demo-card--working h-[300px] sm:h-[320px]"
          style={{ animationDelay: "-9s" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7d7199]">Agent running</span>
            <span className="text-[10px] font-medium text-[#a097b4]">02</span>
          </div>
          <div className="mt-5 text-xl font-bold tracking-[-0.025em] text-[#2d2740] sm:text-2xl">
            Design Agent is running
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(124,92,255,0.11)] bg-[rgba(124,92,255,0.055)] px-3 py-1.5 text-[10px] font-semibold text-[#74668f]">
            <ShieldCheck className="size-3.5" />
            Protected Harness
          </div>
          <div className="mt-7">
            <div className="flex items-center justify-between text-[10px] font-medium text-[#948aa7]">
              <span>Applying standards and hidden checks</span>
              <span>Working</span>
            </div>
            <div className="hero-demo-progress mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(124,92,255,0.08)]" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="h-14 rounded-2xl border border-[rgba(124,92,255,0.08)] bg-white/[0.26]" />
              <div className="h-14 rounded-2xl border border-[rgba(124,92,255,0.08)] bg-white/[0.22]" />
              <div className="h-14 rounded-2xl border border-[rgba(124,92,255,0.08)] bg-white/[0.18]" />
            </div>
          </div>
        </div>

        <div
          className="hero-demo-card hero-demo-card--result-primary h-[300px] sm:h-[320px]"
          style={{ animationDelay: "-6s" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6f6190]">After: polished landing</span>
            <span className="rounded-full border border-[rgba(124,92,255,0.1)] bg-[rgba(124,92,255,0.05)] px-2.5 py-1 text-[9px] font-semibold text-[#756890]">Delivered</span>
          </div>
          <div className="mt-4 text-xl font-bold tracking-[-0.025em] text-[#2d2740] sm:text-2xl">
            Hero copy improved
          </div>
          <div className="mt-5 rounded-[20px] border border-[rgba(124,92,255,0.09)] bg-white/[0.32] p-4">
            <div className="h-3 w-[72%] rounded-full bg-[rgba(79,53,216,0.16)]" />
            <div className="mt-3 h-2 w-[88%] rounded-full bg-[rgba(99,70,245,0.09)]" />
            <div className="mt-2 h-2 w-[76%] rounded-full bg-[rgba(99,70,245,0.07)]" />
            <div className="mt-5 flex gap-2">
              <div className="h-7 w-20 rounded-full bg-[rgba(99,70,245,0.13)]" />
              <div className="h-7 w-24 rounded-full border border-[rgba(124,92,255,0.1)] bg-white/[0.18]" />
            </div>
          </div>
          <div className="mt-4 text-xs font-semibold text-[#756890]">CTA hierarchy fixed</div>
        </div>

        <div
          className="hero-demo-card hero-demo-card--result-secondary h-[300px] sm:h-[320px]"
          style={{ animationDelay: "-3s" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6f6190]">Prompt ready</span>
            <span className="text-[10px] font-medium text-[#a097b4]">04</span>
          </div>
          <div className="mt-4 text-xl font-bold tracking-[-0.025em] text-[#2d2740] sm:text-2xl">
            Codex prompt generated
          </div>
          <div className="mt-5 rounded-[20px] border border-[rgba(124,92,255,0.09)] bg-[#2f2942]/[0.82] p-4">
            <div className="h-2 w-[44%] rounded-full bg-[rgba(196,184,255,0.42)]" />
            <div className="mt-3 h-2 w-[82%] rounded-full bg-[rgba(196,184,255,0.24)]" />
            <div className="mt-2 h-2 w-[68%] rounded-full bg-[rgba(196,184,255,0.18)]" />
            <div className="mt-2 h-2 w-[74%] rounded-full bg-[rgba(196,184,255,0.14)]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px] font-semibold text-[#756890]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-[#806bd0]" />
              Design reviewed
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-[#806bd0]" />
              Result delivered
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const revealScopeRef = useRef<HTMLElement | null>(null);

  useScrollReveal(revealScopeRef);

  return (
    <main
      ref={revealScopeRef}
      className="overflow-hidden bg-gradient-to-b from-[#f9fafb] via-[#f6faff] to-[#e8f3ff]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none h-0"
      />
      <section className="hero-visual relative overflow-hidden px-4 pb-16 pt-8 md:px-8 md:pb-20 md:pt-10 lg:py-12">
        <div className="mx-auto grid min-h-[calc(100svh-5rem)] page-shell w-full items-center gap-14 lg:grid-cols-[minmax(0,0.98fr)_minmax(400px,1.02fr)] lg:gap-20 xl:gap-24">
          <div className="landing-hero-copy max-w-[680px] py-0">
            <div className="reveal stagger-item" data-reveal>
              <h1 className="hero-title balanced-text text-[#191f28]">
                Hire Agents that already know the job.
              </h1>
            </div>
            <div
              className="reveal stagger-item"
              data-reveal
              style={revealDelayStyle(140)}
            >
              <p className="body-copy pretty-text mt-6 max-w-[620px]">
                Hire protected AI Agents, not copyable prompts. Creators keep the Harness. Buyers get the result.
              </p>
            </div>
            <div
              className="reveal stagger-item"
              data-reveal
              style={revealDelayStyle(240)}
            >
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="border-transparent bg-gradient-to-r from-[#7c5cff] via-[#6346f5] to-[#4f35d8] text-white shadow-[0_18px_40px_rgba(99,70,245,0.24)] hover:shadow-[0_24px_52px_rgba(99,70,245,0.32)] active:shadow-[0_12px_24px_rgba(79,53,216,0.2)] focus-visible:ring-[rgba(124,92,255,0.38)]"
                  size="lg"
                >
                  <Link to="/agents">
                    <Bot /> Hire an Agent
                  </Link>
                </Button>
                <Button
                  asChild
                  className="border-[rgba(124,92,255,0.26)] bg-white/[0.78] text-[#6346f5] shadow-[0_16px_32px_rgba(79,53,216,0.08)] hover:border-[rgba(124,92,255,0.36)] hover:bg-[#f7f5ff] hover:shadow-[0_20px_40px_rgba(79,53,216,0.13)] focus-visible:ring-[rgba(124,92,255,0.32)]"
                  size="lg"
                  variant="secondary"
                >
                  <Link to="/agents/create">
                    <UploadCloud /> Publish an Agent
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="reveal stagger-item" data-reveal style={revealDelayStyle(180)}>
            <div className="lg:translate-x-8 xl:translate-x-14">
              <HeroAgentPreview />
            </div>
          </div>
        </div>
      </section>

      <ProtectedExecutionSection />
      <CreatorIpSection />
      <AgentPerformanceSection />
      <MakeAgentSection />
      <ProofLayerSection />
      <LandingFooter />
    </main>
  );
}

function ProtectedExecutionSection() {
  const steps = [
    { label: "Buyer task", note: "Private input" },
    { label: "Secure runner", note: "HireMe gateway" },
    { label: "Private Harness", note: "Gateway-only run" },
    { label: "Buyer gets result", note: "Output + receipt" },
  ];

  return (
    <section className="relative overflow-hidden bg-[#1d1f5d] px-4 py-20 text-white md:px-8 md:py-28 lg:flex lg:min-h-[100svh] lg:items-center">
      <div className="relative z-10 mx-auto page-shell w-full">
        <div className="reveal max-w-2xl" data-reveal>
          <div className="inline-flex rounded-full border border-white/14 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/72">
            Protected execution
          </div>
          <h2 className="mt-3 max-w-[13ch] text-[clamp(1.95rem,4vw,3.1rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white text-balance md:max-w-[12ch]">
            <span className="block">The Agent works.</span>
            <span className="block">The playbook never leaves.</span>
          </h2>
          <p className="mt-4 max-w-[42rem] text-[1rem] leading-[1.65] text-white/80 md:text-[1.05rem]">
            Buyer work goes through HireMe. The creator’s Harness stays private.
          </p>
        </div>

        <div className="relative mt-12 grid grid-cols-2 items-stretch gap-4 md:grid-cols-4 md:gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <div
              className="reveal stagger-item relative z-10 flex min-h-36 min-w-0 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center md:min-h-40 md:gap-4 md:rounded-[24px] md:p-5"
              data-reveal
              key={step.label}
              style={revealDelayStyle(120 * index)}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-xs font-semibold text-white/90 shadow-[0_10px_24px_rgba(2,6,23,0.14)] md:size-12 md:text-[0.9rem]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-snug text-white/95 md:text-[0.95rem]">{step.label}</div>
                <div className="mt-1.5 text-xs leading-snug text-white/62 md:text-[0.8rem]">{step.note}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

function AgentPerformanceSection() {
  return (
    <section id="agent-performance" className="agent-performance-section relative isolate -mt-px flex items-center overflow-hidden px-4 py-24 md:px-8 md:py-28 lg:min-h-[calc(100svh-72px)] lg:py-32">
      <div className="relative z-10 mx-auto page-shell w-full">
        <div className="reveal" data-reveal>
          <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#3182f6]">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eaf5ff] text-[#0877ec] shadow-sm">
              <TrendingUp className="size-5" />
            </span>
            Agent performance
          </div>
          <h2 className="section-title max-w-[680px] text-[#191f28]">
            Same prompt. Better output.
          </h2>
          <p className="body-copy mt-5 max-w-[680px]">
            The prompt stays the same. A private Harness adds the standards,
            examples, and checks needed for production-ready work.
          </p>
        </div>

        <div className="mt-10 grid gap-5 pb-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:pb-12">
          <div className="reveal" data-reveal>
            <HarnessImageCard
              caption="Without Harness"
              image="/assets/harness-before.svg"
              label="Before"
            />
          </div>
          <div className="reveal stagger-item flex items-center justify-center gap-3 text-center lg:flex-col" data-reveal style={revealDelayStyle(120)}>
            <div className="flex size-11 items-center justify-center rounded-full border border-[rgba(49,130,246,0.18)] bg-white/[0.86] text-xs font-semibold text-[#3182f6] shadow-[0_8px_20px_rgba(30,64,175,0.07)]">
              →
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#6b7684]">
              Harness applied
            </div>
          </div>
          <div className="reveal stagger-item" data-reveal style={revealDelayStyle(180)}>
            <HarnessImageCard
              caption="With Harness"
              image="/assets/harness-after.svg"
              label="After"
            />
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
    <figure className="overflow-hidden rounded-[28px] border border-[rgba(49,130,246,0.14)] bg-white/[0.88] shadow-[0_18px_46px_rgba(30,64,175,0.075)]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(49,130,246,0.1)] px-4 py-3">
        <figcaption className="text-sm font-medium text-[#191f28]">
          {caption}
        </figcaption>
        <span className="rounded-full border border-[rgba(49,130,246,0.1)] bg-[rgba(232,243,255,0.66)] px-3 py-1.5 text-xs font-medium text-[#4e5968]">
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

function CopyableCodeBlock({
  code,
  description,
  label,
}: {
  code: string;
  description?: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    await writeTextToClipboard(code);
    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#b7d7ff] bg-[#07162d] shadow-[0_16px_42px_rgba(8,27,61,0.16)]">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold leading-5 text-white">
            <Terminal className="size-4 text-[#8ec5ff]" />
            <span>{label}</span>
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-white/62">
              {description}
            </p>
          ) : null}
        </div>
        <button
          aria-label={`Copy ${label}`}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec5ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07162d]"
          onClick={() => {
            void handleCopy();
          }}
          type="button"
        >
          {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="m-0 max-h-[360px] overflow-x-auto p-4 text-left text-[0.78rem] leading-6 text-[#dbeafe] sm:text-[0.82rem]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

async function writeTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function MakeAgentSection() {
  return (
    <section id="make-agent" className="relative isolate -mt-px overflow-hidden bg-[#f4f9ff] px-4 py-20 md:px-8 md:py-28 lg:flex lg:min-h-[100svh] lg:items-center lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 14% 24%, rgba(49, 130, 246, 0.12), transparent 34%), radial-gradient(circle at 88% 78%, rgba(49, 130, 246, 0.09), transparent 38%), linear-gradient(180deg, #f9fcff 0%, #f4f9ff 46%, #eaf4ff 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 -top-[180px] z-0 h-[320px] bg-gradient-to-b from-white via-[#f9fcff]/95 to-transparent blur-2xl"
      />
      <div className="relative z-10 mx-auto grid page-shell w-full gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16 xl:gap-20">
        <div className="lg:self-center lg:-translate-y-10">
          <div className="reveal" data-reveal>
            <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#3182f6]">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-[#0877ec] shadow-sm">
                <UploadCloud className="size-5" />
              </span>
              How to create one
            </div>
            <h2 className="section-title text-[#191f28]">
              Make an Agent in four steps.
            </h2>
            <p className="body-copy mt-5 max-w-[680px]">
              You do not need to start from a blank folder. Use Codex to scaffold
              the template, fill in the Harness, then upload it to HireMe.
            </p>
          </div>
        </div>

        <div className="reveal stagger-item" data-reveal style={revealDelayStyle(140)}>
          <ol className="grid gap-5 md:gap-6">
            {makeAgentSteps.map((step, index) => (
              <li className="reveal stagger-item" data-reveal style={revealDelayStyle(index * 90)} key={step.title}>
                <div className="grid gap-4 md:grid-cols-[76px_1fr] md:items-stretch">
                  <div className="flex items-center gap-4 md:flex-col md:items-center md:justify-start">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[rgba(49,130,246,0.18)] bg-[rgba(232,243,255,0.82)] text-sm font-semibold text-[#1b64da] shadow-[0_8px_22px_rgba(30,100,218,0.08)]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    {index < makeAgentSteps.length - 1 ? (
                      <div className="hidden min-h-8 w-px flex-1 bg-gradient-to-b from-[rgba(49,130,246,0.18)] via-[rgba(49,130,246,0.12)] to-transparent opacity-70 md:block" />
                    ) : null}
                  </div>
                  <div className="rounded-[22px] border border-[rgba(49,130,246,0.12)] bg-white/[0.66] px-5 py-[18px] shadow-[0_12px_32px_rgba(30,100,218,0.045)] backdrop-blur-sm md:px-[22px]">
                    <h3 className="docs-card-title text-[#191f28]">
                      {step.title}
                    </h3>
                    <p className="mt-2 docs-card-copy max-w-[560px]">
                      {step.copy}
                    </p>
                    {index === 0 ? (
                      <div className="mt-4 max-w-[720px]">
                        <CopyableCodeBlock
                          code={codexCreatorSetupCommand}
                          description="Installs the creator template plugin and connects Codex to the HireMe Render MCP server."
                          label="One-time Codex setup"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 border-t border-[rgba(49,130,246,0.1)] px-1 pt-4 text-[0.8rem] leading-[1.6] text-[#6b7684]">
            <span className="font-semibold text-[#191f28]">Built for existing Agent workflows.</span>{" "}
            Start from Codex, AGENTS.md, skills, or MCP tools—then package the know-how as a protected Harness.
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorIpSection() {
  return (
    <section id="creator-ip" className="creator-ip-section relative isolate -mt-px flex items-center overflow-hidden px-4 py-24 text-[#0d253d] md:px-8 md:py-28 lg:min-h-[calc(100svh-72px)] lg:py-32">
      <div
        aria-hidden="true"
        className="creator-ip-transition-top pointer-events-none absolute -inset-x-8 -top-4 z-0 h-64 md:h-72"
      />
      <div
        aria-hidden="true"
        className="creator-ip-transition-bottom pointer-events-none absolute -inset-x-8 -bottom-4 z-0 h-56 md:h-64"
      />
      <div className="relative z-10 mx-auto grid page-shell w-full gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div className="reveal" data-reveal>
          <div className="mb-5 flex items-center gap-3 text-sm font-semibold text-[#3182f6]">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-[#0877ec] shadow-sm">
              <LockKeyhole className="size-5" />
            </span>
            Private by design
          </div>
          <h2 className="section-title max-w-[680px] text-[#191f28]">
            Publish the Agent. Keep the recipe.
          </h2>
          <p className="body-copy mt-5 max-w-[680px]">
            Buyers see the capability. Creators keep the Harness and private files hidden.
          </p>
        </div>

        <div className="reveal stagger-item" data-reveal style={revealDelayStyle(140)}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <div className="rounded-[28px] border border-[rgba(49,130,246,0.12)] bg-white/[0.82] p-5 shadow-[0_18px_44px_rgba(30,64,175,0.065)] md:p-6">
              <div className="docs-card-title text-[#191f28]">
                Buyer sees
              </div>
              <div className="mt-4 grid">
                {creatorIpLayers[0].items.map((item, index) => (
                  <div className="reveal stagger-item flex items-center gap-3 border-b border-[rgba(49,130,246,0.09)] px-1 py-2.5 docs-card-copy last:border-b-0" data-reveal style={revealDelayStyle(index * 70)} key={item}>
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[rgba(49,130,246,0.42)]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex h-full min-h-24 items-center justify-center md:flex-col">
                <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-[rgba(49,130,246,0.18)] to-transparent md:block" />
                <div className="rounded-full border border-[rgba(49,130,246,0.16)] bg-[rgba(232,243,255,0.72)] px-4 py-2 text-xs font-semibold text-[#4e5968] md:my-3">
                  boundary
                </div>
                <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-[rgba(49,130,246,0.18)] to-transparent md:block" />
              </div>
            </div>
            <div className="rounded-[28px] border border-[rgba(49,130,246,0.12)] bg-white/[0.82] p-5 shadow-[0_18px_44px_rgba(30,64,175,0.065)] md:p-6">
              <div className="docs-card-title text-[#191f28]">
                Creator keeps
              </div>
              <div className="mt-4 grid">
                {creatorIpLayers[1].items.map((item, index) => (
                  <div className="reveal stagger-item flex items-center gap-3 border-b border-[rgba(49,130,246,0.09)] px-1 py-2.5 docs-card-copy last:border-b-0" data-reveal style={revealDelayStyle(index * 70)} key={item}>
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[rgba(49,130,246,0.42)]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofLayerSection() {
  const roadmap = [
    {
      title: "Now",
      copy: "Platform gateway, protected artifacts, and execution receipts.",
    },
    {
      title: "Next",
      copy: "Seal, TEE, and ICP directions for stronger privacy and access control.",
    },
    {
      title: "Later",
      copy: "A platform-free Agent hiring protocol with lighter platform dependence.",
    },
  ];

  return (
    <section className="relative isolate -mt-px overflow-hidden bg-[#f7fbff] px-4 py-20 md:px-8 md:py-28 lg:flex lg:min-h-[100svh] lg:items-center lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 12% 24%, rgba(49, 130, 246, 0.08), transparent 36%), radial-gradient(circle at 88% 74%, rgba(49, 130, 246, 0.06), transparent 40%)",
        }}
      />
      <div className="relative z-10 mx-auto grid page-shell w-full gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16 xl:gap-20">
        <div className="lg:self-center lg:-translate-y-6">
          <div className="reveal" data-reveal>
            <div className="eyebrow-label">Verifiable work</div>
            <h2 className="section-title mt-3 max-w-[680px] text-[#191f28]">Verification roadmap.</h2>
            <p className="body-copy mt-5 max-w-[680px]">Walrus stores protected Agent artifacts and execution records. Sui tracks access, usage, and payout receipts.</p>
          </div>
        </div>
        <div className="reveal" data-reveal style={revealDelayStyle(140)}>
          <div className="relative grid gap-5 md:gap-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-8 left-[7px] top-8 w-px bg-gradient-to-b from-transparent via-[rgba(49,130,246,0.18)] to-transparent"
            />
            {roadmap.map((item, index) => (
              <div className="reveal stagger-item relative z-10 pl-9" data-reveal style={revealDelayStyle(index * 120)} key={item.title}>
                <span className="absolute left-0 top-6 flex size-4 items-center justify-center rounded-full border-[4px] border-white bg-[#3182f6] shadow-[0_0_0_6px_rgba(49,130,246,0.12)]" />
                <div className="rounded-[22px] border border-[rgba(49,130,246,0.12)] bg-white/[0.66] px-5 py-[18px] shadow-[0_12px_32px_rgba(30,100,218,0.04)] backdrop-blur-sm md:px-[22px]">
                  <div className="docs-card-title text-[#191f28]">{item.title}</div>
                  <p className="mt-2 docs-card-copy max-w-[620px]">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
          <details className="group ml-9 mt-6 rounded-[22px] border border-[rgba(49,130,246,0.12)] bg-white/[0.74] px-4 py-3.5 backdrop-blur-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold leading-6 text-[#191f28] md:text-base [&::-webkit-details-marker]:hidden">
              Why this matters
              <span className="text-base text-[#3182f6] transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-[#4e5968]">
              Seal, TEE, ICP, and similar systems are part of the long-term direction for stronger privacy and access control.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <footer className="landing-footer-wave bg-gradient-to-b from-[#061b3d] via-[#06192f] to-[#03101f] px-4 py-14 text-white md:px-8 md:py-16">
      <div className="mx-auto grid page-shell gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="max-w-xl">
          <button
            aria-label="맨 위로 이동"
            className="flex items-center gap-2 text-sm font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(147,197,253,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06192f]"
            onClick={scrollToTop}
            type="button"
          >
            <Bot className="size-4 text-[#93c5fd]" />
            HireMe
          </button>
          <p className="mt-3 text-sm leading-7 text-white/72">
            Build protected Agent Harnesses, publish them as paid tools, and let
            Codex users hire them without copying your private IP.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/50">
            Navigate
          </div>
          <div className="mt-4 grid gap-3 text-sm text-white/78">
            <Link className="hover:text-white" to="/agents">
              Explore agents
            </Link>
            <a className="hover:text-white" href="#make-agent">
              Make an Agent
            </a>
            <Link className="hover:text-white" to="/agents/create">
              Publish an Agent
            </Link>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/50">
            Platform
          </div>
          <div className="mt-4 grid gap-3 text-sm text-white/78">
            <span>Sui + Walrus MVP</span>
            <span>Protected Harness execution</span>
            <span>Creator receipts and payouts</span>
          </div>
          <div className="mt-8 text-xs leading-5 text-white/42">
            © HireMe. Protected AI work marketplace.
          </div>
        </div>
      </div>
    </footer>
  );
}

function DocsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f9fafb] via-[#f6faff] to-[#e8f3ff]">
      <div className="mx-auto grid page-shell gap-8 px-4 py-8 md:px-8 lg:grid-cols-[260px_1fr]">
        <aside className="surface-card h-fit p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
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

        <article className="surface-card-soft px-5 py-6 md:px-8 md:py-8">
          <div className="mb-8 rounded-[32px] border border-[#dbeafe] bg-gradient-to-br from-[#f6faff] via-white to-[#eef5ff] p-5 md:p-7">
            <div className="max-w-3xl">
              <div className="eyebrow-label">
                HireMe docs
              </div>
              <h1 className="docs-page-hero-title mt-3 max-w-[680px] text-[#191f28]">
                Protected Agents, not prompts.
              </h1>
              <p className="docs-summary-copy mt-4 max-w-[680px]">
                Creators keep the Harness. Buyers hire the capability. HireMe runs the Agent between them.
              </p>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  How the product is framed
                </div>
                <div className="mt-4 grid gap-4">
                  {[
                    {
                      title: "Agent = paid capability",
                      copy: "Buyers choose the packaged workflow, not an engine setting.",
                    },
                    {
                      title: "Harness = working method",
                      copy: "Private prompts, skills, examples, and rules make it repeatable.",
                    },
                    {
                      title: "Gateway = secure runtime",
                      copy: "HireMe runs the Agent through a protected execution layer.",
                    },
                  ].map((item, index) => (
                    <div
                      className={`grid gap-1.5 ${index > 0 ? "border-t border-[#dbeafe] pt-4" : ""}`}
                      key={item.title}
                    >
                      <div className="docs-card-title text-[#191f28]">
                        {item.title}
                      </div>
                      <p className="docs-card-copy">
                        {item.copy}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                <div className="surface-card p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    What buyers see
                  </div>
                  <ul className="mt-3 grid gap-2 docs-card-copy">
                    <li>Agent name</li>
                    <li>Public skills</li>
                    <li>Price</li>
                    <li>Sample output</li>
                  </ul>
                </div>
                <div className="surface-card p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    What stays private
                  </div>
                  <ul className="mt-3 grid gap-2 docs-card-copy">
                    <li>AGENTS.md</li>
                    <li>Private prompts</li>
                    <li>Rubrics</li>
                    <li>Examples</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DocsArticleSection
            id="meet"
            kicker="01 / Meet HireMe"
            title="Hire Agents that already know the job"
          >
            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  For creators and buyers
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#dbeafe] bg-white p-4">
                    <div className="docs-card-title text-[#191f28]">
                      For creators
                    </div>
                    <p className="mt-2 docs-card-copy">
                      Turn private know-how into a paid Agent.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#dbeafe] bg-[#fbfdff] p-4">
                    <div className="docs-card-title text-[#191f28]">
                      For buyers
                    </div>
                    <p className="mt-2 docs-card-copy">
                      Use a ready Agent without rebuilding workflows.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4">
                <DocsMiniBlock
                  id="meet-agent"
                  title="What counts as an Agent?"
                  copy="A private Harness, tool habits, memory rules, and a public contract."
                />
                <DocsMiniBlock
                  id="meet-not-prompts"
                  title="Not a prompt file"
                  copy="HireMe sells protected execution, not copyable text."
                />
              </div>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="why"
            kicker="02 / Why It Matters"
            title="Your work and the creator's playbook stay separate"
          >
            <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  Buyers
                </div>
                <p className="mt-3 docs-summary-copy max-w-[34rem]">
                  Use prepared Agents without exposing private work.
                </p>
                <details className="group mt-4 rounded-2xl border border-[#dbeafe] bg-white/90 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 docs-card-title text-[#191f28] [&::-webkit-details-marker]:hidden">
                    Why it works
                    <span className="text-lg text-primary transition group-open:rotate-45">+</span>
                  </summary>
                  <ul className="mt-3 grid gap-2 docs-card-copy">
                    <li>Send work to HireMe, not directly to the creator.</li>
                    <li>Get results from a protected Agent run.</li>
                  </ul>
                </details>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#dbeafe] bg-[#f7fbff] p-4">
                    <div className="docs-card-title text-[#191f28]">
                      Private by default
                    </div>
                    <p className="mt-2 docs-card-copy">
                      Input stays inside the run.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#dbeafe] bg-white p-4">
                    <div className="docs-card-title text-[#191f28]">
                      Outcome first
                    </div>
                    <p className="mt-2 docs-card-copy">
                      Buyers see result quality, not raw files.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="surface-card p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    Creators
                  </div>
                  <p className="mt-3 docs-summary-copy max-w-[34rem]">
                    Earn from Agents without revealing your private Harness.
                  </p>
                  <details className="group mt-4 rounded-2xl border border-[#dbeafe] bg-white/90 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 docs-card-title text-[#191f28] [&::-webkit-details-marker]:hidden">
                      What stays hidden
                      <span className="text-lg text-primary transition group-open:rotate-45">+</span>
                    </summary>
                    <ul className="mt-3 grid gap-2 docs-card-copy">
                      <li>AGENTS.md and Harness files stay hidden.</li>
                      <li>Usage can still earn you money.</li>
                    </ul>
                  </details>
                </div>
                <div className="surface-card p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    Protected execution
                  </div>
                  <div className="mt-4 grid gap-3">
                    {[
                      "Buyer task",
                      "Secure runner",
                      "Private Harness",
                      "Result",
                    ].map((item, index) => (
                      <div
                        className="flex items-center gap-3 text-sm text-[#4e5968]"
                        key={item}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary shadow-sm">
                          {index + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="features"
            kicker="03 / Features"
            title="What buyers can see and what stays private"
          >
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  Buyers can see
                </div>
                <ul className="mt-3 grid gap-2 docs-card-copy">
                  <li>Skills</li>
                  <li>Price</li>
                  <li>Sample output</li>
                  <li>Version notes</li>
                </ul>
              </div>
              <div className="grid gap-4">
                <div className="surface-card p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    Buyers can't see
                  </div>
                  <ul className="mt-3 grid gap-2 docs-card-copy">
                    <li>AGENTS.md</li>
                    <li>Prompts</li>
                    <li>Rubrics</li>
                    <li>Examples</li>
                    <li>Hidden checks</li>
                  </ul>
                </div>
                <div className="surface-card-soft p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    Walrus and Sui
                  </div>
                  <p className="mt-3 docs-card-copy">
                    Walrus stores protected Agent artifacts and execution records.
                    Sui tracks access, usage, and payout receipts.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {["Harness version record", "Execution receipt", "Access record", "Payout record"].map((item) => (
                      <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 docs-card-copy text-[#4e5968]" key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 docs-card-copy">
                    The proof trail shows that a specific Agent version produced a result.
                  </p>
                </div>
              </div>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="hire"
            kicker="04 / How to Hire"
            title="Try it first. Hire it when it fits"
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  For buyers
                </div>
                <div className="mt-4 grid gap-3">
                  {[
                    ["Browse", "Compare cards, price, and skills."],
                    ["Try", "Test the Agent before paying."],
                    ["Hire", "Unlock full access when it fits."],
                    ["Run from Codex / MCP", "Use it in your workflow."],
                  ].map(([title, copy], index) => (
                    <div className="flex gap-3" key={title}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <div className="docs-card-title text-[#191f28]">
                          {title}
                        </div>
                        <div className="docs-card-copy">
                          {copy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                <div className="surface-card p-5 md:p-6">
                  <div className="docs-card-title text-[#191f28]">
                    For creators
                  </div>
                  <div className="mt-4 grid gap-3">
                    {[
                      ["Build Harness", "Package the working method."],
                      ["Upload protected folder", "Keep private files encrypted."],
                      ["Set price", "Choose what it should earn."],
                      ["Earn from usage", "Get paid as it is used."],
                    ].map(([title, copy], index) => (
                      <div className="flex gap-3" key={title}>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <div className="docs-card-title text-[#191f28]">
                            {title}
                          </div>
                          <div className="docs-card-copy">
                            {copy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#dbeafe] bg-[#f7fbff] p-5">
                  <div className="docs-card-title text-[#191f28]">
                    MCP hiring
                  </div>
                  <p className="mt-2 docs-card-copy">
                    HireMe sits between the buyer and the creator’s private Harness.
                  </p>
                </div>
              </div>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="publish"
            kicker="05 / How to Publish"
            title="Publish from the web or from Codex through MCP"
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <DocsMiniBlock
                id="publish-web"
                title="Method 1: Web"
                copy="Write the card, upload the Harness, set the fee, and publish."
              />
              <DocsMiniBlock
                id="publish-mcp"
                title="Method 2: MCP"
                copy="Use the local hireme-creator plugin to build the folder, then publish through the Render gateway."
              />
            </div>
            <div
              className="scroll-mt-24 rounded-3xl border border-[#dbeafe] bg-[#f7fbff] p-5 md:p-6"
              id="publish-codex-setup"
            >
              <div className="docs-card-title text-[#191f28]">
                Start with a template from Codex
              </div>
              <p className="mt-2 docs-card-copy max-w-[680px]">
                Run this once in your terminal. It installs the local creator
                template plugin, connects the OAuth HTTP MCP server to the
                Render gateway, then opens the HireMe login flow for Agent use.
              </p>
              <div className="mt-4">
                <CopyableCodeBlock
                  code={codexCreatorSetupCommand}
                  description="Use this for the public website flow. Localhost is only for gateway development."
                  label="Codex setup"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#dbeafe] bg-white p-4">
                  <div className="docs-card-title text-[#191f28]">
                    <code>hireme-creator</code>
                  </div>
                  <p className="mt-1.5 docs-card-copy">
                    Local stdio plugin. Creates template folders and publishes
                    local Harness folders.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#dbeafe] bg-white p-4">
                  <div className="docs-card-title text-[#191f28]">
                    <code>hireme</code>
                  </div>
                  <p className="mt-1.5 docs-card-copy">
                    OAuth HTTP MCP server on Render. Lists access, runs hired
                    Agents, and checks usage.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-[#dbeafe] bg-white p-5">
              <div className="docs-card-title text-[#191f28]">
                Details
              </div>
              <ul className="mt-2 grid gap-2 docs-card-copy">
                <li>Buyers see the Agent card, sample output, price, and public MCP tools.</li>
                <li>They do not receive AGENTS.md, private skills, prompts, examples, or work rules.</li>
              </ul>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="paid"
            kicker="06 / How to Get Paid"
            title="If your Agent works well, it should earn for you"
          >
            <div className="surface-card p-5 md:p-6">
              <div className="docs-card-title text-[#191f28]">
                What Walrus and Sui track
              </div>
              <ul className="mt-3 grid gap-2 docs-card-copy">
                <li>Harness version record</li>
                <li>Execution receipt</li>
                <li>Access record</li>
                <li>Payout record</li>
                <li>Proof that a specific Agent version produced a result</li>
              </ul>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <DocsMiniBlock
                id="paid-earnings"
                title="Check earnings"
                copy="My Page shows hires, usage, and available money."
              />
              <DocsMiniBlock
                id="paid-redeem"
                title="Redeem"
                copy="When money is ready, press Redeem to send it to your wallet."
              />
              <DocsMiniBlock
                id="paid-records"
                title="Payment records"
                copy="Payouts follow usage and payment records."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="roadmap"
            kicker="07 / Trust & Roadmap"
            title="The goal is a platform-free Agent hiring protocol"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  Final goal
                </div>
                <p className="mt-2 docs-card-copy">
                  A platform-free hiring protocol where HireMe matters less over time.
                </p>
              </div>
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  Long-term privacy
                </div>
                <p className="mt-2 docs-card-copy">
                  TEE, ICP, Seal, and similar systems can reduce what the platform can read.
                </p>
              </div>
              <div className="surface-card p-5 md:p-6">
                <div className="docs-card-title text-[#191f28]">
                  Agent quality signals
                </div>
                <p className="mt-2 docs-card-copy">
                  Task success, latency, repeats, feedback, reliability, and cost per result.
                </p>
              </div>
            </div>
          </DocsArticleSection>

          <section className="scroll-mt-24 border-b border-border py-8 first:pt-0 last:border-b-0 last:pb-0" id="details">
            <div className="eyebrow-label mb-4">
              08 / Details
            </div>
            <h2 className="docs-section-title max-w-[680px] text-[#191f28]">
              More detail lives here, not in the main path.
            </h2>
            <div className="mt-5 grid gap-4">
              {[
                {
                  title: "What counts as an Agent?",
                  copy: "A HireMe Agent is a packaged worker with private instructions, skills, examples, tool habits, memory rules, and a public execution contract.",
                },
                {
                  title: "How does protected execution work?",
                  copy: "Buyer input goes to the HireMe runner. The creator's Harness executes through a gateway-only run, and the buyer gets the result back without seeing the private files.",
                },
                {
                  title: "How does MCP hiring work?",
                  copy: "Buyers can call HireMe Agents from Codex and other MCP clients. HireMe is the hiring and execution layer, not a closed editor.",
                },
                {
                  title: "How does team memory work with memWal?",
                  copy: "Approved shared memory can move across Agents in a Team while each creator's private files stay hidden.",
                },
                {
                  title: "How do payouts work?",
                  copy: "Usage and payment records drive creator payouts. When funds are available, creators can redeem them to their wallet.",
                },
                {
                  title: "What is the long-term protocol roadmap?",
                  copy: "HireMe is moving toward a platform-free hiring protocol with stronger privacy, distributed access, and richer quality signals.",
                },
              ].map((item) => (
                <details
                  className="group rounded-3xl border border-[#dbeafe] bg-white p-5 shadow-[rgba(30,64,175,0.06)_0_10px_24px]"
                  key={item.title}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 docs-card-title text-[#191f28] [&::-webkit-details-marker]:hidden">
                    <span>{item.title}</span>
                    <span className="text-lg text-primary transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 docs-card-copy">
                    {item.copy}
                  </p>
                </details>
              ))}
            </div>
          </section>
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
      <div className="eyebrow-label mb-4">
        {kicker}
      </div>
      <h2 className="docs-section-title max-w-[680px] text-[#191f28]">
        {title}
      </h2>
      <div className="docs-summary-copy mt-4 grid gap-3 md:gap-4">
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
      <h3 className="docs-card-title text-[#191f28]">{title}</h3>
      <p className="mt-1.5 docs-card-copy">{copy}</p>
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
  const signAndExecuteTransaction = useSignAndExecuteTransaction();
  const [query, setQuery] = useState("");
  const [catalogView, setCatalogView] = useState<CatalogView | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Agent["category"][]>([]);
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
      const matchesTopic =
        selectedTopics.length === 0 ||
        categories.some((category) => selectedTopics.includes(category));
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
    setSelectedTopics([]);
    setCatalogView(null);
    setQuery("");
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]/40 focus-visible:ring-offset-2 ${
                        isSelected
                          ? "border-[#d8d4e2] bg-[#f3f1f8] text-[#494556] shadow-[inset_0_0_0_1px_rgba(73,69,86,0.03)] hover:bg-[#eeebf4] active:bg-[#e9e5f0]"
                          : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#c4c9d0] hover:bg-[#f3f4f6] active:bg-[#e5e7eb]"
                      }`}
                      key={view.id}
                      onClick={() =>
                        setCatalogView((current) =>
                          current === view.id ? null : view.id,
                        )
                      }
                      type="button"
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-[#777184]" : "bg-[#c9d3e2]"
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]/40 focus-visible:ring-offset-2 ${
                        isSelected
                          ? "border-[#d8d4e2] bg-[#f3f1f8] text-[#494556] shadow-[inset_0_0_0_1px_rgba(73,69,86,0.03)] hover:bg-[#eeebf4] active:bg-[#e9e5f0]"
                          : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#c4c9d0] hover:bg-[#f3f4f6] active:bg-[#e5e7eb]"
                      }`}
                      key={topic}
                      onClick={() =>
                        setSelectedTopics(toggleFilter(selectedTopics, topic))
                      }
                      type="button"
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-[#777184]" : "bg-[#c9d3e2]"
                        }`}
                      />
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[#1c1e54]">
                  {resultCount} {catalogView === "teams" ? "teams" : "agents"}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium text-[#1c1e54]">
                  {dataSource.source === "supabase" ? "Supabase live" : "Local demo data"}
                </span>
                {localCreatedAgents.length ? (
                  <><span className="text-muted-foreground">·</span><span className="font-medium text-[#1c1e54]">{localCreatedAgents.length} published here</span></>
                ) : null}
                {dataSource.message ? <span className="leading-5 text-muted-foreground">{dataSource.message}</span> : null}
              </div>
              <button className="rounded-md px-2 py-1 font-medium text-[#6b7280] underline-offset-4 transition hover:bg-[#f3f4f6] hover:text-[#111827] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b7280]/40 focus-visible:ring-offset-2 active:bg-[#e5e7eb]" onClick={resetFilters} type="button">
                Reset filters
              </button>
            </div>
          </div>

          {accessActionError ? (
            <div className="rounded-xl border border-[#ea2261]/25 bg-[#fff8fb] px-4 py-3 text-sm leading-6 text-[#9f1239]">
              {accessActionError}
            </div>
          ) : null}

          {catalogView === "teams" ? (
            teamResults.length ? (
              <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  const [updateHarnessFile, setUpdateHarnessFile] = useState<File | null>(null);
  const [updateReleaseNotes, setUpdateReleaseNotes] = useState("");
  const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);
  const [updateAgentError, setUpdateAgentError] = useState<string | null>(null);
  const [updateAgentResult, setUpdateAgentResult] =
    useState<GatewayAgentRegistrationResult | null>(null);

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
  const localCreatedRecord = createdAgentRecords.find(
    (record) => record.agentSlug === agent?.id || record.id === agent?.id,
  );
  const agentOwnerKeys = agent
    ? [agent.creator, agent.team.owner, agent.handle, agent.id]
        .map((value) => value.trim().toLowerCase())
    : [];
  const userOwnerKeys = user
    ? [user.email, user.displayName, user.wallet]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    : [];
  const canUpdateAgent = Boolean(
    user &&
      agent &&
      (localCreatedRecord?.creatorId === creatorIdFor(user) ||
        localCreatedRecord?.creatorEmail === user.email ||
        userOwnerKeys.some((key) => agentOwnerKeys.includes(key))),
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

  async function updateAgentHarness() {
    if (!agent) return;
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!updateHarnessFile) {
      setUpdateAgentError("Upload a new Harness archive first.");
      return;
    }

    setIsUpdatingAgent(true);
    setUpdateAgentError(null);
    setUpdateAgentResult(null);
    try {
      const result = await updateAgentWithGatewayUpload({
        agent,
        harnessFile: updateHarnessFile,
        releaseNotes: updateReleaseNotes,
        user,
      });
      if (localCreatedRecord) {
        writeCreatedAgentRecord({
          ...localCreatedRecord,
          walrusBlobId:
            result.protectedArtifact?.walrusBlobId ||
            localCreatedRecord.walrusBlobId,
          suiObjectId:
            result.protectedArtifact?.suiObjectId ||
            localCreatedRecord.suiObjectId,
          ciphertextDigest:
            result.protectedArtifact?.ciphertextDigest ||
            localCreatedRecord.ciphertextDigest,
          fileCount: result.upload?.entryCount || localCreatedRecord.fileCount,
          createdAt: result.registeredAt || new Date().toISOString(),
          status: "Published",
          source: "gateway",
          gatewayError: result.supabase?.error,
        });
        setCreatedAgentRecords(readAllCreatedAgents());
      }
      const refreshedAgents = await loadMarketplaceAgents();
      setMarketplaceAgents(
        refreshedAgents.agents.length ? refreshedAgents.agents : fallbackAgents,
      );
      setUpdateHarnessFile(null);
      setUpdateReleaseNotes("");
      setUpdateAgentResult(result);
    } catch (error) {
      setUpdateAgentError(
        error instanceof Error ? error.message : "Agent update failed.",
      );
    } finally {
      setIsUpdatingAgent(false);
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
          <Link className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#6b7684] transition hover:text-[#191f28]" to="/agents">
            <ArrowLeft className="size-4" />
            Marketplace
          </Link>
        </section>
      </main>
    );
  }

  const isHired = access?.accessType === "hired";
  const isTrying = access?.accessType === "trial";
  const hasGatewayAccess = access?.source === "gateway";
  const tokenPrice = agent.pricePer1MTokensSui ?? agent.pricePerCallUsd;
  const averageTokens = totalAverageTokens(agent);
  const estimatedRunCost = (tokenPrice * averageTokens) / 1_000_000;
  const estimatedRunPrice = estimatedRunCost
    ? `${estimatedRunCost.toFixed(estimatedRunCost >= 0.1 ? 2 : 3)} SUI`
    : "Calculated at run time";
  const useCases = agent.skills.slice(0, 3).map((skill) =>
    `${skill} work that needs a repeatable process, clear output, and built-in review.`,
  );
  const privateItems = Array.from(
    new Set([
      "AGENTS.md",
      "Private prompts",
      "Private skills",
      "Examples",
      "Rubrics",
      "Workflow rules",
      "Hidden checks",
      ...agent.protectedAssets,
    ]),
  );
  const buyerDeliverables = [
    "Ready-to-run Agent access",
    "Result output",
    "MCP and tool access",
    "Protected execution",
    "Usage record and execution receipt",
  ];

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-[#dedbea] bg-white px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7684] transition hover:text-[#191f28]" to="/agents">
            <ArrowLeft className="size-4" />
            Marketplace
          </Link>

          <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <div className="flex items-start gap-4">
                <Avatar className="size-16 shrink-0 md:size-20">
                  <AvatarFallback className="bg-gradient-to-br from-[#533afd] to-[#7c6cf6] text-lg text-white md:text-xl">
                    {agent.name.split(" ").map((word) => word[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#d8d4e2] bg-[#f3f1f8] px-2.5 py-1 text-[11px] font-semibold uppercase text-[#494556]">{agent.category}</span>
                  </div>
                  <h1 className="mt-3 balanced-text text-4xl font-light leading-tight text-[#171452] md:text-5xl">{agent.name}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{agent.handle} · by {agent.creator}</p>
                </div>
              </div>
              <p className="pretty-text mt-7 max-w-3xl text-xl font-light leading-8 text-[#1c1e54] md:text-2xl">{agent.headline}</p>
              <p className="pretty-text mt-3 max-w-3xl text-sm leading-6 text-[#4e5d77] md:text-base">{agent.publicSummary}</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#494556]">
                <span><strong className="number-cell text-[#171452]">{agent.rating ? agent.rating.toFixed(1) : "New"}</strong> rating</span>
                <span><strong className="number-cell text-[#171452]">{formatRuns(agent.calls)}</strong> completed runs</span>
              </div>
            </div>

            <Card className="border-[#d8d4e2] bg-[#fbfaff] shadow-[rgba(28,30,84,0.06)_0_10px_30px]">
              <CardHeader className="pb-3">
                <CardDescription>Estimated cost per run</CardDescription>
                <CardTitle className="number-cell text-3xl text-[#171452]">From {estimatedRunPrice}</CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">Based on {formatTokens(averageTokens)} average tokens at {formatAgentPrice(tokenPrice)}.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button className="w-full" disabled={Boolean(accessActionType) || (hasGatewayAccess && (isTrying || isHired))} onClick={() => void updateAgentAccess("trial")} type="button" variant="secondary"><Terminal /> Try Agent</Button>
                  <Button className="w-full" disabled={Boolean(accessActionType) || (hasGatewayAccess && isHired)} onClick={() => void updateAgentAccess("hired")} type="button"><PackageOpen /> Hire Agent</Button>
                </div>
                {access ? <div className="mt-4 rounded-lg border border-[#d8d4e2] bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">{access.source === "gateway" ? "Authorized for protected Codex execution." : "Saved locally. Connect the gateway to authorize Codex access."}</div> : null}
                {accessActionError ? <div className="mt-4 rounded-lg border border-[#d8d4e2] bg-[#f3f1f8] px-3 py-2 text-xs leading-5 text-[#494556]">{accessActionError}</div> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>What this Agent does</CardTitle><CardDescription>A prepared specialist for repeatable work—not a blank chatbot that needs every rule explained again.</CardDescription></CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-[#273951]">{agent.publicSummary} Its private Harness applies the creator’s standards, workflow rules, examples, and review checks on every run.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {useCases.map((useCase, index) => <div className="rounded-xl border border-[#dedbea] bg-[#fbfaff] p-4" key={useCase}><div className="text-xs font-semibold uppercase text-[#6b6580]">Use case {index + 1}</div><p className="mt-2 text-sm leading-6 text-[#273951]">{useCase}</p></div>)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sample input / Sample output</CardTitle><CardDescription>Review the expected request and result shape before you try the Agent.</CardDescription></CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#dedbea] bg-[#f8f7fb] p-4"><div className="text-xs font-semibold uppercase text-[#6b6580]">Sample input</div><p className="mt-3 text-sm leading-6 text-[#273951]">Use {agent.name} to handle a {agent.category.toLowerCase()} task. Apply the public requirements, identify risks, and return a result with clear next steps.</p></div>
                  <div className="rounded-xl border border-[#d8d4e2] bg-[#f3f1f8] p-4"><div className="text-xs font-semibold uppercase text-[#6b6580]">{agent.resultPreview.title}</div><p className="mt-3 text-sm leading-6 text-[#273951]">{agent.resultPreview.summary}</p><div className="mt-3 border-t border-[#d8d4e2] pt-3 text-sm leading-6 text-[#494556]">{agent.resultPreview.sample}</div></div>
                </div>
                {agent.resultPreview.mediaUrl ? <div className="mt-4 overflow-hidden rounded-xl border border-[#dedbea] bg-[#f8f7fb]">{agent.resultPreview.mediaType === "video" ? <video className="aspect-video w-full bg-[#171452] object-contain" controls src={agent.resultPreview.mediaUrl} /> : <img alt={`${agent.name} sample output`} className="aspect-video w-full object-cover" src={agent.resultPreview.mediaUrl} />}</div> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Public skills</CardTitle><CardDescription>Capabilities you can evaluate before hiring.</CardDescription></CardHeader>
              <CardContent><div className="flex flex-wrap gap-2">{agent.skills.map((skill) => <span className="rounded-full border border-[#d8d4e2] bg-[#f8f7fb] px-3 py-1.5 text-xs font-medium text-[#494556]" key={skill}>{skill}</span>)}</div></CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>What stays private</CardTitle><CardDescription>The buyer receives capability and results, never the creator’s private playbook.</CardDescription></CardHeader>
                <CardContent><ul className="grid gap-2 text-sm text-[#273951]">{privateItems.map((item) => <li className="rounded-lg border border-[#dedbea] bg-[#f8f7fb] px-3 py-2" key={item}>{item}</li>)}</ul></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>What you get</CardTitle><CardDescription>Everything needed to use the Agent without copying its Harness.</CardDescription></CardHeader>
                <CardContent><ul className="grid gap-2 text-sm text-[#273951]">{buyerDeliverables.map((item) => <li className="rounded-lg border border-[#d8d4e2] bg-[#f3f1f8] px-3 py-2" key={item}>{item}</li>)}</ul></CardContent>
              </Card>
            </div>

            <Card className="border-[#d8d4e2] bg-gradient-to-br from-[#f8f5ff] to-white">
              <CardHeader><CardTitle>Ready to work with {agent.name}?</CardTitle><CardDescription>Try the Agent first, then hire it when the result fits your workflow.</CardDescription></CardHeader>
              <CardContent><div className="grid gap-3 sm:grid-cols-2"><Button className="w-full" disabled={Boolean(accessActionType) || (hasGatewayAccess && (isTrying || isHired))} onClick={() => void updateAgentAccess("trial")} type="button" variant="secondary"><Terminal /> Try Agent</Button><Button className="w-full" disabled={Boolean(accessActionType) || (hasGatewayAccess && isHired)} onClick={() => void updateAgentAccess("hired")} type="button"><PackageOpen /> Hire Agent</Button></div></CardContent>
            </Card>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            {canUpdateAgent ? (
              <Card className="border-[#cfe0ff] bg-[#f7fbff]">
                <CardHeader>
                  <CardTitle>Update Agent</CardTitle>
                  <CardDescription>
                    Publish a new protected version with a replacement Harness archive.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#89a8e8] bg-white p-4 text-center transition hover:bg-[#f8fbff]">
                    <UploadCloud className="size-6 text-[#274690]" />
                    <span className="mt-2 text-sm font-semibold text-[#1c1e54]">
                      Upload new Harness
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      ZIP, TAR.GZ, or GZ
                    </span>
                    <input
                      accept=".zip,.gz,.tgz,.tar.gz,application/zip,application/gzip"
                      className="sr-only"
                      onChange={(event) =>
                        setUpdateHarnessFile(event.target.files?.[0] || null)
                      }
                      type="file"
                    />
                    {updateHarnessFile ? (
                      <span className="mt-3 max-w-full truncate rounded-full bg-[#edfff4] px-3 py-1 text-xs font-semibold text-[#166534]">
                        {updateHarnessFile.name}
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(event) => setUpdateReleaseNotes(event.target.value)}
                    placeholder="Release notes"
                    value={updateReleaseNotes}
                  />
                  <Button
                    className="mt-3 w-full"
                    disabled={isUpdatingAgent || !updateHarnessFile}
                    onClick={() => void updateAgentHarness()}
                    type="button"
                  >
                    <UploadCloud />
                    {isUpdatingAgent ? "Updating..." : "Publish update"}
                  </Button>
                  {updateAgentError ? (
                    <div className="mt-3 rounded-lg border border-[#ead2df] bg-white px-3 py-2 text-xs leading-5 text-[#9f1239]">
                      {updateAgentError}
                    </div>
                  ) : null}
                  {updateAgentResult ? (
                    <div className="mt-3 rounded-lg border border-[#cfe0ff] bg-white px-3 py-2 text-xs leading-5 text-[#274690]">
                      Version{" "}
                      {updateAgentResult.version?.versionNumber || "updated"} is
                      current. Walrus blob:{" "}
                      {updateAgentResult.protectedArtifact?.walrusBlobId ||
                        "registered"}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader><CardTitle>Performance & usage</CardTitle><CardDescription>Marketplace averages from completed runs.</CardDescription></CardHeader>
              <CardContent><dl className="grid gap-3 text-sm">{[["Average time", formatDuration(agent.latencyMs)], ["Average usage", formatTokens(averageTokens)], ["Last updated", "Current release"], ["Version", "v1.0"], ["Completed runs", formatRuns(agent.calls)], ["Rating", agent.rating ? `${agent.rating.toFixed(1)} / 5` : "New"]].map(([label, value]) => <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="number-cell font-medium text-[#171452]">{value}</dd></div>)}</dl></CardContent>
            </Card>
            <Card className="border-[#d8d4e2] bg-[#fbfaff]">
              <CardHeader><CardTitle>Pricing</CardTitle><CardDescription>Estimated from this Agent’s average usage.</CardDescription></CardHeader>
              <CardContent><div className="number-cell text-2xl font-semibold text-[#171452]">From {estimatedRunPrice} / run</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Actual cost varies with input and output length. Token rate: {formatAgentPrice(tokenPrice)}.</p><div className="mt-5 grid gap-2"><Button className="w-full" disabled={Boolean(accessActionType) || (hasGatewayAccess && isHired)} onClick={() => void updateAgentAccess("hired")} type="button"><PackageOpen /> Hire Agent</Button><Button className="w-full" disabled={Boolean(accessActionType) || (hasGatewayAccess && (isTrying || isHired))} onClick={() => void updateAgentAccess("trial")} type="button" variant="secondary"><Terminal /> Try Agent</Button></div></CardContent>
            </Card>
          </aside>
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
      description: `${formatAgentPriceShort(record.pricePerCallUsd)} · ${record.status}`,
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

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
  const averageRating = agents.length
    ? agents.reduce((total, agent) => total + agent.rating, 0) / agents.length
    : 0;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="self-start transition">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11 shrink-0">
            <AvatarFallback className={`bg-gradient-to-br ${team.accent} text-white`}>
              {team.name
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{team.name}</CardTitle>
              <span className="number-cell inline-flex items-center gap-1 rounded-full border border-[#533afd]/20 bg-[#f0edff] px-2 py-0.5 text-[11px] font-medium text-[#2e2b8c]" title="Average rating across this team’s Agents.">
                <Star className="size-3 fill-[#533afd] text-[#533afd]" />
                {averageRating.toFixed(1)}
              </span>
            </div>
            <CardDescription className="truncate">{team.handle}</CardDescription>
          </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {categories.slice(0, 2).map((category) => (
            <span className="rounded-full border border-[#533afd]/15 bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-[#273951]" key={category}>{category}</span>
          ))}
          <span>{formatRuns(totalRuns)} runs</span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#273951]">
          {team.headline}
        </p>

        <div className="mt-4 border-t border-border pt-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">From</div>
            <div className="number-cell mt-0.5 text-base font-semibold text-[#0d253d]">{formatAgentPriceShort(startingPrice)}<span className="text-xs font-normal text-muted-foreground"> / 1M tokens</span></div>
          </div>
        </div>

        <div className="mt-4">
          <Button aria-expanded={isExpanded} className="w-full" onClick={() => setIsExpanded((value) => !value)} type="button" variant="secondary">
            <BriefcaseBusiness /> View {agents.length || team.agentCount} Agents
            <ChevronDown className={`transition ${isExpanded ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {isExpanded ? (
          <div className="mt-4 rounded-xl border border-[#d9d5ff] bg-[#f8f5ff] p-4">
            <p className="text-xs leading-5 text-muted-foreground">{team.publicSummary}</p>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[#d9d5ff] pt-4 text-sm">
              <Metric icon={BriefcaseBusiness} label="Agents" value={(agents.length || team.agentCount).toString()} />
              <Metric icon={TrendingUp} label="Total runs" value={formatRuns(totalRuns)} />
            </div>
            <div className="mt-4 grid gap-2 border-t border-[#d9d5ff] pt-4">
              {agents.map((agent) => (
                <Button asChild className="w-full justify-between" key={agent.id} size="sm" type="button" variant="secondary">
                  <Link to={`/agents/${agent.id}`}>
                    <span className="truncate">{agent.name}</span>
                    <span className="number-cell text-xs text-muted-foreground">{formatAgentPriceShort(agent.pricePerCallUsd)}</span>
                  </Link>
                </Button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#d9d5ff] pt-4 text-xs">
              <span className="text-muted-foreground">Creator</span>
              <span className="font-medium text-[#273951]">{team.owner}</span>
            </div>
          </div>
        ) : null}
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
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const detailPath = `/agents/${agent.id}`;

  return (
    <Card
      aria-label={`View ${agent.name} details`}
      className="interactive-card clickable-card self-start cursor-pointer transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f82e8]/35 focus-visible:ring-offset-2"
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button, a, input, textarea, select, [role='button']")
        ) {
          return;
        }
        navigate(detailPath);
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          navigate(detailPath);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <CardHeader className="pb-2.5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-11 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-[#533afd] to-[#7c6cf6] text-white">
                {agent.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="truncate text-base">{agent.name}</CardTitle>
                <span className="number-cell inline-flex items-center gap-1 text-xs font-medium text-[#494556]" title="Based on buyer feedback and completed runs.">
                  <Star className="size-3 fill-[#533afd] text-[#533afd]" />
                  {agent.rating ? agent.rating.toFixed(1) : "New"}
                </span>
              </div>
              <CardDescription className="truncate">by {agent.creator}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-[#d8d4e2] bg-[#f3f1f8] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#494556]">{agent.category}</span>
          <span>{formatRuns(agent.calls)} runs</span>
        </div>

        <p className="mt-3 truncate text-sm leading-5 text-[#273951]">
          {agent.headline}
        </p>

        <div className="mt-3 border-t border-border pt-3">
          <div className="number-cell text-sm font-semibold text-[#0d253d]">{formatAgentPriceShort(agent.pricePer1MTokensSui ?? agent.pricePerCallUsd)}<span className="text-[11px] font-normal text-muted-foreground"> / 1M tokens</span></div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button
            className="w-full"
            disabled={isBusy || (hasGatewayAccess && (isTrying || isHired))}
            onClick={(event) => {
              event.stopPropagation();
              onTry();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Terminal /> Try
          </Button>
          <Button
            className="w-full"
            disabled={isBusy || (hasGatewayAccess && isHired)}
            onClick={(event) => {
              event.stopPropagation();
              onHire();
            }}
            size="sm"
            type="button"
          >
            <PackageOpen /> Hire
          </Button>
          <Button
            aria-expanded={isExpanded}
            className="px-3"
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((value) => !value);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ChevronDown className={`transition ${isExpanded ? "rotate-180" : ""}`} />
            Details
          </Button>
        </div>

        {isExpanded ? (
          <div
            className="mt-3 rounded-xl border border-[#d8d4e2] bg-[#f8f7fb] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-sm font-semibold text-[#171452]">{agent.name}</div>
            <p className="mt-2 text-sm leading-5 text-[#273951]">{agent.headline}</p>
            <dl className="mt-4 grid gap-2 border-t border-[#d8d4e2] pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Rating / trust</dt>
                <dd className="number-cell font-medium text-[#171452]">{agent.rating ? `${agent.rating.toFixed(1)} / 5` : "New"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Completed runs</dt>
                <dd className="number-cell font-medium text-[#171452]">{formatRuns(agent.calls)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="number-cell font-medium text-[#171452]">{formatAgentPrice(agent.pricePer1MTokensSui ?? agent.pricePerCallUsd)}</dd>
              </div>
            </dl>
          </div>
        ) : null}

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

function formatRuns(runs: number) {
  if (runs >= 1_000_000) return `${(runs / 1_000_000).toFixed(1)}M`;
  if (runs >= 1000) return `${(runs / 1000).toFixed(runs >= 10_000 ? 0 : 1)}K`;
  return runs.toLocaleString();
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
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const stepNavRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([false, false, false, false, false]);
  const [stepError, setStepError] = useState<string | null>(null);
  const stepItems = [
    {
      label: "Agent Info",
      id: "agent-info",
      description: "Name, summary, and description.",
    },
    {
      label: "Pricing",
      id: "pricing",
      description: "Buyer price.",
    },
    {
      label: "Protection",
      id: "protection",
      description: "Upload the private Harness.",
    },
    {
      label: "Review",
      id: "review",
      description: "Contract and sample output.",
    },
    {
      label: "Publish",
      id: "publish",
      description: "Confirm and publish.",
    },
  ] as const;
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
    pricePerCallUsd: "1.000",
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
  const pricePerCallUsd = Math.max(
    0,
    Number.parseFloat(draft.pricePerCallUsd) || 0,
  );
  const totalPricePerCallUsd = pricePerCallUsd;
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

  useEffect(() => {
    const activeButton = stepNavRefs.current[activeStep];
    if (!activeButton) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;

    activeButton.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeStep]);

  useEffect(() => {
    const activeSection = stepRefs.current[activeStep];
    if (!activeSection) return;

    activeSection.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, [activeStep]);

  const maxAccessibleStep = activeStep;
  const canAccessStep = (index: number) => index <= maxAccessibleStep;

  const validateStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: {
        if (!draft.agentName.trim()) return "Add an agent name before continuing.";
        if (!draft.headline.trim()) return "Add a one-line description before continuing.";
        if (!draft.description.trim()) return "Add a description before continuing.";
        return null;
      }
      case 1: {
        if (Number.isNaN(pricePerCallUsd) || pricePerCallUsd < 0) {
          return "Set a valid price before continuing.";
        }
        return null;
      }
      case 2: {
        if (!agentFiles[0]) return "Upload the private Harness before continuing.";
        return null;
      }
      case 3: {
        if (!draft.howToUse.trim()) return "Describe how buyers should use this Agent.";
        if (!draft.typicalOutputTitle.trim()) return "Add a sample result title.";
        if (!draft.typicalOutputSummary.trim()) return "Add a sample result summary.";
        if (!draft.typicalOutputSample.trim()) return "Add a sample result.";
        return null;
      }
      default:
        return null;
    }
  };

  const goToStep = (index: number) => {
    if (!canAccessStep(index)) return;
    setStepError(null);
    setActiveStep(index);
  };

  const handleNext = async () => {
    const error = validateStep(activeStep);
    if (error) {
      setStepError(error);
      return;
    }

    setStepError(null);
    setCompletedSteps((current) => {
      const next = [...current];
      next[activeStep] = true;
      return next;
    });

    if (activeStep < stepItems.length - 1) {
      setActiveStep((current) => Math.min(current + 1, stepItems.length - 1));
      return;
    }

    await sealHarness();
  };

  const handleBack = () => {
    setStepError(null);
    setActiveStep((current) => Math.max(current - 1, 0));
  };

  async function sealHarness() {
    setIsSealing(true);
    setCreateError(null);
    try {
      const harnessFile = agentFiles[0];
      if (!harnessFile) {
        throw new Error("Upload a .zip or .tar.gz Agent Harness before creating.");
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
        pricePerCallUsd: totalPricePerCallUsd,
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

  const wizardReadiness = [
    {
      label: "Agent info",
      ready:
        Boolean(draft.agentName.trim()) &&
        Boolean(draft.headline.trim()) &&
        Boolean(draft.description.trim()),
    },
    {
      label: "Pricing",
      ready:
        !Number.isNaN(pricePerCallUsd) &&
        pricePerCallUsd >= 0,
    },
    {
      label: "Protection",
      ready: Boolean(agentFiles[0]),
    },
    {
      label: "Review",
      ready:
        Boolean(draft.howToUse.trim()) &&
        Boolean(draft.typicalOutputTitle.trim()) &&
        Boolean(draft.typicalOutputSummary.trim()) &&
        Boolean(draft.typicalOutputSample.trim()),
    },
  ];
  const publishReady = wizardReadiness.every((item) => item.ready);
  const getStepState = (index: number) => {
    if (activeStep === index) return "active" as const;
    if (index < activeStep && completedSteps[index]) return "completed" as const;
    return "locked" as const;
  };
  const renderStepSummary = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">{draft.agentName || "Untitled Agent"}</div>
            <div className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {draft.headline || "Add a short summary for buyers."}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">{formatAgentPrice(totalPricePerCallUsd)}</div>
            <div>Buyer price per 1M tokens</div>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">
              {agentFiles[0]?.name || "No Harness uploaded yet"}
            </div>
            <div>Private files stay protected inside the runner.</div>
          </div>
        );
      case 3:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">
              {draft.typicalOutputTitle || "Sample output"}
            </div>
            <div className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {draft.typicalOutputSummary || "Add a concise result summary for buyers."}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">
              {publishReady ? "Ready to publish" : "Review required"}
            </div>
            <div>
              {publishReady
                ? "All required fields are complete."
                : "Complete the required steps before publishing."}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#6b7684] transition hover:text-[#191f28]" to="/">
            <ArrowLeft className="size-4" />
            Home
          </Link>
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
        <div className="mx-auto max-w-5xl">
          <div className="stepStickyShell -mx-4 mb-6 px-4 md:mx-0 md:px-3">
            <div className="stepNav flex gap-2.5 overflow-x-auto md:grid md:grid-cols-5 md:gap-3 md:overflow-visible">
              {stepItems.map((step, index) => {
                const isActive = activeStep === index;
                const isCompleted = completedSteps[index] && !isActive;
                const isLocked = index > maxAccessibleStep;
                return (
                  <button
                    aria-current={isActive ? "step" : undefined}
                    aria-disabled={isLocked ? true : undefined}
                    className={`min-w-[9.2rem] flex-1 rounded-2xl border px-4 py-3.5 text-center text-xs font-semibold transition-colors duration-200 md:min-w-0 ${isActive ? "border-[#533afd]/35 bg-gradient-to-br from-[#efeaff] to-[#f8f5ff] text-[#2e2b8c] shadow-[0_8px_20px_rgba(83,58,253,0.08)]" : isCompleted ? "border-[#cfe0ff] bg-[#eef5ff] text-[#1f4da8]" : isLocked ? "cursor-not-allowed border-[#d9d5e2] bg-white/72 text-[#8b95a1]" : "border-[#d9d5e2] bg-white/94 text-[#5f6f85] hover:border-[#c8c2d8] hover:bg-[#fbfaff]"}`}
                    disabled={isLocked}
                    key={step.id}
                    onClick={() => goToStep(index)}
                    ref={(element) => { stepNavRefs.current[index] = element; }}
                    type="button"
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      <span className={`inline-flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold ${isActive ? "border-[#cfc6ff] bg-white/70 text-[#2e2b8c]" : isCompleted ? "border-[#cfe0ff] bg-white/80 text-[#1f4da8]" : isLocked ? "border-[#d9d5e2] bg-white text-[#9aa3b2]" : "border-[#d9d5e2] bg-[#f8f7fb] text-[#6b7280]"}`}>
                        {isCompleted ? <CheckCircle2 className="size-3.5" /> : String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="whitespace-nowrap text-[11px] leading-4 md:text-[12px]">{step.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 pt-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:pt-6">
            <div className="space-y-5">
              {stepError ? (
                <div className="rounded-2xl border border-[#d7d0f9] bg-[#f7f4ff] px-4 py-3 text-sm text-[#4b4a79]">
                  {stepError}
                </div>
              ) : null}
              {createError ? (
                <div className="rounded-2xl border border-[#ead2df] bg-[#fff8fb] px-4 py-3 text-sm text-[#9f1239]">
                  {createError}
                </div>
              ) : null}

              <WizardStepCard
                active={activeStep === 0}
                body={
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Agent name">
                      <Input
                        value={draft.agentName}
                        onChange={updateDraft("agentName")}
                      />
                    </Field>
                    <Field label="One-line description">
                      <Input
                        value={draft.headline}
                        onChange={updateDraft("headline")}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="Description">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={updateDraft("description")}
                        value={draft.description}
                      />
                    </Field>
                  </div>
                }
                description="Name the Agent and explain what it does."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-4 md:flex-row md:items-center md:justify-between">
                    <Button disabled size="lg" type="button" variant="secondary">
                      Back
                    </Button>
                    <Button
                      className="min-w-[10rem]"
                      onClick={handleNext}
                      size="lg"
                      type="button"
                    >
                      Next <ChevronRight />
                    </Button>
                  </div>
                }
                index={0}
                onEdit={() => goToStep(0)}
                state={getStepState(0)}
                summary={renderStepSummary(0)}
                wrapperRef={(node) => {
                  stepRefs.current[0] = node;
                }}
                title="Agent Info"
              />

              <WizardStepCard
                active={activeStep === 1}
                body={
                  <div className="grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-end">
                    <Field label="Price / 1M tokens">
                      <Input
                        min="0"
                        step="0.001"
                        type="number"
                        value={draft.pricePerCallUsd}
                        onChange={updateDraft("pricePerCallUsd")}
                      />
                    </Field>
                    <div className="rounded-2xl border border-[#cfe0ff] bg-[#f7fbff] px-4 py-3">
                      <div className="text-[10px] font-medium uppercase text-muted-foreground">
                        Buyer price
                      </div>
                      <div className="number-cell mt-1 text-xl font-semibold text-[#1c1e54]">
                        {formatAgentPrice(totalPricePerCallUsd)}
                      </div>
                    </div>
                  </div>
                }
                description="Set the buyer price for this Agent."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-4 md:flex-row md:items-center md:justify-between">
                    <Button onClick={handleBack} size="lg" type="button" variant="secondary">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button
                      className="min-w-[10rem]"
                      onClick={handleNext}
                      size="lg"
                      type="button"
                    >
                      Next <ChevronRight />
                    </Button>
                  </div>
                }
                index={1}
                onEdit={() => goToStep(1)}
                state={getStepState(1)}
                summary={renderStepSummary(1)}
                wrapperRef={(node) => {
                  stepRefs.current[1] = node;
                }}
                title="Pricing"
              />

              <WizardStepCard
                active={activeStep === 2}
                body={
                  <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#8f7dff] bg-white p-6 text-center transition hover:bg-[#f8f5ff]">
                    <UploadCloud className="size-7 text-primary" />
                    <span className="mt-3 text-sm font-semibold text-[#1c1e54]">
                      Upload private Harness archive
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      ZIP, TAR.GZ, or GZ · prompts, skills, examples, rubrics
                    </span>
                    <input
                      accept=".zip,.gz,.tgz,.tar.gz,application/zip,application/gzip"
                      className="sr-only"
                      onChange={(event) =>
                        setAgentFiles(Array.from(event.target.files ?? []))
                      }
                      type="file"
                    />
                    {agentFiles[0] ? (
                      <span className="mt-3 rounded-full bg-[#edfff4] px-3 py-1 text-xs font-semibold text-[#166534]">
                        {agentFiles[0].name}
                      </span>
                    ) : null}
                  </label>
                }
                description="Upload the protected Harness that stays private."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-4 md:flex-row md:items-center md:justify-between">
                    <Button onClick={handleBack} size="lg" type="button" variant="secondary">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button
                      className="min-w-[10rem]"
                      onClick={handleNext}
                      size="lg"
                      type="button"
                    >
                      Next <ChevronRight />
                    </Button>
                  </div>
                }
                index={2}
                onEdit={() => goToStep(2)}
                state={getStepState(2)}
                summary={renderStepSummary(2)}
                wrapperRef={(node) => {
                  stepRefs.current[2] = node;
                }}
                title="Protection"
              />

              <WizardStepCard
                active={activeStep === 3}
                body={
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field className="md:col-span-2" label="How buyers should use it">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={updateDraft("howToUse")}
                        value={draft.howToUse}
                      />
                    </Field>
                    <Field label="Sample result title">
                      <Input
                        value={draft.typicalOutputTitle}
                        onChange={updateDraft("typicalOutputTitle")}
                      />
                    </Field>
                    <Field label="Sample result summary">
                      <Input
                        value={draft.typicalOutputSummary}
                        onChange={updateDraft("typicalOutputSummary")}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="Sample result">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={updateDraft("typicalOutputSample")}
                        value={draft.typicalOutputSample}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="Result image or video">
                      <input
                        accept=".jpg,.jpeg,video/*"
                        className="block w-full rounded-md border border-dashed border-input bg-white px-3 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                        onChange={handleTypicalOutputMediaChange}
                        type="file"
                      />
                    </Field>
                    {currentTypicalOutputMediaUrl ? (
                      <div className="overflow-hidden rounded-[24px] border border-border bg-secondary md:col-span-2">
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
                      </div>
                    ) : null}
                  </div>
                }
                description="Write the contract and show the sample output."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-4 md:flex-row md:items-center md:justify-between">
                    <Button onClick={handleBack} size="lg" type="button" variant="secondary">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button
                      className="min-w-[10rem]"
                      onClick={handleNext}
                      size="lg"
                      type="button"
                    >
                      Next <ChevronRight />
                    </Button>
                  </div>
                }
                index={3}
                onEdit={() => goToStep(3)}
                state={getStepState(3)}
                summary={renderStepSummary(3)}
                wrapperRef={(node) => {
                  stepRefs.current[3] = node;
                }}
                title="Review"
              />

              <WizardStepCard
                active={activeStep === 4}
                body={
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-[#dbeafe] bg-[#f7fbff] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
                        Summary
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-[#4e5968]">
                        <div className="flex items-start justify-between gap-4">
                          <span>Agent name</span>
                          <span className="font-medium text-[#191f28]">
                            {draft.agentName || "Untitled Agent"}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span>Price</span>
                          <span className="font-medium text-[#191f28]">
                            {formatAgentPrice(totalPricePerCallUsd)}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span>Access type</span>
                          <span className="font-medium text-[#191f28]">
                            Paid · Codex users
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span>Protection</span>
                          <span className="font-medium text-[#191f28]">
                            {agentFiles[0]
                              ? "Protected Harness uploaded"
                              : "Harness missing"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-[#dbeafe] bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
                        Publish readiness
                      </div>
                      <div className="mt-3 grid gap-2">
                        {wizardReadiness.map((item) => (
                          <div className="flex items-center gap-2 text-sm text-[#4e5968]" key={item.label}>
                            <span
                              className={`flex size-6 items-center justify-center rounded-full border ${
                                item.ready
                                  ? "border-[#cfe0ff] bg-[#eef5ff] text-[#1f4da8]"
                                  : "border-[#d9d5e2] bg-white text-[#9aa3b2]"
                              }`}
                            >
                              {item.ready ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : (
                                "—"
                              )}
                            </span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#6b7684]">
                        {publishReady
                          ? "Everything needed to publish is in place."
                          : "Some required fields are still incomplete."}
                      </p>
                    </div>
                  </div>
                }
                description="Review the public summary before publishing."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-4 md:flex-row md:items-center md:justify-between">
                    <Button onClick={handleBack} size="lg" type="button" variant="secondary">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button
                      className="min-w-[10rem]"
                      disabled={isSealing}
                      onClick={handleNext}
                      size="lg"
                      type="button"
                    >
                      <ShieldCheck />
                      {isSealing ? "Publishing..." : "Publish Agent"}
                    </Button>
                  </div>
                }
                index={4}
                onEdit={() => goToStep(4)}
                state={getStepState(4)}
                summary={renderStepSummary(4)}
                wrapperRef={(node) => {
                  stepRefs.current[4] = node;
                }}
                title="Publish"
              />
            </div>

            <aside className="space-y-4 lg:sticky lg:top-[9rem]">
              <Card className="rounded-[28px] border border-[#dbeafe] bg-white/90 shadow-[0_24px_80px_rgba(15,52,96,0.08)]">
                <CardHeader>
                  <CardTitle className="text-[1.1rem] tracking-[-0.03em] text-[#191f28]">
                    Live Preview
                  </CardTitle>
                  <CardDescription>Updates as you fill the form.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[22px] border border-[#dbeafe] bg-[#f7fbff] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
                      Agent name
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#191f28]">
                      {draft.agentName || "Untitled Agent"}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#4e5968]">
                      {draft.headline || "Add a short public summary."}
                    </p>
                  </div>
                  <div className="grid gap-3 rounded-[22px] border border-[#dbeafe] bg-white p-4 text-sm text-[#4e5968]">
                    <div className="flex items-center justify-between gap-4">
                      <span>Price</span>
                      <span className="font-semibold text-[#191f28]">
                        {formatAgentPrice(totalPricePerCallUsd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Access type</span>
                      <span className="font-semibold text-[#191f28]">Paid</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Protection</span>
                      <span className="font-semibold text-[#191f28]">
                        {agentFiles[0] ? "Protected" : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Publish readiness</span>
                      <span className="font-semibold text-[#191f28]">
                        {publishReady ? "Ready" : "Incomplete"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-[#dbeafe] bg-[#f7fbff] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
                      Step progress
                    </div>
                    <div className="mt-3 grid gap-2">
                      {wizardReadiness.map((item) => (
                        <div className="flex items-center gap-2 text-sm" key={item.label}>
                          <span
                            className={`flex size-5 items-center justify-center rounded-full ${
                              item.ready
                                ? "bg-[#eef5ff] text-[#1f4da8]"
                                : "bg-white text-[#9aa3b2]"
                            }`}
                          >
                            {item.ready ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : (
                              "•"
                            )}
                          </span>
                          <span className="text-[#4e5968]">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-[28px] border border-[#dbeafe] bg-white/90 shadow-[0_24px_80px_rgba(15,52,96,0.08)]">
                <CardHeader>
                  <CardTitle className="text-[1.1rem] tracking-[-0.03em] text-[#191f28]">
                    Protection status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm leading-6 text-[#4e5968]">
                  <div>
                    {agentFiles[0]
                      ? "Private Harness uploaded."
                      : "Waiting for Harness upload."}
                  </div>
                  <div>
                    {publishReady
                      ? "Ready for publishing."
                      : "Complete the current step to continue."}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>

        {sealedRecord ? (
          <div className="mx-auto mt-6 max-w-7xl">
            <SealedRecordPreview record={sealedRecord} />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function WizardStepCard({
  active,
  body,
  description,
  footer,
  index,
  onEdit,
  wrapperRef,
  state,
  summary,
  title,
}: {
  active: boolean;
  body: ReactNode;
  description: string;
  footer?: ReactNode;
  index: number;
  onEdit?: () => void;
  wrapperRef?: (node: HTMLElement | null) => void;
  state: "active" | "completed" | "locked";
  summary: ReactNode;
  title: string;
}) {
  const isActive = state === "active";
  const isCompleted = state === "completed";
  const isLocked = state === "locked";

  const shellClassName = [
    "overflow-hidden rounded-[28px] border transition-all duration-500 ease-out",
    isActive
      ? "border-[#533afd]/35 bg-white shadow-[0_28px_90px_rgba(49,130,246,0.12)]"
      : isCompleted
        ? "border-[#cfe0ff] bg-[#f7fbff] shadow-[0_18px_50px_rgba(49,130,246,0.06)]"
        : "border-[#d9d5e2] bg-white/70 opacity-60",
  ].join(" ");

  return (
    <div className="scroll-mt-28 md:scroll-mt-32" ref={wrapperRef}>
      <Card className={shellClassName}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        {isCompleted && onEdit ? (
          <button
            className="flex flex-1 items-start gap-3 text-left transition hover:opacity-90"
            onClick={onEdit}
            type="button"
          >
            <WizardStepBadge index={index} state={state} />
            <div className="min-w-0">
              <div className="text-[1.12rem] font-semibold tracking-[-0.03em] text-[#191f28] md:text-[1.15rem]">
                {title}
              </div>
              <p className="mt-1 text-[0.92rem] leading-5 text-[#6b7684]">
                {description}
              </p>
            </div>
          </button>
        ) : (
          <div className="flex flex-1 items-start gap-3">
            <WizardStepBadge index={index} state={state} />
            <div className="min-w-0">
              <div className="text-[1.12rem] font-semibold tracking-[-0.03em] text-[#191f28] md:text-[1.15rem]">
                {title}
              </div>
              <p className="mt-1 text-[0.92rem] leading-5 text-[#6b7684]">
                {description}
              </p>
            </div>
          </div>
        )}

        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            isActive
              ? "border-[#cfc6ff] bg-[#f3efff] text-[#2e2b8c]"
              : isCompleted
                ? "border-[#cde1ff] bg-[#eef5ff] text-[#1f4da8]"
                : "border-[#d9d5e2] bg-white text-[#8b95a1]"
          }`}
        >
          {isActive ? "Current" : isCompleted ? "Done" : "Locked"}
        </div>
      </div>

      <div className="px-6 pb-5 pt-4">
        {isActive ? (
          <div
            className={`grid gap-4 transition-all duration-500 ease-out ${
              active
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-3 opacity-0"
            }`}
          >
            {body}
            {footer}
          </div>
        ) : (
          <div className="grid gap-3">{summary}</div>
        )}

        {isLocked ? (
          <p className="mt-4 text-sm leading-6 text-[#8b95a1]">
            Complete the previous step to unlock this section.
          </p>
        ) : null}
      </div>
      </Card>
    </div>
  );
}

function WizardStepBadge({
  index,
  state,
}: {
  index: number;
  state: "active" | "completed" | "locked";
}) {
  const isActive = state === "active";
  const isCompleted = state === "completed";
  const isLocked = state === "locked";

  return (
    <span
      className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold transition-all ${
        isActive
          ? "border-[#533afd]/30 bg-gradient-to-br from-[#efeaff] to-[#f8f5ff] text-[#2e2b8c] shadow-[0_10px_24px_rgba(83,58,253,0.10)]"
          : isCompleted
            ? "border-[#cde1ff] bg-[#eef5ff] text-[#1f4da8]"
            : "border-[#d8d0e6] bg-white text-[#8b95a1]"
      }`}
    >
      {isCompleted ? <CheckCircle2 className="size-4" /> : isLocked ? <LockKeyhole className="size-4" /> : String(index + 1).padStart(2, "0")}
    </span>
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
