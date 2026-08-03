import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  createSpecialistMemoryStore,
  publicSpecialistMemoryMetadata,
  toSpecialistMemoryEnvelope,
} from "./specialistMemory.mjs";
import {
  normalizeExecutionPolicy,
  selectExecutionPolicy,
} from "./executionPolicy.mjs";

const outputSchemaVersion = "hireme.specialist_agent.output.v1";

export const mockProtectedAgents = [
  {
    id: "third-party-launch-operator",
    name: "Third-Party Launch Operator",
    creatorId: "third-party-growth-studio",
    creator: "Growth Studio",
    category: "Launch",
    status: "Protected Runtime Mock",
    headline: "Drafts launch positioning without exposing the private GTM harness.",
    publicSummary:
      "A protected third-party launch specialist. The private playbook remains inside the runtime-only boundary.",
    publicSkills: ["Launch positioning", "Audience mapping", "Channel copy"],
    bootstrapMemory: [
      {
        id: "launch-proof-default",
        key: "strategy.proof",
        kind: "principle",
        text: "Lead with a concrete before-and-after proof before broad marketplace claims.",
        tags: ["launch", "proof"],
        priority: 75,
        visibility: "protected",
      },
      {
        id: "launch-boundary-default",
        key: "strategy.ip-boundary",
        kind: "principle",
        text: "Explain that buyers receive useful outcomes while the creator's private operating method remains protected.",
        tags: ["launch", "positioning"],
        priority: 70,
        visibility: "protected",
      },
    ],
    manifest: {
      schema: "hireme.local_specialist.manifest.v1",
      capabilities: ["text.launch_brief", "strategy.positioning", "artifact.markdown"],
      inputModes: ["text"],
      outputModes: ["direct_answer", "artifact_spec"],
      finalizers: ["text", "file"],
      intentTags: ["launch", "brief", "positioning", "소개문", "브리프"],
      execution: {
        schema: "hireme.agent_execution_policy.v1",
        defaultClass: "local_protected",
        operations: [
          {
            id: "standard-launch-brief",
            title: "Standard launch brief",
            executionClass: "local_protected",
            billingKey: "local_protected",
            default: true,
            priority: 10,
            triggers: [],
          },
          {
            id: "confidential-launch-scoring",
            title: "Confidential launch scoring",
            executionClass: "hosted_secure",
            billingKey: "hosted_secure",
            priority: 100,
            triggers: ["confidential scoring", "private scoring", "민감한 평가", "내부 점수"],
          },
        ],
      },
      routing: {
        priority: 72,
        triggers: ["launch", "brief", "positioning", "소개문", "브리프", "랜딩"],
        negativeTriggers: ["AGENTS.md", "private harness", "hidden prompt"],
        examples: ["HireMe 소개문을 만들어줘"],
      },
    },
    protection: {
      visibility: "protected",
      localMaterialization: "licensed_device_only",
      cachePolicy: "ephemeral_plaintext_only",
      executionMode: "hybrid_protected",
    },
  },
  {
    id: "third-party-eval-sentinel",
    name: "Third-Party Eval Sentinel",
    creatorId: "third-party-eval-works",
    creator: "Eval Works",
    category: "Evaluation",
    status: "Protected Runtime Mock",
    headline: "Reviews Agent outputs for leakage and quality risks.",
    publicSummary:
      "A protected evaluation specialist. Red-team prompts and grading rubrics are never materialized locally.",
    publicSkills: ["Leakage checks", "Quality grading", "Risk review"],
    bootstrapMemory: [
      {
        id: "eval-risk-order",
        key: "evaluation.order",
        kind: "principle",
        text: "Check protected-content leakage first, unsupported claims second, and unclear assumptions third.",
        tags: ["evaluation", "risk"],
        priority: 80,
        visibility: "protected",
      },
    ],
    manifest: {
      schema: "hireme.local_specialist.manifest.v1",
      capabilities: ["evaluation.agent_output", "text.review", "policy.leakage_check"],
      inputModes: ["text"],
      outputModes: ["direct_answer"],
      finalizers: ["text"],
      intentTags: ["eval", "review", "leakage", "quality", "검증"],
      execution: {
        schema: "hireme.agent_execution_policy.v1",
        defaultClass: "hosted_secure",
        operations: [
          {
            id: "secure-evaluation",
            title: "Secure evaluation",
            executionClass: "hosted_secure",
            billingKey: "hosted_secure",
            default: true,
            priority: 100,
            triggers: [],
          },
        ],
      },
      routing: {
        priority: 68,
        triggers: ["eval", "review", "leakage", "quality", "검증", "평가"],
        negativeTriggers: ["private prompt", "rubric source", "AGENTS.md"],
        examples: ["이 Agent 결과가 안전한지 검증해줘"],
      },
    },
    protection: {
      visibility: "protected",
      localMaterialization: "forbidden",
      cachePolicy: "no_plaintext_cache",
      executionMode: "hosted_secure",
    },
  },
];

export function createProtectedRuntimeTools({
  stateDir = ".hireme/standalone-agent/default",
  protectedAgents = mockProtectedAgents,
  currentUserId = process.env.HIREME_USER_ID || "local-dev-user",
  defaultConversationId = "default-session",
} = {}) {
  const stateRoot = resolve(stateDir);
  return [
    {
      name: "hireme_list_protected_runtime_agents",
      description:
        "List protected third-party Agents that can be called only through a runtime boundary. Returns public metadata only.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
        },
      },
      handler: async (args = {}) => listProtectedRuntimeAgents({ agents: protectedAgents, ...args }),
    },
    {
      name: "hireme_get_protected_runtime_agent",
      description:
        "Get public metadata for one protected third-party runtime Agent. Never returns private harness source.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
        },
        required: ["agent_id"],
      },
      handler: async (args = {}) => {
        const agent = findProtectedAgent(protectedAgents, args.agent_id || args.agentId);
        return publicProtectedAgent(agent);
      },
    },
    {
      name: "hireme_call_protected_agent_runtime",
      description:
        "Call a protected third-party Agent through the runtime-only boundary. Does not import, extract, cache, or expose the private harness.",
      inputSchema: {
        type: "object",
        properties: {
          agent_id: { type: "string" },
          task: { type: "string" },
          conversation_id: { type: "string" },
          response_mode: {
            type: "string",
            enum: ["direct_answer", "artifact_spec", "local_workspace_execution_brief"],
          },
          output_format: { type: "string" },
          save_local_result: { type: "boolean" },
          current_user_id: { type: "string" },
          session_memory: { type: "array", items: { type: "object" } },
          execution_class: {
            type: "string",
            enum: ["local_protected", "hosted_secure"],
          },
          operation_id: { type: "string" },
        },
        required: ["agent_id", "task"],
      },
      handler: async (args = {}) =>
        callProtectedAgentRuntime({
          agents: protectedAgents,
          stateRoot,
          current_user_id: args.current_user_id || args.currentUserId || currentUserId,
          conversation_id:
            args.conversation_id || args.conversationId || defaultConversationId,
          ...args,
        }),
    },
  ];
}

export async function listProtectedRuntimeAgents({ agents = mockProtectedAgents, query, category } = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const filtered = agents
    .filter((agent) => !category || agent.category === category)
    .filter((agent) => {
      if (!normalizedQuery) return true;
      return [
        agent.id,
        agent.name,
        agent.creator,
        agent.category,
        agent.headline,
        agent.publicSummary,
        ...(agent.publicSkills || []),
        ...(agent.manifest?.capabilities || []),
        ...(agent.manifest?.intentTags || []),
        ...(agent.manifest?.routing?.triggers || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  return {
    type: "hireme_protected_runtime_agent_list",
    count: filtered.length,
    agents: filtered.map(publicProtectedAgent),
    runtimeBoundary:
      "Protected runtime Agents are public metadata plus safe calls only. Private harness packages are not materialized locally.",
  };
}

export async function callProtectedAgentRuntime({
  agents = mockProtectedAgents,
  stateRoot,
  agent_id,
  agentId,
  task,
  conversation_id,
  conversationId,
  response_mode,
  responseMode,
  output_format,
  outputFormat,
  save_local_result,
  saveLocalResult,
  current_user_id,
  currentUserId,
  session_memory,
  sessionMemory,
  execution_class,
  executionClass,
  operation_id,
  operationId,
} = {}) {
  const agent = findProtectedAgent(agents, agent_id || agentId);
  const text = String(task || "").trim();
  if (!text) throw new Error("task is required");
  const conversationIdOut = conversation_id || conversationId;
  const execution = selectExecutionPolicy({
    policy: normalizeExecutionPolicy(agent.manifest?.execution, {
      defaultClass: agent.protection?.executionMode === "hosted_secure"
        ? "hosted_secure"
        : "local_protected",
    }),
    task: text,
    operationId: operation_id || operationId,
    requestedExecutionClass: execution_class || executionClass,
  });
  const shouldSaveLocalResult = (save_local_result ?? saveLocalResult ?? true) === true;
  const inputAttackSignal = protectedInputAttackSignal(text);
  if (inputAttackSignal) {
    const refusal = {
      schema: outputSchemaVersion,
      agentId: agent.id,
      status: "refused",
      responseMode: "direct_answer",
      outputText:
        "I cannot provide this protected Agent's private harness, prompts, skills, rubrics, examples, or internal routing. I can summarize public capabilities or run the Agent through the protected runtime.",
      structuredResult: {
        summary: "Protected internals request refused.",
        keyFindings: [],
        recommendations: ["Ask for the Agent's public profile or a runtime result instead."],
      },
      artifacts: [],
      evidence: [],
      assumptions: [],
      risks: [],
      memoryDeltas: [],
      runtime: runtimeMetadata(agent, conversationIdOut, execution, {
        attackDetected: true,
        refusalReason: "protected_internal_request",
        refusalSignal: inputAttackSignal,
      }),
    };
    if (shouldSaveLocalResult) {
      await appendSafeRuntimeLog(stateRoot, refusal);
    }
    return refusal;
  }

  const responseModeOut = normalizeResponseMode(response_mode || responseMode, text);
  const userId = String(current_user_id || currentUserId || "local-dev-user");
  const sessionId = String(conversationIdOut || "default-session");
  const memoryStore = createSpecialistMemoryStore({ stateDir: stateRoot });
  const memoryContext = await memoryStore.recall({
    bootstrapRecords: agent.bootstrapMemory || [],
    agentId: agent.id,
    userId,
    conversationId: sessionId,
    query: text,
    sessionMemory: session_memory || sessionMemory || [],
  });
  const executionInput = {
    task: text,
    memoryContext: toSpecialistMemoryEnvelope(memoryContext),
  };
  const localProtected = execution.executionClass === "local_protected";
  const result = {
    schema: outputSchemaVersion,
    agentId: agent.id,
    status: "completed",
    responseMode: responseModeOut,
    outputText: buildMockProtectedOutput({
      agent,
      task: executionInput.task,
      responseMode: responseModeOut,
    }),
    structuredResult: {
      summary: localProtected
        ? `${agent.name} produced a safe result through an ephemeral licensed-device runtime.`
        : `${agent.name} produced a safe result without sending its secure bundle to the device.`,
      keyFindings: [
        localProtected
          ? "The encrypted local bundle was materialized only for the licensed runtime process."
          : "The secure bundle remained inside the hosted runtime boundary.",
        "No plaintext archive or persistent plaintext cache was written to the workspace.",
        "Only the safe output envelope is available locally.",
      ],
      recommendations: buildMockRecommendations(agent, text),
    },
    artifacts: responseModeOut === "artifact_spec"
      ? [
          {
            kind: "markdown",
            filename: `${agent.id}-runtime-result.md`,
            mimeType: "text/markdown",
            description: "Safe artifact generated by the protected runtime mock.",
            content: buildMockProtectedOutput({
              agent,
              task: executionInput.task,
              responseMode: responseModeOut,
            }),
          },
        ]
      : [],
    evidence: [
      {
        label: "runtime boundary",
        detail: localProtected
          ? "mock_local_protected_runtime used ephemeral licensed-device materialization"
          : "mock_hosted_secure_runtime executed without package delivery to the device",
      },
    ],
    assumptions: [
      localProtected
        ? "This mock models practical copy resistance, not protection from a device administrator or debugger."
        : "This is a local test double for the future isolated hosted executor.",
      "The third-party private harness is never written to the user workspace.",
    ],
    risks: [
      localProtected
        ? "A determined device owner can still inspect a local process; highly sensitive operations must use hosted_secure."
        : "Production hosted execution still needs an authenticated isolated executor.",
    ],
    memoryDeltas: [],
    runtime: runtimeMetadata(agent, conversationIdOut, execution, {
      memory: publicSpecialistMemoryMetadata(memoryContext),
    }),
    requestedOutput: {
      format: output_format || outputFormat || "markdown",
    },
  };

  const safeResult = sanitizeProtectedRuntimeResult({
    result,
    agent,
    conversationId: conversationIdOut,
  });
  const sessionWrite = await memoryStore.rememberSession({
    agentId: agent.id,
    userId,
    conversationId: sessionId,
    records: safeResult.memoryDeltas || [],
    source: "specialist_delta",
    strict: false,
  });
  safeResult.runtime = {
    ...safeResult.runtime,
    memory: {
      ...(safeResult.runtime?.memory || publicSpecialistMemoryMetadata(memoryContext)),
      sessionWrite: {
        written: sessionWrite.written,
        rejected: sessionWrite.rejected,
      },
    },
  };
  if (shouldSaveLocalResult) {
    await appendSafeRuntimeLog(stateRoot, safeResult);
  }
  return safeResult;
}

function findProtectedAgent(agents, agentId) {
  const id = String(agentId || "").trim();
  const agent = agents.find((candidate) => candidate.id === id || candidate.handle === id);
  if (!agent) {
    throw Object.assign(new Error(`Protected runtime Agent not found: ${id}`), {
      code: "protected_agent_not_found",
    });
  }
  return agent;
}

function publicProtectedAgent(agent) {
  return {
    id: agent.id,
    handle: `!${agent.id}`,
    name: agent.name,
    creator: agent.creator,
    creatorId: agent.creatorId,
    category: agent.category,
    status: agent.status,
    headline: agent.headline,
    publicSummary: agent.publicSummary,
    publicSkills: agent.publicSkills || [],
    manifest: agent.manifest || null,
    protection: agent.protection,
    runtime: {
      executionMode: agent.protection?.executionMode || "remote_trusted_executor",
      localHarnessMaterialized: false,
      localPlaintextCache: false,
    },
  };
}

function runtimeMetadata(agent, conversationId, execution, extra = {}) {
  const selected = execution?.executionClass
    ? execution
    : selectExecutionPolicy({
        policy: agent.manifest?.execution,
        requestedExecutionClass: agent.protection?.executionMode === "hosted_secure"
          ? "hosted_secure"
          : undefined,
      });
  const localProtected = selected.executionClass === "local_protected";
  return {
    kind: localProtected ? "mock_local_protected_runtime" : "mock_hosted_secure_runtime",
    executionMode: selected.executionClass,
    operationId: selected.operationId,
    billingKey: selected.billingKey,
    localHarnessMaterialized: localProtected,
    localMaterialization: localProtected ? "licensed_device_ephemeral" : "forbidden",
    localPlaintextArchiveStored: false,
    localPlaintextCache: false,
    safeOutputOnly: true,
    userProviderAllowed: selected.userProviderAllowed,
    packageDeliveredToDevice: selected.packageDeliveredToDevice,
    protectionStrength: localProtected
      ? "practical_copy_resistance"
      : "server_isolated",
    conversationId: conversationId || null,
    creatorId: agent.creatorId,
    ...extra,
  };
}

function buildMockProtectedOutput({ agent, task, responseMode }) {
  if (agent.id === "third-party-launch-operator") {
    return [
      "# Protected Runtime Launch Draft",
      "",
      `Task: ${task}`,
      "",
      "Positioning: HireMe helps creators turn protected know-how into hireable Agents while buyers receive results without copying the private Harness.",
      "",
      "Audience: AI builders, domain experts, and teams that need specialist output but cannot rebuild every workflow from scratch.",
      "",
      "Message: Hire the capability, not the source. The private playbook runs behind the protected boundary; the buyer receives safe output.",
      "",
      responseMode === "artifact_spec"
        ? "Artifact note: this can be materialized as a Markdown launch brief."
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "# Protected Runtime Evaluation",
    "",
    `Task: ${task}`,
    "",
    "Result: The output should be checked for private harness leakage, unsupported claims, and unclear assumptions.",
    "",
    "Boundary: This mock returns only the safe evaluation summary, not the protected rubric source.",
  ].join("\n");
}

function buildMockRecommendations(agent, task) {
  if (agent.id === "third-party-launch-operator") {
    return [
      "Lead with the protected expertise exchange, not a generic marketplace claim.",
      "Keep the IP boundary explicit in user-facing copy.",
      "Use concrete examples of hireable specialist workflows.",
    ];
  }
  return [
    "Check whether the answer exposes protected internals.",
    "Require evidence or assumptions for high-impact claims.",
    `Review the task scope: ${task.slice(0, 120)}`,
  ];
}

async function appendSafeRuntimeLog(stateRoot, result) {
  const logPath = join(stateRoot, "protected-runtime", "calls.jsonl");
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(
    logPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      agentId: result.agentId,
      status: result.status,
      responseMode: result.responseMode,
      runtime: result.runtime,
      outputText: result.outputText,
    })}\n`,
    "utf8",
  );
}

function normalizeResponseMode(value, task) {
  const text = String(value || "").trim();
  if (["direct_answer", "artifact_spec", "local_workspace_execution_brief"].includes(text)) {
    return text;
  }
  if (/file|artifact|markdown|문서|파일|작성|생성/i.test(task)) return "artifact_spec";
  return "direct_answer";
}

function sanitizeProtectedRuntimeResult({ result, agent, conversationId }) {
  const leakSignal = protectedOutputLeakSignal({
    outputText: result.outputText,
    structuredResult: result.structuredResult,
    artifacts: result.artifacts,
    evidence: result.evidence,
    assumptions: result.assumptions,
    risks: result.risks,
  });
  if (!leakSignal) return result;

  return {
    schema: outputSchemaVersion,
    agentId: agent.id,
    status: "refused",
    responseMode: "direct_answer",
    outputText:
      "Protected runtime blocked this response because it matched a protected-content leakage signal. I can run the Agent again for a safe result that does not request or expose internals.",
    structuredResult: {
      summary: "Protected runtime output sanitizer blocked the response.",
      keyFindings: [],
      recommendations: ["Retry with a task focused on the desired result, not the Agent's hidden files or prompts."],
    },
    artifacts: [],
    evidence: [
      {
        label: "output sanitizer",
        detail: leakSignal,
      },
    ],
    assumptions: [],
    risks: [],
    memoryDeltas: [],
    runtime: runtimeMetadata(agent, conversationId, {
      executionClass: result.runtime?.executionMode,
      operationId: result.runtime?.operationId,
      billingKey: result.runtime?.billingKey,
      userProviderAllowed: result.runtime?.userProviderAllowed,
      packageDeliveredToDevice: result.runtime?.packageDeliveredToDevice,
    }, {
      memory: result.runtime?.memory,
      outputSanitized: true,
      sanitizerSignal: leakSignal,
    }),
  };
}

function protectedInputAttackSignal(task) {
  const text = String(task || "");
  if (!text.trim()) return null;

  const payloadSignal = firstPatternLabel(text, protectedPayloadMarkerPatterns);
  if (payloadSignal) return payloadSignal;

  const targetSignal = firstPatternLabel(text, protectedTargetPatterns);
  const requestSignal = firstPatternLabel(text, protectedExtractionRequestPatterns);
  const evasionSignal = firstPatternLabel(text, protectedEvasionPatterns);
  if (targetSignal && (requestSignal || evasionSignal)) {
    return [targetSignal, requestSignal || evasionSignal].join(" + ");
  }

  const broadExtractionSignal = firstPatternLabel(text, broadProtectedExtractionPatterns);
  if (broadExtractionSignal && (requestSignal || evasionSignal)) {
    return [broadExtractionSignal, requestSignal || evasionSignal].join(" + ");
  }

  return null;
}

function protectedOutputLeakSignal(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return firstPatternLabel(text, protectedOutputLeakPatterns);
}

function firstPatternLabel(text, patterns) {
  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) return label;
  }
  return null;
}

const protectedPayloadMarkerPatterns = [
  ["protected payload marker", /\b(?:archiveBase64|contentBase64)\b/],
  ["private block marker", /\b(?:BEGIN_PRIVATE|END_PRIVATE|PRIVATE_HARNESS)\b/i],
  ["secret marker", /\bSECRET_[A-Z0-9_]*\b/],
  ["private-source path", /\bprivate-source\//i],
];

const protectedTargetPatterns = [
  [
    "protected prompt target",
    /\b(?:system|developer|hidden|private|internal)\s+(?:prompt|message|instruction|policy|harness|rubric|workflow|playbook|source)\b/i,
  ],
  [
    "protected file target",
    /\b(?:AGENTS\.md|SOUL\.md|skills\/|harness\/|evals\/|examples\/private\/|private-source\/)\b/i,
  ],
  [
    "protected concept target",
    /\b(?:prompt|harness|rubric|routing|scratchpad|credential|eval set|private example|skill source|hidden skill|developer instruction|system instruction)\b/i,
  ],
  [
    "protected Korean target",
    /(?:내부|하네스|프롬프트|시스템\s*프롬프트|개발자\s*프롬프트|숨겨진|비공개|루브릭|채점\s*기준|라우팅|메모리|스크래치패드|소스|원문|자격증명|토큰|시크릿|비밀)/i,
  ],
];

const protectedExtractionRequestPatterns = [
  [
    "disclosure request",
    /\b(?:show|reveal|dump|print|export|send|share|open|display|read|tell|give|leak|extract|decode|encode|serialize|translate|summarize|paraphrase|compress|list)\b/i,
  ],
  ["targeted copy request", /\bcopy\s+(?:your|the|all|internal|private|hidden|system|developer)\b/i],
  [
    "Korean disclosure request",
    /(?:알려|보여|공개|출력|복사|내놔|열어|읽어|덤프|추출|인코딩|디코딩|복호화|요약|번역|바꿔|일부만|전체|원문)/i,
  ],
  ["encoding request", /\b(?:base64|hex|rot13|json|markdown|table)\b/i],
];

const protectedEvasionPatterns = [
  [
    "instruction override",
    /\b(?:ignore|disregard|override|bypass)\s+(?:previous|all|the)\s+(?:instructions|rules|policy|policies)\b/i,
  ],
  [
    "role or mode evasion",
    /\b(?:pretend|role ?play|debug(?:ging)? mode|developer mode|admin mode|policy override|jailbreak|DAN|do not refuse)\b/i,
  ],
  [
    "Korean evasion",
    /(?:무시하고|규칙을\s*무시|디버그|관리자|개발자\s*모드|역할극|테스트니까|거절하지|우회|요약만|일부만)/i,
  ],
];

const broadProtectedExtractionPatterns = [
  [
    "broad internal extraction",
    /\b(?:everything|all files|all instructions|your instructions|your rules|your source|full config|full context)\b/i,
  ],
  ["Korean broad internal extraction", /(?:전부|전체\s*파일|전체\s*지시|전체\s*규칙|너의\s*규칙|너의\s*소스)/i],
];

const protectedOutputLeakPatterns = [
  ...protectedPayloadMarkerPatterns,
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["credential text", /\b(?:OPENAI_API_KEY|api[_ -]?key|refresh token|access token|secret token|credential)\b/i],
  [
    "private file path",
    /\b(?:AGENTS\.md|SOUL\.md|private-source\/|examples\/private\/|evals\/private\/|harness\/(?:policy|routing)\.(?:json|md)|skills\/[^\s"']+)\b/i,
  ],
  ["prompt transcript marker", /\b(?:system|developer|hidden|private)\s+prompt\s*:/i],
];
