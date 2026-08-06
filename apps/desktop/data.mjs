const workspaceSchema = "hireme.desktop.workspace_data.v1";
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function createDesktopDataService({ getClient, getUser } = {}) {
  return {
    async loadReviewInbox() {
      const { client, user } = requireContext(getClient, getUser);
      const reviewer = await client.from("platform_reviewers")
        .select("role")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      throwResultError(reviewer, "검토자 권한");
      if (!reviewer.data) return { reviewer: false, items: [] };

      const reviews = await client.from("agent_version_reviews")
        .select("agent_version_id, status, automated_report, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);
      throwResultError(reviews, "검토 대기 목록");
      const versionIds = (reviews.data || []).map((item) => item.agent_version_id);
      if (!versionIds.length) return { reviewer: true, role: reviewer.data.role, items: [] };
      const versions = await client.from("agent_versions")
        .select("id, agent_id, version_number, display_version, manifest, package_digest, package_size_bytes, created_at")
        .in("id", versionIds);
      throwResultError(versions, "검토 대상 버전");
      const agentIds = [...new Set((versions.data || []).map((item) => item.agent_id))];
      const agents = agentIds.length
        ? await client.from("agents").select("id, slug, name, category, headline, creator_id").in("id", agentIds)
        : { data: [], error: null };
      throwResultError(agents, "검토 대상 Agent");
      const agentById = new Map((agents.data || []).map((item) => [item.id, item]));
      const versionById = new Map((versions.data || []).map((item) => [item.id, item]));
      return {
        reviewer: true,
        role: reviewer.data.role,
        items: (reviews.data || []).flatMap((review) => {
          const version = versionById.get(review.agent_version_id);
          const agent = version ? agentById.get(version.agent_id) : null;
          if (!version || !agent) return [];
          return [{
            versionId: version.id,
            agentId: agent.slug,
            name: agent.name,
            headline: agent.headline,
            category: agent.category,
            version: version.display_version || `${version.version_number}.0.0`,
            packageDigest: version.package_digest,
            packageSizeBytes: Number(version.package_size_bytes || 0),
            manifest: version.manifest || {},
            preflight: review.automated_report || {},
            submittedAt: review.created_at,
          }];
        }),
      };
    },

    async assertAgentOwnership(input = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const databaseId = input.databaseId
        ? requireUuid(input.databaseId, "Agent database id")
        : null;
      const agentId = String(input.agentId || "").trim().toLowerCase();
      if (!databaseId && !/^[a-z0-9][a-z0-9._-]{0,100}$/.test(agentId)) {
        throw Object.assign(new Error("관리할 Agent id가 올바르지 않습니다."), {
          code: "agent_management_forbidden",
        });
      }
      let query = client
        .from("agents")
        .select("id, creator_id, slug");
      query = databaseId ? query.eq("id", databaseId) : query.eq("slug", agentId);
      const result = await query.maybeSingle();
      throwResultError(result, "Agent 제작자 소유권");
      if (!result.data || result.data.creator_id !== user.id || result.data.slug !== agentId) {
        throw Object.assign(
          new Error("이 Agent의 Private Harness를 관리할 제작자 권한이 없습니다."),
          { code: "agent_management_forbidden" },
        );
      }
      return { agentId: result.data.slug, databaseId: result.data.id, owned: true };
    },

    async loadWorkspace({ localAgentIds = [] } = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const localIds = new Set(
        (Array.isArray(localAgentIds) ? localAgentIds : []).map(String),
      );
      const [agentsResult, accessResult, conversationsResult, runsResult] = await Promise.all([
        selectWorkspaceAgents(client),
        client
          .from("agent_access")
          .select("agent_id, access_mode, status, remaining_runs, renews_at")
          .eq("user_id", user.id),
        client
          .from("conversations")
          .select("id, agent_id, title, provider, model, status, created_at, updated_at")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(200),
        client
          .from("runs")
          .select(
            "id, conversation_id, agent_id, provider, model, status, input_tokens, output_tokens, charged_minor, creator_earnings_minor, currency, error_code, created_at, started_at, completed_at",
          )
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      throwResultError(agentsResult, "Agent 목록");
      throwResultError(accessResult, "Agent 이용 권한");
      throwResultError(conversationsResult, "작업 목록");
      throwResultError(runsResult, "실행 기록");

      const agents = agentsResult.data || [];
      const conversations = conversationsResult.data || [];
      const creatorIds = [...new Set(agents.map((agent) => agent.creator_id).filter(Boolean))];
      const ownedAgentIds = agents
        .filter((agent) => agent.creator_id === user.id)
        .map((agent) => agent.id);
      const conversationIds = conversations.map((conversation) => conversation.id);
      const [profilesResult, versionsResult, messagesResult] = await Promise.all([
        creatorIds.length
          ? client
              .from("profiles")
              .select("id, display_name, avatar_url")
              .in("id", creatorIds)
          : Promise.resolve({ data: [], error: null }),
        ownedAgentIds.length
          ? client
              .from("agent_versions")
              .select("agent_id, version_number, display_version, package_digest, published_at")
              .in("agent_id", ownedAgentIds)
          : Promise.resolve({ data: [], error: null }),
        conversationIds.length
          ? client
              .from("messages")
              .select(
                "id, conversation_id, role, content, attachments, artifacts, metadata, created_at",
              )
              .in("conversation_id", conversationIds)
              .order("created_at", { ascending: true })
              .limit(5000)
          : Promise.resolve({ data: [], error: null }),
      ]);
      throwResultError(profilesResult, "작성자 정보");
      throwResultError(versionsResult, "Agent 버전");
      throwResultError(messagesResult, "메시지");

      const profilesById = new Map(
        (profilesResult.data || []).map((profile) => [profile.id, profile]),
      );
      const accessByAgentId = new Map(
        (accessResult.data || []).map((access) => [access.agent_id, access]),
      );
      const versionsByAgentId = new Map(
        (versionsResult.data || []).map((version) => [
          `${version.agent_id}:${version.version_number}`,
          version,
        ]),
      );
      const slugByDatabaseId = new Map(agents.map((agent) => [agent.id, agent.slug]));
      const messagesByConversation = new Map();
      for (const message of messagesResult.data || []) {
        if (!messagesByConversation.has(message.conversation_id)) {
          messagesByConversation.set(message.conversation_id, []);
        }
        if (message.role === "user" || message.role === "assistant") {
          messagesByConversation.get(message.conversation_id).push(mapMessage(message));
        }
      }

      return {
        schema: workspaceSchema,
        loadedAt: new Date().toISOString(),
        agents: agents.map((agent) => mapAgent({
          agent,
          currentUserId: user.id,
          creator: profilesById.get(agent.creator_id),
          access: accessByAgentId.get(agent.id),
          version: versionsByAgentId.get(`${agent.id}:${agent.current_version}`),
          local: localIds.has(agent.slug),
        })),
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          agentId: slugByDatabaseId.get(conversation.agent_id) || "",
          updatedAt: conversation.updated_at,
          messages: messagesByConversation.get(conversation.id) || [],
          archived: conversation.status === "archived",
          storage: "database",
          provider: conversation.provider,
          model: conversation.model,
        })),
        runs: (runsResult.data || []).map(mapRun),
      };
    },

    async createConversation(input = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const id = requireUuid(input.id, "conversation id");
      const agentId = input.agentDatabaseId
        ? requireUuid(input.agentDatabaseId, "Agent database id")
        : null;
      if (agentId) await assertAgentAccess({ client, userId: user.id, agentId });
      const payload = {
        id,
        owner_id: user.id,
        agent_id: agentId,
        title: normalizeTitle(input.title),
        provider: normalizeProvider(input.provider),
        model: normalizeModel(input.model),
        status: input.archived === true ? "archived" : "active",
      };
      const result = await client
        .from("conversations")
        .insert(payload)
        .select("id, agent_id, title, provider, model, status, created_at, updated_at")
        .single();
      throwResultError(result, "작업 생성");
      return result.data;
    },

    async hireDemoAgent(input = {}) {
      const { client } = requireContext(getClient, getUser);
      const agentId = String(input.agentId || "").trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(agentId)) {
        throw new Error("고용할 Agent id가 올바르지 않습니다.");
      }
      const result = await client.rpc("hire_demo_agent", { agent_slug: agentId });
      throwResultError(result, "무료 데모 고용");
      const access = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!access?.agent_id) throw new Error("무료 데모 고용 권한을 확인하지 못했습니다.");
      return { agentId: access.agent_id, hired: true };
    },

    async deleteOwnedAgent(input = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const databaseId = input.databaseId
        ? requireUuid(input.databaseId, "Agent database id")
        : null;
      if (!databaseId) return { databaseId: null, deleted: false };
      const result = await client
        .from("agents")
        .delete()
        .eq("id", databaseId)
        .eq("creator_id", user.id)
        .select("id")
        .maybeSingle();
      throwResultError(result, "내 Agent 삭제");
      if (!result.data) {
        throw Object.assign(new Error("삭제할 내 Agent를 찾을 수 없습니다."), {
          code: "agent_management_forbidden",
        });
      }
      return { databaseId: result.data.id, deleted: true };
    },

    async updateConversation(input = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const id = requireUuid(input.id, "conversation id");
      const patch = {};
      if (input.title !== undefined) patch.title = normalizeTitle(input.title);
      if (input.archived !== undefined) patch.status = input.archived === true ? "archived" : "active";
      if (input.provider !== undefined) patch.provider = normalizeProvider(input.provider);
      if (input.model !== undefined) patch.model = normalizeModel(input.model);
      if (input.agentDatabaseId !== undefined) {
        patch.agent_id = input.agentDatabaseId
          ? requireUuid(input.agentDatabaseId, "Agent database id")
          : null;
        if (patch.agent_id) {
          await assertAgentAccess({ client, userId: user.id, agentId: patch.agent_id });
        }
      }
      if (!Object.keys(patch).length) throw new Error("변경할 작업 정보가 없습니다.");
      const result = await client
        .from("conversations")
        .update(patch)
        .eq("id", id)
        .eq("owner_id", user.id)
        .select("id, agent_id, title, provider, model, status, created_at, updated_at")
        .single();
      throwResultError(result, "작업 업데이트");
      return result.data;
    },

    async deleteConversation(input = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const id = requireUuid(input.id, "conversation id");
      const result = await client
        .from("conversations")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id)
        .select("id")
        .maybeSingle();
      throwResultError(result, "작업 삭제");
      if (!result.data) throw new Error("삭제할 작업을 찾을 수 없습니다.");
      return { id: result.data.id, deleted: true };
    },

    async saveMessage(input = {}) {
      const { client, user } = requireContext(getClient, getUser);
      const id = requireUuid(input.id, "message id");
      const conversationId = requireUuid(input.conversationId, "conversation id");
      const role = String(input.role || "");
      if (role !== "user" && role !== "assistant") {
        throw new Error("저장할 수 없는 메시지 역할입니다.");
      }
      const owned = await client
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("owner_id", user.id)
        .maybeSingle();
      throwResultError(owned, "작업 소유권 확인");
      if (!owned.data) throw new Error("메시지를 저장할 작업을 찾을 수 없습니다.");
      const payload = {
        id,
        conversation_id: conversationId,
        role,
        content: String(input.text || "").slice(0, 2_000_000),
        attachments: sanitizeFiles(input.attachments),
        artifacts: sanitizeFiles(input.artifacts),
        metadata: {
          ...(input.status ? { status: normalizeMessageStatus(input.status) } : {}),
          ...(Number.isFinite(Number(input.elapsedMs))
            ? { elapsedMs: Math.max(0, Math.round(Number(input.elapsedMs))) }
            : {}),
        },
        created_at: normalizeTimestamp(input.at),
      };
      const result = await client
        .from("messages")
        .upsert(payload, { onConflict: "id" })
        .select("id, conversation_id, role, content, attachments, artifacts, metadata, created_at")
        .single();
      throwResultError(result, "메시지 저장");
      return mapMessage(result.data);
    },
  };
}

async function selectWorkspaceAgents(client) {
  const baseColumns = "id, creator_id, slug, name, category, status, visibility, headline, public_summary, public_skills, result_types, cover_image_url, public_examples, current_version, pricing, created_at, updated_at";
  const withDesignContract = await client
    .from("agents")
    .select(`${baseColumns}, public_design_contract`)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (!withDesignContract.error || !/public_design_contract|42703/i.test(`${withDesignContract.error.code || ""} ${withDesignContract.error.message || ""}`)) {
    return withDesignContract;
  }
  return client
    .from("agents")
    .select(baseColumns)
    .order("updated_at", { ascending: false })
    .limit(500);
}

async function assertAgentAccess({ client, userId, agentId }) {
  const agentResult = await client
    .from("agents")
    .select("id, creator_id, status")
    .eq("id", agentId)
    .single();
  throwResultError(agentResult, "Agent 접근 확인");
  if (agentResult.data.creator_id === userId) return;
  const accessResult = await client
    .from("agent_access")
    .select("status")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .eq("status", "active")
    .maybeSingle();
  throwResultError(accessResult, "Agent 이용 권한 확인");
  if (!accessResult.data) throw new Error("이 Agent를 사용할 수 있는 활성 권한이 없습니다.");
}

function mapAgent({ agent, currentUserId, creator, access, version, local }) {
  const mine = agent.creator_id === currentUserId;
  const pricing = agent.pricing && typeof agent.pricing === "object" ? agent.pricing : {};
  const billingMode = pricing.mode === "usage"
    ? "run"
    : ["run", "subscription", "hybrid"].includes(pricing.mode)
      ? pricing.mode
      : "run";
  return {
    databaseId: agent.id,
    id: agent.slug,
    name: agent.name,
    creator: mine ? "나" : creator?.display_name || "HireMe Creator",
    category: mapCategory(agent.category),
    headline: agent.headline,
    summary: agent.public_summary,
    skills: Array.isArray(agent.public_skills) ? agent.public_skills : [],
    resultTypes: mapResultTypes(agent.result_types),
    image: safeHttpsUrl(agent.cover_image_url),
    outputExamples: publicExamples(agent.public_examples),
    designSystem: publicDesignSystem(agent.public_design_contract),
    accent: accentFor(agent.slug),
    rating: 0,
    reviews: 0,
    uses: 0,
    billingMode,
    runPrice: readRunPrice(pricing),
    subscriptionPrice: subscriptionPrice(pricing.subscription),
    version: version?.display_version || version?.version_number
      ? (version?.display_version || `${version.version_number}.0.0`)
      : agent.current_version
        ? `${agent.current_version}.0.0`
        : "0.1.0",
    ownership: mine ? "mine" : "market",
    status: agent.status === "published" ? "공개" : agent.status === "review" ? "검토 중" : "초안",
    revenue30d: 0,
    subscribers: 0,
    // A creator edits from its durable local source. Hired public Agents are
    // materialized only for a licensed run by the desktop runtime.
    runtime: mine && local ? "local" : "protected",
    hired: mine || access?.status === "active",
    source: "database",
  };
}

function publicDesignSystem(value) {
  const contract = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const questions = (Array.isArray(contract.questions) ? contract.questions : [])
    .map((raw, index) => {
      const question = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      const label = String(question.label || "").trim().slice(0, 500);
      if (!label) return null;
      const rawKind = String(question.kind || "short");
      const kind = ["single", "multi", "short", "long"].includes(rawKind) ? rawKind : "short";
      return {
        id: String(question.id || `question-${index + 1}`).trim().slice(0, 80),
        label,
        helper: String(question.helper || "").trim().slice(0, 500),
        kind,
        required: question.required !== false,
        options: (Array.isArray(question.options) ? question.options : [])
          .map((option) => String(option || "").trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 20),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
  if (!questions.length) return undefined;
  return {
    purpose: String(contract.purpose || "").trim().slice(0, 2_000),
    priorities: [],
    avoid: [],
    qualityBar: [],
    questions,
    priorityCount: Math.max(0, Math.min(20, Number(contract.priority_count) || 0)),
    qualityBarCount: Math.max(0, Math.min(20, Number(contract.quality_bar_count) || 0)),
  };
}

function mapMessage(message) {
  const metadata = message.metadata && typeof message.metadata === "object"
    ? message.metadata
    : {};
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    at: message.created_at,
    ...(metadata.status ? { status: normalizeMessageStatus(metadata.status) } : {}),
    ...(Number.isFinite(Number(metadata.elapsedMs))
      ? { elapsedMs: Math.max(0, Math.round(Number(metadata.elapsedMs))) }
      : {}),
    attachments: sanitizeFiles(message.attachments),
    artifacts: sanitizeFiles(message.artifacts),
  };
}

function mapRun(run) {
  return {
    id: run.id,
    conversationId: run.conversation_id,
    agentId: run.agent_id,
    provider: run.provider,
    model: run.model,
    status: run.status,
    inputTokens: Number(run.input_tokens || 0),
    outputTokens: Number(run.output_tokens || 0),
    chargedMinor: Number(run.charged_minor || 0),
    creatorEarningsMinor: Number(run.creator_earnings_minor || 0),
    currency: run.currency,
    errorCode: run.error_code,
    createdAt: run.created_at,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  };
}

function sanitizeFiles(value) {
  return (Array.isArray(value) ? value : []).slice(0, 20).map((file) => ({
    name: String(file?.name || "file").replace(/[\u0000-\u001f]/g, "").slice(0, 255),
    ...(Number.isFinite(Number(file?.size))
      ? { size: Math.max(0, Math.round(Number(file.size))) }
      : {}),
    ...(file?.mimeType ? { mimeType: String(file.mimeType).slice(0, 160) } : {}),
    ...(file?.kind ? { kind: String(file.kind).slice(0, 80) } : {}),
    ...(file?.storageKey ? { storageKey: String(file.storageKey).replaceAll("\\", "/").slice(0, 500) } : {}),
  }));
}

function mapCategory(value) {
  if (value === "writing") return "글쓰기";
  if (value === "business") return "비즈니스";
  if (value === "research") return "리서치";
  if (value === "productivity") return "생산성";
  return "디자인";
}

function mapResultTypes(value) {
  const labels = { text: "문서", image: "PNG", file: "파일" };
  const result = (Array.isArray(value) ? value : []).map((item) => labels[item] || String(item));
  return result.length ? result : ["문서"];
}

function accentFor(value) {
  const accents = ["green", "coral", "blue", "yellow", "violet", "charcoal"];
  let hash = 0;
  for (const char of String(value || "")) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return accents[hash % accents.length];
}

function subscriptionPrice(value) {
  const amount = finitePrice(value?.amount);
  if (amount === undefined) return undefined;
  return String(value?.currency || "").toUpperCase() === "USD" ? amount * 1000 : amount;
}

function finitePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function readRunPrice(pricing) {
  const current = finitePrice(pricing?.run?.amount);
  if (current !== undefined) return current;
  const legacy = finitePrice(pricing?.usage?.amount);
  if (legacy === undefined) return undefined;
  return String(pricing?.usage?.currency || "").toUpperCase() === "USD"
    ? Math.round(legacy * 100)
    : legacy;
}

function safeHttpsUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function publicExamples(value) {
  return (Array.isArray(value) ? value : []).slice(0, 12).flatMap((item) => {
    const previewUrl = safeHttpsUrl(item?.previewUrl);
    if (!previewUrl) return [];
    return [{
      name: String(item?.name || "결과 예시").slice(0, 255),
      mimeType: String(item?.mimeType || "application/octet-stream").slice(0, 160),
      previewUrl,
      ...(item?.description ? { description: String(item.description).slice(0, 500) } : {}),
    }];
  });
}

function normalizeTitle(value) {
  const title = String(value || "새 작업").trim().slice(0, 200);
  return title || "새 작업";
}

function normalizeProvider(value) {
  if (value === null || value === undefined || value === "") return null;
  const provider = String(value).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,40}$/.test(provider)) throw new Error("AI 연결 값이 올바르지 않습니다.");
  return provider;
}

function normalizeModel(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim().slice(0, 120) || null;
}

function normalizeTimestamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeMessageStatus(value) {
  return ["queued", "sent", "failed", "cancelled"].includes(value) ? value : "sent";
}

function requireContext(getClient, getUser) {
  const client = getClient?.();
  const user = getUser?.();
  if (!client || !user?.id) throw new Error("HireMe 로그인이 필요합니다.");
  return { client, user };
}

function requireUuid(value, name) {
  const id = String(value || "").trim();
  if (!uuidPattern.test(id)) throw new Error(`${name}가 올바르지 않습니다.`);
  return id;
}

function throwResultError(result, label) {
  if (result?.error) throw new Error(`${label}을 불러오지 못했습니다: ${result.error.message}`);
}
