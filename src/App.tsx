import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Copy,
  DatabaseZap,
  EyeOff,
  FileLock2,
  Gauge,
  KeyRound,
  LockKeyhole,
  PackageOpen,
  Search,
  ServerCog,
  ShieldCheck,
  Star,
  Terminal,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import { agents, categories } from "@/lib/agents";
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
  { label: "Protected agents", value: "128" },
  { label: "Metered calls", value: "4.8M" },
  { label: "Creator payout", value: "$92K" },
];

const flow = [
  {
    icon: BriefcaseBusiness,
    title: "Hire",
    copy: "Choose an Agent by public skill summary, price, and protected execution policy.",
  },
  {
    icon: Terminal,
    title: "Call",
    copy: "Codex loads the hired Agent as an MCP endpoint with budget and access limits.",
  },
  {
    icon: LockKeyhole,
    title: "Protect",
    copy: "memWal keeps private Skills, Harness logic, and memory artifacts outside the public surface.",
  },
  {
    icon: CircleDollarSign,
    title: "Settle",
    copy: "Each MCP call writes usage, latency, and billable amount into a creator ledger.",
  },
];

const codexMcpCommand =
  "codex plugin marketplace add /Users/hanlab/Desktop/HireMe && codex plugin add hireme --marketplace hireme-local";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/agents" element={<ExploreAgentsPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
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
              <Badge variant="outline">MCP call billing</Badge>
            </div>
            <h1 className="max-w-2xl text-5xl font-light leading-[1.03] text-[#0d253d] md:text-6xl">
              Hire AI agents without exposing how they work.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-light leading-7 text-[#273951] md:text-lg">
              HireMe lets creators publish useful Agent capability while Seal,
              Walrus, and memWal protect private Skills, Harness logic, and
              memory. Buyers call the Agent from Codex through MCP and pay by
              metered usage.
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

      <section className="bg-[#f6f9fc] px-4 py-14 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <Badge variant="dark">Execution boundary</Badge>
            <h2 className="mt-4 text-3xl font-light leading-tight md:text-5xl">
              MCP calls pass through a metered protection gateway.
            </h2>
            <p className="mt-5 text-base font-light leading-7 text-muted-foreground">
              The web app only exposes Agent profiles, public capability tags,
              pricing, and hire state. The gateway handles authorization,
              Seal key-share approval, protected artifact access, call metering,
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
              {["Auth", "Seal", "Walrus"].map((step, index) => (
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
              <div>{">"} seal_policy: approved</div>
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
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0].id);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesCategory = category === "All" || agent.category === category;
      const text = `${agent.name} ${agent.handle} ${agent.headline} ${agent.skills.join(" ")}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  return (
    <main className="min-h-screen bg-[#f6f9fc]">
      <section className="border-b border-border bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-light leading-tight md:text-5xl">
                Browse protected Agents and hire by MCP call.
              </h1>
              <p className="mt-4 text-base font-light leading-7 text-muted-foreground">
                Character-style discovery for production agents: profile first,
                public capability second, protected implementation never.
              </p>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-full bg-white pl-10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by skill, category, creator"
                value={query}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => (
              <Button
                key={item}
                onClick={() => setCategory(item)}
                size="sm"
                variant={category === item ? "dark" : "secondary"}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredAgents.map((agent) => (
              <AgentCard
                agent={agent}
                key={agent.id}
                onSelect={() => setSelectedAgentId(agent.id)}
                selected={selectedAgentId === agent.id}
              />
            ))}
          </div>

          <AgentDetail agent={selectedAgent} />
        </div>
      </section>

      <CreatorConsole />
    </main>
  );
}

function AgentCard({
  agent,
  selected,
  onSelect,
}: {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[rgba(0,55,112,0.08)_0_8px_24px] ${
        selected ? "border-[#533afd] ring-2 ring-[#533afd]/10" : ""
      }`}
      onClick={onSelect}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
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
          <Badge variant={agent.status === "Available" ? "default" : "outline"}>
            {agent.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <p className="min-h-12 text-sm leading-relaxed text-[#273951]">
          {agent.headline}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {agent.skills.map((skill) => (
            <Badge key={skill} variant="outline">
              {skill}
            </Badge>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-sm">
          <Metric icon={CircleDollarSign} label="Call" value={`$${agent.pricePerCallUsd.toFixed(3)}`} />
          <Metric icon={Star} label="Rating" value={agent.rating.toFixed(1)} />
          <Metric icon={Gauge} label="Latency" value={`${agent.latencyMs}ms`} />
        </div>

        <Button className="mt-6 w-full" onClick={onSelect} type="button">
          <PackageOpen /> Hire MCP
        </Button>
      </CardContent>
    </Card>
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

function AgentDetail({ agent }: { agent: Agent }) {
  return (
    <aside className="top-24 h-fit rounded-xl border border-border bg-white p-5 app-shadow xl:sticky">
      <div className="flex items-start gap-3">
        <Avatar className="size-16">
          <AvatarFallback className={`bg-gradient-to-br ${agent.accent} text-lg text-white`}>
            {agent.name
              .split(" ")
              .map((word) => word[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-light leading-tight">{agent.name}</h2>
          <p className="text-sm text-muted-foreground">{agent.creator}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-[#273951]">
        {agent.publicSummary}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DetailStat label="Calls" value={agent.calls.toLocaleString()} />
        <DetailStat label="Free quota" value={`${agent.freeCalls}`} />
      </div>

      <div className="mt-5 space-y-3">
        <InfoLine icon={ShieldCheck} label="memWal policy" value={agent.memwalPolicy} />
        <InfoLine icon={Code2} label="Public MCP contract" value={agent.publicContract} />
        <InfoLine
          icon={DatabaseZap}
          label="Sealed storage"
          value={`${agent.sealedHarness.network} / ${agent.sealedHarness.walrusBlobId}`}
        />
        <InfoLine icon={EyeOff} label="Hidden from hirer" value="Private skills, plugin code, prompts, eval sets, and tool-routing logic." />
      </div>

      <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Public MCP package</span>
          <Copy className="size-4 text-muted-foreground" />
        </div>
        <code className="block overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-white px-3 py-2 text-xs text-[#1c1e54]">
          {agent.mcpPackage}
        </code>
      </div>

      <div className="mt-5 rounded-xl border border-[#ea2261]/20 bg-[#fff8fb] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#9f1239]">
          <FileLock2 className="size-4" />
          Sealed Agent folder
        </div>
        <div className="space-y-2 text-xs leading-5 text-[#573144]">
          <div className="flex items-center justify-between gap-3">
            <span>Seal policy</span>
            <span className="max-w-44 truncate font-mono">{agent.sealedHarness.sealPolicyId}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Sui object</span>
            <span className="max-w-44 truncate font-mono">{agent.sealedHarness.suiObjectId}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Digest</span>
            <span className="max-w-44 truncate font-mono">{agent.sealedHarness.ciphertextDigest}</span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#573144]/80">
          {agent.sealedHarness.visibility}
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-[#533afd]/20 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Terminal className="size-4 text-primary" />
          Connect from Codex
        </div>
        <code className="block break-all rounded-md bg-secondary px-3 py-2 text-xs leading-5 text-[#1c1e54]">
          {codexMcpCommand}
        </code>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Install the plugin, then start a new Codex session and run{" "}
          <span className="number-cell">/mcp</span>.
        </p>
      </div>

      <Button className="mt-5 w-full" size="lg">
        <WalletCards /> Hire at ${agent.pricePerCallUsd.toFixed(3)} / call
      </Button>
    </aside>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="number-cell text-xl font-light text-[#1c1e54]">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm leading-relaxed text-[#273951]">{value}</div>
      </div>
    </div>
  );
}

function CreatorConsole() {
  const [draft, setDraft] = useState({
    agentName: "Private Code Reviewer",
    creatorAddress: "0xcreator...",
    publicCapability: "review_pull_request(diff, repo_context, risk_level)",
    policyRule: "Caller must hold an active HireReceipt for this Agent.",
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
    <section className="border-t border-border bg-white px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.86fr_1.14fr]">
        <div>
          <Badge variant="dark">Creator publish flow</Badge>
          <h2 className="mt-4 text-3xl font-light leading-tight">
            Upload AGENTS.md and skills as a sealed Walrus artifact.
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            The Codex plugin stays as a public HireMe connector. Creator-owned
            Skills, plugin code, prompts, eval sets, and Harness bundles are
            encrypted before Walrus storage and only opened by the MCP gateway
            after Seal policy approval.
          </p>

          <div className="mt-6 space-y-3">
            <BoundaryStep
              icon={KeyRound}
              title="Seal before storage"
              copy="Plaintext never becomes a public Walrus blob."
            />
            <BoundaryStep
              icon={DatabaseZap}
              title="Store encrypted bundle"
              copy="Walrus keeps ciphertext and Sui tracks the blob object."
            />
            <BoundaryStep
              icon={ServerCog}
              title="Execute in gateway"
              copy="Codex calls MCP tools; the user's machine never receives the private bundle."
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary p-5 app-shadow">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Agent name">
              <Input value={draft.agentName} onChange={updateDraft("agentName")} />
            </Field>
            <Field label="Creator wallet">
              <Input
                value={draft.creatorAddress}
                onChange={updateDraft("creatorAddress")}
              />
            </Field>
            <Field className="md:col-span-2" label="Public MCP contract">
              <Input
                value={draft.publicCapability}
                onChange={updateDraft("publicCapability")}
              />
            </Field>
            <Field className="md:col-span-2" label="Seal access policy">
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onChange={updateDraft("policyRule")}
                value={draft.policyRule}
              />
            </Field>
            <Field label="Price per MCP call">
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
                adapters. The folder is sealed before Walrus storage.
              </span>
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button disabled={isSealing} onClick={sealHarness} type="button">
              <UploadCloud /> {isSealing ? "Sealing..." : "Create sealed record"}
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
    .replace(/^-|-$/g, "")}.seal.bin`;
  const walrusCommand = `walrus store ${artifactName} --epochs ${record.epochs} --context testnet`;

  return (
    <div className="mt-5 rounded-xl border border-[#533afd]/20 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="size-4 text-primary" />
          Sealed public record
        </div>
        <Badge variant="outline">{record.network}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <RecordCell label="Seal policy" value={record.sealPolicyId} />
        <RecordCell label="Walrus blob" value={record.walrusBlobId} />
        <RecordCell label="Sui object" value={record.suiObjectId} />
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
          Folder entries sealed in preview
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
