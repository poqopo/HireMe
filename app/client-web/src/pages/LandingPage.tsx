import { ArrowRight, BadgeCheck, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesignAgent } from "@/types";

const workChoices = [
  { label: "Brand Identity", prompt: "브랜드 아이덴티티와 캠페인 비주얼을 만들고 싶어요", accent: "#B9AEFF" },
  { label: "Character", prompt: "캐릭터를 여러 장면에서 일관되게 만들고 싶어요", accent: "#C8FF52" },
  { label: "Food Image", prompt: "AI 음식 이미지를 실제 촬영한 것처럼 만들고 싶어요", accent: "#FF8A75" },
  { label: "Presentation", prompt: "복잡한 내용을 설득력 있는 발표자료로 만들고 싶어요", accent: "#A8D8FF" },
  { label: "Social Content", prompt: "브랜드 스타일에 맞는 소셜 콘텐츠를 만들고 싶어요", accent: "#FFE79A" },
  { label: "Other", prompt: "원하는 디자인 작업을 설명하고 맞는 디자이너 Agent를 찾고 싶어요", accent: "#ECE9E2" },
];

export function LandingPage({ agents, onExplore, onHire, onForDesigners }: { agents: DesignAgent[]; onExplore: (prompt: string) => void; onHire: (agent: DesignAgent) => void; onForDesigners: () => void }) {
  const featured = agents.slice(0, 3);
  return <main className="landing-page">
    <section className="landing-hero"><p className="landing-eyebrow"><Sparkles size={13} /> Designer-built AI agents</p><h1>AI can make 98%.<br /><em>Hire the expert for the last 2%.</em></h1><p className="landing-lede">좋은 결과를 고르는 기준까지 담은, 디자이너가 만든 Agent를 고용하세요.</p><div className="landing-choice-block"><span>What do you want to make?</span><div>{workChoices.map((choice) => <button type="button" key={choice.label} onClick={() => onExplore(choice.prompt)}><i style={{ background: choice.accent }} /><strong>{choice.label}</strong><ChevronRight size={16} /></button>)}</div></div></section>

    <section className="landing-section"><header className="landing-section-heading"><div><p>FEATURED AGENTS</p><h2>누구의 감각으로<br />작업할지 고르세요.</h2></div><button type="button" onClick={() => onExplore("디자이너 Agent를 둘러보고 싶어요")}>모든 Agent 보기 <ArrowRight size={15} /></button></header><div className="landing-agent-grid">{featured.map((agent, index) => <article className={index === 0 ? "landing-agent featured" : "landing-agent"} key={agent.id}><button type="button" onClick={() => onHire(agent)}><div className="landing-work-frame" style={{ background: agentAccent(index) }}>{agent.coverImageUrl ? <img src={agent.coverImageUrl} alt={`${agent.name} 대표 작업`} /> : <span>{agent.resultTypes[0] || "Selected work"}</span>}<b>View work</b></div><div className="landing-agent-copy"><p>Created by {agent.creatorName}<BadgeCheck size={13} /></p><h3>{agent.name}</h3><q>{agent.headline}</q><div className="landing-agent-footer"><span>Best for · {agent.skills.slice(0, 2).join(" · ")}</span><strong>{formatPrice(agent.pricing.amount)}</strong></div></div></button><Button onClick={() => onHire(agent)}>Hire this Agent <ArrowRight size={15} /></Button></article>)}</div></section>

    <section className="landing-results"><header className="landing-section-heading"><div><p>REAL RESULTS</p><h2>생성보다 중요한 건,<br />어떻게 다듬는가입니다.</h2></div></header><div className="landing-before-after"><div className="landing-result-frame before"><span>Before</span><strong>Generic visual</strong></div><div className="landing-result-arrow"><i>Agent</i><ArrowRight size={22} /></div><div className="landing-result-frame after"><span>After</span><strong>Work with a point of view</strong></div></div><p>디자이너 Agent는 레퍼런스를 고르고, 버릴 것을 결정하고, 브랜드 안에서 결과를 다듬습니다.</p></section>

    <section className="landing-section landing-designers"><header className="landing-section-heading"><div><p>BUILT BY REAL DESIGNERS</p><h2>Agent 뒤에는 언제나<br />디자이너의 기준이 있습니다.</h2></div></header><div className="landing-designer-grid">{featured.map((agent, index) => <article key={agent.id}><i style={{ background: agentAccent(index) }}>{agent.creatorName.slice(0, 1)}</i><div><p><BadgeCheck size={13} /> {agent.creatorName}</p><h3>{agent.skills.slice(0, 2).join(" · ")} Designer</h3><q>“내가 클라이언트 작업을 검토할 때 쓰는 기준을 이 Agent에 담았습니다.”</q><button type="button" onClick={() => onHire(agent)}>Created {agent.name} <ArrowRight size={14} /></button></div></article>)}</div></section>

    <section className="landing-how"><p>HOW IT WORKS</p><ol>{[["01", "Find an expert", "원하는 결과와 감각을 고릅니다."], ["02", "Share your brief", "Agent가 필요한 질문만 묻습니다."], ["03", "Get the work", "디자이너의 기준이 적용된 시안을 받습니다."], ["04", "Revise", "수정하고 최종 결과를 가져갑니다."]].map(([number, title, copy]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></section>

    <section className="landing-creator-cta"><div><p>FOR DESIGNERS</p><h2>Your way of working<br />can work for more people.</h2><span>당신의 감각, 판단 기준, 작업 프로세스를 Agent로 만드세요.</span></div><Button onClick={onForDesigners}>Build your Agent <ArrowRight size={16} /></Button></section>
  </main>;
}

function agentAccent(index: number) { return ["#B9AEFF", "#FF8A75", "#A8D8FF"][index % 3]; }
function formatPrice(amount?: number) { return amount ? `${amount.toLocaleString("ko-KR")}원부터` : "가격 협의"; }
