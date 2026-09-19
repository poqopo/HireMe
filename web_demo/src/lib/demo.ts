export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  author: string;
  price: number;
  color: "green" | "purple" | "blue" | "orange" | "pink";
  icon: "search" | "structure" | "write" | "code" | "chart" | "translate";
  category: string;
  githubUrl?: string;
  serverUrl?: string;
  hostedUrl?: string;
  existingServer?: boolean;
  registryManaged?: boolean;
  pricePer100M?: number;
  status?: "ready" | "pending";
};
export const agents: Agent[] = [
  {
    id: "research",
    name: "Paper Research",
    role: "Researcher",
    description: "질문에 맞는 논문과 자료를 찾아 핵심 정보를 수집합니다.",
    author: "open-research",
    price: 0.02,
    color: "green",
    icon: "search",
    category: "리서치",
  },
  {
    id: "evidence",
    name: "Evidence Structurer",
    role: "Analyst",
    description: "수집한 자료를 분석하고 근거를 구조화합니다.",
    author: "data-lab",
    price: 0,
    color: "purple",
    icon: "structure",
    category: "리서치",
  },
  {
    id: "writer",
    name: "Report Writer",
    role: "Writer",
    description: "근거를 바탕으로 읽기 쉬운 리서치 브리프를 작성합니다.",
    author: "studio-ai",
    price: 0.01,
    color: "blue",
    icon: "write",
    category: "콘텐츠",
  },
  {
    id: "code",
    name: "Code Reviewer",
    role: "Developer",
    description: "코드 품질, 잠재적인 오류와 개선 사항을 검토합니다.",
    author: "dev-tools",
    price: 0.015,
    color: "orange",
    icon: "code",
    category: "개발",
  },
  {
    id: "data",
    name: "Data Analyst",
    role: "Analyst",
    description: "데이터의 패턴을 파악하고 실행 가능한 인사이트를 정리합니다.",
    author: "insight-lab",
    price: 0.01,
    color: "pink",
    icon: "chart",
    category: "리서치",
  },
  {
    id: "translate",
    name: "Translator",
    role: "Translator",
    description: "내용의 맥락을 유지하며 자연스러운 한국어로 번역합니다.",
    author: "global-ai",
    price: 0,
    color: "green",
    icon: "translate",
    category: "콘텐츠",
  },
];
export const suggestions = [
  {
    label: "AI 에이전트 트렌드",
    prompt: "AI 에이전트 시장의 주요 트렌드와 앞으로의 가능성을 정리해줘.",
    type: "research",
  },
  {
    label: "코드 리뷰",
    prompt:
      "아래 코드의 품질과 개선점을 검토해줘.\n\nfunction sum(items) { return items.reduce((a, b) => a + b, 0); }",
    type: "code",
  },
  {
    label: "리서치 브리프",
    prompt:
      "멀티 에이전트 협업의 장점과 도입 시 고려할 점을 리서치 브리프로 작성해줘.",
    type: "research",
  },
];
export type Receipt = {
  id: string;
  name: string;
  price: number;
  duration: number;
  summary: string;
  html?: string;
  data?: unknown;
};
export type DemoResult = {
  task: string;
  title: string;
  intro: string;
  points: { title: string; text: string }[];
  conclusion: string;
  html?: string;
  data?: unknown;
  receipts: Receipt[];
  cost: number;
  createdAt: string;
  runId: string;
  chainSettlement?: ChainSettlement;
};
export type ChainSettlement = {
  status: string;
  runId: string;
  transactionDigest?: string;
  traceHash?: string;
  usages?: { agentId: string; outputTokens: number; metering: string }[];
};
export type RuntimeStep = {
  agentId: string;
  agentName: string;
  selectedTool: string;
  selectedPrompt: string;
  output: { summary?: string; html?: string; [key: string]: unknown };
  duration: number;
  price: number;
};
export type RuntimeRun = {
  runId: string;
  status: "succeeded";
  result: Pick<
    DemoResult,
    "task" | "title" | "intro" | "points" | "conclusion" | "html" | "data"
  >;
  steps: RuntimeStep[];
  cost: number;
  chainSettlement?: ChainSettlement;
};
export type RuntimeStepEvent = {
  type:
    | "step.started"
    | "step.completed"
    | "step.failed"
    | "workflow.completed"
    | "workflow.failed";
  agentId?: string;
  agentName?: string;
  step?: RuntimeStep;
  result?: RuntimeRun;
  error?: string;
};
export function receiptFromRuntimeStep(step: RuntimeStep): Receipt {
  return {
    id: step.agentId,
    name: step.agentName,
    price: step.price,
    duration: step.duration,
    summary: `${step.output.summary ?? "구조화된 결과를 받았습니다."} · ${step.selectedTool} / ${step.selectedPrompt}`,
    html: typeof step.output.html === "string" ? step.output.html : undefined,
    data: step.output.data ?? step.output.toolResult,
  };
}
export function resultFromRuntime(run: RuntimeRun): DemoResult {
  const receipts = run.steps.map(receiptFromRuntimeStep);
  return {
    ...run.result,
    receipts,
    cost: run.cost,
    createdAt: new Date().toLocaleString("ko-KR"),
    runId: run.runId,
    chainSettlement: run.chainSettlement,
  };
}
export function stepSummary(agent: Agent) {
  const summaries: Record<string, string> = {
    research: "예시 자료 6건을 수집하고 관련 주제를 분류했습니다.",
    evidence: "수집된 내용을 핵심 근거 3개로 구조화했습니다.",
    writer: "구조화된 내용을 리서치 브리프로 정리했습니다.",
    code: "입력값 처리, 타입 안정성, 예외 상황을 검토했습니다.",
    data: "비교 지표와 해석 시 주의점을 정리했습니다.",
    translate: "전달받은 내용을 한국어로 정리했습니다.",
  };
  return summaries[agent.id];
}
export function makeResult(
  task: string,
  receipts: Receipt[],
  runId: string,
): DemoResult {
  const isCode = receipts.some((r) => r.id === "code");
  const isMarket = /시장|트렌드/.test(task);
  const title = isCode
    ? "코드 검토 브리프"
    : isMarket
      ? "AI 에이전트 시장 리서치"
      : "멀티 에이전트 협업 브리프";
  const points = isCode
    ? [
        {
          title: "입력과 타입을 먼저 확인하세요",
          text: "배열 여부와 원소의 타입을 검증하세요. 숫자가 아닌 값이 들어오면 덧셈 결과가 의도와 달라질 수 있습니다.",
        },
        {
          title: "예외 상황을 명확히 정의하세요",
          text: "빈 배열, null, undefined 등 경계 조건에서 어떤 값을 반환할지 정하고 호출하는 쪽에 계약을 전달하세요.",
        },
        {
          title: "작은 함수에도 의미 있는 검증을",
          text: "정상 입력과 잘못된 입력을 함께 검증하고, 사용 목적에 맞는 타입과 문서화를 추가하세요.",
        },
      ]
    : [
        {
          title: isMarket
            ? "단일 도구에서 협업하는 팀으로"
            : "역할 분담이 결과의 품질을 높입니다",
          text: "자료 수집, 근거 정리, 보고서 작성처럼 작업을 역할별로 나누면 각 단계의 입력과 결과를 더 명확하게 검토할 수 있습니다.",
        },
        {
          title: "표준 인터페이스가 연결을 단순하게",
          text: "서로 다른 환경에서 만든 에이전트도 공통 입력·출력 규격을 사용하면 하나의 워크플로로 연결할 수 있습니다.",
        },
        {
          title: "실행 과정과 비용의 투명성",
          text: "에이전트별 실행 상태와 성공한 호출의 비용을 함께 확인하면 결과가 만들어진 과정을 이해하고 활용 여부를 판단하기 쉽습니다.",
        },
      ];
  return {
    task,
    title,
    intro: `요청하신 “${task.length > 90 ? task.slice(0, 90) + "…" : task}”에 대해 선택한 ${receipts.length}개 에이전트의 예시 워크플로를 실행했습니다. 아래 내용은 체험용 템플릿이며 실제 검색·AI 추론 결과가 아닙니다.`,
    points,
    conclusion: isCode
      ? "실제 저장소와 실행 환경을 함께 검토하면 더 정확한 피드백을 얻을 수 있습니다. 이 데모는 임의 코드의 실제 분석을 수행하지 않습니다."
      : "작은 워크플로부터 시작하고, 각 에이전트의 결과를 확인하며 팀을 확장하세요. 위 내용은 제품 체험을 위한 예시이며 외부 자료 검색은 수행하지 않았습니다.",
    receipts,
    cost: receipts.reduce((s, r) => s + r.price, 0),
    createdAt: new Date().toLocaleString("ko-KR"),
    runId,
  };
}
export function resultMarkdown(result: DemoResult) {
  return `# ${result.title}\n\n> HireMe 시뮬레이션 · 실제 검색 및 AI 추론 미연결\n\n## 요청\n${result.task}\n\n${result.intro}\n\n${result.points.map((p, i) => `## ${i + 1}. ${p.title}\n${p.text}`).join("\n\n")}\n\n## 정리\n${result.conclusion}\n\n## 실행 내역\n${result.receipts.map((r) => `- ${r.name}: ${r.price ? r.price.toFixed(3) + " Test USDC" : "무료"} · ${(r.duration / 1000).toFixed(1)}s`).join("\n")}\n\n예시 비용: ${result.cost.toFixed(3)} Test USDC (실제 결제 없음)\n실행 ID: ${result.runId}\n`;
}
