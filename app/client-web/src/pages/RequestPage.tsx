import { ArrowRight, Image, LayoutPanelTop, Megaphone, PackageOpen, Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DesignRequest } from "@/types";

const categories = [
  { id: "브랜드·SNS", label: "브랜드·SNS", icon: Megaphone },
  { id: "상세페이지", label: "상세페이지", icon: LayoutPanelTop },
  { id: "광고 소재", label: "광고 소재", icon: Image },
  { id: "패키지", label: "패키지", icon: PackageOpen },
  { id: "프레젠테이션", label: "프레젠테이션", icon: Presentation },
];

export function RequestPage({ request, onChange, onNext }: { request: DesignRequest; onChange: (patch: Partial<DesignRequest>) => void; onNext: () => void }) {
  const ready = request.category && request.title.trim() && request.description.trim().length >= 20;
  return <main className="mx-auto max-w-5xl px-5 pb-24 lg:px-8">
    <section className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[.16em] text-emerald-800"><Sparkles size={13} /> Design Agent Marketplace</span>
      <h1 className="mt-4 text-4xl font-black tracking-[-.055em] text-stone-950 sm:text-5xl">어떤 디자인이 필요하세요?</h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-stone-600">요청을 알려주면 작업 방식과 전문 분야가 맞는 Design Agent를 찾아드릴게요.</p>
    </section>
    <Card className="mx-auto mt-10 max-w-3xl">
      <CardContent className="space-y-7 p-6 sm:p-8">
        <fieldset>
          <legend className="text-sm font-black text-stone-900">어떤 작업인가요?</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{categories.map(({ id, label, icon: Icon }) => <button className={`flex min-h-23 flex-col items-center justify-center gap-2 rounded-xl border px-2 text-xs font-bold transition ${request.category === id ? "border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-700/10" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"}`} type="button" key={id} onClick={() => onChange({ category: id })}><Icon size={20} />{label}</button>)}</div>
        </fieldset>
        <label className="block"><span className="text-sm font-black text-stone-900">프로젝트 이름</span><Input className="mt-2" value={request.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="예: 여름 신제품 인스타그램 캠페인" /></label>
        <label className="block"><span className="text-sm font-black text-stone-900">필요한 작업을 자유롭게 설명해 주세요</span><Textarea className="mt-2 min-h-42" value={request.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="제품과 브랜드, 디자인을 사용하는 채널, 얻고 싶은 결과를 함께 적으면 더 정확한 Agent를 추천할 수 있어요." /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label><span className="text-sm font-black text-stone-900">사용 채널</span><Input className="mt-2" value={request.channel} onChange={(event) => onChange({ channel: event.target.value })} placeholder="Instagram" /></label>
          <label><span className="text-sm font-black text-stone-900">희망 일정</span><Input className="mt-2" type="date" value={request.deadline} onChange={(event) => onChange({ deadline: event.target.value })} /></label>
          <label><span className="text-sm font-black text-stone-900">예산</span><Input className="mt-2" value={request.budget} onChange={(event) => onChange({ budget: event.target.value })} placeholder="20–30만원" /></label>
        </div>
        <div className="flex items-center justify-between border-t border-stone-100 pt-6"><p className="text-xs text-stone-500">입력한 내용은 Agent 추천과 작업 브리프에 사용됩니다.</p><Button size="lg" disabled={!ready} onClick={onNext}>맞는 Agent 찾기 <ArrowRight size={17} /></Button></div>
      </CardContent>
    </Card>
  </main>;
}
