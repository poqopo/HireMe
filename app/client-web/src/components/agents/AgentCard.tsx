import { ArrowUpRight, Check, Palette, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DesignAgent } from "@/types";

export function AgentCard({ agent, selected, rank, onSelect }: { agent: DesignAgent; selected: boolean; rank: number; onSelect: () => void }) {
  return <Card className={cn("overflow-hidden transition hover:-translate-y-0.5 hover:border-emerald-700/40", selected && "border-emerald-700 ring-2 ring-emerald-700/10")}>
    <div className="relative grid h-34 place-items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_58%),linear-gradient(135deg,#f5f5f4,#ecfdf5)]">
      {agent.coverImageUrl ? <img className="h-full w-full object-cover" src={agent.coverImageUrl} alt="" /> : <Palette className="text-emerald-800" size={38} />}
      <Badge className="absolute left-4 top-4 bg-white/90"><Sparkles size={11} /> {rank === 0 ? "가장 잘 맞아요" : `${rank + 1}번째 추천`}</Badge>
    </div>
    <CardContent>
      <p className="text-xs font-bold text-emerald-800">{agent.creatorName}</p>
      <h3 className="mt-1 text-lg font-black tracking-tight text-stone-950">{agent.name}</h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-stone-600">{agent.headline}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{agent.skills.slice(0, 3).map((skill) => <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600" key={skill}>{skill}</span>)}</div>
      <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
        <span className="text-sm font-black text-stone-900">{formatPrice(agent.pricing.amount)}</span>
        <Button size="sm" variant={selected ? "default" : "outline"} onClick={onSelect}>{selected ? <><Check size={14} /> 선택됨</> : <>선택 <ArrowUpRight size={14} /></>}</Button>
      </div>
    </CardContent>
  </Card>;
}

function formatPrice(amount?: number) {
  return amount ? `${amount.toLocaleString("ko-KR")}원부터` : "가격 협의";
}
