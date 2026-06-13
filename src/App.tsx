import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  Braces,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  KeyRound,
  ListFilter,
  LockKeyhole,
  LogIn,
  LogOut,
  PackageOpen,
  Search,
  ServerCog,
  Sparkles,
  Terminal,
  TrendingUp,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { agents as fallbackAgents, categories } from "@/lib/agents";
import {
  loadMarketplaceAgents,
  type AgentDataSource,
} from "@/lib/agentRepository";
import {
  createLocalSealedHarnessRecord,
  type SealedHarnessRecord,
} from "@/lib/sealWalrus";
import type { Agent } from "@/types/agent";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const stats = [
  { label: "Protected teams", value: "42" },
  { label: "Metered calls", value: "4.8M" },
  { label: "Creator payout", value: "$92K" },
];

const flow = [
  {
    icon: BriefcaseBusiness,
    title: "Hire",
    copy: "Choose an Agent Team by public capability, roster, price, and protected execution policy.",
  },
  {
    icon: Terminal,
    title: "Call",
    copy: "Codex loads the hired team as an MCP endpoint and routes each call to one specialist.",
  },
  {
    icon: LockKeyhole,
    title: "Protect",
    copy: "memWal keeps private Skills, Harness logic, and memory artifacts outside the public surface.",
  },
  {
    icon: CircleDollarSign,
    title: "Settle",
    copy: "Each MCP call writes usage, latency, team access, and agent execution amounts into the ledger.",
  },
];

const accessModes = [
  {
    icon: PackageOpen,
    label: "Free / Local",
    title: "Install open agents",
    price: "Use your existing Codex or Claude plan",
    copy: "Free agents ship as local skills or plugins. They run inside the user's existing coding agent, so HireMe does not need to meter an extra LLM call.",
    points: [
      "Fast install through MCP, plugin, or .agents/skills",
      "Best for open workflows, templates, and community agents",
      "Creator source is visible, so protection is license and reputation based",
    ],
  },
  {
    icon: ServerCog,
    label: "Paid / Protected",
    title: "Hire protected agents",
    price: "Gateway credits or per-call billing",
    copy: "Protected agents keep private AGENTS.md, skills, rubrics, and examples out of the buyer's machine. HireMe executes them through the gateway and returns only safe output.",
    points: [
      "Creator IP stays behind the protected runner boundary",
      "Buyer tasks can move toward encrypted input and TEE execution",
      "Metering, receipts, ledger writes, and payouts happen at the gateway",
    ],
  },
];

const authStorageKey = "hireme-demo-auth-user";
const hiddenMarketplaceAgentIds = new Set(["codex-builder"]);
const hiddenMarketplaceAgentHandles = new Set(["@agents/codex-builder"]);
const topicFilters = categories.filter(
  (category): category is Agent["category"] => category !== "All",
);
const defaultDisplayFilters: DisplayFilter[] = ["team", "agent"];
const defaultBillingFilters: BillingFilter[] = ["free", "paid"];

type AuthUser = {
  email: string;
  wallet: string;
};

type DisplayFilter = "team" | "agent";
type BillingFilter = "free" | "paid";

function isTeamRosterAgentVisible() {
  return true;
}

function isAgentIndividuallyVisible(agent: Agent) {
  return (
    agent.listedIndividually &&
    !hiddenMarketplaceAgentIds.has(agent.id) &&
    !hiddenMarketplaceAgentHandles.has(agent.handle) &&
    agent.name !== "Codex Builder"
  );
}

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(readStoredAuthUser);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const updateAuthUser = (user: AuthUser | null) => {
    setAuthUser(user);
    writeStoredAuthUser(user);
  };

  return (
    <BrowserRouter>
      <TopNav
        user={authUser}
        onLoginClick={() => setIsLoginOpen(true)}
        onLogout={() => updateAuthUser(null)}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/agents" element={<ExploreAgentsPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
      <LoginDialog
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={(user) => {
          updateAuthUser(user);
          setIsLoginOpen(false);
        }}
      />
    </BrowserRouter>
  );
}

function readStoredAuthUser() {
  try {
    const raw = window.localStorage.getItem(authStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredAuthUser(user: AuthUser | null) {
  try {
    if (!user) {
      window.localStorage.removeItem(authStorageKey);
      return;
    }
    window.localStorage.setItem(authStorageKey, JSON.stringify(user));
  } catch {
    // Local demo auth can still work without storage.
  }
}

function TopNav({
  user,
  onLoginClick,
  onLogout,
}: {
  user: AuthUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/92 px-4 backdrop-blur md:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        <Link className="flex items-center gap-2" to="/">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#1c1e54] text-white">
            <Bot className="size-4" />
          </span>
          <span className="text-sm font-medium text-[#0d253d]">HireMe</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden max-w-52 items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2 text-xs text-[#273951] sm:flex">
              <UserRound className="size-3.5 text-primary" />
              <span className="truncate">{user.email}</span>
            </div>
            <Button onClick={onLogout} size="sm" type="button" variant="secondary">
              <LogOut /> Logout
            </Button>
          </div>
        ) : (
          <Button onClick={onLoginClick} size="sm" type="button">
            <LogIn /> Login
          </Button>
        )}
      </div>
    </header>
  );
}

function LoginDialog({
  open,
  onClose,
  onLogin,
}: {
  open: boolean;
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
}) {
  const [email, setEmail] = useState("demo@hireme.local");
  const [wallet, setWallet] = useState("0xhirer...");

  if (!open) return null;

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin({
      email: email.trim() || "demo@hireme.local",
      wallet: wallet.trim() || "0xhirer...",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d253d]/38 px-4 py-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 app-shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
              <UserRound className="size-4 text-primary" />
              Login
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Access hired agents, active receipts, and MCP billing state.
            </p>
          </div>
          <Button onClick={onClose} size="icon" type="button" variant="ghost">
            <X />
          </Button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submitLogin}>
          <Field label="Email">
            <Input
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </Field>
          <Field label="Wallet">
            <Input onChange={(event) => setWallet(event.target.value)} value={wallet} />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">
              <LogIn /> Login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <main>
      <section className="hero-visual relative overflow-hidden px-4 py-12 md:px-8 md:py-16 xl:py-20">
        <div className="mx-auto flex min-h-[calc(100svh-15rem)] max-w-7xl items-center">
          <div className="max-w-3xl py-10">
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge>Sui Overflow 2026</Badge>
              <Badge variant="cream">Walrus Track</Badge>
              <Badge variant="outline">Free local or paid protected</Badge>
            </div>
            <h1 className="max-w-2xl text-5xl font-light leading-[1.03] text-[#0d253d] md:text-6xl">
              Use AI agents through MCP, free locally or protected when it matters.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-light leading-7 text-[#273951] md:text-lg">
              Open agents install into Codex, Claude, or Cursor and run on the
              user's existing subscription. Premium agents run through HireMe's
              protected gateway so creators can charge for private skills,
              harness logic, and memory without shipping the source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/agents">
                  <Bot /> Explore agents
                </Link>
              </Button>
              <Button size="lg" variant="secondary">
                <PackageOpen /> MCP manifest
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mesh-band border-y border-border px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              className="rounded-xl border border-white/70 bg-white/72 p-6 app-shadow"
              key={stat.label}
            >
              <div className="number-cell text-3xl font-light text-[#1c1e54]">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <Badge variant="dark">Usage model</Badge>
            <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
              Keep free agents simple. Run paid agents behind the gateway.
            </h2>
            <p className="mt-5 text-base font-light leading-7 text-muted-foreground">
              HireMe separates distribution from protected execution. Most agents
              can be installed and run with the user's existing AI subscription;
              creators choose protected execution only when their private
              workflow needs a paid boundary.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {accessModes.map((mode) => (
              <Card key={mode.title}>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                        <mode.icon className="size-5" />
                      </div>
                      <div>
                        <Badge variant={mode.label.startsWith("Free") ? "cream" : "default"}>
                          {mode.label}
                        </Badge>
                        <CardTitle className="mt-3 text-2xl font-light">
                          {mode.title}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-[#1c1e54]">
                      {mode.price}
                    </div>
                  </div>
                  <CardDescription className="pt-3 text-sm leading-6">
                    {mode.copy}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mode.points.map((point) => (
                      <div className="flex gap-3 text-sm leading-6 text-[#273951]" key={point}>
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <Badge variant="outline">Protected labor protocol</Badge>
            <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
              Capability is public. The creator&apos;s edge stays private.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {flow.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                    <item.icon className="size-5" />
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.copy}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="gateway" className="bg-[#f6f9fc] px-4 py-14 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <Badge variant="dark">Execution boundary</Badge>
            <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
              MCP calls pass through a metered protection gateway.
            </h2>
            <p className="mt-5 text-base font-light leading-7 text-muted-foreground">
              The web app only exposes Agent profiles, public capability tags,
              pricing, and hire state. The gateway handles authorization,
              Platform decrypt approval, protected artifact access, call metering,
              and ledger writes.
            </p>
          </div>

          <div className="rounded-2xl bg-[#1c1e54] p-4 text-white app-shadow">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-sm">
                <Terminal className="size-4 text-[#8da2ff]" />
                Codex MCP call
              </div>
              <Badge variant="cream">$0.018 / call</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {["Auth", "Platform", "Walrus"].map((step, index) => (
                <div
                  className="rounded-xl border border-white/10 bg-white/7 p-4"
                  key={step}
                >
                  <div className="number-cell text-xs text-white/50">
                    0{index + 1}
                  </div>
                  <div className="mt-6 text-lg font-light">{step}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#8da2ff]"
                      style={{ width: `${68 + index * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#0d253d] p-4 font-mono text-xs leading-6 text-[#c6d4ff]">
              <div>{">"} hireme.call(agent, input, budget)</div>
              <div>{">"} verify_hire: ok</div>
              <div>{">"} platform_access: approved</div>
              <div>{">"} walrus_blob: encrypted</div>
              <div>{">"} ledger.write(call_id, usd_amount)</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ExploreAgentsPage() {
  const [query, setQuery] = useState("");
  const [displayFilters, setDisplayFilters] = useState<DisplayFilter[]>(
    defaultDisplayFilters,
  );
  const [selectedTopics, setSelectedTopics] = useState<Agent["category"][]>(
    topicFilters,
  );
  const [billingFilters, setBillingFilters] = useState<BillingFilter[]>(
    defaultBillingFilters,
  );
  const [marketplaceAgents, setMarketplaceAgents] =
    useState<Agent[]>(fallbackAgents);
  const [dataSource, setDataSource] = useState<{
    source: AgentDataSource;
    message?: string;
  }>({ source: "mock", message: "Loading Supabase marketplace..." });

  useEffect(() => {
    let isCurrent = true;

    void loadMarketplaceAgents().then((result) => {
      if (!isCurrent) return;
      const nextAgents = result.agents.length ? result.agents : fallbackAgents;
      setMarketplaceAgents(nextAgents);
      setDataSource({ source: result.source, message: result.message });
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredAgents = useMemo(() => {
    return marketplaceAgents.filter((agent) => {
      if (!isTeamRosterAgentVisible()) return false;
      const matchesTopic = selectedTopics.includes(agent.category);
      const text = `${agent.team.name} ${agent.team.handle} ${agent.team.owner} ${agent.team.publicSummary} ${agent.name} ${agent.handle} ${agent.headline} ${agent.publicSummary} ${agent.skills.join(" ")}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      return matchesTopic && matchesQuery;
    });
  }, [marketplaceAgents, query, selectedTopics]);

  const teamGroups = useMemo(() => {
    if (!displayFilters.includes("team")) return [];
    return groupAgentsByTeam(filteredAgents).filter((group) =>
      billingFilters.includes(getTeamBilling(group)),
    );
  }, [billingFilters, displayFilters, filteredAgents]);

  const agentResults = useMemo(() => {
    if (!displayFilters.includes("agent")) return [];
    return filteredAgents.filter(
      (agent) =>
        isAgentIndividuallyVisible(agent) &&
        billingFilters.includes(getAgentBilling(agent)),
    );
  }, [billingFilters, displayFilters, filteredAgents]);

  const hasResults = teamGroups.length > 0 || agentResults.length > 0;

  function resetFilters() {
    setDisplayFilters(defaultDisplayFilters);
    setSelectedTopics(topicFilters);
    setBillingFilters(defaultBillingFilters);
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#533afd]/20 bg-[#fbfbff] px-3 py-1.5 text-xs font-medium text-[#1c1e54]">
              <Sparkles className="size-3.5 text-primary" />
              Agent Network for protected Codex workflows
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight md:text-5xl">
              Discover, hire, and compose your AI agent team.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-light leading-7 text-muted-foreground">
              Browse teams, individual agents, and free local starters in one
              marketplace. Paid agents keep private harnesses behind the gateway
              while public metadata helps buyers compare fit, cost, and speed.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 rounded-full bg-white pl-10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search teams, agents, builders, skills"
                  value={query}
                />
              </div>
              <Button size="lg" type="button">
                <PackageOpen /> Publish team
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge
                variant={dataSource.source === "supabase" ? "default" : "outline"}
              >
                {dataSource.source === "supabase"
                  ? "Supabase live"
                  : "Local demo data"}
              </Badge>
              {dataSource.message ? (
                <span className="text-xs leading-5 text-muted-foreground">
                  {dataSource.message}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[#1c1e54]">
                Network snapshot
              </div>
              <Badge variant="cream">Marketplace</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NetworkStat icon={Users} label="Teams" value={teamGroups.length} />
              <NetworkStat icon={Bot} label="Agents" value={agentResults.length} />
              <NetworkStat
                icon={TrendingUp}
                label="Runs"
                value={formatRuns(
                  agentResults.reduce((total, agent) => total + agent.calls, 0),
                )}
              />
            </div>
            <div className="mt-4 rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
              Team cards show the buyer-facing product. Agent cards show the
              execution unit that actually handles an MCP call.
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_1fr]">
          <AgentFilterSidebar
            billingFilters={billingFilters}
            displayFilters={displayFilters}
            onBillingFiltersChange={setBillingFilters}
            onDisplayFiltersChange={setDisplayFilters}
            onReset={resetFilters}
            onTopicsChange={setSelectedTopics}
            selectedTopics={selectedTopics}
          />

          <div className="space-y-8">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 app-shadow sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-[#1c1e54]">
                  Marketplace results
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {teamGroups.length} teams · {agentResults.length} agents
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant="outline">
                  {billingFilters.includes("free") && billingFilters.includes("paid")
                    ? "Free + Paid"
                    : billingFilters.includes("free")
                      ? "Free only"
                      : billingFilters.includes("paid")
                        ? "Paid only"
                        : "No access type"}
                </Badge>
                <Badge variant="outline">
                  {displayFilters.includes("team") && displayFilters.includes("agent")
                    ? "Teams + Agents"
                    : displayFilters.includes("team")
                      ? "Teams"
                      : displayFilters.includes("agent")
                        ? "Agents"
                        : "No result type"}
                </Badge>
              </div>
            </div>

            {displayFilters.includes("team") ? (
              <ResultSection
                count={teamGroups.length}
                title="Teams"
                subtitle="Team hire receipts unlock a roster and route calls to specialists."
              >
                {teamGroups.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {teamGroups.map((group, index) => (
                      <AgentTeamCard
                        group={group}
                        key={group.team.id}
                        rank={index + 1}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyResult label="No teams match the current filters." />
                )}
              </ResultSection>
            ) : null}

            {displayFilters.includes("agent") ? (
              <ResultSection
                count={agentResults.length}
                title="Agents"
                subtitle="Individual agents are the actual execution units behind each MCP call."
              >
                {agentResults.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {agentResults.map((agent) => (
                      <AgentMarketCard agent={agent} key={agent.id} />
                    ))}
                  </div>
                ) : (
                  <EmptyResult label="No agents match the current filters." />
                )}
              </ResultSection>
            ) : (
              null
            )}

            {!hasResults ? (
              <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground app-shadow">
                No marketplace entries match the current filters.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <CreatorConsole />
    </main>
  );
}

function AgentFilterSidebar({
  displayFilters,
  selectedTopics,
  billingFilters,
  onDisplayFiltersChange,
  onTopicsChange,
  onBillingFiltersChange,
  onReset,
}: {
  displayFilters: DisplayFilter[];
  selectedTopics: Agent["category"][];
  billingFilters: BillingFilter[];
  onDisplayFiltersChange: (filters: DisplayFilter[]) => void;
  onTopicsChange: (filters: Agent["category"][]) => void;
  onBillingFiltersChange: (filters: BillingFilter[]) => void;
  onReset: () => void;
}) {
  return (
    <aside className="h-fit rounded-xl border border-border bg-white p-4 app-shadow lg:sticky lg:top-24">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1c1e54]">
          <ListFilter className="size-4 text-primary" />
          Filters
        </div>
        <Button onClick={onReset} size="sm" type="button" variant="ghost">
          Reset
        </Button>
      </div>

      <FilterGroup title="Show">
        <FilterCheckbox
          checked={displayFilters.includes("team")}
          label="Teams"
          onChange={() =>
            onDisplayFiltersChange(toggleFilter(displayFilters, "team"))
          }
        />
        <FilterCheckbox
          checked={displayFilters.includes("agent")}
          label="Agents"
          onChange={() =>
            onDisplayFiltersChange(toggleFilter(displayFilters, "agent"))
          }
        />
      </FilterGroup>

      <FilterGroup title="Topic">
        {topicFilters.map((topic) => (
          <FilterCheckbox
            checked={selectedTopics.includes(topic)}
            key={topic}
            label={topic}
            onChange={() => onTopicsChange(toggleFilter(selectedTopics, topic))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Access">
        <FilterCheckbox
          checked={billingFilters.includes("free")}
          label="Free"
          onChange={() =>
            onBillingFiltersChange(toggleFilter(billingFilters, "free"))
          }
        />
        <FilterCheckbox
          checked={billingFilters.includes("paid")}
          label="Paid"
          onChange={() =>
            onBillingFiltersChange(toggleFilter(billingFilters, "paid"))
          }
        />
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="mb-3 text-xs font-medium uppercase text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm text-[#273951] hover:bg-secondary">
      <input
        checked={checked}
        className="size-4 accent-[#533afd]"
        onChange={onChange}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function ResultSection({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-light text-[#1c1e54]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <Badge variant="outline">{count} results</Badge>
      </div>
      {children}
    </section>
  );
}

function EmptyResult({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground app-shadow">
      {label}
    </div>
  );
}

function NetworkStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </div>
      <div className="number-cell text-lg font-light text-[#1c1e54]">
        {value}
      </div>
    </div>
  );
}

type AgentTeamGroup = {
  team: Agent["team"];
  agents: Agent[];
  avgLatencyMs: number;
  avgTokens: number;
  calls: number;
  rating: number;
};

function AgentTeamCard({
  group,
  rank,
}: {
  group: AgentTeamGroup;
  rank: number;
}) {
  const { team, agents } = group;

  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-[rgba(0,55,112,0.08)_0_8px_24px]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="number-cell hidden min-w-8 text-center text-lg font-light text-muted-foreground sm:block">
              {rank}
            </div>
            <Avatar className="size-14">
              <AvatarFallback
                className={`bg-gradient-to-br ${team.accent} text-white`}
              >
                {team.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl font-light">{team.name}</CardTitle>
              <CardDescription>
                {team.handle} · by {team.owner}
              </CardDescription>
            </div>
          </div>
          <Badge variant="dark">{formatTeamPrice(team)}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm leading-relaxed text-[#273951]">
          {team.publicSummary}
        </p>

        <div className="mt-5 grid grid-cols-4 gap-3 border-y border-border py-5 text-sm">
          <Metric icon={Bot} label="Agents" value={`${agents.length}`} />
          <Metric icon={TrendingUp} label="Runs" value={formatRuns(group.calls)} />
          <Metric icon={CheckCircle2} label="Rating" value={group.rating.toFixed(1)} />
          <Metric icon={Clock3} label="Avg time" value={formatDuration(group.avgLatencyMs)} />
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-medium text-[#1c1e54]">
            Team agents
          </div>
          <div className="divide-y divide-border rounded-lg border border-border bg-white">
            {agents.map((agent) => (
              <AgentRosterRow agent={agent} key={agent.id} />
            ))}
          </div>
        </div>

        <Button className="mt-6 w-full" type="button">
          <PackageOpen /> Hire team MCP
        </Button>
      </CardContent>
    </Card>
  );
}

function AgentMarketCard({ agent }: { agent: Agent }) {
  const billing = getAgentBilling(agent);

  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-[rgba(0,55,112,0.08)_0_8px_24px]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback
                className={`bg-gradient-to-br ${agent.accent} text-white`}
              >
                {agent.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <CardDescription>{agent.handle}</CardDescription>
            </div>
          </div>
          <Badge variant={billing === "free" ? "cream" : "default"}>
            {billing === "free" ? "Free" : "Paid"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{agent.category}</Badge>
          <Badge variant="outline">{agent.team.name}</Badge>
          <Badge variant="outline">{formatRuns(agent.calls)} runs</Badge>
        </div>

        <p className="min-h-16 text-sm leading-relaxed text-[#273951]">
          {agent.headline}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">Builder: {agent.creator}</span>
          <span className="number-cell shrink-0">{agent.rating.toFixed(1)} rating</span>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-secondary p-3">
          <div className="text-xs font-medium text-[#1c1e54]">
            {agent.resultPreview.title}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {agent.resultPreview.summary}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5 text-sm">
          <Metric
            icon={CircleDollarSign}
            label="Call"
            value={
              billing === "free"
                ? "Free"
                : `$${agent.pricePerCallUsd.toFixed(3)}`
            }
          />
          <Metric
            icon={Clock3}
            label="Time"
            value={formatDuration(agent.latencyMs)}
          />
          <Metric
            icon={Braces}
            label="Tokens"
            value={formatTokens(totalAverageTokens(agent))}
          />
        </div>

        <Button className="mt-6 w-full" type="button">
          <PackageOpen /> Hire agent MCP
        </Button>
      </CardContent>
    </Card>
  );
}

function AgentRosterRow({ agent }: { agent: Agent }) {
  return (
    <div className="p-3">
      <div className="text-sm font-medium text-[#0d253d]">{agent.name}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {agent.headline}
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="number-cell font-medium text-[#0d253d]">{value}</div>
    </div>
  );
}

function groupAgentsByTeam(agents: Agent[]): AgentTeamGroup[] {
  const groups = new Map<string, Agent[]>();
  for (const agent of agents) {
    const current = groups.get(agent.team.id) ?? [];
    current.push(agent);
    groups.set(agent.team.id, current);
  }

  return Array.from(groups.values())
    .map((groupAgents) => {
      const [firstAgent] = groupAgents;
      return {
        team: firstAgent.team,
        agents: groupAgents,
        avgLatencyMs: Math.round(
          groupAgents.reduce((total, agent) => total + agent.latencyMs, 0) /
            groupAgents.length,
        ),
        avgTokens: Math.round(
          groupAgents.reduce(
            (total, agent) => total + totalAverageTokens(agent),
            0,
          ) / groupAgents.length,
        ),
        calls: groupAgents.reduce((total, agent) => total + agent.calls, 0),
        rating:
          groupAgents.reduce((total, agent) => total + agent.rating, 0) /
          groupAgents.length,
      };
    })
    .sort((a, b) => b.rating - a.rating || b.calls - a.calls);
}

function toggleFilter<T>(filters: T[], value: T) {
  return filters.includes(value)
    ? filters.filter((item) => item !== value)
    : [...filters, value];
}

function getTeamBilling(group: AgentTeamGroup): BillingFilter {
  const team = group.team;
  const hasTeamCharge =
    team.billing.basePriceUsd > 0 || team.billing.overagePricePerCallUsd > 0;
  const hasAgentCharge = group.agents.some((agent) => agent.pricePerCallUsd > 0);
  return hasTeamCharge || hasAgentCharge ? "paid" : "free";
}

function getAgentBilling(agent: Agent): BillingFilter {
  return agent.pricePerCallUsd > 0 ? "paid" : "free";
}

function totalAverageTokens(agent: Agent) {
  return agent.avgInputTokens + agent.avgOutputTokens;
}

function formatTokens(tokens: number) {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}K`;
  }
  return tokens.toLocaleString();
}

function formatRuns(runs: number) {
  if (runs >= 1_000_000) return `${(runs / 1_000_000).toFixed(1)}M`;
  if (runs >= 1000) return `${(runs / 1000).toFixed(runs >= 10_000 ? 0 : 1)}K`;
  return runs.toLocaleString();
}

function formatDuration(ms: number) {
  if (!ms) return "N/A";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTeamPrice(team: Agent["team"]) {
  if (
    team.billing.basePriceUsd === 0 &&
    team.billing.overagePricePerCallUsd === 0
  ) {
    return "Free";
  }
  if (team.billing.unit === "monthly_access") {
    return `$${team.billing.basePriceUsd.toFixed(2)} / mo`;
  }
  if (team.billing.unit === "team_bundle") {
    return `$${team.billing.basePriceUsd.toFixed(3)} team pass`;
  }
  return `from $${team.billing.overagePricePerCallUsd.toFixed(3)} / call`;
}


function CreatorConsole() {
  const [draft, setDraft] = useState({
    teamName: "Launch Conversion Team",
    teamHandle: "@teams/launch-conversion",
    agentName: "Private Code Reviewer",
    agentRole: "Implementation specialist",
    creatorAddress: "0xcreator...",
    publicCapability: "review_pull_request(diff, repo_context, risk_level)",
    policyRule: "Caller must hold an active TeamHireReceipt or direct Agent HireReceipt.",
    teamBundlePriceUsd: "0.058",
    includedCalls: "25",
    overagePricePerCallUsd: "0.018",
    pricePerCallUsd: "0.028",
    epochs: "3",
  });
  const [harnessFiles, setHarnessFiles] = useState<File[]>([]);
  const [sealedRecord, setSealedRecord] = useState<SealedHarnessRecord>();
  const [isSealing, setIsSealing] = useState(false);

  async function sealHarness() {
    setIsSealing(true);
    try {
      const record = await createLocalSealedHarnessRecord({
        agentName: draft.agentName,
        creatorAddress: draft.creatorAddress,
        publicCapability: draft.publicCapability,
        policyRule: draft.policyRule,
        pricePerCallUsd: Number.parseFloat(draft.pricePerCallUsd),
        epochs: Number.parseInt(draft.epochs, 10),
        files: harnessFiles,
      });
      setSealedRecord(record);
    } finally {
      setIsSealing(false);
    }
  }

  const updateDraft =
    (field: keyof typeof draft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };

  return (
    <section id="creator-console" className="border-t border-border bg-white px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.86fr_1.14fr]">
        <div>
          <Badge variant="dark">Team publish flow</Badge>
          <h2 className="mt-4 text-3xl font-light leading-tight">
            Publish a team, then attach protected Agent folders.
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Team metadata and bundle pricing are public. Each specialist Agent
            still uploads its own encrypted AGENTS.md, skills, prompts, eval
            sets, and Harness bundle. The ledger separates team access revenue
            from the executing Agent&apos;s metered charge.
          </p>

          <div className="mt-6 space-y-3">
            <BoundaryStep
              icon={BriefcaseBusiness}
              title="Create team product"
              copy="A team has one marketplace profile, one hire receipt, and pooled usage limits."
            />
            <BoundaryStep
              icon={KeyRound}
              title="Attach protected agents"
              copy="Every Agent folder is encrypted before Walrus storage and linked to the team."
            />
            <BoundaryStep
              icon={ServerCog}
              title="Route and meter"
              copy="The gateway checks team access, runs one specialist, and writes split ledger amounts."
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary p-5 app-shadow">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Team name">
              <Input value={draft.teamName} onChange={updateDraft("teamName")} />
            </Field>
            <Field label="Team handle">
              <Input value={draft.teamHandle} onChange={updateDraft("teamHandle")} />
            </Field>
            <Field label="Agent name">
              <Input value={draft.agentName} onChange={updateDraft("agentName")} />
            </Field>
            <Field label="Agent role">
              <Input value={draft.agentRole} onChange={updateDraft("agentRole")} />
            </Field>
            <Field label="Creator wallet">
              <Input
                value={draft.creatorAddress}
                onChange={updateDraft("creatorAddress")}
              />
            </Field>
            <Field label="Team bundle price">
              <Input
                min="0"
                step="0.001"
                type="number"
                value={draft.teamBundlePriceUsd}
                onChange={updateDraft("teamBundlePriceUsd")}
              />
            </Field>
            <Field label="Included team calls">
              <Input
                min="0"
                type="number"
                value={draft.includedCalls}
                onChange={updateDraft("includedCalls")}
              />
            </Field>
            <Field label="Overage per call">
              <Input
                min="0"
                step="0.001"
                type="number"
                value={draft.overagePricePerCallUsd}
                onChange={updateDraft("overagePricePerCallUsd")}
              />
            </Field>
            <Field className="md:col-span-2" label="Public MCP contract">
              <Input
                value={draft.publicCapability}
                onChange={updateDraft("publicCapability")}
              />
            </Field>
            <Field className="md:col-span-2" label="Platform access policy">
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onChange={updateDraft("policyRule")}
                value={draft.policyRule}
              />
            </Field>
            <Field label="Agent execution price">
              <Input
                min="0"
                step="0.001"
                type="number"
                value={draft.pricePerCallUsd}
                onChange={updateDraft("pricePerCallUsd")}
              />
            </Field>
            <Field label="Walrus epochs">
              <Input
                min="1"
                type="number"
                value={draft.epochs}
                onChange={updateDraft("epochs")}
              />
            </Field>
            <Field className="md:col-span-2" label="Agent folder">
              <input
                className="block w-full rounded-md border border-dashed border-input bg-white px-3 py-3 text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                multiple
                onChange={(event) =>
                  setHarnessFiles(Array.from(event.target.files ?? []))
                }
                type="file"
                {...({ directory: "", webkitdirectory: "" } as Record<string, string>)}
              />
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                Expected folder shape: AGENTS.md, skills/**, optional tool
                adapters. Each Agent folder is encrypted before Walrus storage
                and registered under the team.
              </span>
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button disabled={isSealing} onClick={sealHarness} type="button">
              <UploadCloud /> {isSealing ? "Encrypting..." : "Create protected record"}
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-4 text-[#ea2261]" />
              Local preview only; production encrypts this folder before upload.
            </div>
          </div>

          {sealedRecord ? <SealedRecordPreview record={sealedRecord} /> : null}
        </div>
      </div>
    </section>
  );
}

function BoundaryStep({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof KeyRound;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-white p-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SealedRecordPreview({ record }: { record: SealedHarnessRecord }) {
  const artifactName = `${record.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")}.seal.json`;
  const walrusCommand = `walrus store ${artifactName} --epochs ${record.epochs} --context testnet`;

  return (
    <div className="mt-5 rounded-xl border border-[#533afd]/20 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="size-4 text-primary" />
          Protected public record
        </div>
        <Badge variant="outline">{record.network}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <RecordCell label="Provider" value={record.sealProvider} />
        <RecordCell label="KMS key" value={record.platformKmsKeyId} />
        <RecordCell label="Policy" value={record.sealPolicyId} />
        <RecordCell label="Identity" value={record.encryptionId} />
        <RecordCell label="Walrus blob" value={record.walrusBlobId} />
        <RecordCell label="Sui object" value={record.suiObjectId} />
        <RecordCell label="Ciphertext" value={record.sealCiphertextFormat} />
        <RecordCell label="Digest" value={record.ciphertextDigest} />
      </div>

      <div className="mt-4 rounded-lg bg-secondary p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Local Walrus command
        </div>
        <code className="block break-all font-mono text-xs leading-5 text-[#1c1e54]">
          {walrusCommand}
        </code>
      </div>

      <div className="mt-3 rounded-lg bg-[#fff8fb] p-3">
        <div className="mb-1 text-xs font-medium text-[#9f1239]">
          Not returned to hirers
        </div>
        <p className="text-xs leading-5 text-[#573144]">
          {record.fileName}, plaintext AGENTS.md, creator skills, private plugin
          code, and backup decryption material stay outside hirer Codex.
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-white p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Folder entries protected in preview
        </div>
        <div className="flex flex-wrap gap-2">
          {record.entryPreview.map((entry) => (
            <Badge key={entry} variant="outline">
              {entry}
            </Badge>
          ))}
          {record.fileCount > record.entryPreview.length ? (
            <Badge variant="outline">
              +{record.fileCount - record.entryPreview.length} more
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RecordCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-[#1c1e54]">{value}</div>
    </div>
  );
}

export default App;
