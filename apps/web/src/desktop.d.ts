type HireMeNativeAgent = {
  id: string;
  name: string;
  category: string;
  headline: string;
  publicSummary: string;
  publicSkills: string[];
};

type HireMeDesktopBootstrap = {
  native: true;
  workspace: string;
  agents: HireMeNativeAgent[];
  platform: string;
  auth: HireMeDesktopAuthState;
};

type HireMeDesktopAuthUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  defaultProvider: string;
  defaultModel: string | null;
  aiSetupCompleted: boolean;
};

type HireMeDesktopAuthState = {
  schema: "hireme.desktop.auth_state.v1";
  configured: boolean;
  status: "unconfigured" | "loading" | "unauthenticated" | "authenticating" | "authenticated" | "error";
  user: HireMeDesktopAuthUser | null;
  error: string | null;
  revision?: number;
};

type HireMeDesktopAiModel = {
  id: string;
  name: string;
  size: number | null;
};

type HireMeDesktopAiSettings = {
  schema: "hireme.desktop.ai_settings.v1";
  revision: number;
  selected: "codex" | "ollama";
  setupCompleted: boolean;
  codex: {
    installed: boolean;
    connected: boolean;
    connecting: boolean;
    status: "connected" | "not_connected" | "not_installed" | "connecting" | "error";
    error: string | null;
  };
  ollama: {
    available: boolean;
    status: "available" | "not_running";
    endpoint: string;
    models: HireMeDesktopAiModel[];
    selectedModel: string | null;
    error: string | null;
  };
};

type HireMeDesktopAiSelection = {
  provider: "codex" | "ollama";
  model?: string | null;
};

type HireMeDesktopAiSaveResult = {
  auth: HireMeDesktopAuthState;
  settings: HireMeDesktopAiSettings;
};

type HireMeDesktopChatRequest = {
  runId?: string;
  conversationId: string;
  agentId: string;
  text: string;
  attachments: HireMeDesktopFile[];
  workspace?: string;
  mode?: "work" | "agent_authoring";
  managementSessionId?: string;
  agentName?: string;
  agentBrief?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
};

type HireMeAgentDraftWrite = {
  agentId: string;
  name: string;
  category: string;
  headline: string;
  summary: string;
  creator?: string;
  skills?: string[];
  resultTypes?: string[];
  designSystem?: {
    purpose: string;
    priorities: string[];
    avoid: string[];
    qualityBar: string[];
    questions: Array<{
      id: string;
      label: string;
      helper?: string;
      kind: "single" | "multi" | "short" | "long";
      required: boolean;
      options?: string[];
    }>;
  };
  conversationId?: string;
};

type HireMeAgentManagementSession = {
  id: string;
  conversationId: string;
  agentId: string;
  expiresAt: string;
};

type HireMeAgentDraftResult = {
  schema: "hireme.desktop.agent_draft.v1";
  status: "created";
  agentId: string;
  phase: string;
  revision: number;
  template: string;
  memoryCustomized: boolean;
};

type HireMeAgentManagementResult = {
  schema: "hireme.desktop.agent_management.v1";
  status: "ready";
  agentId: string;
  conversationId: string;
  phase: string;
  revision: number;
  copiedFromBundle: boolean;
  managementSession: HireMeAgentManagementSession;
};

type HireMePrivateHarnessRequest = {
  conversationId: string;
  agentId: string;
  managementSessionId: string;
};

type HireMePrivateHarnessFileSummary = {
  path: string;
  role: string;
  bytes: number;
  sha256: string;
};

type HireMePrivateHarnessFileList = {
  schema: "hireme.desktop.private_harness_file_list.v1";
  agentId: string;
  conversationId: string;
  revision: number;
  count: number;
  files: HireMePrivateHarnessFileSummary[];
  privacyBoundary: string;
};

type HireMePrivateHarnessFile = {
  schema: "hireme.desktop.private_harness_file.v1";
  agentId: string;
  conversationId: string;
  path: string;
  content: string;
  bytes: number;
  sha256: string;
  privacyBoundary: string;
};

type HireMePrivateHarnessUpdate = {
  schema: "hireme.desktop.private_harness_update.v1";
  status: "updated";
  agentId: string;
  conversationId: string;
  path: string;
  bytes: number;
  sha256: string;
  phase: string;
  revision: number;
  valid: boolean;
};

type HireMeAgentPublishResult = {
  schema: "hireme.desktop.agent_publish.v1";
  status: "published";
  agentId: string;
  version: string;
  revision: number;
  packagePath: string;
  packageRelativePath: string;
  packageDigest: string;
  includesPrivateHarness: boolean;
  memory?: Record<string, unknown>;
  databaseVersion?: string;
  storage?: { bucket: string; path: string; runtimeRef: string };
};

type HireMeDesktopFile = {
  name: string;
  path?: string;
  size?: number;
  mimeType?: string;
  previewUrl?: string;
  kind?: string;
  storageKey?: string;
};

type HireMeDesktopChatResult = {
  output: string;
  elapsedMs: number;
  runId?: string;
  artifacts?: HireMeDesktopFile[];
};

type HireMeDatabaseAgent = {
  databaseId: string;
  id: string;
  name: string;
  creator: string;
  category: "디자인" | "글쓰기" | "비즈니스" | "리서치" | "생산성";
  headline: string;
  summary: string;
  skills: string[];
  resultTypes: string[];
  image?: string;
  outputExamples?: Array<{ name: string; mimeType: string; previewUrl: string; description?: string }>;
  designSystem?: NonNullable<HireMeAgentDraftWrite["designSystem"]> & {
    priorityCount?: number;
    qualityBarCount?: number;
  };
  accent: "green" | "coral" | "blue" | "yellow" | "violet" | "charcoal";
  rating: number;
  reviews: number;
  uses: number;
  billingMode: "run" | "subscription" | "hybrid";
  runPrice?: number;
  subscriptionPrice?: number;
  version: string;
  ownership: "mine" | "market";
  status: "공개" | "검토 중" | "초안";
  revenue30d?: number;
  subscribers?: number;
  runtime: "local" | "protected" | "preview";
  hired?: boolean;
  source: "database";
};

type HireMeDatabaseMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  status?: "queued" | "sent" | "failed" | "cancelled";
  elapsedMs?: number;
  attachments?: HireMeDesktopFile[];
  artifacts?: HireMeDesktopFile[];
};

type HireMeDatabaseConversation = {
  id: string;
  title: string;
  agentId: string;
  updatedAt: string;
  messages: HireMeDatabaseMessage[];
  archived: boolean;
  storage: "database";
  provider?: string | null;
  model?: string | null;
};

type HireMeDesktopWorkspaceData = {
  schema: "hireme.desktop.workspace_data.v1";
  loadedAt: string;
  agents: HireMeDatabaseAgent[];
  conversations: HireMeDatabaseConversation[];
  runs: Array<Record<string, unknown>>;
};

type HireMeReviewInboxItem = {
  versionId: string;
  agentId: string;
  name: string;
  headline: string;
  category: string;
  version: string;
  packageDigest: string;
  packageSizeBytes: number;
  manifest: Record<string, unknown>;
  preflight: { passed?: boolean; blocking?: string[]; warnings?: string[]; checkedAt?: string };
  submittedAt: string;
};

type HireMeReviewInbox = {
  reviewer: boolean;
  role?: "reviewer" | "admin";
  items: HireMeReviewInboxItem[];
};

type HireMeConversationWrite = {
  id: string;
  agentDatabaseId?: string | null;
  title?: string;
  provider?: string | null;
  model?: string | null;
  archived?: boolean;
};

type HireMeMessageWrite = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  status?: "queued" | "sent" | "failed" | "cancelled";
  elapsedMs?: number;
  attachments?: HireMeDesktopFile[];
  artifacts?: HireMeDesktopFile[];
};

interface Window {
  hiremeDesktop?: {
    bootstrap(): Promise<HireMeDesktopBootstrap>;
    getAuthState(): Promise<HireMeDesktopAuthState | null>;
    loginWithGoogle(): Promise<HireMeDesktopAuthState>;
    logout(): Promise<HireMeDesktopAuthState | null>;
    loadWorkspaceData(): Promise<HireMeDesktopWorkspaceData>;
    loadReviewInbox(): Promise<HireMeReviewInbox>;
    decideAgentReview(input: { versionId: string; decision: "approved" | "rejected"; note?: string }): Promise<{ status: string }>;
    createConversation(input: HireMeConversationWrite): Promise<Record<string, unknown>>;
    hireDemoAgent(input: { agentId: string }): Promise<{ agentId: string; hired: true }>;
    updateConversation(input: HireMeConversationWrite): Promise<Record<string, unknown>>;
    deleteConversation(input: { id: string }): Promise<{ id: string; deleted: true }>;
    saveMessage(input: HireMeMessageWrite): Promise<HireMeDatabaseMessage>;
    createAgentDraft(input: HireMeAgentDraftWrite): Promise<HireMeAgentDraftResult>;
    deleteAgent(input: { agentId: string; databaseId?: string }): Promise<{ agentId: string; deleted: true }>;
    prepareAgentManagement(input: HireMeAgentDraftWrite): Promise<HireMeAgentManagementResult>;
    updateAgentDesignSystem(input: HireMePrivateHarnessRequest & { designSystem: NonNullable<HireMeAgentDraftWrite["designSystem"]> }): Promise<HireMePrivateHarnessUpdate>;
    listPrivateHarnessFiles(input: HireMePrivateHarnessRequest): Promise<HireMePrivateHarnessFileList>;
    readPrivateHarnessFile(input: HireMePrivateHarnessRequest & { path: string }): Promise<HireMePrivateHarnessFile>;
    updatePrivateHarnessFile(input: HireMePrivateHarnessRequest & { path: string; content: string; expectedSha256: string }): Promise<HireMePrivateHarnessUpdate>;
    closeAgentManagement(input: HireMePrivateHarnessRequest): Promise<{ revoked: true; conversationId: string; agentId: string }>;
    publishAgentDraft(input: HireMePrivateHarnessRequest & { version: string }): Promise<HireMeAgentPublishResult>;
    getAiSettings(): Promise<HireMeDesktopAiSettings>;
    connectCodex(): Promise<HireMeDesktopAiSettings>;
    cancelAiConnection(): Promise<boolean>;
    disconnectCodex(): Promise<HireMeDesktopAiSettings>;
    saveAiSettings(selection: HireMeDesktopAiSelection): Promise<HireMeDesktopAiSaveResult>;
    chooseWorkspace(): Promise<string | null>;
    pickFiles(): Promise<HireMeDesktopFile[]>;
    previewFile(path: string): Promise<HireMeDesktopFile | null>;
    openFile(path: string): Promise<boolean>;
    sendChat(request: HireMeDesktopChatRequest): Promise<HireMeDesktopChatResult>;
    cancelRun(runId: string): Promise<boolean>;
    onRunEvent(listener: (event: Record<string, unknown>) => void): () => void;
    onAuthStateChanged(listener: (state: HireMeDesktopAuthState) => void): () => void;
    onAiSettingsChanged(listener: (settings: HireMeDesktopAiSettings) => void): () => void;
  };
}
