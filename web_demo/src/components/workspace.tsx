"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Code2,
  Layers3,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  receiptFromRuntimeStep,
  resultFromRuntime,
  resultMarkdown,
  suggestions,
  type Agent,
  type DemoResult,
  type Receipt,
  type RuntimeStepEvent,
  type ChainSettlement,
} from "@/lib/demo";
import FlowCanvas from "./flow-canvas";
import { AgentIcon } from "./agent-icon";
import RuntimeStatus from "./runtime-status";
import SlushWalletControl from "./slush-wallet-control";
type Message = { id: string; role: "user" | "assistant"; content: string };
type History = {
  id: string;
  task: string;
  result: DemoResult;
  messages: Message[];
};
const startingIds: string[] = [];

function SettlementReceipt({ settlement }: { settlement?: ChainSettlement }) {
  if (!settlement?.transactionDigest) return null;
  const tokens = settlement.usages?.reduce((sum, item) => sum + item.outputTokens, 0) ?? 0;
  const href = `https://suiscan.xyz/testnet/tx/${encodeURIComponent(settlement.transactionDigest)}`;
  return (
    <section className="transaction-receipt">
      <div><span className="status-dot" /><div><strong>Sui 정산 완료</strong><p>{tokens.toLocaleString("ko-KR")} output tokens · Testnet</p></div></div>
      <code>{settlement.transactionDigest}</code>
      <a href={href} target="_blank" rel="noreferrer">트랜잭션 확인하기 <ExternalLink size={13} /></a>
    </section>
  );
}

function mentionQueryAt(value: string, caret: number) {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1].toLowerCase() : null;
}

function jsonDisplay(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function Workspace() {
  const [selectedIds, setSelectedIds] = useState(startingIds);
  const [customAgents, setCustomAgents] = useState<Agent[]>([]);
  const allAgents = useMemo(() => customAgents, [customAgents]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => allAgents.find((a) => a.id === id)!)
        .filter(Boolean),
    [selectedIds, allAgents],
  );
  useEffect(() => {
    let active = true;
    void fetch("/api/agents")
      .then((response) => (response.ok ? response.json() : { agents: [] }))
      .then((payload) => {
        if (!active || !Array.isArray(payload.agents)) return;
        const restored: Agent[] = payload.agents.map(
          (agent: {
            name: string;
            displayName?: string;
            endpoint?: string;
            workflow?: string;
            execution?: { kind: string; url?: string; status?: string };
            pricePer100M?: number;
          }): Agent => {
            const registered = Boolean(agent.execution);
            const isMarket = agent.workflow === "crypto_html";
            return {
              id: agent.name,
              name:
                agent.displayName ??
                (isMarket
                  ? "Crypto Market HTML"
                  : agent.workflow === "crypto_news"
                    ? "Crypto News Research"
                    : agent.name),
              role: registered
                ? "Custom Agent"
                : isMarket
                  ? "Market Report Agent"
                  : "Crypto Research Agent",
              description: registered
                ? agent.execution?.kind === "hireme_hosted_demo"
                  ? "GitHub 분석 결과의 도구·프롬프트를 사용해 HireMe에서 호스팅합니다."
                  : "등록한 MCP 서버를 통해 실행됩니다."
                : isMarket
                  ? "시장 데이터와 뉴스 요약을 HTML 리포트로 만드는 등록 MCP 에이전트입니다."
                  : "암호화폐 뉴스와 근거를 수집·분석하는 등록 MCP 에이전트입니다.",
              author: registered ? "you" : "hireme",
              price: 0,
              color: isMarket ? "blue" : "green",
              icon: isMarket ? "write" : "search",
              category: registered ? "사용자" : "호스팅",
              serverUrl: agent.execution?.url ?? agent.endpoint,
              existingServer: agent.execution?.kind === "remote_mcp",
              registryManaged: registered,
              pricePer100M: agent.pricePer100M,
            };
          },
        );
        setCustomAgents((items) => {
          const restoredIds = new Set(restored.map((agent) => agent.id));
          return [
            ...restored,
            ...items.filter((agent) => !restoredIds.has(agent.id)),
          ];
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [tab, setTab] = useState<"result" | "trace">("result");
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notice, setNotice] = useState("");
  const [inspect, setInspect] = useState<Agent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [existingServer, setExistingServer] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [pricePer100M, setPricePer100M] = useState("");
  const [registeringAgent, setRegisteringAgent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const runRef = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      runRef.current++;
    },
    [],
  );
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages, active]);
  useEffect(() => {
    if (inspect || showHelp || showAddAgent) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [inspect, showHelp, showAddAgent]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const cost = selected.reduce((sum, a) => sum + a.price, 0);
  const filtered = allAgents.filter(
    (a) =>
      (category === "전체" || a.category === category) &&
      `${a.name} ${a.description} ${a.role}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const mentionAgents =
    mentionQuery === null
      ? []
      : allAgents.filter((agent) =>
          `${agent.name} ${agent.role}`.toLowerCase().includes(mentionQuery),
        );
  const remove = useCallback((id: string) => {
    setSelectedIds((ids) => ids.filter((a) => a !== id));
    setSelectedNodeId((selectedId) => (selectedId === id ? null : selectedId));
    setCompleted([]);
  }, []);
  function toggleAgent(agent: Agent) {
    if (running) return;
    if (selectedIds.includes(agent.id)) {
      setSelectedNodeId((selectedId) =>
        selectedId === agent.id ? null : selectedId,
      );
    }
    setSelectedIds((ids) =>
      ids.includes(agent.id)
        ? ids.filter((id) => id !== agent.id)
        : [...ids, agent.id],
    );
    setCompleted([]);
  }
  async function deleteRegisteredAgent(agent: Agent) {
    if (running) return;
    try {
      const response = await fetch(
        `/api/agents/${encodeURIComponent(agent.id)}`,
        {
          method: "DELETE",
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "에이전트를 삭제하지 못했습니다.");
      }
      setCustomAgents((items) => items.filter((item) => item.id !== agent.id));
      setSelectedIds((ids) => ids.filter((id) => id !== agent.id));
      setReceipts((items) => items.filter((item) => item.id !== agent.id));
      setCompleted((ids) => ids.filter((id) => id !== agent.id));
      setSelectedNodeId((id) => (id === agent.id ? null : id));
      if (inspect?.id === agent.id) setInspect(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "에이전트를 삭제하지 못했습니다.",
      );
    }
  }
  function updateMention(value: string, caret: number) {
    setMentionQuery(mentionQueryAt(value, caret));
    setMentionIndex(0);
  }
  function insertMention(agent: Agent) {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? input.length;
    const atIndex = input.slice(0, caret).lastIndexOf("@");
    const nextInput = `${input.slice(0, atIndex)}@${agent.name} ${input.slice(caret)}`;
    setInput(nextInput);
    setSelectedIds((ids) =>
      ids.includes(agent.id) ? ids : [...ids, agent.id],
    );
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      const nextCaret = atIndex + agent.name.length + 2;
      textarea?.setSelectionRange(nextCaret, nextCaret);
    });
  }
  async function registerAgent() {
    if (!agentName.trim() || !githubUrl.trim()) {
      setNotice("에이전트 이름과 GitHub 링크를 입력해주세요.");
      return;
    }
    if (existingServer && !serverUrl.trim()) {
      setNotice("기존 서버 URL을 입력해주세요.");
      return;
    }
    if (
      existingServer &&
      (!pricePer100M.trim() ||
        !Number.isFinite(Number(pricePer100M)) ||
        Number(pricePer100M) < 0)
    ) {
      setNotice("100M 토큰당 가격을 0 이상의 숫자로 입력해주세요.");
      return;
    }
    setRegisteringAgent(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: agentName.trim(),
          github_url: githubUrl.trim(),
          existing_server: existingServer,
          server_url: existingServer ? serverUrl.trim() : undefined,
          price_per_100m: existingServer ? Number(pricePer100M) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.agent) {
        throw new Error(payload.detail ?? "에이전트를 등록하지 못했습니다.");
      }
      const registered: Agent = {
        id: payload.agent.id,
        name: payload.agent.name,
        role: payload.agent.role ?? "Custom Agent",
        description: existingServer
          ? "등록한 서버 URL을 통해 실행되는 에이전트입니다."
          : "HireMe에서 호스팅하는 에이전트입니다.",
        author: "you",
        price: payload.agent.price ?? 0,
        color: "blue",
        icon: "code",
        category: "사용자",
        githubUrl: payload.agent.githubUrl,
        serverUrl: payload.agent.serverUrl,
        hostedUrl: payload.agent.hostedUrl,
        existingServer: payload.agent.existingServer,
        registryManaged: true,
        pricePer100M: payload.agent.pricePer100M ?? undefined,
        status: payload.agent.existingServer ? "ready" : "pending",
      };
      setCustomAgents((items) => [...items, registered]);
      setSelectedIds((ids) =>
        ids.includes(registered.id) ? ids : [...ids, registered.id],
      );
      setAgentName("");
      setGithubUrl("");
      setServerUrl("");
      setPricePer100M("");
      setExistingServer(false);
      setShowAddAgent(false);
      setInspect(registered);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "에이전트를 등록하지 못했습니다.",
      );
    } finally {
      setRegisteringAgent(false);
    }
  }
  function cancel() {
    runRef.current++;
    setRunning(false);
    setActive(null);
    setMessages((ms) => [
      ...ms,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "실행을 중지했습니다. 실제 결제는 발생하지 않았습니다. 실행 내역에서 완료된 단계를 확인할 수 있어요.",
      },
    ]);
  }
  async function run() {
    const task = input.trim();
    if (!task || running) return;
    const mentionedAgents = allAgents.filter((agent) =>
      task.toLowerCase().includes(`@${agent.name.toLowerCase()}`),
    );
    const order = mentionedAgents.length ? mentionedAgents : selected;
    if (!order.length) {
      setNotice("왼쪽 목록에서 에이전트를 한 개 이상 추가해주세요.");
      return;
    }
    const token = ++runRef.current;
    if (mentionedAgents.length) {
      setSelectedIds((ids) => [
        ...ids,
        ...mentionedAgents
          .map((agent) => agent.id)
          .filter((id) => !ids.includes(id)),
      ]);
    }
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: task,
    };
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput("");
    setMentionQuery(null);
    setRunning(true);
    setResult(null);
    setReceipts([]);
    setCompleted([]);
    setSelectedNodeId(null);
    setTab("result");
    try {
      setActive(order[0]?.id ?? null);
      const response = await fetch("/api/runs/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task,
          agents: order.map(({ id, name, role, price }) => ({
            id,
            name,
            role,
            price,
          })),
        }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json()) as { detail?: string };
        throw new Error(payload.detail ?? "워크플로 실행에 실패했습니다.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let output: DemoResult | null = null;
      const stepReceipts: Receipt[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done || token !== runRef.current) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const rawEvent of events) {
          const dataLine = rawEvent
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const event = JSON.parse(dataLine.slice(6)) as RuntimeStepEvent;
          if (event.type === "step.started" && event.agentId) {
            setActive(event.agentId);
          } else if (event.type === "step.completed" && event.step) {
            const receipt = receiptFromRuntimeStep(event.step);
            stepReceipts.push(receipt);
            setReceipts([...stepReceipts]);
            setCompleted(stepReceipts.map((item) => item.id));
          } else if (
            event.type === "step.failed" ||
            event.type === "workflow.failed"
          ) {
            throw new Error(event.error ?? "워크플로 실행에 실패했습니다.");
          } else if (event.type === "workflow.completed" && event.result) {
            output = resultFromRuntime(event.result);
          }
        }
      }
      if (token !== runRef.current) return;
      if (!output) throw new Error("완료 결과를 받지 못했습니다.");
      setReceipts(output.receipts);
      setCompleted(output.receipts.map((step) => step.id));
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${order.length}개 에이전트 실행을 완료했어요. 각 단계가 선택한 MCP 도구와 프롬프트는 실행 내역에서 확인할 수 있어요.`,
      };
      setResult(output);
      setMessages([...conversation, reply]);
      setHistory((items) =>
        [
          {
            id: output.runId,
            task,
            result: output,
            messages: [...conversation, reply],
          },
          ...items,
        ].slice(0, 8),
      );
    } catch (error) {
      if (token !== runRef.current) return;
      const message =
        error instanceof Error
          ? error.message
          : "워크플로 실행에 실패했습니다.";
      setNotice(message);
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `실행하지 못했습니다: ${message}`,
        },
      ]);
    } finally {
      if (token === runRef.current) {
        setRunning(false);
        setActive(null);
      }
    }
  }
  function selectSuggestion(suggestion: (typeof suggestions)[number]) {
    setSelectedIds(
      allAgents
        .slice(0, suggestion.type === "code" ? 1 : 2)
        .map((agent) => agent.id),
    );
    setCompleted([]);
    setSelectedNodeId(null);
    setInput(suggestion.prompt);
    textareaRef.current?.focus();
  }
  async function copyResult() {
    if (!result && !activeHtml) return;
    try {
      await navigator.clipboard.writeText(
        activeHtml ?? resultMarkdown(result!),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("복사할 수 없습니다. 다운로드로 결과를 저장해주세요.");
    }
  }
  function download() {
    if (activeHtml) {
      const url = URL.createObjectURL(
        new Blob([activeHtml], { type: "text/html;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `hireme-${result?.runId ?? selectedNodeReceipt?.id ?? "result"}.html`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([resultMarkdown(result)], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `hireme-${result.runId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function openHistory(item: History) {
    if (running) return;
    setResult(item.result);
    setMessages(item.messages);
    setReceipts(item.result.receipts);
    setSelectedIds(item.result.receipts.map((r) => r.id));
    setCompleted(item.result.receipts.map((r) => r.id));
    setSelectedNodeId(null);
    setTab("result");
    setSidebarOpen(false);
  }
  const totalDuration = receipts.reduce((sum, r) => sum + r.duration, 0);
  const selectedNodeAgent = selected.find(
    (agent) => agent.id === selectedNodeId,
  );
  const selectedNodeReceipt = receipts.find(
    (receipt) => receipt.id === selectedNodeId,
  );
  const selectedNodeIsRunning = selectedNodeAgent?.id === active && running;
  const activeHtml = selectedNodeReceipt?.html ?? result?.html;
  const currentQuestion =
    result?.task ??
    [...messages].reverse().find((message) => message.role === "user")
      ?.content ??
    input.trim();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-area">
          <button
            className="icon-button mobile-menu"
            aria-label="에이전트 목록 열기"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={20} />
          </button>
          <Link className="brand" href="/" aria-label="HireMe 홈">
            <span className="brand-mark">
              <Layers3 size={21} />
            </span>
            hireme<span className="brand-period">.</span>
          </Link>
        </div>
        <RuntimeStatus />
        <SlushWalletControl />
      </header>
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="사이드바 닫기"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="search-row">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="에이전트 검색"
              placeholder="에이전트 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span>⌕</span>
          </label>
          <button
            className="search-add"
            aria-label="에이전트 추가"
            title="에이전트 추가"
            disabled={running}
            onClick={() => setShowAddAgent(true)}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="category-tabs">
          {["전체", "리서치", "콘텐츠", "개발"].map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="agent-list">
          {filtered.map((agent) => (
            <article
              className={`library-agent ${selectedIds.includes(agent.id) ? "added" : ""}`}
              key={agent.id}
            >
              <div className="library-agent-top">
                <AgentIcon agent={agent} />
                <div>
                  <button
                    className="agent-name"
                    onClick={() => setInspect(agent)}
                  >
                    {agent.name}
                  </button>
                  <span>@{agent.author}</span>
                </div>
                <span className="agent-actions">
                  <button
                    className="agent-add"
                    aria-label={`${agent.name} ${selectedIds.includes(agent.id) ? "제거" : "추가"}`}
                    disabled={running}
                    onClick={() => toggleAgent(agent)}
                  >
                    {selectedIds.includes(agent.id) ? (
                      <Check size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                  </button>
                  <button
                    className="agent-delete"
                    aria-label={`${agent.name} 삭제`}
                    title={
                      agent.registryManaged
                        ? "등록 에이전트 삭제"
                        : "워크플로에서 제거"
                    }
                    disabled={running}
                    onClick={() => {
                      if (agent.registryManaged) {
                        void deleteRegisteredAgent(agent);
                      } else {
                        remove(agent.id);
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
              <p>{agent.description}</p>
              <div className="agent-meta">
                <span>
                  <span className="status-dot" /> Hosted MCP
                </span>
                <span
                  className={
                    agent.price || agent.pricePer100M !== undefined
                      ? ""
                      : "free-price"
                  }
                >
                  {agent.pricePer100M !== undefined ? (
                    <>
                      {agent.pricePer100M} <small>USDC / 100M</small>
                    </>
                  ) : agent.price ? (
                    <>
                      {agent.price} <small>USDC / 실행</small>
                    </>
                  ) : (
                    "Free"
                  )}
                </span>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <p className="search-empty">검색 결과가 없습니다.</p>
          )}
        </div>
        {history.length > 0 && (
          <div className="history-section">
            <div className="history-heading">
              <span>RECENT CHATS</span>
              <Clock3 size={12} />
            </div>
            {history.map((item) => (
              <button
                key={item.id}
                disabled={running}
                onClick={() => openHistory(item)}
              >
                <MessageIcon />
                <span>{item.task}</span>
              </button>
            ))}
          </div>
        )}
      </aside>
      <main className="main-panel">
        <div className="workspace-topbar">
          <div>
            <span className="workspace-icon">
              <Workflow size={17} />
            </span>
            <strong>My agent playground</strong>
            <span className="draft-badge">Draft</span>
          </div>
          <button
            className="icon-button"
            aria-label="워크플로 안내"
            onClick={() => setShowHelp(true)}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
        <section className="chat-section">
          <div className="chat-scroll">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-symbol" aria-hidden="true">
                  <Layers3 size={24} />
                </div>
                <h1>무엇을 도와드릴까요?</h1>
                <p>
                  필요한 에이전트를 연결하고, 하고 싶은 일을 말해주세요.
                  <br />
                  당신의 AI 팀이 함께 결과를 만들어갑니다.
                </p>
                <div className="suggestions">
                  {suggestions.map((s, i) => (
                    <button key={s.label} onClick={() => selectSuggestion(s)}>
                      <span>
                        {i === 0 ? (
                          <Zap size={14} />
                        ) : i === 1 ? (
                          <Code2 size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                        {s.label}
                      </span>
                      <ArrowUp size={12} className="suggestion-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="conversation">
                {messages.map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    <span
                      className={
                        message.role === "assistant"
                          ? "assistant-avatar"
                          : "message-avatar"
                      }
                    >
                      {message.role === "assistant" ? (
                        <Layers3 size={16} />
                      ) : (
                        "JD"
                      )}
                    </span>
                    <div>
                      <span className="message-author">
                        {message.role === "assistant" ? "HireMe" : "You"}
                      </span>
                      <p>{message.content}</p>
                      {message.role === "assistant" && result && (
                        <button
                          className="view-result"
                          onClick={() => {
                            setTab("result");
                            document
                              .getElementById("output-panel")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "nearest",
                              });
                          }}
                        >
                          결과 보기 <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {running && (
                  <div className="message assistant">
                    <span className="assistant-avatar">
                      <Layers3 size={16} />
                    </span>
                    <div>
                      <span className="message-author">HireMe</span>
                      <p className="working-message">
                        <Loader2 size={14} className="spin" />{" "}
                        {selected.find((a) => a.id === active)?.name}이 작업하고
                        있어요<span className="typing-dots">...</span>
                      </p>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            <textarea
              ref={textareaRef}
              aria-label="에이전트에게 요청할 작업"
              placeholder="어떤 일을 함께 해볼까요?"
              value={input}
              disabled={running}
              onChange={(e) => {
                setInput(e.target.value);
                updateMention(e.target.value, e.target.selectionStart);
              }}
              rows={2}
              onKeyDown={(e) => {
                if (mentionAgents.length) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex(
                      (index) => (index + 1) % mentionAgents.length,
                    );
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex(
                      (index) =>
                        (index - 1 + mentionAgents.length) %
                        mentionAgents.length,
                    );
                    return;
                  }
                  if (e.key === "Escape") {
                    setMentionQuery(null);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    insertMention(mentionAgents[mentionIndex]);
                    return;
                  }
                }
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void run();
                }
              }}
            />
            {mentionAgents.length > 0 && (
              <div
                className="mention-menu"
                role="listbox"
                aria-label="에이전트 멘션 선택"
              >
                {mentionAgents.map((agent, index) => (
                  <button
                    key={agent.id}
                    type="button"
                    role="option"
                    aria-selected={index === mentionIndex}
                    className={index === mentionIndex ? "active" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMention(agent)}
                  >
                    <AgentIcon agent={agent} small />
                    <span>
                      <strong>@{agent.name}</strong>
                      <small>{agent.role}</small>
                    </span>
                    {selectedIds.includes(agent.id) && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
            <div className="composer-footer">
              <button
                className="team-label"
                aria-label={`선택된 에이전트 ${selected.length}개 워크플로 보기`}
                type="button"
                onClick={() => {
                  document
                    .querySelector(".canvas-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
              >
                <span className="mini-team">
                  {selected.slice(0, 3).map((a) => (
                    <AgentIcon key={a.id} agent={a} small />
                  ))}
                </span>
                {selected.length} agents <ChevronDown size={12} />
              </button>
              <div>
                <span className="estimated-price">
                  예상 <strong>{cost.toFixed(3)} USDC</strong>
                </span>
                {running ? (
                  <button
                    type="button"
                    className="send-button"
                    onClick={cancel}
                    aria-label="실행 중지"
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="send-button"
                    disabled={!input.trim() || !selected.length}
                    aria-label="워크플로 실행"
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
          </form>
          <p className="composer-note">
            <ShieldCheck size={12} /> 선택한 순서대로 실행하며, 유료 Agent의
            성공한 사용량은 Sui Testnet에서 정산됩니다.
          </p>
        </section>
        <FlowCanvas
          selected={selected}
          active={active}
          completed={completed}
          running={running}
          selectedNodeId={selectedNodeId}
          onRemove={remove}
          onInspect={setInspect}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            setTab("result");
          }}
        />
        <div className="main-footer">
          <span>
            <span className="status-dot" /> All systems ready
          </span>
          <span>Build your team. Make things happen.</span>
        </div>
      </main>
      <aside className="output-panel" id="output-panel">
        <div className="output-heading">
          <div>
            <span className="output-heading-icon">
              <FileText size={17} />
            </span>
            <strong>결과</strong>
          </div>
          <span className={`output-state ${running ? "running" : ""}`}>
            {selectedNodeIsRunning
              ? "작업 중"
              : running
                ? "실행 중"
                : selectedNodeId === "input"
                  ? "질문"
                  : selectedNodeAgent
                    ? selectedNodeReceipt
                      ? "에이전트 결과"
                      : "선택됨"
                    : result
                      ? "완료"
                      : "대기 중"}
          </span>
        </div>
        <div className="output-tabs">
          <button
            className={tab === "result" ? "active" : ""}
            onClick={() => setTab("result")}
          >
            <FileText size={14} /> 결과
          </button>
          <button
            className={tab === "trace" ? "active" : ""}
            onClick={() => setTab("trace")}
          >
            <Workflow size={14} /> 실행 내역{" "}
            {receipts.length > 0 && <span>{receipts.length}</span>}
          </button>
          <div className="output-tools">
            <button
              className="icon-button"
              aria-label="결과 복사"
              title="결과 복사"
              disabled={!result && !activeHtml}
              onClick={() => void copyResult()}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              className="icon-button"
              aria-label="결과 다운로드"
              title={activeHtml ? "HTML 다운로드" : "Markdown 다운로드"}
              disabled={!result && !activeHtml}
              onClick={download}
            >
              <ArrowDownToLine size={14} />
            </button>
          </div>
        </div>
        <div className="output-content" aria-live="polite">
          {tab === "trace" ? (
            <div className="trace-view">
              <div className="result-eyebrow">EXECUTION TRACE</div>
              <h2>팀의 작업 과정</h2>
              <p className="trace-description">
                에이전트별 실행 상태와 예시 비용을 확인하세요.
              </p>
              {!receipts.length && !running && (
                <div className="trace-empty">
                  <Workflow size={25} />
                  <p>
                    워크플로를 실행하면
                    <br />각 단계의 내역이 표시됩니다.
                  </p>
                </div>
              )}
              {receipts.map((r, i) => (
                <div className="trace-item" key={r.id}>
                  <div className="trace-line">
                    <span className="trace-check">
                      <Check size={13} />
                    </span>
                    <strong>
                      {String(i + 1).padStart(2, "0")} · {r.name}
                    </strong>
                  </div>
                  <p>{r.summary}</p>
                  <div>
                    <span>{(r.duration / 1000).toFixed(1)}s</span>
                    <span>{r.price ? `${r.price} Test USDC` : "Free"}</span>
                    <span className="success-label">Succeeded</span>
                  </div>
                </div>
              ))}
              {running && (
                <div className="trace-item">
                  <div className="trace-line">
                    <Loader2 className="spin" size={15} />
                    <strong>
                      {selected.find((a) => a.id === active)?.name}
                    </strong>
                  </div>
                  <p>데모 작업을 실행하고 있습니다...</p>
                </div>
              )}
              {receipts.length > 0 && (
                <div className="trace-total">
                  <span>성공한 호출의 예시 비용</span>
                  <strong>
                    {receipts.reduce((s, r) => s + r.price, 0).toFixed(3)} Test
                    USDC
                  </strong>
                  <small>실제 결제 및 제작자 정산은 발생하지 않습니다.</small>
                </div>
              )}
            </div>
          ) : selectedNodeId === "input" ? (
            <article className="node-detail">
              <div className="document-label">
                <span>
                  <span className="status-dot" /> WORKFLOW INPUT
                </span>
                <span>QUESTION</span>
              </div>
              <h2>질문</h2>
              <div className="node-detail-copy">
                {currentQuestion || "아직 질문이 입력되지 않았습니다."}
              </div>
              <p>
                채팅 입력란에서 질문을 수정하고 실행하면 선택한 에이전트가 이
                내용을 순서대로 처리합니다.
              </p>
            </article>
          ) : selectedNodeAgent && selectedNodeReceipt?.html ? (
            <article className="html-result">
              <div className="document-label">
                <span>
                  <span className="status-dot" /> AGENT HTML RESULT
                </span>
                <span>{selectedNodeAgent.name}</span>
              </div>
              <h2>{selectedNodeAgent.name}</h2>
              <iframe
                className="html-preview"
                sandbox="allow-scripts"
                srcDoc={selectedNodeReceipt.html}
                title={`${selectedNodeAgent.name} HTML 결과 미리보기`}
              />
              <p>
                HTML은 격리된 미리보기로 표시됩니다. 상단 다운로드 버튼으로
                파일을 저장할 수 있습니다.
              </p>
              {selectedNodeReceipt.data !== undefined && (
                <details className="json-result">
                  <summary>JSON 결과 보기</summary>
                  <pre>{jsonDisplay(selectedNodeReceipt.data)}</pre>
                </details>
              )}
            </article>
          ) : selectedNodeAgent ? (
            <article className="agent-result">
              <div className="document-label">
                <span>
                  <span className="status-dot" /> AGENT RESULT
                </span>
                <span>
                  {selectedNodeReceipt
                    ? "COMPLETED"
                    : selectedNodeIsRunning
                      ? "WORKING"
                      : "READY"}
                </span>
              </div>
              <div className="agent-result-header">
                <AgentIcon agent={selectedNodeAgent} />
                <div>
                  <h2>{selectedNodeAgent.name}</h2>
                  <span>{selectedNodeAgent.role}</span>
                </div>
              </div>
              {selectedNodeReceipt ? (
                <>
                  <div className="agent-result-copy">
                    <span>이 에이전트의 결과</span>
                    <p>{selectedNodeReceipt.summary}</p>
                  </div>
                  <div className="agent-result-meta">
                    <span>
                      <Clock3 size={13} />{" "}
                      {(selectedNodeReceipt.duration / 1000).toFixed(1)}s
                    </span>
                    <span>
                      {selectedNodeReceipt.price
                        ? `${selectedNodeReceipt.price} Test USDC`
                        : "Free"}
                    </span>
                    <span>Completed</span>
                  </div>
                  {selectedNodeReceipt.data !== undefined && (
                    <details className="json-result">
                      <summary>JSON 결과 보기</summary>
                      <pre>{jsonDisplay(selectedNodeReceipt.data)}</pre>
                    </details>
                  )}
                </>
              ) : selectedNodeIsRunning ? (
                <div className="agent-result-working">
                  <Loader2 size={18} className="spin" />
                  <div>
                    <strong>
                      {selectedNodeAgent.name}이 현재 작업 중이에요.
                    </strong>
                    <p>
                      백엔드 응답을 받으면 이 위치에 에이전트 결과가 자동으로
                      표시됩니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="agent-result-empty">
                  <p>{selectedNodeAgent.description}</p>
                  <span>
                    아직 실행 결과가 없습니다. 워크플로를 실행하면 이 에이전트의
                    결과가 표시됩니다.
                  </span>
                </div>
              )}
            </article>
          ) : activeHtml ? (
            <article className="html-result">
              <div className="document-label">
                <span>
                  <span className="status-dot" /> HTML RESULT
                </span>
                <span>PREVIEW</span>
              </div>
              <h2>결과 미리보기</h2>
              <iframe
                className="html-preview"
                sandbox="allow-scripts"
                srcDoc={activeHtml}
                title="HTML 결과 미리보기"
              />
              <p>
                HTML은 격리된 미리보기로 표시됩니다. 상단 다운로드 버튼으로
                파일을 저장할 수 있습니다.
              </p>
              {result?.data !== undefined && (
                <details className="json-result">
                  <summary>JSON 결과 보기</summary>
                  <pre>{jsonDisplay(result.data)}</pre>
                </details>
              )}
              <SettlementReceipt settlement={result?.chainSettlement} />
            </article>
          ) : result ? (
            <article className="result-document">
              <div className="document-label">
                <span>
                  <span className="status-dot" /> GENERATED BRIEF
                </span>
                <span>DEMO</span>
              </div>
              <h2>{result.title}</h2>
              <div className="document-meta">
                <span>
                  <Clock3 size={12} /> {(totalDuration / 1000).toFixed(1)}s
                </span>
                <span>{result.receipts.length} agents</span>
                <span>한국어</span>
              </div>
              <div className="task-quote">
                <span>YOUR REQUEST</span>
                <p>{result.task}</p>
              </div>
              <p className="document-intro">{result.intro}</p>
              {result.points.map((p, i) => (
                <section className="document-point" key={p.title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                  </div>
                </section>
              ))}
              <div className="document-conclusion">
                <Sparkles size={16} />
                <div>
                  <h3>다음 단계</h3>
                  <p>{result.conclusion}</p>
                </div>
              </div>
              {result.data !== undefined && (
                <details className="json-result">
                  <summary>JSON 결과 보기</summary>
                  <pre>{jsonDisplay(result.data)}</pre>
                </details>
              )}
              <SettlementReceipt settlement={result.chainSettlement} />
              <div className="document-end">
                Generated with HireMe · {result.createdAt}
              </div>
            </article>
          ) : running ? (
            <div className="output-loading">
              <div className="loading-orbit">
                <Loader2 size={27} className="spin" />
              </div>
              <h2>좋은 결과를 만드는 중</h2>
              <p>전문 에이전트들이 순서대로 작업하고 있어요.</p>
              <div className="progress-track">
                <div
                  style={{
                    width: `${(completed.length / selected.length) * 100}%`,
                  }}
                />
              </div>
              <span>
                {completed.length} / {selected.length} agents completed
              </span>
            </div>
          ) : (
            <div className="empty-output">
              <div className="empty-illustration" aria-hidden="true">
                <FileText size={29} strokeWidth={1.4} />
              </div>
              <h2>결과가 여기에 표시됩니다</h2>
              <p>
                에이전트에게 첫 번째 작업을 맡겨보세요.
                <br />
                완성된 결과가 여기에 표시됩니다.
              </p>
              <div className="output-steps">
                <span>질문 입력</span>
                <ArrowRight size={11} />
                <span>에이전트 협업</span>
                <ArrowRight size={11} />
                <span>결과 확인</span>
              </div>
              <div className="empty-tip">
                <Zap size={15} />
                <span>
                  왼쪽의 에이전트를 추가해
                  <br />
                  나만의 워크플로를 만들 수 있어요.
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="output-bottom">
          <div>
            <span>이번 실행 비용</span>
            <strong>
              {(
                result?.cost ?? receipts.reduce((s, r) => s + r.price, 0)
              ).toFixed(3)}{" "}
              <small>Test USDC</small>
            </strong>
          </div>
          <div className="output-bottom-note">
            <ShieldCheck size={12} /> 성공한 에이전트 호출만 비용에 포함됩니다.
          </div>
        </div>
      </aside>
      {notice && (
        <div className="toast" role="alert">
          <CircleHelp size={18} />
          <span>{notice}</span>
          <button aria-label="알림 닫기" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="info-dialog"
        aria-labelledby="dialog-title"
        onCancel={() => {
          setInspect(null);
          setShowHelp(false);
          setShowAddAgent(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setInspect(null);
            setShowHelp(false);
            setShowAddAgent(false);
          }
        }}
      >
        <button
          className="dialog-close icon-button"
          aria-label="안내 닫기"
          onClick={() => {
            setInspect(null);
            setShowHelp(false);
            setShowAddAgent(false);
          }}
        >
          <X size={19} />
        </button>
        {showAddAgent ? (
          <form
            className="agent-registration"
            onSubmit={(event) => {
              event.preventDefault();
              void registerAgent();
            }}
          >
            <span className="dialog-eyebrow">ADD AGENT</span>
            <h2 id="dialog-title">에이전트를 추가하세요</h2>
            <p>
              GitHub 분석 결과를 바탕으로 에이전트를 등록하고 워크플로에 바로
              추가합니다.
            </p>
            <label>
              <span>에이전트 이름</span>
              <input
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                placeholder="예: Market Research Agent"
                autoFocus
              />
            </label>
            <label>
              <span>GitHub 링크</span>
              <input
                type="url"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
              />
            </label>
            <label className="server-choice">
              <input
                type="checkbox"
                checked={existingServer}
                onChange={(event) => setExistingServer(event.target.checked)}
              />
              <span>
                <strong>그냥 쓰고 싶어요. 이미 서버가 있어요.</strong>
                <small>등록한 URL로 작업 요청을 보냅니다.</small>
              </span>
            </label>
            {existingServer ? (
              <>
                <label>
                  <span>기존 서버 URL</span>
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(event) => setServerUrl(event.target.value)}
                    placeholder="https://agent.example.com/run"
                  />
                </label>
                <label>
                  <span>100M 토큰당 가격 (Test USDC)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={pricePer100M}
                    onChange={(event) => setPricePer100M(event.target.value)}
                    placeholder="예: 0.02"
                    required
                  />
                </label>
              </>
            ) : (
              <div className="hosting-note">
                GitHub 분석 결과의 도구와 프롬프트를 사용해 HireMe 데모 런타임에
                바로 추가합니다.
              </div>
            )}
            <button
              className="primary-button"
              disabled={registeringAgent}
              type="submit"
            >
              {registeringAgent ? "분석하고 등록하는 중..." : "에이전트 등록"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : inspect ? (
          <>
            <AgentIcon agent={inspect} />
            <span className="dialog-eyebrow">AGENT CARD · DEMO</span>
            <h2 id="dialog-title">{inspect.name}</h2>
            <p>{inspect.description}</p>
            <dl>
              <div>
                <dt>제작자 (예시)</dt>
                <dd>@{inspect.author}</dd>
              </div>
              <div>
                <dt>역할</dt>
                <dd>{inspect.role}</dd>
              </div>
              <div>
                <dt>호출당 예시 비용</dt>
                <dd>{inspect.price ? `${inspect.price} Test USDC` : "Free"}</dd>
              </div>
              {inspect.pricePer100M !== undefined && (
                <div>
                  <dt>100M 토큰당 가격</dt>
                  <dd>{inspect.pricePer100M} Test USDC</dd>
                </div>
              )}
              <div>
                <dt>입력 → 출력</dt>
                <dd>Task + Context → AgentResult</dd>
              </div>
              {inspect.githubUrl && (
                <div>
                  <dt>GitHub</dt>
                  <dd className="agent-url">{inspect.githubUrl}</dd>
                </div>
              )}
              {inspect.serverUrl && (
                <div>
                  <dt>
                    {inspect.existingServer
                      ? "기존 서버 URL"
                      : "HireMe 호스팅 URL"}
                  </dt>
                  <dd className="agent-url">{inspect.serverUrl}</dd>
                </div>
              )}
            </dl>
            <p className="dialog-footnote">
              등록된 Agent의 도구와 실행 상태는 Registry에서 관리됩니다.
            </p>
            <button
              className="primary-button"
              disabled={running}
              onClick={() => {
                toggleAgent(inspect);
                setInspect(null);
              }}
            >
              {selectedIds.includes(inspect.id)
                ? "워크플로에서 제거"
                : "워크플로에 추가"}
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <span className="welcome-symbol">
              <Sparkles size={25} />
            </span>
            <span className="dialog-eyebrow">WELCOME TO HIREME</span>
            <h2 id="dialog-title">작은 팀으로 시작해보세요.</h2>
            <ol className="help-list">
              <li>
                <strong>에이전트 선택</strong>
                <p>왼쪽 목록의 + 버튼으로 필요한 에이전트를 추가하세요.</p>
              </li>
              <li>
                <strong>워크플로 구성</strong>
                <p>
                  노드를 이동하거나 양옆 포트를 드래그해 연결하세요. 질문 →
                  에이전트 → 결과로 이어지는 흐름을 실행합니다. 연결선을 선택한
                  뒤 Delete로 제거할 수 있습니다.
                </p>
              </li>
              <li>
                <strong>요청하고 결과 확인</strong>
                <p>
                  질문을 입력하고 Enter로 실행하세요. Shift+Enter는
                  줄바꿈입니다. 결과와 실행 내역을 확인하고 Markdown으로 저장할
                  수 있습니다.
                </p>
              </li>
            </ol>
            <div className="dialog-footnote">
              이 데모는 사전 작성한 예시 결과로 동작합니다. 실제 AI 모델, 외부
              검색, GitHub 가져오기, MCP 배포, 결제 및 정산은 연결되어 있지
              않습니다.
            </div>
            <button
              className="primary-button"
              onClick={() => setShowHelp(false)}
            >
              시작하기 <ArrowRight size={16} />
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
function MessageIcon() {
  return <FileText size={13} />;
}
