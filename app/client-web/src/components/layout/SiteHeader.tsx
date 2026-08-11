import { BriefcaseBusiness, ChevronDown, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader({ signedIn, onLogin, onProjects, onHome, onExplorer, onRequest }: { signedIn: boolean; onLogin: () => void; onProjects: () => void; onHome: () => void; onExplorer: () => void; onRequest: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#D8D4CC]/80 bg-[#F6F3EC]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-17 max-w-7xl items-center gap-8 px-5 lg:px-8">
        <button className="flex items-center gap-2 text-xl font-semibold tracking-[-.04em] text-[#161616]" type="button" onClick={onHome}>
          <span className="grid size-8 place-items-center rounded-md bg-[#465CFF] text-white"><BriefcaseBusiness size={17} /></span>
          HireMe
        </button>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#6F6B64] md:flex">
          <button type="button" onClick={onExplorer} className="flex items-center gap-1">Agent Explorer <ChevronDown size={14} /></button>
          <button type="button" onClick={onProjects}>내 프로젝트</button>
          <button type="button">이용 방법</button>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button className="hidden size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100 sm:grid" aria-label="검색" type="button"><Search size={18} /></button>
          <Button variant={signedIn ? "outline" : "ghost"} size="sm" onClick={onLogin}>{signedIn ? "내 계정" : "로그인"}</Button>
          <Button size="sm" className="hidden sm:inline-flex" onClick={onRequest}>무료로 의뢰하기</Button>
          <button className="grid size-10 place-items-center md:hidden" aria-label="메뉴" type="button"><Menu size={19} /></button>
        </div>
      </div>
    </header>
  );
}
