import { ArrowLeft, ArrowRight, FileText, ShieldCheck, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DesignAgent, DesignRequest } from "@/types";

export function BriefPage({ agent, request, onChange, onBack, onNext }: { agent: DesignAgent; request: DesignRequest; onChange: (patch: Partial<DesignRequest>) => void; onBack: () => void; onNext: () => void }) {
  const addFiles = (files: FileList | null) => onChange({ files: [...request.files, ...Array.from(files || [])].slice(0, 12) });
  return <main className="mx-auto max-w-5xl px-5 pb-24 lg:px-8">
    <section className="text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-800">Project brief</p><h1 className="mt-3 text-3xl font-black tracking-[-.045em] text-stone-950 sm:text-4xl">Agent가 참고할 자료를 전달하세요</h1><p className="mt-3 text-sm text-stone-600">{agent.name}이 요청의 맥락과 디자인 기준을 이해하는 데 사용합니다.</p></section>
    <Card className="mx-auto mt-9 max-w-3xl"><CardContent className="space-y-6 p-6 sm:p-8">
      <div className="flex items-center gap-4 rounded-xl bg-emerald-50 p-4"><span className="grid size-11 place-items-center rounded-full bg-emerald-800 font-black text-white">{agent.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><Badge>선택한 Agent</Badge><h2 className="mt-1 truncate text-sm font-black">{agent.name}</h2></div><button className="text-xs font-bold text-emerald-800" type="button" onClick={onBack}>변경</button></div>
      <label className="block"><span className="text-sm font-black">주요 타깃</span><Input className="mt-2" value={request.audience} onChange={(event) => onChange({ audience: event.target.value })} placeholder="예: 스킨케어 성분을 꼼꼼히 보는 20대 후반 여성" /></label>
      <label className="block"><span className="text-sm font-black">디자인 가이드</span><Textarea className="mt-2" value={request.guide} onChange={(event) => onChange({ guide: event.target.value })} placeholder="브랜드의 분위기, 원하는 인상, 참고한 디자인과 그 이유를 적어 주세요." /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-black">반드시 포함할 것</span><Textarea className="mt-2 min-h-27" value={request.mustInclude} onChange={(event) => onChange({ mustInclude: event.target.value })} placeholder="한 줄에 하나씩" /></label><label><span className="text-sm font-black">피해야 할 것</span><Textarea className="mt-2 min-h-27" value={request.mustAvoid} onChange={(event) => onChange({ mustAvoid: event.target.value })} placeholder="한 줄에 하나씩" /></label></div>
      <label className="block cursor-pointer rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-8 text-center transition hover:border-emerald-700 hover:bg-emerald-50/40"><Upload className="mx-auto text-emerald-800" size={23} /><strong className="mt-3 block text-sm">브랜드 가이드, 기존 시안, 제품 이미지 추가</strong><span className="mt-1 block text-xs text-stone-500">PNG, JPG, WEBP, SVG, PDF · 파일당 최대 50MB</span><input className="sr-only" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg,.pdf" onChange={(event) => addFiles(event.target.files)} /></label>
      {request.files.length > 0 && <div className="grid gap-2">{request.files.map((file, index) => <div className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5" key={`${file.name}-${index}`}><FileText size={16} className="text-emerald-800" /><span className="min-w-0 flex-1 truncate text-xs font-semibold">{file.name}</span><small className="text-stone-400">{(file.size / 1024 / 1024).toFixed(1)}MB</small><button type="button" aria-label={`${file.name} 제거`} onClick={() => onChange({ files: request.files.filter((_, itemIndex) => itemIndex !== index) })}><X size={15} /></button></div>)}</div>}
      <div className="flex gap-2 rounded-xl bg-stone-100 p-3 text-xs leading-5 text-stone-600"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-800" />첨부 자료는 선택한 Agent의 작업에만 사용되며 프로젝트 보존 기간이 끝나면 삭제됩니다.</div>
      <div className="flex justify-between border-t border-stone-100 pt-6"><Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> 이전</Button><Button size="lg" disabled={request.files.length === 0} onClick={onNext}>의뢰 내용 확인 <ArrowRight size={16} /></Button></div>
    </CardContent></Card>
  </main>;
}
