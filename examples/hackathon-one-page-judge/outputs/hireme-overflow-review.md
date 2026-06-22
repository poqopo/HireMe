# Local Review Output

Verdict: HireMe looks like a strong Walrus Track contender, but the one-pager should lead harder with proof that Walrus and MemWal make the Agent hiring loop persistent, protected, and useful across sessions.

Prize odds: Medium-High, 81/100.

Weighted score:
- Product & UX: 16/20
- Real-World Application: 42/50
- Technical Implementation: 16/20
- Presentation & Vision: 7/10

Track fit:
- Strongest fit: Walrus Track. The product directly addresses stateless, fragmented agent workflows by storing protected Agent artifacts on Walrus and using MemWal for persistent conversation memory.
- Secondary fit: Agentic Web. This can work if the story emphasizes MCP-native AI execution and explains why Sui/Walrus primitives make the AI service safer and more composable, not just stored.
- Weak fit: DeFi & Payments. The current one-pager does not center programmable money, Move-enforced financial flows, or PTBs.
- Off-track: DeepBook Predict. There is no DeepBook Predict contract, market, vault, bot, or simulation path.

Differentiation to emphasize:
- Compared with a generic AI agent marketplace, HireMe's stronger claim is protected execution: clients buy the Agent's result while the creator's private Harness stays hidden.
- Compared with a storage-only Walrus demo, HireMe uses Walrus in the actual product boundary: the protected Agent package needs durable artifact storage and public proof without source disclosure.
- Compared with a simple chatbot memory demo, HireMe's MemWal angle is stronger if it shows context recall across web, MCP sessions, and multiple Agents.
- Put this differentiator earlier: "HireMe is not a prompt marketplace. It is a protected Agent hiring protocol where Walrus stores encrypted Agent packages and MemWal carries project memory across sessions and agents."

Criteria fit analysis:
- Product & UX: The web marketplace, Agent detail page, Try/Hire flow, and MCP usage are easy to demo. Missing proof: one clean before/after result that shows a generic tool failing and a specialized Agent succeeding. Refinement: open the demo with Dokpami Maker's input image to final result transformation.
- Real-World Application: The two-sided problem is strong because clients waste time on generic AI while creators need to protect private know-how. Missing proof: make the cost of bad generic outputs concrete. Refinement: add one client scenario such as "a non-designer needs a usable character asset in minutes, not prompt iteration for hours."
- Technical Implementation: Walrus artifact storage, Sui object IDs, MCP calls, and MemWal memory are directly relevant. Missing proof: judges need artifact IDs, memory recall evidence, and a short architecture row in the one-pager. Refinement: show Walrus blob ID, Sui object ID, MCP job/result, and MemWal recall as visible evidence.
- Presentation & Vision: The long-term protocol vision is compelling, but the current wording can sound like a broad marketplace. Missing proof: a crisp product thesis. Refinement: consistently say "protected Agent hiring" instead of "AI marketplace" when explaining why Walrus and MemWal matter.

Highest-leverage additions:
- Product/Demo: Add a side-by-side "normal output vs specialized Agent output" section using Dokpami Maker. This improves Product & UX and makes the client value visible before any architecture explanation.
- Technical Proof: Add a proof strip with the deployed Agent URL, Walrus blob ID, Sui object ID, MCP job/result, and MemWal recall evidence. This directly improves Technical Implementation and Presentation.
- Real-World Application: Add one concrete buyer story: "A client outside image design needs a usable character variation quickly, without learning prompt craft or hiring a full designer." This makes the 50% category more concrete.
- Creator Value: Show the creator side in one sentence: "The creator earns from the Agent while the private Harness remains hidden." This strengthens the two-sided market story.
- Memory Proof: Add a second-session prompt that does not restate the full Dokpami context and still produces a consistent result. This makes MemWal feel necessary rather than optional.

Technical reality check:
- Verified evidence: The one-pager can credibly show a working web product, Agent detail page, Dokpami result image, MCP call path, Walrus blob ID, and Sui object ID if those artifacts are included directly.
- Plausible claim: MemWal makes hired Agent sessions persistent across sessions and agents. This is believable from the architecture, but it needs a visible memory write and recall trace.
- Missing proof: The one-pager should show one exact MCP request/response, one Walruscan or explorer link, one Sui object link, and one second-session recall result. Without those, judges may treat the technical integration as claimed rather than demonstrated.
- What to expose: a compact proof strip with labels: "Protected Agent package on Walrus", "Sui object proof", "MCP call result", "MemWal recall", and "client receives result, not Harness".

Past-winner pattern and shortlist likelihood:
- Prior Sui Overflow storage winners were not just "we store data" demos; they turned storage into a concrete product loop, such as document signing, graph data, wallet-native messaging, or site publishing. HireMe can match this pattern if it frames Walrus as the protected Agent artifact layer for a real hiring workflow.
- Prior AI winners tended to connect AI with verifiable data, model workflows, trading, or safety rather than merely wrapping an LLM. HireMe can match this pattern if the specialized Agent output is visibly better than normal output and the private Harness explains why.
- Current shortlist read: plausible to strong for Walrus Track if the demo shows the protected package, result delivery, and memory recall in under one minute. Without those proof artifacts, it drops to plausible but not clearly prize-competitive.
- Prize ceiling: high enough to be competitive if the story becomes "protected Agent services powered by Walrus and MemWal" instead of "AI marketplace with storage".

What to cut or de-emphasize:
- De-emphasize generic marketplace language, profile management, and auth details in the one-pager unless they support the protected hiring loop.
- Do not spend too much space on payment mechanics unless the demo has a strong Sui payment object; payment is not the main Walrus Track reason to win.
- Avoid saying only "stored on Walrus." Say what storing enables: protected packages, public proof, durable execution artifacts, and cross-session memory.
- Avoid listing many Agents. One excellent Agent demo plus one memory recall proof is stronger than a crowded catalog.

Demo order:
1. Show the problem: generic AI output is not good enough for a specialized task.
2. Show Dokpami Maker: input image to customized result.
3. Show the protected boundary: the client receives the result, not the Harness.
4. Show Walrus proof: blob ID and Sui object ID for the protected Agent package.
5. Show MCP use: call the same Agent from Codex or another MCP client.
6. Show MemWal recall: a later session reuses Dokpami context without restating everything.
7. Close with the creator story: builders can monetize valuable Agents without exposing how they are built.

Judge objections to preempt:
- "Is this just another AI marketplace?" Answer: "No. The core primitive is protected Agent execution: the private Harness stays hidden while the client receives the result."
- "Is Walrus only used as storage?" Answer: "Walrus is the artifact layer for protected Agent packages, and MemWal carries conversation memory across sessions and agents."
- "Can judges verify the integration?" Answer with visible Walrus blob ID, Sui object ID, MCP job/result, and MemWal recall proof.
- "Why would users come back?" Answer with recurring specialized tasks and persistent project memory.
- "Why is this better than a prompt marketplace?" Answer with private skills, examples, memory rules, and execution habits that are never handed to the client.

Why it could win:
- The problem is meaningful: clients need reliable specialized AI work, while creators need to protect the private workflow that makes their Agent valuable.
- Walrus is part of the core product promise, not a decorative storage layer. Protected packages need durable artifact storage.
- MemWal gives a clear cross-session value story: hired Agents can remember project context instead of starting over.
- The web plus MCP flow gives judges a concrete product surface beyond a single demo screen.

Why it may lose:
- If the one-pager reads like an AI marketplace first, judges may miss that the real Walrus contribution is protected durable Agent packaging plus persistent memory.
- The demo proof needs to be visible immediately: blob ID, Sui object ID, MCP call result, and MemWal recall evidence should not be buried.
- The Agentic Web angle is weaker unless the one-pager shows how Sui primitives improve AI execution safety, permissions, or composability.
- The current story needs one sharp before/after outcome showing why a specialized Agent beats generic AI.

Top fixes before submission:
1. Open with the two-sided pain: "Clients waste time and money on generic AI outputs; creators cannot share valuable Agents without exposing the private Harness that makes them work."
2. Add a proof strip near the top: deployed URL, Dokpami Agent URL, Walrus blob ID, Sui object ID, one MCP call screenshot, and one MemWal recall screenshot.
3. Show one before/after demo: generic character output vs. Dokpami Maker output from the same base character.
4. Make the Walrus Track sentence explicit: "Walrus stores protected Agent packages as durable artifacts; MemWal stores encrypted conversation memory so Agents can remember context across sessions and agents."
5. Reduce marketplace language and replace it with "protected Agent hiring protocol" language.
6. Add a short architecture row: creator Harness to encrypted Walrus artifact to HireMe gateway execution; client task to MCP call to safe result; conversation to MemWal recall.

Suggested one-page structure:
1. Problem: clients need specialized results, creators need to protect know-how.
2. Product: HireMe lets clients hire Agent work without receiving the private Harness.
3. Demo: Dokpami Maker and MCP flow with before/after result.
4. Walrus and MemWal proof: blob ID, Sui object ID, memory recall evidence.
5. Why it matters: protected Agent services can persist across tools, sessions, and agents.
6. Roadmap: stronger creator payments, richer memory inspection, more track-specific Agents.

Judge-facing pitch line:
HireMe lets clients hire specialized AI Agents while creators keep their private Harness protected, with Walrus storing durable Agent packages and MemWal remembering context across sessions and agents.

How to fix it:
1. Rewrite the opening around the pain, not the platform: "Clients waste time and money trying to get specialized work from generic AI. Creators can build valuable Agents, but publishing them exposes the private Harness that makes them valuable."
2. Move the differentiator into the first screen: "HireMe is protected Agent hiring, not a prompt marketplace."
3. Add a proof strip immediately after the product summary: deployed Agent URL, Walrus blob ID, Sui object ID, MCP request/result, and MemWal recall evidence.
4. Show one strong demo instead of many features: Dokpami input image, normal output, specialized Agent output, then second-session memory recall.
5. Cut or shrink auth, profile, catalog, and payment details unless they directly prove the protected hiring loop.
6. End the one-pager with a Walrus-specific thesis: "Walrus makes the Agent package durable and verifiable; MemWal makes the Agent relationship persistent across sessions and agents."
