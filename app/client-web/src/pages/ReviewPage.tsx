import { ArrowLeft, CheckCircle2, Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DesignAgent, DesignRequest } from "@/types";

export function ReviewPage({ agent, request, submitting, error, onBack, onSubmit }: { agent: DesignAgent; request: DesignRequest; submitting: boolean; error: string; onBack: () => void; onSubmit: () => void }) {
  return <main className="mx-auto max-w-5xl px-5 pb-24 lg:px-8">
    <section className="text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-800">Final review</p><h1 className="mt-3 text-3xl font-black tracking-[-.045em] text-stone-950 sm:text-4xl">이 내용으로 작업을 맡길까요?</h1><p className="mt-3 text-sm text-stone-600">의뢰가 접수되면 디자이너의 Mac에서 Agent가 작업을 시작합니다.</p></section>
    <Card className="mx-auto mt-9 max-w-3xl overflow-hidden"><div className="bg-emerald-950 p-6 text-white sm:p-8"><Badge className="bg-white/12 text-emerald-100">{request.category}</Badge><h2 className="mt-3 text-2xl font-black tracking-tight">{request.title}</h2><p className="mt-2 text-sm leading-6 text-emerald-100/75">{request.description}</p></div><CardContent className="space-y-6 p-6 sm:p-8">
      <dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-stone-500">Design Agent</dt><dd className="mt-1 font-black">{agent.name}</dd></div><div><dt className="text-xs text-stone-500">희망 일정</dt><dd className="mt-1 font-black">{request.deadline || "협의"}</dd></div><div><dt className="text-xs text-stone-500">참고 자료</dt><dd className="mt-1 font-black">{request.files.length}개 파일</dd></div></dl>
      <div className="rounded-xl border border-stone-200 p-4"><p className="text-xs font-black text-stone-500">작업 가이드</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{request.guide || "별도 가이드 없음"}</p></div>
      <div className="grid gap-3 sm:grid-cols-3">{[[Clock3, "비동기 작업", "Worker가 준비되면 자동 시작"], [ShieldCheck, "Private Harness", "디자이너의 실행 기준은 보호"], [CheckCircle2, "디자이너 검수", "승인된 결과만 전달"]].map(([Icon, title, copy]) => { const ItemIcon = Icon as typeof Clock3; return <div className="rounded-xl bg-stone-50 p-4" key={String(title)}><ItemIcon size={17} className="text-emerald-800" /><strong className="mt-2 block text-xs">{String(title)}</strong><small className="mt-1 block leading-4 text-stone-500">{String(copy)}</small></div>; })}</div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex items-center justify-between border-t border-stone-100 pt-6"><Button variant="ghost" onClick={onBack} disabled={submitting}><ArrowLeft size={16} /> 수정</Button><Button size="lg" onClick={onSubmit} disabled={submitting}>{submitting && <LoaderCircle className="animate-spin" size={16} />}이 Agent에게 의뢰하기</Button></div>
    </CardContent></Card>
  </main>;
}
