import { useEffect, useMemo, useState } from "react";
import { Compass, Sparkles } from "lucide-react";
import { AgentExplorerChat, type ExplorerChatMessage } from "@/components/agents/AgentExplorerChat";
import { AgentExplorerCard } from "@/components/agents/AgentExplorerCard";
import { AgentExplorerDetail } from "@/components/agents/AgentExplorerDetail";
import type { DesignAgent } from "@/types";

const categories = ["전체", "브랜딩", "커머스", "콘텐츠", "프레젠테이션"] as const;
type Category = (typeof categories)[number];
type Sort = "추천순" | "낮은 가격순" | "높은 가격순";

export function AgentExplorerPage({ agents, initialPrompt = "", onStart }: { agents: DesignAgent[]; initialPrompt?: string; onStart: (agent: DesignAgent) => void }) {
  const [query, setQuery] = useState(""); const [submittedQuery, setSubmittedQuery] = useState(""); const [category, setCategory] = useState<Category>("전체"); const [sort, setSort] = useState<Sort>("추천순"); const [selectedId, setSelectedId] = useState<string | null>(null); const [searching, setSearching] = useState(false); const [hasSearched, setHasSearched] = useState(false);
  const [messages, setMessages] = useState<ExplorerChatMessage[]>([{ id: "welcome", role: "assistant", text: "어떤 디자인 작업을 맡기고 싶으세요? 결과물, 채널, 지금 해결하고 싶은 문제를 편하게 적어 주세요." }]);
  useEffect(() => {
    if (!searching) return;
    const timer = window.setTimeout(() => {
      setSearching(false); setHasSearched(true);
      setMessages((current) => [...current, { id: `response-${Date.now()}`, role: "assistant", text: "요청을 이해했어요. 작업 방식과 결과 형식이 맞는 Agent를 아래에 정리했어요. 카드를 열어 비교해 보세요." }]);
    }, 820);
    return () => window.clearTimeout(timer);
  }, [searching]);
  useEffect(() => {
    if (!initialPrompt) return;
    setSubmittedQuery(initialPrompt); setHasSearched(true);
    setMessages((current) => [...current, { id: "landing-choice", role: "user", text: initialPrompt }, { id: "landing-match", role: "assistant", text: "이 작업에 맞는 디자이너 Agent를 먼저 정리했어요. 결과물과 제작자를 보고 비교해 보세요." }]);
  }, [initialPrompt]);
  const visible = useMemo(() => {
    const terms = submittedQuery.toLowerCase().trim();
    const matching = agents.filter((agent) => matchesCategory(agent, category) && matchesQuery(agent, terms));
    const candidates = matching.length ? matching : agents.filter((agent) => matchesCategory(agent, category));
    return candidates.sort((left, right) => sort === "낮은 가격순" ? (left.pricing.amount || Infinity) - (right.pricing.amount || Infinity) : sort === "높은 가격순" ? (right.pricing.amount || 0) - (left.pricing.amount || 0) : relevance(right, terms) - relevance(left, terms) || (left.pricing.amount || Infinity) - (right.pricing.amount || Infinity));
  }, [agents, category, sort, submittedQuery]);
  const selected = agents.find((agent) => agent.id === selectedId);
  const submitChat = () => {
    const next = query.trim(); if (!next || searching) return;
    setMessages((current) => [...current, { id: `request-${Date.now()}`, role: "user", text: next }]); setSubmittedQuery(next); setQuery(""); setSearching(true); setSelectedId(null);
  };
  const chooseSuggestion = (value: string) => { setQuery(value); };
  return <main className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
    <section className="grid gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_385px] lg:items-start"><div className="agent-explorer-intro"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.16em] text-[#465CFF]"><Sparkles size={13} /> HireMe · Agent Explorer</p><h1 className="mt-4 text-4xl font-semibold leading-[1.07] tracking-[-.065em] text-[#161616] sm:text-5xl">어떤 디자이너의<br />판단 방식이 필요한가요?</h1><p className="mt-4 max-w-xl text-base leading-7 text-[#6F6B64]">결과물과 상황을 적으면, 좋은 작업을 고르는 기준이 맞는 디자이너 Agent를 찾아드립니다.</p></div><AgentExplorerChat input={query} messages={messages} searching={searching} onInputChange={setQuery} onSubmit={submitChat} onSuggestion={chooseSuggestion} /></section>
    <section className={`agent-explorer-results ${hasSearched ? "is-visible" : ""}`} aria-hidden={!hasSearched}><div className="flex flex-col gap-4 border-b border-stone-200 py-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 overflow-x-auto">{categories.map((item) => <button key={item} type="button" className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${category === item ? "bg-emerald-100 text-emerald-900" : "text-stone-500 hover:bg-stone-100"}`} onClick={() => setCategory(item)}>{item}</button>)}</div><select className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 outline-none" value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="정렬">{(["추천순", "낮은 가격순", "높은 가격순"] as Sort[]).map((item) => <option key={item}>{item}</option>)}</select></div>
    <section className="grid gap-7 pt-8 lg:grid-cols-[minmax(0,1fr)_350px]"><div><header className="mb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#465CFF]">Curated design agents</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.045em] text-[#161616]">{submittedQuery ? `“${submittedQuery}”에 맞는 Agent` : "검증된 디자인 Agent"}</h2></div><small className="text-xs text-[#9A968F]">{visible.length}개 Agent</small></header>{visible.length ? <div className="grid gap-6 sm:grid-cols-2">{visible.map((agent, index) => <AgentExplorerCard key={agent.id} agent={agent} featured={index === 0} selected={agent.id === selectedId} onOpen={() => setSelectedId(agent.id)} />)}</div> : <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-[#D8D4CC] px-5 py-24 text-center"><Compass className="text-[#9A968F]" size={24} /><strong className="text-sm">조건에 맞는 Agent가 없어요</strong><span className="text-xs text-[#6F6B64]">다른 설명으로 다시 이야기해 보세요.</span></div>}</div>{selected && <AgentExplorerDetail agent={selected} onClose={() => setSelectedId(null)} onStart={() => onStart(selected)} />}</section></section>
  </main>;
}

function profile(agent: DesignAgent) { return `${agent.name} ${agent.creatorName} ${agent.headline} ${agent.summary} ${agent.skills.join(" ")} ${agent.resultTypes.join(" ")}`.toLowerCase(); }

function queryTerms(query: string) { return query.split(/\s+/).map((term) => term.replace(/[은는이가을를에의도만과와]$/u, "")).filter((term) => term.length > 1); }
function matchesQuery(agent: DesignAgent, query: string) { const terms = queryTerms(query); return terms.length === 0 || terms.some((term) => profile(agent).includes(term)); }
function relevance(agent: DesignAgent, query: string) { return queryTerms(query).reduce((score, term) => score + Number(profile(agent).includes(term)), 0); }

function matchesCategory(agent: DesignAgent, category: Category) {
  if (category === "전체") return true;
  const keywords: Record<Exclude<Category, "전체">, string[]> = {
    브랜딩: ["브랜드", "brand", "아트 디렉션"],
    커머스: ["커머스", "상품", "상세페이지", "conversion"],
    콘텐츠: ["콘텐츠", "소셜", "sns", "campaign", "캠페인"],
    프레젠테이션: ["프레젠테이션", "presentation", "deck", "피치"],
  };
  return keywords[category].some((keyword) => profile(agent).includes(keyword));
}
