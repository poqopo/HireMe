import { ArrowUpRight, BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DesignAgent } from "@/types";

export function AgentExplorerCard({ agent, selected, featured = false, onOpen }: { agent: DesignAgent; selected: boolean; featured?: boolean; onOpen: () => void }) {
  const privateHarness = agent.pricing.mode === "project";
  const accent = agentAccent(agent.id);
  return <Card className={`group overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-[#465CFF]/45 ${featured ? "sm:col-span-2" : ""} ${selected ? "border-[#465CFF] ring-2 ring-[#465CFF]/10" : ""}`}>
    <button type="button" className="block w-full text-left" onClick={onOpen}>
      <div className="relative grid h-43 place-items-center overflow-hidden" style={{ background: accent }}>
        {agent.coverImageUrl ? <img className="h-full w-full object-cover" src={agent.coverImageUrl} alt="" /> : <Sparkles className="text-emerald-800" size={39} />}
        <Badge className="absolute left-4 top-4 bg-white/90 text-[#161616]"><ShieldCheck size={11} /> {privateHarness ? "Private Harness" : "품질 기준 적용"}</Badge>
      </div>
      <CardContent className="pt-5">
        <h2 className="text-xl font-semibold tracking-[-.04em] text-[#161616]">{agent.name}</h2>
        <p className="mt-2 min-h-10 text-sm leading-5 text-[#6F6B64]">{agent.headline}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">{agent.skills.slice(0, 3).map((skill) => <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600" key={skill}>{skill}</span>)}</div>
      </CardContent>
    </button>
    <div className="flex items-center justify-between border-t border-[#ECE9E2] px-5 py-4"><span className="inline-flex items-center gap-1.5 text-xs text-[#6F6B64]"><i className="grid size-5 place-items-center rounded-full text-[9px] font-semibold text-[#161616]" style={{ background: accent }}>{agent.creatorName.slice(0, 1)}</i>{agent.creatorName}<BadgeCheck size={13} className="text-[#465CFF]" /></span><strong className="text-sm font-semibold text-[#161616]">{formatPrice(agent.pricing.amount)}</strong><button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-xs font-semibold text-[#465CFF]">작업 보기 <ArrowUpRight size={14} /></button></div>
  </Card>;
}

function formatPrice(amount?: number) { return amount ? `${amount.toLocaleString("ko-KR")}원부터` : "가격 협의"; }
function agentAccent(id: string) { const accents = ["#C8FF52", "#B9AEFF", "#FF8A75", "#A8D8FF", "#FFE79A"]; return accents[[...id].reduce((total, char) => total + char.charCodeAt(0), 0) % accents.length]; }
