import { ArrowRight, Check, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DesignAgent, SubmittedProject } from "@/types";

export function CompletePage({ agent, project, onRestart }: { agent: DesignAgent; project: SubmittedProject; onRestart: () => void }) {
  return <main className="mx-auto grid min-h-[72vh] max-w-3xl place-items-center px-5 pb-24"><Card className="w-full text-center"><CardContent className="p-8 sm:p-12"><span className="mx-auto grid size-15 place-items-center rounded-full bg-emerald-800 text-white"><Check size={27} /></span><h1 className="mt-6 text-3xl font-black tracking-[-.045em]">프로젝트를 접수했어요</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-600">{agent.name}의 Creator Worker가 요청을 가져가 작업합니다. 디자이너가 결과를 검수하고 승인하면 이 웹에서 확인할 수 있어요.</p><div className="mx-auto mt-7 flex max-w-md items-center gap-3 rounded-xl bg-stone-100 p-4 text-left"><Clock3 size={19} className="text-emerald-800" /><div><small className="block text-stone-500">현재 상태</small><strong className="text-sm">작업 대기 중 · {project.jobId.slice(0, 8)}</strong></div></div><div className="mt-8 flex justify-center gap-2"><Button variant="outline" onClick={onRestart}>새 프로젝트</Button><Button>진행 상황 보기 <ArrowRight size={16} /></Button></div></CardContent></Card></main>;
}
