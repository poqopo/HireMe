import { ArrowLeft, ArrowRight } from "lucide-react";
import { AgentCard } from "@/components/agents/AgentCard";
import { Button } from "@/components/ui/button";
import type { DesignAgent, DesignRequest } from "@/types";

export function AgentMatchPage({ request, agents, selected, onSelect, onBack, onNext }: { request: DesignRequest; agents: DesignAgent[]; selected?: DesignAgent; onSelect: (agent: DesignAgent) => void; onBack: () => void; onNext: () => void }) {
  return <main className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
    <section className="text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-800">Matched for “{request.title}”</p><h1 className="mt-3 text-3xl font-black tracking-[-.045em] text-stone-950 sm:text-4xl">이 Agent들이 잘 맞아요</h1><p className="mt-3 text-sm text-stone-600">전문 분야, 공개된 작업 방식, 결과물 유형을 요청과 비교했어요. 직접 선택할 수 있습니다.</p></section>
    <div className="mt-9 grid gap-4 md:grid-cols-3">{agents.slice(0, 3).map((agent, index) => <AgentCard key={agent.id} agent={agent} rank={index} selected={agent.id === selected?.id} onSelect={() => onSelect(agent)} />)}</div>
    <div className="mt-8 flex items-center justify-between"><Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> 요청 수정</Button><Button size="lg" disabled={!selected} onClick={onNext}>선택한 Agent에게 자료 전달 <ArrowRight size={16} /></Button></div>
  </main>;
}
