import { Check } from "lucide-react";
import type { RequestStep } from "@/types";

const steps: Array<{ id: RequestStep; label: string }> = [
  { id: "request", label: "요청 작성" },
  { id: "match", label: "Agent 선택" },
  { id: "brief", label: "자료 전달" },
  { id: "review", label: "의뢰 확인" },
];

export function RequestStepper({ current }: { current: RequestStep }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  if (current === "complete") return null;
  return <ol className="mx-auto mb-8 flex max-w-3xl items-center justify-center gap-2 sm:gap-5">{steps.map((step, index) => <li className="flex items-center gap-2" key={step.id}>{index > 0 && <span className="hidden h-px w-7 bg-stone-300 sm:block" />}<span className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${index <= currentIndex ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-500"}`}>{index < currentIndex ? <Check size={13} /> : index + 1}</span><span className={`hidden text-xs font-semibold sm:block ${index <= currentIndex ? "text-emerald-900" : "text-stone-400"}`}>{step.label}</span></li>)}</ol>;
}
