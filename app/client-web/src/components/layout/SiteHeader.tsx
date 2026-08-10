import { BriefcaseBusiness, ChevronDown, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader({ signedIn, onLogin, onProjects }: { signedIn: boolean; onLogin: () => void; onProjects: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#faf9f6]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-17 max-w-7xl items-center gap-8 px-5 lg:px-8">
        <button className="flex items-center gap-2 text-xl font-black tracking-[-.04em] text-stone-950" type="button">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-800 text-white"><BriefcaseBusiness size={17} /></span>
          HireMe
        </button>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-stone-600 md:flex">
          <button type="button" className="flex items-center gap-1">디자인 의뢰 <ChevronDown size={14} /></button>
          <button type="button" onClick={onProjects}>내 프로젝트</button>
          <button type="button">이용 방법</button>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button className="hidden size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100 sm:grid" aria-label="검색" type="button"><Search size={18} /></button>
          <Button variant={signedIn ? "outline" : "ghost"} size="sm" onClick={onLogin}>{signedIn ? "내 계정" : "로그인"}</Button>
          <Button size="sm" className="hidden sm:inline-flex">무료로 의뢰하기</Button>
          <button className="grid size-10 place-items-center md:hidden" aria-label="메뉴" type="button"><Menu size={19} /></button>
        </div>
      </div>
    </header>
  );
}
