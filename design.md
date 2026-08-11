# HireMe Design System

## Overview

HireMe는 **디자인 전문가가 자신의 감각, 판단 기준, 작업 프로세스를 AI Agent로 만들고 수익화할 수 있는 디자인 전문 Agent Marketplace**다.

AI 이미지 생성과 디자인 자동화 기술은 빠르게 발전하고 있다. 이제 사용자는 몇 줄의 프롬프트만으로도 짧은 시간 안에 꽤 괜찮은 결과물을 얻을 수 있다.

하지만 디자인에서는 여전히 **마지막 2%의 차이**가 남는다.

이 2%는 단순한 생성 능력의 차이가 아니다.

- 어떤 레퍼런스를 선택하는지
- 무엇을 과감히 버리는지
- 브랜드 톤을 어디까지 유지하는지
- 어떤 결과를 "괜찮다"가 아니라 "좋다"고 판단하는지
- 수정 요청을 어떻게 해석하고 우선순위를 정하는지

와 같은 **전문가의 taste, judgment, workflow**에서 발생한다.

HireMe의 브랜드는 이 마지막 2%를 강조해야 한다. 따라서 전형적인 AI SaaS처럼 미래적이고 기술적인 인상보다, **디자인 전문가가 직접 큐레이션한 공간**, **좋은 작업이 거래되는 creative marketplace**, **사람의 감각이 AI를 완성하는 서비스**처럼 보여야 한다.

### Brand Positioning

> AI generates. Experts decide.

HireMe는 "AI가 디자인을 대신해주는 서비스"가 아니라,

> **전문가의 작업 방식을 AI를 통해 확장하는 플랫폼**

으로 포지셔닝한다.

### Key Characteristics

- **Editorial, not generic SaaS**  
  대시보드 중심의 전형적인 AI SaaS보다 디자인 매거진과 포트폴리오 플랫폼의 분위기를 가진다.

- **Curated, not infinite**  
  수많은 Agent를 무작위로 노출하기보다, 좋은 Agent가 선별되어 있다는 인상을 준다.

- **Human, not robotic**  
  AI 자체보다 Agent를 만든 Designer의 관점과 전문성을 전면에 보여준다.

- **Bold but restrained**  
  브랜드 컬러는 명확하지만 UI 전체를 과도하게 채우지 않는다.

- **Agent diversity inside one system**  
  HireMe 자체는 강한 하나의 브랜드를 유지하고, 각 Designer Agent는 개별 Accent Color와 visual identity를 가질 수 있다.

---

# Brand Personality

HireMe의 핵심 브랜드 성격은 다음 세 단어로 정의한다.

## Curated

HireMe는 단순한 Agent directory가 아니다.

누구나 생성한 수천 개의 Agent가 쌓여 있는 marketplace보다는, 실제 Designer가 자신의 전문성을 기반으로 만든 **quality-controlled creative agents**가 모여 있다는 느낌이 중요하다.

UI에서도 이를 위해:

- 지나치게 많은 카드 노출을 피한다.
- 한 화면에서 보여주는 선택지를 제한한다.
- Editor's Pick / Featured Designer / Best for Branding처럼 맥락 있는 큐레이션을 제공한다.
- Agent 카드보다 Designer identity가 먼저 인식되도록 한다.

---

## Creative

사용자는 HireMe에 들어왔을 때 "업무용 SaaS"가 아니라 **creative environment**에 들어왔다는 느낌을 받아야 한다.

이를 위해:

- 큰 타이포그래피
- 이미지 중심의 layout
- 서로 다른 Agent visual
- 약간의 비대칭성
- 의도적인 컬러 블록
- 충분한 whitespace

를 활용한다.

단, Dribbble처럼 시각적 장식 자체가 목적이 되어서는 안 된다.

HireMe의 visual system은 항상 **작업 결과물을 돋보이게 하기 위한 frame**이어야 한다.

---

## Human

HireMe에서 Agent는 독립적인 AI product가 아니라,

> "이 Designer가 일하는 방식"

의 확장이다.

따라서 Agent 페이지에서는 모델 이름이나 기술 스펙보다 다음을 먼저 보여준다.

- Created by
- Designer portfolio
- What this agent is good at
- How the designer approaches the problem
- Example work
- Designer's note
- Revision philosophy

즉, 사용자는 Agent를 고르는 것이 아니라 **디자이너의 판단 방식을 고른다.**

---

# Colors

## Color Philosophy

HireMe의 컬러 시스템은 두 계층으로 나눈다.

1. **HireMe Brand Layer**
2. **Agent Identity Layer**

플랫폼 전체는 하나의 강한 Brand Accent를 유지하되, 각 Designer Agent는 독립적인 Accent Color를 가질 수 있다.

이 구조는 "하나의 플랫폼 안에 서로 다른 크리에이터들이 존재한다"는 HireMe의 marketplace 구조를 시각적으로 표현한다.

---

## Brand & Accent

### HireMe Blue

`{colors.primary}` — **#465CFF**

HireMe의 대표 컬러.

전형적인 SaaS blue보다 조금 더 vivid하고 creative한 cobalt 계열을 사용한다.

### Usage

- Primary CTA
- Selected state
- Active navigation
- Key underline
- Brand mark
- Important interaction feedback

### Principle

Blue는 UI 전체 배경으로 사용하지 않는다.

브랜드 컬러는 **attention signal**로 작동해야 한다.

한 화면에서 Blue가 차지하는 면적은 전체의 약 10~15% 이하를 권장한다.

---

## Surface

### Warm Canvas

`{colors.canvas}` — **#F6F3EC**

완전한 white 대신 약간 따뜻한 ivory를 사용한다.

디자인 포트폴리오, editorial publication, printed paper와 비슷한 인상을 주며, 차가운 AI SaaS 느낌을 줄인다.

### White Surface

`{colors.surface}` — **#FFFFFF**

카드, modal, input처럼 information layer가 필요한 경우 사용한다.

### Soft Gray

`{colors.surface-muted}` — **#ECE9E2**

Filter section, inactive state, metadata grouping처럼 secondary surface에 사용한다.

---

## Text

### Ink

`{colors.ink}` — **#161616**

완전한 black보다 약간 부드러운 near-black.

### Secondary Text

`{colors.text-secondary}` — **#6F6B64**

Description, metadata, supporting copy.

### Muted Text

`{colors.text-muted}` — **#9A968F**

Timestamp, minor label, disabled state.

---

## Agent Accent Family

Agent별 identity를 위해 다음 palette를 기본 Accent family로 제공한다.

### Lime

`{colors.agent-lime}` — **#C8FF52**

Experimental, playful, fashion, Gen-Z visual agent.

### Lavender

`{colors.agent-lavender}` — **#B9AEFF**

Branding, illustration, character design.

### Coral

`{colors.agent-coral}` — **#FF8A75**

Food, lifestyle, social content.

### Sky

`{colors.agent-sky}` — **#A8D8FF**

Product, technology, presentation, clean visual.

### Butter

`{colors.agent-butter}` — **#FFE79A**

Editorial, packaging, warm lifestyle.

### Principle

Agent Accent는 브랜드를 대체하지 않는다.

- HireMe Blue = Platform action
- Agent Color = Creator identity

이 역할을 명확히 분리한다.

---

# Typography

## Font Direction

HireMe는 **Editorial + Product UI**의 중간에 위치해야 한다.

따라서 하나의 sans-serif만 사용하는 일반 SaaS typography보다, Display와 UI typography의 역할을 구분하는 것이 좋다.

### Display

Recommended:
- Geist / Inter Display / Helvetica Neue
- Weight 500–700
- Tight tracking

큰 문장이나 campaign-level message에 사용한다.

예:

> AI can make 98%.  
> Taste makes the last 2%.

### UI Sans

Recommended:
- Inter
- Geist Sans
- Pretendard

Navigation, button, metadata, body copy.

한국어/영어 혼용이 많기 때문에 Pretendard 기반으로 시작하는 것도 현실적이다.

---

## Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---:|---:|---:|---|
| `{typography.display-xl}` | 64px | 600 | 1.02 | Homepage statement |
| `{typography.display}` | 48px | 600 | 1.05 | Section hero |
| `{typography.heading-1}` | 36px | 600 | 1.15 | Page title |
| `{typography.heading-2}` | 28px | 600 | 1.2 | Section title |
| `{typography.heading-3}` | 20px | 600 | 1.3 | Card / Agent title |
| `{typography.body-lg}` | 18px | 400 | 1.55 | Intro copy |
| `{typography.body}` | 16px | 400 | 1.55 | Default UI copy |
| `{typography.body-sm}` | 14px | 400 | 1.5 | Metadata |
| `{typography.caption}` | 12px | 500 | 1.4 | Labels |
| `{typography.button}` | 14px | 600 | 1.0 | Buttons |

---

## Typography Principles

### Large copy should feel editorial

HireMe의 주요 문장은 "기능 설명"이 아니라 **point of view**처럼 보여야 한다.

Bad:

> AI 디자인 에이전트를 찾아보세요.

Better:

> Find a designer's way of thinking.

---

### Avoid overusing bold

모든 요소를 600~700 weight로 설정하는 SaaS 스타일을 피한다.

Hierarchy는 weight보다:

- size
- spacing
- placement
- contrast

로 만든다.

---

# Layout

## Layout Philosophy

HireMe의 UI는 **catalog가 아니라 gallery + marketplace**에 가깝게 설계한다.

좋은 작업을 많이 보여주는 것보다, 사용자가 **좋은 선택을 할 수 있게 만드는 것**이 중요하다.

---

## Container

Desktop:

- Max width: 1280–1440px
- Content width: 1180–1280px
- Side margin: 48–80px

Wide editorial sections는 viewport 전체 폭을 사용할 수 있다.

---

## Grid

### Agent Discovery

12-column grid 기반.

Agent card는 동일한 크기로 반복하기보다 다음을 허용한다.

- Featured: 6 columns
- Standard: 4 columns
- Compact: 3 columns

이를 통해 marketplace가 단순한 database grid처럼 보이는 것을 피한다.

---

## Whitespace

HireMe의 whitespace는 기능적이다.

공간은 다음을 위해 사용한다.

- Agent 간 personality 분리
- Hero message 강조
- Work preview 집중
- 선택 피로 감소

카드의 수를 늘리는 대신 **카드 사이의 breathing room**을 유지한다.

---

## Border Radius

| Token | Value | Use |
|---|---:|---|
| `{rounded.sm}` | 6px | tags / tiny control |
| `{rounded.md}` | 10px | inputs |
| `{rounded.lg}` | 16px | Agent card |
| `{rounded.xl}` | 24px | Hero visual / showcase |
| `{rounded.full}` | 999px | chips / avatar |

너무 둥근 "friendly SaaS" 느낌은 피한다.

Agent card는 12–16px 정도로 제한한다.

---

# Elevation & Depth

HireMe는 heavy shadow보다 **surface contrast**를 사용한다.

| Level | Treatment | Use |
|---|---|---|
| 0 | No shadow | Base canvas |
| 1 | 1px subtle border | Inputs / secondary card |
| 2 | Soft surface contrast | Agent card |
| 3 | Minimal shadow | Modal / floating menu |

### Principle

Portfolio work 자체가 이미 시각적으로 복잡하기 때문에 UI decoration은 최대한 조용해야 한다.

---

# Image Direction

HireMe에서 가장 중요한 visual asset은 UI가 아니라 **Designer output**이다.

따라서 이미지 자체에 브랜드 룩을 강제로 입히지 않는다.

대신 frame을 통일한다.

### Principles

- Preserve original artwork ratio
- Do not add unnecessary gradient overlays
- Do not crop aggressively
- Use neutral canvas
- Always credit the Designer
- Before / After / Process를 적극적으로 보여준다

---

# Components

## Agent Card

HireMe의 핵심 component.

Agent Card는 "AI tool card"가 아니라 **designer mini portfolio**처럼 보여야 한다.

### Structure

1. Work preview
2. Agent name
3. Designer name
4. One-line specialty
5. Agent accent
6. Price / usage model
7. Example task

### Example

**MOMO — Food Image Director**

Created by Minji Kim

> Makes AI-generated food look photographed, not generated.

From $8 / generation

---

## Designer Identity

Agent보다 Designer identity가 항상 연결되어 있어야 한다.

### Designer Badge

- Avatar
- Name
- Specialty
- Verified mark
- Portfolio link

Agent detail의 상단 또는 Agent Card 하단에 노출한다.

---

## Agent Hero

Agent detail page의 첫 화면.

### Left

- Agent name
- Designer
- Description
- Best for
- Hire / Try CTA

### Right

- Representative work
- Result carousel
- Before / After

기술 설명은 첫 화면에서 제거한다.

---

## Primary CTA

**Hire this Agent**

`{colors.primary}` fill.

HireMe에서 핵심 action은 "Generate"보다 **Hire**라는 언어를 사용하는 것이 중요하다.

이는 AI tool이 아니라 designer marketplace라는 mental model을 만든다.

---

## Secondary CTA

- View Work
- Meet the Designer
- Try Example
- See Process

Outlined or text button.

---

## Prompt / Brief Input

일반적인 ChatGPT-style empty textarea를 그대로 사용하지 않는다.

입력창은 **creative brief builder**로 느껴져야 한다.

### Suggested structure

**What are you making?**

- Brand visual
- Character
- Food image
- Presentation
- Social content

**What should it feel like?**

Reference upload + tags

**What matters most?**

Free text

이후 Agent가 필요한 질문만 추가한다.

---

## Agent Result

Result page는 단순한 "generated image"가 아니라 **delivery page**처럼 구성한다.

### Structure

- Main output
- Designer Agent's note
- Variations
- Revision
- Download / export
- What was changed

---

# UX Principles

## 1. Hire, Don't Prompt

HireMe의 가장 중요한 UX principle.

사용자는 AI에게 무엇을 시킬지 고민하는 사람이 아니라,

> **어떤 전문가에게 맡길지 결정하는 사람**

이 되어야 한다.

따라서 첫 행동은 prompt 작성이 아니라 **Agent 선택**이다.

Bad:

> What do you want to generate?

Better:

> Who should work on this?

---

## 2. Show Taste Before Features

Agent의 성능을 기능 목록으로 설명하지 않는다.

사용자는 먼저 결과물을 보고 판단한다.

Priority:

1. Work
2. Style
3. Designer
4. Use case
5. Process
6. Technical details

---

## 3. Reduce Prompt Burden

전문가 Agent의 가치 중 하나는 사용자가 좋은 prompt를 만들지 않아도 된다는 것이다.

사용자는 rough request만 제공한다.

Agent가:

- 필요한 질문을 하고
- reference를 요청하고
- constraints를 정리하고
- 결과를 생성한다.

즉, prompt engineering을 사용자에게 전가하지 않는다.

---

## 4. Make the Expert Visible

AI Agent가 foreground에 있고 Designer가 숨겨지면 HireMe의 차별점이 사라진다.

모든 주요 surface에서 다음을 보여준다.

> Created by [Designer]

Agent는 Designer의 product다.

---

## 5. Trust Through Process

특히 디자인 작업에서는 "왜 이런 결과가 나왔는가"가 중요하다.

Agent Result에 간단한 rationale을 제공한다.

예:

> I reduced the saturation and moved the key light to the left because your reference set consistently used soft daylight rather than studio lighting.

이 설명은 사용자의 신뢰를 높이고 Designer의 전문성도 보여준다.

---

## 6. Revision Is Part of the Product

디자인은 한 번의 generation으로 끝나지 않는다.

따라서 revision은 error handling이 아니라 **core flow**다.

Revision interface:

- Make it warmer
- More minimal
- Closer to reference 2
- Keep composition, change style
- Ask for revision

처럼 디자인 언어로 구성한다.

---

## 7. Discovery by Intent, Not Category

일반 marketplace:

> Logo / Illustration / UI / Branding

HireMe:

> I need my food to look real  
> I need a character consistent across scenes  
> I need my slides to look investor-ready  
> I need a campaign visual in our brand style

즉, 사용자의 **problem statement**에서 Agent를 발견하게 한다.

---

# Core UX Flow

## User Side

### 01 — Intent

사용자가 자신이 원하는 작업을 선택한다.

> What are you trying to make?

---

### 02 — Discover

HireMe가 적합한 Agent를 보여준다.

각 Agent마다:

- Output preview
- Designer
- Best for
- Price
- Average delivery / iteration

---

### 03 — Evaluate

Agent detail에서 실제 작업물을 먼저 본다.

> Can this agent make what I want?

을 10초 안에 판단할 수 있어야 한다.

---

### 04 — Brief

사용자는 간단한 요청과 reference를 입력한다.

Agent가 필요한 경우 추가 질문을 한다.

---

### 05 — Hire

가격과 deliverable을 확인하고 Agent를 실행한다.

---

### 06 — Review

결과 + Agent rationale 제공.

---

### 07 — Revise

사용자는 자연어 또는 preset으로 수정한다.

---

### 08 — Deliver

최종 output을 export한다.

---

# Designer UX

HireMe는 사용자 UX뿐 아니라 Designer UX가 매우 중요하다.

Designer가 Agent를 쉽게 만들 수 없다면 marketplace가 성장하지 않는다.

---

## Designer Flow

### 01 — Define Expertise

> What are you exceptionally good at?

Designer가 자신의 강점을 정의한다.

---

### 02 — Add Examples

Portfolio 또는 representative work를 업로드한다.

---

### 03 — Teach Workflow

Designer의 작업 과정을 step으로 만든다.

예:

1. Brief 분석
2. Reference 분류
3. Composition 결정
4. Generation
5. Quality check
6. Revision

---

### 04 — Define Judgment

HireMe가 가장 중요하게 받아야 하는 영역.

> What makes an output unacceptable?

예:

- Food texture looks plastic
- Lighting is physically inconsistent
- Brand blue changes
- Character proportions drift

이러한 negative criteria가 Agent quality를 만든다.

---

### 05 — Test Agent

Designer가 example brief를 통해 자신의 Agent를 테스트한다.

---

### 06 — Publish

- Name
- Thumbnail
- Description
- Pricing
- Supported tasks
- Revision policy

를 설정하고 marketplace에 공개한다.

---

# Marketplace UX

## Homepage

Homepage는 search engine보다 **creative storefront**처럼 구성한다.

Recommended sections:

1. Hero statement
2. What are you making?
3. Featured Agents
4. Created by real designers
5. Agent stories / case studies
6. Become a creator

---

## Search

Search bar placeholder:

> What do you need designed?

Search 결과는 keyword match보다 intent match를 우선한다.

---

## Agent Detail

Recommended order:

1. Hero work
2. Agent proposition
3. Created by Designer
4. Example results
5. Best for / Not for
6. How it works
7. Pricing
8. Reviews
9. Hire CTA

---

# Do's and Don'ts

## Do

- Use HireMe Blue only for platform-level actions.
- Let Agent artwork carry most of the visual richness.
- Keep the canvas warm and editorial.
- Show Designer identity prominently.
- Treat Agent pages like mini portfolios.
- Design the brief experience around questions, not prompt engineering.
- Make revision a first-class workflow.
- Curate fewer, better options.
- Use large typography for brand statements.
- Explain why an Agent is recommended.

---

## Don't

- Don't make HireMe look like another chatbot wrapper.
- Don't put a giant textarea on the homepage.
- Don't lead Agent pages with model / LLM / workflow technical specs.
- Don't allow every Agent to completely redefine the platform UI.
- Don't use too many gradients or glassmorphism effects.
- Don't fill every empty area with cards.
- Don't hide the Designer behind the Agent.
- Don't describe every Agent with generic phrases such as "AI-powered", "fast", or "high quality".
- Don't make users learn prompt engineering.
- Don't treat revision as regeneration from scratch.

---

# Brand Summary

## Visual

**Editorial Creative Marketplace**

Warm canvas  
Bold typography  
Cobalt accent  
Designer work as the hero  
Minimal UI decoration

## Emotional

**Curated · Creative · Human**

## Product Principle

> The AI does the generation.  
> The expert defines what good looks like.

## UX Principle

> Don't ask users to prompt better.  
> Help them hire better taste.
