import { ArrowLeft, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ProjectsPage({ onBack }: { onBack: () => void }) {
  return <main className="mx-auto max-w-5xl px-5 pb-24 lg:px-8"><Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> 의뢰로 돌아가기</Button><div className="mt-8"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-800">My projects</p><h1 className="mt-2 text-4xl font-black tracking-[-.05em]">내 디자인 프로젝트</h1></div><Card className="mt-8"><CardContent className="grid min-h-60 place-items-center text-center"><div><Clock3 className="mx-auto text-emerald-800" size={24} /><h2 className="mt-3 font-black">아직 접수한 프로젝트가 없어요</h2><p className="mt-2 text-sm text-stone-500">첫 디자인 요청을 작성하면 진행 상태와 결과물이 여기에 표시됩니다.</p></div></CardContent></Card></main>;
}
