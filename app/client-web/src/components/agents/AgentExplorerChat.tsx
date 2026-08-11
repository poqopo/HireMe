import { Bot, CornerDownLeft, Sparkles } from "lucide-react";

export type ExplorerChatMessage = { id: string; role: "user" | "assistant"; text: string };

export function AgentExplorerChat({ input, messages, searching, onInputChange, onSubmit, onSuggestion }: { input: string; messages: ExplorerChatMessage[]; searching: boolean; onInputChange: (value: string) => void; onSubmit: () => void; onSuggestion: (value: string) => void }) {
  return <section className="agent-explorer-chat-shell">
    <div className="agent-explorer-chat-head"><span className="agent-explorer-orb"><Sparkles size={15} /></span><span><strong>HireMe</strong><small>디자인 Agent를 함께 찾아볼게요</small></span><i>online</i></div>
    <div className="agent-explorer-messages" aria-live="polite">
      {messages.map((message) => <div className={message.role === "user" ? "agent-chat-message user" : "agent-chat-message assistant"} key={message.id}>{message.role === "assistant" && <span className="agent-chat-avatar"><Bot size={14} /></span>}<p>{message.text}</p></div>)}
      {searching && <div className="agent-chat-message assistant agent-chat-thinking"><span className="agent-chat-avatar"><Bot size={14} /></span><p><span className="agent-chat-dots"><i /><i /><i /></span><span>작업 목적과 결과물을 기준으로 Agent를 찾고 있어요</span></p></div>}
    </div>
    <form className="agent-explorer-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><textarea value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="예: 신제품 상세페이지가 잘 팔리도록 개선하고 싶어요" rows={1} /><button type="submit" disabled={!input.trim() || searching} aria-label="메시지 보내기"><CornerDownLeft size={18} /></button></form>
    <div className="agent-explorer-suggestions">{["상세페이지 전환 개선", "브랜드 SNS 캠페인", "투자 발표자료 제작"].map((item) => <button type="button" key={item} disabled={searching} onClick={() => onSuggestion(item)}>{item}</button>)}</div>
  </section>;
}
