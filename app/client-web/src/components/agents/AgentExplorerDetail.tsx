import { ArrowRight, Check, FileText, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesignAgent } from "@/types";

export function AgentExplorerDetail({ agent, onClose, onStart }: { agent: DesignAgent; onClose: () => void; onStart: () => void }) {
  return <aside className="sticky top-23 overflow-hidden rounded-2xl border border-[#D8D4CC] bg-white shadow-none">
    <header className="flex items-center justify-between border-b border-[#ECE9E2] px-5 py-4"><span className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#9A968F]">Created by {agent.creatorName}</span><button type="button" onClick={onClose} className="rounded-md p-1 text-[#6F6B64] hover:bg-[#ECE9E2]" aria-label="상세 닫기"><X size={18} /></button></header>
    <div className="grid h-35 place-items-center overflow-hidden bg-[#ECE9E2]">{agent.coverImageUrl ? <img className="h-full w-full object-contain" src={agent.coverImageUrl} alt="" /> : <ShieldCheck className="text-[#465CFF]" size={37} />}</div>
    <div className="p-5"><h2 className="text-2xl font-semibold tracking-[-.045em] text-[#161616]">{agent.name}</h2><p className="mt-3 text-sm leading-6 text-[#6F6B64]">{agent.summary}</p>
      <div className="mt-5 grid gap-2 border-y border-[#ECE9E2] py-4 text-xs text-[#6F6B64]"><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#465CFF]" /> Private Harness와 품질 기준을 결과에 적용</span><span className="flex items-center gap-2"><Check size={14} className="text-[#465CFF]" /> 의뢰 전 필요한 질문을 먼저 확인</span></div>
      <section className="mt-5"><h3 className="text-xs font-semibold text-[#161616]">받는 결과</h3><div className="mt-2 grid gap-2">{agent.resultTypes.map((item) => <span className="flex items-center gap-2 rounded-md bg-[#ECE9E2] px-3 py-2 text-xs text-[#6F6B64]" key={item}><FileText size={14} /> {item}</span>)}</div></section>
      <div className="mt-6 flex items-center justify-between gap-3"><div><small className="block text-[11px] text-[#9A968F]">시작 가격</small><strong className="text-sm text-[#161616]">{formatPrice(agent.pricing.amount)}</strong></div><Button onClick={onStart}>이 Agent에게 의뢰 <ArrowRight size={15} /></Button></div>
    </div>
  </aside>;
}

function formatPrice(amount?: number) { return amount ? `${amount.toLocaleString("ko-KR")}원부터` : "가격 협의"; }
