import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sealAgentFolder } from "../apps/gateway/src/localSealedArtifact.mjs";

const port = Number(process.env.HIREME_AGENT_IMPACT_PORT || 19881);
const gatewayUrl = `http://localhost:${port}`;
const gatewayKey = "agent-impact-demo-key";
const outputDir = ".hireme/agent-impact-demo";
const task =
  process.argv.slice(2).join(" ").trim() ||
  "Create a flagship product-detail landing page for the Aster X1 smartphone. It should drive preorders and feel premium.";

await sealAgentFolder({
  folderPath: "examples/aster-x1-launch-agent",
  agentId: "example-aster-x1-launcher",
  pricePerCallUsd: 34,
  epochs: 3,
});

const gateway = spawn("node", ["apps/gateway/src/index.mjs"], {
  env: {
    ...process.env,
    HIREME_GATEWAY_PORT: String(port),
    HIREME_GATEWAY_API_KEY: gatewayKey,
  },
  stdio: ["ignore", "pipe", "inherit"],
});

try {
  await waitForGateway(gatewayUrl);

  const withoutAgent = buildWithoutAgentOutput(task);
  const withAgentCall = await postJson(`${gatewayUrl}/v1/agent-call`, {
    agent_id: "example-aster-x1-launcher",
    task,
    budget_calls: 1,
    hire_receipt_object_id: "hire_receipt_local_paid_demo",
  });
  const withAgent = withAgentCall.jsonOutput;
  const comparison = buildComparison({ task, withoutAgent, withAgent, withAgentCall });

  await mkdir(outputDir, { recursive: true });
  await writeJson("without-agent.json", withoutAgent);
  await writeJson("with-agent.json", withAgent);
  await writeJson("comparison.json", comparison);
  await writeFile(join(outputDir, "comparison.md"), renderMarkdown(comparison));
  await writeFile(join(outputDir, "without-agent.html"), renderWithoutAgentHtml(withoutAgent));
  await writeFile(join(outputDir, "with-agent.html"), renderWithAgentHtml(withAgent));
  await writeFile(join(outputDir, "index.html"), renderIndexHtml(comparison));

  console.log("HireMe agent impact demo generated.");
  console.log(`Output directory: ${outputDir}`);
  console.log(`Open: ${join(outputDir, "index.html")}`);
} finally {
  gateway.kill("SIGTERM");
  await once(gateway, "exit").catch(() => {});
}

function buildWithoutAgentOutput(userTask) {
  return {
    schema: "local.codex_without_hireme_agent.v1",
    type: "generic_landing_page_plan",
    generatedBy: "local-codex-without-protected-agent",
    sourceMaterial: ["user task only"],
    input: {
      task: userTask,
    },
    payload: {
      pageSections: [
        {
          name: "hero",
          guidance:
            "Create a headline, a short paragraph, a primary button, and a product image.",
        },
        {
          name: "features",
          guidance:
            "Add three feature cards covering speed, design, and battery life.",
        },
        {
          name: "specs",
          guidance:
            "Include a basic specification list with display, camera, battery, and storage.",
        },
        {
          name: "cta",
          guidance:
            "End with a preorder button and a short reassurance line.",
        },
      ],
      visualSystem: {
        colors: "Choose a modern technology palette.",
        typography: "Use a clean sans-serif font.",
        components: "Use cards, buttons, and a hero image.",
      },
      implementationNotes: [
        "Pick reasonable spacing and responsive behavior.",
        "Use placeholder product metrics where exact product data is unavailable.",
        "Add tests or screenshots after implementation.",
      ],
    },
    blindSpots: [
      "No access to the creator's protected design.md.",
      "No protected CTA hierarchy or exact color tokens.",
      "No harness rule requiring an actual product mockup in the first viewport.",
      "No verification checklist tied to the creator's landing page standard.",
      "Likely produces an acceptable but generic landing page.",
    ],
  };
}

function buildComparison({ task, withoutAgent, withAgent, withAgentCall }) {
  const payload = withAgent?.payload || {};
  const sections = payload.pageSections || [];

  return {
    schema: "hireme.agent_impact_comparison.v1",
    task,
    agentId: "example-aster-x1-launcher",
    withoutAgent,
    withAgent,
    scorecard: [
      {
        dimension: "Private launch playbook applied",
        withoutAgent: false,
        withAgent: payload.privateReferencesApplied?.launchPlaybook === true,
        whyItMatters:
          "The agent can apply protected launch mechanics without returning the private playbook text.",
      },
      {
        dimension: "Product dossier applied",
        withoutAgent: false,
        withAgent: payload.privateReferencesApplied?.productDossier === true,
        whyItMatters:
          "The specialized agent knows Aster X1 launch details, preorder tiers, claims, and offer mechanics.",
      },
      {
        dimension: "Mobile design harness applied",
        withoutAgent: "basic responsive stacking",
        withAgent:
          payload.privateReferencesApplied?.visualLayoutHarness === true &&
          payload.mobileLayoutSystem?.stickyPreorderBar?.required === true,
        whyItMatters:
          "The specialized agent enforces a mobile-first conversion layout instead of relying on a generic desktop page.",
      },
      {
        dimension: "Specific visual tokens",
        withoutAgent: "generic technology palette",
        withAgent: summarizeVisualSystem(payload.visualSystem),
        whyItMatters:
          "Local Codex receives concrete implementation constraints instead of making up a style system.",
      },
      {
        dimension: "First viewport product mockup",
        withoutAgent: "optional product image",
        withAgent:
          payload.heroComposition?.guidance ||
          sections.find((section) => section.name === "hero")?.guidance ||
          "hero guidance provided by protected agent",
        whyItMatters:
          "The agent output pushes the page toward a demonstrable product-detail landing page, not a generic marketing page.",
      },
      {
        dimension: "Local Codex continuation",
        withoutAgent: "manual interpretation required",
        withAgent: withAgent?.localCodex?.shouldAct === true,
        whyItMatters:
          "The gateway output tells Codex exactly which JSON payload to use for local implementation.",
      },
      {
        dimension: "Creator IP kept private",
        withoutAgent: "no private creator IP used",
        withAgent: withAgentCall.runner?.privateFolderReturnedToCodex === false,
        whyItMatters:
          "The useful guidance comes back, but AGENTS.md, design.md, skills, and harness internals do not.",
      },
    ],
    recommendedDemoScript: [
      "Show without-agent.json first: it is serviceable but generic.",
      "Show with-agent.json next: it contains Aster X1 preorder tiers, offer stack, safe claims, mobile layout harness, visual tokens, implementation notes, and verification checks.",
      "Point to jsonOutput.localCodex.shouldAct: true as the handoff from hired Agent to local Codex.",
      "Point to privateReferencesApplied.productDossier/launchPlaybook and privateFolderReturnedToCodex: false as the marketplace protection boundary.",
    ],
  };
}

function summarizeVisualSystem(visualSystem = {}) {
  const colors = visualSystem.colors || {};
  const primary = colors.primary ? `primary ${colors.primary}` : "agent-specific palette";
  const accent = colors.rubyAccent ? `accent ${colors.rubyAccent}` : null;
  const type = visualSystem.typography
    ? "thin display type and tabular numeric treatment"
    : "agent-specific typography";
  return [primary, accent, type].filter(Boolean).join("; ");
}

function renderMarkdown(comparison) {
  const rows = comparison.scorecard
    .map(
      (item) =>
        `| ${item.dimension} | ${formatCell(item.withoutAgent)} | ${formatCell(item.withAgent)} |`,
    )
    .join("\n");

  return `# HireMe Agent Impact Demo

## Task

${comparison.task}

## Result

| Dimension | Without HireMe Agent | With HireMe Agent |
| --- | --- | --- |
${rows}

## Demo Talk Track

${comparison.recommendedDemoScript.map((item) => `- ${item}`).join("\n")}

## Files

- \`without-agent.json\`: Generic local-Codex-only plan.
- \`with-agent.json\`: Gateway output from \`example-aster-x1-launcher\`.
- \`comparison.json\`: Machine-readable scorecard.
- \`index.html\`: Side-by-side visual comparison.
- \`without-agent.html\`: Generic local-Codex-only landing page.
- \`with-agent.html\`: HireMe Agent-guided landing page.
`;
}

function renderIndexHtml(comparison) {
  const rows = comparison.scorecard
    .map(
      (item) => `
        <tr>
          <th>${escapeHtml(item.dimension)}</th>
          <td>${escapeHtml(formatCell(item.withoutAgent))}</td>
          <td>${escapeHtml(formatCell(item.withAgent))}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HireMe Agent Impact Demo</title>
  <style>
    :root {
      color: #172033;
      background: #f4f6fb;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header {
      padding: 28px 32px 18px;
      border-bottom: 1px solid #dce2ee;
      background: #fff;
    }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { margin: 0; color: #59677d; line-height: 1.55; }
    main { padding: 24px 32px 36px; }
    .score {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 24px;
      background: #fff;
      border: 1px solid #dce2ee;
    }
    .score th, .score td {
      padding: 12px 14px;
      border-bottom: 1px solid #edf0f6;
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }
    .score th { width: 23%; color: #243047; }
    .score td:nth-child(2) { color: #8a3341; }
    .score td:nth-child(3) { color: #1f6d54; }
    .frames {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
    }
    .panel {
      background: #fff;
      border: 1px solid #dce2ee;
      min-width: 0;
    }
    .panel-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #dce2ee;
      font-size: 14px;
      font-weight: 700;
    }
    .panel-title span {
      color: #718095;
      font-weight: 500;
    }
    iframe {
      display: block;
      width: 100%;
      height: 900px;
      border: 0;
      background: white;
    }
    a { color: #533afd; text-decoration: none; font-weight: 700; }
    @media (max-width: 980px) {
      main { padding: 18px; }
      .frames { grid-template-columns: 1fr; }
      iframe { height: 760px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>HireMe Agent Impact Demo</h1>
    <p>${escapeHtml(comparison.task)}</p>
  </header>
  <main>
    <table class="score">
      <thead>
        <tr><th>Dimension</th><th>Without HireMe Agent</th><th>With HireMe Agent</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <section class="frames">
      <article class="panel">
        <div class="panel-title">Without Agent <span><a href="./without-agent.html">open</a></span></div>
        <iframe title="Without HireMe Agent" src="./without-agent.html"></iframe>
      </article>
      <article class="panel">
        <div class="panel-title">With HireMe Agent <span><a href="./with-agent.html">open</a></span></div>
        <iframe title="With HireMe Agent" src="./with-agent.html"></iframe>
      </article>
    </section>
  </main>
</body>
</html>`;
}

function renderWithoutAgentHtml(withoutAgent) {
  const task = withoutAgent.input.task;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Without HireMe Agent</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #172033;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      letter-spacing: 0;
    }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
    .hero {
      padding: 84px 0 68px;
      background: linear-gradient(135deg, #eaf2ff, #f5f7fb);
      border-bottom: 1px solid #dfe6f2;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 48px;
      align-items: center;
    }
    .eyebrow {
      color: #2368d1;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 52px;
      line-height: 1.02;
      margin: 0 0 20px;
      letter-spacing: 0;
    }
    .lead {
      color: #5f6c82;
      font-size: 18px;
      line-height: 1.6;
      margin: 0 0 28px;
      max-width: 620px;
    }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 20px;
      border-radius: 6px;
      border: 1px solid #1f63d6;
      font-weight: 700;
      text-decoration: none;
      color: #fff;
      background: #1f63d6;
    }
    .btn.secondary { color: #1f63d6; background: #fff; }
    .product-placeholder {
      aspect-ratio: 4 / 3;
      border-radius: 10px;
      border: 1px solid #ccd7ea;
      background:
        linear-gradient(135deg, rgba(35, 104, 209, .18), rgba(255,255,255,.8)),
        #f8fbff;
      display: grid;
      place-items: center;
      color: #6c7b91;
      font-weight: 700;
      box-shadow: 0 18px 44px rgba(23, 32, 51, .12);
    }
    section { padding: 58px 0; }
    h2 { margin: 0 0 22px; font-size: 32px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .card {
      border: 1px solid #dce3ef;
      border-radius: 10px;
      padding: 22px;
      background: #fff;
      min-height: 160px;
    }
    .card h3 { margin: 0 0 10px; font-size: 19px; }
    .card p, li { color: #5f6c82; line-height: 1.55; }
    .specs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .spec {
      padding: 16px;
      border-radius: 8px;
      background: #f5f7fb;
      border: 1px solid #dfe6f2;
    }
    .spec strong { display: block; margin-bottom: 4px; }
    .cta {
      text-align: center;
      background: #172033;
      color: #fff;
      padding: 64px 24px;
    }
    .cta p { color: #c9d3e4; }
    @media (max-width: 820px) {
      .hero-grid, .cards, .specs { grid-template-columns: 1fr; }
      h1 { font-size: 40px; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="wrap hero-grid">
      <div>
        <div class="eyebrow">Aster X1</div>
        <h1>Premium smartphone for everyday performance</h1>
        <p class="lead">${escapeHtml(task)}</p>
        <div class="actions">
          <a class="btn" href="#preorder">Preorder now</a>
          <a class="btn secondary" href="#features">View features</a>
        </div>
      </div>
      <div class="product-placeholder">Product image placeholder</div>
    </div>
  </header>
  <main>
    <section id="features" class="wrap">
      <h2>Key Features</h2>
      <div class="cards">
        <article class="card"><h3>Fast performance</h3><p>A powerful chip keeps apps, games, and multitasking responsive.</p></article>
        <article class="card"><h3>Modern design</h3><p>A refined body and edge-to-edge screen make the device feel premium.</p></article>
        <article class="card"><h3>All-day battery</h3><p>Stay connected through a full day of work, travel, and entertainment.</p></article>
      </div>
    </section>
    <section class="wrap">
      <h2>Specifications</h2>
      <div class="specs">
        <div class="spec"><strong>Display</strong><span>6.7 inch OLED</span></div>
        <div class="spec"><strong>Camera</strong><span>48MP system</span></div>
        <div class="spec"><strong>Battery</strong><span>All-day use</span></div>
        <div class="spec"><strong>Storage</strong><span>128GB and up</span></div>
      </div>
    </section>
  </main>
  <section id="preorder" class="cta">
    <h2>Ready to preorder?</h2>
    <p>Reserve Aster X1 today and get launch updates.</p>
  </section>
</body>
</html>`;
}

function renderWithAgentHtml(withAgent) {
  const payload = withAgent.payload || {};
  const positioning = payload.productPositioning || {};
  const hero = payload.heroComposition || {};
  const visual = payload.visualSystem || {};
  const colors = visual.colors || {};
  const primary = colors.primary || "#2537ff";
  const ink = colors.ink || "#0d253d";
  const brandDark = colors.night || colors.brandDark || "#10153d";
  const soft = colors.canvas || colors.canvasSoft || "#f4f8ff";
  const signal = colors.signal || "#21d0a2";
  const solar = colors.solar || colors.rubyAccent || "#ffb545";
  const metrics = payload.metricStrip || [];
  const offers = payload.launchOfferStack || [];
  const tiers = payload.preorderTiers || [];
  const specs = payload.specHighlights || [];
  const trustModules = payload.trustModules || [];
  const mobile = payload.mobileLayoutSystem || {};
  const responsiveChecks = payload.responsiveChecks || [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>With HireMe Agent</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --primary: ${primary};
      --ink: ${ink};
      --dark: ${brandDark};
      --soft: ${soft};
      --signal: ${signal};
      --solar: ${solar};
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--soft);
      font-feature-settings: "tnum";
    }
    body { margin: 0; letter-spacing: 0; background: var(--soft); }
    .wrap { max-width: 1160px; margin: 0 auto; padding: 0 28px; }
    .hero {
      min-height: 720px;
      padding: 40px 0 64px;
      background:
        radial-gradient(circle at 18% 14%, rgba(234, 34, 97, .18), transparent 28%),
        radial-gradient(circle at 72% 8%, rgba(33, 208, 162, .24), transparent 30%),
        linear-gradient(145deg, #fbfdff 0%, #eef5ff 48%, #f8fbff 100%);
      overflow: hidden;
      border-bottom: 1px solid rgba(13, 37, 61, .08);
    }
    nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 58px;
    }
    .brand { font-weight: 760; color: var(--dark); }
    .navlinks {
      display: flex;
      gap: 22px;
      color: rgba(13, 37, 61, .68);
      font-size: 14px;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: .92fr 1.08fr;
      gap: 54px;
      align-items: center;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 13px;
      border-radius: 999px;
      color: var(--primary);
      background: rgba(83, 58, 253, .09);
      font-size: 13px;
      font-weight: 720;
      margin-bottom: 18px;
    }
    h1 {
      max-width: 760px;
      margin: 0 0 22px;
      font-size: 68px;
      line-height: .96;
      font-weight: 300;
      letter-spacing: 0;
      color: var(--ink);
    }
    .lead {
      margin: 0 0 28px;
      max-width: 590px;
      color: rgba(13, 37, 61, .72);
      font-size: 18px;
      line-height: 1.65;
    }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 21px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 740;
      color: #fff;
      background: var(--primary);
      box-shadow: 0 16px 36px rgba(83, 58, 253, .22);
    }
    .btn.secondary {
      background: #fff;
      color: var(--ink);
      border: 1px solid rgba(13, 37, 61, .12);
      box-shadow: none;
    }
    .mockup-shell {
      position: relative;
      min-height: 500px;
      display: grid;
      place-items: center;
    }
    .mobile-preview {
      position: absolute;
      right: 2%;
      bottom: 6%;
      width: 210px;
      border-radius: 30px;
      padding: 10px;
      background: rgba(255,255,255,.78);
      border: 1px solid rgba(13,37,61,.12);
      box-shadow: 0 24px 70px rgba(16,21,61,.22);
      backdrop-filter: blur(14px);
    }
    .mobile-preview-inner {
      border-radius: 22px;
      overflow: hidden;
      background: #fff;
      border: 1px solid rgba(13,37,61,.08);
    }
    .mobile-preview-top {
      padding: 16px 14px 12px;
      background: linear-gradient(145deg, rgba(37,55,255,.1), rgba(33,208,162,.16));
    }
    .mobile-preview-top strong {
      display: block;
      color: var(--dark);
      font-size: 17px;
      font-weight: 420;
      line-height: 1.12;
    }
    .mobile-preview-chip-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .mobile-chip {
      border-radius: 999px;
      padding: 6px 8px;
      background: #fff;
      color: rgba(13,37,61,.72);
      font-size: 11px;
      line-height: 1;
    }
    .mobile-sticky-demo {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 10px;
      background: var(--dark);
      color: #fff;
      min-height: 54px;
    }
    .mobile-sticky-demo span {
      display: block;
      color: rgba(255,255,255,.65);
      font-size: 10px;
    }
    .mobile-sticky-demo strong {
      display: block;
      font-size: 14px;
      font-weight: 460;
    }
    .mini-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--primary);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .phone {
      width: min(330px, 78vw);
      aspect-ratio: 9 / 19;
      border-radius: 42px;
      padding: 12px;
      background: linear-gradient(160deg, #20245e, #0c1238 54%, #020516);
      box-shadow: 0 42px 90px rgba(28, 30, 84, .36);
      transform: rotate(-5deg);
    }
    .screen {
      height: 100%;
      border-radius: 32px;
      background:
        radial-gradient(circle at 74% 16%, rgba(234, 34, 97, .6), transparent 18%),
        linear-gradient(180deg, #11174c, #111827 58%, #f9fbff 58%);
      overflow: hidden;
      position: relative;
    }
    .camera {
      position: absolute;
      top: 18px;
      left: 50%;
      width: 84px;
      height: 24px;
      transform: translateX(-50%);
      border-radius: 999px;
      background: rgba(3, 8, 22, .76);
    }
    .screen-card {
      position: absolute;
      left: 22px;
      right: 22px;
      bottom: 24px;
      padding: 18px;
      border-radius: 22px;
      background: rgba(255,255,255,.96);
      box-shadow: 0 18px 44px rgba(3, 8, 22, .24);
    }
    .screen-card strong { display: block; font-size: 25px; font-weight: 420; color: var(--dark); }
    .screen-card span { display: block; margin-top: 7px; color: rgba(13, 37, 61, .64); font-size: 13px; line-height: 1.45; }
    .metric-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin-top: -34px;
      background: rgba(13, 37, 61, .1);
      border: 1px solid rgba(13, 37, 61, .1);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(13, 37, 61, .08);
    }
    .metric {
      background: #fff;
      padding: 22px;
    }
    .metric strong {
      display: block;
      color: var(--dark);
      font-size: 28px;
      font-weight: 420;
      font-feature-settings: "tnum";
    }
    .metric span { color: rgba(13,37,61,.62); font-size: 13px; }
    section { padding: 72px 0; }
    h2 {
      margin: 0 0 16px;
      max-width: 720px;
      font-size: 42px;
      line-height: 1.05;
      font-weight: 300;
      color: var(--dark);
    }
    .section-note { color: rgba(13, 37, 61, .67); max-width: 720px; line-height: 1.65; margin: 0 0 28px; }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .feature-card {
      min-height: 190px;
      padding: 22px;
      border-radius: 8px;
      background: #fff;
      border: 1px solid rgba(13, 37, 61, .08);
      box-shadow: 0 18px 50px rgba(13, 37, 61, .05);
    }
    .feature-card .swatch {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--primary);
      margin-bottom: 18px;
    }
    .feature-card:nth-child(2) .swatch { background: var(--signal); }
    .feature-card:nth-child(3) .swatch { background: var(--dark); }
    .feature-card h3 { margin: 0 0 10px; color: var(--dark); font-size: 18px; }
    .feature-card p { margin: 0; color: rgba(13, 37, 61, .65); line-height: 1.58; }
    .spec-band {
      background: var(--dark);
      color: #fff;
    }
    .spec-band h2 { color: #fff; }
    .spec-band .section-note { color: rgba(255,255,255,.68); }
    .spec-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      background: rgba(255,255,255,.14);
      border-radius: 8px;
      overflow: hidden;
    }
    .spec {
      padding: 22px;
      background: rgba(255,255,255,.06);
    }
    .spec strong { display: block; font-size: 25px; font-weight: 360; }
    .spec span { display: block; margin-top: 6px; color: rgba(255,255,255,.66); font-size: 13px; }
    .offer-list {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 1px;
      background: rgba(13, 37, 61, .1);
      border: 1px solid rgba(13, 37, 61, .1);
      border-radius: 8px;
      overflow: hidden;
      margin-top: 24px;
    }
    .offer {
      background: #fff;
      padding: 18px;
      min-height: 118px;
      color: rgba(13, 37, 61, .68);
      font-size: 14px;
      line-height: 1.45;
    }
    .offer strong {
      display: block;
      color: var(--dark);
      font-size: 13px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .tier-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 26px;
    }
    .tier {
      padding: 24px;
      border: 1px solid rgba(13,37,61,.1);
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 50px rgba(13,37,61,.05);
    }
    .tier h3 { margin: 0 0 6px; color: var(--dark); font-size: 20px; }
    .tier strong {
      display: block;
      color: var(--primary);
      font-size: 32px;
      font-weight: 360;
      margin: 8px 0;
      font-feature-settings: "tnum";
    }
    .tier p { margin: 0; color: rgba(13,37,61,.64); line-height: 1.55; }
    .trust-list {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-top: 24px;
    }
    .trust {
      border-radius: 999px;
      border: 1px solid rgba(33, 208, 162, .28);
      background: rgba(33, 208, 162, .08);
      color: rgba(13,37,61,.74);
      padding: 10px 13px;
      font-size: 13px;
      text-align: center;
    }
    .mobile-system {
      background: #fff;
      border-top: 1px solid rgba(13,37,61,.08);
      border-bottom: 1px solid rgba(13,37,61,.08);
    }
    .mobile-system-grid {
      display: grid;
      grid-template-columns: .9fr 1.1fr;
      gap: 28px;
      align-items: start;
    }
    .phone-stack {
      border-radius: 26px;
      background: var(--dark);
      color: #fff;
      padding: 18px;
      box-shadow: 0 30px 80px rgba(16,21,61,.2);
    }
    .phone-stack h3 {
      margin: 0 0 14px;
      font-size: 20px;
      font-weight: 420;
    }
    .mobile-order-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .mobile-order-list li {
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 12px;
      padding: 10px 12px;
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.84);
      font-size: 13px;
    }
    .mobile-order-list b {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: var(--signal);
      color: var(--dark);
      font-size: 11px;
    }
    .check-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .check {
      min-height: 86px;
      padding: 16px;
      border-radius: 8px;
      background: var(--soft);
      border: 1px solid rgba(13,37,61,.08);
      color: rgba(13,37,61,.72);
      line-height: 1.45;
      font-size: 14px;
    }
    .sticky-preorder {
      position: sticky;
      bottom: 0;
      z-index: 5;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 64px;
      padding: 10px max(16px, env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-right));
      background: rgba(16,21,61,.96);
      color: #fff;
      box-shadow: 0 -18px 44px rgba(16,21,61,.22);
    }
    .sticky-preorder span {
      display: block;
      color: rgba(255,255,255,.66);
      font-size: 12px;
    }
    .sticky-preorder strong {
      display: block;
      font-size: 16px;
      font-weight: 520;
      font-feature-settings: "tnum";
    }
    .final-cta {
      background: #fff;
      text-align: center;
      padding: 74px 28px;
    }
    .final-cta h2 { margin-left: auto; margin-right: auto; }
    .final-cta p { color: rgba(13,37,61,.66); line-height: 1.65; }
    .agent-proof {
      max-width: 760px;
      margin: 24px auto 0;
      padding: 16px;
      border: 1px solid rgba(83, 58, 253, .2);
      border-radius: 8px;
      background: rgba(83, 58, 253, .05);
      color: rgba(13,37,61,.7);
      font-size: 13px;
      line-height: 1.5;
    }
    @media (max-width: 880px) {
      .hero-grid, .metric-strip, .feature-grid, .spec-grid, .offer-list, .tier-grid, .trust-list, .mobile-system-grid, .check-grid { grid-template-columns: 1fr; }
      h1 { font-size: 45px; }
      .hero { min-height: auto; }
      .metric-strip { margin-top: 0; }
      .mobile-preview {
        position: relative;
        right: auto;
        bottom: auto;
        width: min(270px, 84vw);
        margin-top: -112px;
        justify-self: end;
      }
      .sticky-preorder { display: flex; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="wrap">
      <nav>
        <div class="brand">Aster X1</div>
        <div class="navlinks"><span>Camera</span><span>Specs</span><span>Preorder</span></div>
      </nav>
      <div class="hero-grid">
        <div>
          <div class="eyebrow">${escapeHtml(positioning.campaignName || "First Signal Drop")}</div>
          <h1>${escapeHtml(hero.headline || "Aster X1 is open for First Signal preorders.")}</h1>
          <p class="lead">${escapeHtml(hero.subhead || positioning.tagline || "Protected product launch guidance shaped this page.")}</p>
          <div class="actions">
            <a class="btn" href="#preorder">${escapeHtml(hero.primaryCta || "Reserve Aster X1")}</a>
            <a class="btn secondary" href="#models">${escapeHtml(hero.secondaryCta || "Compare models")}</a>
          </div>
        </div>
        <div class="mockup-shell">
          <div class="phone" aria-label="Aster X1 product mockup">
            <div class="screen">
              <div class="camera"></div>
              <div class="screen-card">
                <strong>Aster X1</strong>
                <span>${escapeHtml(positioning.launchWindow || "72-hour preorder window")} · ${escapeHtml(payload.heroComposition?.requiredElements?.[2] || "$49 deposit")}</span>
              </div>
            </div>
          </div>
          <div class="mobile-preview" aria-label="Mobile conversion layout preview">
            <div class="mobile-preview-inner">
              <div class="mobile-preview-top">
                <strong>Mobile first preorder flow</strong>
                <div class="mobile-preview-chip-row">
                  <span class="mobile-chip">72h</span>
                  <span class="mobile-chip">$49 deposit</span>
                  <span class="mobile-chip">Trade-in</span>
                </div>
              </div>
              <div class="mobile-sticky-demo">
                <div><span>From</span><strong>$899</strong></div>
                <div class="mini-btn">Reserve</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="metric-strip">
        ${renderMetricCards(metrics)}
      </div>
    </div>
  </header>
  <main>
    <section class="wrap">
      <h2>Preorder mechanics from the sealed launch playbook.</h2>
      <p class="section-note">${escapeHtml(positioning.positioning || "The specialized agent turns private product and launch data into safe implementation constraints.")}</p>
      <div class="offer-list">
        ${renderOfferCards(offers)}
      </div>
    </section>
    <section id="models" class="wrap">
      <h2>Model selector, not a generic feature grid.</h2>
      <p class="section-note">The protected product dossier supplies concrete tiers, prices, storage, and buyer-fit copy.</p>
      <div class="tier-grid">
        ${renderTierCards(tiers)}
      </div>
    </section>
    <section id="specs" class="spec-band">
      <div class="wrap">
        <h2>Safe claims only, presented for scanning.</h2>
        <p class="section-note">The agent uses product-specific safe claims and blocks unverified benchmark comparisons.</p>
        <div class="spec-grid">
          ${renderSpecCards(specs)}
        </div>
        <div class="trust-list">
          ${renderTrustList(trustModules)}
        </div>
      </div>
    </section>
    <section class="mobile-system">
      <div class="wrap mobile-system-grid">
        <div class="phone-stack">
          <h3>Protected mobile layout order</h3>
          <ol class="mobile-order-list">
            ${renderMobileOrder(mobile.mobileOrder)}
          </ol>
        </div>
        <div>
          <h2>Mobile conversion harness applied.</h2>
          <p class="section-note">The protected skill enforces sticky CTA, safe-area padding, tap-target size, mobile model selection, and first-viewport conversion elements.</p>
          <div class="check-grid">
            ${renderResponsiveChecks(responsiveChecks)}
          </div>
        </div>
      </div>
    </section>
    <section id="preorder" class="final-cta">
      <h2>Reserve the exact model before the window closes.</h2>
      <p>${escapeHtml(payload.heroComposition?.guidance || "The first viewport and final CTA both preserve the preorder economics from the launch playbook.")}</p>
      <div class="actions" style="justify-content:center;margin-top:24px">
        <a class="btn" href="#preorder">${escapeHtml(hero.primaryCta || "Reserve Aster X1")}</a>
        <a class="btn secondary" href="./with-agent.json">Inspect JSON output</a>
      </div>
      <div class="agent-proof">
        Applied private product dossier: ${payload.privateReferencesApplied?.productDossier ? "yes" : "no"}.
        Applied private launch playbook: ${payload.privateReferencesApplied?.launchPlaybook ? "yes" : "no"}.
        Private creator folder returned to Codex: ${withAgent.proof?.privateFolderReturnedToCodex ? "yes" : "no"}.
        Local Codex handoff: ${withAgent.localCodex?.shouldAct ? "yes" : "no"}.
      </div>
    </section>
  </main>
  <aside class="sticky-preorder" aria-label="Mobile sticky preorder bar">
    <div>
      <span>Refundable deposit</span>
      <strong>$49 · from $899</strong>
    </div>
    <a class="mini-btn" href="#preorder">Reserve</a>
  </aside>
</body>
</html>`;
}

function renderMetricCards(metrics) {
  const fallback = [
    { value: "48h", label: "adaptive battery target" },
    { value: "1-inch", label: "class main sensor" },
    { value: "29m", label: "fast-charge target" },
    { value: "$49", label: "refundable deposit" },
  ];
  return (metrics.length ? metrics : fallback)
    .slice(0, 4)
    .map(
      (metric) =>
        `<div class="metric"><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`,
    )
    .join("");
}

function renderOfferCards(offers) {
  const fallback = ["72-hour preorder window", "$49 refundable deposit"];
  return (offers.length ? offers : fallback)
    .slice(0, 5)
    .map(
      (offer, index) =>
        `<div class="offer"><strong>Offer ${index + 1}</strong>${escapeHtml(offer)}</div>`,
    )
    .join("");
}

function renderTierCards(tiers) {
  return tiers
    .slice(0, 3)
    .map(
      (tier) => `<article class="tier">
        <h3>${escapeHtml(tier.name)}</h3>
        <span>${escapeHtml(tier.storage)}</span>
        <strong>${escapeHtml(tier.price)}</strong>
        <p>${escapeHtml(tier.bestFor)}</p>
      </article>`,
    )
    .join("");
}

function renderSpecCards(specs) {
  return specs
    .slice(0, 4)
    .map((claim) => {
      const [value, ...rest] = String(claim).split(" ");
      return `<div class="spec"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(rest.join(" "))}</span></div>`;
    })
    .join("");
}

function renderTrustList(items) {
  return items
    .slice(0, 5)
    .map((item) => `<div class="trust">${escapeHtml(item)}</div>`)
    .join("");
}

function renderMobileOrder(items = []) {
  const fallback = [
    "campaign eyebrow",
    "headline",
    "preorder economics chips",
    "device mockup",
    "primary CTA",
  ];
  return (items.length ? items : fallback)
    .slice(0, 6)
    .map((item, index) => `<li><b>${index + 1}</b>${escapeHtml(item)}</li>`)
    .join("");
}

function renderResponsiveChecks(items = []) {
  const fallback = [
    "Hero headline, deposit, countdown, and CTA fit in the first mobile viewport.",
    "All tap targets are at least 44px tall.",
  ];
  return (items.length ? items : fallback)
    .slice(0, 6)
    .map((item) => `<div class="check">${escapeHtml(item)}</div>`)
    .join("");
}

function formatCell(value) {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value.replace(/\|/g, "\\|");
  return JSON.stringify(value).replace(/\|/g, "\\|");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function waitForGateway(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.service === "hireme-gateway") return;
      }
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Gateway did not become ready");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${gatewayKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function writeJson(filename, value) {
  await writeFile(join(outputDir, filename), `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
