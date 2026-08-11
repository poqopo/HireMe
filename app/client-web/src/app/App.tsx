import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { RequestStepper } from "@/components/request/RequestStepper";
import { demoAgents } from "@/data/demoAgents";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { AgentMatchPage } from "@/pages/AgentMatchPage";
import { AgentExplorerPage } from "@/pages/AgentExplorerPage";
import { LandingPage } from "@/pages/LandingPage";
import { BriefPage } from "@/pages/BriefPage";
import { CompletePage } from "@/pages/CompletePage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { RequestPage } from "@/pages/RequestPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { listDesignAgents, rankAgents } from "@/services/agents";
import { submitProject } from "@/services/projects";
import type { DesignAgent, DesignRequest, RequestStep, SubmittedProject } from "@/types";

const initialRequest: DesignRequest = { title: "", description: "", category: "", channel: "", deadline: "", budget: "", audience: "", guide: "", mustInclude: "", mustAvoid: "", files: [] };

export function App() {
  const [screen, setScreen] = useState<"landing" | "explorer" | "request">("landing");
  const [explorerPrompt, setExplorerPrompt] = useState("");
  const [step, setStep] = useState<RequestStep>("request");
  const [showProjects, setShowProjects] = useState(false);
  const [request, setRequest] = useState<DesignRequest>(initialRequest);
  const [agents, setAgents] = useState<DesignAgent[]>(demoAgents);
  const [selectedAgent, setSelectedAgent] = useState<DesignAgent>();
  const [session, setSession] = useState<Session | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedProject>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    void listDesignAgents().then((items) => setAgents(items.length ? items : demoAgents)).catch(() => setAgents(demoAgents));
  }, [session]);

  const rankedAgents = useMemo(() => rankAgents(agents, `${request.category} ${request.title} ${request.description} ${request.channel}`), [agents, request]);
  const updateRequest = (patch: Partial<DesignRequest>) => setRequest((current) => ({ ...current, ...patch }));
  const nextFromRequest = () => { setSelectedAgent((current) => current || rankedAgents[0]); setStep("match"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const navigate = (next: RequestStep) => { setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const login = async () => {
    if (!supabase) { window.alert("현재는 UI 미리보기 모드입니다. app/client-web/.env에 Supabase 공개 설정을 추가하면 로그인할 수 있어요."); return; }
    if (session) { await supabase.auth.signOut(); return; }
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };
  const createProject = async () => {
    if (!selectedAgent) return;
    setSubmitting(true); setError("");
    try { const project = await submitProject(selectedAgent, request); setSubmitted(project); navigate("complete"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "프로젝트를 접수하지 못했어요."); }
    finally { setSubmitting(false); }
  };
  const restart = () => { setRequest(initialRequest); setSelectedAgent(undefined); setSubmitted(undefined); setError(""); setScreen("landing"); navigate("request"); };
  const openRequestForAgent = (agent: DesignAgent) => { setSelectedAgent(agent); setScreen("request"); setStep("request"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openExplorer = (prompt = "") => { setExplorerPrompt(prompt); setShowProjects(false); setScreen("explorer"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="min-h-screen bg-[#F6F3EC] text-[#161616]">
    <SiteHeader signedIn={Boolean(session)} onLogin={() => void login()} onProjects={() => setShowProjects(true)} onHome={() => { setShowProjects(false); setScreen("landing"); }} onExplorer={() => openExplorer()} onRequest={() => { setShowProjects(false); setScreen("request"); }} />
    {!supabaseConfigured && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">UI 미리보기 모드 · Supabase 설정 후 실제 Agent와 프로젝트에 연결됩니다.</div>}
    <div className="pt-10 sm:pt-13">
      {showProjects ? <ProjectsPage onBack={() => setShowProjects(false)} /> : <>
        {screen === "request" && <RequestStepper current={step} />}
        {screen === "landing" ? <LandingPage agents={agents} onExplore={openExplorer} onHire={openRequestForAgent} onForDesigners={() => window.alert("Designer Studio는 데스크톱 앱에서 제공됩니다.")} /> : screen === "explorer" ? <AgentExplorerPage key={explorerPrompt || "explore"} agents={agents} initialPrompt={explorerPrompt} onStart={openRequestForAgent} /> : <>
        {step === "request" && <RequestPage request={request} onChange={updateRequest} onNext={nextFromRequest} />}
        {step === "match" && <AgentMatchPage request={request} agents={rankedAgents} selected={selectedAgent} onSelect={setSelectedAgent} onBack={() => navigate("request")} onNext={() => navigate("brief")} />}
        {step === "brief" && selectedAgent && <BriefPage agent={selectedAgent} request={request} onChange={updateRequest} onBack={() => navigate("match")} onNext={() => navigate("review")} />}
        {step === "review" && selectedAgent && <ReviewPage agent={selectedAgent} request={request} submitting={submitting} error={error} onBack={() => navigate("brief")} onSubmit={() => void createProject()} />}
        {step === "complete" && selectedAgent && submitted && <CompletePage agent={selectedAgent} project={submitted} onRestart={restart} />}
        </>}
      </>}
    </div>
    <footer className="border-t border-stone-200 px-5 py-8 text-center text-xs text-stone-500">© 2026 HireMe · Design Agent Marketplace</footer>
  </div>;
}
