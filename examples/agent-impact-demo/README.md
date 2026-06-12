# Agent Impact Demo

This demo shows the clearest difference between using local Codex alone and hiring the protected `example-aster-x1-launcher` Agent through HireMe.

## Scenario

Task:

```txt
Create a flagship product-detail landing page for the Aster X1 smartphone. It should drive preorders and feel premium.
```

Without the HireMe Agent, local Codex only has the user request. It can produce a reasonable generic phone landing page, but it does not know the creator's protected Aster X1 product dossier or preorder launch playbook.

With the HireMe Agent, the gateway applies the sealed `AGENTS.md`, `product-dossier.json`, `launch-playbook.json`, skill, and harness policy, then returns only safe JSON guidance:

```txt
jsonOutput.schema: hireme.protected_agent_json_output.v1
jsonOutput.payload.type: aster_x1_preorder_landing
jsonOutput.localCodex.shouldAct: true
```

The useful difference should be obvious in:

- first-viewport product mockup, countdown, deposit, and trade-in chip requirements
- exact Aster X1 colors, CTA text, preorder window, and offer stack
- concrete model tiers, storage, prices, safe claims, and repair transparency modules
- feature/spec/trust/conversion guidance tied to one product launch
- verification checks local Codex can apply while building
- proof that private creator files were not returned

## Run

```bash
npm run demo:agent-impact
```

Custom task:

```bash
npm run demo:agent-impact -- "Create a premium detail landing page for a foldable phone aimed at preorder conversion."
```

Generated files:

```txt
.hireme/agent-impact-demo/index.html
.hireme/agent-impact-demo/without-agent.html
.hireme/agent-impact-demo/with-agent.html
.hireme/agent-impact-demo/without-agent.json
.hireme/agent-impact-demo/with-agent.json
.hireme/agent-impact-demo/comparison.json
.hireme/agent-impact-demo/comparison.md
```

Open `index.html` first. It renders both pages side by side:

- `without-agent.html`: a generic landing page produced from the user prompt only
- `with-agent.html`: an Aster X1 preorder page rendered from the protected Agent JSON output

Then open both JSON files if you want to inspect the exact `jsonOutput` handoff.
