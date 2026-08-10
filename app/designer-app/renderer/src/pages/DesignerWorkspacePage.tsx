import {
  ArrowUpRight,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Copy,
  Cpu,
  DollarSign,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Info,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Palette,
  Paperclip,
  PenLine,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Target,
  TrendingUp,
  Trash2,
  Upload,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ViewId = "studio" | "chat" | "discover" | "agents" | "earnings" | "review";
type AgentCategory = "디자인" | "글쓰기" | "비즈니스" | "리서치" | "생산성";
type BillingMode = "run" | "subscription" | "hybrid";
type AgentOwnership = "mine" | "market";
type WorkScope = "created" | "hired";

type AgentHarness = {
  role: string;
  workflow: string;
};

type AgentMemory = {
  bootstrap: string;
  session: boolean;
  user: boolean;
};

type AgentAuthoringState = {
  phase: string;
  revision: number;
  packagePath?: string;
  packageDigest?: string;
};

type DesignQuestionKind = "single" | "multi" | "short" | "long";

type DesignQuestion = {
  id: string;
  label: string;
  helper?: string;
  kind: DesignQuestionKind;
  required: boolean;
  options?: string[];
};

type DesignDecisionSystem = {
  purpose: string;
  priorities: string[];
  avoid: string[];
  qualityBar: string[];
  questions: DesignQuestion[];
  priorityCount?: number;
  qualityBarCount?: number;
};

type Agent = {
  databaseId?: string;
  id: string;
  name: string;
  creator: string;
  category: AgentCategory;
  headline: string;
  summary: string;
  skills: string[];
  resultTypes: string[];
  outputExamples?: AgentOutputExample[];
  image?: string;
  accent: "green" | "coral" | "blue" | "yellow" | "violet" | "charcoal";
  rating: number;
  reviews: number;
  uses: number;
  billingMode: BillingMode;
  runPrice?: number;
  subscriptionPrice?: number;
  version: string;
  ownership: AgentOwnership;
  status: "공개" | "검토 중" | "초안";
  revenue30d?: number;
  subscribers?: number;
  runtime: "local" | "protected" | "preview";
  hired?: boolean;
  source?: "database" | "local";
  harness?: AgentHarness;
  memory?: AgentMemory;
  authoring?: AgentAuthoringState;
  designSystem?: DesignDecisionSystem;
};

type Attachment = {
  name: string;
  path?: string;
  size?: number;
  mimeType?: string;
  previewUrl?: string;
  kind?: string;
  storageKey?: string;
};

type AgentOutputExample = Attachment & {
  description?: string;
  previewText?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  status?: "queued" | "sent" | "failed" | "cancelled";
  elapsedMs?: number;
  attachments?: Attachment[];
  artifacts?: Attachment[];
  streaming?: boolean;
  retry?: { text: string; attachments: Attachment[] };
};

type Conversation = {
  id: string;
  title: string;
  agentId: string;
  updatedAt: string;
  messages: ChatMessage[];
  archived?: boolean;
  storage?: "database" | "local";
  provider?: string | null;
  model?: string | null;
  mode?: "work" | "agent_authoring";
};

type RunState = {
  runId: string;
  startedAt: number;
  steps: string[];
  image?: boolean;
};

type QueuedRequest = {
  messageId: string;
  text: string;
  attachments: Attachment[];
  at: string;
  kind?: "draft_output";
};

type DesignProjectRequest = {
  agentId: string;
  brief: string;
  diagnosis: { channel: string; assets: string; goal: string };
  deliveryMode: "instant" | "reviewed" | "custom";
  attachments: Attachment[];
};

type ToastState = {
  id: number;
  title: string;
  detail?: string;
};

type ModalState =
  | { type: "new-chat"; scope: WorkScope }
  | { type: "new-agent" }
  | { type: "delete-agent"; agentId: string }
  | { type: "agent-profile"; agentId: string }
  | { type: "edit-agent"; agentId: string }
  | { type: "delete-conversation"; conversationId: string }
  | null;

const outputExampleCatalog: Record<string, AgentOutputExample[]> = {
  "dokpami-create-agent": [
    {
      name: "dokpami-sad-result.png",
      mimeType: "image/png",
      size: 1_842_000,
      previewUrl: "/assets/after/dokpami-result-preview.png",
      description: "원본 캐릭터의 인상을 유지해 완성한 최종 PNG",
    },
    {
      name: "dokpami-delivery-notes.md",
      mimeType: "text/markdown",
      size: 1_284,
      description: "제작 방향과 재사용 시 주의점을 정리한 전달 문서",
      previewText: [
        "# 독팜희 캐릭터 전달 노트",
        "",
        "## 적용한 변화",
        "- 고개를 살짝 숙인 자세와 눈가의 물기를 추가했습니다.",
        "- 얼굴 비율, 귀 실루엣, 대표 색상은 원본 기준을 유지했습니다.",
        "- 흐린 창가 조명으로 장면의 감정을 보강했습니다.",
        "",
        "## 재사용 기준",
        "프로필 이미지로 사용할 때는 얼굴과 귀가 잘리지 않도록 중앙 70% 영역을 유지하세요.",
      ].join("\n"),
    },
  ],
  "launch-brief-specialist": [
    {
      name: "launch-brief.md",
      mimeType: "text/markdown",
      size: 4_920,
      description: "목표 고객, 메시지, 채널과 일정을 한 문서로 정리한 출시 브리프",
      previewText: [
        "# 프리랜서 협업 도구 출시 브리프",
        "",
        "## 핵심 고객",
        "반복적인 제안서·수정 요청 관리에 시간을 쓰는 1~5인 디자인 스튜디오",
        "",
        "## 출시 메시지",
        "반복 업무는 에이전트에게 맡기고, 최종 판단에 집중하세요.",
        "",
        "## 첫 2주 실행",
        "1. 기존 고객 10명에게 비공개 데모 제공",
        "2. 작업 전후 시간을 측정해 대표 사례 3개 확보",
        "3. 사례 기반 소개 페이지와 온보딩 메일 공개",
      ].join("\n"),
    },
    {
      name: "launch-checklist.csv",
      mimeType: "text/csv",
      size: 1_176,
      description: "담당자와 완료 기준이 포함된 실행 체크리스트",
      previewText: [
        "단계,작업,담당,완료 기준",
        "검증,핵심 고객 인터뷰,PM,10명 응답 확보",
        "제작,대표 사례 정리,Designer,전후 비교 3건",
        "배포,온보딩 메일 발송,Marketing,오픈율 45% 이상",
      ].join("\n"),
    },
  ],
  "brand-voice-editor": [
    {
      name: "campaign-copy-set.md",
      mimeType: "text/markdown",
      size: 3_840,
      description: "랜딩 페이지와 SNS에 바로 적용할 수 있는 카피 세트",
      previewText: [
        "# 캠페인 카피 세트",
        "",
        "## 헤드라인",
        "일은 맡기고, 결과만 확인하세요.",
        "",
        "## 소개 문장",
        "필요한 전문가를 에이전트로 고용해 반복 작업을 맡기고 중요한 결정에 집중하세요.",
        "",
        "## CTA",
        "내 일을 맡길 에이전트 찾기",
      ].join("\n"),
    },
    {
      name: "brand-tone-guide.txt",
      mimeType: "text/plain",
      size: 1_420,
      description: "이후 문구에도 일관되게 적용할 말투 기준",
      previewText: "간결하게 말합니다.\n과장보다 실제 변화를 먼저 보여줍니다.\n전문 용어가 필요하면 바로 다음 문장에서 쉬운 말로 풉니다.\n명령보다 선택 가능한 다음 행동을 제안합니다.",
    },
  ],
  "proposal-writer": [
    {
      name: "client-proposal.md",
      mimeType: "text/markdown",
      size: 6_280,
      description: "작업 범위, 일정과 인수 기준이 포함된 고객 제안서",
      previewText: [
        "# 브랜드 리뉴얼 제안서",
        "",
        "## 목표",
        "신규 고객이 서비스의 차이를 10초 안에 이해할 수 있는 브랜드 체계를 구축합니다.",
        "",
        "## 산출물",
        "- 핵심 메시지 체계 1식",
        "- 로고 활용 가이드 PDF",
        "- 웹 핵심 화면 5종",
        "",
        "## 일정",
        "총 4주, 주 1회 중간 검토를 기준으로 진행합니다.",
      ].join("\n"),
    },
    {
      name: "scope-estimate.csv",
      mimeType: "text/csv",
      size: 980,
      description: "산출물별 작업량과 가정을 분리한 견적 근거",
      previewText: "항목,수량,예상일,포함 범위\n메시지 체계,1식,3일,핵심 문장과 보조 문장\n웹 화면,5종,8일,데스크톱 기준\n수정,2회,4일,합의된 범위 내",
    },
  ],
  "morrow-visual-review-service": [
    {
      name: "annotated-visual-review.jpg",
      mimeType: "image/jpeg",
      size: 946_000,
      previewUrl: "/assets/after/TalkMedia_i_992129d3c2e9.jpg.jpg",
      description: "수정 위치와 우선순위를 표시한 주석 이미지",
    },
    {
      name: "visual-feedback.md",
      mimeType: "text/markdown",
      size: 2_740,
      description: "디자이너가 바로 반영할 수 있도록 정리한 수정 지시서",
      previewText: "# 시안 피드백\n\n## 우선순위 1\n주요 CTA와 보조 CTA의 명암 차이를 키워 첫 행동을 분명히 합니다.\n\n## 우선순위 2\n제목과 본문 사이 여백을 8px 늘려 정보 그룹을 분리합니다.\n\n## 유지할 점\n제품 이미지의 크기와 좌우 정렬 기준은 현재 시안이 적절합니다.",
    },
  ],
  "scope-risk-checker": [
    {
      name: "scope-risk-report.md",
      mimeType: "text/markdown",
      size: 3_120,
      description: "계약 전에 합의해야 할 위험과 권장 문구를 정리한 보고서",
      previewText: "# 작업 범위 리스크 보고서\n\n## 높음: 수정 횟수 미정\n현재 문구는 완료 기준이 없어 일정이 늘어날 수 있습니다.\n권장: 초안 전달 후 통합 피드백 2회를 포함합니다.\n\n## 중간: 원본 파일 인도 범위\n편집 가능한 원본과 사용 폰트의 제공 여부를 계약서에 명시하세요.",
    },
    {
      name: "client-questions.txt",
      mimeType: "text/plain",
      size: 760,
      description: "착수 전에 고객에게 확인할 질문 목록",
      previewText: "1. 최종 승인 권한을 가진 담당자는 누구인가요?\n2. 수정 요청은 어떤 채널로 취합하나요?\n3. 납품 후 원본 파일과 라이선스도 필요한가요?\n4. 일정이 지연될 때 우선 제외할 산출물은 무엇인가요?",
    },
  ],
};

const defaultDesignSystem = (): DesignDecisionSystem => ({
  purpose: "브랜드의 신뢰를 지키면서 핵심 메시지가 빠르게 읽히는 결과를 만듭니다.",
  priorities: [
    "핵심 메시지가 3초 안에 읽혀야 합니다.",
    "제품 이미지와 문장이 서로 경쟁하지 않아야 합니다.",
  ],
  avoid: [
    "브랜드 인상과 맞지 않는 장식 요소",
    "한 화면에 너무 많은 메시지",
  ],
  qualityBar: [
    "정보의 우선순위가 한눈에 구분됩니다.",
    "지정된 브랜드 자산과 금지 규칙을 지킵니다.",
  ],
  questions: [
    {
      id: "goal",
      label: "이번 결과로 가장 먼저 만들고 싶은 반응은 무엇인가요?",
      helper: "디자이너가 정의한 목적 중 하나를 선택해 주세요.",
      kind: "single",
      required: true,
      options: ["신뢰를 쌓기", "즉시 행동 유도", "프리미엄 인상 강화"],
    },
    {
      id: "message",
      label: "사용자가 가장 먼저 읽어야 할 한 문장은 무엇인가요?",
      kind: "short",
      required: true,
    },
    {
      id: "channel",
      label: "결과를 어디에 사용할 예정인가요?",
      kind: "multi",
      required: true,
      options: ["Instagram 피드", "Instagram 스토리", "웹 배너", "프레젠테이션"],
    },
    {
      id: "context",
      label: "꼭 반영하거나 피해야 할 맥락이 있나요?",
      helper: "없다면 비워 두어도 괜찮습니다.",
      kind: "long",
      required: false,
    },
  ],
});

const seedAgents: Agent[] = [
  {
    id: "dokpami-create-agent",
    name: "독팜희 캐릭터 메이커",
    creator: "나",
    category: "디자인",
    headline: "원본의 인상을 지키며 캐릭터 변형 이미지를 만들어요",
    summary:
      "참고 이미지를 바탕으로 표정, 의상, 장면을 바꾸고 결과 PNG를 전달하는 캐릭터 제작 에이전트입니다.",
    skills: ["캐릭터 디자인", "이미지 생성", "스타일 유지"],
    resultTypes: ["PNG", "이미지 기획서"],
    image: "/assets/after/dokpami-result-preview.png",
    accent: "green",
    rating: 4.9,
    reviews: 128,
    uses: 2431,
    billingMode: "hybrid",
    runPrice: 1900,
    subscriptionPrice: 29000,
    version: "1.4.2",
    ownership: "mine",
    status: "공개",
    revenue30d: 842000,
    subscribers: 34,
    runtime: "local",
    designSystem: {
      purpose: "원본 캐릭터의 정체성을 지키면서 요청한 감정과 장면을 명확하게 전달합니다.",
      priorities: ["얼굴 비율과 실루엣을 먼저 보존합니다.", "테마는 의상·표정·소품으로만 확장합니다."],
      avoid: ["새로운 종이나 사람 형태로 재해석", "원본보다 복잡한 장식과 배경"],
      qualityBar: ["원본과 같은 캐릭터로 즉시 인식됩니다.", "요청한 감정이 표정과 자세에서 읽힙니다."],
      questions: [
        {
          id: "emotion",
          label: "어떤 감정이 가장 먼저 보여야 하나요?",
          kind: "single",
          required: true,
          options: ["기쁨", "슬픔", "긴장", "설렘"],
        },
        {
          id: "scene",
          label: "캐릭터가 어떤 장면에 있나요?",
          helper: "장소와 상황을 한 문장으로 적어 주세요.",
          kind: "short",
          required: true,
        },
        {
          id: "use",
          label: "완성된 이미지를 어디에 사용할 예정인가요?",
          kind: "multi",
          required: true,
          options: ["프로필", "SNS 게시물", "스티커", "프레젠테이션"],
        },
      ],
    },
  },
  {
    id: "launch-brief-specialist",
    name: "런칭 브리프 스페셜리스트",
    creator: "나",
    category: "비즈니스",
    headline: "아이디어를 실행 가능한 출시 계획으로 정리해요",
    summary:
      "고객, 핵심 메시지, 채널, 리스크를 빠르게 구조화해 제안서와 실행 브리프로 만듭니다.",
    skills: ["포지셔닝", "출시 계획", "제안서"],
    resultTypes: ["문서", "실행 체크리스트"],
    image: "/assets/after/TalkMedia_i_a3f06a7d329f.jpg.jpg",
    accent: "coral",
    rating: 4.8,
    reviews: 84,
    uses: 1394,
    billingMode: "run",
    runPrice: 900,
    version: "0.9.8",
    ownership: "mine",
    status: "공개",
    revenue30d: 486000,
    subscribers: 0,
    runtime: "local",
  },
  {
    id: "brand-voice-editor",
    name: "브랜드 보이스 에디터",
    creator: "Studio Plain",
    category: "글쓰기",
    headline: "내 브랜드 말투로 소개문과 캠페인 카피를 다듬어요",
    summary:
      "기존 포트폴리오와 브랜드 문서를 읽고 일관된 어조로 소개문, 광고 카피, SNS 문장을 작성합니다.",
    skills: ["브랜드 카피", "톤앤매너", "교정"],
    resultTypes: ["문서", "카피 세트"],
    image: "/assets/after/TalkMedia_i_c2e84200e6f5.jpg.jpg",
    accent: "blue",
    rating: 4.9,
    reviews: 392,
    uses: 8120,
    billingMode: "subscription",
    subscriptionPrice: 24000,
    version: "2.3.0",
    ownership: "market",
    status: "공개",
    runtime: "preview",
    hired: true,
  },
  {
    id: "proposal-writer",
    name: "외주 제안서 라이터",
    creator: "Freelance Lab",
    category: "비즈니스",
    headline: "의뢰 내용을 분석해 설득력 있는 견적·제안서를 만들어요",
    summary:
      "고객 요청과 작업 범위를 비교해 일정, 산출물, 가정, 견적 근거가 분명한 제안서를 작성합니다.",
    skills: ["제안서", "업무 범위", "견적 문구"],
    resultTypes: ["제안서", "PDF 초안"],
    image: "/assets/after/TalkMedia_i_d8524efc8c6d.jpg.jpg",
    accent: "yellow",
    rating: 4.7,
    reviews: 211,
    uses: 4672,
    billingMode: "run",
    runPrice: 700,
    version: "1.8.1",
    ownership: "market",
    status: "공개",
    runtime: "preview",
  },
  {
    id: "morrow-visual-review-service",
    name: "비주얼 피드백 디렉터",
    creator: "Morrow Design",
    category: "디자인",
    headline: "시안을 보고 우선순위가 분명한 수정 피드백을 정리해요",
    summary:
      "브랜드 목적, 정보 위계, 사용 맥락을 기준으로 시안을 검토하고 디자이너가 바로 반영할 수 있게 제안합니다.",
    skills: ["디자인 리뷰", "정보 위계", "수정 가이드"],
    resultTypes: ["피드백 문서", "주석 이미지"],
    image: "/assets/after/TalkMedia_i_992129d3c2e9.jpg.jpg",
    accent: "violet",
    rating: 4.8,
    reviews: 174,
    uses: 3591,
    billingMode: "hybrid",
    runPrice: 1200,
    subscriptionPrice: 32000,
    version: "1.2.4",
    ownership: "market",
    status: "공개",
    runtime: "preview",
    designSystem: {
      purpose: "브랜드 목적과 사용 맥락을 기준으로 수정 우선순위가 분명한 피드백을 전달합니다.",
      priorities: ["행동을 만드는 정보 위계를 먼저 봅니다.", "장식보다 가독성과 맥락 적합성을 우선합니다."],
      avoid: ["취향만으로 내리는 피드백", "근거 없이 전체 스타일을 다시 만드는 제안"],
      qualityBar: ["수정 우선순위와 이유가 함께 제시됩니다.", "유지할 요소와 바꿀 요소가 구분됩니다."],
      questions: [
        {
          id: "goal",
          label: "이 시안이 달성해야 하는 가장 중요한 목표는 무엇인가요?",
          kind: "single",
          required: true,
          options: ["클릭·구매 유도", "정보 전달", "브랜드 신뢰 강화", "새로운 인상 만들기"],
        },
        {
          id: "audience",
          label: "이 결과를 가장 먼저 보게 될 사람은 누구인가요?",
          kind: "short",
          required: true,
        },
        {
          id: "concern",
          label: "현재 가장 고민되는 부분은 무엇인가요?",
          kind: "multi",
          required: true,
          options: ["정보 위계", "가독성", "브랜드 일관성", "이미지 톤", "CTA"],
        },
        {
          id: "keep",
          label: "이번 수정에서도 반드시 유지해야 할 요소가 있나요?",
          kind: "long",
          required: false,
        },
      ],
    },
  },
  {
    id: "scope-risk-checker",
    name: "작업 범위 리스크 체커",
    creator: "Contract Works",
    category: "생산성",
    headline: "계약 전 빠진 범위와 애매한 수정 조건을 찾아요",
    summary:
      "의뢰서와 계약서에서 일정 지연, 무제한 수정, 저작권, 인수 기준처럼 분쟁이 되기 쉬운 항목을 점검합니다.",
    skills: ["범위 검수", "리스크 점검", "체크리스트"],
    resultTypes: ["리스크 표", "질문 목록"],
    accent: "charcoal",
    rating: 4.6,
    reviews: 98,
    uses: 2107,
    billingMode: "subscription",
    subscriptionPrice: 19000,
    version: "1.0.6",
    ownership: "market",
    status: "공개",
    runtime: "preview",
  },
];

const legacyMockAgentIds = new Set([
  "launch-brief-specialist",
  "brand-voice-editor",
  "proposal-writer",
  "visual-feedback-director",
  "scope-risk-checker",
  "friendly-empathy-listener",
]);

// Demo records are available only when a developer explicitly enables them.
// Production installs always start without another person's agent or history.
const bundledDemoContentEnabled =
  import.meta.env.DEV && import.meta.env.VITE_HIREME_DEMO_CONTENT === "true";

const seedConversations: Conversation[] = [
  {
    id: "chat-dokpami-breakup",
    title: "슬퍼하는 독팜희 시안",
    agentId: "dokpami-create-agent",
    updatedAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    messages: [
      {
        id: "m1",
        role: "user",
        text: "헤어진 뒤 창가에서 슬퍼하고 있는 독팜희를 그려줘. 원본 느낌은 유지해줘.",
        at: new Date(Date.now() - 1000 * 60 * 13).toISOString(),
        status: "sent",
        attachments: [
          {
            name: "dokpami-reference.png",
            mimeType: "image/png",
            previewUrl: "/assets/before/TalkMedia_i_9d68a183fdb2.png.png",
          },
        ],
      },
      {
        id: "m2",
        role: "assistant",
        text: "원본 캐릭터의 얼굴 비율과 실루엣을 유지하고, 고개를 살짝 숙인 표정과 흐린 창가 장면으로 구성했어요. PNG 결과는 작업 폴더에 저장했습니다.",
        at: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        elapsedMs: 18420,
        artifacts: [
          {
            name: "dokpami-sad-result.png",
            mimeType: "image/png",
            previewUrl: "/assets/after/dokpami-result-preview.png",
            kind: "image",
          },
        ],
      },
    ],
  },
  {
    id: "chat-proposal",
    title: "카페 브랜딩 제안서",
    agentId: "proposal-writer",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    messages: [
      {
        id: "m3",
        role: "user",
        text: "성수동 카페 리브랜딩 문의에 보낼 1차 제안서를 만들어줘.",
        at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        status: "sent",
      },
    ],
  },
  {
    id: "chat-brand-copy",
    title: "포트폴리오 소개문 수정",
    agentId: "brand-voice-editor",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    messages: [],
  },
];

const sampleReplies: Record<string, string> = {
  "dokpami-create-agent":
    "작업 주문서의 감정과 사용 맥락을 기준으로 캐릭터의 얼굴 비율과 실루엣은 유지하고, 고개를 살짝 숙인 자세와 흐린 창가 조명으로 슬픔을 표현했어요. 디자이너가 설정한 금지 규칙과 품질 기준을 적용한 결과를 캔버스에서 확인해 주세요.",
  "proposal-writer":
    "제안서 초안\n\n프로젝트 목표\n의뢰 범위와 우선순위를 먼저 합의하고, 각 단계의 산출물과 검토 시점을 명확히 합니다.\n\n다음 확인 항목\n1. 최종 의사결정자는 누구인가요?\n2. 수정 횟수와 피드백 기한은 어떻게 정하나요?\n3. 일정 변경 시 어떤 기준으로 범위를 조정하나요?",
  "morrow-visual-review-service":
    "디자인 피드백 초안\n\n우선순위 1 · 정보 위계\n제목 대비와 CTA 위치를 먼저 조정해 사용자가 다음 행동을 즉시 이해하게 만드세요.\n\n우선순위 2 · 가독성\n본문 줄 길이와 여백을 정리한 뒤, 장식 요소는 마지막에 다듬는 편이 좋습니다.",
  "scope-risk-checker":
    "범위 리스크 체크\n\n확정이 필요한 항목\n- 수정 횟수\n- 원본 파일 전달 범위\n- 일정 지연 시 처리 기준\n\n계약 전에 위 항목을 숫자와 날짜로 명시하세요.",
};

const quickPrompts: Record<AgentCategory, string[]> = {
  디자인: ["이 이미지를 같은 스타일로 변형해줘", "시안의 개선점을 정리해줘", "새 캐릭터 콘셉트를 만들어줘"],
  글쓰기: ["소개문을 더 자연스럽게 다듬어줘", "고객에게 보낼 문장을 써줘", "브랜드 말투를 정리해줘"],
  비즈니스: ["외주 제안서 초안을 만들어줘", "프로젝트 범위를 정리해줘", "출시 체크리스트를 만들어줘"],
  리서치: ["이 주제를 조사해 요약해줘", "비교표를 만들어줘", "근거와 함께 정리해줘"],
  생산성: ["계약서의 빠진 항목을 찾아줘", "할 일을 우선순위로 정리해줘", "리스크 체크리스트를 만들어줘"],
};

const categoryIcons: Record<AgentCategory, typeof Palette> = {
  디자인: Palette,
  글쓰기: PenLine,
  비즈니스: BriefcaseBusiness,
  리서치: Search,
  생산성: CheckCircle2,
};

export default function App() {
  const bridge = window.hiremeDesktop;
  const [bootstrap, setBootstrap] = useState<HireMeDesktopBootstrap | null>(null);
  const [auth, setAuth] = useState<HireMeDesktopAuthState | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;
    const removeListener = bridge.onAuthStateChanged((next) => {
      if (disposed) return;
      setAuth(next);
      if (next.status !== "error") setLoginError(null);
      if (next.status !== "authenticating") setLoginBusy(false);
    });
    bridge
      .bootstrap()
      .then((next) => {
        if (disposed) return;
        setBootstrap(next);
        setAuth(next.auth);
      })
      .catch((error) => {
        if (!disposed) setLoginError(publicLoginError(error));
      });
    return () => {
      disposed = true;
      removeListener();
    };
  }, [bridge]);

  const loginWithGoogle = async () => {
    if (!bridge || loginBusy) return;
    setLoginBusy(true);
    setLoginError(null);
    try {
      const next = await bridge.loginWithGoogle();
      setAuth(next);
      setLoginBusy(false);
    } catch (error) {
      setLoginBusy(false);
      setLoginError(publicLoginError(error));
    }
  };

  const logout = async () => {
    if (!bridge) return;
    const next = await bridge.logout();
    if (next) setAuth(next);
  };

  if (bridge && !bootstrap) {
    return <AuthGate state={auth} busy error={loginError} onLogin={loginWithGoogle} />;
  }

  if (bridge && auth?.status !== "authenticated") {
    return (
      <AuthGate
        state={auth || bootstrap?.auth || null}
        busy={loginBusy || auth?.status === "authenticating"}
        error={loginError || auth?.error || null}
        onLogin={loginWithGoogle}
      />
    );
  }

  return (
    <HireMeWorkspace
      key={auth?.user?.id || "browser-preview"}
      bootstrap={bootstrap}
      auth={auth}
      onLogout={logout}
    />
  );
}

function HireMeWorkspace({
  bootstrap,
  auth,
  onLogout,
}: {
  bootstrap: HireMeDesktopBootstrap | null;
  auth: HireMeDesktopAuthState | null;
  onLogout: () => Promise<void>;
}) {
  const storageNamespace = auth?.user?.id || "browser-preview";
  const [view, setView] = useState<ViewId>("studio");
  const [reviewInbox, setReviewInbox] = useState<HireMeReviewInbox | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewingVersionId, setReviewingVersionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agents, setAgents] = usePersistentState<Agent[]>(
    `hireme-agents-v3:${storageNamespace}`,
    bundledDemoContentEnabled ? seedAgents : [],
  );
  const [conversations, setConversations] = usePersistentState<Conversation[]>(
    `hireme-conversations-v3:${storageNamespace}`,
    bundledDemoContentEnabled ? seedConversations : [],
  );
  const [workScope, setWorkScope] = usePersistentState<WorkScope>(
    `hireme-work-scope-v1:${storageNamespace}`,
    "created",
  );
  const [activeConversationId, setActiveConversationId] = useState(() => (
    conversations.find((conversation) => (
      !conversation.archived && workScopeForConversation(conversation, agents) === workScope
    ))?.id || conversations.find((conversation) => !conversation.archived)?.id || ""
  ));
  const [selectedAgentId, setSelectedAgentId] = useState(
    bundledDemoContentEnabled ? seedAgents[0]?.id || "" : "",
  );
  const [selectedOwnedAgentId, setSelectedOwnedAgentId] = useState(
    bundledDemoContentEnabled ? seedAgents[0]?.id || "" : "",
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationMenu, setConversationMenu] = useState<{ conversationId: string; x: number; y: number } | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [workspace, setWorkspace] = useState(
    bootstrap?.workspace || "작업 폴더를 선택하세요",
  );
  const nativeRuntime = Boolean(bootstrap?.native);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [creatorWorker, setCreatorWorker] = useState<HireMeCreatorWorkerState | null>(null);
  const [designProjects, setDesignProjects] = useState<HireMeDesignProject[]>([]);
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [publishingAgentIds, setPublishingAgentIds] = useState<Record<string, boolean>>({});
  const [managementSessions, setManagementSessions] = useState<Record<string, HireMeAgentManagementSession>>({});
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const runQueueRef = useRef<Record<string, QueuedRequest[]>>({});
  const runningChatsRef = useRef(new Set<string>());
  const runTimersRef = useRef<Record<string, number[]>>({});
  const visualStreamSkipRef = useRef(new Set<string>());
  const cancelledRunIdsRef = useRef(new Set<string>());
  const databaseSyncRef = useRef(new Map<string, Promise<unknown>>());
  const databaseSyncErrorRef = useRef(new Set<string>());
  const dirtyManagementDraftsRef = useRef(new Set<string>());
  const warnedManagementSessionsRef = useRef(new Set<string>());

  const ownedAgents = agents.filter((agent) => agent.ownership === "mine");
  const recentConversations = conversations
    .filter((conversation) => !conversation.archived)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const scopedConversations = recentConversations.filter((conversation) => (
    workScopeForConversation(conversation, agents) === workScope
  ));
  const normalizedConversationQuery = conversationQuery.trim().toLowerCase();
  const visibleConversations = scopedConversations.filter((conversation) => {
    if (!normalizedConversationQuery) return true;
    const agent = agents.find((item) => item.id === conversation.agentId);
    return `${conversation.title} ${agent?.name || ""}`
      .toLowerCase()
      .includes(normalizedConversationQuery);
  });
  const selectedConversation = conversations.find((conversation) => (
    conversation.id === activeConversationId &&
    !conversation.archived &&
    workScopeForConversation(conversation, agents) === workScope
  ));
  const activeConversation = selectedConversation ?? (activeConversationId ? scopedConversations[0] : undefined);
  const activeAgent =
    agents.find((agent) => agent.id === activeConversation?.agentId) ?? agents[0];
  const activeManagementSession = activeConversation
    ? managementSessions[activeConversation.id]
    : undefined;
  const activeAuthoring = Boolean(
    activeConversation?.mode === "agent_authoring" &&
    isManagementSessionActive(activeManagementSession),
  );
  const activeManagementLocked = Boolean(
    activeConversation?.mode === "agent_authoring" && !activeAuthoring,
  );

  const setManagementDraftDirty = useCallback((conversationId: string, dirty: boolean) => {
    if (dirty) {
      dirtyManagementDraftsRef.current.add(conversationId);
      const session = managementSessions[conversationId];
      if (
        isManagementSessionActive(session) &&
        Date.parse(session.expiresAt) - Date.now() <= 60_000 &&
        !warnedManagementSessionsRef.current.has(session.id)
      ) {
        warnedManagementSessionsRef.current.add(session.id);
        setToast({
          id: eventTimeMs(),
          title: "관리 세션이 곧 만료돼요",
          detail: "저장하지 않은 Private Harness 변경이 있습니다. 1분 안에 저장해 주세요.",
        });
      }
    } else {
      dirtyManagementDraftsRef.current.delete(conversationId);
    }
  }, [managementSessions]);

  const confirmDiscardManagementDraft = useCallback((conversationId?: string) => {
    if (!conversationId || !dirtyManagementDraftsRef.current.has(conversationId)) return true;
    return window.confirm("Private Harness에 저장하지 않은 변경이 있습니다. 변경을 버리고 이동할까요?");
  }, []);

  useEffect(() => {
    const entries = Object.entries(managementSessions);
    if (entries.length === 0) return;
    const nextExpiry = Math.min(...entries.map(([, session]) => {
      const expiresAt = Date.parse(session.expiresAt);
      return Number.isFinite(expiresAt) ? expiresAt : Date.now();
    }));
    const warningTimers = entries.map(([conversationId, session]) => {
      const warningAt = Date.parse(session.expiresAt) - 60_000;
      return window.setTimeout(() => {
        if (
          !isManagementSessionActive(session) ||
          !dirtyManagementDraftsRef.current.has(conversationId) ||
          warnedManagementSessionsRef.current.has(session.id)
        ) return;
        warnedManagementSessionsRef.current.add(session.id);
        setToast({
          id: eventTimeMs(),
          title: "관리 세션이 곧 만료돼요",
          detail: "저장하지 않은 Private Harness 변경이 있습니다. 1분 안에 저장해 주세요.",
        });
      }, Math.max(0, warningAt - Date.now()));
    });
    const timer = window.setTimeout(() => {
      const expiredConversationIds = Object.entries(managementSessions)
        .filter(([, session]) => !isManagementSessionActive(session))
        .map(([conversationId]) => conversationId);
      if (expiredConversationIds.length === 0) return;
      const discardedDirtyDraft = expiredConversationIds.some((conversationId) => (
        dirtyManagementDraftsRef.current.has(conversationId)
      ));
      expiredConversationIds.forEach((conversationId) => {
        dirtyManagementDraftsRef.current.delete(conversationId);
      });
      setManagementSessions((current) => {
        const next = { ...current };
        expiredConversationIds.forEach((conversationId) => {
          const session = next[conversationId];
          if (session && !isManagementSessionActive(session)) delete next[conversationId];
        });
        return next;
      });
      setToast({
        id: eventTimeMs(),
        title: "관리 세션이 만료됐어요",
        detail: discardedDirtyDraft
          ? "저장하지 않은 Private Harness 변경은 보안을 위해 지웠습니다. 관리 모드를 다시 열어 주세요."
          : "Private Harness를 보려면 관리 모드를 다시 열어 주세요.",
      });
    }, Math.max(0, nextExpiry - Date.now()) + 25);
    return () => {
      window.clearTimeout(timer);
      warningTimers.forEach((warningTimer) => window.clearTimeout(warningTimer));
    };
  }, [managementSessions]);

  useEffect(() => {
    const preventDirtyDraftUnload = (event: BeforeUnloadEvent) => {
      if (dirtyManagementDraftsRef.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventDirtyDraftUnload);
    return () => window.removeEventListener("beforeunload", preventDirtyDraftUnload);
  }, []);

  useEffect(() => {
    if (bootstrap?.agents?.length) {
      setAgents((current) => mergeNativeAgents(current, bootstrap.agents));
    }
  }, [bootstrap, setAgents]);

  useEffect(() => {
    setAgents((current) => {
      let changed = false;
      const next = current.map((agent) => {
        const legacy = agent as unknown as { billingMode: string; usagePrice?: number };
        if (legacy.billingMode !== "usage" && legacy.usagePrice === undefined) return agent;
        changed = true;
        return {
          ...agent,
          billingMode: legacy.billingMode === "usage" ? "run" as const : agent.billingMode,
          runPrice: agent.runPrice ?? Math.round(Number(legacy.usagePrice || 0) * 100),
        };
      });
      return changed ? next : current;
    });
  }, [setAgents]);

  useEffect(() => {
    setAgents((current) => {
      const next = current.filter((agent) => !isRetiredMockAgent(agent));
      return next.length === current.length ? current : next;
    });
    setConversations((current) => {
      const next = current.filter((conversation) => !isRetiredMockAgentId(conversation.agentId));
      return next.length === current.length ? current : next;
    });
  }, [setAgents, setConversations]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop || auth?.status !== "authenticated") return;
    let disposed = false;
    desktop.loadWorkspaceData()
      .then((data) => {
        if (disposed) return;
        setAgents((current) => mergeDatabaseAgents(current, data.agents));
        setConversations((current) => mergeDatabaseConversations(current, data.conversations));
      })
      .catch((error) => {
        if (disposed) return;
        setToast({
          id: eventTimeMs(),
          title: "온라인 작업을 불러오지 못했어요",
          detail: publicErrorMessage(error),
        });
      });
    return () => {
      disposed = true;
    };
  }, [auth?.status, auth?.user?.id, setAgents, setConversations]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop || auth?.status !== "authenticated") return;
    void desktop.loadReviewInbox().then(setReviewInbox).catch(() => setReviewInbox(null));
  }, [auth?.status, auth?.user?.id]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop || auth?.status !== "authenticated") return;
    let disposed = false;
    const load = async () => {
      const [workerState, projectState] = await Promise.all([
        desktop.getCreatorWorker(),
        desktop.loadDesignProjects(),
      ]);
      if (disposed) return;
      setCreatorWorker(workerState);
      setDesignProjects(projectState.projects);
    };
    void load().catch((error) => {
      if (!disposed) setToast({ id: eventTimeMs(), title: "Creator Worker 상태를 불러오지 못했어요", detail: publicErrorMessage(error) });
    });
    const unsubscribe = desktop.onCreatorWorkerChanged((state) => {
      if (!disposed) setCreatorWorker(state);
    });
    const projectPoll = window.setInterval(() => {
      void desktop.loadDesignProjects().then((state) => {
        if (!disposed) setDesignProjects(state.projects);
      }).catch(() => {});
    }, 15_000);
    return () => { disposed = true; window.clearInterval(projectPoll); unsubscribe(); };
  }, [auth?.status, auth?.user?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop) return;
    return desktop.onRunEvent((event) => {
      if (event.type !== "stage") return;
      const conversationId = typeof event.conversationId === "string" ? event.conversationId : "";
      const runId = typeof event.runId === "string" ? event.runId : "";
      const label = typeof event.label === "string" ? event.label.trim() : "";
      if (!conversationId || !runId || !label) return;
      setRuns((current) => {
        const active = current[conversationId];
        if (!active || active.runId !== runId || active.steps.includes(label)) return current;
        return {
          ...current,
          [conversationId]: {
            ...active,
            steps: [...active.steps, label].slice(-5),
          },
        };
      });
    });
  }, []);

  useEffect(
    () => () => {
      Object.values(runTimersRef.current).flat().forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const showToast = (title: string, detail?: string) => {
    setToast({ id: eventTimeMs(), title, detail });
  };

  const invalidateManagementSession = useCallback((conversationId: string, error: unknown) => {
    if (!isManagementSessionError(error)) return false;
    dirtyManagementDraftsRef.current.delete(conversationId);
    setManagementSessions((current) => {
      if (!current[conversationId]) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setToast({
      id: eventTimeMs(),
      title: "관리 모드가 잠겼어요",
      detail: "Private Harness 내용은 지웠습니다. 내 에이전트 화면에서 관리 모드를 다시 열어 주세요.",
    });
    return true;
  }, []);

  const queueDatabaseSync = (
    conversationId: string,
    operation: () => Promise<unknown>,
  ) => {
    const previous = databaseSyncRef.current.get(conversationId) || Promise.resolve();
    const next = previous.then(operation);
    databaseSyncRef.current.set(conversationId, next);
    void next
      .then(() => {
        databaseSyncErrorRef.current.delete(conversationId);
      })
      .catch((error) => {
        if (databaseSyncErrorRef.current.has(conversationId)) return;
        databaseSyncErrorRef.current.add(conversationId);
        showToast("온라인 저장에 실패했어요", publicErrorMessage(error));
      })
      .finally(() => {
        if (databaseSyncRef.current.get(conversationId) === next) {
          databaseSyncRef.current.delete(conversationId);
        }
      });
  };

  const navigateToView = (nextView: ViewId) => {
    if (nextView !== view && !confirmDiscardManagementDraft(activeConversation?.id)) return false;
    setView(nextView);
    return true;
  };

  const openReviewInbox = async () => {
    if (!window.hiremeDesktop || reviewLoading) return;
    setReviewLoading(true);
    try {
      const inbox = await window.hiremeDesktop.loadReviewInbox();
      setReviewInbox(inbox);
      if (!inbox.reviewer) {
        showToast("검토자 권한이 없어요", "검토함은 HireMe 운영자에게만 열립니다.");
        return;
      }
      navigateToView("review");
    } catch (error) {
      showToast("검토함을 열지 못했어요", publicErrorMessage(error));
    } finally {
      setReviewLoading(false);
    }
  };

  const decideReview = async (versionId: string, decision: "approved" | "rejected") => {
    if (!window.hiremeDesktop || reviewingVersionId) return;
    setReviewingVersionId(versionId);
    try {
      await window.hiremeDesktop.decideAgentReview({ versionId, decision });
      setReviewInbox((current) => current
        ? { ...current, items: current.items.filter((item) => item.versionId !== versionId) }
        : current);
      showToast(decision === "approved" ? "에이전트를 승인했어요" : "에이전트를 반려했어요");
    } catch (error) {
      showToast("검토 결과를 저장하지 못했어요", publicErrorMessage(error));
    } finally {
      setReviewingVersionId(null);
    }
  };

  const selectConversation = (
    conversationId: string,
    { skipDiscardConfirmation = false }: { skipDiscardConfirmation?: boolean } = {},
  ) => {
    if (
      !skipDiscardConfirmation &&
      conversationId !== activeConversation?.id &&
      !confirmDiscardManagementDraft(activeConversation?.id)
    ) return false;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (conversation) setWorkScope(workScopeForConversation(conversation, agents));
    setActiveConversationId(conversationId);
    setView("chat");
    setSidebarOpen(false);
    setConversationMenu(null);
    return true;
  };

  const createConversationForAgent = (
    agent: Agent,
    options: { id?: string; mode?: Conversation["mode"]; title?: string } = {},
  ) => {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: options.id || createEntityUuid(),
      title: options.title || `${agent.name} 새 작업`,
      agentId: agent.id,
      updatedAt: now,
      messages: [],
      storage: agent.databaseId && window.hiremeDesktop ? "database" : "local",
      provider: auth?.user?.defaultProvider || null,
      model: auth?.user?.defaultModel || null,
      mode: options.mode || "work",
    };
    setConversations((current) => [conversation, ...current]);
    if (conversation.storage === "database" && agent.databaseId && window.hiremeDesktop) {
      queueDatabaseSync(conversation.id, () => window.hiremeDesktop!.createConversation({
        id: conversation.id,
        agentDatabaseId: agent.databaseId,
        title: conversation.title,
        provider: conversation.provider,
        model: conversation.model,
      }));
    }
    setWorkScope(workScopeForAgent(agent));
    setActiveConversationId(conversation.id);
    setModal(null);
    setView("chat");
    setSidebarOpen(false);
    return conversation;
  };

  const createConversation = (agentId: string) => {
    if (!confirmDiscardManagementDraft(activeConversation?.id)) return undefined;
    const agent = agents.find((item) => item.id === agentId) ?? agents[0];
    return createConversationForAgent(agent);
  };

  const openAgentManagement = async (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;
    if (agent.ownership !== "mine") {
      showToast("관리 권한이 없어요", "고용한 에이전트의 Private Harness는 제작자만 관리할 수 있습니다.");
      return;
    }
    const existing = conversations.find((conversation) => (
      conversation.agentId === agentId &&
      conversation.mode === "agent_authoring" &&
      !conversation.archived
    ));
    if (!confirmDiscardManagementDraft(activeConversation?.id)) return;
    if (agent.runtime !== "local") {
      showToast("원본 패키지가 필요해요", "이 기기에 에이전트 원본을 연결한 뒤 관리 모드로 들어갈 수 있습니다.");
      return;
    }
    try {
      const conversationId = existing?.id || createEntityUuid();
      let authoring = agent.authoring || { phase: "valid", revision: 1 };
      if (window.hiremeDesktop) {
        const ready = await window.hiremeDesktop.prepareAgentManagement({
          conversationId,
          agentId: agent.id,
          name: agent.name,
          category: agent.category,
          headline: agent.headline,
          summary: agent.summary,
          creator: auth?.user?.displayName || "나",
          skills: agent.skills,
          resultTypes: agent.resultTypes,
        });
        authoring = { phase: ready.phase, revision: ready.revision };
        setManagementSessions((current) => ({
          ...current,
          [conversationId]: ready.managementSession,
        }));
      }
      setAgents((current) => current.map((item) => (
        item.id === agentId ? { ...item, authoring } : item
      )));
      if (existing) {
        selectConversation(existing.id, { skipDiscardConfirmation: true });
      } else {
        createConversationForAgent({ ...agent, authoring }, {
          id: conversationId,
          mode: "agent_authoring",
          title: `${agent.name} 관리`,
        });
      }
      showToast("관리 모드를 열었어요", "검증된 관리 세션에서 Private Harness를 확인하고 수정할 수 있습니다.");
    } catch (error) {
      showToast("관리 모드를 열지 못했어요", publicErrorMessage(error));
    }
  };

  const removeConversation = async (conversationId: string) => {
    const target = conversations.find((conversation) => conversation.id === conversationId);
    if (!target) return;
    if (!confirmDiscardManagementDraft(conversationId)) return;
    try {
      if (runs[conversationId]) await window.hiremeDesktop?.cancelRun(runs[conversationId].runId).catch(() => false);
      const managementSession = managementSessions[conversationId];
      if (managementSession && window.hiremeDesktop) {
        await window.hiremeDesktop.closeAgentManagement({
          conversationId,
          agentId: target.agentId,
          managementSessionId: managementSession.id,
        }).catch(() => null);
      }
      if (target.storage === "database" && window.hiremeDesktop) {
        await window.hiremeDesktop.deleteConversation({ id: conversationId });
      }
      delete runQueueRef.current[conversationId];
      setQueueCounts((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      setManagementSessions((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      dirtyManagementDraftsRef.current.delete(conversationId);
      if (activeConversationId === conversationId) {
        const scope = workScopeForConversation(target, agents);
        const next = recentConversations.find((conversation) => (
          conversation.id !== conversationId &&
          workScopeForConversation(conversation, agents) === scope
        ));
        setActiveConversationId(next?.id || "");
      }
      setModal(null);
      setConversationMenu(null);
      showToast("작업을 삭제했어요");
    } catch (error) {
      setModal(null);
      showToast("작업을 삭제하지 못했어요", publicErrorMessage(error));
    }
  };

  const updateConversation = (
    conversationId: string,
    updater: (conversation: Conversation) => Conversation,
  ) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation,
      ),
    );
  };

  const appendMessage = (
    conversationId: string,
    message: ChatMessage,
    { persist = true }: { persist?: boolean } = {},
  ) => {
    const existing = conversations.find((conversation) => conversation.id === conversationId);
    const nextTitle = existing?.messages.length === 0 && message.role === "user"
      ? summarizeTitle(message.text)
      : existing?.title;
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: nextTitle || conversation.title,
      updatedAt: new Date().toISOString(),
      messages: [...conversation.messages, message],
    }));
    if (persist && existing?.storage === "database" && window.hiremeDesktop) {
      queueDatabaseSync(conversationId, () => window.hiremeDesktop!.saveMessage({
        id: message.id,
        conversationId,
        role: message.role,
        text: message.text,
        at: message.at,
        status: message.status,
        elapsedMs: message.elapsedMs,
        attachments: message.attachments,
        artifacts: message.artifacts,
      }));
      if (nextTitle && nextTitle !== existing.title) {
        queueDatabaseSync(conversationId, () => window.hiremeDesktop!.updateConversation({
          id: conversationId,
          title: nextTitle,
        }));
      }
    }
  };

  const streamAssistantResult = async ({
    conversationId,
    conversation,
    runId,
    output,
    responseElapsedMs,
    startedAt,
    artifacts,
  }: {
    conversationId: string;
    conversation?: Conversation;
    runId: string;
    output: string;
    responseElapsedMs: number;
    startedAt: number;
    artifacts: Attachment[];
  }) => {
    const message: ChatMessage = {
      id: createEntityUuid(),
      role: "assistant",
      text: "",
      at: new Date().toISOString(),
      streaming: true,
    };
    appendMessage(conversationId, message, { persist: false });
    const frames = createStreamFrames(output);
    visualStreamSkipRef.current.delete(runId);
    for (const frame of frames) {
      const visibleText = visualStreamSkipRef.current.has(runId) ? output : frame;
      updateConversation(conversationId, (current) => ({
        ...current,
        messages: current.messages.map((item) => (
          item.id === message.id
            ? { ...item, text: visibleText, streaming: true }
            : item
        )),
      }));
      if (visibleText === output) break;
      await waitForStreamFrame(streamFrameDelayMs(frames.length));
    }
    const completedAt = new Date().toISOString();
    const elapsedMs = Math.max(
      responseElapsedMs,
      eventTimeMs() - startedAt,
    );
    const finalMessage: ChatMessage = {
      ...message,
      text: output,
      at: completedAt,
      elapsedMs,
      artifacts,
      streaming: false,
    };
    updateConversation(conversationId, (current) => ({
      ...current,
      updatedAt: completedAt,
      messages: current.messages.map((item) => (
        item.id === message.id ? finalMessage : item
      )),
    }));
    visualStreamSkipRef.current.delete(runId);
    if (conversation?.storage === "database" && window.hiremeDesktop) {
      queueDatabaseSync(conversationId, () => window.hiremeDesktop!.saveMessage({
        id: finalMessage.id,
        conversationId,
        role: finalMessage.role,
        text: finalMessage.text,
        at: finalMessage.at,
        elapsedMs: finalMessage.elapsedMs,
        artifacts: finalMessage.artifacts,
      }));
    }
  };

  const updateMessageStatus = (
    conversationId: string,
    messageId: string,
    status: ChatMessage["status"],
    fallback?: QueuedRequest,
  ) => {
    const conversation = conversations.find((item) => item.id === conversationId);
    const message = conversation?.messages.find((item) => item.id === messageId) || (fallback
      ? {
          id: fallback.messageId,
          role: "user" as const,
          text: fallback.text,
          at: fallback.at,
          attachments: fallback.attachments,
        }
      : undefined);
    updateConversation(conversationId, (current) => ({
      ...current,
      messages: current.messages.map((item) =>
        item.id === messageId ? { ...item, status } : item,
      ),
    }));
    if (conversation?.storage === "database" && message && window.hiremeDesktop) {
      queueDatabaseSync(conversationId, () => window.hiremeDesktop!.saveMessage({
        id: message.id,
        conversationId,
        role: message.role,
        text: message.text,
        at: message.at,
        status,
        elapsedMs: message.elapsedMs,
        attachments: message.attachments,
        artifacts: message.artifacts,
      }));
    }
  };

  const executeRequest = async (
    conversationId: string,
    agent: Agent,
    request: QueuedRequest,
  ) => {
    const requestConversation = conversations.find((item) => item.id === conversationId);
    const managementSession = managementSessions[conversationId];
    const isManagementConversation = requestConversation?.mode === "agent_authoring";
    const isDraftOutput = request.kind === "draft_output";
    const managementSessionReady = isManagementSessionActive(managementSession);
    const isAuthoringRequest = Boolean(
      isManagementConversation &&
      managementSessionReady &&
      !isDraftOutput,
    );
    if (isManagementConversation && !managementSessionReady) {
      dirtyManagementDraftsRef.current.delete(conversationId);
      setManagementSessions((current) => {
        if (!current[conversationId]) return current;
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      appendMessage(conversationId, {
        id: createEntityUuid(),
        role: "assistant",
        text: "관리 세션이 만료되어 요청을 실행하지 않았어요. 내 에이전트 화면에서 관리 모드를 다시 열어 주세요.",
        at: new Date().toISOString(),
      });
      updateMessageStatus(conversationId, request.messageId, "failed", request);
      showToast("관리 모드가 잠겼어요", "Private Harness를 보거나 수정하려면 관리 모드를 다시 열어 주세요.");
      const next = runQueueRef.current[conversationId]?.shift();
      setQueueCounts((current) => ({
        ...current,
        [conversationId]: runQueueRef.current[conversationId]?.length || 0,
      }));
      if (next) {
        runningChatsRef.current.add(conversationId);
        setRuns((current) => {
          const active = current[conversationId];
          if (!active) return current;
          return {
            ...current,
            [conversationId]: {
              ...active,
              steps: [...active.steps, "다음 요청을 시작하고 있어요"].slice(-5),
            },
          };
        });
        window.setTimeout(() => executeRequest(conversationId, agent, next), 120);
      } else {
        setRuns((current) => {
          if (!current[conversationId]) return current;
          const remaining = { ...current };
          delete remaining[conversationId];
          return remaining;
        });
        runningChatsRef.current.delete(conversationId);
      }
      return;
    }
    runningChatsRef.current.add(conversationId);
    updateMessageStatus(conversationId, request.messageId, "sent", request);

    const runId = `run-${eventTimeMs().toString(36)}-${conversationId}`;
    const startedAt = eventTimeMs();
    const previewRun = agent.runtime === "preview";
    setRuns((current) => ({
      ...current,
      [conversationId]: {
        runId,
        startedAt,
        image: agent.category === "디자인" || agent.resultTypes.includes("PNG"),
        steps: [
          isAuthoringRequest
            ? "설계 내용을 이해하고 있어요"
            : isDraftOutput
              ? `${agent.name}가 현재 설정으로 결과를 만들고 있어요`
            : previewRun
              ? `${agent.name}가 결과 초안을 준비하고 있어요`
              : "요청을 안전하게 전달하고 있어요",
        ],
      },
    }));

    const stageTimers = [
      ...(agent.category === "디자인" || agent.resultTypes.includes("PNG") ? [
        window.setTimeout(() => {
          setRuns((current) => ({
            ...current,
            [conversationId]: current[conversationId]?.runId === runId
              ? {
                  ...current[conversationId],
                  steps: [...current[conversationId].steps, "이미지 생성 결과를 기다리고 있어요"].slice(-5),
                }
              : current[conversationId],
          }));
        }, 2_500),
      ] : []),
      ...(previewRun ? [
      window.setTimeout(() => {
        setRuns((current) => ({
          ...current,
          [conversationId]: current[conversationId]?.runId === runId
            ? {
                ...current[conversationId],
                steps: [
                  ...current[conversationId].steps,
                  isAuthoringRequest ? "작업 방식과 기억을 정리하고 있어요" : "핵심 메시지와 문장 구조를 다듬고 있어요",
                ],
              }
            : current[conversationId],
        }));
      }, 360),
      window.setTimeout(() => {
        setRuns((current) => ({
          ...current,
          [conversationId]: current[conversationId]?.runId === runId
            ? {
                ...current[conversationId],
                steps: [
                  ...current[conversationId].steps,
                  isAuthoringRequest ? "초안 변경을 확인하고 있어요" : "전달할 결과를 구성하고 있어요",
                ],
              }
            : current[conversationId],
        }));
      }, 700),
      ] : []),
    ];
    runTimersRef.current[runId] = stageTimers;

    try {
      const response = await runAgentRequest({
        runId,
        conversationId,
        agent,
        text: request.text,
        attachments: request.attachments,
        workspace,
        conversation: requestConversation,
        managementSession: isAuthoringRequest ? managementSession : undefined,
      });
      setRuns((current) => ({
        ...current,
        [conversationId]: current[conversationId]?.runId === runId
          ? {
              ...current[conversationId],
              steps: [...current[conversationId].steps, "검증된 결과를 표시하고 있어요"].slice(-5),
            }
          : current[conversationId],
      }));
      await streamAssistantResult({
        conversationId,
        conversation: requestConversation,
        runId,
        output: response.output,
        responseElapsedMs: response.elapsedMs || eventTimeMs() - startedAt,
        startedAt,
        artifacts: response.artifacts || [],
      });
    } catch (error) {
      const cancelled = cancelledRunIdsRef.current.has(runId) || isRunCancelledError(error);
      const managementSessionInvalid = Boolean(
        isManagementConversation && invalidateManagementSession(conversationId, error)
      );
      const failureMessage = cancelled
        ? isManagementConversation
          ? "관리 작업을 중지했어요. 중지 전에 적용된 변경이 있을 수 있으니 오른쪽 Private Harness와 검증 상태를 확인해 주세요."
          : "작업을 중지했어요. 요청은 전달됐지만 결과 생성이 완료되기 전에 중단됐습니다."
        : managementSessionInvalid
          ? "관리 모드가 잠겼어요. Private Harness를 보거나 수정하려면 관리 모드를 다시 열어 주세요."
          : isManagementConversation
            ? `${publicErrorMessage(error)} 관리 작업은 일부 변경이 먼저 저장됐을 수 있으니 오른쪽 Private Harness를 확인해 주세요.`
            : publicErrorMessage(error);
      appendMessage(conversationId, {
        id: createEntityUuid(),
        role: "assistant",
        text: failureMessage,
        at: new Date().toISOString(),
        elapsedMs: eventTimeMs() - startedAt,
        retry: !cancelled && !managementSessionInvalid
          ? { text: request.text, attachments: request.attachments }
          : undefined,
      });
      updateMessageStatus(
        conversationId,
        request.messageId,
        cancelled ? "cancelled" : "failed",
        request,
      );
      if (!cancelled && !managementSessionInvalid) {
        showToast(
          isManagementConversation ? "관리 작업을 완료하지 못했어요" : "작업을 완료하지 못했어요",
          publicErrorMessage(error),
        );
      }
    } finally {
      cancelledRunIdsRef.current.delete(runId);
      (runTimersRef.current[runId] || []).forEach((timer) => window.clearTimeout(timer));
      delete runTimersRef.current[runId];
      const nextRequest = runQueueRef.current[conversationId]?.shift();
      setQueueCounts((current) => ({
        ...current,
        [conversationId]: runQueueRef.current[conversationId]?.length || 0,
      }));
      if (nextRequest) {
        setRuns((current) => {
          const active = current[conversationId];
          if (!active || active.runId !== runId) return current;
          return {
            ...current,
            [conversationId]: {
              ...active,
              steps: [...active.steps, "다음 요청을 시작하고 있어요"].slice(-5),
            },
          };
        });
        window.setTimeout(() => executeRequest(conversationId, agent, nextRequest), 120);
      } else {
        setRuns((current) => {
          const active = current[conversationId];
          if (!active || active.runId !== runId) return current;
          const remaining = { ...current };
          delete remaining[conversationId];
          return remaining;
        });
        runningChatsRef.current.delete(conversationId);
      }
    }
  };

  const sendMessage = (text: string, attachments: Attachment[]) => {
    if (!activeConversation || !activeAgent || (!text.trim() && attachments.length === 0)) return;
    if (activeConversation.mode === "agent_authoring" && !activeAuthoring) {
      showToast("관리 모드가 잠겨 있어요", "내 에이전트 화면의 관리 모드 버튼으로 다시 열어 주세요.");
      return;
    }
    const request: QueuedRequest = {
      messageId: createEntityUuid(),
      text: text.trim() || "첨부한 파일을 확인해줘.",
      attachments,
      at: new Date().toISOString(),
    };
    if (activeConversation.mode === "agent_authoring" && isDraftOutputRequest(request.text, attachments)) {
      request.kind = "draft_output";
      request.text = request.text.replace(/^시험\s*[:：]\s*/, "").trim() || "현재 설정으로 대표 결과를 만들어줘.";
    }
    const queued = runningChatsRef.current.has(activeConversation.id);
    appendMessage(activeConversation.id, {
      id: request.messageId,
      role: "user",
      text: request.text,
      at: request.at,
      status: queued ? "queued" : "sent",
      attachments,
    });
    if (queued) {
      runQueueRef.current[activeConversation.id] ||= [];
      runQueueRef.current[activeConversation.id].push(request);
      setQueueCounts((current) => ({
        ...current,
        [activeConversation.id]: runQueueRef.current[activeConversation.id].length,
      }));
      showToast("요청을 대기열에 추가했어요", "현재 작업이 끝나면 바로 시작합니다.");
      return;
    }
    void executeRequest(activeConversation.id, activeAgent, request);
  };

  const cancelRun = async (conversationId: string) => {
    const run = runs[conversationId];
    if (!run) return;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (
      conversation?.mode === "agent_authoring" &&
      !window.confirm("관리 작업을 중지하면 이미 적용된 변경은 남을 수 있습니다. 그래도 중지할까요?")
    ) return;
    visualStreamSkipRef.current.add(run.runId);
    cancelledRunIdsRef.current.add(run.runId);
    const cancelled = await window.hiremeDesktop?.cancelRun(run.runId).catch(() => false);
    showToast(
      cancelled ? "작업 중지를 요청했어요" : "완료된 결과를 마무리하고 있어요",
      cancelled
        ? conversation?.mode === "agent_authoring"
          ? "이미 저장된 관리 변경은 유지됩니다."
          : "대기 중인 요청은 다음에 이어집니다."
        : "실행은 이미 끝났으며 결과 표시만 마무리합니다.",
    );
  };

  const chooseWorkspace = async () => {
    const selected = await window.hiremeDesktop?.chooseWorkspace();
    if (selected) {
      setWorkspace(selected);
      showToast("작업 폴더를 연결했어요", selected);
    } else if (!window.hiremeDesktop) {
      showToast("데스크톱 앱에서 폴더를 연결할 수 있어요");
    }
  };

  const startAgentWork = async (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;
    if (agent.ownership === "market" && !agent.hired) {
      try {
        if (window.hiremeDesktop) {
          await window.hiremeDesktop.hireDemoAgent({ agentId: agent.id });
        }
        setAgents((current) => current.map((item) => (
          item.id === agent.id ? { ...item, hired: true } : item
        )));
        showToast("디자인 서비스를 이용할 수 있어요", "데모 기간에는 무료로 바로 작업을 맡길 수 있어요.");
      } catch (error) {
        showToast("디자인 서비스를 시작하지 못했어요", publicErrorMessage(error));
        return;
      }
    }
    createConversation(agentId);
  };

  const setWorkerAvailable = async (available: boolean) => {
    if (!window.hiremeDesktop) return;
    try {
      setCreatorWorker(await window.hiremeDesktop.setCreatorWorkerAvailable(available));
      showToast(available ? "이 Mac에서 디자인 요청을 받습니다" : "새 디자인 요청 수신을 멈췄어요");
    } catch (error) {
      showToast("Creator Worker 상태를 바꾸지 못했어요", publicErrorMessage(error));
    }
  };

  const approveCreatorJob = async (jobId: string, decision: "approved" | "revision_requested" | "rejected") => {
    if (!window.hiremeDesktop) return;
    try {
      const note = decision === "revision_requested" ? window.prompt("다시 만들 때 반영할 내용을 적어 주세요.", "브리프 일치도와 시각적 완성도를 높여 주세요.") || "" : "";
      if (decision === "revision_requested" && !note) return;
      await window.hiremeDesktop.approveCreatorJob({ jobId, decision, note });
      const [workerState, projectState] = await Promise.all([
        window.hiremeDesktop.refreshCreatorWorker(),
        window.hiremeDesktop.loadDesignProjects(),
      ]);
      setCreatorWorker(workerState);
      setDesignProjects(projectState.projects);
      showToast(decision === "approved" ? "클라이언트에게 결과를 전달했어요" : decision === "revision_requested" ? "수정 실행을 다시 대기열에 넣었어요" : "결과를 반려했어요");
    } catch (error) {
      showToast("검수 결정을 저장하지 못했어요", publicErrorMessage(error));
    }
  };

  const submitDesignProject = async (request: DesignProjectRequest) => {
    const agent = agents.find((item) => item.id === request.agentId);
    if (!agent || projectSubmitting) return;
    if (!window.hiremeDesktop || !agent.databaseId) {
      showToast("데스크톱 앱의 공개 Agent에서 프로젝트를 시작해 주세요");
      return;
    }
    setProjectSubmitting(true);
    try {
      if (agent.ownership === "market" && !agent.hired) {
        await window.hiremeDesktop.hireDemoAgent({ agentId: agent.id });
        setAgents((current) => current.map((item) => item.id === agent.id ? { ...item, hired: true } : item));
      }
      const result = await window.hiremeDesktop.submitDesignProject({
        agentId: agent.databaseId,
        attachments: request.attachments,
        brief: {
          objective: request.brief,
          audience: "브리프와 첨부 자료에서 확인",
          channel: request.diagnosis.channel,
          goal: request.diagnosis.goal,
          deliverables: [{ kind: "social_image", format: "png", dimensions: "1080x1350", count: 3 }],
          mustInclude: [request.diagnosis.assets],
          mustAvoid: [],
          deliveryMode: request.deliveryMode,
        },
      });
      const projectState = await window.hiremeDesktop.loadDesignProjects();
      setDesignProjects(projectState.projects);
      showToast("프로젝트를 접수했어요", `요청 ${result.jobId.slice(0, 8)} · 디자이너 Worker가 준비되면 시작합니다.`);
    } catch (error) {
      showToast("프로젝트를 접수하지 못했어요", publicErrorMessage(error));
      throw error;
    } finally {
      setProjectSubmitting(false);
    }
  };

  const cancelDesignProject = async (projectId: string) => {
    if (!window.hiremeDesktop) return;
    try {
      await window.hiremeDesktop.cancelDesignProject({ projectId });
      const state = await window.hiremeDesktop.loadDesignProjects();
      setDesignProjects(state.projects);
      showToast("프로젝트 취소를 요청했어요");
    } catch (error) {
      showToast("프로젝트를 취소하지 못했어요", publicErrorMessage(error));
    }
  };

  const publishVersion = async (agentId: string) => {
    if (publishingAgentIds[agentId]) return;
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;
    const nextVersion = agent.status === "초안" ? agent.version : incrementPatch(agent.version);
    const authoringConversation = conversations
      .filter((conversation) => conversation.agentId === agentId && conversation.mode === "agent_authoring")
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
    const managementSession = authoringConversation
      ? managementSessions[authoringConversation.id]
      : undefined;
    if (
      window.hiremeDesktop &&
      (
        !authoringConversation ||
        !isManagementSessionActive(managementSession)
      )
    ) {
      showToast("관리 모드에서 배포해 주세요", "먼저 관리 모드를 열어 Private Harness와 검증 상태를 확인해 주세요.");
      await openAgentManagement(agentId);
      return;
    }
    if (
      authoringConversation &&
      !confirmDiscardManagementDraft(authoringConversation.id)
    ) return;
    setPublishingAgentIds((current) => ({ ...current, [agentId]: true }));
    try {
      let published: HireMeAgentPublishResult | null = null;
      if (window.hiremeDesktop) {
        published = await window.hiremeDesktop.publishAgentDraft({
          conversationId: authoringConversation!.id,
          agentId,
          managementSessionId: managementSession!.id,
          version: nextVersion,
        });
      }
      setAgents((current) => current.map((item) => (
        item.id === agentId
          ? {
              ...item,
              version: published?.databaseVersion || nextVersion,
              status: "공개",
              authoring: {
                phase: "packaged",
                revision: published?.revision || item.authoring?.revision || 1,
                packagePath: published?.packagePath,
                packageDigest: published?.packageDigest,
              },
            }
          : item
      )));
      if (authoringConversation) {
        if (authoringConversation.storage === "database" && window.hiremeDesktop) {
          await window.hiremeDesktop.deleteConversation({ id: authoringConversation.id });
        }
        setConversations((current) => current.filter((conversation) => (
          conversation.id !== authoringConversation.id
        )));
        setManagementSessions((current) => {
          const next = { ...current };
          delete next[authoringConversation.id];
          return next;
        });
        dirtyManagementDraftsRef.current.delete(authoringConversation.id);
        if (activeConversationId === authoringConversation.id) setActiveConversationId("");
        setSelectedOwnedAgentId(agentId);
        setView("agents");
      }
      showToast(
        "에이전트를 배포했어요",
        published?.packageRelativePath
          ? `하네스와 기본 기억을 ${published.packageRelativePath}에 함께 담았습니다.`
          : "하네스와 기본 기억을 함께 묶었습니다.",
      );
    } catch (error) {
      const managementSessionInvalid = Boolean(
        authoringConversation && invalidateManagementSession(authoringConversation.id, error)
      );
      if (!managementSessionInvalid) {
        showToast("배포하지 못했어요", publicErrorMessage(error));
      }
    } finally {
      setPublishingAgentIds((current) => {
        const next = { ...current };
        delete next[agentId];
        return next;
      });
    }
  };

  const managementInspectorOpen = view === "chat" && activeAuthoring;
  const inspectorClosed =
    view === "studio" ||
    view === "discover" ||
    view === "agents" ||
    (view === "chat" && !managementInspectorOpen);

  return (
    <div className={`desktop-app ${managementInspectorOpen ? "agent-authoring-mode" : ""} ${inspectorClosed ? "inspector-closed" : ""} ${view === "earnings" ? "earnings-coming-soon-mode" : ""}`} data-native={nativeRuntime ? "true" : "false"}>
      <div className="titlebar">
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label="메뉴 열기"
          title="메뉴"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={18} />
        </button>
        <span className="titlebar-name">HireMe</span>
        <div className="titlebar-runtime">
          <span className={nativeRuntime ? "status-dot online" : "status-dot"} />
          {nativeRuntime ? "로컬 런타임 연결됨" : "앱 미리보기"}
        </div>
      </div>

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src={appAssetUrl("/assets/Logo.png")} alt="HireMe" />
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="메뉴 닫기"
            title="닫기"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="primary-nav" aria-label="주요 메뉴">
          <span className="sidebar-nav-label">디자이너 스튜디오</span>
          <button
            type="button"
            className={view === "studio" ? "nav-item nav-item-rich active" : "nav-item nav-item-rich"}
            onClick={() => {
              if (navigateToView("studio")) setSidebarOpen(false);
            }}
          >
            <LayoutGrid size={17} />
            <span><strong>스튜디오 홈</strong><small>만들기 · 관리 · 개선</small></span>
          </button>
          <button
            type="button"
            className={view === "agents" || view === "earnings" ? "nav-item nav-item-rich active" : "nav-item nav-item-rich"}
            onClick={() => {
              if (navigateToView("agents")) setSidebarOpen(false);
            }}
          >
            <Target size={17} />
            <span><strong>내 에이전트</strong><small>질문 · 기준 · 결과물</small></span>
            <small className="sidebar-count">{ownedAgents.length}</small>
          </button>
        </nav>

        {view === "chat" ? (
          <>
            <div className={`conversation-list-heading ${conversationSearchOpen ? "searching" : ""}`}>
              {conversationSearchOpen ? (
                <label className="conversation-search">
                  <Search size={14} />
                  <input autoFocus value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="대화 검색" aria-label="대화 검색" />
                  <button type="button" aria-label="검색 닫기" title="검색 닫기" onClick={() => { setConversationQuery(""); setConversationSearchOpen(false); }}><X size={13} /></button>
                </label>
              ) : (
                <>
                  <span>{workScope === "created" ? "내 서비스 테스트" : "진행 중인 주문"}</span>
                  <span className="conversation-heading-actions">
                    <button className="icon-button" type="button" aria-label="새 작업" title="새 작업" onClick={() => setModal({ type: "new-chat", scope: workScope })}><Plus size={15} /></button>
                    <button className="icon-button" type="button" aria-label="대화 검색" title="대화 검색" onClick={() => setConversationSearchOpen(true)}><Search size={15} /></button>
                  </span>
                </>
              )}
            </div>
            <div className="conversation-list">
              {visibleConversations.length > 0 ? (
                visibleConversations.map((conversation) => {
                  const agent = agents.find((item) => item.id === conversation.agentId);
                  const conversationRun = runs[conversation.id];
                  const isRunning = Boolean(conversationRun);
                  return (
                    <button
                      type="button"
                      key={conversation.id}
                      className={activeConversationId === conversation.id ? "conversation-item active" : "conversation-item"}
                      onClick={() => selectConversation(conversation.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setConversationMenu({
                          conversationId: conversation.id,
                          x: Math.min(event.clientX, window.innerWidth - 170),
                          y: Math.min(event.clientY, window.innerHeight - 64),
                        });
                      }}
                    >
                      <AgentAvatar agent={agent} size="small" />
                      <span className="conversation-copy">
                        <strong>{conversation.title}</strong>
                        {conversationRun
                          ? <ConversationRunStatus key={conversationRun.runId} run={conversationRun} />
                          : <span>{agent?.name}</span>}
                      </span>
                      {conversation.mode === "agent_authoring" && !isRunning && (
                        <span className="conversation-draft-badge">
                          {isManagementSessionActive(managementSessions[conversation.id])
                            ? agent?.status === "초안" ? "설계 중" : "관리 중"
                            : "관리 잠김"}
                        </span>
                      )}
                      {isRunning && <LoaderCircle className="spin run-activity-spinner" size={14} />}
                    </button>
                  );
                })
              ) : (
                <div className="conversation-empty">
                  {normalizedConversationQuery ? <Search size={17} /> : workScope === "created" ? <Bot size={17} /> : <BriefcaseBusiness size={17} />}
                  <strong>{normalizedConversationQuery ? "검색 결과가 없어요" : "아직 시작한 작업이 없어요"}</strong>
                  {!normalizedConversationQuery && <button className="text-button" type="button" onClick={() => setModal({ type: "new-chat", scope: workScope })}>새 작업 시작</button>}
                </div>
              )}
            </div>
          </>
        ) : <div className="sidebar-spacer" />}

        <div className="sidebar-footer">
          <button className="workspace-button" type="button" onClick={chooseWorkspace}>
            <FolderOpen size={16} />
            <span>
              <small>작업 폴더</small>
              <strong>{shortPath(workspace)}</strong>
            </span>
            <ChevronRight size={15} />
          </button>
          <div className="profile-row">
            <span className="profile-avatar">
              {auth?.user?.avatarUrl ? (
                <img src={auth.user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                userInitials(auth?.user?.displayName)
              )}
            </span>
            <span className="profile-copy">
              <strong>{auth?.user?.displayName || "미리보기 사용자"}</strong>
              <small>{auth?.user?.email || "브라우저 미리보기"}</small>
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label="설정"
              title="설정"
              onClick={() => setAiSettingsOpen(true)}
              disabled={!window.hiremeDesktop}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}

      <main className="main-surface">
        {view === "studio" && (
          <StudioHome
            agents={ownedAgents}
            worker={creatorWorker}
            onCreate={() => setModal({ type: "new-agent" })}
            onSetWorkerAvailable={(available) => void setWorkerAvailable(available)}
            onApproveJob={(jobId, decision) => void approveCreatorJob(jobId, decision)}
            onOpenAgent={(agentId) => {
              setSelectedOwnedAgentId(agentId);
              setView("agents");
            }}
          />
        )}
        {view === "chat" && activeConversation && activeAgent && (
          <ChatView
            conversation={activeConversation}
            agent={activeAgent}
            run={runs[activeConversation.id]}
            queuedCount={queueCounts[activeConversation.id] || 0}
            managementActive={activeAuthoring}
            managementLocked={activeManagementLocked}
            onSend={sendMessage}
            onRetry={sendMessage}
            onNotify={showToast}
            onCancel={() => cancelRun(activeConversation.id)}
            onUnlockManagement={() => void openAgentManagement(activeAgent.id)}
            onOpenAgent={() => {
              if (activeAgent.ownership === "mine") setSelectedOwnedAgentId(activeAgent.id);
              else setSelectedAgentId(activeAgent.id);
              setModal({ type: "agent-profile", agentId: activeAgent.id });
            }}
            onDelete={() => setModal({ type: "delete-conversation", conversationId: activeConversation.id })}
          />
        )}

        {view === "chat" && !activeConversation && (
          <EmptyWorkScope
            scope={workScope}
            onStart={() => setModal({ type: "new-chat", scope: workScope })}
            onBrowse={() => navigateToView("discover")}
          />
        )}

        {view === "discover" && (
          <ProjectStartView
            agents={agents.filter((agent) => !isRetiredMockAgent(agent))}
            projects={designProjects.filter((project) => project.client_id === auth?.user?.id)}
            submitting={projectSubmitting}
            onCancel={(projectId) => void cancelDesignProject(projectId)}
            selectedAgentId={selectedAgentId}
            onSelect={(agentId) => {
              setSelectedAgentId(agentId);
              setModal({ type: "agent-profile", agentId });
            }}
            onSubmit={submitDesignProject}
          />
        )}

        {view === "agents" && (
          <MyAgentsView
            agents={agents.filter((agent) => agent.ownership === "mine")}
            selectedAgentId={selectedOwnedAgentId}
            onSelect={(agentId) => {
              setSelectedOwnedAgentId(agentId);
              setModal({ type: "agent-profile", agentId });
            }}
            onCreate={() => setModal({ type: "new-agent" })}
            onEdit={(agentId) => setModal({ type: "edit-agent", agentId })}
            onDelete={(agentId) => setModal({ type: "delete-agent", agentId })}
            onOpenEarnings={() => navigateToView("earnings")}
            onOpenReview={() => void openReviewInbox()}
            reviewer={reviewInbox?.reviewer === true}
            onManage={(agentId) => void openAgentManagement(agentId)}
          />
        )}

        {view === "earnings" && (
          <EarningsView
            agents={agents.filter((agent) => agent.ownership === "mine")}
            onOpenAgents={() => navigateToView("agents")}
            onOpenReview={() => void openReviewInbox()}
            reviewer={reviewInbox?.reviewer === true}
            onDownload={() => showToast("정산 내역을 내려받았어요", "CSV 파일은 다운로드 폴더에 저장됩니다.")}
            onPayout={() => showToast("정산 신청을 접수했어요", "등록된 계좌로 영업일 기준 2~3일 안에 처리됩니다.")}
          />
        )}

        {view === "review" && reviewInbox?.reviewer && (
          <ReviewInboxView
            inbox={reviewInbox}
            busyVersionId={reviewingVersionId}
            onRefresh={() => void openReviewInbox()}
            onDecide={decideReview}
            onOpenAgents={() => navigateToView("agents")}
            onOpenEarnings={() => navigateToView("earnings")}
          />
        )}
      </main>

      <aside className={`inspector ${managementInspectorOpen ? "private-harness-inspector" : ""}`} aria-hidden={inspectorClosed || undefined}>
        {managementInspectorOpen && activeAgent && activeConversation && activeManagementSession && (
          <PrivateHarnessInspector
            key={activeManagementSession.id}
            agent={activeAgent}
            conversation={activeConversation}
            managementSession={activeManagementSession}
            onNotify={showToast}
            onDirtyChange={setManagementDraftDirty}
            onSessionInvalid={invalidateManagementSession}
            onPublish={() => void publishVersion(activeAgent.id)}
            publishing={Boolean(publishingAgentIds[activeAgent.id])}
            runActive={Boolean(runs[activeConversation.id])}
            onRevisionChange={(phase, revision) => {
              setAgents((current) => current.map((item) => (
                item.id === activeAgent.id
                  ? { ...item, authoring: { ...item.authoring, phase, revision } }
                  : item
              )));
            }}
          />
        )}
        {view === "earnings" && <EarningsInspector onPayout={() => showToast("정산 신청을 접수했어요")} />}
      </aside>

      {conversationMenu && (
        <>
          <button className="context-menu-backdrop" type="button" aria-label="작업 메뉴 닫기" onClick={() => setConversationMenu(null)} />
          <div className="conversation-context-menu" role="menu" style={{ left: conversationMenu.x, top: conversationMenu.y }}>
            <button type="button" role="menuitem" onClick={() => {
              setModal({ type: "delete-conversation", conversationId: conversationMenu.conversationId });
              setConversationMenu(null);
            }}>
              <Trash2 size={15} /> 작업 삭제
            </button>
          </div>
        </>
      )}

      {modal?.type === "new-chat" && (
        <NewChatDialog
          agents={agents}
          initialScope={modal.scope}
          onSelect={createConversation}
          onBrowse={() => {
            if (!navigateToView("discover")) return;
            setModal(null);
          }}
          onCreateAgent={() => setModal({ type: "new-agent" })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "new-agent" && (
        <NewAgentDialog
          onClose={() => setModal(null)}
          onCreate={async (agent) => {
            if (!confirmDiscardManagementDraft(activeConversation?.id)) return;
            let authoring: AgentAuthoringState = { phase: "draft", revision: 1 };
            const conversationId = createEntityUuid();
            if (window.hiremeDesktop) {
              await window.hiremeDesktop.createAgentDraft({
                agentId: agent.id,
                name: agent.name,
                category: agent.category,
                headline: agent.headline,
                summary: agent.summary,
                creator: auth?.user?.displayName || "나",
                skills: agent.skills,
                resultTypes: agent.resultTypes,
                designSystem: agent.designSystem,
              });
              const ready = await window.hiremeDesktop.prepareAgentManagement({
                conversationId,
                agentId: agent.id,
                name: agent.name,
                category: agent.category,
                headline: agent.headline,
                summary: agent.summary,
                creator: auth?.user?.displayName || "나",
                skills: agent.skills,
                resultTypes: agent.resultTypes,
              });
              authoring = { phase: ready.phase, revision: ready.revision };
              setManagementSessions((current) => ({
                ...current,
                [conversationId]: ready.managementSession,
              }));
            }
            const nextAgent = { ...agent, authoring };
            setAgents((current) => [nextAgent, ...current]);
            setSelectedOwnedAgentId(agent.id);
            createConversationForAgent(nextAgent, {
              id: conversationId,
              mode: "agent_authoring",
              title: `${agent.name} 만들기`,
            });
            showToast("설계 대화를 시작했어요", "대화에서 일하는 방식과 기억을 함께 만들어 보세요.");
          }}
        />
      )}
      {modal?.type === "agent-profile" && (
        <AgentProfileDialog
          key={modal.agentId}
          agent={agents.find((agent) => agent.id === modal.agentId) ?? agents[0]}
          onClose={() => setModal(null)}
          onUse={(agentId) => {
            setModal(null);
            startAgentWork(agentId);
          }}
          onEdit={(agentId) => setModal({ type: "edit-agent", agentId })}
          onManage={(agentId) => {
            setModal(null);
            void openAgentManagement(agentId);
          }}
        />
      )}
      {modal?.type === "edit-agent" && (
        <EditAgentDialog
          agent={agents.find((agent) => agent.id === modal.agentId) ?? agents[0]}
          onClose={() => setModal(null)}
          onSave={async (updates) => {
            const target = agents.find((agent) => agent.id === modal.agentId);
            if (!target) return false;
            try {
              if (window.hiremeDesktop && updates.designSystem) {
                const conversationId = createEntityUuid();
                const ready = await window.hiremeDesktop.prepareAgentManagement({
                  conversationId,
                  agentId: target.id,
                  name: String(updates.name || target.name),
                  category: String(updates.category || target.category),
                  headline: String(updates.headline || target.headline),
                  summary: String(updates.summary || target.summary),
                  creator: auth?.user?.displayName || "나",
                  skills: updates.skills || target.skills,
                  resultTypes: updates.resultTypes || target.resultTypes,
                });
                try {
                  await window.hiremeDesktop.updateAgentDesignSystem({
                    conversationId,
                    agentId: target.id,
                    managementSessionId: ready.managementSession.id,
                    designSystem: updates.designSystem,
                  });
                } finally {
                  await window.hiremeDesktop.closeAgentManagement({
                    conversationId,
                    agentId: target.id,
                    managementSessionId: ready.managementSession.id,
                  }).catch(() => null);
                }
              }
              setAgents((current) => current.map((agent) => (
                agent.id === modal.agentId ? { ...agent, ...updates } : agent
              )));
              setSelectedOwnedAgentId(modal.agentId);
              setModal(null);
              showToast("디자인 서비스 기준을 저장했어요", updates.designSystem ? "비공개 판단 시스템과 고객 질문을 함께 업데이트했습니다." : undefined);
              return true;
            } catch (error) {
              showToast("디자인 서비스 기준을 저장하지 못했어요", publicErrorMessage(error));
              return false;
            }
          }}
        />
      )}
      {modal?.type === "delete-conversation" && (
        <Dialog title="이 작업을 삭제할까요?" subtitle="대화와 첨부 기록이 작업 목록에서 영구적으로 삭제됩니다." onClose={() => setModal(null)}>
          <div className="delete-conversation-dialog">
            <p>{conversations.find((conversation) => conversation.id === modal.conversationId)?.title || "선택한 작업"}</p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setModal(null)}>취소</button>
              <button className="danger-button" type="button" onClick={() => void removeConversation(modal.conversationId)}><Trash2 size={15} /> 삭제</button>
            </div>
          </div>
        </Dialog>
      )}
      {modal?.type === "delete-agent" && (() => {
        const agent = agents.find((item) => item.id === modal.agentId);
        if (!agent) return null;
        return <Dialog title="에이전트를 삭제할까요?" subtitle="이 에이전트의 로컬 하네스와 관리 대화가 함께 삭제됩니다. 공개된 에이전트는 목록에서도 내려갑니다." onClose={() => setModal(null)}>
          <div className="delete-conversation-dialog">
            <p>{agent.name}</p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setModal(null)}>취소</button>
              <button className="danger-button" type="button" onClick={async () => {
                try {
                  if (window.hiremeDesktop) await window.hiremeDesktop.deleteAgent({ agentId: agent.id, databaseId: agent.databaseId });
                  const relatedConversations = conversations.filter((conversation) => conversation.agentId === agent.id);
                  setConversations((current) => current.filter((conversation) => conversation.agentId !== agent.id));
                  setAgents((current) => current.filter((item) => item.id !== agent.id));
                  setManagementSessions((current) => {
                    const next = { ...current };
                    relatedConversations.forEach((conversation) => delete next[conversation.id]);
                    return next;
                  });
                  if (activeConversation?.agentId === agent.id) setActiveConversationId("");
                  setModal(null);
                  showToast("에이전트를 삭제했어요");
                } catch (error) {
                  showToast("에이전트를 삭제하지 못했어요", publicErrorMessage(error));
                }
              }}><Trash2 size={15} /> 삭제</button>
            </div>
          </div>
        </Dialog>;
      })()}

      {(aiSettingsOpen || (Boolean(window.hiremeDesktop) && auth?.user?.aiSetupCompleted === false)) && auth?.user && (
        <AiSettingsDialog
          user={auth.user}
          required={!auth.user.aiSetupCompleted}
          onClose={() => setAiSettingsOpen(false)}
          onSaved={() => {
            setAiSettingsOpen(false);
            showToast("작업에 사용할 AI를 저장했어요");
          }}
          onLogout={async () => {
            if (!confirmDiscardManagementDraft(activeConversation?.id)) return;
            await onLogout();
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <CheckCircle2 size={18} />
          <span>
            <strong>{toast.title}</strong>
            {toast.detail && <small>{toast.detail}</small>}
          </span>
          <button className="icon-button" type="button" aria-label="알림 닫기" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function AiSettingsDialog({
  user,
  required,
  onClose,
  onSaved,
  onLogout,
}: {
  user: HireMeDesktopAuthUser;
  required: boolean;
  onClose: () => void;
  onSaved: () => void;
  onLogout: () => Promise<void>;
}) {
  const bridge = window.hiremeDesktop;
  const [settings, setSettings] = useState<HireMeDesktopAiSettings | null>(null);
  const [selected, setSelected] = useState<"codex" | "ollama">("codex");
  const [ollamaModel, setOllamaModel] = useState("");
  const [busy, setBusy] = useState<"connect" | "disconnect" | "refresh" | "save" | "logout" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const applySettings = useCallback((next: HireMeDesktopAiSettings) => {
    setSettings(next);
    if (!initialized.current) {
      setSelected(next.selected);
      initialized.current = true;
    }
    setOllamaModel((current) => (
      next.ollama.models.some((model) => model.id === current)
        ? current
        : next.ollama.selectedModel || next.ollama.models[0]?.id || ""
    ));
  }, []);

  const refresh = useCallback(async (showBusy = true) => {
    if (!bridge) return;
    if (showBusy) setBusy("refresh");
    setError(null);
    try {
      applySettings(await bridge.getAiSettings());
    } catch (nextError) {
      setError(publicAiSettingsError(nextError));
    } finally {
      if (showBusy) setBusy(null);
    }
  }, [applySettings, bridge]);

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;
    const removeListener = bridge.onAiSettingsChanged(applySettings);
    void bridge.getAiSettings()
      .then((next) => {
        if (!disposed) applySettings(next);
      })
      .catch((nextError) => {
        if (!disposed) setError(publicAiSettingsError(nextError));
      });
    return () => {
      disposed = true;
      removeListener();
    };
  }, [applySettings, bridge]);

  const connectCodex = async () => {
    if (!bridge || busy) return;
    setBusy("connect");
    setError(null);
    setSelected("codex");
    try {
      applySettings(await bridge.connectCodex());
    } catch (nextError) {
      setError(publicAiSettingsError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const cancelConnect = async () => {
    if (!bridge) return;
    await bridge.cancelAiConnection().catch(() => false);
  };

  const disconnectCodex = async () => {
    if (!bridge || busy) return;
    setBusy("disconnect");
    setError(null);
    try {
      applySettings(await bridge.disconnectCodex());
    } catch (nextError) {
      setError(publicAiSettingsError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!bridge || !settings || busy) return;
    setBusy("save");
    setError(null);
    try {
      const result = await bridge.saveAiSettings({
        provider: selected,
        model: selected === "ollama" ? ollamaModel : null,
      });
      applySettings(result.settings);
      onSaved();
    } catch (nextError) {
      setError(publicAiSettingsError(nextError));
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    if (busy) return;
    setBusy("logout");
    setError(null);
    try {
      await onLogout();
    } catch (nextError) {
      setError(publicAiSettingsError(nextError));
      setBusy(null);
    }
  };

  const codexReady = settings?.codex.connected === true;
  const ollamaReady = settings?.ollama.available === true && Boolean(ollamaModel);
  const canSave = selected === "codex" ? codexReady : ollamaReady;

  return (
    <Dialog
      title="작업에 사용할 AI"
      subtitle={required
        ? "HireMe가 일을 맡길 AI를 한 번 선택해 주세요."
        : "연결 방식을 바꾸면 다음 작업부터 적용됩니다."}
      onClose={onClose}
      closeable={!required}
      wide
    >
      <div className="ai-settings">
        {!settings ? (
          <div className="ai-settings-loading" role="status">
            <LoaderCircle className="spin" size={19} />
            이 컴퓨터에서 사용할 수 있는 AI를 확인하고 있어요
          </div>
        ) : (
          <div className="ai-choice-list" role="radiogroup" aria-label="작업에 사용할 AI 선택">
            <section className={`ai-choice ${selected === "codex" ? "selected" : ""}`}>
              <button
                className="ai-choice-select"
                type="button"
                role="radio"
                aria-checked={selected === "codex"}
                onClick={() => setSelected("codex")}
              >
                <span className="ai-choice-icon codex"><Sparkles size={19} /></span>
                <span className="ai-choice-copy">
                  <strong>ChatGPT 계정으로 사용</strong>
                  <small>ChatGPT 계정을 연결해 문서, 이미지, 파일 작업을 처리합니다.</small>
                </span>
                <span className={`connection-state ${settings.codex.connected ? "ready" : ""}`}>
                  {settings.codex.connecting
                    ? "연결 중"
                    : settings.codex.connected
                      ? "연결됨"
                      : "연결 필요"}
                </span>
              </button>
              <div className="ai-choice-actions">
                {settings.codex.connecting || busy === "connect" ? (
                  <>
                    <span><LoaderCircle className="spin" size={14} /> 브라우저에서 로그인을 마쳐 주세요</span>
                    <button className="text-button danger" type="button" onClick={() => void cancelConnect()}>
                      취소
                    </button>
                  </>
                ) : settings.codex.connected ? (
                  <>
                    <span><CheckCircle2 size={14} /> 이 기기에 안전하게 연결되어 있어요</span>
                    <button className="text-button" type="button" onClick={() => void disconnectCodex()} disabled={Boolean(busy)}>
                      연결 해제
                    </button>
                  </>
                ) : (
                  <>
                    <span>브라우저에서 ChatGPT 로그인을 한 번 진행합니다.</span>
                    <button className="secondary-button compact" type="button" onClick={() => void connectCodex()} disabled={Boolean(busy)}>
                      계정 연결
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className={`ai-choice ${selected === "ollama" ? "selected" : ""}`}>
              <button
                className="ai-choice-select"
                type="button"
                role="radio"
                aria-checked={selected === "ollama"}
                onClick={() => setSelected("ollama")}
              >
                <span className="ai-choice-icon local"><HardDrive size={19} /></span>
                <span className="ai-choice-copy">
                  <strong>Ollama</strong>
                  <small>내 컴퓨터에 설치된 모델로 작업하며 내용이 기기 밖으로 전송되지 않습니다.</small>
                </span>
                <span className={`connection-state ${ollamaReady ? "ready" : ""}`}>
                  {ollamaReady ? "사용 가능" : settings.ollama.available ? "모델 필요" : "찾지 못함"}
                </span>
              </button>
              <div className="ai-choice-actions local-actions">
                {settings.ollama.models.length > 0 ? (
                  <label>
                    <span><Cpu size={14} /> 사용할 모델</span>
                    <select value={ollamaModel} onChange={(event) => { setOllamaModel(event.target.value); setSelected("ollama"); }}>
                      {settings.ollama.models.map((model) => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span>Ollama를 켜고 모델을 준비하면 여기에 표시됩니다.</span>
                )}
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Ollama 다시 확인"
                  title="다시 확인"
                  onClick={() => void refresh()}
                  disabled={Boolean(busy)}
                >
                  <RefreshCw className={busy === "refresh" ? "spin" : ""} size={15} />
                </button>
              </div>
            </section>
          </div>
        )}

        {error && <p className="ai-settings-error" role="alert">{error}</p>}

        <div className="ai-privacy-note">
          <ShieldCheck size={17} />
          <span>
            <strong>AI 로그인 정보는 이 기기에만 보관됩니다</strong>
            <small>HireMe 계정에는 선택한 방식만 저장하며 인증 정보는 업로드하지 않습니다.</small>
          </span>
        </div>

        <div className="ai-account-row">
          <span className="profile-avatar">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              : userInitials(user.displayName)}
          </span>
          <span>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </span>
          <button className="text-button" type="button" onClick={() => void logout()} disabled={Boolean(busy)}>
            <LogOut size={14} /> 로그아웃
          </button>
        </div>

        <div className="dialog-actions ai-settings-actions">
          {!required && <button className="secondary-button" type="button" onClick={onClose}>취소</button>}
          <button className="primary-button" type="button" onClick={() => void save()} disabled={!settings || !canSave || Boolean(busy)}>
            {busy === "save" ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
            이 AI 사용하기
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function AuthGate({
  state,
  busy,
  error,
  onLogin,
}: {
  state: HireMeDesktopAuthState | null;
  busy: boolean;
  error: string | null;
  onLogin: () => Promise<void>;
}) {
  const loading = !state && !error;
  const configured = state?.configured !== false;
  return (
    <div className="auth-app">
      <div className="titlebar auth-titlebar">
        <span className="titlebar-name">HireMe</span>
      </div>
      <main className="auth-surface">
        <section className="auth-panel" aria-labelledby="auth-title">
          <img className="auth-logo" src={appAssetUrl("/assets/Logo.png")} alt="HireMe" />
          <div className="auth-heading">
            <h1 id="auth-title">HireMe에 로그인</h1>
            <p>내 에이전트와 작업을 한 계정에서 이어가세요.</p>
          </div>

          {loading ? (
            <div className="auth-loading" role="status">
              <LoaderCircle className="spin" size={19} />
              로그인 상태 확인 중
            </div>
          ) : (
            <button
              className="google-login-button"
              type="button"
              onClick={() => void onLogin()}
              disabled={!configured}
            >
              {busy ? <LoaderCircle className="spin" size={18} /> : <span className="google-mark">G</span>}
              {busy ? "브라우저에서 로그인 중" : "Google로 계속하기"}
            </button>
          )}

          {busy && configured && (
            <button className="auth-retry" type="button" onClick={() => void onLogin()}>
              로그인 창 다시 열기
            </button>
          )}

          {!configured && (
            <p className="auth-error" role="alert">
              로그인 구성이 완료되지 않았습니다. 앱 관리자에게 문의해 주세요.
            </p>
          )}
          {error && configured && <p className="auth-error" role="alert">{error}</p>}

          <div className="auth-security-note">
            <LockKeyhole size={15} />
            <span>로그인 세션은 이 기기의 운영체제 보안 저장소에 보관됩니다.</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyWorkScope({
  scope,
  onStart,
  onBrowse,
}: {
  scope: WorkScope;
  onStart: () => void;
  onBrowse: () => void;
}) {
  const created = scope === "created";
  return (
    <section className="empty-work-scope">
      <span className={created ? "created" : "hired"}>
        {created ? <Bot size={22} /> : <BriefcaseBusiness size={22} />}
      </span>
      <h1>{created ? "내 디자인 서비스의 고객 경험을 테스트하세요" : "전문가가 설계한 디자인 서비스에 맡겨보세요"}</h1>
      <p>{created
        ? "고객이 보게 될 질문부터 결과의 품질 검사까지 그대로 확인할 수 있어요."
        : "빈 프롬프트 대신 디자이너가 준비한 질문에 답하면 기준에 맞는 결과를 받을 수 있어요."}</p>
      <div>
        <button className="primary-button" type="button" onClick={onStart}>
          <Plus size={16} /> 새 디자인 주문
        </button>
        {!created && (
          <button className="secondary-button" type="button" onClick={onBrowse}>
            <Compass size={16} /> 서비스 찾기
          </button>
        )}
      </div>
    </section>
  );
}

function ConversationRunStatus({ run }: { run: RunState }) {
  const elapsed = useElapsed(run.startedAt);
  const label = formatElapsed(elapsed);
  return (
    <span className="conversation-run-status" role="timer" aria-label={`작업 경과 시간 ${label}`}>
      작업 중 · {label}
    </span>
  );
}

function ChatView({
  conversation,
  agent,
  run,
  queuedCount,
  managementActive,
  managementLocked,
  onSend,
  onRetry,
  onNotify,
  onCancel,
  onUnlockManagement,
  onOpenAgent,
  onDelete,
}: {
  conversation: Conversation;
  agent: Agent;
  run?: RunState;
  queuedCount: number;
  managementActive: boolean;
  managementLocked: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onRetry: (text: string, attachments: Attachment[]) => void;
  onNotify: (title: string, detail?: string) => void;
  onCancel: () => void;
  onUnlockManagement: () => void;
  onOpenAgent: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const authoring = managementActive;
  const designIntake = Boolean(
    !authoring &&
    conversation.messages.length === 0 &&
    agent.designSystem?.questions.length,
  );
  const designWorkspace = Boolean(
    !authoring &&
    conversation.messages.length > 0 &&
    agent.designSystem,
  );
  const latestMessageText = conversation.messages.at(-1)?.text || "";

  useEffect(() => {
    if (designIntake || designWorkspace) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length, designIntake, designWorkspace, latestMessageText, run?.steps.length]);

  const submit = (textOverride?: string) => {
    const message = textOverride ?? draft;
    if (!message.trim() && attachments.length === 0) return;
    onSend(message, attachments);
    setDraft("");
    setAttachments([]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const pickFiles = async () => {
    if (window.hiremeDesktop) {
      try {
        const files = await window.hiremeDesktop.pickFiles();
        if (files?.length) setAttachments((current) => [...current, ...files].slice(0, 10));
      } catch (error) {
        onNotify("파일을 첨부하지 못했어요", publicErrorMessage(error));
      }
      return;
    }
    setAttachments((current) => [...current, { name: "reference-image.png" }]);
  };

  if (managementLocked) {
    return (
      <section className="chat-view management-locked-view">
        <header className="chat-header">
          <button className="agent-heading-button locked" type="button" onClick={onOpenAgent} aria-label={`${agent.name} 정보 보기`} title="에이전트 정보">
            <AgentAvatar agent={agent} size="medium" />
            <span><strong>{agent.name}</strong><small><LockKeyhole size={11} /> 관리 모드 잠김</small></span>
          </button>
          <button className="icon-button chat-delete-button" type="button" aria-label="작업 삭제" title="작업 삭제" onClick={onDelete}>
            <Trash2 size={17} />
          </button>
        </header>
        <div className="management-locked-content">
          <span><LockKeyhole size={24} /></span>
          <h1>Private Harness가 잠겨 있어요</h1>
          <p>관리 권한은 대화 문장이나 저장된 화면 상태로 복원되지 않습니다. 내 에이전트에서 관리 모드를 다시 열어 주세요.</p>
          <button className="primary-button" type="button" onClick={onUnlockManagement}>
            <ShieldCheck size={16} /> 검증된 관리 세션 열기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`chat-view ${designWorkspace ? "design-workspace-view" : ""}`}>
      <header className="chat-header">
        <button
          className={`agent-heading-button ${authoring ? "authoring" : ""}`}
          type="button"
          onClick={onOpenAgent}
          aria-label={`${agent.name} 정보 보기`}
          title="에이전트 정보"
        >
          <AgentAvatar agent={agent} size="medium" />
          <span>
            <strong>{agent.name}</strong>
            <small>{authoring
              ? <><span className="authoring-status-dot" /> {agent.status === "초안" ? "설계 중" : "관리 모드"}</>
              : designWorkspace
                ? <><span className="workspace-status-dot" /> 디자인 작업실</>
                : <PendingPrice agent={agent} compact />}</small>
          </span>
        </button>
        <div className="chat-header-actions">
          <button className="icon-button chat-delete-button" type="button" aria-label="작업 삭제" title="작업 삭제" onClick={onDelete}>
            <Trash2 size={17} />
          </button>
        </div>
      </header>

      {designWorkspace && agent.designSystem ? (
        <DesignWorkEnvironment
          conversation={conversation}
          agent={agent}
          system={agent.designSystem}
          run={run}
          queuedCount={queuedCount}
          draft={draft}
          attachments={attachments}
          onDraftChange={setDraft}
          onKeyDown={onKeyDown}
          onSubmit={submit}
          onPickFiles={() => void pickFiles()}
          onRemoveFile={(index) => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
          onRetry={onRetry}
          onCancel={onCancel}
        />
      ) : (
        <div className="messages-scroll">
          <div className={`messages-column ${designIntake ? "design-intake-column" : ""}`}>
            {conversation.messages.length === 0 ? (
              designIntake && agent.designSystem ? (
                <DesignServiceIntake
                  agent={agent}
                  system={agent.designSystem}
                  attachments={attachments}
                  onPickFiles={() => void pickFiles()}
                  onRemoveFile={(index) => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  onSubmit={(summary) => {
                    onSend(summary, attachments);
                    setAttachments([]);
                  }}
                />
              ) : (
                <EmptyConversation agent={agent} authoring={authoring} onPrompt={setDraft} />
              )
            ) : (
              conversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} agent={agent} onRetry={onRetry} />
              ))
            )}
            {run && <RunProgress key={run.runId} run={run} agent={agent} queuedCount={queuedCount} onCancel={onCancel} />}
            <div ref={endRef} />
          </div>
        </div>
      )}

      {!designIntake && !designWorkspace && <div className="composer-area">
        <div className="composer-shell">
          {attachments.length > 0 && (
            <div className="attachment-strip">
              {attachments.map((attachment, index) => (
                <span className={`attachment-chip ${isImageFile(attachment) ? "image" : ""}`} key={`${attachment.name}-${index}`}>
                  <FileThumbnail file={attachment} />
                  <span className="attachment-chip-name">{attachment.name}</span>
                  <button
                    type="button"
                    aria-label={`${attachment.name} 제거`}
                    onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={authoring ? `${agent.name}가 어떻게 일해야 하는지 알려주세요` : `${agent.name}에게 일을 맡겨보세요`}
            rows={2}
            aria-label="메시지 입력"
          />
          <div className="composer-controls">
            <div className="composer-left">
              <button className="icon-button" type="button" aria-label="파일 첨부" title="파일 첨부" onClick={pickFiles}>
                <Paperclip size={18} />
              </button>
              <span className="cost-hint">
                <Brain size={13} />
                {authoring ? "작업 방식을 고치거나 현재 결과를 바로 확인" : "이 대화의 기억에 반영"}
              </span>
            </div>
            <button
              className="send-button"
              type="button"
              aria-label={run ? "대기열에 추가" : "보내기"}
              title={run ? "대기열에 추가" : "보내기"}
              disabled={!draft.trim() && attachments.length === 0}
              onClick={() => submit()}
            >
              <Send size={17} />
            </button>
          </div>
        </div>
        <p className="composer-note">
          Enter로 보내기 · Shift + Enter로 줄바꿈{run ? " · 지금 보내면 대기열에 추가됩니다" : ""}
        </p>
      </div>}
    </section>
  );
}

function DesignWorkEnvironment({
  conversation,
  agent,
  system,
  run,
  queuedCount,
  draft,
  attachments,
  onDraftChange,
  onKeyDown,
  onSubmit,
  onPickFiles,
  onRemoveFile,
  onRetry,
  onCancel,
}: {
  conversation: Conversation;
  agent: Agent;
  system: DesignDecisionSystem;
  run?: RunState;
  queuedCount: number;
  draft: string;
  attachments: Attachment[];
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (textOverride?: string) => void;
  onPickFiles: () => void;
  onRemoveFile: (index: number) => void;
  onRetry: (text: string, attachments: Attachment[]) => void;
  onCancel: () => void;
}) {
  const completedResults = conversation.messages.filter((message) => message.role === "assistant" && !message.streaming);
  const latestResult = completedResults.at(-1);
  const [selectedResultId, setSelectedResultId] = useState(latestResult?.id || "");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const firstRequest = conversation.messages.find((message) => message.role === "user");
  const threadMessages = conversation.messages.filter((message) => message.id !== firstRequest?.id);
  const selectedResult = completedResults.find((message) => message.id === selectedResultId) || latestResult;
  const selectedArtifact =
    selectedResult?.artifacts?.find(isImageFile) ||
    selectedResult?.artifacts?.[0];
  const priorityCount = system.priorityCount ?? system.priorities.length;
  const qualityCount = system.qualityBarCount ?? system.qualityBar.length;
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    if (!latestResult?.id) return;
    const timer = window.setTimeout(() => setSelectedResultId(latestResult.id), 0);
    return () => window.clearTimeout(timer);
  }, [latestResult?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length, run?.steps.length]);

  return (
    <div className="design-work-environment">
      <aside className="design-work-thread">
        <header className="work-thread-header">
          <div>
            <span className="eyebrow">Feedback</span>
            <h2>수정 요청</h2>
          </div>
          <span className={`work-thread-state ${run ? "working" : latestResult ? "ready" : "waiting"}`}>
            {run ? <><LoaderCircle className="spin" size={12} /> 제작 중</> : latestResult ? <><Check size={12} /> 결과 도착</> : "대기"}
          </span>
        </header>

        <div className="work-thread-scroll">
          {firstRequest && (
            <details className="work-brief-card">
              <summary>
                <span><ReceiptText size={14} /><strong>작업 주문서</strong></span>
                <ChevronRight size={14} />
              </summary>
              <p>{firstRequest.text}</p>
              {firstRequest.attachments?.length ? (
                <div className="work-brief-files">
                  {firstRequest.attachments.map((file, index) => (
                    <span key={`${file.name}-${index}`}><FileThumbnail file={file} />{file.name}</span>
                  ))}
                </div>
              ) : null}
            </details>
          )}

          <div className="work-thread-guide">
            <MessageCircleQuestion size={15} />
            <span><strong>결과를 보면서 말해 주세요</strong><small>전체 방향은 여기에서, 특정 요소는 캔버스를 기준으로 요청하면 됩니다.</small></span>
          </div>

          <div className="work-thread-messages">
            {threadMessages.map((message) => (
              <MessageBubble key={message.id} message={message} agent={agent} onRetry={onRetry} />
            ))}
            {run && <RunProgress key={run.runId} run={run} agent={agent} queuedCount={queuedCount} onCancel={onCancel} />}
            <div ref={threadEndRef} />
          </div>
        </div>

        <div className="workspace-composer">
          {selectedRegion && <div className="selected-region-chip"><PenLine size={13} /><span>선택 영역이 수정 요청에 포함됩니다</span><button type="button" aria-label="선택 영역 지우기" onClick={() => setSelectedRegion(null)}><X size={12} /></button></div>}
          {attachments.length > 0 && (
            <div className="attachment-strip">
              {attachments.map((attachment, index) => (
                <span className={`attachment-chip ${isImageFile(attachment) ? "image" : ""}`} key={`${attachment.name}-${index}`}>
                  <FileThumbnail file={attachment} />
                  <span className="attachment-chip-name">{attachment.name}</span>
                  <button type="button" aria-label={`${attachment.name} 제거`} onClick={() => onRemoveFile(index)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="예: 표정은 유지하고 배경 대비만 낮춰 주세요"
            rows={3}
            aria-label="디자인 수정 요청"
          />
          <div>
            <button className="icon-button" type="button" aria-label="참고 파일 첨부" title="참고 파일 첨부" onClick={onPickFiles}>
              <Paperclip size={17} />
            </button>
            <small>수정 요청도 같은 판단 기준으로 처리됩니다</small>
            <button className="send-button" type="button" aria-label={run ? "수정 요청 대기열에 추가" : "수정 요청 보내기"} disabled={!draft.trim() && attachments.length === 0} onClick={() => onSubmit(selectedRegion ? `[선택 영역 수정: ${selectedRegion}]\n${draft}` : undefined)}>
              <Send size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="design-canvas-panel">
        <header className="design-canvas-toolbar">
          <div>
            <span className="eyebrow">Canvas</span>
            <strong>{selectedArtifact?.name || (run ? "결과를 만드는 중" : "결과 미리보기")}</strong>
          </div>
          <div>
            <span className="canvas-fit-label">화면 맞춤</span>
            <button
              className="secondary-button compact"
              type="button"
              disabled={!selectedArtifact?.path}
              onClick={() => selectedArtifact && openWorkspaceFile(selectedArtifact)}
            >
              <ArrowUpRight size={13} /> 원본 열기
            </button>
          </div>
        </header>

        <div className="design-canvas-stage">
          <DesignCanvasResult
            result={selectedResult}
            artifact={selectedArtifact}
            agent={agent}
            run={run}
            onRegionChange={setSelectedRegion}
          />
          {run && selectedResult && (
            <span className="canvas-working-pill"><LoaderCircle className="spin" size={12} /> 새 버전을 제작하고 있어요</span>
          )}
        </div>

        <footer className="design-version-bar">
          <span><Clock3 size={13} /> Versions</span>
          <div>
            {completedResults.length ? completedResults.map((result, index) => (
              <button
                className={result.id === selectedResult?.id ? "active" : ""}
                type="button"
                key={result.id}
                onClick={() => setSelectedResultId(result.id)}
              >
                V{index + 1}
              </button>
            )) : <small>첫 결과가 만들어지면 버전이 여기에 저장됩니다.</small>}
          </div>
        </footer>
      </main>

      <aside className="design-standards-panel">
        <header>
          <span className="eyebrow">Expert System</span>
          <h2>디자이너의 기준</h2>
          <p>{system.purpose}</p>
        </header>

        <div className="workspace-stage-flow" aria-label="작업 진행 단계">
          <span className="complete"><Check size={11} /> 요청</span>
          <i />
          <span className={run ? "active" : latestResult ? "complete" : ""}>{latestResult && !run ? <Check size={11} /> : "2"} 제작</span>
          <i />
          <span className={run ? "waiting" : latestResult ? "complete" : ""}>{latestResult && !run ? <Check size={11} /> : "3"} 기준 확인</span>
        </div>

        <section className="workspace-standard-list">
          <div><MessageCircleQuestion size={15} /><span><strong>요청 맥락</strong><small>{system.questions.length}개 질문 답변 반영</small></span><CheckCircle2 size={15} /></div>
          <div><Target size={15} /><span><strong>판단 우선순위</strong><small>{priorityCount}개 전문 기준 적용</small></span><ShieldCheck size={15} /></div>
          <div><ListChecks size={15} /><span><strong>품질 기준</strong><small>{qualityCount}개 기준으로 결과 확인</small></span>{run ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}</div>
        </section>

        <section className="protected-standard-note">
          <LockKeyhole size={14} />
          <p><strong>전문 기준은 보호됩니다</strong>세부 규칙은 공개하지 않고 모든 결과와 수정본에 일관되게 적용합니다.</p>
        </section>

        <section className="workspace-delivery-status">
          <span>현재 상태</span>
          <strong>{run ? "제작·기준 확인 중" : latestResult ? "결과 확인 가능" : "제작 대기"}</strong>
          <small>{run ? "완료되면 캔버스와 버전에 자동 반영됩니다." : latestResult ? "캔버스를 확인하고 필요한 부분만 수정 요청하세요." : "주문서를 바탕으로 작업을 준비하고 있습니다."}</small>
        </section>
      </aside>
    </div>
  );
}

function DesignCanvasResult({
  result,
  artifact,
  agent,
  run,
  onRegionChange,
}: {
  result?: ChatMessage;
  artifact?: Attachment;
  agent: Agent;
  run?: RunState;
  onRegionChange: (region: string | null) => void;
}) {
  const previewFile = artifact || { name: "result-preview" };
  const { source, onError } = useFilePreview(previewFile);

  if (artifact && isImageFile(artifact) && source) {
    return (
      <RegionEditCanvas source={source} artifact={artifact} onError={onError} onRegionChange={onRegionChange} />
    );
  }

  if (result) {
    return (
      <article className="design-canvas-text-result">
        <span><AgentAvatar agent={agent} size="small" /> {agent.name} 결과</span>
        <p>{result.text}</p>
        {artifact && (
          <button type="button" disabled={!artifact.path} onClick={() => openWorkspaceFile(artifact)}>
            <FileText size={16} /><span><strong>{artifact.name}</strong><small>{artifact.size ? formatFileSize(artifact.size) : "결과 파일"}</small></span><ArrowUpRight size={14} />
          </button>
        )}
      </article>
    );
  }

  return (
    <div className="design-canvas-empty">
      {run ? <LoaderCircle className="spin" size={25} /> : <LayoutGrid size={25} />}
      <strong>{run ? "디자이너의 기준으로 제작하고 있어요" : "결과가 이 캔버스에 표시됩니다"}</strong>
      <p>{run ? "요청을 해석한 뒤 결과를 만들고 품질 기준을 적용합니다." : "작업 주문서를 보내면 채팅이 아니라 실제 결과를 중심으로 작업할 수 있어요."}</p>
    </div>
  );
}

function RegionEditCanvas({ source, artifact, onError, onRegionChange }: { source: string; artifact: Attachment; onError: () => void; onRegionChange: (region: string | null) => void }) {
  const [marking, setMarking] = useState(false);
  const [strokes, setStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointFor = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  };
  const startMark = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marking) return;
    const point = pointFor(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setStrokes((current) => [...current, [point]]);
  };
  const drawMark = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marking || event.buttons !== 1) return;
    const point = pointFor(event);
    if (!point) return;
    setStrokes((current) => current.length ? [...current.slice(0, -1), [...current.at(-1)!, point]] : current);
  };
  const clearMarks = () => { setStrokes([]); onRegionChange(null); };
  useEffect(() => {
    onRegionChange(strokes.length ? `${strokes.length}개 브러시 마크` : null);
  }, [strokes.length, onRegionChange]);
  return <div className={`region-edit-canvas ${marking ? "marking" : ""}`} ref={canvasRef} onPointerDown={startMark} onPointerMove={drawMark}>
    <img src={source} alt={artifact.name} onError={onError} draggable={false} />
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {strokes.map((stroke, index) => <polyline key={index} points={stroke.map((point) => `${point.x},${point.y}`).join(" ")} />)}
    </svg>
    <div className="region-edit-toolbar">
      <button className={marking ? "active" : ""} type="button" onClick={() => setMarking((current) => !current)}><PenLine size={13} /> {marking ? "영역 칠하기 중" : "영역 수정"}</button>
      {strokes.length > 0 && <button type="button" onClick={clearMarks}><RefreshCw size={13} /> 지우기</button>}
      {!marking && <button type="button" onClick={() => artifact.path && openWorkspaceFile(artifact)} disabled={!artifact.path}><ArrowUpRight size={13} /> 원본</button>}
    </div>
    {marking && <span className="region-edit-hint">수정할 부분을 드래그해 칠한 뒤, 왼쪽에 원하는 변경을 적어 주세요.</span>}
  </div>;
}

function DesignServiceIntake({
  agent,
  system,
  attachments,
  onPickFiles,
  onRemoveFile,
  onSubmit,
}: {
  agent: Agent;
  system: DesignDecisionSystem;
  attachments: Attachment[];
  onPickFiles: () => void;
  onRemoveFile: (index: number) => void;
  onSubmit: (summary: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const questions = system.questions;
  const complete = questions.every((question) => {
    if (!question.required) return true;
    const answer = answers[question.id];
    return Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim());
  });

  const setChoice = (question: DesignQuestion, option: string) => {
    if (question.kind === "multi") {
      setAnswers((current) => {
        const selected = Array.isArray(current[question.id]) ? current[question.id] as string[] : [];
        return {
          ...current,
          [question.id]: selected.includes(option)
            ? selected.filter((item) => item !== option)
            : [...selected, option],
        };
      });
      return;
    }
    setAnswers((current) => ({ ...current, [question.id]: option }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!complete) return;
    const answerLines = questions
      .map((question) => {
        const answer = answers[question.id];
        const value = Array.isArray(answer) ? answer.join(", ") : answer?.trim();
        return value ? `- ${question.label}\n  ${value}` : "";
      })
      .filter(Boolean)
      .join("\n");
    onSubmit([
      `${agent.name} 작업 주문서`,
      "",
      answerLines,
      attachments.length ? `\n첨부 자료: ${attachments.map((file) => file.name).join(", ")}` : "",
      "",
      "위 답변을 바탕으로 디자이너가 설정한 판단 기준과 품질 검사를 적용해 결과를 만들어 주세요.",
    ].join("\n"));
  };

  return (
    <form className="design-service-intake" onSubmit={submit}>
      <header className="design-intake-hero">
        <div className="design-intake-step"><span>1</span> 작업 정보 <i /> <span>2</span> 제작·검증</div>
        <div className="design-intake-title">
          <AgentAvatar agent={agent} size="large" />
          <div>
            <span className="eyebrow">Designed by {agent.creator}</span>
            <h1>{agent.name}에 작업을 맡겨볼게요</h1>
            <p>{agent.headline}</p>
          </div>
        </div>
        <div className="design-system-promise">
          <ShieldCheck size={17} />
          <span><strong>디자이너의 판단 시스템 적용</strong><small>답변을 받은 뒤 정보 위계, 금지 규칙과 통과 기준을 자동으로 검사합니다.</small></span>
        </div>
      </header>

      <div className="design-intake-body">
        <div className="ask-question-heading">
          <div><span>Ask Questions</span><h2>좋은 결과를 위해 먼저 확인할게요</h2></div>
          <small>필수 {questions.filter((question) => question.required).length}개</small>
        </div>

        <div className="design-question-list">
          {questions.map((question, index) => {
            const value = answers[question.id];
            return (
              <fieldset className="design-question" key={question.id}>
                <legend><span>{String(index + 1).padStart(2, "0")}</span>{question.label}{question.required && <i>필수</i>}</legend>
                {question.helper && <p>{question.helper}</p>}
                {(question.kind === "single" || question.kind === "multi") ? (
                  <div className="design-question-options">
                    {(question.options || []).map((option) => {
                      const active = Array.isArray(value) ? value.includes(option) : value === option;
                      return <button className={active ? "active" : ""} type="button" key={option} onClick={() => setChoice(question, option)}>{active && <Check size={13} />}{option}</button>;
                    })}
                  </div>
                ) : question.kind === "long" ? (
                  <textarea value={typeof value === "string" ? value : ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="맥락을 자유롭게 적어 주세요" rows={3} />
                ) : (
                  <input value={typeof value === "string" ? value : ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="한 문장으로 적어 주세요" />
                )}
              </fieldset>
            );
          })}
        </div>

        <section className="design-reference-upload">
          <div><Paperclip size={16} /><span><strong>참고 자료</strong><small>기존 시안, 로고, 제품 이미지가 있다면 함께 넣어 주세요.</small></span></div>
          <button className="secondary-button compact" type="button" onClick={onPickFiles}>파일 추가</button>
          {attachments.length > 0 && <div className="design-reference-files">
            {attachments.map((file, index) => <span key={`${file.name}-${index}`}><FileThumbnail file={file} />{file.name}<button type="button" aria-label={`${file.name} 제거`} onClick={() => onRemoveFile(index)}><X size={12} /></button></span>)}
          </div>}
        </section>

        <footer className="design-intake-submit">
          <span><small>디자인 서비스 이용료</small><strong><PendingPrice agent={agent} /></strong></span>
          <button className="primary-button" type="submit" disabled={!complete}><Sparkles size={15} /> 이 기준으로 제작 시작</button>
        </footer>
      </div>
    </form>
  );
}

function EmptyConversation({ agent, authoring, onPrompt }: { agent: Agent; authoring?: boolean; onPrompt: (prompt: string) => void }) {
  const Icon = categoryIcons[agent.category];
  const prompts = authoring
    ? [
        "좋은 결과라고 판단하는 기준부터 정해보자.",
        "일을 받을 때 가장 먼저 확인해야 할 정보를 정해보자.",
        "자주 실패하는 사례와 피해야 할 방식을 알려줄게.",
      ]
    : quickPrompts[agent.category];
  return (
    <div className={`empty-conversation ${authoring ? "authoring" : ""}`}>
      <div className={`empty-agent-mark ${agent.accent}`}>
        <Icon size={24} />
      </div>
      <h1>{authoring ? agent.status === "초안" ? `${agent.name}를 어떻게 가르칠까요?` : `${agent.name}의 일하는 방식을 어떻게 다듬을까요?` : `${agent.name}에게 어떤 일을 맡길까요?`}</h1>
      <p>{authoring ? "좋은 결과의 기준, 일하는 순서, 꼭 기억할 사례를 편하게 이야기해 주세요." : agent.headline}</p>
      <div className="quick-prompts">
        {prompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => onPrompt(prompt)}>
            <Sparkles size={15} />
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, agent, onRetry }: {
  message: ChatMessage;
  agent: Agent;
  onRetry?: (text: string, attachments: Attachment[]) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="message-row user-message">
        <div className="message-content">
          {message.attachments?.length ? (
            <MessageFiles files={message.attachments} align="end" label="첨부 이미지" />
          ) : null}
          <div className="user-bubble">{message.text}</div>
          <small className={`message-status ${message.status || "sent"}`}>
            {message.status === "queued"
              ? "대기 중"
              : message.status === "cancelled"
                ? "중지됨"
                : message.status === "failed"
                  ? "실행 실패"
                  : formatClock(message.at)}
          </small>
        </div>
      </div>
    );
  }
  return (
    <div className="message-row assistant-message">
      <AgentAvatar agent={agent} size="small" />
      <div className="message-content">
        <div className="assistant-name">{agent.name}</div>
        <div className={`assistant-copy${message.streaming ? " streaming" : ""}`}>
          {message.text || "결과를 정리하고 있어요"}
          {message.streaming && <span className="streaming-cursor" aria-label="응답 작성 중" />}
        </div>
        {message.artifacts?.length ? (
          <MessageFiles files={message.artifacts} align="start" label="생성 결과" />
        ) : null}
        <div className="assistant-meta">
          {message.elapsedMs && <span><Clock3 size={13} /> {formatElapsed(message.elapsedMs)}</span>}
          {message.retry && onRetry && !message.streaming && (
            <button
              type="button"
              className="assistant-retry"
              title="같은 요청 다시 시도"
              onClick={() => onRetry(message.retry!.text, message.retry!.attachments)}
            >
              다시 시도
            </button>
          )}
          <button type="button" aria-label="답변 복사" title="답변 복사" disabled={message.streaming} onClick={() => navigator.clipboard?.writeText(message.text)}>
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageFiles({
  files,
  align,
  label,
}: {
  files: Attachment[];
  align: "start" | "end";
  label: string;
}) {
  const images = files.filter(isImageFile);
  const documents = files.filter((file) => !isImageFile(file));
  return (
    <div className={`message-files ${align}`}>
      {images.length > 0 && (
        <div className={`message-image-grid ${images.length === 1 ? "single" : ""}`} aria-label={label}>
          {images.map((file, index) => (
            <MessageImage key={`${file.path || file.previewUrl || file.name}-${index}`} file={file} />
          ))}
        </div>
      )}
      {documents.length > 0 && (
        <div className="message-file-list">
          {documents.map((file, index) => (
            <button
              type="button"
              key={`${file.path || file.name}-${index}`}
              disabled={!file.path || !window.hiremeDesktop}
              onClick={() => openWorkspaceFile(file)}
            >
              <FileText size={16} />
              <span>
                <strong>{file.name}</strong>
                {file.size ? <small>{formatFileSize(file.size)}</small> : null}
              </span>
              {file.path && <ArrowUpRight size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageImage({ file }: { file: Attachment }) {
  const { source, onError } = useFilePreview(file);
  const canOpen = Boolean(file.path && window.hiremeDesktop);
  return (
    <button
      className="message-image"
      type="button"
      disabled={!canOpen}
      title={canOpen ? `${file.name} 열기` : file.name}
      onClick={() => openWorkspaceFile(file)}
    >
      {source ? (
        <img src={source} alt={file.name} onError={onError} />
      ) : (
        <span className="image-unavailable"><FileText size={20} /> 미리보기 없음</span>
      )}
      <span className="message-image-caption">
        <strong>{file.name}</strong>
        {file.size ? <small>{formatFileSize(file.size)}</small> : null}
      </span>
    </button>
  );
}

function FileThumbnail({ file }: { file: Attachment }) {
  const { source, onError } = useFilePreview(file);
  if (!source || !isImageFile(file)) return <FileText size={14} />;
  return <img className="attachment-thumbnail" src={source} alt="" onError={onError} />;
}

function useFilePreview(file: Attachment) {
  const sourceKey = `${file.path || ""}\u0000${file.previewUrl || ""}`;
  const initialSource = appAssetUrl(file.previewUrl || "");
  const [override, setOverride] = useState<{ key: string; source: string } | null>(null);
  const refreshAttempted = useRef("");
  const source = override?.key === sourceKey ? override.source : initialSource;

  const onError = async () => {
    if (refreshAttempted.current !== sourceKey && file.path && window.hiremeDesktop) {
      refreshAttempted.current = sourceKey;
      const refreshed = await window.hiremeDesktop.previewFile(file.path).catch(() => null);
      if (refreshed?.previewUrl) {
        setOverride({ key: sourceKey, source: refreshed.previewUrl });
        return;
      }
    }
    setOverride({ key: sourceKey, source: "" });
  };

  return { source, onError };
}

function useAgentProfileImage(value?: string) {
  const key = String(value || "");
  const [override, setOverride] = useState<{ key: string; source: string } | null>(null);
  const refreshAttempted = useRef("");
  const source = override?.key === key ? override.source : appAssetUrl(key);
  const onError = async () => {
    if (refreshAttempted.current !== key && key && window.hiremeDesktop) {
      refreshAttempted.current = key;
      const refreshed = await window.hiremeDesktop.previewFile(key).catch(() => null);
      if (refreshed?.previewUrl) {
        setOverride({ key, source: refreshed.previewUrl });
        return;
      }
    }
    setOverride({ key, source: "" });
  };
  return { source, onError };
}

function openWorkspaceFile(file: Attachment) {
  if (file.path) void window.hiremeDesktop?.openFile(file.path).catch(() => false);
}

function RunProgress({
  run,
  agent,
  queuedCount,
  onCancel,
}: {
  run: RunState;
  agent: Agent;
  queuedCount: number;
  onCancel: () => void;
}) {
  const elapsed = useElapsed(run.startedAt);
  return (
    <div className="run-progress">
      <AgentAvatar agent={agent} size="small" />
      <div className="run-progress-body">
        <div className="run-progress-title">
          <span><LoaderCircle className="spin run-activity-spinner" size={15} /> {run.image ? "이미지 생성 중" : agent.runtime === "preview" ? "미리보기 결과 생성 중" : "작업 중"}</span>
          <strong role="timer" aria-label={`작업 경과 시간 ${formatElapsed(elapsed)}`}>경과 {formatElapsed(elapsed)}</strong>
        </div>
        <div className="run-steps">
          {run.steps.map((step, index) => (
            <span key={`${step}-${index}`} className={index === run.steps.length - 1 ? "active" : "done"}>
              {index === run.steps.length - 1 ? <LoaderCircle className="spin run-activity-spinner" size={13} /> : <Check size={13} />}
              {step}
            </span>
          ))}
        </div>
        <div className="run-progress-footer">
          {queuedCount > 0 ? <span>{queuedCount}개 요청 대기 중</span> : <span>다른 채팅으로 이동해도 작업은 계속됩니다</span>}
          <button className="secondary-button compact" type="button" onClick={onCancel}>
            <Square size={12} />
            중지
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectStartView({
  agents,
  projects,
  submitting,
  onCancel,
  selectedAgentId,
  onSelect,
  onSubmit,
}: {
  agents: Agent[];
  projects: HireMeDesignProject[];
  submitting: boolean;
  onCancel: (projectId: string) => void;
  selectedAgentId: string;
  onSelect: (agentId: string) => void;
  onSubmit: (request: DesignProjectRequest) => Promise<void>;
}) {
  const [step, setStep] = useState<"intake" | "diagnosis" | "proposal">("intake");
  const [brief, setBrief] = useState("");
  const [diagnosis, setDiagnosis] = useState({ channel: "자사몰", assets: "제품 사진", goal: "구매 전환" });
  const [deliveryMode, setDeliveryMode] = useState<"instant" | "reviewed" | "custom">("reviewed");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const designAgents = agents.filter((agent) => agent.category === "디자인");
  const expert = designAgents.find((agent) => agent.id === selectedAgentId) || designAgents[0] || agents[0];
  const beginDiagnosis = () => {
    if (!brief.trim()) return;
    setStep("diagnosis");
  };
  const startProject = async () => {
    if (!expert) return;
    onSelect(expert.id);
    await onSubmit({ agentId: expert.id, brief, diagnosis, deliveryMode, attachments });
  };
  const pickProjectFiles = async () => {
    const files = await window.hiremeDesktop?.pickFiles();
    if (files?.length) setAttachments((current) => [...current, ...files].slice(0, 12));
  };
  const showAnotherExpert = () => {
    const currentIndex = designAgents.findIndex((agent) => agent.id === expert?.id);
    const next = designAgents[(Math.max(currentIndex, 0) + 1) % designAgents.length];
    if (next) onSelect(next.id);
  };

  return (
    <section className="page-view project-start-view">
      <header className="project-hero">
        <div className="project-stepper" aria-label={`프로젝트 시작 ${step}`}>
          {["프로젝트 접수", "간단한 진단", "작업 제안"].map((label, index) => {
            const activeIndex = step === "intake" ? 0 : step === "diagnosis" ? 1 : 2;
            return <span className={index <= activeIndex ? "active" : ""} key={label}>{index < activeIndex ? <Check size={12} /> : index + 1} {label}</span>;
          })}
        </div>
        <span className="eyebrow">Design project concierge</span>
        <h1>{step === "intake" ? "무엇을 만들고 계신가요?" : step === "diagnosis" ? "필요한 정보만 짧게 확인할게요." : "이 프로젝트는 이렇게 해결하는 게 좋습니다."}</h1>
        <p>{step === "intake" ? "아이디어만 있어도 괜찮아요. 필요한 디자인 작업부터 적합한 전문가까지 정리해드릴게요." : step === "diagnosis" ? "긴 설문 대신 지금 결정에 필요한 세 가지만 답해 주세요." : "프롬프트가 아니라 작업 범위와 결과물을 승인하면 바로 시작할 수 있어요."}</p>
      </header>

      {step === "intake" && <div className="project-intake-card">
        <label className="project-brief-field">
          <span>프로젝트 이야기</span>
          <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="예: 다음 달 화장품 신제품을 출시하는데, 어떤 디자인이 필요한지 잘 모르겠어요." autoFocus />
        </label>
        <div className="project-attach-row">
          <button type="button" onClick={() => void pickProjectFiles()}><Upload size={15} /> 파일 업로드</button>
          <small>웹사이트, 기존 디자인, 제품 이미지, 브랜드 가이드를 추가할 수 있어요.</small>
          <button className="primary-button" type="button" onClick={beginDiagnosis} disabled={!brief.trim()}>프로젝트 진단 시작 <ArrowUpRight size={16} /></button>
        </div>
        {attachments.length > 0 && <div className="project-attachment-list">{attachments.map((file, index) => <span key={`${file.path}-${index}`}><FileText size={13} /> {file.name}<button type="button" aria-label={`${file.name} 제거`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={12} /></button></span>)}</div>}
        <div className="project-situation-list"><span>어디서부터 시작해야 할지 모르겠나요?</span>{["신제품 출시", "광고 성과 개선", "상세페이지 개선", "SNS 콘텐츠 제작", "발표자료 개선"].map((item) => <button key={item} type="button" onClick={() => setBrief(`${item}을(를) 준비하고 있는데, 어떤 디자인 작업이 필요한지 먼저 정리하고 싶어요.`)}>{item}</button>)}</div>
      </div>}

      {step === "diagnosis" && <div className="diagnosis-card">
        <DiagnosisQuestion label="어디에서 고객을 만나나요?" value={diagnosis.channel} options={["자사몰", "네이버 스마트스토어", "쿠팡", "오프라인", "아직 정하지 않음"]} onChange={(channel) => setDiagnosis((current) => ({ ...current, channel }))} />
        <DiagnosisQuestion label="현재 준비된 자료는 무엇인가요?" value={diagnosis.assets} options={["제품 사진", "로고와 브랜드 가이드", "제품 설명", "기존 상세페이지", "아직 준비된 것이 없음"]} onChange={(assets) => setDiagnosis((current) => ({ ...current, assets }))} />
        <DiagnosisQuestion label="이번 프로젝트에서 가장 중요한 목표는 무엇인가요?" value={diagnosis.goal} options={["제품 이해", "구매 전환", "브랜드 인지도", "광고 클릭", "출시 일정 준수"]} onChange={(goal) => setDiagnosis((current) => ({ ...current, goal }))} />
        <div className="diagnosis-actions"><button className="secondary-button" type="button" onClick={() => setStep("intake")}>이전</button><button className="primary-button" type="button" onClick={() => setStep("proposal")}>작업 제안 보기 <ArrowUpRight size={16} /></button></div>
      </div>}

      {step === "proposal" && expert && <div className="project-proposal">
        <section className="proposal-summary"><span className="proposal-label"><Sparkles size={14} /> 진단 결과</span><h2>단순한 디자인 한 장보다, 구매 이유를 정리한 뒤 채널별로 확장하는 작업이 필요합니다.</h2><p>{diagnosis.channel}에서 {diagnosis.goal}을 목표로 하며, 현재 {diagnosis.assets}을 기반으로 시작합니다.</p></section>
        <div className="proposal-grid"><section className="proposal-package"><span className="eyebrow">Recommended project</span><h2>뷰티 신제품 출시 패키지</h2><p>상세페이지의 핵심 메시지를 먼저 설계하고 광고 소재까지 일관되게 확장합니다.</p><ul><li><CheckCircle2 size={15} /> 상세페이지 콘텐츠 구조와 디자인 1종</li><li><CheckCircle2 size={15} /> 인스타그램 광고 소재 5종</li><li><CheckCircle2 size={15} /> 쇼핑몰 메인 배너 2종 · 채널별 리사이징</li><li><CheckCircle2 size={15} /> 편집 가능한 원본 파일과 전달 가이드</li></ul><div className="proposal-timeline"><span>1. 경쟁 상품 분석</span><span>2. 셀링 포인트 정리</span><span>3. 시안 제작 · 검수</span></div></section>
          <aside className="expert-recommendation"><span>가장 적합한 전문가</span><div className="expert-profile"><AgentAvatar agent={expert} size="large" /><div><strong>{expert.creator}</strong><small>뷰티 이커머스 디자이너</small><p><Star size={13} fill="currentColor" /> {expert.rating} · {formatCompact(expert.uses)}건 프로젝트</p></div></div><p>제품의 사용 후 경험을 시각적으로 전달하는 작업 방식이 이번 요청에 적합합니다.</p><button type="button" onClick={showAnotherExpert}>다른 전문가 보기 <ChevronRight size={14} /></button></aside></div>
        <section className="delivery-mode"><div><span className="eyebrow">Closed pilot delivery</span><h2>모든 결과는 디자이너가 확인한 뒤 전달합니다</h2></div><div className="delivery-options single"><button type="button" className="active" onClick={() => setDeliveryMode("reviewed")}><span><CheckCircle2 size={15} /> Reviewed</span><strong>AI 실행 + 디자이너 검수</strong><small>품질 수정 1회 · 승인 전에는 클라이언트에게 파일이 공개되지 않음</small></button></div></section>
        <div className="proposal-actions"><button className="text-button" type="button" onClick={() => setStep("diagnosis")}>결과물 조정하기</button><div><span>Creator Worker 실행 · 디자이너 승인 후 전달</span><button className="primary-button" type="button" onClick={() => void startProject()} disabled={submitting || attachments.length === 0}>{submitting ? <LoaderCircle className="spin" size={16} /> : null}{attachments.length === 0 ? "참고 파일을 먼저 첨부해 주세요" : "이 구성으로 프로젝트 시작"} <ArrowUpRight size={16} /></button></div></div>
      </div>}
      {projects.length > 0 && <section className="client-project-status"><div><span className="eyebrow">Your design projects</span><h2>진행 중인 프로젝트</h2></div><div>{projects.slice(0, 5).map((project) => <article key={project.id}><span className={`project-status ${project.status}`}>{designProjectStatusLabel(project.status)}</span><strong>{String(project.brief.objective || "디자인 프로젝트")}</strong><small>{new Date(project.created_at).toLocaleString("ko-KR")}</small>{!["delivered", "failed", "blocked", "canceled", "expired", "approval_expired"].includes(project.status) && <button className="text-button project-cancel" type="button" onClick={() => onCancel(project.id)}>취소</button>}{project.status === "delivered" && project.artifacts.length > 0 && <div className="project-deliveries">{project.artifacts.map((artifact) => artifact.downloadUrl ? <a key={artifact.id} href={artifact.downloadUrl} target="_blank" rel="noreferrer"><Download size={13} /> {artifact.filename}</a> : null)}</div>}</article>)}</div></section>}
    </section>
  );
}

function StudioHome({ agents, worker, onCreate, onOpenAgent, onSetWorkerAvailable, onApproveJob }: { agents: Agent[]; worker: HireMeCreatorWorkerState | null; onCreate: () => void; onOpenAgent: (agentId: string) => void; onSetWorkerAvailable: (available: boolean) => void; onApproveJob: (jobId: string, decision: "approved" | "revision_requested" | "rejected") => void }) {
  const drafts = agents.filter((agent) => agent.status !== "공개");
  return <section className="studio-home">
    <header className="studio-hero">
      <div><span className="eyebrow">HireMe · designer studio</span><h1>좋은 디자인 에이전트는<br />작업 방식을 설계하는 것에서 시작합니다.</h1><p>고객이 답할 질문과 전달 기준을 정리하고, 에이전트를 지속적으로 개선하세요.</p></div>
      <button className="primary-button studio-create-button" type="button" onClick={onCreate}><Plus size={17} /> 새 에이전트 만들기</button>
    </header>
    <section className="creator-worker-card">
      <div className="creator-worker-status"><span className={worker?.available ? "worker-icon online" : "worker-icon"}><Cpu size={18} /></span><div><span className="eyebrow">Creator Worker · this Mac</span><h2>{worker?.available ? worker.busy ? "디자인 작업을 실행하고 있어요" : "새 요청을 받을 준비가 됐어요" : "요청 수신이 꺼져 있어요"}</h2><p>Private Harness는 이 Mac에 남고, 암호화된 입력과 승인된 결과만 오갑니다.</p></div></div>
      <button className={worker?.available ? "secondary-button" : "primary-button"} type="button" onClick={() => onSetWorkerAvailable(!worker?.available)} disabled={!worker}>{worker?.available ? "요청 수신 끄기" : "이 Mac에서 요청 받기"}</button>
    </section>
    {worker?.error && <div className="worker-error"><Info size={15} /> {worker.error}</div>}
    {worker?.approvalItems?.length ? <section className="creator-approval-inbox"><div className="studio-overview-heading"><div><span className="eyebrow">Approval inbox</span><h2>클라이언트 전달 전 검수</h2></div><span>{worker.approvalItems.length}건</span></div><div className="creator-approval-list">{worker.approvalItems.map((item) => <article key={item.jobId}><div><span className="studio-status draft">검수 대기</span><h3>{String(item.brief.objective || "디자인 프로젝트")}</h3><p>자동 평가 {item.evaluations.map((evaluation) => `${evaluation.evaluator}: ${evaluation.verdict}`).join(" · ")}</p></div><div className="creator-artifact-links">{item.artifacts.map((artifact) => artifact.downloadUrl ? <a href={artifact.downloadUrl} target="_blank" rel="noreferrer" key={artifact.id}>{artifact.kind} · {artifact.name}</a> : null)}</div><div className="creator-approval-actions"><button type="button" onClick={() => onApproveJob(item.jobId, "revision_requested")}>수정 실행</button><button type="button" onClick={() => onApproveJob(item.jobId, "rejected")}>반려</button><button className="primary-button" type="button" onClick={() => onApproveJob(item.jobId, "approved")}><Check size={14} /> 승인 · 전달</button></div></article>)}</div></section> : null}
    <section className="studio-flow" aria-label="에이전트 제작 흐름">
      <article><span>01</span><div><strong>서비스를 정의하세요</strong><p>누구를 위해 어떤 결과물을 만들지 정합니다.</p></div></article>
      <article><span>02</span><div><strong>고객 질문을 설계하세요</strong><p>프롬프트 대신 선택지로 필요한 맥락을 받습니다.</p></div></article>
      <article><span>03</span><div><strong>기준을 관리하세요</strong><p>품질 기준과 전달 범위를 지속적으로 개선합니다.</p></div></article>
    </section>
    <section className="studio-overview">
      <div className="studio-overview-heading"><div><span className="eyebrow">Your workspace</span><h2>지금 이어서 할 일</h2></div><span>{agents.length}개 에이전트</span></div>
      <div className="studio-action-grid">
        <button className="studio-primary-action" type="button" onClick={onCreate}><span><Plus size={19} /></span><strong>새 에이전트 설계</strong><small>기본 정보와 고객 질문부터 시작</small><ChevronRight size={17} /></button>
        {drafts[0] ? <button className="studio-draft-action" type="button" onClick={() => onOpenAgent(drafts[0].id)}><span className="studio-status draft">초안</span><strong>{drafts[0].name}</strong><small>질문과 전달 방식을 계속 설정하세요</small><ChevronRight size={16} /></button> : <div className="studio-empty-action"><CheckCircle2 size={18} /><strong>설계 중인 초안이 없어요</strong><small>새 에이전트를 만들어 첫 작업 방식을 정의해 보세요.</small></div>}
      </div>
    </section>
    <section className="studio-agent-section">
      <div className="studio-overview-heading"><div><span className="eyebrow">Agent management</span><h2>최근 만든 에이전트</h2></div><button className="text-button" type="button" onClick={() => agents[0] && onOpenAgent(agents[0].id)}>전체 보기 <ArrowUpRight size={14} /></button></div>
      <div className="studio-agent-grid">{agents.slice(0, 3).map((agent) => <article key={agent.id}><AgentCover agent={agent} compact /><div><span className={agent.status === "공개" ? "studio-status live" : "studio-status draft"}>{agent.status === "공개" ? "운영 중" : "설계 중"}</span><h3>{agent.name}</h3><p>{agent.headline}</p><div className="studio-agent-actions"><button type="button" onClick={() => onOpenAgent(agent.id)}>관리하기</button></div></div></article>)}</div>
      {!agents.length && <div className="studio-no-agents"><Bot size={25} /><h3>첫 디자인 에이전트를 만들어 보세요</h3><p>고객이 직접 프롬프트를 쓰지 않아도, 당신의 작업 방식으로 결과를 받을 수 있게 됩니다.</p><button className="primary-button" type="button" onClick={onCreate}>새 에이전트 만들기</button></div>}
    </section>
    <aside className="studio-insight"><Sparkles size={17} /><span><strong>전문성을 관리 가능한 서비스로 만드세요</strong><small>반복되는 요구사항과 품질 기준을 질문과 전달 규칙에 반영하면, 에이전트가 더 정확해집니다.</small></span></aside>
  </section>;
}

function DiagnosisQuestion({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <section className="diagnosis-question"><h2>{label}</h2><div>{options.map((option) => <button type="button" key={option} className={option === value ? "active" : ""} onClick={() => onChange(option)}>{option === value && <Check size={14} />}{option}</button>)}</div></section>;
}

function designProjectStatusLabel(status: string) {
  return ({
    draft: "자료 업로드 중",
    queued: "디자이너 대기 중",
    running: "디자인 작업 중",
    evaluating: "품질 평가 중",
    awaiting_creator_approval: "디자이너 검수 중",
    delivered: "전달 완료",
    blocked: "확인 필요",
    failed: "작업 실패",
    canceled: "취소됨",
    expired: "접수 만료",
    approval_expired: "검수 만료",
  } as Record<string, string>)[status] || status;
}

function MyAgentsView({
  agents,
  selectedAgentId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onOpenEarnings,
  onOpenReview,
  reviewer,
  onManage,
}: {
  agents: Agent[];
  selectedAgentId: string;
  onSelect: (agentId: string) => void;
  onCreate: () => void;
  onEdit: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onOpenEarnings: () => void;
  onOpenReview: () => void;
  reviewer: boolean;
  onManage: (agentId: string) => void;
}) {
  const totalRevenue = agents.reduce((sum, agent) => sum + (agent.revenue30d || 0), 0);
  return (
    <section className="page-view my-agents-view">
      <CreatorSectionNav active="agents" onAgents={() => {}} onEarnings={onOpenEarnings} onReview={onOpenReview} reviewer={reviewer} />
      <header className="page-header split">
        <div>
          <span className="eyebrow">Design service studio</span>
          <h1>내 에이전트 관리</h1>
          <p>고객 질문, 디자인 판단 기준, 전달 기준을 관리하고 버전을 개선하세요.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onOpenEarnings}><Wallet size={16} /> 수익 관리</button>
          <button className="primary-button" type="button" onClick={onCreate}><Plus size={16} /> 새 에이전트 만들기</button>
        </div>
      </header>

      <div className="metric-strip three">
        <Metric label="운영 중인 서비스" value={`${agents.filter((agent) => agent.status === "공개").length}`} detail={`전체 ${agents.length}개`} icon={<Target size={17} />} />
        <Metric label="최근 30일 수익" value={formatWon(totalRevenue)} detail="지난달보다 18.4% 증가" positive icon={<TrendingUp size={17} />} />
        <Metric label="관리 중인 버전" value={`${agents.length}개`} detail="질문과 기준을 최신 상태로 유지" icon={<ListChecks size={17} />} />
      </div>

      <div className="table-toolbar">
        <div className="section-title">
          <h2>에이전트 목록</h2>
          <span>{agents.length}</span>
        </div>
        <div>
          <label className="mini-search"><Search size={15} /><input placeholder="이름 검색" /></label>
          <button className="icon-button" type="button" aria-label="목록 보기 설정" title="목록 보기 설정"><LayoutGrid size={16} /></button>
        </div>
      </div>

      <div className="agent-table-wrap">
        <table className="agent-table">
          <thead>
            <tr>
              <th>에이전트</th>
              <th>고객 질문</th>
              <th>가격</th>
              <th>30일 수익</th>
              <th>상태</th>
              <th><span className="sr-only">관리</span></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className={selectedAgentId === agent.id ? "selected" : ""} onClick={() => onSelect(agent.id)}>
                <td>
                  <div className="table-agent-cell">
                    <AgentAvatar agent={agent} size="medium" />
                    <span><strong>{agent.name}</strong><small>{agent.category}</small></span>
                  </div>
                </td>
                <td><span className="version-cell"><MessageCircleQuestion size={13} /> {agent.designSystem?.questions.length || 0}개</span></td>
                <td><PendingPrice agent={agent} /></td>
                <td><strong>{formatWon(agent.revenue30d || 0)}</strong></td>
                <td><span className={agent.status === "공개" ? "studio-status live" : "studio-status draft"}>{agent.status === "공개" ? "운영 중" : "초안"}</span></td>
                <td>
                  <div className="table-row-actions">
                    <button className="icon-button" type="button" aria-label={`${agent.name} 관리 모드`} title="관리 모드" onClick={(event) => { event.stopPropagation(); onManage(agent.id); }}><SlidersHorizontal size={15} /></button>
                    <button className="icon-button" type="button" aria-label={`${agent.name} 프로필 수정`} title="프로필 수정" onClick={(event) => { event.stopPropagation(); onEdit(agent.id); }}><PenLine size={15} /></button>
                    <button className="icon-button danger-icon-button" type="button" aria-label={`${agent.name} 삭제`} title="에이전트 삭제" onClick={(event) => { event.stopPropagation(); onDelete(agent.id); }}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreatorSectionNav({
  active,
  onAgents,
  onEarnings,
  onReview,
  reviewer,
}: {
  active: "agents" | "earnings" | "review";
  onAgents: () => void;
  onEarnings: () => void;
  onReview: () => void;
  reviewer: boolean;
}) {
  return (
    <nav className="creator-section-nav" aria-label="내 디자인 서비스 관리">
      <button type="button" className={active === "agents" ? "active" : ""} onClick={onAgents}><Target size={15} /> 디자인 서비스</button>
      <button type="button" className={active === "earnings" ? "active" : ""} onClick={onEarnings}><Wallet size={15} /> 수익</button>
      {reviewer && <button type="button" className={active === "review" ? "active" : ""} onClick={onReview}><ShieldCheck size={15} /> 검토함</button>}
    </nav>
  );
}

function ReviewInboxView({
  inbox,
  busyVersionId,
  onRefresh,
  onDecide,
  onOpenAgents,
  onOpenEarnings,
}: {
  inbox: HireMeReviewInbox;
  busyVersionId: string | null;
  onRefresh: () => void;
  onDecide: (versionId: string, decision: "approved" | "rejected") => void;
  onOpenAgents: () => void;
  onOpenEarnings: () => void;
}) {
  return (
    <section className="review-inbox-view">
      <CreatorSectionNav active="review" onAgents={onOpenAgents} onEarnings={onOpenEarnings} onReview={() => {}} reviewer />
      <header className="review-inbox-header">
        <div><span className="eyebrow">플랫폼 운영</span><h1>검토함</h1><p>Private Harness 원문 없이 배포 계약과 자동 검사 결과를 검토합니다.</p></div>
        <button className="icon-button" type="button" onClick={onRefresh} title="새로고침" aria-label="새로고침"><RefreshCw size={17} /></button>
      </header>
      {!inbox.items.length ? <div className="empty-state"><ShieldCheck size={28} /><h2>검토 대기 항목이 없어요</h2><p>새 버전이 제출되면 여기에 나타납니다.</p></div> : (
        <div className="review-inbox-list">
          {inbox.items.map((item) => {
            const preflight = item.preflight || {};
            const blocking = Array.isArray(preflight.blocking) ? preflight.blocking : [];
            const warnings = Array.isArray(preflight.warnings) ? preflight.warnings : [];
            const busy = busyVersionId === item.versionId;
            return <article className="review-inbox-item" key={item.versionId}>
              <div className="review-item-topline"><div><span className="review-category">{item.category}</span><h2>{item.name} <small>v{item.version}</small></h2><p>{item.headline}</p></div><time>{formatRelativeTime(item.submittedAt)}</time></div>
              <div className="review-contract"><span>결과: {readManifestList(item.manifest, "finalizers").join(", ") || "미정"}</span><span>입력: {readManifestList(item.manifest, "inputModes").join(", ") || "미정"}</span><span>{formatBytes(item.packageSizeBytes)}</span></div>
              <div className={preflight.passed ? "review-preflight passed" : "review-preflight blocked"}>
                <ShieldCheck size={16} /><span>{preflight.passed ? "자동 사전검사 통과" : "자동 사전검사 차단"}</span>
              </div>
              {!!blocking.length && <ul className="review-findings blocking">{blocking.map((line) => <li key={line}>{line}</li>)}</ul>}
              {!!warnings.length && <ul className="review-findings">{warnings.map((line) => <li key={line}>{line}</li>)}</ul>}
              <div className="review-item-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => onDecide(item.versionId, "rejected")}>반려</button><button className="primary-button" type="button" disabled={busy || !preflight.passed} onClick={() => onDecide(item.versionId, "approved")}>{busy ? "처리 중" : "승인"}</button></div>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}

function EarningsView({ agents, onOpenAgents, onOpenReview, reviewer, onDownload, onPayout }: { agents: Agent[]; onOpenAgents: () => void; onOpenReview: () => void; reviewer: boolean; onDownload: () => void; onPayout: () => void }) {
  const total = agents.reduce((sum, agent) => sum + (agent.revenue30d || 0), 0);
  const runRevenue = Math.round(total * 0.63);
  const subscriptionRevenue = total - runRevenue;
  const bars = [32, 40, 36, 55, 49, 67, 61, 74, 70, 82, 76, 92];
  return (
    <section className="page-view earnings-view">
      <CreatorSectionNav active="earnings" onAgents={onOpenAgents} onEarnings={() => {}} onReview={onOpenReview} reviewer={reviewer} />
      <div className="earnings-coming-soon-notice" role="status">
        <Clock3 size={15} />
        <strong>수익 기능은 추후 오픈됩니다.</strong>
      </div>
      <header className="page-header split">
        <div>
          <span className="eyebrow">Creator earnings <span className="demo-label">추후 오픈</span></span>
          <h1>수익</h1>
          <p>실행과 구독에서 발생한 예상 수익을 확인하세요.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={onDownload}><Download size={16} /> 내역 받기</button>
          <button className="primary-button" type="button" onClick={onPayout}><Wallet size={16} /> 정산 신청</button>
        </div>
      </header>

      <div className="metric-strip earnings-metrics">
        <Metric label="이번 달 예상 수익" value={formatWon(total)} detail="지난달보다 18.4% 증가" positive icon={<DollarSign size={17} />} />
        <Metric label="정산 가능" value={formatWon(974000)} detail="다음 정산일 7월 25일" icon={<Wallet size={17} />} />
        <Metric label="실행 수익" value={formatWon(runRevenue)} detail="전체 수익의 63%" icon={<Zap size={17} />} />
        <Metric label="구독 수익" value={formatWon(subscriptionRevenue)} detail="활성 구독 34건" icon={<CalendarDays size={17} />} />
      </div>

      <div className="earnings-layout">
        <section className="revenue-chart-section">
          <div className="section-heading-row">
            <div><h2>월별 수익</h2><p>최근 12개월</p></div>
            <button className="period-select" type="button">2026년 <ChevronDown size={14} /></button>
          </div>
          <div className="bar-chart" aria-label="월별 수익 차트">
            {bars.map((height, index) => (
              <div className="bar-column" key={index}>
                <span className="bar-value">{Math.round(height * 18)}K</span>
                <span className="bar" style={{ height: `${height}%` }} />
                <small>{index + 1}월</small>
              </div>
            ))}
          </div>
        </section>

        <section className="revenue-split-section">
          <div className="section-heading-row"><div><h2>수익 구성</h2><p>이번 달 기준</p></div></div>
          <div className="split-meter"><span style={{ width: "63%" }} /><span style={{ width: "37%" }} /></div>
          <div className="split-list">
            <div><span className="legend usage" /><span><strong>실행 요금</strong><small>에이전트 작업이 실행될 때마다 발생</small></span><b>{formatWon(runRevenue)}</b></div>
            <div><span className="legend subscription" /><span><strong>월 구독</strong><small>구독 기간 동안 정해진 실행 횟수 제공</small></span><b>{formatWon(subscriptionRevenue)}</b></div>
          </div>
          <div className="protection-note"><LockKeyhole size={16} /><span><strong>에이전트의 작업 방식은 판매되지 않아요</strong><small>사용자는 실행 권한과 결과만 받습니다.</small></span></div>
        </section>
      </div>

      <section className="earnings-table-section">
        <div className="section-heading-row"><div><h2>최근 수익</h2><p>수수료 반영 전 예상 금액</p></div><button className="text-button" type="button">전체 보기 <ArrowUpRight size={14} /></button></div>
        <table className="earnings-table">
          <thead><tr><th>날짜</th><th>에이전트</th><th>유형</th><th>사용량</th><th>상태</th><th>금액</th></tr></thead>
          <tbody>
            <EarningRow date="7월 11일 14:32" agent={agents[0]?.name} type="실행" usage="1회 실행" amount="₩1,900" />
            <EarningRow date="7월 11일 11:18" agent={agents[0]?.name} type="구독" usage="월간 구독" amount="₩29,000" />
            <EarningRow date="7월 10일 20:41" agent={agents[1]?.name} type="실행" usage="1회 실행" amount="₩900" />
            <EarningRow date="7월 10일 16:05" agent={agents[0]?.name} type="실행" usage="1회 실행" amount="₩1,900" />
          </tbody>
        </table>
      </section>
    </section>
  );
}

function PrivateHarnessInspector({
  agent,
  conversation,
  managementSession,
  onNotify,
  onDirtyChange,
  onSessionInvalid,
  onPublish,
  publishing,
  runActive,
  onRevisionChange,
}: {
  agent: Agent;
  conversation: Conversation;
  managementSession: HireMeAgentManagementSession;
  onNotify: (title: string, detail?: string) => void;
  onDirtyChange: (conversationId: string, dirty: boolean) => void;
  onSessionInvalid: (conversationId: string, error: unknown) => boolean;
  onPublish: () => void;
  publishing: boolean;
  runActive: boolean;
  onRevisionChange: (phase: string, revision: number) => void;
}) {
  const [files, setFiles] = useState<HireMePrivateHarnessFileSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [document, setDocument] = useState<HireMePrivateHarnessFile | null>(null);
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState(agent.authoring?.revision || 0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = Boolean(document && draft !== document.content);

  const managementRequest = {
    conversationId: conversation.id,
    agentId: agent.id,
    managementSessionId: managementSession.id,
  };

  const handleManagementError = useCallback((managementError: unknown) => {
    if (!isManagementSessionError(managementError)) return false;
    setFiles([]);
    setSelectedPath("");
    setDocument(null);
    setDraft("");
    setError(publicErrorMessage(managementError));
    onDirtyChange(conversation.id, false);
    onSessionInvalid(conversation.id, managementError);
    return true;
  }, [conversation.id, onDirtyChange, onSessionInvalid]);

  useEffect(() => {
    onDirtyChange(conversation.id, dirty);
  }, [conversation.id, dirty, onDirtyChange]);

  useEffect(() => () => {
    onDirtyChange(conversation.id, false);
  }, [conversation.id, onDirtyChange]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop) return;
    let disposed = false;
    const load = async () => {
      await Promise.resolve();
      if (disposed) return;
      setLoading(true);
      setError("");
      try {
        const result = await desktop.listPrivateHarnessFiles({
          conversationId: conversation.id,
          agentId: agent.id,
          managementSessionId: managementSession.id,
        });
        if (disposed) return;
        setFiles(result.files);
        setRevision(result.revision);
        setSelectedPath(result.files.find((file) => file.path === "AGENTS.md")?.path || result.files[0]?.path || "");
      } catch (loadError) {
        if (!disposed && !handleManagementError(loadError)) {
          setError(publicErrorMessage(loadError));
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [agent.id, conversation.id, handleManagementError, managementSession.id]);

  useEffect(() => {
    const desktop = window.hiremeDesktop;
    if (!desktop || !selectedPath) return;
    let disposed = false;
    const load = async () => {
      await Promise.resolve();
      if (disposed) return;
      setLoading(true);
      setError("");
      try {
        const result = await desktop.readPrivateHarnessFile({
          conversationId: conversation.id,
          agentId: agent.id,
          managementSessionId: managementSession.id,
          path: selectedPath,
        });
        if (disposed) return;
        setDocument(result);
        setDraft(result.content);
      } catch (loadError) {
        if (!disposed && !handleManagementError(loadError)) {
          setError(publicErrorMessage(loadError));
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [agent.id, conversation.id, handleManagementError, managementSession.id, selectedPath]);

  const chooseFile = (path: string) => {
    if (path === selectedPath) return;
    if (dirty && !window.confirm("저장하지 않은 변경을 버리고 다른 파일을 열까요?")) return;
    setDocument(null);
    setDraft("");
    setSelectedPath(path);
  };

  const save = async () => {
    const desktop = window.hiremeDesktop;
    if (!desktop || !document || !dirty || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await desktop.updatePrivateHarnessFile({
        ...managementRequest,
        path: document.path,
        content: draft,
        expectedSha256: document.sha256,
      });
      setDocument({
        ...document,
        content: draft,
        bytes: result.bytes,
        sha256: result.sha256,
      });
      setFiles((current) => current.map((file) => (
        file.path === result.path
          ? { ...file, bytes: result.bytes, sha256: result.sha256 }
          : file
      )));
      setRevision(result.revision);
      onRevisionChange(result.phase, result.revision);
      onNotify("Private Harness를 저장했어요", `${result.path} · revision ${result.revision}`);
    } catch (saveError) {
      if (handleManagementError(saveError)) return;
      const message = publicErrorMessage(saveError);
      setError(message);
      onNotify("Private Harness를 저장하지 못했어요", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="private-harness-panel">
      <div className="private-harness-heading">
        <div>
          <span className="private-harness-kicker"><LockKeyhole size={13} /> Owner only</span>
          <h2>Private Harness</h2>
          <p>revision {revision} · 이 관리 세션에서만 원문을 표시합니다.</p>
        </div>
        <span className="verified-management-badge"><ShieldCheck size={13} /> 검증됨</span>
      </div>

      <div className="private-harness-file-list" aria-label="Private Harness 파일">
        {files.map((file) => (
          <button
            type="button"
            key={file.path}
            className={file.path === selectedPath ? "active" : ""}
            onClick={() => chooseFile(file.path)}
          >
            <FileText size={14} />
            <span><strong>{file.path}</strong><small>{file.role} · {formatFileBytes(file.bytes)}</small></span>
          </button>
        ))}
        {!loading && files.length === 0 && !error && <p className="private-harness-empty">편집할 Private Harness 파일이 없습니다.</p>}
      </div>

      <div className="private-harness-editor">
        <div className="private-harness-editor-bar">
          <span>{document?.path || "파일을 선택하세요"}</span>
          {dirty && <small>저장되지 않음</small>}
        </div>
        {loading && !document ? (
          <div className="private-harness-loading"><LoaderCircle className="spin" size={18} /> 불러오는 중</div>
        ) : (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!document || saving}
            spellCheck={false}
            aria-label="Private Harness 원문 편집"
          />
        )}
      </div>

      {error && <p className="private-harness-error">{error}</p>}
      <div className="private-harness-actions">
        <span>{document ? document.sha256.slice(0, 10) : "—"}</span>
        <div>
          <button className="secondary-button compact" type="button" onClick={() => void save()} disabled={!dirty || saving || publishing}>
            {saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
            {saving ? "저장 중" : "변경 저장"}
          </button>
          <button className="primary-button compact publish-agent-button" type="button" onClick={onPublish} disabled={publishing || saving || runActive}>
            {publishing ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}
            {publishing ? "배포 준비 중" : agent.status === "공개" ? "새 버전 배포" : "배포하기"}
          </button>
        </div>
      </div>
      <div className="private-harness-boundary">
        <ShieldCheck size={15} />
        <span>원문은 채팅 메시지나 온라인 대화 기록에 저장하지 않습니다.</span>
      </div>
    </div>
  );
}

function AgentProfileDialog({
  agent,
  onClose,
  onUse,
  onEdit,
  onManage,
}: {
  agent: Agent;
  onClose: () => void;
  onUse: (agentId: string) => void;
  onEdit: (agentId: string) => void;
  onManage: (agentId: string) => void;
}) {
  const outputExamples = outputExamplesForAgent(agent);
  const [selectedOutputName, setSelectedOutputName] = useState(outputExamples[0]?.name || "");
  const selectedOutput = outputExamples.find((output) => output.name === selectedOutputName) ?? outputExamples[0];
  const mine = agent.ownership === "mine";

  return (
    <Dialog
      title={agent.name}
      subtitle={`${agent.category} 서비스 · ${mine ? "내가 설계함" : `Designed by ${agent.creator}`}`}
      onClose={onClose}
      profile
    >
      <div className="agent-profile-modal">
        <section className="agent-profile-overview">
          <AgentCover agent={agent} compact />
          <div className="agent-profile-copy">
            <div className="agent-profile-meta">
              <StatusBadge status={agent.status} />
              <span>v{agent.version}</span>
              {!mine && <span><Star size={13} fill="currentColor" /> {agent.rating}</span>}
              <span>{formatCompact(agent.uses)}건 납품</span>
            </div>
            <h3>{agent.headline}</h3>
            <p>{agent.summary}</p>
            <div className="agent-profile-capabilities">
              <div>
                <small>잘하는 일</small>
                <div className="detail-skill-list">{agent.skills.map((skill) => <span key={skill}><Check size={13} /> {skill}</span>)}</div>
              </div>
              <div>
                <small>받을 수 있는 결과</small>
                <div className="result-type-row">{agent.resultTypes.map((type) => <span key={type}><FileText size={13} /> {type}</span>)}</div>
              </div>
            </div>
          </div>
        </section>

        {agent.designSystem && <section className="agent-design-system-summary">
          <div className="agent-design-system-heading">
            <span><ShieldCheck size={18} /></span>
            <div><h3>디자이너의 판단 시스템이 적용됩니다</h3><p>{agent.designSystem.purpose}</p></div>
          </div>
          <div className="agent-design-system-facts">
            <span><MessageCircleQuestion size={15} /><strong>{agent.designSystem.questions.length}개</strong><small>작업 전 질문</small></span>
            <span><Target size={15} /><strong>{agent.designSystem.priorityCount ?? agent.designSystem.priorities.length}단계</strong><small>판단 우선순위</small></span>
            <span><ListChecks size={15} /><strong>{agent.designSystem.qualityBarCount ?? agent.designSystem.qualityBar.length}개</strong><small>자동 품질 검사</small></span>
          </div>
          <p className="agent-design-system-boundary"><LockKeyhole size={13} /> 세부 작업 방식은 디자이너의 비공개 자산으로 보호되고 결과에만 적용됩니다.</p>
        </section>}

        <section className="agent-output-examples">
          <div className="agent-output-heading">
            <div><h3>결과 파일 예시</h3><p>에이전트가 실제로 전달하는 결과의 형식과 내용을 확인하세요.</p></div>
            <span>{outputExamples.length}개 파일</span>
          </div>
          <div className="agent-output-browser">
            <div className="agent-output-file-list" role="list" aria-label="결과 파일 예시">
              {outputExamples.map((output) => (
                <button
                  type="button"
                  role="listitem"
                  className={output.name === selectedOutput?.name ? "active" : ""}
                  key={output.name}
                  onClick={() => setSelectedOutputName(output.name)}
                >
                  <span className="agent-output-file-icon"><FileText size={16} /></span>
                  <span><strong>{output.name}</strong><small>{outputTypeLabel(output.mimeType)}{output.size ? ` · ${formatFileSize(output.size)}` : ""}</small></span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            {selectedOutput && <AgentOutputPreview output={selectedOutput} />}
          </div>
        </section>

        <div className="agent-profile-modal-actions">
          <span><small>{mine ? "실행당 가격" : "가격"}</small><PendingPrice agent={agent} /></span>
          <div>
            {mine ? (
              <>
                <button className="secondary-button" type="button" onClick={() => onEdit(agent.id)}><PenLine size={15} /> 프로필 수정</button>
                <button className="primary-button" type="button" onClick={() => onManage(agent.id)}><SlidersHorizontal size={15} /> 관리 모드</button>
              </>
            ) : (
              <button className={agent.hired ? "primary-button" : "secondary-button"} type="button" onClick={() => onUse(agent.id)}>{agent.hired ? "질문에 답하고 맡기기" : "서비스 이용하기"}</button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function AgentOutputPreview({ output }: { output: AgentOutputExample }) {
  const { source, onError } = useFilePreview(output);
  const canOpen = Boolean(output.path && window.hiremeDesktop);
  return (
    <div className="agent-output-preview" aria-live="polite">
      <div className="agent-output-preview-bar">
        <span><FileText size={14} /> {output.name}</span>
        <small>{outputTypeLabel(output.mimeType)}</small>
      </div>
      <div className={`agent-output-preview-stage ${isImageFile(output) ? "image" : "document"}`}>
        {isImageFile(output) && source ? (
          <img src={source} alt={`${output.name} 결과 예시`} onError={onError} />
        ) : output.previewText ? (
          <pre>{output.previewText}</pre>
        ) : (
          <div className="agent-output-external-file">
            <FileText size={30} />
            <strong>{output.name}</strong>
            <span>이 파일은 연결된 기본 앱에서 확인할 수 있습니다.</span>
          </div>
        )}
      </div>
      <div className="agent-output-preview-footer">
        <p>{output.description || "에이전트가 전달하는 결과 파일 예시입니다."}</p>
        {canOpen && <button className="secondary-button compact" type="button" onClick={() => openWorkspaceFile(output)}><ArrowUpRight size={14} /> 파일 열기</button>}
      </div>
    </div>
  );
}

function EarningsInspector({ onPayout }: { onPayout: () => void }) {
  return (
    <div className="inspector-content">
      <div className="inspector-heading"><span>정산 정보</span><span className="demo-label">추후 오픈</span></div>
      <div className="payout-balance"><small>정산 가능 금액</small><strong>₩974,000</strong><span><CheckCircle2 size={14} /> 계좌 인증 완료</span></div>
      <button className="primary-button full" type="button" onClick={onPayout}>정산 신청</button>
      <InspectorSection title="다음 정산"><InfoRow icon={<CalendarDays size={15} />} label="예정일" value="7월 25일" /><InfoRow icon={<ReceiptText size={15} />} label="예상 금액" value="₩1,129,000" /></InspectorSection>
      <InspectorSection title="정산 계좌"><div className="bank-row"><span className="bank-mark">KB</span><span><strong>국민은행 · 3921</strong><small>예금주 한랩</small></span><button className="text-button" type="button">변경</button></div></InspectorSection>
      <div className="info-panel"><Info size={16} /><span><strong>수익 기능은 현재 초안입니다</strong><small>실제 결제·세금·환불 정책은 결제 제공자 연결 시 확정됩니다.</small></span></div>
    </div>
  );
}

function NewChatDialog({
  agents,
  initialScope,
  onSelect,
  onBrowse,
  onCreateAgent,
  onClose,
}: {
  agents: Agent[];
  initialScope: WorkScope;
  onSelect: (agentId: string) => void;
  onBrowse: () => void;
  onCreateAgent: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<WorkScope>(initialScope);
  const scopeAgents = agents.filter((agent) => (
    scope === "created" ? agent.ownership === "mine" : agent.ownership === "market" && agent.hired
  ));
  const available = scopeAgents.filter((agent) => (
    `${agent.name} ${agent.headline}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const counts: Record<WorkScope, number> = {
    created: agents.filter((agent) => agent.ownership === "mine").length,
    hired: agents.filter((agent) => agent.ownership === "market" && agent.hired).length,
  };
  return (
    <Dialog
      title={scope === "created" ? "내 서비스 고객 경험 테스트" : "새 디자인 작업 맡기기"}
      subtitle="디자이너가 설계한 질문과 품질 기준을 확인할 서비스를 선택하세요."
      onClose={onClose}
    >
      <div className="dialog-work-scope-tabs" role="tablist" aria-label="에이전트 구분">
        {([
          { id: "created", label: "직접 만든" },
          { id: "hired", label: "고용한" },
        ] as Array<{ id: WorkScope; label: string }>).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={scope === item.id}
            className={scope === item.id ? "active" : ""}
            onClick={() => setScope(item.id)}
          >
            <span>{item.label}</span>
            <small>{counts[item.id]}</small>
          </button>
        ))}
      </div>
      <label className="dialog-search"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="디자인 서비스 검색" /></label>
      <div className="dialog-agent-list">
        {available.length > 0 ? (
          available.map((agent) => (
            <button type="button" key={agent.id} onClick={() => onSelect(agent.id)}>
              <AgentAvatar agent={agent} size="medium" />
              <span><strong>{agent.name}</strong><small>{agent.headline}</small></span>
              <span className="dialog-agent-price"><PendingPrice agent={agent} compact /></span>
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <div className="dialog-agent-empty">
            {query.trim() ? <Search size={20} /> : scope === "created" ? <Bot size={20} /> : <Compass size={20} />}
            <strong>{query.trim()
              ? "검색 결과가 없어요"
              : scope === "created" ? "아직 직접 만든 에이전트가 없어요" : "아직 고용한 에이전트가 없어요"}</strong>
          </div>
        )}
      </div>
      <button
        className="dialog-footer-action"
        type="button"
        onClick={scope === "created" ? onCreateAgent : onBrowse}
      >
        {scope === "created" ? <Plus size={15} /> : <Compass size={15} />}
        {scope === "created" ? "새 디자인 서비스 만들기" : "디자인 서비스 둘러보기"}
        <ChevronRight size={14} />
      </button>
    </Dialog>
  );
}

function NewAgentDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (agent: Agent) => Promise<void> }) {
  const [creationStep, setCreationStep] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AgentCategory>("디자인");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [runPrice, setRunPrice] = useState("");
  const [designSystem, setDesignSystem] = useState<DesignDecisionSystem>(() => defaultDesignSystem());
  const [seedFiles, setSeedFiles] = useState<AgentOutputExample[]>([]);
  const [profileImage, setProfileImage] = useState<Attachment | null>(null);
  const [pickingSeedFiles, setPickingSeedFiles] = useState<"example" | "prompt" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validBasic = Boolean(name.trim() && headline.trim() && summary.trim());
  const valid = Boolean(validBasic && normalizeRunPrice(runPrice) > 0);
  const pickSeedFiles = async (kind: "example" | "prompt") => {
    if (!window.hiremeDesktop || pickingSeedFiles) return;
    setPickingSeedFiles(kind);
    try {
      const picked = await window.hiremeDesktop.pickFiles();
      const supported = (picked || []).filter(isAgentSeedFile).map((file) => ({
        ...file,
        kind: kind === "example" ? "agent-output-example" : "agent-prompt-file",
        description: kind === "example" ? "예시 결과" : "프롬프트 파일",
      }));
      if (!supported.length && picked?.length) {
        setError("예시 결과와 프롬프트 파일에는 Markdown 또는 이미지 파일만 넣을 수 있어요.");
        return;
      }
      setSeedFiles((current) => {
        const next = [...current, ...supported];
        return next.filter((file, index) => (
          next.findIndex((candidate) => (candidate.path || candidate.name) === (file.path || file.name)) === index
        )).slice(0, 6);
      });
    } finally {
      setPickingSeedFiles(null);
    }
  };
  const pickProfileImage = async () => {
    if (!window.hiremeDesktop) return;
    const files = await window.hiremeDesktop.pickFiles();
    const image = (files || []).find(isImageFile);
    if (!image) {
      if (files?.length) setError("프로필 사진은 PNG, JPEG, WebP 또는 GIF 이미지여야 해요.");
      return;
    }
    setProfileImage(image);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        id: slugify(name),
        name: name.trim(),
        creator: "나",
        category,
        headline: headline.trim(),
        summary: summary.trim(),
        image: profileImage?.path,
        skills: parseCommaSeparated(skills, [category, "맞춤 작업"]),
        resultTypes: seedFiles.length
          ? seedFiles.map((file) => file.name)
          : [defaultOutputFileForCategory(category)],
        outputExamples: seedFiles,
        accent: "green",
        rating: 0,
        reviews: 0,
        uses: 0,
        billingMode: "run",
        runPrice: normalizeRunPrice(runPrice),
        version: "0.1.0",
        ownership: "mine",
        status: "초안",
        revenue30d: 0,
        subscribers: 0,
        runtime: "local",
        designSystem: category === "디자인" ? designSystem : undefined,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught || "");
      setError(/already exists|agent_exists/i.test(message)
        ? "같은 이름의 에이전트가 이미 있어요. 이름을 조금 다르게 정해 주세요."
        : "초안을 만들지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.");
      setBusy(false);
    }
  };
  return (
    <Dialog title="새 디자인 에이전트 만들기" subtitle="전문가의 작업 방식을 고객이 쉽게 실행할 수 있는 서비스로 구성합니다." onClose={onClose} wide scrollable>
      <form className="agent-form edit-agent-form" onSubmit={submit}>
        <CreationStepper step={creationStep} />
        {creationStep === 0 && <section className="creation-step-panel">
          <div className="creation-step-copy"><span>01 · 서비스 기본 정보</span><h3>어떤 디자인 작업을 대신할 에이전트인가요?</h3><p>사용자에게 보이는 이름과 결과물 약속부터 정합니다. 기술 용어는 노출하지 않습니다.</p></div>
          <ProfileImageField image={profileImage} onPick={() => void pickProfileImage()} onClear={() => setProfileImage(null)} />
          <label><span>서비스 이름</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 뷰티 상세페이지 디자이너" required disabled={busy} /></label>
          <label><span>한 줄 약속</span><input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="예: 제품의 구매 이유가 한눈에 읽히는 상세페이지를 만들어요" required disabled={busy} /></label>
          <label><span>이 서비스가 해결하는 일</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="누구의 어떤 문제를 해결하고, 어떤 결과를 잘 만드는지 알려주세요." required disabled={busy} /></label>
          <fieldset disabled={busy}><legend>전문 분야</legend><div className="segmented-options">{(["디자인", "글쓰기", "비즈니스", "리서치", "생산성"] as AgentCategory[]).map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></fieldset>
          <label><span>제작하는 결과물</span><input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="상세페이지, 광고 소재, 배너" disabled={busy} /><small>쉼표로 구분해 주세요.</small></label>
        </section>}
        {creationStep === 1 && <section className="creation-step-panel">
          <div className="creation-step-copy"><span>02 · 고객 질문 설계</span><h3>좋은 결과를 위해 무엇을 물어봐야 하나요?</h3><p>사용자는 프롬프트를 쓰지 않습니다. 질문과 선택지를 통해 필요한 맥락을 받습니다.</p></div>
          {category === "디자인" && <DesignSystemEditor value={designSystem} onChange={setDesignSystem} disabled={busy} />}
        </section>}
        {creationStep === 2 && <section className="creation-step-panel">
          <div className="creation-step-copy"><span>03 · 전달 방식과 테스트</span><h3>결과물과 첫 테스트를 준비하세요.</h3><p>대표 결과를 넣으면 다음 단계에서 실제 고객 화면과 캔버스 수정 흐름을 바로 확인할 수 있습니다.</p></div>
          <label><span>실행당 가격</span><input type="text" inputMode="numeric" value={runPrice} onChange={(event) => setRunPrice(formatRunPriceInput(event.target.value))} placeholder="예: 1,900" required disabled={busy} /><small>{runPrice ? `${formatWon(normalizeRunPrice(runPrice))} / 실행` : "사용자가 에이전트를 한 번 실행할 때 받을 금액(원)입니다."}</small></label>
          <section className="profile-output-editor agent-seed-file-editor">
          <div className="profile-output-editor-heading">
            <span><strong>전달할 파일</strong><small>예시 결과와 프롬프트 파일은 Markdown 또는 이미지 파일로 추가할 수 있습니다.</small></span>
            <div className="agent-seed-file-actions">
              <button className="secondary-button compact" type="button" onClick={() => void pickSeedFiles("example")} disabled={!window.hiremeDesktop || Boolean(pickingSeedFiles) || busy}>
                {pickingSeedFiles === "example" ? <LoaderCircle className="spin" size={14} /> : <Paperclip size={14} />}
                예시 결과
              </button>
              <button className="secondary-button compact" type="button" onClick={() => void pickSeedFiles("prompt")} disabled={!window.hiremeDesktop || Boolean(pickingSeedFiles) || busy}>
                {pickingSeedFiles === "prompt" ? <LoaderCircle className="spin" size={14} /> : <Paperclip size={14} />}
                프롬프트 파일
              </button>
            </div>
          </div>
          {seedFiles.length > 0 && <div className="profile-output-editor-list">
            {seedFiles.map((file) => (
              <div key={file.path || `${file.kind}-${file.name}`}>
                <span className="profile-output-editor-thumbnail"><FileThumbnail file={file} /></span>
                <span><strong>{file.name}</strong><small>{file.description} · {outputTypeLabel(file.mimeType)}{file.size ? ` · ${formatFileSize(file.size)}` : ""}</small></span>
                <button className="icon-button" type="button" aria-label={`${file.name} 제거`} title="제거" onClick={() => setSeedFiles((current) => current.filter((item) => item !== file))}><X size={14} /></button>
              </div>
            ))}
          </div>}
          {!seedFiles.length && <p className="agent-seed-file-empty">아직 추가한 파일이 없습니다. 설계 대화 중에도 더 추가할 수 있어요.</p>}
          {!window.hiremeDesktop && <small className="profile-output-editor-note">설치된 데스크톱 앱에서 파일을 추가할 수 있습니다.</small>}
          </section>
        </section>}
        {error && <p className="agent-create-error" role="alert">{error}</p>}
        <div className="dialog-actions creation-actions">
          {creationStep === 0 ? <button className="secondary-button" type="button" onClick={onClose} disabled={busy}>취소</button> : <button className="secondary-button" type="button" onClick={() => setCreationStep((current) => current - 1)} disabled={busy}>이전</button>}
          {creationStep < 2 ? <button className="primary-button" type="button" onClick={() => setCreationStep((current) => current + 1)} disabled={busy || (creationStep === 0 && !validBasic)}>다음 단계 <ChevronRight size={15} /></button> : <button className="primary-button" type="submit" disabled={!valid || busy}>{busy ? <><LoaderCircle className="spin" size={15} /> 초안 만드는 중</> : "에이전트 만들고 관리 시작"}</button>}
        </div>
      </form>
    </Dialog>
  );
}

function CreationStepper({ step }: { step: number }) {
  return <div className="creation-stepper" aria-label="에이전트 생성 단계">{["기본 정보", "고객 질문", "전달·테스트"].map((label, index) => <span className={index === step ? "active" : index < step ? "complete" : ""} key={label}><i>{index < step ? <Check size={12} /> : index + 1}</i>{label}</span>)}</div>;
}

function EditAgentDialog({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  onSave: (updates: Partial<Agent>) => Promise<boolean>;
}) {
  const [name, setName] = useState(agent.name);
  const [headline, setHeadline] = useState(agent.headline);
  const [summary, setSummary] = useState(agent.summary);
  const [category, setCategory] = useState<AgentCategory>(agent.category);
  const [skills, setSkills] = useState(agent.skills.join(", "));
  const [runPrice, setRunPrice] = useState(agent.runPrice ? String(agent.runPrice) : "");
  const [resultTypes, setResultTypes] = useState(agent.resultTypes.join(", "));
  const [designSystem, setDesignSystem] = useState<DesignDecisionSystem>(() => agent.designSystem || defaultDesignSystem());
  const [outputExamples, setOutputExamples] = useState<AgentOutputExample[]>(outputExamplesForAgent(agent));
  const [profileImage, setProfileImage] = useState<Attachment | null>(agent.image ? {
    name: "agent-profile-image",
    path: agent.image,
  } : null);
  const [pickingOutput, setPickingOutput] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = Boolean(name.trim() && headline.trim() && summary.trim() && normalizeRunPrice(runPrice) > 0);
  const pickOutputExamples = async () => {
    if (!window.hiremeDesktop || pickingOutput) return;
    setPickingOutput(true);
    try {
      const files = await window.hiremeDesktop.pickFiles();
      if (!files?.length) return;
      setOutputExamples((current) => {
        const next = [...current, ...files];
        return next.filter((file, index) => (
          next.findIndex((candidate) => (candidate.path || candidate.name) === (file.path || file.name)) === index
        )).slice(0, 6);
      });
    } finally {
      setPickingOutput(false);
    }
  };
  const pickProfileImage = async () => {
    if (!window.hiremeDesktop) return;
    const files = await window.hiremeDesktop.pickFiles();
    const image = (files || []).find(isImageFile);
    if (image) setProfileImage(image);
  };
  return (
    <Dialog title="에이전트 프로필 수정" subtitle="사용자에게 보이는 이름, 소개, 능력과 결과물을 관리합니다." onClose={onClose} wide scrollable>
      <form className="agent-form edit-agent-form" onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        await onSave({
          name: name.trim(),
          headline: headline.trim(),
          summary: summary.trim(),
          category,
          image: profileImage?.path,
          runPrice: normalizeRunPrice(runPrice),
          skills: parseCommaSeparated(skills, agent.skills),
          resultTypes: parseCommaSeparated(resultTypes, agent.resultTypes),
          outputExamples,
          designSystem: category === "디자인" ? designSystem : undefined,
        });
        setSaving(false);
      }}>
        <ProfileImageField image={profileImage} onPick={() => void pickProfileImage()} onClear={() => setProfileImage(null)} />
        <label><span>이름</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label><span>한 줄 소개</span><input value={headline} onChange={(event) => setHeadline(event.target.value)} required /></label>
        <label><span>상세 설명</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} required /></label>
        <fieldset><legend>분야</legend><div className="segmented-options">{(["디자인", "글쓰기", "비즈니스", "리서치", "생산성"] as AgentCategory[]).map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></fieldset>
        <div className="agent-create-two-column">
          <label><span>잘하는 일</span><input value={skills} onChange={(event) => setSkills(event.target.value)} /><small>쉼표로 구분</small></label>
          <label><span>결과물</span><input value={resultTypes} onChange={(event) => setResultTypes(event.target.value)} /><small>쉼표로 구분</small></label>
        </div>
        {category === "디자인" && <DesignSystemEditor value={designSystem} onChange={setDesignSystem} />}
        <label><span>실행당 가격</span><input type="text" inputMode="numeric" value={runPrice} onChange={(event) => setRunPrice(formatRunPriceInput(event.target.value))} placeholder="예: 1,900" required /><small>{runPrice ? `${formatWon(normalizeRunPrice(runPrice))} / 실행` : "사용자가 에이전트를 한 번 실행할 때 받을 금액(원)입니다."} · 수익 기능 준비 중</small></label>
        <section className="profile-output-editor">
          <div className="profile-output-editor-heading">
            <span><strong>결과 예시 파일</strong><small>프로필에서 사용자가 미리 확인할 수 있는 실제 결과물을 추가하세요.</small></span>
            <button className="secondary-button compact" type="button" onClick={() => void pickOutputExamples()} disabled={!window.hiremeDesktop || pickingOutput}>
              {pickingOutput ? <LoaderCircle className="spin" size={14} /> : <Paperclip size={14} />}
              파일 추가
            </button>
          </div>
          <div className="profile-output-editor-list">
            {outputExamples.map((output) => (
              <div key={output.path || output.name}>
                <span className="profile-output-editor-thumbnail"><FileThumbnail file={output} /></span>
                <span><strong>{output.name}</strong><small>{outputTypeLabel(output.mimeType)}{output.size ? ` · ${formatFileSize(output.size)}` : ""}</small></span>
                <button className="icon-button" type="button" aria-label={`${output.name} 제거`} title="제거" onClick={() => setOutputExamples((current) => current.filter((item) => item !== output))}><X size={14} /></button>
              </div>
            ))}
          </div>
          {!window.hiremeDesktop && <small className="profile-output-editor-note">설치된 데스크톱 앱에서 예시 파일을 추가할 수 있습니다.</small>}
        </section>
        <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>취소</button><button className="primary-button" type="submit" disabled={!valid || saving}>{saving ? <><LoaderCircle className="spin" size={14} /> 저장 중</> : "저장"}</button></div>
      </form>
    </Dialog>
  );
}

function DesignSystemEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: DesignDecisionSystem;
  onChange: (value: DesignDecisionSystem) => void;
  disabled?: boolean;
}) {
  const updateQuestion = (id: string, updates: Partial<DesignQuestion>) => {
    onChange({
      ...value,
      questions: value.questions.map((question) => question.id === id ? { ...question, ...updates } : question),
    });
  };
  const setLines = (key: "priorities" | "avoid" | "qualityBar", text: string) => {
    onChange({ ...value, [key]: text.split("\n").map((line) => line.trim()).filter(Boolean) });
  };
  const addQuestion = () => {
    onChange({
      ...value,
      questions: [
        ...value.questions,
        {
          id: `question-${eventTimeMs().toString(36)}`,
          label: "",
          kind: "short",
          required: true,
        },
      ],
    });
  };

  return (
    <section className="design-system-editor">
      <div className="design-system-editor-heading">
        <span className="design-system-editor-icon"><Target size={18} /></span>
        <span><strong>Design Decision System</strong><small>색상보다 중요한 목적, 우선순위, 금지 규칙과 통과 기준을 정의합니다.</small></span>
      </div>

      <label>
        <span>이 서비스가 지켜야 할 핵심 목적</span>
        <textarea value={value.purpose} onChange={(event) => onChange({ ...value, purpose: event.target.value })} rows={2} disabled={disabled} placeholder="예: 제품의 전문성을 유지하면서 3초 안에 핵심 효능이 읽히게 합니다." />
      </label>

      <div className="design-system-rule-grid">
        <label><span>판단 우선순위</span><textarea value={value.priorities.join("\n")} onChange={(event) => setLines("priorities", event.target.value)} rows={3} disabled={disabled} /><small>한 줄에 하나씩 입력</small></label>
        <label><span>절대 피할 것</span><textarea value={value.avoid.join("\n")} onChange={(event) => setLines("avoid", event.target.value)} rows={3} disabled={disabled} /><small>평균적인 AI 결과를 막는 기준</small></label>
      </div>

      <label>
        <span>결과 통과 기준</span>
        <textarea value={value.qualityBar.join("\n")} onChange={(event) => setLines("qualityBar", event.target.value)} rows={3} disabled={disabled} />
        <small>결과 생성 후 자동 검사에 사용됩니다.</small>
      </label>

      <div className="design-question-editor-heading">
        <span><strong><MessageCircleQuestion size={15} /> User Ask Questions</strong><small>고객은 빈 프롬프트 대신 아래 질문에 답하고 작업을 시작합니다.</small></span>
        <button className="secondary-button compact" type="button" onClick={addQuestion} disabled={disabled}><Plus size={14} /> 질문 추가</button>
      </div>

      <div className="design-question-editor-list">
        {value.questions.map((question, index) => (
          <article className="design-question-editor-card" key={question.id}>
            <span className="design-question-number">{String(index + 1).padStart(2, "0")}</span>
            <div className="design-question-editor-fields">
              <input value={question.label} onChange={(event) => updateQuestion(question.id, { label: event.target.value })} placeholder="고객에게 물어볼 질문" disabled={disabled} />
              <div>
                <select value={question.kind} onChange={(event) => updateQuestion(question.id, { kind: event.target.value as DesignQuestionKind })} disabled={disabled}>
                  <option value="single">하나 선택</option>
                  <option value="multi">복수 선택</option>
                  <option value="short">짧은 답변</option>
                  <option value="long">긴 답변</option>
                </select>
                {(question.kind === "single" || question.kind === "multi") && (
                  <input value={(question.options || []).join(", ")} onChange={(event) => updateQuestion(question.id, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="선택지, 쉼표로 구분" disabled={disabled} />
                )}
              </div>
              <label className="design-question-required"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} disabled={disabled} /> 필수 질문</label>
            </div>
            <button className="icon-button" type="button" aria-label={`${index + 1}번 질문 제거`} title="질문 제거" disabled={disabled || value.questions.length === 1} onClick={() => onChange({ ...value, questions: value.questions.filter((item) => item.id !== question.id) })}><Trash2 size={14} /></button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProfileImageField({
  image,
  onPick,
  onClear,
}: {
  image: Attachment | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const { source, onError } = useFilePreview(image || { name: "" });
  return (
    <section className="agent-profile-image-field">
      <span className="agent-profile-image-preview">
        {source ? <img src={source} alt="선택한 에이전트 프로필" onError={onError} /> : <Bot size={19} />}
      </span>
      <span><strong>프로필 사진</strong><small>에이전트 목록과 작업 채팅에 표시됩니다.</small></span>
      <div>
        <button className="secondary-button compact" type="button" onClick={onPick} disabled={!window.hiremeDesktop}><Paperclip size={14} /> 사진 선택</button>
        {image && <button className="icon-button" type="button" aria-label="프로필 사진 제거" title="제거" onClick={onClear}><X size={14} /></button>}
      </div>
    </section>
  );
}

function Dialog({ title, subtitle, onClose, closeable = true, wide = false, profile = false, scrollable = false, children }: { title: string; subtitle?: string; onClose: () => void; closeable?: boolean; wide?: boolean; profile?: boolean; scrollable?: boolean; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (closeable && event.target === event.currentTarget) onClose(); }}>
      <section className={profile ? "dialog agent-profile-dialog" : `dialog${wide ? " wide" : ""}${scrollable ? " scrollable-dialog" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header><div><h2 id="dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{closeable && <button className="icon-button" type="button" aria-label="닫기" title="닫기" onClick={onClose}><X size={18} /></button>}</header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>
  );
}

function AgentAvatar({ agent, size }: { agent?: Agent; size: "small" | "medium" | "large" }) {
  const Icon = agent ? categoryIcons[agent.category] : Bot;
  const { source: image, onError } = useAgentProfileImage(agent?.image);
  if (image) {
    return <span className={`agent-avatar ${size}`}><img src={image} alt="" onError={onError} /></span>;
  }
  return <span className={`agent-avatar ${size} ${agent?.accent || "charcoal"}`}><Icon size={size === "large" ? 25 : size === "medium" ? 19 : 15} /></span>;
}

function AgentCover({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const Icon = categoryIcons[agent.category];
  const { source: image, onError } = useAgentProfileImage(agent.image);
  return (
    <div className={`agent-cover ${agent.accent} ${compact ? "compact" : ""}`}>
      {image
        ? <img src={image} alt={`${agent.name} 결과 예시`} onError={onError} />
        : <Icon size={compact ? 34 : 42} />}
      <span className="cover-category"><Icon size={12} /> {agent.category}</span>
    </div>
  );
}

function Metric({ label, value, detail, positive, icon }: { label: string; value: string; detail: string; positive?: boolean; icon: ReactNode }) {
  return <div className="metric"><div className="metric-label"><span>{icon}</span>{label}</div><strong>{value}</strong><small className={positive ? "positive" : ""}>{positive && <TrendingUp size={12} />}{detail}</small></div>;
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  return <span className={`status-badge ${status === "공개" ? "published" : status === "검토 중" ? "review" : "draft"}`}><span />{status}</span>;
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="inspector-section"><h3>{title}</h3>{children}</section>;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="info-row"><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function EarningRow({ date, agent, type, usage, amount }: { date: string; agent?: string; type: string; usage: string; amount: string }) {
  return <tr><td>{date}</td><td><strong>{agent || "에이전트"}</strong></td><td><span className={`earning-type ${type === "구독" ? "subscription" : "usage"}`}>{type}</span></td><td>{usage}</td><td><span className="earning-status"><Check size={12} /> 반영됨</span></td><td><strong>{amount}</strong></td></tr>;
}

function workScopeForAgent(agent?: Agent): WorkScope {
  return agent?.ownership === "market" ? "hired" : "created";
}

function workScopeForConversation(conversation: Conversation, agents: Agent[]): WorkScope {
  return workScopeForAgent(agents.find((agent) => agent.id === conversation.agentId));
}

function eventTimeMs() {
  return Date.now();
}

function isManagementSessionActive(
  session?: HireMeAgentManagementSession,
): session is HireMeAgentManagementSession {
  return Boolean(session && Date.parse(session.expiresAt) > eventTimeMs());
}

function isManagementSessionError(error: unknown) {
  const record = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown }
    : null;
  const code = String(record?.code || "");
  const message = error instanceof Error
    ? error.message
    : typeof record?.message === "string"
      ? record.message
      : String(error || "");
  return (
    /^(management_session_required|management_session_mismatch)$/i.test(code) ||
    /management_session_(required|mismatch)/i.test(message) ||
    /관리 모드.*다시 열어야|관리 세션.*일치하지 않|관리 세션.*만료/i.test(message)
  );
}

function runErrorCode(error: unknown) {
  const record = error && typeof error === "object"
    ? error as { code?: unknown; message?: unknown }
    : null;
  const direct = String(record?.code || "").trim().toLowerCase();
  if (/^[a-z0-9_]{1,80}$/.test(direct)) return direct;
  const message = error instanceof Error
    ? error.message
    : typeof record?.message === "string"
      ? record.message
      : String(error || "");
  return message.match(/\[([a-z0-9_]{1,80})\]/i)?.[1]?.toLowerCase() || "";
}

function isRunCancelledError(error: unknown) {
  return runErrorCode(error) === "run_cancelled";
}

function createEntityUuid() {
  if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function useElapsed(startedAt: number) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - startedAt));
  useEffect(() => {
    const updateElapsed = () => setElapsed(Math.max(0, Date.now() - startedAt));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return elapsed;
}

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Browser storage is optional; the desktop runtime remains the durable source.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

async function runAgentRequest({ runId, conversationId, agent, text, attachments, workspace, conversation, managementSession }: { runId: string; conversationId: string; agent: Agent; text: string; attachments: Attachment[]; workspace: string; conversation?: Conversation; managementSession?: HireMeAgentManagementSession }) {
  const bridge = window.hiremeDesktop;
  const managementActive = Boolean(
    isManagementSessionActive(managementSession) &&
    managementSession.conversationId === conversationId &&
    managementSession.agentId === agent.id,
  );
  if (bridge && agent.runtime !== "preview") {
    return bridge.sendChat({
      runId,
      conversationId,
      agentId: agent.id,
      text,
      attachments,
      workspace,
      mode: managementActive ? "agent_authoring" : "work",
      managementSessionId: managementActive ? managementSession?.id : undefined,
      agentName: agent.name,
      agentBrief: `${agent.headline}\n${agent.summary}`,
      history: managementActive
        ? conversation?.messages.map(({ role, text: messageText }) => ({ role, text: messageText })) || []
        : undefined,
    });
  }
  if (bridge) {
    throw new Error("이 에이전트의 실행 패키지를 준비하지 못했습니다.");
  }
  await new Promise((resolve) => window.setTimeout(resolve, 840));
  if (managementActive) {
    return {
      output: "말해준 기준을 초안에 반영했어요. 다음으로, 결과가 좋지 않았던 대표 사례 한 가지와 그때 반드시 피해야 할 점을 알려주세요.",
      elapsedMs: 840,
      artifacts: [],
    };
  }
  return {
    output: buildPreviewAgentResult(agent, text),
    elapsedMs: 840,
    artifacts: buildPreviewArtifacts(agent),
  };
}

function buildPreviewArtifacts(agent: Agent): Attachment[] {
  if (agent.category !== "디자인") return [];
  return (agent.outputExamples || outputExampleCatalog[agent.id] || [])
    .slice(0, 2)
    .map((example) => ({
      name: example.name,
      mimeType: example.mimeType,
      size: example.size,
      previewUrl: example.previewUrl,
      kind: example.mimeType?.startsWith("image/") ? "image" : "file",
    }));
}

function buildPreviewAgentResult(agent: Agent, text: string) {
  if (agent.id === "brand-voice-editor") return buildBrandVoicePreview(text);
  return sampleReplies[agent.id] || [
    `${agent.name} 결과 초안`,
    "",
    "요청 요약",
    text.trim() || "요청한 작업을 정리합니다.",
    "",
    "다음 단계",
    "필요한 맥락과 결과 형식을 확인한 뒤, 바로 사용할 수 있는 산출물로 정리합니다.",
  ].join("\n");
}

function buildBrandVoicePreview(text: string) {
  const compact = String(text || "").trim().replace(/\s+/g, " ");
  const isHireMeMarketingBrief = /hireme|에이전트|agent/i.test(compact);
  if (isHireMeMarketingBrief) {
    return [
      "HireMe 마케팅 초안",
      "",
      "핵심 메시지",
      "당신은 결정하세요. 일은 당신의 에이전트가 합니다.",
      "",
      "히어로 헤드라인",
      "일은 맡기고, 결과만 확인하세요.",
      "",
      "소개 카피",
      "HireMe에서는 필요한 전문 AI 에이전트를 고용해 리서치, 카피, 검토, 제작 같은 반복 업무를 맡길 수 있습니다. 당신은 일을 처음부터 끝까지 처리하는 대신, 목표를 정하고 결과를 검토하며 다음 결정을 내리면 됩니다.",
      "",
      "보조 메시지",
      "당신이 직접 일하지 마세요. 당신의 에이전트가 일하게 하세요.",
      "",
      "CTA",
      "내 일을 맡길 에이전트 찾기",
    ].join("\n");
  }
  return [
    "브랜드 카피 초안",
    "",
    "다듬은 메시지",
    compact || "브랜드가 고객에게 약속하는 가치를 한 문장으로 정리하세요.",
    "",
    "권장 방향",
    "과장된 표현보다 고객이 얻는 변화와 실제 작업 방식을 먼저 보여 주세요. 짧은 문장으로 핵심 약속을 말하고, 바로 다음 문장에서 근거를 덧붙이면 더 단정하고 자신감 있게 읽힙니다.",
    "",
    "CTA",
    "지금 브랜드 문장 다듬기",
  ].join("\n");
}

function createStreamFrames(value: string) {
  const characters = Array.from(String(value || ""));
  if (!characters.length) return [""];
  const frameCount = Math.min(42, Math.max(8, Math.ceil(characters.length / 34)));
  const step = Math.max(1, Math.ceil(characters.length / frameCount));
  const frames: string[] = [];
  for (let end = step; end < characters.length; end += step) {
    frames.push(characters.slice(0, end).join(""));
  }
  frames.push(value);
  return frames;
}

function streamFrameDelayMs(frameCount: number) {
  return Math.max(18, Math.min(48, Math.round(1_050 / Math.max(1, frameCount))));
}

function waitForStreamFrame(ms: number) {
  return new Promise<void>((resolveWait) => window.setTimeout(resolveWait, ms));
}

function mergeNativeAgents(current: Agent[], nativeAgents: HireMeNativeAgent[]) {
  const byId = new Map(current.map((agent) => [agent.id, agent]));
  for (const nativeAgent of nativeAgents) {
    const existing = byId.get(nativeAgent.id);
    if (existing) {
      byId.set(nativeAgent.id, {
        ...existing,
        name: nativeAgent.name || existing.name,
        headline: nativeAgent.headline || existing.headline,
        summary: nativeAgent.publicSummary || existing.summary,
        skills: nativeAgent.publicSkills?.length ? nativeAgent.publicSkills : existing.skills,
        runtime: "local",
      });
      continue;
    }
    byId.set(nativeAgent.id, {
      id: nativeAgent.id,
      name: nativeAgent.name,
      creator: "나",
      category: normalizeCategory(nativeAgent.category),
      headline: nativeAgent.headline || "로컬에서 만든 전문 에이전트",
      summary: nativeAgent.publicSummary || "HireMe 로컬 런타임에서 실행되는 에이전트입니다.",
      skills: nativeAgent.publicSkills || [],
      resultTypes: ["문서"],
      accent: "green",
      rating: 0,
      reviews: 0,
      uses: 0,
      billingMode: "run",
      runPrice: 1000,
      version: "0.1.0",
      ownership: "mine",
      status: "초안",
      revenue30d: 0,
      subscribers: 0,
      runtime: "local",
    });
  }
  return Array.from(byId.values());
}

function mergeDatabaseAgents(current: Agent[], databaseAgents: HireMeDatabaseAgent[]) {
  const byId = new Map(current.map((agent) => [agent.id, agent]));
  for (const databaseAgent of databaseAgents) {
    if (isRetiredMockAgent(databaseAgent)) continue;
    const existing = byId.get(databaseAgent.id);
    const keepLocalPublishedVersion = Boolean(
      existing?.ownership === "mine" &&
      existing.authoring?.packageDigest &&
      compareVersions(existing.version, databaseAgent.version) > 0,
    );
    byId.set(databaseAgent.id, {
      ...existing,
      ...databaseAgent,
      ...(keepLocalPublishedVersion ? { version: existing!.version } : {}),
      ...(existing?.ownership === "mine" && normalizeRunPrice(existing.runPrice) > 0
        ? { runPrice: existing.runPrice }
        : {}),
      image: databaseAgent.image || existing?.image,
      runtime: databaseAgent.runtime === "local" || existing?.runtime === "local"
        ? "local"
        : databaseAgent.runtime,
      source: "database",
    });
  }
  return Array.from(byId.values());
}

function isRetiredMockAgent(agent: Pick<Agent, "id" | "name"> | Pick<HireMeDatabaseAgent, "id" | "name">) {
  return legacyMockAgentIds.has(agent.id) || /friendly\s*empathy/i.test(agent.name);
}

function isRetiredMockAgentId(agentId: string) {
  return legacyMockAgentIds.has(agentId) || /friendly[-_]?empathy/i.test(String(agentId || ""));
}

function mergeDatabaseConversations(
  current: Conversation[],
  databaseConversations: HireMeDatabaseConversation[],
) {
  const currentById = new Map(current.map((conversation) => [conversation.id, conversation]));
  const databaseIds = new Set(databaseConversations.map((conversation) => conversation.id));
  const recoveredLocal = current
    .filter((conversation) => !databaseIds.has(conversation.id))
    .map((conversation) => (
      conversation.storage === "database"
        ? { ...conversation, storage: "local" as const }
        : conversation
    ));
  return [
    ...databaseConversations.map((conversation) => {
      const existing = currentById.get(conversation.id);
      const messagesById = new Map(
        (existing?.messages || []).map((message) => [message.id, message]),
      );
      conversation.messages.forEach((message) => {
        messagesById.set(message.id, { ...message });
      });
      return {
        ...conversation,
        mode: existing?.mode || "work",
        messages: Array.from(messagesById.values()).sort(
          (left, right) => Date.parse(left.at) - Date.parse(right.at),
        ),
      };
    }),
    ...recoveredLocal,
  ];
}

function normalizeCategory(value: string): AgentCategory {
  const lower = String(value || "").toLowerCase();
  if (/image|design|character/.test(lower)) return "디자인";
  if (/writing|copy|conversation/.test(lower)) return "글쓰기";
  if (/business|launch|growth/.test(lower)) return "비즈니스";
  if (/research|data/.test(lower)) return "리서치";
  return "생산성";
}

function normalizeRunPrice(value: unknown) {
  const price = Math.round(Number(String(value ?? "").replace(/[^0-9]/g, "")));
  return Number.isFinite(price) && price > 0 && price <= 10_000_000 ? price : 0;
}

function formatRunPriceInput(value: string) {
  const digits = String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function formatAgentPrice(agent: Pick<Agent, "runPrice">) {
  const price = normalizeRunPrice(agent.runPrice);
  return price ? `1회 ${formatWon(price)}` : "가격 미설정";
}

function PendingPrice({ agent, compact = false }: { agent: Pick<Agent, "runPrice">; compact?: boolean }) {
  return (
    <span className={`pending-price${compact ? " compact" : ""}`}>
      <s>{formatAgentPrice(agent)}</s>
      {!compact && <small>수익 기능 준비 중</small>}
    </span>
  );
}

function readManifestList(manifest: Record<string, unknown>, key: string) {
  return Array.isArray(manifest?.[key]) ? manifest[key].map(String).slice(0, 6) : [];
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "크기 미정";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelativeTime(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return "방금";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function outputExamplesForAgent(agent: Agent): AgentOutputExample[] {
  if (agent.outputExamples?.length) return agent.outputExamples;
  const catalog = outputExampleCatalog[agent.id];
  if (catalog?.length) return catalog;

  const fileBase = slugify(agent.name) || "agent-output";
  if (agent.image) {
    const imageName = agent.image.split("/").pop() || `${fileBase}-example.png`;
    return [{
      name: imageName,
      mimeType: imageName.toLowerCase().match(/\.jpe?g$/) ? "image/jpeg" : "image/png",
      previewUrl: agent.image,
      description: `${agent.name}이 전달하는 대표 결과 이미지입니다.`,
    }];
  }

  const previewText = [
    `# ${agent.name} 결과 예시`,
    "",
    agent.summary,
    "",
    "## 포함 내용",
    ...agent.resultTypes.map((type) => `- ${type}`),
    "",
    "## 적용 기준",
    ...agent.skills.map((skill) => `- ${skill}`),
  ].join("\n");
  return [{
    name: `${fileBase}-example.md`,
    mimeType: "text/markdown",
    size: new Blob([previewText]).size,
    previewText,
    description: `${agent.name}의 대표 결과 구조를 보여주는 예시 문서입니다.`,
  }];
}

function outputTypeLabel(mimeType?: string) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized === "image/png") return "PNG";
  if (normalized === "image/jpeg") return "JPG";
  if (normalized === "application/pdf") return "PDF";
  if (normalized === "text/markdown") return "Markdown";
  if (normalized === "text/csv") return "CSV";
  if (normalized.startsWith("text/")) return "텍스트";
  return "파일";
}

function defaultOutputFileForCategory(category: AgentCategory) {
  if (category === "디자인") return "result.png";
  if (category === "글쓰기") return "result.md";
  if (category === "비즈니스") return "proposal.pdf";
  if (category === "리서치") return "research-report.md";
  return "result.md";
}

function formatWon(value: number) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function appAssetUrl(value: string) {
  return value.startsWith("/assets/") ? `.${value}` : value;
}

function isImageFile(file: Attachment) {
  if (file.mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
}

function isAgentSeedFile(file: Attachment) {
  return isImageFile(file) || file.mimeType === "text/markdown" || /\.md$/i.test(file.name);
}

function isDraftOutputRequest(text: string, attachments: Attachment[]) {
  if (attachments.length > 0) return true;
  const value = String(text || "").trim();
  if (!value) return false;
  if (/^시험\s*[:：]/.test(value)) return true;

  // Creator-facing changes stay in the protected management flow. A concrete
  // deliverable request instead runs the current local draft and returns its artifacts.
  if (/하네스|프롬프트|규칙|작업\s*방식|기억|메모리|스킬|배포|버전|수정|고쳐|바꿔|추가|삭제|검증|평가|관리\s*모드/i.test(value)) {
    return false;
  }
  return /그려|이미지|사진|일러스트|만들어|제작|생성|작성|써줘|정리해|분석해|계획|제안서|파일|결과물|output/i.test(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatFileBytes(value: number) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(bytes < 10 * 1_024 ? 1 : 0)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function formatElapsed(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

function formatClock(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function summarizeTitle(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 26 ? `${text.slice(0, 26)}…` : text || "새 작업";
}

function shortPath(value: string) {
  if (!value) return "선택 안 됨";
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/") || value;
}

function userInitials(value?: string | null) {
  const parts = String(value || "H")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "H";
}

function incrementPatch(version: string) {
  const parts = version.split(".").map((part) => Number(part) || 0);
  return `${parts[0] || 0}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
}

function compareVersions(left: string, right: string) {
  const leftParts = String(left).split(".").map((part) => Number(part) || 0);
  const rightParts = String(right).split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function slugify(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `agent-${Date.now().toString(36)}`;
}

function parseCommaSeparated(value: string, fallback: string[]) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? [...new Set(items)].slice(0, 12) : fallback;
}

function publicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = runErrorCode(error);
  if (isManagementSessionError(error)) return "관리 모드가 만료되었거나 현재 작업과 일치하지 않아요. 관리 모드를 다시 열어 주세요.";
  if (code === "run_cancelled" || /cancel/i.test(message)) return "작업을 중지했어요.";
  if (code === "runtime_interrupted") return "AI 실행이 예기치 않게 중단됐어요. 다시 시도할 수 있도록 로컬 진단 기록을 남겼습니다.";
  if (code === "agent_unavailable") return "이 컴퓨터에서 선택한 에이전트의 실행 패키지를 찾지 못했어요.";
  if (code === "agent_hire_required") return "이 에이전트를 먼저 고용한 뒤 작업을 시작해 주세요.";
  if (code === "agent_run_entitlement_required") return "이 에이전트의 남은 실행 권한을 확인해 주세요.";
  if (code === "agent_package_unavailable") return "이 에이전트의 실행 패키지가 아직 준비되지 않았어요. 공개 버전과 검토 상태를 확인해 주세요.";
  if (code === "hireme_auth_required") return "HireMe에 다시 로그인한 뒤 작업을 시작해 주세요.";
  if (code === "provider_connection_required") return "설정에서 ChatGPT 계정을 다시 연결해 주세요.";
  if (code === "provider_response_limit") return "이미지 생성 응답이 앱의 처리 한도를 넘었어요. HireMe를 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.";
  if (/openai_codex_image_(rate_limited|slow_down)/i.test(code) || /temporarily rate limited|slow down/i.test(message)) {
    return "이미지 생성 요청이 잠시 제한됐어요. 안내된 시간 후 다시 시도해 주세요.";
  }
  if (/openai_codex_image_timeout/i.test(code) || /image generation timed out/i.test(message)) {
    return "이미지 생성이 오래 걸려 결과를 받지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (/iteration budget exceeded|tool-call budget exceeded/i.test(message)) {
    return "AI가 내부 작업 단계를 정리하지 못했어요. 변경 대상이나 원하는 결과를 한 가지로 좁혀 다시 시도해 주세요.";
  }
  if (/설정|codex|login|oauth|local ai|ollama/i.test(message)) return "설정에서 작업에 사용할 AI의 연결 상태를 확인해 주세요.";
  return "AI 실행을 완료하지 못했어요. 다시 시도할 수 있도록 로컬 진단 기록을 남겼습니다.";
}

function publicAiSettingsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/cancel|취소/i.test(message)) return "계정 연결을 취소했습니다.";
  if (/network|fetch/i.test(message)) return "연결 상태를 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.";
  return message.slice(0, 300) || "AI 연결 설정을 완료하지 못했습니다.";
}

function publicLoginError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/network|fetch|connect/i.test(message)) return "로그인 서버에 연결할 수 없습니다.";
  return message.slice(0, 300) || "Google 로그인을 완료하지 못했습니다.";
}
