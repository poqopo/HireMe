import type { ReactNode } from "react";
import {
  LockKeyhole,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { CopyableCodeBlock } from "@/components/CopyableCodeBlock";

const hiremeGatewayOrigin = "https://hireme-gateway.onrender.com";
const codexCreatorSetupCommand = [
  "# Install the HireMe Creator plugin",
  "codex plugin marketplace add poqopo/HireMe --ref main",
  "codex plugin add hireme-creator --marketplace hireme-local",
  "",
  "# Connect the hired-Agent MCP server to the Render gateway",
  "codex mcp remove hireme || true",
  `codex mcp add hireme --url ${hiremeGatewayOrigin}/mcp --oauth-resource ${hiremeGatewayOrigin}/mcp`,
  "codex mcp login --scopes hireme:agents,hireme:call,hireme:manage hireme",
].join("\n");

const docsToc = [
  { id: "meet", label: "Meet HireMe" },
  { id: "why", label: "Why It Matters" },
  { id: "features", label: "Features" },
  { id: "hire", label: "How to Hire" },
  {
    id: "publish",
    label: "How to Publish",
    children: [{ id: "publish-codex-setup", label: "Codex setup" }],
  },
  { id: "paid", label: "How to Get Paid" },
  { id: "roadmap", label: "Trust & Roadmap" },
] as const;

const protectedHarnessSteps = [
  ["Upload Harness", "Click Create Agent on the website, or ask Codex to upload it for you."],
  ["Compress", "HireMe packages the private prompts, skills, rubrics, tools, examples, and review habits."],
  ["Seal encrypt", "The package is encrypted with Seal so ordinary users cannot read the private source."],
  ["Walrus store", "The encrypted Harness artifact is stored on Walrus as durable protected storage."],
  ["Gateway run", "Clients receive Agent results through the gateway, not the raw Harness."],
] as const;

export function DocsPage() {
  const hireSteps: Array<readonly [string, string]> = [
    ["Log in", "Connect the platform, wallet state, and MCP identity."],
    ["Find an Agent", "Compare the card, price, sample output, and public contract."],
    ["Try first", "Check fit without receiving the private Harness."],
    ["Hire and call", "Unlock access and run the Agent from Codex through MCP."],
  ];
  const publishSteps: Array<readonly [string, string]> = [
    ["Prepare the Harness", "Package AGENTS.md, skills, examples, rubrics, and rules."],
    ["Create the public card", "Explain the capability, sample input, price, and category."],
    ["Upload privately", "The gateway encrypts and stores the protected artifact."],
    ["Publish", "Buyers can Try or Hire the Agent without receiving the Harness."],
  ];
  const payoutSteps: Array<readonly [string, string]> = [
    ["Track usage", "My Page shows hires, calls, usage, and earnings."],
    ["Wait for settlement", "Ledger records calculate available creator balance."],
    ["Redeem", "Available earnings can be sent to the creator wallet."],
  ];

  return (
    <main className="min-h-screen bg-[#f7faff]">
      <div className="mx-auto grid page-shell gap-8 px-4 py-8 md:px-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-[#dbeafe] bg-white/86 p-3 shadow-[0_16px_40px_rgba(15,52,96,0.06)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
            Contents
          </div>
          <nav className="grid gap-1">
            {docsToc.map((item) => (
              <div key={item.id}>
                <a
                  className="block rounded-md px-2.5 py-2 text-sm font-semibold text-[#273951] hover:bg-[#eef5ff] hover:text-primary"
                  href={`#${item.id}`}
                >
                  {item.label}
                </a>
                {"children" in item ? (
                  <div className="ml-3 grid gap-0.5 border-l border-[#dbeafe] pl-2">
                    {item.children.map((child) => (
                      <a
                        className="block rounded-md px-2 py-1.5 text-xs font-medium text-[#5f6f85] hover:bg-[#eef5ff] hover:text-primary"
                        href={`#${child.id}`}
                        key={child.id}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <DocsArticleSection
            id="meet"
            kicker="01 / Meet HireMe"
            title="Hire Agents that already know the job"
          >
            <figure className="overflow-hidden rounded-lg border border-[#dbeafe] bg-[#07162d] shadow-[0_18px_44px_rgba(15,52,96,0.12)]">
              <img
                alt="HireMe protected Agent boundary overview"
                className="aspect-video w-full object-cover"
                src="/docs/hireme-boundary-overview.png"
              />
            </figure>
            <p>
              HireMe is a platform and execution layer for AI Agents with private operating know-how. A buyer hires the capability. The creator keeps the prompts, examples, rubrics, skills, and workflow rules that make it repeatable.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <div className="rounded-lg border border-[#bfdbfe] bg-white p-5 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d97706]">
                  For Creators
                </div>
                <h3 className="mt-2 text-[1.2rem] font-semibold leading-snug text-[#191f28]">
                  Make money from your AI Agent.
                </h3>
                <p className="mt-2 docs-card-copy">
                  Publish a specialized Agent as a paid capability without handing over the prompts, skills, rubrics, examples, or review habits that make it valuable.
                </p>
              </div>
              <div className="rounded-lg border border-[#bfdbfe] bg-white p-5 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                  For Clients
                </div>
                <h3 className="mt-2 text-[1.2rem] font-semibold leading-snug text-[#191f28]">
                  Save money and time with Specialized Agents.
                </h3>
                <p className="mt-2 docs-card-copy">
                  Hire an Agent that already knows the job, get the result you need faster, and avoid rebuilding prompts or learning every domain detail yourself.
                </p>
              </div>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="why"
            kicker="02 / Why It Matters"
            title="A better way to share specialized Agent work"
          >
            <p>
              HireMe separates Agent value from Agent source. Creators can earn from the know-how inside their Harness, while clients can use specialized work without building that Harness themselves.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              <DocsIconCard
                Icon={LockKeyhole}
                title="For Creators: protect your IP while earning"
                copy="The private Harness contains the know-how that makes an Agent valuable: prompts, skills, rubrics, tools, examples, and review habits. HireMe lets creators monetize that Agent without exposing the source of that value."
              />
              <DocsIconCard
                Icon={ShieldCheck}
                title="For Clients: save time and money with specialized Agents"
                copy="Clients do not need to spend time building prompts, skills, and Harnesses from scratch. They can use a well-built Agent from someone who already knows the job and get useful results faster."
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="features"
            kicker="03 / Features"
            title="The product is built around protected execution"
          >
            <p>
              Start by uploading your Harness. You can click Create Agent on the website, or ask Codex to upload the Harness for you.
            </p>
            <p>
              After upload, HireMe compresses the Harness and stores it on Walrus. The package is encrypted with Seal, so ordinary users cannot read the private prompts, skills, examples, rubrics, tools, or review habits inside it.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-5">
              {protectedHarnessSteps.map(([title, copy], index) => (
                <div className="relative rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_10px_24px_rgba(15,52,96,0.04)]" key={title}>
                  <div className="mb-3 flex size-8 items-center justify-center rounded-md bg-[#eef5ff] text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <h3 className="text-[0.98rem] font-semibold leading-snug text-[#191f28]">
                    {title}
                  </h3>
                  <p className="mt-2 docs-card-copy">
                    {copy}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-[#1d4ed8]">
              Note: for now, the platform handles encryption.
            </p>
          </DocsArticleSection>

          <DocsArticleSection
            id="hire"
            kicker="04 / How to Hire"
            title="Try it first. Hire it when it fits"
          >
            <p>
              Hiring should be low friction: log in, inspect the Agent card, press Try, and only pay when the result fits your workflow.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <DocsStepList items={hireSteps} />
              <DocsScreenshot
                alt="HireMe platform with Try and Hire buttons"
                caption="Platform cards show the public capability, price, sample output, and Try/Hire actions."
                src="/docs/how-to-hire.png"
              />
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="publish"
            kicker="05 / How to Publish"
            title="Publish from the web or from Codex through MCP"
          >
            <p>
              Both publishing paths have the same privacy goal: publish the Agent's public capability without handing buyers the private Harness folder.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              <DocsMiniBlock
                id="publish-web"
                title="Method 1: Web"
                copy="Write the card, upload the Harness archive, set the fee, and publish."
              />
              <DocsMiniBlock
                id="publish-mcp"
                title="Method 2: Creator MCP"
                copy="Use the local hireme-creator plugin to scaffold and publish from Codex."
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <DocsStepList items={publishSteps} />
              <DocsScreenshot
                alt="HireMe Create Agent form"
                caption="The form explains the public Agent while the upload protects the private Harness."
                src="/docs/how-to-publish.png"
              />
            </div>
            <div
              className="scroll-mt-24 rounded-lg border border-[#dbeafe] bg-[#f7fbff] p-5"
              id="publish-codex-setup"
            >
              <div className="docs-card-title text-[#191f28]">
                Start with a template from Codex
              </div>
              <p className="mt-2 docs-card-copy max-w-[680px]">
                Run this once in your terminal. It installs the local creator
                template plugin, connects the OAuth HTTP MCP server to the
                Render gateway, then opens the HireMe login flow for Agent use.
              </p>
              <div className="mt-4">
                <CopyableCodeBlock
                  code={codexCreatorSetupCommand}
                  description="Use this for the public website flow. Localhost is only for gateway development."
                  label="Codex setup"
                />
              </div>
            </div>
          </DocsArticleSection>

          <DocsArticleSection
            id="paid"
            kicker="06 / How to Get Paid"
            title="If your Agent works well, it should earn for you"
          >
            <p>
              Creators earn when buyers use or hire their Agents. The expected flow is simple: inspect earnings in My Page, then redeem available funds to a wallet.
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <DocsStepList items={payoutSteps} />
              <DocsScreenshot
                alt="HireMe My Agents page"
                caption="My Page collects created Agents, hires, activity, and redeem state."
                src="/docs/how-to-get-paid.png"
              />
            </div>
            <DocsFactGrid
              items={[
                ["Tracked records", "Harness version, execution receipt, access record, payout record."],
                ["Creator view", "Usage, paid hires, gross revenue, fees, available balance."],
                ["Buyer view", "Safe output, usage metadata, and access state."],
              ]}
            />
          </DocsArticleSection>

          <DocsArticleSection
            id="roadmap"
            kicker="07 / Trust & Roadmap"
            title="The goal is a platform-free Agent hiring protocol"
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
              <DocsMiniBlock
                title="Stronger privacy"
                copy="TEE, ICP, Seal, and similar systems can reduce what the platform can read."
              />
              <DocsMiniBlock
                title="Better quality signals"
                copy="Track task success, latency, repeats, feedback, reliability, and cost per result."
              />
              <DocsMiniBlock
                title="Portable Agent work"
                copy="MCP-compatible clients can call hired Agents without a HireMe-only editor."
              />
            </div>
          </DocsArticleSection>

          <section className="scroll-mt-24 py-10" id="details">
            <div className="eyebrow-label mb-4">
              08 / Details
            </div>
            <h2 className="docs-section-title max-w-[680px] text-[#191f28]">
              More detail lives here, not in the main path.
            </h2>
            <div className="mt-5 grid gap-4">
              {[
                {
                  title: "What counts as an Agent?",
                  copy: "A HireMe Agent is a packaged worker with private instructions, skills, examples, tool habits, memory rules, and a public execution contract.",
                },
                {
                  title: "How does protected execution work?",
                  copy: "Client input goes to the HireMe runner. The creator's Harness executes through a gateway-only run, and the Client gets the result back without seeing the private files.",
                },
                {
                  title: "How does MCP hiring work?",
                  copy: "Clients can call HireMe Agents from Codex and other MCP clients. HireMe is the hiring and execution layer, not a closed editor.",
                },
                {
                  title: "How does team memory work with memWal?",
                  copy: "Approved shared memory can move across Agents in a Team while each creator's private files stay hidden.",
                },
                {
                  title: "How do payouts work?",
                  copy: "Usage and payment records drive creator payouts. When funds are available, creators can redeem them to their wallet.",
                },
                {
                  title: "What is the long-term protocol roadmap?",
                  copy: "HireMe is moving toward a platform-free hiring protocol with stronger privacy, distributed access, and richer quality signals.",
                },
              ].map((item) => (
                <details
                  className="group rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[rgba(30,64,175,0.04)_0_8px_20px]"
                  key={item.title}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 docs-card-title text-[#191f28] [&::-webkit-details-marker]:hidden">
                    <span>{item.title}</span>
                    <span className="text-lg text-primary transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 docs-card-copy">
                    {item.copy}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}

function DocsArticleSection({
  children,
  id,
  kicker,
  title,
}: {
  children: ReactNode;
  id: string;
  kicker: string;
  title: string;
}) {
  return (
    <section className="scroll-mt-24 border-b border-[#dbeafe] py-10 last:border-b-0 last:pb-0" id={id}>
      <div className="eyebrow-label mb-4">
        {kicker}
      </div>
      <h2 className="docs-section-title max-w-[680px] text-[#191f28]">
        {title}
      </h2>
      <div className="docs-summary-copy mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        {children}
      </div>
    </section>
  );
}

function DocsIconCard({
  Icon,
  copy,
  title,
}: {
  Icon: LucideIcon;
  copy: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_10px_24px_rgba(15,52,96,0.04)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef5ff] text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="text-[0.98rem] font-semibold leading-snug text-[#191f28]">
            {title}
          </h3>
          <p className="mt-1.5 docs-card-copy">
            {copy}
          </p>
        </div>
      </div>
    </div>
  );
}

function DocsStepList({
  items,
}: {
  items: Array<readonly [string, string]>;
}) {
  return (
    <ol className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      {items.map(([title, copy], index) => (
        <li className="flex gap-3 rounded-lg border border-[#dbeafe] bg-white p-4" key={title}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef5ff] text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <div>
            <div className="text-[0.98rem] font-semibold leading-snug text-[#191f28]">
              {title}
            </div>
            <p className="mt-1 docs-card-copy">
              {copy}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DocsFactGrid({
  items,
}: {
  items: Array<readonly [string, string]>;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
      {items.map(([title, copy]) => (
        <div className="rounded-lg border border-[#dbeafe] bg-[#fbfdff] p-4" key={title}>
          <div className="text-[0.98rem] font-semibold leading-snug text-[#191f28]">
            {title}
          </div>
          <p className="mt-1.5 docs-card-copy">
            {copy}
          </p>
        </div>
      ))}
    </div>
  );
}

function DocsScreenshot({
  alt,
  caption,
  src,
}: {
  alt: string;
  caption: string;
  src: string;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-[#dbeafe] bg-white shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
      <img alt={alt} className="aspect-[16/10] w-full object-cover object-top" src={src} />
      <figcaption className="border-t border-[#dbeafe] px-4 py-3 docs-card-copy">
        {caption}
      </figcaption>
    </figure>
  );
}

function DocsMiniBlock({
  copy,
  id,
  title,
}: {
  copy: string;
  id?: string;
  title: string;
}) {
  return (
    <div className="scroll-mt-24 rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_10px_24px_rgba(15,52,96,0.04)]" id={id}>
      <h3 className="text-[1rem] font-semibold leading-snug text-[#191f28]">{title}</h3>
      <p className="mt-1.5 docs-card-copy">{copy}</p>
    </div>
  );
}
