import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
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
  ExternalLink,
  ImageIcon,
  LockKeyhole,
  LoaderCircle,
  LogIn,
  LogOut,
  MessageCircle,
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
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { categories } from "@/lib/agents";
import {
  loadMarketplaceAgents,
  sortAgentsNewestFirst,
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
import { CopyableCodeBlock } from "@/components/CopyableCodeBlock";
import { DocsPage } from "../pages/DocsPage";

const trialCallAllowance = 100;
const defaultAgentStorageEpochs = 7;
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
    copy: "Ask our plugin for a template. If you already have a working Agent folder, skip this step.",
  },
  {
    title: "Add your know-how",
    copy: "Add the knowledge that makes your Agent valuable: prompts, examples, rubrics, skills, and hidden checks.",
  },
  {
    title: "Publish and earn",
    copy: "Set pricing and get paid when clients use the Agent.",
  },
];

const publishProgressSteps = [
  "Preparing publish",
  "Uploading result media",
  "Publishing protected Harness",
  "Saving Agent listing",
  "Opening Agent page",
] as const;

const heroBeforeHarnessImage =
  "/assets/before/TalkMedia_i_9d68a183fdb2.png.png";
const heroAfterHarnessImages = [
  "/assets/after/TalkMedia_i_992129d3c2e9.jpg.jpg",
  "/assets/after/TalkMedia_i_ba3f99282062.jpg.jpg",
  "/assets/after/TalkMedia_i_c1054053616e.jpg.jpg",
  "/assets/after/TalkMedia_i_c2e84200e6f5.jpg.jpg",
  "/assets/after/TalkMedia_i_d8524efc8c6d.jpg.jpg"
];

const creatorIpLayers = [
  {
    label: "Client sees",
    items: ["Skills", "Price", "Sample input", "Result media"],
  },
  {
    label: "Creator keeps",
    items: ["AGENTS.md", "Prompts", "Rubrics", "Examples", "Hidden checks"],
  },
];

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
const tryChatTranscriptsStorageKey = "hireme-demo-try-chat-transcripts-v2";
const legacyTryChatTranscriptsStorageKeys = [
  "hireme-demo-try-chat-transcripts-v1",
];
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
const categoryPricing: Record<
  Agent["category"],
  {
    basePriceUsd: number;
    Icon: LucideIcon;
    iconClassName: string;
  }
> = {
  Research: {
    basePriceUsd: 0.12,
    Icon: Search,
    iconClassName: "from-[#eff6ff] to-[#dbeafe] text-[#1d4ed8]",
  },
  Code: {
    basePriceUsd: 0.18,
    Icon: Braces,
    iconClassName: "from-[#f0fdf4] to-[#dcfce7] text-[#15803d]",
  },
  Data: {
    basePriceUsd: 0.16,
    Icon: ServerCog,
    iconClassName: "from-[#ecfeff] to-[#cffafe] text-[#0e7490]",
  },
  Image: {
    basePriceUsd: 0.2,
    Icon: ImageIcon,
    iconClassName: "from-[#fff7ed] to-[#dbeafe] text-[#1d4ed8]",
  },
};
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
  creatorInfoUrl?: string;
  agentName: string;
  agentSlug: string;
  headline?: string;
  description: string;
  howToUse?: string;
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

type AgentDraft = {
  category: Agent["category"] | "";
  agentName: string;
  headline: string;
  description: string;
  creatorInfoUrl: string;
  howToUse: string;
  sampleInput: string;
  creatorFeeUsd: string;
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
    storageEpochs?: number;
  };
  upload?: {
    storageProvider?: string;
    storageEpochs?: number;
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
  creatorInfoUrl?: string;
  category?: Agent["category"];
  status?: Agent["status"];
  headline?: string;
  publicSummary?: string;
  howToUse?: string;
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
  createdAt?: string;
  updatedAt?: string;
};

type GatewayAccessPayload = Omit<Partial<AgentAccessRecord>, "source"> & {
  source?: string;
  storageSource?: string;
  agent?: GatewayPublicAgent;
};

type GatewayAgentCallResponse = {
  activeAgentId?: string;
  agentId?: string;
  callId?: string;
  attachments?: unknown[];
  codexView?: unknown;
  conversationId?: string | null;
  error?: unknown;
  message?: string;
  memoryJobId?: string | null;
  outputText?: string | null;
  responseMode?: string;
  resultAttachments?: unknown[];
  status?: string;
  result?: {
    outputText?: string;
    outputMode?: string;
    type?: string;
    attachments?: unknown[];
    outputFiles?: unknown[];
  };
  jsonOutput?: {
    responseMode?: string;
    payload?: {
      attachments?: unknown[];
      outputText?: string;
      outputFiles?: unknown[];
      summary?: string;
      [key: string]: unknown;
    };
    localCodex?: {
      shouldAct?: boolean;
      instruction?: string;
      preferredSource?: string;
    };
  };
  ledgerEvent?: {
    mcpConversationId?: string | null;
    responseDigest?: string;
    status?: string;
  };
  memory?: {
    status?: string;
    jobId?: string;
    waitForMemory?: boolean | null;
    conversationStored?: boolean | null;
  };
  userMemWal?: {
    stored?: boolean;
    status?: string;
    jobId?: string;
    recordPath?: string;
  };
  mcpConversation?: {
    stored?: boolean;
    status?: string;
    configured?: boolean;
    conversationId?: string;
    memoryJobId?: string | null;
    blobId?: string | null;
    indexJobId?: string | null;
    error?: {
      code?: string;
      message?: string;
    } | null;
  };
  authorization?: {
    trialCallsRemaining?: number | null;
  };
};

type GatewayAgentStreamEvent = {
  data: GatewayAgentCallResponse;
  event: string;
};

type TryChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: TryChatAttachment[];
  createdAt: string;
  pending?: boolean;
  error?: boolean;
  memWalBlobId?: string | null;
  memWalStatus?: TryMemWalDisplayStatus | null;
  responseMode?: string | null;
};

type TryChatAttachment = {
  id: string;
  type: "image";
  url: string;
  label: string;
};

type TryMemWalDisplayStatus = "pending" | "stored" | "failed";

type TryConversationContext = {
  agentId: string;
  conversationId: string;
  memWalStatus: string;
  conversationStored: boolean | null;
  mcpConversationStatus: string | null;
  memWalBlobId?: string | null;
  userMemWalStatus: string | null;
  memoryJobId?: string | null;
  waitForMemory?: boolean | null;
};

type TryChatTranscriptRecord = {
  conversationContext: TryConversationContext | null;
  messages: TryChatMessage[];
  updatedAt: string;
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

type GatewayWalletAgentStatPayload = {
  agentId: string;
  agentUuid?: string | null;
  name?: string;
  owned?: boolean;
  totalEarnedSui?: string;
  myEarnedSui?: string;
  claimableSui?: string;
  mySpentSui?: string;
  totalCallCount?: number;
  earnedCallCount?: number;
  spentCallCount?: number;
  lastEarnedAt?: string | null;
  lastChargedAt?: string | null;
};

type GatewayWalletSummaryPayload = {
  status?: string;
  reason?: string;
  balance?: {
    availableSui?: string;
    netBalanceSui?: string;
    claimableEarningsSui?: string;
    topUpSui?: string;
    spentSui?: string;
    earnedSui?: string;
    claimedSui?: string;
  };
  agents?: GatewayWalletAgentStatPayload[];
  ledger?: {
    spendCallCount?: number;
    earningCallCount?: number;
    ownedAgentCount?: number;
  };
  source?: string;
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
          path="/agents/:agentId/edit"
          element={<EditAgentPage user={authUser} />}
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
    category: Agent["category"] | "";
    agentName: string;
    headline: string;
    description: string;
    creatorInfoUrl: string;
    howToUse: string;
    sampleInput: string;
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
  const creatorInfoUrl = normalizeCreatorInfoUrl(draft.creatorInfoUrl);
  const metadata = {
    agent_id: agentSlug,
    name: draft.agentName,
    handle: `@agents/${agentSlug}`,
    creator,
    creator_info_url: creatorInfoUrl || null,
    category: draft.category || "Code",
    status: "Available",
    headline: draft.headline,
    public_summary: draft.description || draft.headline,
    how_to_use: draft.howToUse,
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
    storage_epochs: defaultAgentStorageEpochs,
    result_title: "Sample Input",
    result_summary: "",
    result_sample: draft.sampleInput,
    result_media_url: typicalOutputUpload?.url,
    result_media_type: typicalOutputUpload?.type,
    metadata: {
      source: "web_create_agent",
      creatorInfoUrl: creatorInfoUrl || null,
      howToUse: draft.howToUse,
      sampleInput: draft.sampleInput,
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
    creator_info_url: agent.creatorInfoUrl || null,
    category: agent.category,
    status: agent.status,
    headline: agent.headline,
    public_summary: agent.publicSummary || agent.headline,
    how_to_use: agent.howToUse || null,
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
    storage_epochs: defaultAgentStorageEpochs,
    release_notes: releaseNotes || "Updated from the HireMe web creator UI.",
    result_title: agent.resultPreview.title,
    result_summary: agent.resultPreview.summary,
    result_sample: agent.resultPreview.sample,
    result_media_url: agent.resultPreview.mediaUrl,
    result_media_type: agent.resultPreview.mediaType,
    metadata: {
      source: "web_update_agent",
      creatorInfoUrl: agent.creatorInfoUrl || null,
      howToUse: agent.howToUse || null,
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

async function updateAgentMetadataWithGateway({
  agent,
  user,
}: {
  agent: Agent;
  user: AuthUser | null;
}): Promise<GatewayAgentRegistrationResult> {
  const tokenPrice = agent.pricePer1MTokensSui ?? agent.pricePerCallUsd;
  const payload = {
    agent_id: agent.id,
    name: agent.name,
    handle: agent.handle,
    creator:
      agent.creator || user?.displayName || user?.email || user?.wallet || "Web creator",
    creator_info_url: agent.creatorInfoUrl || null,
    category: agent.category,
    status: agent.status,
    headline: agent.headline,
    public_summary: agent.publicSummary || agent.headline,
    how_to_use: agent.howToUse || null,
    public_mcp_contract:
      agent.publicContract || `${agent.id}(task, context, budget_calls)`,
    memwal_policy: agent.memwalPolicy,
    skills: agent.skills?.length ? agent.skills : ["Protected Harness", "Codex MCP"],
    protected_asset_classes: agent.protectedAssets?.length
      ? agent.protectedAssets
      : ["AGENTS.md", "skills/**", "private prompts"],
    price_per_1m_tokens_sui: tokenPrice,
    price_per_1m_tokens_usd: tokenPrice,
    price_per_call_usd: tokenPrice,
    free_calls: agent.freeCalls,
    storage_network: agent.sealedHarness.network,
    seal_policy_id: agent.sealedHarness.sealPolicyId,
    walrus_blob_id: agent.sealedHarness.walrusBlobId,
    sui_object_id: agent.sealedHarness.suiObjectId,
    ciphertext_digest: agent.sealedHarness.ciphertextDigest,
    result_title: agent.resultPreview.title,
    result_summary: agent.resultPreview.summary,
    result_sample: agent.resultPreview.sample,
    result_media_url: agent.resultPreview.mediaUrl,
    result_media_type: agent.resultPreview.mediaType,
    metadata: {
      source: "web_edit_agent_metadata",
      creatorInfoUrl: agent.creatorInfoUrl || null,
      howToUse: agent.howToUse || null,
      updatedBy:
        user?.email || user?.wallet || user?.displayName || "anonymous-web-user",
    },
  };

  const response = await fetch(`${gatewayUrl}/v1/agents/register`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify(payload),
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

function markAccessRecordUsed(record: AgentAccessRecord) {
  if (
    record.accessType !== "trial" ||
    record.trialCallsRemaining === null ||
    record.trialCallsRemaining === undefined
  ) {
    return { ...record, updatedAt: new Date().toISOString() };
  }

  return {
    ...record,
    trialCallsRemaining: Math.max(0, record.trialCallsRemaining - 1),
    updatedAt: new Date().toISOString(),
  };
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

async function callTryAgent({
  access,
  agent,
  conversationId,
  onEvent,
  task,
  user,
}: {
  access: AgentAccessRecord;
  agent: Agent;
  conversationId: string;
  onEvent?: (event: GatewayAgentStreamEvent) => void;
  task: string;
  user: AuthUser;
}) {
  const response = await fetch(`${gatewayUrl}/v1/agent-call/stream`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      agent_id: agent.id,
      task,
      hirer_id: access.hirerId || hirerIdFor(user),
      hire_receipt_object_id: access.receiptObjectId,
      wallet_address: user.wallet,
      email: user.email,
      response_mode: "direct_answer",
      conversation_id: conversationId,
      conversation_title: `${agent.name} Try`,
      wait_for_memory: false,
      waitForMemory: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }
  if (!response.body) {
    throw new Error("Gateway stream did not return a readable body.");
  }

  return readAgentCallStream(response.body, onEvent);
}

async function readAgentCallStream(
  body: ReadableStream<Uint8Array>,
  onEvent?: (event: GatewayAgentStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalCall: GatewayAgentCallResponse | null = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() || "";
      for (const part of parts) {
        const event = parseAgentStreamEvent(part);
        if (!event) continue;
        onEvent?.(event);
        finalCall = mergeStreamEventIntoCall(finalCall, event);
        if (event.event === "error") {
          streamError =
            typeof event.data.message === "string"
              ? event.data.message
              : "Agent stream failed.";
        }
      }
    }
    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseAgentStreamEvent(buffer);
    if (event) {
      onEvent?.(event);
      finalCall = mergeStreamEventIntoCall(finalCall, event);
      if (event.event === "error") {
        streamError =
          typeof event.data.message === "string"
            ? event.data.message
            : "Agent stream failed.";
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!finalCall) throw new Error("Agent stream ended without a result.");
  return finalCall;
}

function parseAgentStreamEvent(raw: string): GatewayAgentStreamEvent | null {
  const lines = raw.split(/\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (!dataLines.length) return null;
  try {
    return {
      data: JSON.parse(dataLines.join("\n")) as GatewayAgentCallResponse,
      event,
    };
  } catch {
    return null;
  }
}

function mergeStreamEventIntoCall(
  current: GatewayAgentCallResponse | null,
  streamEvent: GatewayAgentStreamEvent,
): GatewayAgentCallResponse {
  const data = streamEvent.data;
  if (streamEvent.event === "memwal_pending") {
    return {
      ...(current || {}),
      callId: data.callId || current?.callId,
      conversationId: data.conversationId || current?.conversationId,
      memory: {
        ...(current?.memory || {}),
        conversationStored: data.conversationId ? false : null,
        jobId: data.memoryJobId || current?.memory?.jobId,
        status: "pending",
        waitForMemory: data.memory?.waitForMemory ?? null,
      },
      memoryJobId: data.memoryJobId || current?.memoryJobId,
      userMemWal: {
        ...(current?.userMemWal || {}),
        jobId: data.memoryJobId || current?.userMemWal?.jobId,
        status: "pending",
        stored: false,
      },
    };
  }
  if (streamEvent.event === "memwal_stored") {
    return {
      ...(current || {}),
      callId: data.callId || current?.callId,
      conversationId:
        data.mcpConversation?.conversationId ||
        data.conversationId ||
        current?.conversationId,
      mcpConversation: data.mcpConversation || current?.mcpConversation,
      memory: {
        ...(current?.memory || {}),
        conversationStored: data.mcpConversation?.stored ?? null,
        status: data.mcpConversation?.stored ? "stored" : "pending",
      },
      userMemWal: data.userMemWal || current?.userMemWal,
    };
  }
  if (streamEvent.event === "done") {
    return {
      ...(current || {}),
      ...data,
      memory: data.memory || current?.memory,
    };
  }
  if (streamEvent.event === "output_fast" || streamEvent.event === "result") {
    return {
      ...(current || {}),
      ...data,
      result: data.result || current?.result,
      jsonOutput: data.jsonOutput || current?.jsonOutput,
      outputText: data.outputText || current?.outputText,
    };
  }
  return {
    ...(current || {}),
    ...data,
  };
}

async function loadTryMemoryStatus(memoryJobId: string) {
  const response = await fetch(`${gatewayUrl}/v1/agent-memory-status`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      memory_job_id: memoryJobId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as GatewayAgentCallResponse;
}

function tryConversationId(
  access: AgentAccessRecord,
  agent: Agent,
  user: AuthUser,
) {
  return `web-try-v2-${access.hirerId || hirerIdFor(user)}-${agent.id}`;
}

function extractAgentCallText(call: GatewayAgentCallResponse) {
  const candidates = [
    call.outputText,
    call.result?.outputText,
    call.jsonOutput?.payload?.outputText,
    call.jsonOutput?.payload?.summary,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  if (call.jsonOutput?.payload) {
    return JSON.stringify(call.jsonOutput.payload, null, 2);
  }
  if (call.result) {
    return JSON.stringify(call.result, null, 2);
  }
  return "The Agent returned an empty response.";
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function initialTryChatMessages(agent: Agent): TryChatMessage[] {
  return [
    {
      id: `assistant-${Date.now().toString(36)}`,
      role: "assistant",
      text: `Ask ${agent.name} a small test task. The private Harness stays behind the gateway.`,
      createdAt: new Date().toISOString(),
    },
  ];
}

function tryChatTranscriptKey(
  access: AgentAccessRecord,
  agent: Agent,
  user: AuthUser,
) {
  return `${access.hirerId || hirerIdFor(user)}:${agent.id}:${tryConversationId(
    access,
    agent,
    user,
  )}`;
}

function readTryChatTranscript(key: string): TryChatTranscriptRecord | null {
  try {
    clearLegacyTryChatTranscripts();
    const raw = window.localStorage.getItem(tryChatTranscriptsStorageKey);
    if (!raw) return null;
    const store = JSON.parse(raw) as Record<string, TryChatTranscriptRecord>;
    const record = store[key];
    if (!record || !Array.isArray(record.messages)) return null;
    return {
      conversationContext: record.conversationContext || null,
      messages: record.messages.filter(isTryChatMessage).slice(-80),
      updatedAt: record.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function clearLegacyTryChatTranscripts() {
  try {
    legacyTryChatTranscriptsStorageKeys.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // Chat still works if browser storage is unavailable.
  }
}

function writeTryChatTranscript(key: string, record: TryChatTranscriptRecord) {
  try {
    const raw = window.localStorage.getItem(tryChatTranscriptsStorageKey);
    const store = raw
      ? (JSON.parse(raw) as Record<string, TryChatTranscriptRecord>)
      : {};
    store[key] = {
      ...record,
      messages: record.messages.map(sanitizeTryChatMessageForStorage).slice(-80),
      updatedAt: new Date().toISOString(),
    };
    const entries = Object.entries(store)
      .sort(
        ([, left], [, right]) =>
          Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""),
      )
      .slice(0, 40);
    window.localStorage.setItem(
      tryChatTranscriptsStorageKey,
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {
    // Chat still works if browser storage is unavailable or full.
  }
}

function isTryChatMessage(value: unknown): value is TryChatMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TryChatMessage>;
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.text === "string" &&
    typeof candidate.id === "string"
  );
}

function sanitizeTryChatMessageForStorage(message: TryChatMessage) {
  return {
    ...message,
    attachments: message.attachments?.filter(
      (attachment) => attachment.url.length < 200_000,
    ),
    pending: false,
  };
}

function buildTryConversationContext({
  agentId,
  call,
  conversationId,
}: {
  agentId: string;
  call: GatewayAgentCallResponse;
  conversationId: string;
}): TryConversationContext {
  return {
    agentId,
    conversationId:
      call.mcpConversation?.conversationId ||
      call.ledgerEvent?.mcpConversationId ||
      call.conversationId ||
      conversationId,
    memWalStatus:
      call.mcpConversation?.stored === true
        ? "stored"
        : call.mcpConversation?.status ||
          call.memory?.status ||
          call.ledgerEvent?.status ||
          "unknown",
    conversationStored:
      typeof call.mcpConversation?.stored === "boolean"
        ? call.mcpConversation.stored
        : call.memory?.conversationStored ?? null,
    mcpConversationStatus: call.mcpConversation?.status || null,
    memWalBlobId: call.mcpConversation?.blobId || null,
    userMemWalStatus: call.userMemWal?.status || null,
    memoryJobId:
      call.mcpConversation?.memoryJobId ||
      call.userMemWal?.jobId ||
      call.memory?.jobId ||
      call.memoryJobId ||
      null,
    waitForMemory: call.memory?.waitForMemory ?? null,
  };
}

function tryMemWalDisplayStatus(
  conversation: TryConversationContext,
): TryMemWalDisplayStatus | null {
  if (conversation.conversationStored === true) {
    return "stored";
  }
  if (
    conversation.mcpConversationStatus === "failed" ||
    conversation.memWalStatus === "failed"
  ) {
    return "failed";
  }
  if (
    conversation.memWalStatus === "pending" ||
    conversation.conversationStored === false
  ) {
    return "pending";
  }
  return null;
}

function latestAssistantMessageId(messages: TryChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") return messages[index].id;
  }
  return null;
}

function extractTryImageAttachments(call: GatewayAgentCallResponse) {
  const sources = [
    call.resultAttachments,
    call.attachments,
    call.result?.attachments,
    call.result?.outputFiles,
    call.jsonOutput?.payload?.attachments,
    call.jsonOutput?.payload?.outputFiles,
  ];
  const images: TryChatAttachment[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const values = Array.isArray(source) ? source : source ? [source] : [];
    for (const value of values) {
      const image = tryImageAttachmentFromValue(value, images.length);
      if (!image || seen.has(image.url)) continue;
      seen.add(image.url);
      images.push(image);
      if (images.length >= 6) return images;
    }
  }

  return images;
}

function tryImageAttachmentFromValue(
  value: unknown,
  index: number,
): TryChatAttachment | null {
  if (typeof value === "string") {
    if (!looksLikeBrowserImageUrl(value)) return null;
    return {
      id: `image-${index}`,
      label: `Image ${index + 1}`,
      type: "image",
      url: value,
    };
  }
  if (!isPlainRecord(value)) return null;

  const mimeType =
    readRecordString(value, ["mimeType", "mime_type", "contentType", "content_type"]) ||
    guessImageMimeType(
      readRecordString(value, ["filename", "fileName", "name", "path", "downloadUrl", "url"]) ||
        "",
    );
  const url =
    readRecordString(value, ["downloadUrl", "download_url", "url", "href", "src"]) ||
    relativeGatewayUrl(readRecordString(value, ["downloadPath", "download_path"]));
  if (url && (isImageMimeType(mimeType) || looksLikeBrowserImageUrl(url))) {
    return {
      id: `image-${index}`,
      label:
        readRecordString(value, ["filename", "fileName", "name", "title"]) ||
        `Image ${index + 1}`,
      type: "image",
      url,
    };
  }

  const data = readRecordString(value, ["data", "base64", "contentBase64", "blob"]);
  if (!data) return null;
  if (data.startsWith("data:image/")) {
    return {
      id: `image-${index}`,
      label:
        readRecordString(value, ["filename", "fileName", "name", "title"]) ||
        `Image ${index + 1}`,
      type: "image",
      url: data,
    };
  }
  if (!isImageMimeType(mimeType)) return null;
  return {
    id: `image-${index}`,
    label:
      readRecordString(value, ["filename", "fileName", "name", "title"]) ||
      `Image ${index + 1}`,
    type: "image",
    url: `data:${mimeType};base64,${data.replace(/^data:[^;]+;base64,/i, "")}`,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRecordString(
  value: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function isImageMimeType(value: string) {
  return value.toLowerCase().startsWith("image/");
}

function guessImageMimeType(value: string) {
  const path = value.toLowerCase().split("?")[0];
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "";
}

function looksLikeBrowserImageUrl(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("data:image/") ||
    /^https?:\/\//i.test(trimmed) ||
    (trimmed.startsWith("/") && Boolean(guessImageMimeType(trimmed)))
  );
}

function relativeGatewayUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return "";
  return `${gatewayUrl}${path}`;
}

function walrusExplorerBlobUrl(blobId?: string | null) {
  if (!blobId) return null;
  return `https://walruscan.com/mainnet/blob/${encodeURIComponent(blobId)}`;
}

function buildTryCodexSnippet({
  access,
  agent,
  conversation,
  user,
}: {
  access: AgentAccessRecord;
  agent: Agent;
  conversation: TryConversationContext | null;
  user: AuthUser;
}) {
  const hirerId = access.hirerId || hirerIdFor(user);
  const conversationId =
    conversation?.conversationId || tryConversationId(access, agent, user);
  const lines = [
    "Ask HireMe to continue this web chat.",
    "",
    `  Agent: ${conversation?.agentId || agent.id}`,
    `  Conversation id: ${conversationId}`,
    `  User: ${user.email || hirerId}`,
    "  Request: ",
  ];
  return lines.join("\n");
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

type MarkdownBlock =
  | { type: "blockquote"; text: string }
  | { type: "code"; code: string; language: string }
  | { type: "heading"; depth: 1 | 2 | 3; text: string }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "paragraph"; text: string };

function TryChatMessageContent({ message }: { message: TryChatMessage }) {
  if (message.role === "assistant" && message.pending && !message.error) {
    return <TryPendingAgentActivity label={message.text} />;
  }

  if (message.role === "assistant" && !message.error) {
    return <TryMarkdownContent text={message.text} />;
  }

  return <div className="whitespace-pre-wrap">{message.text}</div>;
}

function TryPendingAgentActivity({ label }: { label: string }) {
  const cleanLabel = label.replace(/\.+$/, "");
  const characters = Array.from(cleanLabel);

  return (
    <div aria-live="polite" className="try-agent-pending">
      <span className="sr-only">{cleanLabel}</span>
      <span aria-hidden="true" className="try-agent-pending-text">
        {characters.map((character, index) => (
          <span
            className="try-agent-pending-letter"
            key={`${character}-${index}`}
            style={{ animationDelay: `${index * 34}ms` }}
          >
            {character === " " ? "\u00a0" : character}
          </span>
        ))}
        <span
          className="try-agent-pending-letter"
          style={{ animationDelay: `${characters.length * 34}ms` }}
        >
          .
        </span>
        <span
          className="try-agent-pending-letter"
          style={{ animationDelay: `${(characters.length + 1) * 34}ms` }}
        >
          .
        </span>
        <span
          className="try-agent-pending-letter"
          style={{ animationDelay: `${(characters.length + 2) * 34}ms` }}
        >
          .
        </span>
      </span>
    </div>
  );
}

function TryMarkdownContent({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text);
  return (
    <div className="grid gap-2">
      {blocks.map((block, index) => {
        const key = `md-${index}`;
        if (block.type === "heading") {
          const className =
            block.depth === 1
              ? "text-base font-semibold leading-6"
              : "text-sm font-semibold leading-6";
          return (
            <div className={className} key={key}>
              {renderInlineMarkdown(block.text, key)}
            </div>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              className="max-h-72 overflow-auto rounded-md border border-border bg-white p-3 text-[11px] leading-5 text-[#1c1e54]"
              key={key}
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              className={`grid gap-1 pl-5 ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
              key={key}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>
                  {renderInlineMarkdown(item, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          );
        }
        if (block.type === "blockquote") {
          return (
            <blockquote
              className="border-l-2 border-primary/30 pl-3 text-muted-foreground"
              key={key}
            >
              {renderInlineMarkdown(block.text, key)}
            </blockquote>
          );
        }
        return (
          <p className="whitespace-pre-wrap" key={key}>
            {renderInlineMarkdown(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```(\w+)?\s*$/.exec(line.trim());
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        code: code.join("\n"),
        language: fence[1] || "",
        type: "code",
      });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        depth: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
        type: "heading",
      });
      index += 1;
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const items: string[] = [];
      const orderedList = Boolean(ordered);
      while (index < lines.length) {
        const match = orderedList
          ? /^\d+\.\s+(.+)$/.exec(lines[index])
          : /^[-*]\s+(.+)$/.exec(lines[index]);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ items, ordered: orderedList, type: "list" });
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      const quotes: string[] = [];
      while (index < lines.length) {
        const match = /^>\s?(.+)$/.exec(lines[index]);
        if (!match) break;
        quotes.push(match[1].trim());
        index += 1;
      }
      blocks.push({ text: quotes.join("\n"), type: "blockquote" });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index].trim()) &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ text: paragraph.join("\n"), type: "paragraph" });
  }

  return blocks.length ? blocks : [{ text, type: "paragraph" }];
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("`")) {
      nodes.push(
        <code
          className="rounded bg-white px-1 py-0.5 font-mono text-[0.92em] text-[#1c1e54]"
          key={key}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={link[2]}
            key={key}
            rel="noreferrer"
            target="_blank"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
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

async function loadGatewayWalletSummary(user: AuthUser) {
  const response = await fetch(`${gatewayUrl}/v1/my/wallet-summary`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify(walletRequestPayload(user)),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as GatewayWalletSummaryPayload;
}

async function topUpGatewayWallet(user: AuthUser, amountSui = "1") {
  const response = await fetch(`${gatewayUrl}/v1/my/wallet/top-up`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify({
      ...walletRequestPayload(user),
      amount_sui: amountSui,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as GatewayWalletSummaryPayload;
}

async function claimGatewayWalletEarnings(user: AuthUser) {
  const response = await fetch(`${gatewayUrl}/v1/my/wallet/claim`, {
    method: "POST",
    headers: gatewayRequestHeaders(),
    body: JSON.stringify(walletRequestPayload(user)),
  });

  if (!response.ok) {
    throw new Error(`Gateway ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as GatewayWalletSummaryPayload;
}

function walletRequestPayload(user: AuthUser) {
  return {
    hirer_id: hirerIdFor(user),
    wallet_address: user.wallet,
    email: user.email,
    display_name: displayNameFor(user),
  };
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
    creatorInfoUrl: agent?.creatorInfoUrl,
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
    category: agent?.category || "Code",
    categories: [agent?.category || "Code"],
    status: agent?.status || "Available",
    headline,
    publicSummary: agent?.publicSummary || headline,
    howToUse: agent?.howToUse,
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
    createdAt: agent?.createdAt,
    updatedAt: agent?.updatedAt || agent?.createdAt,
    resultPreview: {
      title: `${skills[0]} result`,
      summary: `Returns safe ${agent?.publicContract || "hireme_agent(task)"} output with gateway authorization metadata.`,
      sample: `${headline} Response includes action items, constraints, and verification notes.`,
    },
    mcpPackage: `mcp://hireme/${id}`,
    accent: "from-[#533afd] to-[#6ee7f9]",
  };
}

function createdAgentRecordToAgent(record: CreatedAgentRecord, user?: AuthUser | null): Agent {
  const category = inferAgentCategory(record.agentSlug, record.headline || record.description);
  const tokenPrice = record.pricePerCallUsd;
  const creator =
    user?.displayName?.trim() ||
    record.creatorEmail ||
    record.creatorId ||
    "Web creator";

  return {
    id: record.agentSlug,
    name: record.agentName,
    handle: `@agents/${record.agentSlug}`,
    creator,
    creatorInfoUrl: record.creatorInfoUrl,
    team: {
      id: record.agentSlug,
      name: `${record.agentName} Team`,
      handle: `@teams/${record.agentSlug}`,
      owner: creator,
      headline: record.headline || record.description,
      publicSummary: record.description,
      agentCount: 1,
      accent: "from-[#533afd] to-[#6ee7f9]",
      billing: {
        unit: "per_agent",
        basePriceUsd: tokenPrice,
        includedCalls: trialCallAllowance,
        overagePricePerCallUsd: tokenPrice,
        note: `${formatAgentPrice(tokenPrice)} through the executing agent ledger.`,
      },
    },
    teamRole: "Specialist",
    listedIndividually: true,
    category,
    categories: [category],
    status: "Available",
    headline: record.headline || record.description,
    publicSummary: record.description,
    howToUse: record.howToUse,
    publicContract: `${record.agentSlug}(task, context, budget_calls)`,
    memwalPolicy:
      "Hirer-visible results are stored in hirer-scoped memWal records. Creator private files stay behind the gateway.",
    skills: ["Protected Harness", "Codex MCP"],
    protectedAssets: ["Agent Harness archive", "AGENTS.md", "skills/**"],
    sealedHarness: {
      network: "walrus-testnet",
      sealPolicyId: `platform:agent:${record.agentSlug}`,
      walrusBlobId: record.walrusBlobId,
      suiObjectId: record.suiObjectId,
      ciphertextDigest: record.ciphertextDigest,
      visibility:
        "Protected artifact details are resolved by the gateway at call time.",
    },
    pricePerCallUsd: tokenPrice,
    pricePer1MTokensSui: tokenPrice,
    freeCalls: trialCallAllowance,
    rating: 0,
    calls: 0,
    latencyMs: record.avgLatencyMs || 0,
    avgInputTokens: record.avgTokenCount || 0,
    avgOutputTokens: 0,
    activeUsers: record.activeUsers,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    resultPreview: {
      title: "Sample Input",
      summary: record.typicalOutputSample || record.description,
      sample: record.typicalOutputSample || "",
      mediaUrl: record.typicalOutputMediaUrl,
      mediaType: record.typicalOutputMediaType,
    },
    mcpPackage: `mcp://hireme/${record.agentSlug}`,
    accent: "from-[#533afd] to-[#6ee7f9]",
  };
}

function inferAgentCategory(agentId: string, text = ""): Agent["category"] {
  const haystack = `${agentId} ${text}`.toLowerCase();
  if (haystack.includes("image") || haystack.includes("character") || haystack.includes("png")) {
    return "Image";
  }
  if (haystack.includes("data") || haystack.includes("ledger")) return "Data";
  if (haystack.includes("research")) return "Research";
  return "Code";
}

function defaultAgentDraft(): AgentDraft {
  return {
    category: "",
    agentName: "",
    headline: "",
    description: "",
    creatorInfoUrl: "",
    howToUse: "",
    sampleInput: "",
    creatorFeeUsd: "",
  };
}

function agentDraftFromAgent(agent: Agent): AgentDraft {
  const basePrice = categoryPricing[agent.category]?.basePriceUsd ?? 0;
  const tokenPrice = agent.pricePer1MTokensSui ?? agent.pricePerCallUsd;
  const creatorFee = Math.max(0, tokenPrice - basePrice);
  return {
    category: agent.category,
    agentName: agent.name,
    headline: agent.headline,
    description: agent.publicSummary || agent.headline,
    creatorInfoUrl: agent.creatorInfoUrl || "",
    howToUse: agent.howToUse || "",
    sampleInput: agent.resultPreview.sample || "",
    creatorFeeUsd: creatorFee ? formatDraftNumber(creatorFee) : "",
  };
}

function agentFromDraft({
  baseAgent,
  draft,
  media,
  pricePerCallUsd,
}: {
  baseAgent: Agent;
  draft: AgentDraft;
  media?: {
    type?: "image" | "video";
    url?: string;
  } | null;
  pricePerCallUsd: number;
}): Agent {
  return {
    ...baseAgent,
    name: draft.agentName.trim() || baseAgent.name,
    creatorInfoUrl: normalizeCreatorInfoUrl(draft.creatorInfoUrl) || undefined,
    category: draft.category || baseAgent.category,
    categories: [draft.category || baseAgent.category],
    headline: draft.headline.trim() || baseAgent.headline,
    publicSummary:
      draft.description.trim() || draft.headline.trim() || baseAgent.publicSummary,
    howToUse: draft.howToUse.trim() || undefined,
    pricePerCallUsd,
    pricePer1MTokensSui: pricePerCallUsd,
    resultPreview: {
      ...baseAgent.resultPreview,
      sample: draft.sampleInput.trim() || baseAgent.resultPreview.sample,
      mediaUrl: media?.url || baseAgent.resultPreview.mediaUrl,
      mediaType: media?.type || baseAgent.resultPreview.mediaType,
    },
    updatedAt: new Date().toISOString(),
  };
}

function formatDraftNumber(value: number) {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function mergeAgentCatalog(current: Agent[], incoming: Agent[]) {
  const byId = new Map(current.map((agent) => [agent.id, agent]));
  for (const agent of incoming) {
    byId.set(agent.id, { ...byId.get(agent.id), ...agent });
  }
  return sortAgentsNewestFirst([...byId.values()]);
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
  const [afterImageIndex, setAfterImageIndex] = useState(0);
  const activeAfterImage = heroAfterHarnessImages[afterImageIndex] ?? heroAfterHarnessImages[0];

  useEffect(() => {
    if (heroAfterHarnessImages.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setAfterImageIndex((current) => (current + 1) % heroAfterHarnessImages.length);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      aria-label="Before and after results from a protected design Agent"
      className="hero-demo-visual relative mx-auto min-h-[390px] w-full max-w-[540px] select-none sm:min-h-[430px] lg:min-h-[480px]"
    >
      <div className="hero-demo-glow absolute inset-x-[10%] top-[14%] h-[66%] rounded-full bg-[rgba(124,92,255,0.15)] blur-[100px]" />

      <div className="hero-result-showcase absolute inset-x-0 top-[8%] mx-auto max-w-[520px] sm:top-[7%]">
        <div className="hero-result-card hero-result-card--before">
          <div className="hero-result-card-header">
            <span>Normal Output</span>
          </div>
          <div className="hero-result-image-frame">
            <img
              alt="Visual result without a specialized Agent"
              className="hero-result-image"
              draggable="false"
              src={heroBeforeHarnessImage}
            />
          </div>
        </div>

        <div className="hero-result-card hero-result-card--after">
          <div className="hero-result-card-header">
            <span>With Specialized Agent</span>
          </div>
          <div className="hero-result-image-frame">
            <img
              key={activeAfterImage}
              alt="Visual result generated with a specialized Agent"
              className="hero-result-image hero-result-image--active"
              draggable="false"
              src={activeAfterImage}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(124,92,255,0.14)] bg-[rgba(124,92,255,0.06)] px-3 py-1.5 text-[10px] font-semibold uppercase text-[#74668f]">
              <ShieldCheck className="size-3.5" />
              Protected Harness applied
            </div>
            <div className="flex items-center gap-1.5">
              {heroAfterHarnessImages.map((image, index) => (
                <span
                  aria-hidden="true"
                  className={`hero-result-dot ${index === afterImageIndex ? "hero-result-dot--active" : ""}`}
                  key={image}
                />
              ))}
            </div>
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
        <div className="mx-auto grid min-h-[calc(100svh-5rem)] page-shell w-full items-center gap-12 lg:grid-cols-[minmax(0,1.16fr)_minmax(280px,0.84fr)] lg:gap-10 xl:gap-14">
          <div className="landing-hero-copy max-w-[780px] py-0">
            <div className="reveal stagger-item" data-reveal>
              <h1 className="hero-title balanced-text text-[#191f28]">
                <span className="hero-title-line">Hire expert Agents</span>
                <span className="hero-title-line">without exposing private work.</span>
              </h1>
            </div>
            <div
              className="reveal stagger-item"
              data-reveal
              style={revealDelayStyle(140)}
            >
              <p className="body-copy pretty-text mt-6 max-w-[660px]">
                Clients get specialized results from protected Agents. Creators earn from their expertise without sharing the raw Harness behind it.
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
            <div className="lg:translate-x-0 xl:translate-x-2">
              <HeroAgentPreview />
            </div>
          </div>
        </div>
      </section>

      <ProtectedExecutionSection />
      <ClientUseSection />
      <CreatorIpSection />
      <MakeAgentSection />
      <LandingFooter />
    </main>
  );
}

function ProtectedExecutionSection() {
  const steps = [
    { label: "Client task", note: "Private input" },
    { label: "Secure runner", note: "HireMe gateway" },
    { label: "Private Harness", note: "Gateway-only run" },
    { label: "Client gets result", note: "Output + receipt" },
  ];

  return (
    <section className="relative overflow-hidden bg-[#1d1f5d] px-4 py-14 text-white md:px-8 md:py-20 lg:flex lg:min-h-[72svh] lg:items-center">
      <div className="relative z-10 mx-auto page-shell w-full">
        <div className="reveal max-w-2xl" data-reveal>
          <h2 className="max-w-none whitespace-nowrap text-[0.72rem] font-bold leading-[1.08] text-white sm:text-[1.35rem] md:text-[1.9rem] lg:text-[2.4rem] xl:text-[2.9rem]">
            Use expert Agents without exposing your task.
          </h2>
          <p className="mt-4 max-w-[42rem] text-[1rem] leading-[1.65] text-white/80 md:text-[1.05rem]">
            Your context goes through HireMe. The Agent works, but your raw input stays protected.
          </p>
        </div>

        <div className="relative mt-8 grid grid-cols-2 items-stretch gap-3 md:mt-10 md:grid-cols-4 md:gap-4 lg:gap-5">
          {steps.map((step, index) => (
            <div
              className="reveal stagger-item relative z-10 flex min-h-32 min-w-0 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center md:min-h-36 md:gap-4 md:rounded-[24px] md:p-5"
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

function ClientUseSection() {
  const steps = [
    {
      title: "Pick an expert Agent",
      copy: "Find the Agent with the right skill, sample result, and price.",
      icon: Search,
    },
    {
      title: "Run it from Codex or Claude",
      copy: "Send the task from the tools you already use while HireMe handles access.",
      icon: Terminal,
    },
    {
      title: "Receive the finished result",
      copy: "Get the output and receipt without touching the raw Harness.",
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="relative isolate -mt-px overflow-hidden bg-[#f7fbff] px-4 py-16 text-[#0d253d] md:px-8 md:py-20 lg:flex lg:min-h-[70svh] lg:items-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 12% 18%, rgba(49, 130, 246, 0.09), transparent 34%), radial-gradient(circle at 88% 72%, rgba(16, 185, 129, 0.07), transparent 38%), linear-gradient(180deg, #f7fbff 0%, #f3f9ff 100%)",
        }}
      />
      <div className="relative z-10 mx-auto grid page-shell w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12">
        <div className="reveal" data-reveal>
          <h2 className="section-title max-w-[680px] text-[#191f28]">
            How can you hire expert Agents?
          </h2>
          <p className="body-copy mt-5 max-w-[660px]">
            Pick the expert, run it from your workflow, and receive the finished result.
          </p>
        </div>

        <div className="grid gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                className="reveal stagger-item rounded-[22px] border border-[rgba(49,130,246,0.12)] bg-white/[0.78] p-5 shadow-[0_14px_34px_rgba(30,64,175,0.055)] backdrop-blur-sm"
                data-reveal
                key={step.title}
                style={revealDelayStyle(index * 90)}
              >
                <div className="flex gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(49,130,246,0.12)] bg-[#eaf5ff] text-[#0877ec]">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="docs-card-title text-[#191f28]">
                      {step.title}
                    </div>
                    <p className="mt-2 docs-card-copy">
                      {step.copy}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MakeAgentSection() {
  return (
    <section id="make-agent" className="relative isolate -mt-px overflow-hidden bg-[#f4fbf7] px-4 py-20 md:px-8 md:py-28 lg:flex lg:min-h-[100svh] lg:items-center lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 14% 24%, rgba(16, 185, 129, 0.11), transparent 34%), radial-gradient(circle at 88% 78%, rgba(49, 130, 246, 0.07), transparent 38%), linear-gradient(180deg, #fbfffd 0%, #f4fbf7 48%, #ecf9f2 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 -top-[180px] z-0 h-[320px] bg-gradient-to-b from-white via-[#fbfffd]/95 to-transparent blur-2xl"
      />
      <div className="relative z-10 mx-auto page-shell w-full">
        <div className="reveal" data-reveal>
          <h2 className="section-title text-[#191f28]">
            Create your first protected Agent in three steps.
          </h2>
          <p className="body-copy mt-5 max-w-[1120px] lg:whitespace-nowrap">
            Scaffold the template, add your private Harness, and publish it to HireMe.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {makeAgentSteps.map((step, index) => (
            <li
              className="reveal stagger-item rounded-[22px] border border-[rgba(16,185,129,0.12)] bg-white/[0.74] p-5 shadow-[0_12px_32px_rgba(16,107,76,0.045)] backdrop-blur-sm"
              data-reveal
              key={step.title}
              style={revealDelayStyle(120 + index * 80)}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[rgba(16,185,129,0.18)] bg-[rgba(236,253,245,0.82)] text-[11px] font-semibold text-[#047857] shadow-[0_8px_22px_rgba(16,107,76,0.06)]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="docs-card-title text-[#191f28]">
                  {step.title}
                </h3>
              </div>
              <p className="mt-2 docs-card-copy">
                {step.copy}
              </p>
            </li>
          ))}
        </ol>

        <div className="reveal mt-8 w-full" data-reveal style={revealDelayStyle(420)}>
          <details className="group overflow-hidden rounded-[22px] border border-[rgba(16,185,129,0.13)] bg-white/[0.74] shadow-[0_12px_32px_rgba(16,107,76,0.045)] backdrop-blur-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left marker:hidden">
              <span>
                <span className="block text-sm font-semibold text-[#191f28]">One-time Codex setup</span>
                <span className="mt-1 block text-xs leading-5 text-[#6b7684]">
                  Open this only when you want the creator template and MCP command.
                </span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-[#047857] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[rgba(16,185,129,0.1)] p-4">
              <CopyableCodeBlock
                code={codexCreatorSetupCommand}
                description="Installs the creator template plugin and connects Codex to the HireMe Render MCP server."
                label="Creator setup command"
              />
            </div>
          </details>
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
          <h2 className="section-title max-w-[760px] text-[#191f28]">
            Sell the Agent, not the Harness.
          </h2>
          <p className="body-copy mt-5 max-w-[680px]">
            <span className="block">Clients see the output.</span>
            <span className="block">They never see your prompts, examples, rubrics, or private workflow.</span>
          </p>
        </div>

        <div className="reveal stagger-item" data-reveal style={revealDelayStyle(140)}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <div className="rounded-[28px] border border-[rgba(49,130,246,0.12)] bg-white/[0.82] p-5 shadow-[0_18px_44px_rgba(30,64,175,0.065)] md:p-6">
              <div className="docs-card-title text-[#191f28]">
                Clients see
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
                Clients can't see
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

function marketplaceSourceLabel(source: AgentDataSource) {
  if (source === "supabase") return "Supabase live";
  return "Local demo data";
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
    useState<Agent[]>([]);
  const [accessSnapshot, setAccessSnapshot] =
    useState<AgentAccessRecord[]>(readAllAgentAccess);
  const [dataSource, setDataSource] = useState<{
    source: AgentDataSource;
    message?: string;
  }>({ source: "mock", message: "Loading marketplace..." });
  const [accessActionError, setAccessActionError] = useState<string | null>(null);
  const [accessActionKey, setAccessActionKey] = useState<string | null>(null);
  const [tryChat, setTryChat] = useState<{
    agent: Agent;
    access: AgentAccessRecord;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void loadMarketplaceAgents().then((result) => {
      if (!isCurrent) return;
      setMarketplaceAgents(result.agents);
      setDataSource({ source: result.source, message: result.message });
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const catalogAgents = marketplaceAgents;

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

  async function updateAgentAccess(
    agent: Agent,
    accessType: AgentAccessType,
  ): Promise<AgentAccessRecord | null> {
    if (!user) {
      onRequireLogin();
      return null;
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
      return record;
    } catch (error) {
      setAccessActionError(
        error instanceof Error ? error.message : "Agent access request failed.",
      );
      return null;
    } finally {
      setAccessActionKey(null);
    }
  }

  function accessFor(agent: Agent) {
    return accessRecords.find(
      (record) => record.agentId === agent.id && record.status === "active",
    );
  }

  async function handleTryAgent(agent: Agent) {
    if (!user) {
      onRequireLogin();
      return;
    }

    const existingAccess = accessFor(agent);
    if (existingAccess) {
      setTryChat({ agent, access: existingAccess });
      return;
    }

    const record = await updateAgentAccess(agent, "trial");
    if (record) {
      setTryChat({ agent, access: record });
    }
  }

  function handleTryChatAccessUpdated(record: AgentAccessRecord) {
    if (!user) return;

    const nextRecords = upsertAccessRecord(readUserAgentAccess(user), record);
    writeUserAgentAccess(user, nextRecords);
    setAccessSnapshot(readAllAgentAccess());
    setTryChat((current) =>
      current && current.agent.id === record.agentId
        ? { ...current, access: record }
        : current,
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
                  {marketplaceSourceLabel(dataSource.source)}
                </span>
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
                  onTry={() => void handleTryAgent(agent)}
                />
              ))}
            </div>
          ) : (
            <EmptyResult label="No agents match the current filters." />
          )}
        </div>
      </section>

      {tryChat && user ? (
        <TryAgentChatPanel
          access={tryChat.access}
          agent={tryChat.agent}
          key={`${tryChat.agent.id}:${tryChat.access.receiptObjectId}`}
          onAccessUpdated={handleTryChatAccessUpdated}
          onClose={() => setTryChat(null)}
          user={user}
        />
      ) : null}
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
    useState<Agent[]>([]);
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
  const [tryChatAccess, setTryChatAccess] =
    useState<AgentAccessRecord | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void loadMarketplaceAgents().then((result) => {
      if (!isCurrent) return;
      setMarketplaceAgents(result.agents);
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

  const catalogAgents = marketplaceAgents;

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

  async function updateAgentAccess(
    accessType: AgentAccessType,
  ): Promise<AgentAccessRecord | null> {
    if (!agent) return null;
    if (!user) {
      onRequireLogin();
      return null;
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
      return record;
    } catch (error) {
      setAccessActionError(
        error instanceof Error ? error.message : "Agent access request failed.",
      );
      return null;
    } finally {
      setAccessActionType(null);
    }
  }

  async function openTryChat() {
    if (!agent) return;
    if (!user) {
      onRequireLogin();
      return;
    }

    if (access) {
      setTryChatAccess(access);
      return;
    }

    const record = await updateAgentAccess("trial");
    if (record) {
      setTryChatAccess(record);
    }
  }

  function handleTryChatAccessUpdated(record: AgentAccessRecord) {
    if (!user) return;

    const nextRecords = upsertAccessRecord(readUserAgentAccess(user), record);
    writeUserAgentAccess(user, nextRecords);
    setAccessSnapshot(readAllAgentAccess());
    setTryChatAccess(record);
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
      setMarketplaceAgents(refreshedAgents.agents);
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
  const hasGatewayAccess = access?.source === "gateway";
  const tokenPrice = agent.pricePer1MTokensSui ?? agent.pricePerCallUsd;
  const averageTokens = totalAverageTokens(agent);
  const estimatedRunCost = (tokenPrice * averageTokens) / 1_000_000;
  const estimatedRunPrice = estimatedRunCost
    ? `${estimatedRunCost.toFixed(estimatedRunCost >= 0.1 ? 2 : 3)} SUI`
    : "Calculated at run time";
  const creatorInfoUrl = normalizeCreatorInfoUrl(agent.creatorInfoUrl);
  const howToUseCopy =
    agent.howToUse ||
    agent.resultPreview.summary ||
    "Send a clear task, include the desired output format, and add any constraints the Agent should follow.";
  const resultArtifacts = getResultArtifactExplorers(agent);

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
              {creatorInfoUrl ? (
                <a
                  className="mt-3 inline-flex text-sm font-semibold text-[#533afd] underline-offset-4 transition hover:underline"
                  href={creatorInfoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Creator information
                </a>
              ) : null}
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
                  <Button className="w-full" disabled={Boolean(accessActionType)} onClick={() => void openTryChat()} type="button" variant="secondary"><MessageCircle /> Try Agent</Button>
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
              <CardHeader>
                <CardTitle>How to use</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-xl border border-[#dedbea] bg-[#f8f7fb] p-4">
                  <div className="text-xs font-semibold uppercase text-[#6b6580]">
                    Usage guide
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#273951]">
                    {howToUseCopy}
                  </p>
                </div>
                <div className="grid gap-4">
                  <div className="rounded-xl border border-[#dedbea] bg-white p-4">
                    <div className="text-xs font-semibold uppercase text-[#6b6580]">
                      Sample Input
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#273951]">
                      {agent.resultPreview.sample}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#d8d4e2] bg-[#f3f1f8] p-4">
                    <div className="text-xs font-semibold uppercase text-[#6b6580]">
                      Result Image
                    </div>
                    {agent.resultPreview.mediaUrl ? (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[#d8d4e2] bg-white">
                        {agent.resultPreview.mediaType === "video" ? (
                          <video
                            className="aspect-video w-full bg-[#171452] object-contain"
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
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-[#273951]">
                        {agent.resultPreview.summary}
                      </p>
                    )}
                  </div>
                  {resultArtifacts.length ? (
                    <div className="rounded-xl border border-[#d8d4e2] bg-white p-4">
                      <div className="text-xs font-semibold uppercase text-[#6b6580]">
                        Additional Information
                      </div>
                      <div className="mt-3 grid gap-2">
                        {resultArtifacts.map((artifact) => (
                          <div
                            className="flex min-w-0 items-center gap-3 rounded-lg border border-[#d8d4e2] bg-[#f8f7fb] px-3 py-2.5"
                            key={artifact.label}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold uppercase text-[#6b6580]">
                                {artifact.label}
                              </div>
                              <div
                                className="mt-1 truncate font-mono text-xs text-[#1c1e54]"
                                title={artifact.value}
                              >
                                {artifact.value}
                              </div>
                            </div>
                            <a
                              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d8d4e2] bg-white px-3 py-1.5 text-xs font-semibold text-[#533afd] transition hover:border-[#bcb2ff] hover:bg-[#f2efff]"
                              href={artifact.href}
                              rel="noreferrer"
                              target="_blank"
                            >
                              viewMore
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
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
            <Card className="border-[#d8d4e2] bg-[#fbfaff]">
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Estimated from this Agent’s average usage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="number-cell text-2xl font-semibold text-[#171452]">
                  From {estimatedRunPrice} / run
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Actual cost varies with input and output length. Token rate:{" "}
                  {formatAgentPrice(tokenPrice)}.
                </p>
                <div className="mt-5 grid gap-2">
                  <Button
                    className="w-full"
                    disabled={Boolean(accessActionType) || (hasGatewayAccess && isHired)}
                    onClick={() => void updateAgentAccess("hired")}
                    type="button"
                  >
                    <PackageOpen /> Hire Agent
                  </Button>
                  <Button
                    className="w-full"
                    disabled={Boolean(accessActionType)}
                    onClick={() => void openTryChat()}
                    type="button"
                    variant="secondary"
                  >
                    <MessageCircle /> Try Agent
                  </Button>
                </div>
                <div className="mt-6 border-t border-[#dedbea] pt-5">
                  <div className="text-sm font-semibold text-[#171452]">
                    Performance & usage
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm">
                    {[
                      ["Average time", formatDuration(agent.latencyMs)],
                      ["Average usage", formatTokens(averageTokens)],
                      ["Last updated", "Current release"],
                      ["Version", "v1.0"],
                      ["Completed runs", formatRuns(agent.calls)],
                      ["Rating", agent.rating ? `${agent.rating.toFixed(1)} / 5` : "New"],
                    ].map(([label, value]) => (
                      <div
                        className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"
                        key={label}
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="number-cell font-medium text-[#171452]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
      {tryChatAccess && user ? (
        <TryAgentChatPanel
          access={tryChatAccess}
          agent={agent}
          key={`${agent.id}:${tryChatAccess.receiptObjectId}`}
          onAccessUpdated={handleTryChatAccessUpdated}
          onClose={() => setTryChatAccess(null)}
          user={user}
        />
      ) : null}
    </main>
  );
}

function EditAgentPage({ user }: { user: AuthUser | null }) {
  const { agentId = "" } = useParams();
  const [marketplaceAgents, setMarketplaceAgents] = useState<Agent[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const createdRecords = useMemo(
    () => (user ? readUserCreatedAgents(user) : []),
    [user],
  );

  useEffect(() => {
    let isCurrent = true;
    void loadMarketplaceAgents()
      .then((result) => {
        if (!isCurrent) return;
        setMarketplaceAgents(result.agents);
      })
      .finally(() => {
        if (isCurrent) setCatalogLoaded(true);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f6f9fc] px-4 py-16 md:px-8">
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-6 app-shadow">
          <h1 className="text-3xl font-light text-[#1c1e54]">Edit Agent</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Login to edit your registered Agents.
          </p>
          <Button asChild className="mt-5" type="button">
            <Link to="/login">
              <LogIn /> Login
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  const localRecord = createdRecords.find(
    (record) => record.agentSlug === agentId || record.id === agentId,
  );
  const localAgent = localRecord
    ? createdAgentRecordToAgent(localRecord, user)
    : null;
  const marketplaceAgent = marketplaceAgents.find(
    (agent) => agent.id === agentId && isAgentEditableByUser(agent, user),
  );
  const agent = localAgent || marketplaceAgent || null;

  if (!agent && !catalogLoaded) {
    return <EmptyResult label="Loading Agent..." />;
  }

  if (!agent) {
    return (
      <main className="min-h-screen bg-[#f6f9fc] px-4 py-16 md:px-8">
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-6 app-shadow">
          <h1 className="text-3xl font-light text-[#1c1e54]">Agent not found</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This Agent is not in your registered Agents list.
          </p>
          <Button asChild className="mt-5" type="button" variant="secondary">
            <Link to="/my">
              <ArrowLeft /> Back to My Agents
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <CreateAgentPage
      editingAgent={agent}
      editingRecord={localRecord}
      initialDraft={agentDraftFromAgent(agent)}
      key={agent.id}
      mode="edit"
      user={user}
    />
  );
}

function isAgentEditableByUser(agent: Agent, user: AuthUser) {
  const keys = creatorKeysForUser(user);
  return [agent.creator, agent.team.owner, agent.handle, agent.id].some((value) =>
    keys.has(value.trim().toLowerCase()),
  );
}

function creatorKeysForUser(user: AuthUser) {
  return new Set(
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
    useState<Agent[]>([]);
  const [accessRecords, setAccessRecords] = useState<AgentAccessRecord[]>([]);
  const [memWalResults, setMemWalResults] = useState<GatewayMemWalResultPayload[]>([]);
  const [paymentActivities, setPaymentActivities] = useState<
    GatewaySuiPaymentActivityPayload[]
  >([]);
  const [walletSummary, setWalletSummary] =
    useState<GatewayWalletSummaryPayload | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [memWalError, setMemWalError] = useState<string | null>(null);
  const [paymentActivityError, setPaymentActivityError] = useState<string | null>(
    null,
  );
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletAction, setWalletAction] = useState<"top-up" | "claim" | null>(null);
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
      setMarketplaceAgents(result.agents);
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
    let isCurrent = true;
    if (!user) return () => {
      isCurrent = false;
    };

    void loadGatewayWalletSummary(user)
      .then((summary) => {
        if (!isCurrent) return;
        setWalletError(null);
        setWalletSummary(summary);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setWalletError(
          error instanceof Error
            ? error.message
            : "Gateway wallet summary request failed",
        );
        setWalletSummary(null);
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

  async function handleWalletTopUp() {
    if (!user) return;
    setWalletAction("top-up");
    try {
      const summary = await topUpGatewayWallet(user, "1");
      setWalletSummary(summary);
      setWalletError(null);
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : "Wallet top-up failed",
      );
    } finally {
      setWalletAction(null);
    }
  }

  async function handleWalletClaim() {
    if (!user) return;
    setWalletAction("claim");
    try {
      const summary = await claimGatewayWalletEarnings(user);
      setWalletSummary(summary);
      setWalletError(null);
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : "Wallet claim failed",
      );
    } finally {
      setWalletAction(null);
    }
  }

  const hirerId = hirerIdFor(user);
  const activeRecords = accessRecords.filter(
    (record) => record.status === "active",
  );
  const hiredRecords = activeRecords.filter(
    (record) => record.accessType === "hired",
  );

  function resolveAgent(record: AgentAccessRecord) {
    return marketplaceAgents.find((agent) => agent.id === record.agentId);
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
  const walletStatsByAgentId = new Map<string, GatewayWalletAgentStatPayload>();
  for (const stat of walletSummary?.agents || []) {
    walletStatsByAgentId.set(stat.agentId, stat);
    if (stat.agentUuid) walletStatsByAgentId.set(stat.agentUuid, stat);
  }
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
          {walletError ? (
            <div className="mb-4 rounded-xl border border-[#f59e0b]/20 bg-[#fffaf0] p-4 text-sm leading-6 text-[#92400e]">
              Gateway wallet summary failed. Balance may omit recent spend or
              creator earnings.
              <div className="mt-1 font-mono text-xs">{walletError}</div>
            </div>
          ) : null}

          <WalletOverviewPanel
            action={walletAction}
            onClaim={() => void handleWalletClaim()}
            onTopUp={() => void handleWalletTopUp()}
            summary={walletSummary}
          />

          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
                  <RegisteredAgentCard
                    agent={createdAgentRecordToAgent(record, user)}
                    key={record.id}
                    walletStat={
                      walletStatsByAgentId.get(record.agentSlug) ||
                      walletStatsByAgentId.get(record.id)
                    }
                  />
                ))}
                {registeredMarketplaceAgents.map((agent) => (
                  <RegisteredAgentCard
                    agent={agent}
                    key={agent.id}
                    walletStat={walletStatsByAgentId.get(agent.id)}
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
                      walletStat={walletStatsByAgentId.get(agent.id)}
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

function WalletOverviewPanel({
  action,
  onClaim,
  onTopUp,
  summary,
}: {
  action: "top-up" | "claim" | null;
  onClaim: () => void;
  onTopUp: () => void;
  summary: GatewayWalletSummaryPayload | null;
}) {
  const balance = summary?.balance;
  const claimable = readSuiNumber(balance?.claimableEarningsSui);
  const sourceLabel =
    summary?.source === "ledger_only"
      ? "Ledger only"
      : summary?.source === "account_wallet_events"
        ? "Wallet ledger"
        : "Syncing";

  return (
    <section className="rounded-xl border border-border bg-white p-5 app-shadow">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
            <WalletCards className="size-4 text-primary" />
            Available balance
          </div>
          <div className="number-cell mt-2 text-4xl font-light leading-tight text-[#1c1e54] md:text-5xl">
            {formatSuiBalance(balance?.availableSui)}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Hired Agent calls spend from this balance. Creator earnings add to it
            as your Agents complete work.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
          <WalletMiniMetric
            label="Earned"
            value={formatSuiBalance(balance?.earnedSui)}
          />
          <WalletMiniMetric
            label="Spent"
            value={formatSuiBalance(balance?.spentSui)}
          />
          <WalletMiniMetric
            label="Claimable"
            value={formatSuiBalance(balance?.claimableEarningsSui)}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-5 text-muted-foreground">
          {sourceLabel} · Top-ups {formatSuiBalance(balance?.topUpSui)} ·
          Claimed {formatSuiBalance(balance?.claimedSui)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={Boolean(action)}
            onClick={onTopUp}
            size="sm"
            type="button"
            variant="secondary"
          >
            <ArrowUp /> {action === "top-up" ? "Charging..." : "Charge 1 SUI"}
          </Button>
          <Button
            disabled={Boolean(action) || claimable <= 0}
            onClick={onClaim}
            size="sm"
            type="button"
          >
            <CircleDollarSign /> {action === "claim" ? "Claiming..." : "Claim"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function WalletMiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary px-3 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="number-cell mt-1 text-lg font-medium text-[#1c1e54]">
        {value}
      </div>
    </div>
  );
}

function AgentMoneySummary({
  className = "",
  mode,
  stat,
}: {
  className?: string;
  mode: "creator" | "hirer";
  stat?: GatewayWalletAgentStatPayload;
}) {
  const items =
    mode === "creator"
      ? [
          ["Agent total", formatSuiBalance(stat?.totalEarnedSui)],
          ["My earnings", formatSuiBalance(stat?.myEarnedSui)],
          ["Claimable", formatSuiBalance(stat?.claimableSui)],
        ]
      : [
          ["Spent by me", formatSuiBalance(stat?.mySpentSui)],
          ["Paid runs", (stat?.spentCallCount || 0).toString()],
          [
            "Last charge",
            stat?.lastChargedAt ? formatAccessDate(stat.lastChargedAt) : "No calls",
          ],
        ];

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${className}`}>
      {items.map(([label, value]) => (
        <div
          className="rounded-lg border border-border bg-[#f8fafc] px-3 py-3"
          key={label}
        >
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="number-cell mt-1 text-sm font-semibold text-[#1c1e54]">
            {value}
          </div>
        </div>
      ))}
    </div>
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

function RegisteredAgentCard({
  agent,
  walletStat,
}: {
  agent: Agent;
  walletStat?: GatewayWalletAgentStatPayload;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const editPath = `/agents/${agent.id}/edit`;

  return (
    <Card
      aria-label={`Edit ${agent.name}`}
      className="interactive-card clickable-card self-start cursor-pointer transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f82e8]/35 focus-visible:ring-offset-2"
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button, a, input, textarea, select, [role='button']")
        ) {
          return;
        }
        navigate(editPath);
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          navigate(editPath);
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
                <span className="number-cell inline-flex items-center gap-1 text-xs font-medium text-[#494556]">
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
          <span className="rounded-full border border-[#d8d4e2] bg-[#f3f1f8] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#494556]">
            {agent.category}
          </span>
          <span>{formatRuns(agent.calls)} runs</span>
        </div>

        <p className="mt-3 truncate text-sm leading-5 text-[#273951]">
          {agent.headline}
        </p>

        <div className="mt-3 border-t border-border pt-3">
          <div className="number-cell text-sm font-semibold text-[#0d253d]">
            {formatAgentPriceShort(agent.pricePer1MTokensSui ?? agent.pricePerCallUsd)}
            <span className="text-[11px] font-normal text-muted-foreground">
              {" "}
              / 1M tokens
            </span>
          </div>
        </div>
        <AgentMoneySummary
          className="mt-3"
          mode="creator"
          stat={walletStat}
        />

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Button
            className="w-full"
            onClick={(event) => {
              event.stopPropagation();
              navigate(editPath);
            }}
            size="sm"
            type="button"
          >
            <Braces /> Edit Agent
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
            <p className="mt-2 text-sm leading-5 text-[#273951]">{agent.publicSummary}</p>
            <dl className="mt-4 grid gap-2 border-t border-[#d8d4e2] pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Completed runs</dt>
                <dd className="number-cell font-medium text-[#171452]">
                  {formatRuns(agent.calls)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Average time</dt>
                <dd className="number-cell font-medium text-[#171452]">
                  {formatDuration(agent.latencyMs)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="number-cell font-medium text-[#171452]">
                  {formatAgentPrice(agent.pricePer1MTokensSui ?? agent.pricePerCallUsd)}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MyAgentAccessCard({
  agent,
  hirerId,
  record,
  walletStat,
}: {
  agent: Agent;
  hirerId: string;
  record: AgentAccessRecord;
  walletStat?: GatewayWalletAgentStatPayload;
}) {
  const callSnippet = `hireme_call_agent_stream({\n  "agent_id": "${agent.id}",\n  "task": "<your task>",\n  "hirer_id": "${hirerId}",\n  "hire_receipt_object_id": "${record.receiptObjectId}",\n  "wait_for_memory": false\n})`;

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
        <AgentMoneySummary
          className="mt-3"
          mode="hirer"
          stat={walletStat}
        />

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

function TryAgentChatPanel({
  access,
  agent,
  onAccessUpdated,
  onClose,
  user,
}: {
  access: AgentAccessRecord;
  agent: Agent;
  onAccessUpdated: (record: AgentAccessRecord) => void;
  onClose: () => void;
  user: AuthUser;
}) {
  const transcriptKey = tryChatTranscriptKey(access, agent, user);
  const restoredTranscript = readTryChatTranscript(transcriptKey);
  const [input, setInput] = useState("");
  const [isCommandCopied, setIsCommandCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmPendingSend, setConfirmPendingSend] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [conversationContext, setConversationContext] =
    useState<TryConversationContext | null>(
      () => restoredTranscript?.conversationContext || null,
    );
  const [messages, setMessages] = useState<TryChatMessage[]>(
    () => restoredTranscript?.messages || initialTryChatMessages(agent),
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isMountedRef = useRef(true);
  const activeMemoryPollsRef = useRef(new Set<string>());
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const callSnippet = buildTryCodexSnippet({
    access,
    agent,
    conversation: conversationContext,
    user,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [messages]);

  useEffect(() => {
    writeTryChatTranscript(transcriptKey, {
      conversationContext,
      messages,
      updatedAt: new Date().toISOString(),
    });
  }, [conversationContext, messages, transcriptKey]);

  useEffect(() => {
    if (!conversationContext) return;
    if (tryMemWalDisplayStatus(conversationContext) !== "pending") {
      setConfirmPendingSend(false);
      setSendNotice(null);
    }
  }, [conversationContext]);

  async function pollTryMemWalStatus({
    conversationId,
    memoryJobId,
    messageId,
  }: {
    conversationId: string;
    memoryJobId: string;
    messageId: string;
  }) {
    if (activeMemoryPollsRef.current.has(memoryJobId)) return;
    activeMemoryPollsRef.current.add(memoryJobId);
    const markMemoryPollFailed = () => {
      setConversationContext((current) =>
        current?.memoryJobId === memoryJobId
          ? {
              ...current,
              conversationStored: false,
              mcpConversationStatus: "failed",
              memWalStatus: "failed",
            }
          : current,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId || message.memWalStatus === "pending"
            ? { ...message, memWalStatus: "failed" }
            : message,
        ),
      );
    };

    try {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await wait(Math.min(5000, 1500 + attempt * 500));
        if (!isMountedRef.current) return;

        try {
          const result = await loadTryMemoryStatus(memoryJobId);
          const nextConversationContext = buildTryConversationContext({
            agentId: agent.id,
            call: result,
            conversationId,
          });
          const nextStatus = tryMemWalDisplayStatus(nextConversationContext);
          setConversationContext(nextConversationContext);
          if (nextStatus) {
            setMessages((current) =>
              current.map((message) => {
                if (message.id === messageId) {
                  return {
                    ...message,
                    memWalBlobId: nextConversationContext.memWalBlobId,
                    memWalStatus: nextStatus,
                  };
                }
                if (nextStatus === "stored" && message.memWalStatus === "pending") {
                  return {
                    ...message,
                    memWalBlobId: nextConversationContext.memWalBlobId,
                    memWalStatus: "stored",
                  };
                }
                if (nextStatus === "failed" && message.memWalStatus === "pending") {
                  return { ...message, memWalStatus: "failed" };
                }
                return message;
              }),
            );
          }
          if (
            nextStatus === "stored" ||
            nextStatus === "failed" ||
            result.status === "failed"
          ) {
            return;
          }
        } catch {
          markMemoryPollFailed();
          return;
        }
      }
      markMemoryPollFailed();
    } finally {
      activeMemoryPollsRef.current.delete(memoryJobId);
    }
  }

  useEffect(() => {
    if (!conversationContext?.memoryJobId) return;
    if (tryMemWalDisplayStatus(conversationContext) !== "pending") return;

    const messageId = latestAssistantMessageId(messages);
    if (!messageId) return;

    void pollTryMemWalStatus({
      conversationId: conversationContext.conversationId,
      memoryJobId: conversationContext.memoryJobId,
      messageId,
    });
  }, [
    conversationContext?.conversationId,
    conversationContext?.conversationStored,
    conversationContext?.memoryJobId,
    conversationContext?.memWalStatus,
    conversationContext?.mcpConversationStatus,
    conversationContext?.userMemWalStatus,
    messages,
  ]);

  async function handleCopyCallSnippet() {
    await copyTextToClipboard(callSnippet);
    if (!isMountedRef.current) return;
    setIsCommandCopied(true);
    window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsCommandCopied(false);
    }, 1500);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = input.trim();
    if (!task || isSending) return;

    const currentMemWalStatus = conversationContext
      ? tryMemWalDisplayStatus(conversationContext)
      : null;
    if (currentMemWalStatus === "pending" && !confirmPendingSend) {
      setConfirmPendingSend(true);
      setSendNotice(
        "The previous chat has not been saved to memWal yet. Send anyway?",
      );
      return;
    }

    setConfirmPendingSend(false);
    setSendNotice(null);

    const userMessage: TryChatMessage = {
      id: `user-${Date.now().toString(36)}`,
      role: "user",
      text: task,
      createdAt: new Date().toISOString(),
    };
    const pendingId = `assistant-${Date.now().toString(36)}`;
    const pendingMessage: TryChatMessage = {
      id: pendingId,
      role: "assistant",
      text: "Running protected Agent...",
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((current) => [...current, userMessage, pendingMessage]);
    setInput("");
    setIsSending(true);

    try {
      const conversationId =
        conversationContext &&
        tryMemWalDisplayStatus(conversationContext) === "stored"
          ? conversationContext.conversationId
          : tryConversationId(access, agent, user);
      const updatePendingMessage = (patch: Partial<TryChatMessage>) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId ? { ...message, ...patch } : message,
          ),
        );
      };
      const applyStreamCall = (
        call: GatewayAgentCallResponse,
        options: { showText?: boolean } = {},
      ) => {
        const nextConversationContext = buildTryConversationContext({
          agentId: agent.id,
          call,
          conversationId,
        });
        const memWalStatus = tryMemWalDisplayStatus(nextConversationContext);
        setConversationContext(nextConversationContext);
        updatePendingMessage({
          ...(options.showText
            ? {
                attachments: extractTryImageAttachments(call),
                pending: false,
                responseMode:
                  call.responseMode || call.jsonOutput?.responseMode || null,
                text: extractAgentCallText(call),
              }
            : {}),
          memWalBlobId: nextConversationContext.memWalBlobId,
          memWalStatus,
        });
        return { memWalStatus, nextConversationContext };
      };

      const result = await callTryAgent({
        access,
        agent,
        conversationId,
        onEvent: (streamEvent) => {
          if (streamEvent.event === "authorized") {
            updatePendingMessage({ text: "Authorizing protected Agent..." });
            return;
          }
          if (streamEvent.event === "artifact_loaded") {
            updatePendingMessage({ text: "Loading protected Harness..." });
            return;
          }
          if (
            streamEvent.event === "output_fast" ||
            streamEvent.event === "result"
          ) {
            applyStreamCall(streamEvent.data, { showText: true });
            return;
          }
          if (streamEvent.event === "memwal_pending") {
            applyStreamCall(
              {
                conversationId: streamEvent.data.conversationId || conversationId,
                memory: {
                  conversationStored: Boolean(streamEvent.data.conversationId)
                    ? false
                    : null,
                  jobId: streamEvent.data.memoryJobId ?? undefined,
                  status: "pending",
                  waitForMemory: false,
                },
                memoryJobId: streamEvent.data.memoryJobId || null,
                userMemWal: {
                  jobId: streamEvent.data.memoryJobId ?? undefined,
                  status: "pending",
                  stored: false,
                },
              },
              { showText: false },
            );
            return;
          }
          if (streamEvent.event === "memwal_stored") {
            applyStreamCall(
              {
                conversationId:
                  streamEvent.data.mcpConversation?.conversationId ||
                  streamEvent.data.conversationId ||
                  conversationId,
                mcpConversation: streamEvent.data.mcpConversation,
                memory: {
                  conversationStored:
                    streamEvent.data.mcpConversation?.stored ?? true,
                  status: "stored",
                  waitForMemory: false,
                },
                userMemWal: streamEvent.data.userMemWal,
              },
              { showText: false },
            );
          }
        },
        task,
        user,
      });
      const nextConversationContext = buildTryConversationContext({
        agentId: agent.id,
        call: result,
        conversationId,
      });
      const memWalStatus = tryMemWalDisplayStatus(nextConversationContext);
      setConversationContext(nextConversationContext);
      let nextAccess = markAccessRecordUsed(access);
      if (typeof result.authorization?.trialCallsRemaining === "number") {
        nextAccess = {
          ...nextAccess,
          trialCallsRemaining: result.authorization.trialCallsRemaining,
        };
      }
      onAccessUpdated(nextAccess);
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                attachments: extractTryImageAttachments(result),
                memWalBlobId: nextConversationContext.memWalBlobId,
                memWalStatus,
                text: extractAgentCallText(result),
                pending: false,
                responseMode: result.responseMode || result.jsonOutput?.responseMode || null,
              }
            : message,
        ),
      );
      if (memWalStatus === "pending" && nextConversationContext.memoryJobId) {
        void pollTryMemWalStatus({
          conversationId: nextConversationContext.conversationId,
          memoryJobId: nextConversationContext.memoryJobId,
          messageId: pendingId,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Protected Agent call failed.";
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                text:
                  access.source === "local"
                    ? `This Try access is saved locally, but the protected gateway is not reachable yet. Start the gateway or use the Codex MCP setup, then try again.\n\n${message}`
                    : message,
                pending: false,
                error: true,
              }
            : item,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f172a]/28 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Try ${agent.name}`}>
      <div className="absolute inset-x-0 bottom-0 max-h-[92svh] overflow-hidden rounded-t-lg border border-[#dbeafe] bg-white shadow-[0_-18px_50px_rgba(15,52,96,0.18)] md:inset-y-4 md:right-4 md:left-auto md:flex md:w-[460px] md:max-w-[calc(100vw-2rem)] md:flex-col md:rounded-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              <MessageCircle className="size-3.5" />
              Try Agent
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold leading-tight text-[#191f28]">
              {agent.name}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {access.accessType === "trial"
                ? `${access.trialCallsRemaining ?? 0} trial calls left`
                : "Hired access active"}
              {" "}· {access.source === "gateway" ? "Gateway" : "Local preview"}
            </p>
          </div>
          <button
            aria-label="Close Try chat"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-white text-[#4e5968] transition hover:bg-secondary"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex max-h-[calc(92svh-86px)] min-h-0 flex-col md:flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" ref={transcriptRef}>
            <div className="grid gap-3">
              {messages.map((message) => (
                <div
                  className={`max-w-[92%] rounded-lg border px-3 py-2.5 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-auto border-primary/20 bg-primary text-white"
                      : message.error
                        ? "border-[#ea2261]/25 bg-[#fff8fb] text-[#9f1239]"
                        : message.pending
                          ? "try-agent-pending-bubble border-[#b8d5f6] bg-[#f8fbff] text-[#273951]"
                          : "border-border bg-[#f8fafc] text-[#273951]"
                  }`}
                  key={message.id}
                >
                  <TryChatMessageContent message={message} />
                  {message.attachments?.length ? (
                    <div className="mt-3 grid gap-2">
                      {message.attachments.map((attachment) => (
                        <a
                          className="block overflow-hidden rounded-lg border border-border bg-white"
                          href={attachment.url}
                          key={attachment.id}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <img
                            alt={attachment.label}
                            className="max-h-72 w-full object-contain"
                            src={attachment.url}
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {message.responseMode || message.memWalStatus ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] opacity-75">
                      {message.responseMode ? <span>{message.responseMode}</span> : null}
                      {message.memWalStatus ? (
                        <TryMemWalMessageStatus
                          blobId={message.memWalBlobId}
                          status={message.memWalStatus}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border bg-white px-4 py-4">
            <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
              <textarea
                className="min-h-24 resize-none rounded-lg border border-input bg-white px-3 py-2 text-sm leading-6 text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => {
                  setInput(event.target.value);
                  setConfirmPendingSend(false);
                  setSendNotice(null);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask this Agent a small test task..."
                ref={inputRef}
                value={input}
              />
              {sendNotice ? (
                <div className="flex flex-col gap-2 rounded-md border border-[#f4c7d5] bg-[#fff8fb] px-3 py-2 text-xs leading-5 text-[#9f1239] sm:flex-row sm:items-center sm:justify-between">
                  <span>{sendNotice}</span>
                  {confirmPendingSend ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        className="rounded-md border border-[#f4c7d5] bg-white px-2.5 py-1 font-semibold text-[#9f1239] transition hover:bg-[#fff1f6]"
                        onClick={() => {
                          setConfirmPendingSend(false);
                          setSendNotice(null);
                        }}
                        type="button"
                      >
                        Wait
                      </button>
                      <button
                        className="rounded-md bg-[#9f1239] px-2.5 py-1 font-semibold text-white transition hover:bg-[#881337]"
                        type="submit"
                      >
                        Send anyway
                      </button>
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-primary [&::-webkit-details-marker]:hidden">
                    Run in Codex
                  </summary>
                  <div className="relative mt-2 rounded-md border border-border bg-secondary">
                    <code className="block whitespace-pre-wrap break-all py-2 pl-2 pr-10 text-[11px] leading-5 text-[#1c1e54]">
                      {callSnippet}
                    </code>
                    <button
                      aria-label="Copy Run in Codex prompt"
                      className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md border border-border bg-white text-[#273951] shadow-sm transition hover:bg-[#f8fafc]"
                      onClick={() => void handleCopyCallSnippet()}
                      title={
                        isCommandCopied
                          ? "Copied"
                          : "Copy Run in Codex prompt"
                      }
                      type="button"
                    >
                      {isCommandCopied ? (
                        <CheckCircle2 className="size-3.5 text-[#168a58]" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </details>
                <Button disabled={!input.trim() || isSending} type="submit">
                  <MessageCircle />
                  {isSending ? "Running" : "Send"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function TryMemWalMessageStatus({
  blobId,
  status,
}: {
  blobId?: string | null;
  status: TryMemWalDisplayStatus;
}) {
  if (status === "stored") {
    const explorerUrl = walrusExplorerBlobUrl(blobId);
    if (explorerUrl) {
      return (
        <a
          className="inline-flex items-center gap-1 text-[#168a58] transition hover:text-[#0f6f47]"
          href={explorerUrl}
          rel="noreferrer"
          target="_blank"
          title={`Open Walrus blob ${blobId}`}
        >
          <CheckCircle2 className="size-3.5" />
          memWal
          <ExternalLink className="size-3" />
        </a>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[#168a58]" title="memWal saved">
        <CheckCircle2 className="size-3.5" />
        memWal
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[#b45309]" title="memWal save failed">
        <AlertTriangle className="size-3.5" />
        memWal failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[#6b7280]" title="memWal saving">
      <LoaderCircle className="size-3.5 animate-spin" />
      memWal
    </span>
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
                <span className="number-cell inline-flex items-center gap-1 text-xs font-medium text-[#494556]" title="Based on Client feedback and completed runs.">
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
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation();
              onTry();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <MessageCircle /> Try
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

function formatSuiBalance(value: string | number | null | undefined) {
  const amount = readSuiNumber(value);
  const displayPrice =
    amount >= 1
      ? amount.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
      : amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
  return `${displayPrice} SUI`;
}

function readSuiNumber(value: string | number | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function normalizeCreatorInfoUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function getResultArtifactExplorers(agent: Agent) {
  const network = agent.sealedHarness.network;
  const explorerNetwork = network === "walrus-mainnet" ? "mainnet" : "testnet";
  const artifacts: Array<{ label: string; value: string; href: string }> = [];
  const walrusBlobId = agent.sealedHarness.walrusBlobId?.trim();
  if (walrusBlobId && isExplorerReadyWalrusBlobId(walrusBlobId)) {
    artifacts.push({
      label: "Walrus blob ID",
      value: walrusBlobId,
      href: `https://walruscan.com/${explorerNetwork}/blob/${encodeURIComponent(
        walrusBlobId,
      )}`,
    });
  }

  const suiObjectId = agent.sealedHarness.suiObjectId?.trim();
  if (suiObjectId && isSuiObjectId(suiObjectId)) {
    artifacts.push({
      label: "Sui object ID",
      value: suiObjectId,
      href: `https://suiexplorer.com/object/${encodeURIComponent(
        suiObjectId,
      )}?network=${explorerNetwork}`,
    });
  }

  return artifacts;
}

function isExplorerReadyWalrusBlobId(value: string) {
  return (
    value.length > 8 &&
    !value.startsWith("gateway-managed:") &&
    !value.startsWith("local_walrus_") &&
    !/\s/.test(value)
  );
}

function isSuiObjectId(value: string) {
  return /^0x[0-9a-f]{64}$/i.test(value);
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
  if (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    ["jpg", "jpeg", "png"].includes(extension)
  ) {
    return "image";
  }
  if (
    file.type.startsWith("video/") ||
    ["mp4", "webm", "mov"].includes(extension)
  ) {
    return "video";
  }
  throw new Error("Result media must be a JPG, PNG, or video file.");
}

function safeUploadFileName(file: File) {
  const fallbackExtension = file.type.startsWith("video/")
    ? "mp4"
    : file.type === "image/png"
      ? "png"
      : "jpg";
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


function CreateAgentPage({
  editingAgent,
  editingRecord,
  initialDraft,
  mode = "create",
  user,
}: {
  editingAgent?: Agent;
  editingRecord?: CreatedAgentRecord;
  initialDraft?: AgentDraft;
  mode?: "create" | "edit";
  user: AuthUser | null;
}) {
  const navigate = useNavigate();
  const isEditMode = mode === "edit";
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
      description: "Base price plus creator fee.",
    },
    {
      label: "Protection",
      id: "protection",
      description: "Upload the private Harness.",
    },
    {
      label: "How to use",
      id: "how-to-use",
      description: "Usage guide and sample input.",
    },
    {
      label: "Publish",
      id: "publish",
      description: "Confirm and publish.",
    },
  ] as const;
  const [draft, setDraft] = useState<AgentDraft>(() => ({
    ...defaultAgentDraft(),
    ...(initialDraft || {}),
  }));
  const [agentFiles, setAgentFiles] = useState<File[]>([]);
  const [typicalOutputMedia, setTypicalOutputMedia] = useState<File | null>(null);
  const [typicalOutputMediaPreviewUrl, setTypicalOutputMediaPreviewUrl] =
    useState<string | null>(null);
  const [uploadedTypicalOutputMedia, setUploadedTypicalOutputMedia] = useState<{
    path: string;
    type: "image" | "video";
    url: string;
  } | null>(() =>
    editingAgent?.resultPreview.mediaUrl
      ? {
          path: editingRecord?.typicalOutputMediaPath || "",
          type: editingAgent.resultPreview.mediaType || "image",
          url: editingAgent.resultPreview.mediaUrl,
        }
      : null,
  );
  const [sealedRecord, setSealedRecord] = useState<SealedHarnessRecord>();
  const [isSealing, setIsSealing] = useState(false);
  const [publishProgressIndex, setPublishProgressIndex] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const selectedCategoryPricing = draft.category
    ? categoryPricing[draft.category]
    : null;
  const basePriceUsd = selectedCategoryPricing?.basePriceUsd ?? 0;
  const creatorFeeUsd = Math.max(
    0,
    Number.parseFloat(draft.creatorFeeUsd) || 0,
  );
  const totalPricePerCallUsd = basePriceUsd + creatorFeeUsd;
  const agentSlug =
    isEditMode && editingAgent
      ? editingAgent.id
      : slugifyAgentName(draft.agentName) || "new-agent";
  const publicCapability =
    editingAgent?.publicContract || `${agentSlug}(task, context, budget_calls)`;
  const memWalScope = `agent:${agentSlug}`;
  const currentTypicalOutputMediaUrl =
    typicalOutputMediaPreviewUrl || uploadedTypicalOutputMedia?.url || "";
  const currentTypicalOutputMediaType = typicalOutputMedia
    ? typicalOutputMedia.type.startsWith("video/")
      ? "video"
      : "image"
    : uploadedTypicalOutputMedia?.type;
  const priceSummaryLabel = draft.category
    ? formatAgentPrice(totalPricePerCallUsd)
    : "Select a category";
  const publishProgressPercent =
    publishProgressIndex === null
      ? 0
      : Math.round(
          ((publishProgressIndex + 1) / publishProgressSteps.length) * 100,
        );
  const publishProgressLabel =
    publishProgressIndex === null
      ? ""
      : publishProgressSteps[publishProgressIndex];

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

  const maxAccessibleStep = activeStep;
  const canAccessStep = (index: number) => index <= maxAccessibleStep;

  const validateStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: {
        if (!draft.category) return "Select a category before continuing.";
        if (!draft.agentName.trim()) return "Add an agent name before continuing.";
        if (!draft.headline.trim()) return "Add a one-line description before continuing.";
        if (!draft.description.trim()) return "Add a description before continuing.";
        if (draft.creatorInfoUrl.trim() && !normalizeCreatorInfoUrl(draft.creatorInfoUrl)) {
          return "Add a valid creator info link or leave it empty.";
        }
        return null;
      }
      case 1: {
        if (!draft.category) {
          return "Select a category before pricing.";
        }
        if (Number.isNaN(creatorFeeUsd) || creatorFeeUsd < 0) {
          return "Set a valid creator fee before continuing.";
        }
        return null;
      }
      case 2: {
        if (!isEditMode && !agentFiles[0]) {
          return "Upload the private Harness before continuing.";
        }
        return null;
      }
      case 3: {
        if (!draft.howToUse.trim()) return "Describe how Clients should use this Agent.";
        if (!draft.sampleInput.trim()) return "Add a sample input.";
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
    setPublishProgressIndex(0);
    try {
      const harnessFile = agentFiles[0];
      if (isEditMode) {
        if (!editingAgent) {
          throw new Error("No Agent is loaded for editing.");
        }

        setPublishProgressIndex(1);
        const typicalOutputUpload = typicalOutputMedia
          ? await uploadTypicalOutputMedia({
              agentSlug,
              file: typicalOutputMedia,
            })
          : uploadedTypicalOutputMedia;
        const nextAgent = agentFromDraft({
          baseAgent: editingAgent,
          draft,
          media: typicalOutputUpload,
          pricePerCallUsd: totalPricePerCallUsd,
        });

        setPublishProgressIndex(2);
        const gatewayRegistration = harnessFile
          ? await updateAgentWithGatewayUpload({
              agent: nextAgent,
              harnessFile,
              releaseNotes: "Updated from the HireMe web edit page.",
              user,
            })
          : await updateAgentMetadataWithGateway({
              agent: nextAgent,
              user,
            });
        const registeredArtifact =
          gatewayRegistration.protectedArtifact || nextAgent.sealedHarness;

        setPublishProgressIndex(3);
        if (editingRecord) {
          writeCreatedAgentRecord({
            ...editingRecord,
            creatorInfoUrl:
              normalizeCreatorInfoUrl(draft.creatorInfoUrl) || undefined,
            agentName: nextAgent.name,
            headline: nextAgent.headline,
            description: nextAgent.publicSummary,
            howToUse: nextAgent.howToUse,
            typicalOutputSample: nextAgent.resultPreview.sample,
            typicalOutputMediaUrl: nextAgent.resultPreview.mediaUrl,
            typicalOutputMediaPath:
              typicalOutputUpload?.path || editingRecord.typicalOutputMediaPath,
            typicalOutputMediaType: nextAgent.resultPreview.mediaType,
            pricePerCallUsd: totalPricePerCallUsd,
            walrusBlobId:
              "walrusBlobId" in registeredArtifact
                ? registeredArtifact.walrusBlobId || editingRecord.walrusBlobId
                : editingRecord.walrusBlobId,
            suiObjectId:
              "suiObjectId" in registeredArtifact
                ? registeredArtifact.suiObjectId || editingRecord.suiObjectId
                : editingRecord.suiObjectId,
            ciphertextDigest:
              "ciphertextDigest" in registeredArtifact
                ? registeredArtifact.ciphertextDigest || editingRecord.ciphertextDigest
                : editingRecord.ciphertextDigest,
            fileCount: harnessFile ? 1 : editingRecord.fileCount,
            createdAt: editingRecord.createdAt,
            status: "Published",
            source: "gateway",
          });
        }
        if (typicalOutputUpload) {
          setUploadedTypicalOutputMedia(typicalOutputUpload);
        }
        setPublishProgressIndex(4);
        navigate(`/agents/${agentSlug}`);
        return;
      }

      if (!harnessFile) {
        throw new Error("Upload a .zip or .tar.gz Agent Harness before creating.");
      }

      setPublishProgressIndex(1);
      const typicalOutputUpload = typicalOutputMedia
        ? await uploadTypicalOutputMedia({
            agentSlug,
            file: typicalOutputMedia,
          })
        : uploadedTypicalOutputMedia;

      setPublishProgressIndex(2);
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
        epochs:
          gatewayRegistration.upload?.storageEpochs ||
          registeredArtifact.storageEpochs ||
          defaultAgentStorageEpochs,
        pricePerCallUsd: totalPricePerCallUsd,
        policyRule: `Caller must hold an active AgentHireReceipt. Results commit safe summaries and artifact digests to ${memWalScope}.`,
        createdAt: gatewayRegistration.registeredAt || new Date().toISOString(),
      };

      setPublishProgressIndex(3);
      writeCreatedAgentRecord({
        id: record.id,
        creatorId: user ? creatorIdFor(user) : "local-anonymous",
        creatorEmail: user?.email || "",
        creatorInfoUrl: normalizeCreatorInfoUrl(draft.creatorInfoUrl) || undefined,
        agentName: draft.agentName,
        agentSlug,
        headline: draft.headline,
        description: draft.description || draft.headline,
        howToUse: draft.howToUse,
        typicalOutputSample: draft.sampleInput,
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
      setPublishProgressIndex(4);
      navigate(`/agents/${agentSlug}`);
    } catch (err) {
      setPublishProgressIndex(null);
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

  function handleAgentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    if (!nextFiles.length) return;
    setCreateError(null);
    setStepError(null);
    setAgentFiles(nextFiles);
  }

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
        Boolean(draft.category) &&
        Boolean(draft.agentName.trim()) &&
        Boolean(draft.headline.trim()) &&
        Boolean(draft.description.trim()),
    },
    {
      label: "Pricing",
      ready:
        Boolean(draft.category) &&
        !Number.isNaN(creatorFeeUsd) &&
        creatorFeeUsd >= 0,
    },
    {
      label: "Protection",
      ready: isEditMode || Boolean(agentFiles[0]),
    },
    {
      label: "How to use",
      ready:
        Boolean(draft.howToUse.trim()) &&
        Boolean(draft.sampleInput.trim()),
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
            <div className="font-medium text-[#191f28]">
              {draft.agentName || "Untitled Agent"}
            </div>
            <div>{draft.category || "Select a category"}</div>
            <div className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {draft.headline || "Add a short summary for Clients."}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">{priceSummaryLabel}</div>
            <div>Base price + creator fee per 1M tokens</div>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">
              {agentFiles[0]?.name ||
                (isEditMode
                  ? "Current protected Harness"
                  : "No Harness uploaded yet")}
            </div>
            <div>
              {isEditMode && !agentFiles[0]
                ? "Upload a replacement only when the private Harness changed."
                : "Private files stay protected inside the runner."}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">
              {draft.howToUse || "How Clients should use it"}
            </div>
            <div className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {draft.sampleInput || "Add a sample input."}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="grid gap-1.5 text-sm text-[#4e5968]">
            <div className="font-medium text-[#191f28]">
              {publishReady ? "Ready to publish" : "More info needed"}
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
    <main className="min-h-[calc(100vh-4.25rem)] bg-[#f6f9fc]">
      <section className="px-4 py-3 md:px-8 md:py-4">
        <div className="mx-auto max-w-5xl">
          <Link
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#6b7684] transition hover:text-[#191f28]"
            to={isEditMode ? "/my" : "/agents"}
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <div className="stepStickyShell -mx-4 mb-0 px-4 md:mx-0 md:px-3">
            <div className="stepNav flex gap-2.5 overflow-x-auto md:grid md:grid-cols-5 md:gap-3 md:overflow-visible">
              {stepItems.map((step, index) => {
                const isActive = activeStep === index;
                const isCompleted = completedSteps[index] && !isActive;
                const isLocked = index > maxAccessibleStep;
                return (
                  <button
                    aria-current={isActive ? "step" : undefined}
                    aria-disabled={isLocked ? true : undefined}
                    className={`min-w-[9.2rem] flex-1 rounded-2xl border px-4 py-2.5 text-center text-xs font-semibold transition-colors duration-200 md:min-w-0 ${isActive ? "border-[#533afd]/35 bg-gradient-to-br from-[#efeaff] to-[#f8f5ff] text-[#2e2b8c] shadow-[0_8px_20px_rgba(83,58,253,0.08)]" : isCompleted ? "border-[#cfe0ff] bg-[#eef5ff] text-[#1f4da8]" : isLocked ? "cursor-not-allowed border-[#d9d5e2] bg-white/72 text-[#8b95a1]" : "border-[#d9d5e2] bg-white/94 text-[#5f6f85] hover:border-[#c8c2d8] hover:bg-[#fbfaff]"}`}
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

          <div className="pt-0">
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
                    <div className="min-w-0 md:col-span-2">
                      <div className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Category
                        <span className="ml-1 text-[#e11d48]" aria-label="required">
                          *
                        </span>
                      </div>
                      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4" data-category-row>
                        {topicFilters.map((category) => {
                          const categoryMeta = categoryPricing[category];
                          const CategoryIcon = categoryMeta.Icon;
                          const selected = draft.category === category;
                          return (
                            <button
                              aria-pressed={selected}
                              className={`flex h-14 w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                                selected
                                  ? "border-[#533afd]/45 bg-[#f7f4ff] shadow-[0_12px_28px_rgba(83,58,253,0.12)]"
                                  : "border-[#dbe3ef] bg-white hover:border-[#cfc6ff] hover:bg-[#fbfaff]"
                              }`}
                              key={category}
                              onClick={() =>
                                setDraft((current) => ({ ...current, category }))
                              }
                              type="button"
                            >
                              <span
                                className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${categoryMeta.iconClassName}`}
                              >
                                <CategoryIcon className="size-4" aria-hidden="true" />
                              </span>
                              <span className="grid min-w-0 gap-0.5">
                                <span className="truncate text-sm font-semibold text-[#191f28]">
                                  {category}
                                </span>
                                <span className="number-cell text-[11px] font-semibold text-[#536073]">
                                  Base {formatAgentPriceShort(categoryMeta.basePriceUsd)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Field label="Agent name" required>
                      <Input
                        required
                        value={draft.agentName}
                        onChange={updateDraft("agentName")}
                      />
                    </Field>
                    <Field label="One-line description" required>
                      <Input
                        required
                        value={draft.headline}
                        onChange={updateDraft("headline")}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="Description" required>
                      <textarea
                        required
                        className="min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={updateDraft("description")}
                        value={draft.description}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="creator_info link">
                      <Input
                        inputMode="url"
                        placeholder="https://example.com/creator"
                        type="url"
                        value={draft.creatorInfoUrl}
                        onChange={updateDraft("creatorInfoUrl")}
                      />
                    </Field>
                  </div>
                }
                description="Name the Agent and explain what it does."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-3 md:flex-row md:items-center md:justify-between">
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
                    <Field label="Creator fee / 1M tokens">
                      <Input
                        min="0"
                        step="0.001"
                        type="number"
                        value={draft.creatorFeeUsd}
                        onChange={updateDraft("creatorFeeUsd")}
                      />
                    </Field>
                    <div className="rounded-2xl border border-[#cfe0ff] bg-[#f7fbff] px-4 py-3">
                      <div className="text-[10px] font-medium uppercase text-muted-foreground">
                        Client price / 1M tokens
                      </div>
                      <div className="mt-2 grid gap-1.5 text-sm text-[#536073]">
                        <div className="flex items-center justify-between gap-4">
                          <span>Base</span>
                          <span className="number-cell font-medium text-[#191f28]">
                            {draft.category
                              ? formatAgentPrice(basePriceUsd)
                              : "Select category"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Creator fee</span>
                          <span className="number-cell font-medium text-[#191f28]">
                            {formatAgentPrice(creatorFeeUsd)}
                          </span>
                        </div>
                      </div>
                      <div className="number-cell mt-3 border-t border-[#dbeafe] pt-3 text-xl font-semibold text-[#1c1e54]">
                        Total {priceSummaryLabel}
                      </div>
                    </div>
                  </div>
                }
                description="The Client price is category base price plus your creator fee."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-3 md:flex-row md:items-center md:justify-between">
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
                      {isEditMode
                        ? "Upload replacement Harness archive"
                        : "Upload private Harness archive"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {isEditMode
                        ? "Leave empty to keep the current protected Harness"
                        : "ZIP, TAR.GZ, or GZ · prompts, skills, examples, rubrics"}
                    </span>
                    <input
                      accept=".zip,.gz,.tgz,.tar.gz,application/zip,application/gzip"
                      className="sr-only"
                      onChange={handleAgentFileChange}
                      type="file"
                    />
                    {agentFiles[0] ? (
                      <span className="mt-3 rounded-full bg-[#edfff4] px-3 py-1 text-xs font-semibold text-[#166534]">
                        {agentFiles[0].name}
                      </span>
                    ) : null}
                  </label>
                }
                description={
                  isEditMode
                    ? "Keep the current Harness or upload a protected replacement."
                    : "Upload the protected Harness that stays private."
                }
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-3 md:flex-row md:items-center md:justify-between">
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
                    <Field className="md:col-span-2" label="How Clients should use it">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={updateDraft("howToUse")}
                        value={draft.howToUse}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="Sample Input">
                      <textarea
                        className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onChange={updateDraft("sampleInput")}
                        value={draft.sampleInput}
                      />
                    </Field>
                    <Field className="md:col-span-2" label="Result Image / Video">
                      <input
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png,video/*"
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
                description="Tell Clients how to use this Agent and provide a sample input."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-3 md:flex-row md:items-center md:justify-between">
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
                title="How to use"
              />

              <WizardStepCard
                active={activeStep === 4}
                body={
                  <div className="grid gap-4">
                    <div className="grid gap-3 rounded-[24px] border border-[#dbeafe] bg-[#f7fbff] p-4 text-sm text-[#4e5968]">
                      <div className="flex items-start justify-between gap-4">
                        <span>Agent name</span>
                        <span className="max-w-[60%] text-right font-medium text-[#191f28]">
                          {draft.agentName || "Untitled Agent"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>One-line description</span>
                        <span className="max-w-[60%] text-right font-medium text-[#191f28]">
                          {draft.headline || "No description"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span>Price</span>
                        <span className="number-cell font-medium text-[#191f28]">
                          {priceSummaryLabel}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3 rounded-2xl border border-[#dbeafe] bg-white p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">
                            Uploaded file
                          </div>
                          <div className="mt-1 text-sm font-medium text-[#191f28]">
                            {agentFiles[0]?.name || "No file uploaded"}
                          </div>
                          {agentFiles[0] ? (
                            <div className="mt-0.5 text-xs text-[#6b7684]">
                              {formatFileSize(agentFiles[0].size)}
                            </div>
                          ) : null}
                        </div>
                        <label
                          className={`inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#cfe0ff] bg-[#eef5ff] px-3 py-2 text-xs font-semibold text-[#1f4da8] transition hover:bg-[#e0efff] ${
                            isSealing ? "pointer-events-none opacity-50" : ""
                          }`}
                        >
                          Change file
                          <input
                            accept=".zip,.gz,.tgz,.tar.gz,application/zip,application/gzip"
                            className="sr-only"
                            disabled={isSealing}
                            onChange={handleAgentFileChange}
                            type="file"
                          />
                        </label>
                      </div>
                    </div>
                    {isSealing ? (
                      <div className="rounded-[24px] border border-[#cfe0ff] bg-white p-4">
                        <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[#536073]">
                          <span>{publishProgressLabel}</span>
                          <span>
                            {publishProgressIndex !== null
                              ? `${publishProgressIndex + 1}/${publishProgressSteps.length}`
                              : ""}
                          </span>
                        </div>
                        <div
                          aria-label="Publish progress"
                          aria-valuemax={publishProgressSteps.length}
                          aria-valuemin={0}
                          aria-valuenow={
                            publishProgressIndex === null
                              ? 0
                              : publishProgressIndex + 1
                          }
                          className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eef8]"
                          role="progressbar"
                        >
                          <div
                            className="h-full rounded-full bg-[#533afd] transition-[width] duration-500 ease-out"
                            style={{ width: `${publishProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                }
                description="Confirm the final details before publishing."
                footer={
                  <div className="flex flex-col gap-3 border-t border-[#ece8fb] pt-3 md:flex-row md:items-center md:justify-between">
                    <Button onClick={handleBack} size="lg" type="button" variant="secondary">
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button
                      className="min-w-[10rem]"
                      disabled={isSealing || !publishReady}
                      onClick={handleNext}
                      size="lg"
                      type="button"
                    >
                      <ShieldCheck />
                      {isSealing
                        ? isEditMode
                          ? "Saving..."
                          : "Publishing..."
                        : isEditMode
                          ? "Save Agent"
                          : "Publish Agent"}
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

  if (!active) return null;

  const shellClassName = [
    "overflow-hidden rounded-b-[28px] rounded-t-none border border-t-0 transition-all duration-500 ease-out",
    isActive
      ? "border-[#533afd]/35 bg-white shadow-[0_24px_70px_rgba(49,130,246,0.11)]"
      : isCompleted
        ? "border-[#cfe0ff] bg-[#f7fbff] shadow-[0_18px_50px_rgba(49,130,246,0.06)]"
        : "border-[#d9d5e2] bg-white/70 opacity-60",
  ].join(" ");

  return (
    <div className="scroll-mt-28 md:scroll-mt-32" ref={wrapperRef}>
      <Card className={shellClassName}>
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        {isCompleted && onEdit ? (
          <button
            className="flex flex-1 items-start gap-3 text-left transition hover:opacity-90"
            onClick={onEdit}
            type="button"
          >
            <WizardStepBadge index={index} state={state} />
            <div className="min-w-0">
              <div className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#191f28] md:text-[1.1rem]">
                {title}
              </div>
              <p className="mt-0.5 text-[0.88rem] leading-5 text-[#6b7684]">
                {description}
              </p>
            </div>
          </button>
        ) : (
          <div className="flex flex-1 items-start gap-3">
            <WizardStepBadge index={index} state={state} />
            <div className="min-w-0">
              <div className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#191f28] md:text-[1.1rem]">
                {title}
              </div>
              <p className="mt-0.5 text-[0.88rem] leading-5 text-[#6b7684]">
                {description}
              </p>
            </div>
          </div>
        )}

        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
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

      <div className="px-5 pb-4 pt-3">
        {isActive ? (
          <div
            className={`grid gap-3 transition-all duration-500 ease-out ${
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
      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl border text-xs font-semibold transition-all ${
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
  required = false,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-[#e11d48]" aria-label="required">
            *
          </span>
        ) : null}
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
