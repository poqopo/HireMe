import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronRight, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DesignAgent } from "@/types";

const workOptions = [
  { id: "food", label: "음식 이미지", description: "AI 이미지를 더 자연스럽고 맛있게", accent: "#FF8A75", mark: "01" },
  { id: "character", label: "캐릭터 디자인", description: "여러 장면에서도 일관된 캐릭터 제작", accent: "#C8FF52", mark: "02" },
  { id: "branding", label: "브랜드 디자인", description: "브랜드 안에서 일관된 비주얼 제작", accent: "#B9AEFF", mark: "03" },
  { id: "presentation", label: "프레젠테이션", description: "복잡한 내용을 설득력 있게 정리", accent: "#A8D8FF", mark: "04" },
  { id: "social", label: "소셜 콘텐츠", description: "채널에 맞는 캠페인 비주얼", accent: "#FFE79A", mark: "05" },
  { id: "product", label: "제품 / 광고 이미지", description: "제품의 구매 이유를 시각화", accent: "#ECE9E2", mark: "06" },
] as const;
type WorkOption = (typeof workOptions)[number];
type Selection = { work: WorkOption | null; problem: string; style: string };

const problems: Record<WorkOption["id"], string[]> = {
  food: ["너무 AI처럼 보여요", "음식이 맛있어 보이지 않아요", "레퍼런스와 분위기가 달라요", "광고용으로 쓰기엔 부족해요", "구도와 조명이 어색해요", "전체적인 퀄리티를 높이고 싶어요"],
  character: ["장면마다 캐릭터가 달라져요", "원본의 인상이 사라져요", "포즈와 표정이 어색해요", "여러 컷의 스타일이 맞지 않아요", "의상과 소품이 일관되지 않아요", "더 살아 있는 감정이 필요해요"],
  branding: ["브랜드다운 느낌이 안 나요", "비주얼 톤이 제각각이에요", "캠페인 방향이 모호해요", "기존 가이드를 지키기 어려워요", "더 선명한 인상이 필요해요", "레퍼런스 해석이 어려워요"],
  presentation: ["슬라이드가 아마추어처럼 보여요", "메시지 흐름이 약해요", "정보가 너무 복잡해요", "투자자에게 설득력이 부족해요", "데이터가 잘 읽히지 않아요", "핵심이 눈에 안 들어와요"],
  social: ["브랜드 스타일이 느껴지지 않아요", "캠페인 비주얼이 약해요", "채널에 맞는 구성이 아니에요", "첫 화면의 힘이 부족해요", "콘텐츠가 반복적으로 보여요", "더 공유하고 싶은 느낌이 필요해요"],
  product: ["제품의 장점이 안 보여요", "광고처럼 설득력이 없어요", "첫 이미지가 약해요", "구매 이유가 모호해요", "제품이 돋보이지 않아요", "채널별 변형이 필요해요"],
};

const styles = [
  { label: "자연광 / 리얼한 포토", note: "Natural light", accent: "#FFE79A" },
  { label: "고급 레스토랑", note: "Fine dining", accent: "#FF8A75" },
  { label: "따뜻한 홈메이드", note: "Home made", accent: "#C8FF52" },
  { label: "미니멀 광고", note: "Minimal ad", accent: "#A8D8FF" },
  { label: "SNS 캠페인", note: "Social campaign", accent: "#B9AEFF" },
  { label: "에디토리얼", note: "Editorial", accent: "#ECE9E2" },
] as const;

const stepLabels = ["작업 선택", "문제 정의", "스타일", "전문가"];

export function LandingPage({ agents, onExplore, onHire, onForDesigners }: { agents: DesignAgent[]; onExplore: (prompt: string) => void; onHire: (agent: DesignAgent) => void; onForDesigners: () => void }) {
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Selection>({ work: null, problem: "", style: "" });
  const [leaving, setLeaving] = useState(false);
  const nextStepRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);
  const moveTo = (next: number) => {
    if (next === step || leaving) return;
    nextStepRef.current = next; setLeaving(true);
    timerRef.current = window.setTimeout(() => { setStep(nextStepRef.current ?? next); setLeaving(false); }, 320);
  };
  const selectWork = (work: WorkOption) => { setSelection({ work, problem: "", style: "" }); moveTo(1); };
  const selectProblem = (problem: string) => { setSelection((current) => ({ ...current, problem })); moveTo(2); };
  const selectStyle = (style: string) => { setSelection((current) => ({ ...current, style })); moveTo(3); };
  const currentProblems = selection.work ? problems[selection.work.id] : [];
  const recommended = agents.slice(0, 3);
  return <main className="landing-page">
    <section className="hero-discovery">
      <div className="hero-brand"><p className="landing-eyebrow"><Sparkles size={13} /> HireMe · Designer marketplace</p><h1>AI가 98%를 만들 수 있어도,<br /><em>마지막 2%는 감각에서 완성됩니다.</em></h1><p>실제 디자이너의 작업 방식으로 만들어진 AI Agent를 고용하세요.</p><small>The interface unfolds around your intent.</small></div>
      <div className="discovery-shell">
        <div className="discovery-progress"><div><span>{step + 1} / 4</span>{step > 0 && <button type="button" onClick={() => moveTo(step - 1)} aria-label="이전 단계"><ArrowLeft size={15} /></button>}</div><ol>{stepLabels.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label}><button type="button" disabled={index > step} onClick={() => moveTo(index)}>{index < step ? <Check size={12} /> : index + 1}<span>{label}</span></button></li>)}</ol></div>
        {(selection.work || selection.problem || selection.style) && <div className="discovery-chips">{selection.work && <button type="button" onClick={() => moveTo(0)}><i style={{ background: selection.work.accent }} />{selection.work.label} <span>×</span></button>}{selection.problem && <button type="button" onClick={() => moveTo(1)}>{selection.problem} <span>×</span></button>}{selection.style && <button type="button" onClick={() => moveTo(2)}>{selection.style} <span>×</span></button>}</div>}
        <div className={leaving ? "discovery-slide leaving" : "discovery-slide"} key={step}>
          {step === 0 && <Question title="어떤 작업이 필요한가요?" helper="먼저 만들고 싶은 결과를 골라 주세요."><div className="discovery-work-grid">{workOptions.map((option) => <button type="button" className="discovery-work-tile" key={option.id} onClick={() => selectWork(option)}><i style={{ background: option.accent }}>{option.mark}</i><strong>{option.label}</strong><span>{option.description}</span><ChevronRight size={15} /></button>)}</div></Question>}
          {step === 1 && selection.work && <Question title="지금 가장 아쉬운 부분은 무엇인가요?" helper={`${selection.work.label} 작업에서 먼저 해결할 문제를 골라 주세요.`}><div className="discovery-problem-grid">{currentProblems.map((problem) => <button type="button" key={problem} onClick={() => selectProblem(problem)}>{problem}<ChevronRight size={14} /></button>)}</div></Question>}
          {step === 2 && <Question title="어떤 느낌에 더 가까웠으면 하나요?" helper="정확한 단어가 아니어도 괜찮아요. 원하는 방향을 고르세요."><div className="discovery-style-grid">{styles.map((style) => <button type="button" key={style.label} onClick={() => selectStyle(style.label)}><i style={{ background: style.accent }}><span>{style.note}</span></i><strong>{style.label}</strong></button>)}</div></Question>}
          {step === 3 && <Question title="이 작업에는 이런 전문가가 잘 맞아요." helper="작품과 디자이너의 작업 방식을 보고 선택하세요."><div className="discovery-agent-list">{recommended.map((agent, index) => <article key={agent.id}><div className="discovery-agent-work" style={{ background: agentAccent(index) }}>{agent.coverImageUrl ? <img src={agent.coverImageUrl} alt={`${agent.name} 대표 작업`} /> : <span>{agent.resultTypes[0] || "Selected work"}</span>}</div><div><p>Created by <strong>{agent.creatorName}</strong><BadgeCheck size={13} /></p><h2>{agent.name}</h2><small>{agent.skills.slice(0, 2).join(" · ")}</small><q>{agent.headline}</q><ul><li>디자이너의 작업 기준 적용</li><li>{selection.problem || "요청한 문제"}에 맞는 접근</li><li>{selection.style || "레퍼런스"} 방향으로 결과 정리</li></ul><Button onClick={() => onHire(agent)}>이 Agent 고용하기 <ArrowRight size={15} /></Button></div></article>)}</div><button className="discovery-all-agents" type="button" onClick={() => onExplore(`${selection.work?.label || ""} ${selection.problem} ${selection.style}`)}>다른 Designer Agent도 비교하기 <ArrowRight size={15} /></button></Question>}
        </div>
      </div>
    </section>
    <section className="landing-results hero-results"><header className="landing-section-heading"><div><p>REAL RESULTS</p><h2>생성보다 중요한 건,<br />어떻게 다듬는가입니다.</h2></div></header><div className="landing-before-after"><div className="landing-result-frame before"><span>Before</span><strong>Generic visual</strong></div><div className="landing-result-arrow"><i>Agent</i><ArrowRight size={22} /></div><div className="landing-result-frame after"><span>After</span><strong>Work with a point of view</strong></div></div><p>디자이너 Agent는 레퍼런스를 고르고, 버릴 것을 결정하고, 브랜드 안에서 결과를 다듬습니다.</p></section>
    <section className="landing-section landing-designers"><header className="landing-section-heading"><div><p>BUILT BY REAL DESIGNERS</p><h2>Agent 뒤에는 언제나<br />디자이너의 기준이 있습니다.</h2></div></header><div className="landing-designer-grid">{recommended.map((agent, index) => <article key={agent.id}><i style={{ background: agentAccent(index) }}>{agent.creatorName.slice(0, 1)}</i><div><p><BadgeCheck size={13} /> {agent.creatorName}</p><h3>{agent.skills.slice(0, 2).join(" · ")} Designer</h3><q>“내가 클라이언트 작업을 검토할 때 쓰는 기준을 이 Agent에 담았습니다.”</q><button type="button" onClick={() => onHire(agent)}>Created {agent.name} <ArrowRight size={14} /></button></div></article>)}</div></section>
    <section className="landing-how"><p>HOW IT WORKS</p><ol>{[["01", "Find an expert", "원하는 결과와 감각을 고릅니다."], ["02", "Share your brief", "Agent가 필요한 질문만 묻습니다."], ["03", "Get the work", "디자이너의 기준이 적용된 시안을 받습니다."], ["04", "Revise", "수정하고 최종 결과를 가져갑니다."]].map(([number, title, copy]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></section>
    <section className="landing-creator-cta"><div><p>FOR DESIGNERS</p><h2>Your way of working<br />can work for more people.</h2><span>당신의 감각, 판단 기준, 작업 프로세스를 Agent로 만드세요.</span></div><Button onClick={onForDesigners}>Build your Agent <ArrowRight size={16} /></Button></section>
  </main>;
}

function Question({ title, helper, children }: { title: string; helper: string; children: ReactNode }) { return <><header className="discovery-question-head"><p>DISCOVERY</p><h2>{title}</h2><span>{helper}</span></header>{children}</>; }
function agentAccent(index: number) { return ["#FF8A75", "#B9AEFF", "#A8D8FF"][index % 3]; }
