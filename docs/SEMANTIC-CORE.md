# Semantic core (L33)

This document has two layers, and they are maintained differently:

- **Generated layer — the facts.** One table per route family, rebuilt from `site/content-facts.json` and the built `site/dist/` by `node scripts/semantic-core.mjs` (run from `site/`). It never drifts because it is never hand-edited: regeneration rewrites only the block between the `semantic-core` markers below. The Opening column reuses the content gate's own query rules (`h1-query`, `query-opening` in `site/scripts/content-rows.mjs`), so ✓ here means the same thing as green there.
- **Hand-authored layer — the why.** Everything below the markers: why each family exists, and the mapping of the 30 buyer prompts (PRD §17.3) to the route that must win each one, with the passage that answers it and the business reason. Regeneration leaves all of it intact.

Drift protection is a real doc-diff gate (L48). `node scripts/semantic-core.mjs --check` recomputes the generated table in memory from the same inputs `node scripts/semantic-core.mjs` regenerates from, and fails — naming every drifted route — if that differs from the committed block below; a stale `docs/SEMANTIC-CORE.md` cannot pass CI, because the same check rides `gate:content` (`site/scripts/content-gate.mjs` invoking `checkFindings()`), and `gate:content` is a CI step (L36). The same run also verifies: every `targetQuery` row maps to a built route and every gated built route has a row (no orphans either way); no two routes declare the same target query, ignoring case and spacing (`duplicate-query`); every built `<title>` follows its family's title grammar; every buyer-prompt "Must win" route below is actually built; every buyer-prompt "Passage" quote is still a literal substring of its cited route's rendered text; and every buyer-prompt GAP absence-claim registered in `ABSENCE_CLAIMS` still holds. Route coverage: **102 of 105** built routes carry a generated row below; the remaining 3 are intentionally ungated utility routes, documented with their reason in the table right after this paragraph.

### Ungated utility routes — the other 3 of 105

| Route         | Why it carries no generated row                                                                                                                                                                                   | Robots              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `/404`        | Error page. There is no target query and no citable content — nothing an answer engine should ever cite here                                                                                                      | `noindex, nofollow` |
| `/search`     | Client-side search shell. The results a visitor sees are built in the browser from the static search index, not server-rendered, so there is no fixed body text for a title/meta/H1/target-query grammar to check | `noindex, follow`   |
| `/styleguide` | Internal dev-only component reference, not a page written to answer a buyer query                                                                                                                                 | `noindex, nofollow` |

## Generated layer — the facts

<!-- semantic-core:begin generated -->
### static (17)

title `{page name} — meshin.co` · meta: value-proposition clause naming the offer and the buyer · body intent: answer the query, then route to the next step

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/` | fractional chief ai officer | Fractional Chief AI Officer — meshin.co | Fractional Chief AI Officer for 30–300 person companies: governance that passes enterprise procurement, and agentic systems shipped to production with evals. | A Fractional Chief AI Officer you can name on the org chart. | 22 | ✓ |
| `/about` | dmitri meshin | About Dmitri Meshin — meshin.co | Dmitri Meshin is a platform engineer working as a Fractional Chief AI Officer for companies of 30 to 300 people. Remote worldwide. | Dmitri Meshin | 22 | ✓ |
| `/ai-policy` | ai policy | AI acceptable-use policy — meshin.co | My own acceptable-use policy for AI systems: what data may reach a vendor, what may not, and who decides. | My AI acceptable-use policy | 22 | ✓ |
| `/approach` | how a fractional ai officer works | How a Fractional AI Officer works — meshin.co | How a Fractional AI Officer works: the six things that decide whether an AI initiative reaches production, and the order I work through them. | How a Fractional AI Officer works with your team | 22 | ✓ |
| `/blog` | ai governance writing | AI governance writing — meshin.co | AI governance writing: notes on getting AI systems past security review and into production, written for founders and boards. | Writing on AI governance | 23 | ✓ |
| `/case-studies` | fractional chief ai officer case study | Fractional Chief AI Officer case study — meshin.co | One Fractional Chief AI Officer case study, not a client case: only.help, my own product, built with the method I use for clients. | Fractional chief AI officer case study | 22 | ✓ |
| `/contact` | book an ai leadership call | Contact: book an AI leadership call — meshin.co | Book an AI leadership call: a 30-minute fit call, or email hello@meshin.co. Remote worldwide, on site when the trip is worth it. | Book an AI leadership call | 23 | ✓ |
| `/faq` | fractional chief ai officer questions | Fractional Chief AI Officer questions — meshin.co | Fractional Chief AI Officer questions answered: what the role does, what each offer produces, and how AI risk gets recorded and signed off. | Fractional Chief AI Officer questions, answered | 47 | ✓ |
| `/glossary` | ai governance glossary | AI governance glossary — meshin.co | An AI governance glossary: plain definitions of the terms, standards and laws that come up in security reviews and board meetings. | AI governance glossary | 54 | ✓ |
| `/imprint` | imprint | Imprint — meshin.co | Imprint for meshin.co: who is responsible for this site, how to reach them by email, where they work from, and what it is hosted on. | Imprint | 22 | ✓ |
| `/now` | what i am working on now | What I am working on now — meshin.co | What I am working on now: a dated log of what I am building and studying, newest first. A line is added when something happens and never edited after. | What I am working on now | 22 | ✓ |
| `/pricing` | fractional chief ai officer cost | Pricing: what a Fractional Chief AI Officer costs — meshin.co | Fractional Chief AI Officer cost: two-week Assessment, 90-Day Sprint or monthly Retainer. Fixed, no hourly billing, every fee in writing before work starts. | What a Fractional Chief AI Officer costs | 25 | ✓ |
| `/privacy` | privacy policy | Privacy policy — meshin.co | Privacy policy for meshin.co: what this site collects, which is almost nothing, and what happens to an email you send me. | Privacy policy | 22 | ✓ |
| `/resources` | ai governance templates | AI governance templates and checklists — meshin.co | Open AI governance templates and checklists: register, acceptable-use policy, data classification, vendor questionnaire. | AI governance templates | 22 | ✓ |
| `/security` | security practices | Security practices — meshin.co | Security practices for meshin.co: how this site is built and served, how client data is handled, and where to report a vulnerability. | Security practices for client work | 23 | ✓ |
| `/services` | fractional ai leadership services | Fractional AI leadership services — meshin.co | Fractional AI leadership services in three offers: a two-week assessment, a 90-day production sprint or a retainer, run by a Fractional Chief AI Officer. | Fractional AI leadership services | 22 | ✓ |
| `/terms` | terms | Terms — meshin.co | What this site is, why no price appears on it, and which terms actually govern an engagement. | Terms. | 22 | ✓ |

### service (3)

title `{offer name} — meshin.co` · meta: one outcome sentence: what ships, in what timeframe · body intent: offer → deliverables → fit → CTA

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/services/90-day-production-sprint` | 90-day production sprint | 90-Day Production Sprint — meshin.co | A 90-day sprint that puts one agentic workflow into production with evals in CI, tracing, a named owner, and a rollback path. | 90-Day Production Sprint | 23 | ✓ |
| `/services/ai-readiness-and-risk-assessment` | ai readiness assessment | AI Readiness & Risk Assessment — meshin.co | A two-week AI readiness and risk assessment for companies of 30 to 300 people, ending in a memo your board can act on, gap list included. | AI Readiness & Risk Assessment | 24 | ✓ |
| `/services/fractional-caio-retainer` | fractional caio retainer | Fractional CAIO Retainer — meshin.co | Fractional CAIO retainer: one or two days a week as your named AI officer, with procurement answers, design reviews, board updates and a handover plan. | Fractional CAIO Retainer | 22 | ✓ |

### resource (7)

title `{artifact name} — meshin.co` · meta: one sentence naming the artifact and what you do with it · body intent: what it is → what is inside → how to use it

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/resources/adoption-telemetry-dashboard-template` | adoption telemetry dashboard template | Adoption Telemetry Dashboard Template — meshin.co | An adoption telemetry dashboard template: eight panels, each with its question, data source and the decision it supports. | Adoption Telemetry Dashboard Template | 26 | ✓ |
| `/resources/agent-evals-ci-starter` | agent evals ci starter | Agent Evals CI Starter — meshin.co | A starter CI pipeline for agent evals. It runs on every pull request and blocks a bad merge before it ships, using a plain YAML case format. | Agent Evals CI Starter | 24 | ✓ |
| `/resources/ai-governance-starter-kit` | ai governance starter kit | AI Governance Starter Kit — meshin.co | AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire. | AI Governance Starter Kit | 26 | ✓ |
| `/resources/ai-readiness-scorecard` | ai readiness scorecard | AI Readiness Scorecard — meshin.co | A five-axis AI readiness scorecard you score yourself in an afternoon: strategy, data, delivery, people, and governance. | AI Readiness Scorecard | 24 | ✓ |
| `/resources/build-vs-buy-ai-kit` | build vs buy ai kit | Build vs Buy AI Kit — meshin.co | The build vs buy AI kit: a one-page worksheet of the six criteria I work through before recommending either path, and how to score them. | Build vs Buy AI Kit | 26 | ✓ |
| `/resources/handover-playbook` | handover playbook | Handover Playbook — meshin.co | The Handover Playbook is six fill-in tables for moving AI leadership from an outside lead to a named owner, from the test to a later check. | Handover Playbook | 28 | ✓ |
| `/resources/llm-gateway-governance-config` | llm gateway governance config | LLM Gateway Governance Config — meshin.co | A governance config for an LLM gateway. It decides who may call which model, what gets redacted, how long logs are kept and the rate and fallback rules. | LLM Gateway Governance Config | 26 | ✓ |

### case-study (1)

title `{client} — {engagement} — meshin.co` · meta: how the system went from demo to production · body intent: problem → approach → outcome

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/case-studies/only-help-agentic-support` | agentic support triage | only.help — agentic support triage, on my own product — meshin.co | An agentic support triage workflow that went from a demo notebook to a production path with evals in CI and a named owner. | only.help — agentic support triage, on my own product | 23 | ✓ |

### article (8)

title `{short answer sentence} — meshin.co` · meta: the shortAnswer sentence, uncut · body intent: problem → mechanism → fix → takeaways

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/adoption-telemetry-measuring-if-ai-is-actually-used` | adoption telemetry for ai tools | Adoption telemetry for AI tools: what a trial found — meshin.co | In METR's 2025 trial, 16 developers believed AI made them 20% faster. Tasks took 19% longer with AI allowed. METR now marks that result out of date. | Adoption telemetry for AI tools: what a trial found | 42 | ✓ |
| `/blog/ai-acceptable-use-policy-for-a-50-person-company` | ai acceptable use policy | What actually belongs in an AI acceptable use policy — meshin.co | What a working AI acceptable use policy has to decide, what it must refuse to do, and how a company of 30 to 300 people gets staff to follow it. | What actually belongs in an AI acceptable use policy | 31 | ✓ |
| `/blog/evals-in-ci-for-llm-agents` | evals in ci without a golden answer | Evals in CI for LLM agents, without a golden answer — meshin.co | How to build an eval set from production traffic, score an LLM agent without a golden answer, and fail a merge in CI when it regresses. | Evals in CI for LLM agents, without a golden answer | 29 | ✓ |
| `/blog/handing-over-ai-leadership-to-an-internal-owner` | how to hand over ai leadership to internal team | How to hand over AI leadership to an internal team — meshin.co | How to hand over AI leadership in steps that end in a test: what moves, who takes the role and how to tell it worked. | How to hand over AI leadership to an internal team | 36 | ✓ |
| `/blog/how-to-build-an-ai-system-register-in-a-week` | ai system register | How to build an AI system register in a week — meshin.co | A step-by-step way to build an AI system register in a week without buying a tool, so a security reviewer gets the document they ask for first. | How to build an AI system register in a week | 32 | ✓ |
| `/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company` | ai operating model for mid-size company | How to choose an AI operating model for a mid-size company — meshin.co | How to choose an operating model for AI work in a mid-size company, starting from what the law requires and what the evidence supports. | How to choose an AI operating model for a mid-size company | 37 | ✓ |
| `/blog/multi-agent-reference-architecture-in-production` | multi-agent reference architecture production | Multi-agent reference architecture in production — meshin.co | What the sources say about multi-agent systems in production: where vendors agree, where they split, and what the research did not find. | Multi-agent reference architecture in production | 40 | ✓ |
| `/blog/why-your-ai-pilot-never-reached-production` | ai pilot never reached production | Why your AI pilot never reached production — meshin.co | Most AI pilots stall on ownership, data rules and a missing outcome metric, not the model. Here is what has to be true before one reaches production. | Why your AI pilot never reached production | 28 | ✓ |

### blog-category (4)

title `{category name} — meshin.co` · meta: what the category covers, scoped to the 30–300 person buyer · body intent: curated list with one-line stakes per entry

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/category/agentic-architecture` | agentic architecture articles | Agentic architecture articles — meshin.co | Articles on agentic architecture for production: evals in CI, tracing, cost ceilings and a rollback path for agent systems. | Agentic architecture articles | 22 | ✓ |
| `/blog/category/executive` | ai for boards | AI for boards — meshin.co | AI for boards is accountability, not literacy: what you are on the hook for, what to ask for in writing, and what not to ask for. | AI for boards | 22 | ✓ |
| `/blog/category/governance` | ai governance articles | AI governance articles — meshin.co | Articles on AI governance for companies of 30 to 300 people: the register, acceptable-use policy, data classification and a named owner. | AI governance articles | 22 | ✓ |
| `/blog/category/operating-model` | ai operating model articles | AI operating model articles — meshin.co | Articles on the operating model for AI work in companies of 30 to 300 people: who chooses, who reviews, who runs it. The glossary holds the definition. | AI operating model articles | 22 | ✓ |

### tag-index (1)

title `Tags — meshin.co` · meta: what tags exist and how many articles carry each one · body intent: browse the tag list, then route into one tag

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/tags` | tags | Tags — meshin.co | The tags used across the writing, with how many articles carry each one. | Tags | 34 | ✓ |

### tag (12)

title `{tag name} posts — meshin.co` · meta: all posts tagged {tag}, newest first · body intent: thin archive list; route straight to the tagged articles

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/tag/acceptable-use-policy` | acceptable use policy posts | Acceptable use policy posts — meshin.co | All posts tagged Acceptable use policy, newest first. | Acceptable use policy posts | 23 | ✓ |
| `/blog/tag/agentic-architecture` | agentic architecture posts | Agentic architecture posts — meshin.co | All posts tagged Agentic architecture, newest first. | Agentic architecture posts | 23 | ✓ |
| `/blog/tag/ai-governance` | ai governance posts | AI governance posts — meshin.co | All posts tagged AI governance, newest first. | AI governance posts | 23 | ✓ |
| `/blog/tag/ai-pilots` | ai pilots posts | AI pilots posts — meshin.co | All posts tagged AI pilots, newest first. | AI pilots posts | 23 | ✓ |
| `/blog/tag/ai-register` | ai register posts | AI register posts — meshin.co | All posts tagged AI register, newest first. | AI register posts | 23 | ✓ |
| `/blog/tag/eu-ai-act` | eu ai act posts | EU AI Act posts — meshin.co | All posts tagged EU AI Act, newest first. | EU AI Act posts | 23 | ✓ |
| `/blog/tag/evals-in-ci` | evals in ci posts | Evals in CI posts — meshin.co | All posts tagged Evals in CI, newest first. | Evals in CI posts | 23 | ✓ |
| `/blog/tag/llm-as-judge` | llm as judge posts | LLM as judge posts — meshin.co | All posts tagged LLM as judge, newest first. | LLM as judge posts | 23 | ✓ |
| `/blog/tag/policy-enforcement` | policy enforcement posts | Policy enforcement posts — meshin.co | All posts tagged Policy enforcement, newest first. | Policy enforcement posts | 23 | ✓ |
| `/blog/tag/production-readiness` | production readiness posts | Production readiness posts — meshin.co | All posts tagged Production readiness, newest first. | Production readiness posts | 23 | ✓ |
| `/blog/tag/security-review` | security review posts | Security review posts — meshin.co | All posts tagged Security review, newest first. | Security review posts | 23 | ✓ |
| `/blog/tag/shadow-ai` | shadow ai posts | Shadow AI posts — meshin.co | All posts tagged Shadow AI, newest first. | Shadow AI posts | 23 | ✓ |

### term (32)

title `What is {term}? — meshin.co` · meta: the definition sentence · body intent: definition → why it matters → adjacent terms

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/glossary/agentic-workflow` | agentic workflow | What is an agentic workflow? — meshin.co | An agentic workflow is a task where one or more AI agents plan steps, call tools and choose the next move without a person's approval. | Agentic workflow | 22 | ✓ |
| `/glossary/ai-governance` | ai governance | What is AI governance? — meshin.co | AI governance is the decisions, roles and controls a company uses to manage the risk of the AI systems it builds or buys. | AI governance | 22 | ✓ |
| `/glossary/ai-impact-assessment` | ai impact assessment | What is an AI impact assessment? — meshin.co | An AI impact assessment is a written check, before a high-risk system goes live, of who it affects and whether they can challenge its decision. | AI impact assessment | 24 | ✓ |
| `/glossary/ai-management-system` | ai management system | What is an AI management system? — meshin.co | An AI management system is the recurring set of policies, roles and reviews a company runs to govern its AI, not a one-off risk assessment. | AI management system | 23 | ✓ |
| `/glossary/ai-operating-model` | ai operating model | What is an AI operating model? — meshin.co | An AI operating model names who chooses, reviews and runs a company's AI work. What it covers has no standard definition, so check which one is in use. | AI operating model | 23 | ✓ |
| `/glossary/ai-register` | ai register | What is an AI register? — meshin.co | An AI register is a company's own inventory of every AI system it builds, buys or uses, naming its owner and how risky it is. | AI register | 22 | ✓ |
| `/glossary/conformity-assessment` | conformity assessment | What is a conformity assessment? — meshin.co | A conformity assessment proves a high-risk AI system meets the EU AI Act before sale. Either the provider or an outside body runs it. | Conformity assessment | 23 | ✓ |
| `/glossary/data-classification` | data classification | What is data classification? — meshin.co | Data classification is labelling data by sensitivity, such as public, internal or restricted, before deciding what may reach an AI tool. | Data classification | 23 | ✓ |
| `/glossary/dpia` | dpia | What is a DPIA? — meshin.co | A DPIA, or data protection impact assessment, is a written GDPR check of privacy risk before high-risk personal-data processing begins. | DPIA | 23 | ✓ |
| `/glossary/eu-ai-act` | eu ai act | What is the EU AI Act? — meshin.co | The EU AI Act is an EU regulation that sorts AI systems into risk tiers and sets legal obligations, heaviest for high-risk systems. | EU AI Act | 22 | ✓ |
| `/glossary/evals` | evals | What are evals? — meshin.co | Evals are repeatable tests that score an AI system's output against fixed examples, run before release and after every change. | Evals | 22 | ✓ |
| `/glossary/guardrails` | guardrails | What are guardrails in an AI system? — meshin.co | Guardrails are code checks on what a model responds to, what it can say and what it can do, not rules typed into a prompt. | Guardrails | 23 | ✓ |
| `/glossary/hallucination-rate` | hallucination rate | What is a hallucination rate? — meshin.co | A hallucination rate is the share of a model's answers that are confidently wrong, measured against real questions with known correct answers. | Hallucination rate | 23 | ✓ |
| `/glossary/high-risk-ai-system` | high-risk ai system | What makes an AI system high-risk? — meshin.co | A high-risk AI system is one the EU AI Act puts under its heaviest duties, through product-safety law or use cases like hiring or credit. | High-risk AI system | 24 | ✓ |
| `/glossary/human-in-the-loop` | human-in-the-loop | What is human-in-the-loop? — meshin.co | Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, not the system acting alone. | Human-in-the-loop | 22 | ✓ |
| `/glossary/human-oversight` | human oversight | What does human oversight require under the EU AI Act? — meshin.co | Human oversight is the EU AI Act duty that a person assigned to watch a high-risk system can actually understand it and stop it. | Human oversight | 23 | ✓ |
| `/glossary/iso-iec-42001` | iso/iec 42001 | What is ISO/IEC 42001? — meshin.co | ISO/IEC 42001 is the first international, certifiable standard for the management system a company runs to govern its AI. | ISO/IEC 42001 | 24 | ✓ |
| `/glossary/llm-gateway` | llm gateway | What is an LLM gateway? — meshin.co | An LLM gateway is a single service every call to a language model passes through, for authentication, logging, rate limits and content filtering. | LLM gateway | 23 | ✓ |
| `/glossary/mcp` | model context protocol | What is the Model Context Protocol (MCP)? — meshin.co | The Model Context Protocol (MCP) connects AI agents to tools and data, but cannot enforce consent, data privacy or tool safety at the protocol level. | Model Context Protocol | 27 | ✓ |
| `/glossary/model-card` | model card | What is a model card? — meshin.co | A model card is a short document that a model's maker publishes about the model's intended use, its performance and where not to use it. | Model card | 23 | ✓ |
| `/glossary/model-provenance` | model provenance | What is model provenance? — meshin.co | Model provenance is a traceable record of where a model comes from - its base model, its training data, and the licence covering both. | Model provenance | 24 | ✓ |
| `/glossary/nist-ai-rmf` | nist ai rmf | What is the NIST AI RMF? — meshin.co | The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework for managing AI risk across a system's whole lifecycle. | NIST AI RMF | 22 | ✓ |
| `/glossary/observability` | observability | What is observability for an AI system? — meshin.co | Observability means seeing exactly what a user asked a live AI system, what it did and what it answered, for any one case. | Observability | 24 | ✓ |
| `/glossary/post-market-monitoring` | post-market monitoring | What is post-market monitoring under the EU AI Act? — meshin.co | Post-market monitoring is the EU AI Act duty to keep collecting real-world data on a high-risk system after it ships, not just before. | Post-market monitoring | 23 | ✓ |
| `/glossary/prompt-injection` | prompt injection | What is prompt injection? — meshin.co | Prompt injection is text, typed directly or hidden in a document a model reads, that gets the model to follow it as an instruction. | Prompt injection | 23 | ✓ |
| `/glossary/provider-vs-deployer` | provider vs deployer | What is the difference between a provider and a deployer? — meshin.co | Provider and deployer are EU AI Act roles - a provider builds or brands a system, a deployer uses it, and the two owe different duties. | Provider vs deployer | 27 | ✓ |
| `/glossary/red-teaming` | red teaming | What is red teaming for an AI system? — meshin.co | Red teaming is deliberately trying to break an AI system the way an attacker would, before they do, to find the failure nobody tested. | Red teaming | 23 | ✓ |
| `/glossary/retrieval-augmented-generation` | retrieval augmented generation | What is retrieval augmented generation? — meshin.co | Retrieval augmented generation, or RAG, has a model look up relevant passages at answer time instead of relying only on its training. | Retrieval augmented generation | 23 | ✓ |
| `/glossary/serious-incident-reporting` | serious incident reporting | What is serious incident reporting under the EU AI Act? — meshin.co | Serious incident reporting is the EU AI Act duty to tell a regulator, fast, when a high-risk system causes real harm or a rights breach. | Serious incident reporting | 23 | ✓ |
| `/glossary/shadow-ai` | shadow ai | What is shadow AI? — meshin.co | Shadow AI is any AI tool staff use for company work without IT or security's knowledge, from an app to a browser extension. | Shadow AI | 22 | ✓ |
| `/glossary/sub-processor` | sub-processor | What is a sub-processor? — meshin.co | A sub-processor is a vendor an AI provider uses behind the scenes to handle a company's data, and GDPR requires permission before it does. | Sub-processor | 23 | ✓ |
| `/glossary/technical-documentation` | technical documentation | What is technical documentation under the EU AI Act? — meshin.co | Technical documentation is the dossier a provider keeps on a high-risk AI system - its purpose, design, data, performance and monitoring plan. | Technical documentation | 24 | ✓ |

### faq-answer (25)

title `{question} — meshin.co` · meta: first sentence of the answer · body intent: direct answer → mechanism → next step

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/faq/are-models-trained-on-our-customer-data` | are models trained on our customer data? | Are models trained on our customer data? — meshin.co | Are models trained on our customer data? Not by default. I use vendor terms that exclude it from training, and I check them before any tool touches your data. | Are models trained on our customer data? | 22 | ✓ |
| `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system` | can you get us certified to iso/iec 42001, or do you just build a working system? | Can you get us ISO/IEC 42001 certified? — meshin.co | Can you get us certified to ISO/IEC 42001? I build the working system. An accredited body runs the independent audit that grants certification. | Can you get us certified to ISO/IEC 42001, or do you just build a working system? | 23 | ✓ |
| `/faq/can-you-work-with-our-existing-ai-vendor-or-platform` | can you work with our existing ai vendor or platform, or do you bring your own tools? | Can you work with our existing AI vendor or platform? — meshin.co | Can you work with our existing AI vendor or platform, or do you bring your own tools? I work with what you already run. OpenAI, Anthropic, Azure. | Can you work with our existing AI vendor or platform, or do you bring your own tools? | 23 | ✓ |
| `/faq/how-do-you-charge-for-the-work` | how do you charge for the work? | How do you charge for the work? — meshin.co | How do you charge for the work? Three fixed structures, no hourly billing. The Assessment is a fixed fee for the two weeks. | How do you charge for the work? | 23 | ✓ |
| `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off` | how does ai risk get recorded, and who signs it off? | How does AI risk get recorded, and who signs it off? — meshin.co | How does AI risk get recorded, and who signs it off? In an AI register. One line per initiative: its data flows, its risk level, and its owner. | How does AI risk get recorded, and who signs it off? | 23 | ✓ |
| `/faq/how-does-the-retainer-end` | how does the retainer end? | How does the Retainer end? — meshin.co | How does the Retainer end? With a named internal owner in place, not a fading call. The decisions that got made are written down, not quietly dropped. | How does the Retainer end? | 24 | ✓ |
| `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed` | how is a prompt or model change stopped from shipping unnoticed? | What stops a prompt or model change shipping unnoticed? — meshin.co | How is a prompt or model change stopped from shipping unnoticed? Evals in continuous integration. A test set runs on every change. | How is a prompt or model change stopped from shipping unnoticed? | 23 | ✓ |
| `/faq/how-is-cost-per-outcome-measured` | how is cost per outcome measured? | How is cost per outcome measured? — meshin.co | How is cost per outcome measured? On a dashboard built during the Sprint. Total spend on the workflow, model calls included. | How is cost per outcome measured? | 23 | ✓ |
| `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer` | how quickly can you start, and how does availability work for a remote officer? | How quickly can you start as a remote officer? — meshin.co | How quickly can you start, and how does availability work for a remote officer? One client at a time. That is what keeps me reachable: one, or two days a week. | How quickly can you start, and how does availability work for a remote officer? | 22 | ✓ |
| `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer` | is my company too small, or too early, for a fractional chief ai officer? | Too small or too early for a Fractional Chief AI Officer? — meshin.co | Is my company too small, or too early, for a Fractional Chief AI Officer? Size isn't the real test. If you're running pilots that never reach production. | Is my company too small, or too early, for a Fractional Chief AI Officer? | 22 | ✓ |
| `/faq/what-counts-as-in-production-for-the-90-day-sprint` | what counts as 'in production' for the 90-day sprint? | What counts as 'in production' for the 90-day Sprint? — meshin.co | What counts as 'in production' for the 90-day Sprint? Real users, real transactions, a rollback path, someone on call. That is the bar, monitored end to end. | What counts as 'in production' for the 90-day Sprint? | 23 | ✓ |
| `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | what do nist ai rmf, iso/iec 42001 and the eu ai act each require of a company our size? | What do NIST, ISO/IEC 42001 and the EU AI Act require? — meshin.co | What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size? None of the three sets a headcount threshold. | What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size? | 23 | ✓ |
| `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval` | what do we do about tools staff are already using without approval? | What about tools staff use without approval? — meshin.co | What do we do about tools staff are already using without approval? Add unapproved tools to the AI register, not a ban list. | What do we do about tools staff are already using without approval? | 23 | ✓ |
| `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | what does a fractional chief ai officer actually do, and how is that different from an advisor? | What does a Fractional Chief AI Officer do vs an advisor? — meshin.co | What does a Fractional Chief AI Officer actually do, and how is that different from an advisor? I carry the AI register as a named officer. | What does a Fractional Chief AI Officer actually do, and how is that different from an advisor? | 23 | ✓ |
| `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | what does the two-week assessment produce, and is the fee credited if we continue? | What does the two-week Assessment produce? — meshin.co | What does the two-week Assessment produce, and is the fee credited if we continue? The two-week Assessment produces a memo your board can act on. | What does the two-week Assessment produce, and is the fee credited if we continue? | 23 | ✓ |
| `/faq/what-happens-if-the-evals-say-a-workflow-isnt-good-enough` | what happens if the evals say a workflow isn't good enough? | What if the evals say a workflow isn't good enough? — meshin.co | What happens if the evals say a workflow isn't good enough? It does not ship. The Sprint ends with a written account of why it fell short. | What happens if the evals say a workflow isn't good enough? | 23 | ✓ |
| `/faq/what-happens-on-a-fit-call-and-does-it-cost-anything` | what happens on a fit call, and does it cost anything? | What happens on a fit call, and does it cost anything? — meshin.co | What happens on a fit call, and does it cost anything? It costs nothing and runs thirty minutes, booked at cal.com/meshin. | What happens on a fit call, and does it cost anything? | 23 | ✓ |
| `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` | what if the ai we're building goes into a product we sell, not just an internal workflow? | What if our AI goes into a product we sell? — meshin.co | What if the AI we're building goes into a product we sell, not just an internal workflow? I cover products you sell as well as internal workflows. | What if the AI we're building goes into a product we sell, not just an internal workflow? | 23 | ✓ |
| `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead` | what if we already have a data science team or an internal ai lead? | What if we already have a data science team or AI lead? — meshin.co | What if we already have a data science team or an internal AI lead? Your data science team stays exactly where it is. I do not write models, tune pipelines. | What if we already have a data science team or an internal AI lead? | 23 | ✓ |
| `/faq/what-size-of-company-do-you-actually-work-with` | what size of company do you actually work with? | What size of company do you actually work with? — meshin.co | What size of company do you actually work with? Companies of 30 to 300 people, with at least one engineer. Most companies here have run AI pilots. | What size of company do you actually work with? | 22 | ✓ |
| `/faq/whats-the-difference-between-the-assessment-the-sprint-and-the-retainer` | what's the difference between the assessment, the sprint and the retainer? | Assessment, Sprint and Retainer: what is the difference? — meshin.co | What's the difference between the Assessment, the Sprint and the Retainer? Three fixed offers, three stages. The Assessment is two weeks at a fixed fee. | What's the difference between the Assessment, the Sprint and the Retainer? | 23 | ✓ |
| `/faq/who-answers-customer-security-questionnaires` | who answers customer security questionnaires? | Who answers customer security questionnaires? — meshin.co | Who answers customer security questionnaires? I do, as the named officer on record. That is a core part of the Retainer: procurement answers. | Who answers customer security questionnaires? | 23 | ✓ |
| `/faq/who-owns-the-code-and-the-data` | who owns the code and the data? | Who owns the code and the data? — meshin.co | Who owns the code and the data? You own both the code and the data. The code lives in your repositories from the first commit, under your licence. | Who owns the code and the data? | 22 | ✓ |
| `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement` | who owns the frameworks, templates and playbooks built during the engagement? | Who owns the frameworks, templates and playbooks I build? — meshin.co | Who owns the frameworks, templates and playbooks built during the engagement? Everything written for your business belongs to you. | Who owns the frameworks, templates and playbooks built during the engagement? | 23 | ✓ |
| `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` | why hire a fractional officer instead of a full-time head of ai? | Why hire a fractional officer over a full-time head of AI? — meshin.co | Why hire a fractional officer instead of a full-time head of AI? You get a named officer's accountability without the salary, hiring process or idle seat. | Why hire a fractional officer instead of a full-time head of AI? | 23 | ✓ |
<!-- semantic-core:end generated -->

## Hand-authored layer — the why

### Why each family exists

| Family        | Business reason                                                                                  | Source      |
| ------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| static        | Every non-hub query needs an owned front door; the 30-second persona test lands here first       | PRD §6      |
| service       | The three offers are the business; each owns one transactional query and one CTA                 | PRD §4      |
| resource      | Proof artifacts drive the downloads metric (50/mo by month 6) and build the open-source entity   | PRD §5, L10 |
| case-study    | Evidence without invented clients or metrics                                                     | L11         |
| article       | The long-tail top-3 goal (20 queries by month 6, 50 by month 12) lives here                      | PRD §5      |
| blog-category | Clusters internal links around one theme so articles reinforce each other                        | PRD D19     |
| term          | The glossary is the citability surface for answer engines: definitional queries cite definitions | PRD §14     |
| faq-answer    | One question, one URL, one answer — duplication is what answer engines punish hardest            | L20         |

### Family strategy — intent, citable unit, links, cadence, competition

Intent and the "must beat" pages are derived from the target queries each family answers
(`site/content-facts.json`) and the PRD's own competitive landscape read (PRD §4: "AI-transformation
agencies, freelance implementation engineers, GRC platforms — governance + delivery + a named person
in one seat is the shelf no enterprise consultancy fits"). Where a named page is claimed below it was
confirmed against a live web search on 2026-09-14 for the family's representative target query — never
invented.

| Family        | Query intent                                                                                                                                                                                                                                 | Citable unit                                                               | Internal-link targets                                                                                       | Freshness cadence                                                                                                                                     | Must beat                                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| static        | Mixed: navigational for hub/trust pages (`/blog`, `/glossary`, `/resources`, `/faq`, `/imprint`, `/privacy`, `/terms`, `/security`); commercial for `/pricing`, `/contact`, `/services`; informational for `/approach`, `/now`, `/ai-policy` | Short answer (H1-adjacent lead sentence)                                   | Home → `/services`, `/approach`, `/case-studies`, `/faq`, `/contact`; every hub page → its own child routes | Quarterly (PRD §12 Polish Loop + SEO audit); `/now` monthly (PRD §12); any static "Must win" route rechecked monthly with the §17.3 buyer-prompt walk | hatchworks.com/blog/gen-ai/fractional-chief-ai-officer, chiefaiofficer.com, fractionus.com/blog/fractional-chief-ai-officer — rank for "fractional chief ai officer"                                                                          |
| service       | Commercial (transactional)                                                                                                                                                                                                                   | Short answer (offer + timeframe sentence) plus a step list of deliverables | Service → `/pricing`, `/faq/how-do-you-charge-for-the-work`, `/contact`, `/case-studies`                    | Quarterly; scope/timeframe wording rechecked with the monthly buyer-prompt walk for prompts 3, 4, 18, 26, 30                                          | entrans.ai/blog/ai-readiness-assessment-consulting-firms, 0260.ai/ai-readiness-assessment, octopusbuilds.com/blog/top-ai-readiness-assessment-companies — rank for "ai readiness and risk assessment for mid-size companies"                  |
| resource      | Commercial (lead-gen artifact)                                                                                                                                                                                                               | Definition sentence plus a table of what's inside                          | Resource → its paired service page, `/contact`                                                              | Quarterly artifact-content review (PRD §12)                                                                                                           | trustarc.com/resource/ai-governance-practice-privacy-hero-starter-kit, notion.com/templates/ai-governance-starter-kit, aona.ai/resources/templates — rank for "ai governance starter kit template"                                            |
| case-study    | Commercial (proof)                                                                                                                                                                                                                           | Step list (problem → approach → outcome)                                   | Case study → `/services/90-day-production-sprint`, `/approach`                                              | No scheduled refresh — updated only if the underlying engagement changes (L11: one anonymized entry, no invented metrics)                             | None named — an anonymized proof-of-practice page has no comparable page to cite against                                                                                                                                                      |
| article       | Informational                                                                                                                                                                                                                                | Short answer (the `shortAnswer` lead sentence)                             | Article → its `/glossary` term(s), its `/blog/category/*`, its `/blog/tag/*`                                | Quarterly baseline; any dated regulatory claim rechecked against its primary source whenever that source updates (PRD §15 sourcing rules)             | mindstudio.ai/blog/why-ai-pilots-never-reach-production, unifyapps.com/resources/blog/why-95-of-generative-ai-pilots-never-reach-production — rank for "why ai pilots never reach production"                                                 |
| blog-category | Navigational (topic hub)                                                                                                                                                                                                                     | Table (curated list with one-line stakes per entry)                        | Category → its member articles, `/blog/tags`                                                                | Passive — regenerates whenever a post is tagged into the category; no independent schedule                                                            | digitalstaff.ca/ai-governance/smb-governance-starter, mis-solutions.com/2026/06/ai-governance-vs-ai-usage-policy, layer27.com/blog/practical-ai-governance-for-small-businesses — rank for "ai governance policy for a 30–300 person company" |
| tag-index     | Navigational                                                                                                                                                                                                                                 | Table (tag list + article counts)                                          | Tag index → every `/blog/tag/*`, `/blog`                                                                    | Passive — regenerates with the tag vocabulary                                                                                                         | None — internal navigation aid, not written to rank; ALL tags stay indexed by design (L31) but compete against nothing                                                                                                                        |
| tag           | Navigational                                                                                                                                                                                                                                 | None — a thin archive list, not a citable unit by design                   | Tag → its member articles, `/blog/tags`                                                                     | Passive — regenerates with post tagging                                                                                                               | None — internal navigation aid, not written to rank                                                                                                                                                                                           |
| term          | Informational (definitional)                                                                                                                                                                                                                 | Definition sentence                                                        | Term → the `/faq` rows that cite it, sibling terms via "adjacent terms"                                     | Reviewed whenever the named regulation or standard is amended; quarterly baseline otherwise (PRD §12)                                                 | artificialintelligenceact.eu, digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai — rank for "what is the eu ai act"                                                                                                            |
| faq-answer    | Informational (question-answer)                                                                                                                                                                                                              | Short answer (first sentence of the answer)                                | FAQ → the service/glossary route named in its own answer                                                    | Quarterly FAQ walk (PRD §12); any FAQ "Must win" route rechecked monthly with §17.3                                                                   | No single named page — the competing surface is Google's "People Also Ask" box and answer-engine snippets for the exact question, not a stable URL                                                                                            |

### The 30 buyer prompts (PRD §17.3)

Protocol: check each prompt in ChatGPT, Claude, Perplexity, Gemini and Google AI Mode; record mentioned / cited / no. Target: 5/30 by month 6, 15/30 by month 12 (PRD §5). Each entry names the route that must win, quotes the passage that answers it, and states why in business terms. **GAP** marks a prompt with no winning route today — those feed the Phase 6 content plan at the end of this section.

#### Entity and offer prompts

**1. who is a fractional chief AI officer for a 100-person SaaS company**
Must win: `/` (support: `/services/fractional-caio-retainer`, `/faq/what-does-a-fractional-chief-ai-officer-actually-do`).
Passage: "I'm the fractional chief AI officer your org chart can point at when a customer asks who owns AI risk." (`/`)
Why: the primary entity query — the site must _be_ the answer, because the Founder/CEO persona decides in 30 seconds (PRD §6) and LLM visibility is measured per prompt (PRD §5).

**2. fractional CAIO vs full-time CAIO cost**
Must win: `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`, support `/pricing`.
Passage: "You get a named officer's accountability, without a full-time salary, a hiring process, or a seat that sits empty between AI decisions. That means a named officer on your customers' security reviews and your board's roadmap." (`/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`)
Passage: "The comparison is between different kinds of cost, not price against price: a monthly retainer fee against a full-time hire's salary, equity, recruiting and ramp time." (`/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`)
Why: the honest comparison is the sales objection to overcome before any call (PRD §6 CTO persona). Public prices are deliberately withheld (L8), so the answer argues cost _shape_, not figures.

**3. AI readiness assessment template for SMB**
Must win: `/resources/ai-readiness-scorecard`, support `/services/ai-readiness-and-risk-assessment`.
Passage: "A five-axis AI readiness scorecard you score yourself in an afternoon: strategy, data, delivery, people, and governance." (`/resources/ai-readiness-scorecard`)
Why: "template" intent wants an artifact, not a service page — the free scorecard is the entry to the paid Assessment (PRD §4, PRD §5 downloads metric).

**4. AI governance consultant ISO 42001 small company**
Must win: `/services/ai-readiness-and-risk-assessment`, support `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`, `/glossary/iso-iec-42001`.
Passage: "I work to get your management system, risk register, and evidence trail to the point an auditor would recognise as ready." (`/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`)
Passage: "The gap list compares your company with ISO/IEC 42001, the standard for an AI management system that an accredited body can certify." (`/services/ai-readiness-and-risk-assessment`)
Why: consultant-intent query with a standard named — the service page must own it before a directory or agency does (PRD §6), so its "ISO/IEC 42001 gap assessment" section names the standard in plain words.

**5. named person responsible for AI risk in vendor procurement**
Must win: `/faq/who-answers-customer-security-questionnaires`, support `/services/fractional-caio-retainer`.
Passage: "I do, as the named officer on record." (`/faq/who-answers-customer-security-questionnaires`)
Why: the Procurement/Compliance persona's literal question (PRD §6); naming a person is the offer's differentiator (PRD §1).

**6. how to build an AI system register**
Must win: `/blog/how-to-build-an-ai-system-register-in-a-week`, support `/glossary/ai-register`.
Passage: "A step-by-step way to build an AI system register in a week without buying a tool, so a security reviewer gets the document they ask for first." (article lead)
Why: how-to intent; the article is the citable procedure, the glossary term the citable definition.

**7. AI acceptable use policy template**
Must win: `/blog/ai-acceptable-use-policy-for-a-50-person-company`, support `/resources/ai-governance-starter-kit` (policy included), `/ai-policy` (my own policy as proof of practice).
Passage: "What a working AI acceptable use policy has to decide, what it must refuse to do, and how a company of 30 to 300 people gets staff to follow it." (article lead)
Why: template-intent with SMB scoping; the article carries the decisions, the kit carries the artifact.

**8. EU AI Act obligations for deployers small business**
Must win: `/glossary/eu-ai-act` + `/glossary/provider-vs-deployer`, support `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`.
Passage: "The EU AI Act is an EU regulation, in force since August 2024, that sorts AI systems into risk tiers and sets legal obligations that scale with the tier, heaviest for high-risk systems." (`/glossary/eu-ai-act`)
Passage: "Article 26 of the EU AI Act sets these duties for a deployer of a high-risk AI system." (`/glossary/provider-vs-deployer`)
Why: regulatory facts must come from primary sources and be dated (PRD §15 editorial rules); definitions are the citable unit, and the deployer duties are a checklist on the role's own page.

**9. why do AI pilots fail to reach production**
Must win: `/blog/why-your-ai-pilot-never-reached-production`.
Passage: "Most AI pilots stall on ownership, data rules and a missing outcome metric, not the model." (article lead)
Why: the #1 founder trigger (PRD §6 persona "пилоты не доходят до прода"); the home Signals block mirrors it for the 30-second test.

**10. LLM gateway for governance and audit**
Must win: `/glossary/llm-gateway`, support `/resources/llm-gateway-governance-config`.
Passage: "A governance config for an LLM gateway. It decides who may call which model, what gets redacted, how long logs are kept and the rate and fallback rules." (`/resources/llm-gateway-governance-config`)
Passage: "A written policy says what staff may do with a model. A gateway is the control that enforces it, because every model call passes through one place where the policy runs." (`/glossary/llm-gateway`)
Why: engineering-intent query from the CTO persona (PRD §6); the config artifact proves practice, feeding the downloads metric, and the term page explains the gateway as a governance control.

**11. how to put evals for AI agents into CI**
Must win: `/blog/evals-in-ci-for-llm-agents`, support `/resources/agent-evals-ci-starter`.
Passage: "How to build an eval set from production traffic, score an LLM agent without a golden answer, and fail a merge in CI when it regresses." (article lead)
Why: the engineering credibility wedge — evals in CI is the Sprint's success criterion (PRD §4).

**12. AI vendor assessment questionnaire template**
Must win: `/resources/ai-governance-starter-kit`.
Passage: "AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire." (`/resources/ai-governance-starter-kit`)
Passage: "The other three documents describe how you handle AI. This one asks each vendor how it handles your data." (`/resources/ai-governance-starter-kit`)
Why: the questionnaire is inside the kit; one artifact page covering four procurement documents matches how the buyer searches, and the questionnaire has its own section on that page.

**13. build vs buy AI 3-year TCO**
Must win: `/resources/build-vs-buy-ai-kit`.
Passage: "The build vs buy AI kit: a one-page worksheet of the six criteria I work through before recommending either path, and how to score them." (`/resources/build-vs-buy-ai-kit`)
Passage: "The Total cost over years criterion needs a total cost of ownership (TCO) estimate, and a vendor quote covers only part of it." (`/resources/build-vs-buy-ai-kit`)
Why: executive-intent query (PRD §15 row 8 theme); the worksheet answers the decision frame, and its total cost of ownership section names the cost categories to fill in, with no amounts (L8).

**14. AI operating model for mid-size company**
Must win: `/approach` + `/blog/category/operating-model`.
Passage: "This is how a Fractional AI Officer works: six signals, always in the same order, before I touch any code." (`/approach`)
Why: the operating model IS the approach's subject; the category clusters the supporting articles.
CLOSED 2026-10-02: `/glossary/ai-operating-model` owns the definition and
`/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company` owns the argument. The category
page no longer defines the phrase.

**15. how to hand over AI leadership to internal team**
Must win: `/faq/how-does-the-retainer-end`, support `/services/fractional-caio-retainer`, `/approach` (sixth signal).
Passage: "The handover plan exists from the first month, not the last." (`/faq/how-does-the-retainer-end`)
Why: handover is the retainer's exit promise (PRD §4) and the approach's structurally hardest signal.
CLOSED 2026-10-02: `/blog/handing-over-ai-leadership-to-an-internal-owner` and
`/resources/handover-playbook`. Stage lengths, names and sign-off are owner blanks, section 16.

#### Locale prompts

**16. fractional AI officer Israel**
**17. fractional AI leader Europe remote**
Must win: nothing. Retired 2026-10-02 by L57: the site never publishes a physical location, so no
route is asked to win a query that names one. `absenceFindings` fails `--check` if the term reaches
a built page. This supersedes PRD §1 LOCATION_TEXT; the two prompts stay listed so a later reader
meets the decision instead of re-raising them as missing copy.

#### Engineering prompts

**18. agentic automation consultant for B2B**
Must win: `/services/90-day-production-sprint`, support `/case-studies`.
Passage: "One process live in production, with evals in CI." (`/services/90-day-production-sprint`)
Why: consultant-intent mapped to the delivery offer; the sprint page is the transactional answer.

**19. MCP security best practices**
**CLOSED 2026-10-02:** `/glossary/mcp`. Note the premise in the old wording was wrong: there are no
diagram labels on `/approach`, and the abbreviation "MCP" appeared on no built page. The one
on-site mention was "Model Context Protocol" in `/case-studies/only-help-agentic-support`. Needs a glossary term first (cheap, citable), an article second. Phase 6.

**20. multi-agent reference architecture production**
Must win (partial): `/approach` (referenced stack, PRD Appendix B).
Passage: the stack diagram layers agents, tools, gateway, evals, governance — strong material, but a diagram is not a citable reference architecture.
Why: the CTO persona validates the consultant on architecture before anything else (PRD §6 path `/approach → /resources → GitHub`); the diagram is that proof, prose is what retrieval can cite.
**CLOSED 2026-10-02:** `/blog/multi-agent-reference-architecture-in-production` owns it as prose.
The diagram this row assumed exists was never built.

**21. adoption telemetry for AI tools**
**CLOSED 2026-10-02:** `/blog/adoption-telemetry-measuring-if-ai-is-actually-used` and
`/resources/adoption-telemetry-dashboard-template`.

**22. AI incident response plan template**
Must win: `/resources/ai-governance-starter-kit`, support `/glossary/serious-incident-reporting`.
Passage: "Serious incident reporting is the EU AI Act duty to notify the relevant national authority after a high-risk AI system causes serious harm." (`/glossary/serious-incident-reporting`)
Passage: "For a high-risk system you deploy, Article 26 of the EU AI Act asks the deployer to give notice at once when it identifies a serious incident." (`/resources/ai-governance-starter-kit`)
Why: the regulatory duty is defined on its own page; the _template_ the prompt asks for is the incident response plan section of the starter kit, which links to the duty instead of repeating its deadlines (L50, L51).

**23. data classification for LLM usage**
Must win: `/glossary/data-classification`, support `/resources/ai-governance-starter-kit` (classification included).
Passage: "Data classification means labelling what is in a dataset, document or prompt by sensitivity." (`/glossary/data-classification`)
Why: the exact bridge between the compliance term and the LLM use case; NIST-anchored (PRD §15 sourcing rules).

**24. ISO 42001 gap assessment**
Must win: `/glossary/iso-iec-42001` + `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`.
Passage: "ISO/IEC 42001 is an international standard that sets out what an AI management system must do." (`/glossary/iso-iec-42001`)
Passage: "A gap assessment compares what your company does today with what ISO/IEC 42001 asks for, and lists the difference." (`/glossary/iso-iec-42001`)
Why: gap-assessment intent is Assessment-adjacent — the service page maps gaps against ISO/IEC 42001 (PRD §4 Assessment), and the term page explains what a gap assessment is.

**25. NIST AI RMF for small companies**
Must win: `/glossary/nist-ai-rmf`, support `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`, `/services/ai-readiness-and-risk-assessment` (scores against NIST AI RMF).
Passage: "The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework, published in January 2023, for identifying and managing an AI system's risks across its design, development and use." (term definition)
Why: framework-of-record for the Assessment; the "for small companies" scoping comes from the FAQ's headcount answer ("None of the three sets a headcount threshold").

**26. fractional CAIO pricing**
Must win: `/pricing`, support `/faq/how-do-you-charge-for-the-work`.
Passage: "Every offer is a fixed structure rather than an hourly rate. The number reaches you in writing before any work starts." (`/pricing`)
Why: pricing queries are trust queries; fixed structures answer the trust without the numbers (L8 — prices only on the fit call, by owner decision 2026-09-12).

**27. what does a chief AI officer do in a 50 person company**
Must win: `/faq/what-does-a-fractional-chief-ai-officer-actually-do`.
Passage: "I carry the AI register as a named officer. I review every initiative, sign the answers to security questionnaires, and sit in design reviews." (FAQ answer)
Why: the definitional role query at SMB scale; one URL, one answer (L20).

**28. AI governance starter kit open source**
Must win: `/resources/ai-governance-starter-kit`.
Passage: "AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire." (kit lead)
Why: exact-match artifact query; the downloads metric (PRD §5) counts it. GitHub repos land later (L10) — until then the page carries the full content.

**29. AI readiness scorecard five drivers**
Must win: `/resources/ai-readiness-scorecard`, support `/services/ai-readiness-and-risk-assessment` ("score you on five readiness drivers").
Passage: "A five-axis AI readiness scorecard you score yourself in an afternoon: strategy, data, delivery, people, and governance." (resource lead)
Why: the "five drivers" phrasing must appear verbatim-adjacent so retrieval can bind it; free scorecard → paid Assessment path.

**30. board memo AI strategy one page**
Must win: `/services/ai-readiness-and-risk-assessment`.
Passage: "Two weeks to a memo your board can act on." (service H1-adjacent lead; "ends in a memo your board can act on" in the body)
Why: the board-memo deliverable is the Assessment's output and the board-pressure trigger (PRD §6 Signals).

### Registers — entities, concepts, relationships

Generated by `npm run assets:registers`; `npm run gate:registers` fails when the committed block
no longer matches the content.

<!-- REGISTERS:BEGIN -->
#### Entity register (32)

One owning route per entity. The mention count is inbound references from other routes.

| Entity | Owned by | Mentioned by |
|---|---|---|
| Agentic workflow | `/glossary/agentic-workflow` | 13 |
| AI governance | `/glossary/ai-governance` | 34 |
| AI impact assessment | `/glossary/ai-impact-assessment` | 2 |
| AI management system | `/glossary/ai-management-system` | 6 |
| AI operating model | `/glossary/ai-operating-model` | 13 |
| AI register | `/glossary/ai-register` | 32 |
| Conformity assessment | `/glossary/conformity-assessment` | 5 |
| Data classification | `/glossary/data-classification` | 15 |
| DPIA | `/glossary/dpia` | 5 |
| EU AI Act | `/glossary/eu-ai-act` | 41 |
| Evals | `/glossary/evals` | 35 |
| Guardrails | `/glossary/guardrails` | 7 |
| Hallucination rate | `/glossary/hallucination-rate` | 4 |
| High-risk AI system | `/glossary/high-risk-ai-system` | 10 |
| Human oversight | `/glossary/human-oversight` | 10 |
| Human-in-the-loop | `/glossary/human-in-the-loop` | 5 |
| ISO/IEC 42001 | `/glossary/iso-iec-42001` | 29 |
| LLM gateway | `/glossary/llm-gateway` | 8 |
| Model card | `/glossary/model-card` | 3 |
| Model Context Protocol | `/glossary/mcp` | 3 |
| Model provenance | `/glossary/model-provenance` | 3 |
| NIST AI RMF | `/glossary/nist-ai-rmf` | 23 |
| Observability | `/glossary/observability` | 5 |
| Post-market monitoring | `/glossary/post-market-monitoring` | 5 |
| Prompt injection | `/glossary/prompt-injection` | 7 |
| Provider vs deployer | `/glossary/provider-vs-deployer` | 3 |
| Red teaming | `/glossary/red-teaming` | 4 |
| Retrieval augmented generation | `/glossary/retrieval-augmented-generation` | 4 |
| Serious incident reporting | `/glossary/serious-incident-reporting` | 3 |
| Shadow AI | `/glossary/shadow-ai` | 9 |
| Sub-processor | `/glossary/sub-processor` | 5 |
| Technical documentation | `/glossary/technical-documentation` | 8 |

#### Concept register (32)

A concept is defined on exactly one page. Every other page links to it rather than redefining it.

| Concept | Defined by | Definition |
|---|---|---|
| Agentic workflow | `/glossary/agentic-workflow` | An agentic workflow is a task one or more AI agents complete on their own once started. The system plans steps, calls tools or APIs, checks the result, and decides what happens next without a person approving each move. |
| AI governance | `/glossary/ai-governance` | AI governance means deciding who may build or buy an AI system, and who answers, by name, when it fails. Policies, roles and controls set what data a system may touch and who signs off before it reaches customers. |
| AI impact assessment | `/glossary/ai-impact-assessment` | An AI impact assessment is a written review of who a high-risk AI system affects and what could go wrong for them, completed before launch. It also asks whether someone wrongly affected has a real way to challenge the system's decision, not just a right to ask a question. |
| AI management system | `/glossary/ai-management-system` | An AI management system is the plan-do-check-act cycle a company runs to govern its AI. It sets policy, does the work, checks results, then adjusts and repeats. ISO/IEC 42001 is the standard that certifies a company actually runs the cycle, not just writes it down. |
| AI operating model | `/glossary/ai-operating-model` | An AI operating model is the decision structure that moves AI work from a pilot nobody owns to a process a team runs. It names who chooses what to automate, who reviews a system before customers see it, and who runs it afterwards. |
| AI register | `/glossary/ai-register` | An AI register is a company's own inventory of every AI system it builds, buys or uses. Each entry lists what the system does, what data it touches, who owns it and how risky it is. |
| Conformity assessment | `/glossary/conformity-assessment` | A conformity assessment is the process a provider completes before placing a high-risk AI system on the market. Either the provider checks the system internally, or an accredited outside body checks it. The assessment shows the system actually meets the EU AI Act's requirements, rather than merely claiming to. |
| Data classification | `/glossary/data-classification` | Data classification means labelling what is in a dataset, document or prompt by sensitivity. Common tiers are public, internal, confidential and restricted. A company can then decide what may reach a given AI tool. That way nobody pastes something in and finds out too late. |
| DPIA | `/glossary/dpia` | A DPIA, or data protection impact assessment, is a written GDPR review completed before a company begins personal-data processing likely to carry high privacy risk. It assesses what data the company collects, why, and how the company reduces that risk. It differs from a fairness review of the system's decision. |
| EU AI Act | `/glossary/eu-ai-act` | The EU AI Act is an EU regulation, in force since August 2024, that sorts AI systems into risk tiers and sets legal obligations that scale with the tier, heaviest for high-risk systems. |
| Evals | `/glossary/evals` | Evals are repeatable tests that score an AI system's outputs against a fixed set of examples and criteria. A team runs them before release and again whenever the prompt, data or model changes. |
| Guardrails | `/glossary/guardrails` | Guardrails are checks on what an AI model will respond to, what it can say, and what it can do. The surrounding code enforces them, not the model's training. That way an unusual input cannot just persuade the system to drop a rule. |
| Hallucination rate | `/glossary/hallucination-rate` | A hallucination rate is the share of a model's answers that state something false or invented in the same confident tone as a correct one. A team measures it against questions with known correct answers. |
| High-risk AI system | `/glossary/high-risk-ai-system` | A high-risk AI system is one the EU AI Act classifies as carrying its heaviest legal duties. That happens either because it is a safety component of a regulated product, or because it serves a listed purpose such as hiring, credit scoring or law enforcement. A narrow exemption can apply. |
| Human oversight | `/glossary/human-oversight` | Human oversight is the EU AI Act requirement that a person watching a high-risk AI system can understand what it is doing, catch a wrong output and stop the system. That takes training, time and authority, not just a name on a workflow diagram. |
| Human-in-the-loop | `/glossary/human-in-the-loop` | Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, rather than the system acting alone once it starts. |
| ISO/IEC 42001 | `/glossary/iso-iec-42001` | ISO/IEC 42001 is an international standard that sets out what an AI management system must do. An AI management system is the set of policies an organisation follows to govern its own AI, checked on a cycle rather than written once. ISO and IEC published the standard in December 2023. |
| LLM gateway | `/glossary/llm-gateway` | An LLM (large language model) gateway is a single service that every model call passes through. A company can then enforce authentication, logging, rate limits and content filtering in one place. |
| Model card | `/glossary/model-card` | A model card is a short, standard-shaped document a model's maker publishes. It says what the maker built the model for, and how it performs across groups and conditions. It also names where not to use the model, closer to a spec sheet than a sales page. |
| Model Context Protocol | `/glossary/mcp` | The Model Context Protocol (MCP) is an open protocol that lets AI applications use outside tools and data. Its specification says MCP cannot enforce consent, data privacy or tool safety at the protocol level. Whoever builds and runs the host and the servers has to do that work. |
| Model provenance | `/glossary/model-provenance` | Model provenance is a traceable record of where a model comes from. That means which base model it started from, what data trained or fine-tuned it, and what licence covers the result. A buyer needs this to know what it may do with the output. |
| NIST AI RMF | `/glossary/nist-ai-rmf` | The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework, published in January 2023, for identifying and managing an AI system's risks across its design, development and use. |
| Observability | `/glossary/observability` | Observability is the ability to see, after the fact, exactly what a user asked a live AI system. For any one case someone points to, it also shows what the system retrieved or called, and what it answered. An aggregate chart alone cannot explain one specific customer's bad experience. |
| Post-market monitoring | `/glossary/post-market-monitoring` | Post-market monitoring is the EU AI Act duty on a provider to keep collecting and analysing real-world performance data on a high-risk AI system. It lasts as long as the system is in use. Monitoring catches problems that appear after launch, instead of assuming the original testing ruled them out. |
| Prompt injection | `/glossary/prompt-injection` | Prompt injection is text that gets a model to treat it as an instruction rather than content. It can be typed by a user, or hidden inside a document, webpage or email the model reads. OWASP, a security-standards group, ranks it as the top risk for large language model applications. |
| Provider vs deployer | `/glossary/provider-vs-deployer` | Provider vs deployer is the EU AI Act split between the company that builds an AI system and the company that runs it. Most of the Act's paperwork depends on which of the two roles a company holds. |
| Red teaming | `/glossary/red-teaming` | Red teaming means deliberately trying to break an AI system, the way a motivated attacker or a determined bad-faith user would, before they actually do. It aims at finding the failure nobody wrote a test case for, not at confirming cases already known to work. |
| Retrieval augmented generation | `/glossary/retrieval-augmented-generation` | Retrieval augmented generation, shortened to RAG, is an architecture where a model looks up relevant passages from a document store at answer time. It reads them alongside the question. This means an answer can cite a current document, rather than relying only on training data. |
| Serious incident reporting | `/glossary/serious-incident-reporting` | Serious incident reporting is the EU AI Act duty to notify the relevant national authority after a high-risk AI system causes serious harm. It falls on the provider, the company that built the system, and sometimes the deployer, the company running it. The default deadline is fifteen days from awareness. |
| Shadow AI | `/glossary/shadow-ai` | Shadow AI is any AI tool an employee uses for company work without IT or security's knowledge. Examples range from a personal chatbot account to a browser extension or a locally run model. |
| Sub-processor | `/glossary/sub-processor` | A sub-processor is a vendor an AI provider hands a company's data to behind the scenes. The model provider behind a SaaS tool is a common example. GDPR Article 28 requires the provider to get the customer's permission, and to bind the sub-processor to the same data protections by contract. |
| Technical documentation | `/glossary/technical-documentation` | Technical documentation is the dossier a provider of a high-risk AI system must keep. It covers purpose, design logic, training data, performance metrics, risk process and monitoring plan. It has to be clear enough that a regulator can assess it without the original engineers in the room. |

#### Topic relationships (98)

Declared in the content, never inferred here.

| From | Kind | To |
|---|---|---|
| Agentic workflow | related-concept | Human-in-the-loop |
| Agentic workflow | related-concept | LLM gateway |
| Agentic workflow | related-concept | Evals |
| AI governance | related-concept | NIST AI RMF |
| AI governance | related-concept | ISO/IEC 42001 |
| AI governance | related-concept | AI register |
| AI impact assessment | related-concept | EU AI Act |
| AI impact assessment | related-concept | DPIA |
| AI impact assessment | related-concept | High-risk AI system |
| AI management system | related-concept | ISO/IEC 42001 |
| AI management system | related-concept | AI governance |
| AI management system | related-concept | Technical documentation |
| AI operating model | related-concept | AI governance |
| AI operating model | related-concept | AI management system |
| AI operating model | related-concept | ISO/IEC 42001 |
| AI operating model | related-concept | AI register |
| AI register | related-concept | AI governance |
| AI register | related-concept | EU AI Act |
| AI register | related-concept | Shadow AI |
| Conformity assessment | related-concept | High-risk AI system |
| Conformity assessment | related-concept | Technical documentation |
| Conformity assessment | related-concept | Post-market monitoring |
| Data classification | related-concept | DPIA |
| Data classification | related-concept | Sub-processor |
| Data classification | related-concept | Guardrails |
| DPIA | related-concept | AI impact assessment |
| DPIA | related-concept | Sub-processor |
| DPIA | related-concept | Data classification |
| EU AI Act | related-concept | AI register |
| EU AI Act | related-concept | Human-in-the-loop |
| EU AI Act | related-concept | AI governance |
| Evals | related-concept | Agentic workflow |
| Evals | related-concept | LLM gateway |
| Evals | related-concept | AI governance |
| Guardrails | related-concept | Prompt injection |
| Guardrails | related-concept | Red teaming |
| Guardrails | related-concept | Observability |
| Hallucination rate | related-concept | Evals |
| Hallucination rate | related-concept | Retrieval augmented generation |
| Hallucination rate | related-concept | Guardrails |
| High-risk AI system | related-concept | EU AI Act |
| High-risk AI system | related-concept | Conformity assessment |
| High-risk AI system | related-concept | Technical documentation |
| Human oversight | related-concept | Human-in-the-loop |
| Human oversight | related-concept | High-risk AI system |
| Human oversight | related-concept | Provider vs deployer |
| Human-in-the-loop | related-concept | Agentic workflow |
| Human-in-the-loop | related-concept | EU AI Act |
| Human-in-the-loop | related-concept | NIST AI RMF |
| Human-in-the-loop | related-concept | Human oversight |
| ISO/IEC 42001 | related-concept | AI governance |
| ISO/IEC 42001 | related-concept | NIST AI RMF |
| ISO/IEC 42001 | related-concept | AI register |
| LLM gateway | related-concept | Shadow AI |
| LLM gateway | related-concept | Agentic workflow |
| LLM gateway | related-concept | Evals |
| Model card | related-concept | Model provenance |
| Model card | related-concept | Technical documentation |
| Model card | related-concept | Hallucination rate |
| Model Context Protocol | related-concept | Guardrails |
| Model Context Protocol | related-concept | Prompt injection |
| Model Context Protocol | related-concept | Agentic workflow |
| Model provenance | related-concept | Model card |
| Model provenance | related-concept | Retrieval augmented generation |
| Model provenance | related-concept | Data classification |
| NIST AI RMF | related-concept | AI governance |
| NIST AI RMF | related-concept | ISO/IEC 42001 |
| NIST AI RMF | related-concept | Human-in-the-loop |
| Observability | related-concept | Post-market monitoring |
| Observability | related-concept | Red teaming |
| Observability | related-concept | Hallucination rate |
| Post-market monitoring | related-concept | Serious incident reporting |
| Post-market monitoring | related-concept | High-risk AI system |
| Post-market monitoring | related-concept | Observability |
| Prompt injection | related-concept | Guardrails |
| Prompt injection | related-concept | Red teaming |
| Prompt injection | related-concept | Retrieval augmented generation |
| Provider vs deployer | related-concept | High-risk AI system |
| Provider vs deployer | related-concept | Human oversight |
| Provider vs deployer | related-concept | Sub-processor |
| Red teaming | related-concept | Guardrails |
| Red teaming | related-concept | Evals |
| Red teaming | related-concept | Prompt injection |
| Retrieval augmented generation | related-concept | Model provenance |
| Retrieval augmented generation | related-concept | Prompt injection |
| Retrieval augmented generation | related-concept | Hallucination rate |
| Serious incident reporting | related-concept | Post-market monitoring |
| Serious incident reporting | related-concept | High-risk AI system |
| Serious incident reporting | related-concept | Human oversight |
| Shadow AI | related-concept | LLM gateway |
| Shadow AI | related-concept | AI register |
| Shadow AI | related-concept | AI governance |
| Sub-processor | related-concept | DPIA |
| Sub-processor | related-concept | Data classification |
| Sub-processor | related-concept | Provider vs deployer |
| Technical documentation | related-concept | Conformity assessment |
| Technical documentation | related-concept | Model card |
| Technical documentation | related-concept | High-risk AI system |
<!-- REGISTERS:END -->

### GAP register — closed 2026-10-02

Every declared GAP prompt now has a route. The "Gap" column records what was believed before the
build; two of the five entries were wrong about the site, and that is kept visible rather than
tidied away, because a register that describes an artefact as existing when it does not is the same
class of defect as a gate that cannot fail.

| #   | Prompt                             | What this row claimed        | What was actually true                                                          | Route now                                                                                                       |
| --- | ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 19  | MCP security best practices        | No route at all              | Correct, and the abbreviation appeared on no built page                         | `/glossary/mcp`                                                                                                 |
| 21  | adoption telemetry                 | No route at all              | Correct                                                                         | `/blog/adoption-telemetry-measuring-if-ai-is-actually-used`, `/resources/adoption-telemetry-dashboard-template` |
| 14  | AI operating model                 | No anchor article            | Correct, and `/blog/category/operating-model` was silently defining the concept | `/glossary/ai-operating-model`, `/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company`              |
| 15  | handover to internal team          | FAQ covers it; no playbook   | Correct                                                                         | `/blog/handing-over-ai-leadership-to-an-internal-owner`, `/resources/handover-playbook`                         |
| 20  | multi-agent reference architecture | Diagram only, no prose owner | **Wrong.** No diagram exists; it is one sentence in `docs/PRD.md` Appendix B    | `/blog/multi-agent-reference-architecture-in-production`                                                        |

Standing note (resolved 2026-09-13): `--check` had reported `/case-studies/only-help-agentic-support` built without a `content-facts.json` row; the row ("agentic support triage case study") was landed by a sibling packet and the orphan is closed. Remaining `--check` findings during the 4.5b landing window are the 13 tag-route facts rows ahead of their built routes — they clear at the integration build.

### Phase 6 worklist — cheapest fix first

One row per declared GAP prompt (the register above), ranked by build cost, cheapest first. This
names the page and what it must contain to win the answer; it does not author the content — the
owner supplies the facts (AGENTS.md: never invent an owner fact, a client name, a metric).

Item numbers are stable. A finished item stays in place, marked done and dated, and its row leaves
the register.

1. **Prompts 16, 17 — Israel / Europe remote. Retired 2026-10-02, not built.** The owner decided the
   site never publishes a physical location, locked as L57. PRD §1 `LOCATION_TEXT` is superseded.
   "Remote worldwide" stays where it already is; "Israel" goes nowhere. `absenceFindings` in
   `site/scripts/semantic-core.mjs` keeps one claim and fails `--check` with
   `published-against-a-decision` if the term reaches a built page, so the decision is enforced
   rather than remembered. This item is closed and must not be reopened as missing copy.
2. **Prompt 2 — fractional vs full-time cost. Done 2026-10-02.** Copy-only, existing FAQ. One
   paragraph on `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` naming the
   cost _shape_: retainer fee vs. salary + equity + recruiting + ramp time. No dollar figures (L8).
   Landed as one sentence inside the FAQ's single answer paragraph.
3. **Prompt 13 — build vs buy 3-year TCO. Done 2026-10-02.** Copy-only, existing resource. Extend
   `/resources/build-vs-buy-ai-kit` with a TCO _framework_ section: the cost categories to fill in
   (build: engineering time, maintenance, drift monitoring; buy: license, integration, lock-in).
   Generic math only, no public prices (L8). Landed as the "Total cost of ownership" section: a
   six-row table of cost categories and two paragraphs of method, with no amounts.
4. **Prompt 22 — AI incident response plan template. Done 2026-10-02.** Copy-only, existing
   resource. Add an incident-response-plan section to `/resources/ai-governance-starter-kit`: who is
   notified, in what order, tied to the EU AI Act serious-incident timeline already defined at
   `/glossary/serious-incident-reporting`. Landed as the "Incident response plan" section: a call
   order inside the company, then outside it, that links to the term for the timeline instead of
   restating it.
5. **Prompt 19 — MCP security best practices. Done 2026-10-02.** Built as `/glossary/mcp` from
   `investigation/02-mcp-security-research.md`. The entry's spine is that the specification does not
   enforce at the protocol level what readers assume it enforces. The only on-site mention, in
   `/case-studies/only-help-agentic-support`, now links to it; that case study's own claim is
   checklist rows 13.1 and 13.2, unresolved. Seven owner questions, section 13.
   ORIGINAL NOTE: One new term — the cheapest new route, since it
   reuses the `term` family's template exactly. New `/glossary/mcp` (or
   `/glossary/model-context-protocol`): a definition sentence, why an agent's tool access needs
   least-privilege scoping, adjacent terms `guardrails` and `prompt-injection`.
6. **Prompts 4, 8, 10, 12, 24 — thin-coverage batch. Done 2026-10-02.** Copy-only additions to five
   existing pages, no new routes: a gap-assessment paragraph on `/glossary/iso-iec-42001` and
   `/services/ai-readiness-and-risk-assessment` (24); a deployer-obligations checklist paragraph on
   `/glossary/provider-vs-deployer` (8); an "LLM gateway as a governance control" paragraph on
   `/glossary/llm-gateway` (10); split or flag the vendor questionnaire inside
   `/resources/ai-governance-starter-kit` (12); explicit ISO/IEC 42001 language on
   `/services/ai-readiness-and-risk-assessment` (4). Landed as a "Gap assessment" section on the
   term, an "ISO/IEC 42001 gap assessment" section on the service page (one section for prompts 24
   and 4), a "Deployer obligations checklist" section, a "The gateway as a governance control"
   section, and a "Vendor questionnaire" section that splits the questionnaire out inside the kit.
7. **Prompt 14 — AI operating model anchor. Done 2026-10-02.** Built as
   `/glossary/ai-operating-model` plus `/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company`,
   from `investigation/03-ai-operating-model-research.md`. The glossary term owns the definition and
   `/blog/category/operating-model` now points at it instead of defining it, which resolves an L51
   collision nobody had noticed. Four widely repeated claims the research could not verify are
   deliberately absent from the built output. Seven owner questions, section 14.
   ORIGINAL NOTE: One new article — full write, sourcing and evals per
   the article family's rules. A `/blog/...` article that owns "AI operating model" as prose,
   cross-linked from `/approach` and `/blog/category/operating-model`.
8. **Prompt 20 — multi-agent reference architecture. Done 2026-10-02.** Built as
   `/blog/multi-agent-reference-architecture-in-production` from
   `investigation/04-multi-agent-architecture-research.md`. **The diagram this row assumed exists was
   never built**: it is one sentence in `docs/PRD.md` Appendix B, and `/approach` carries three text
   lists and no stack diagram. The article is the first home of the architecture, in prose. Fourteen
   owner questions, section 15.
   ORIGINAL NOTE: One new article. A prose companion to the
   `/approach` stack diagram (PRD Appendix B) that retrieval can cite — a diagram is not a citable
   unit.
9. **Prompt 15 — handover to internal team. Done 2026-10-02.** Built as
   `/blog/handing-over-ai-leadership-to-an-internal-owner` plus `/resources/handover-playbook`, from
   `investigation/05-handover-playbook-research.md`. The playbook is six fill-in stage tables; every
   name, date and stage length is an owner blank, not an invention. Twelve owner questions,
   section 16.
   ORIGINAL NOTE: One new article plus one new resource artifact.
   A "Handover Playbook" article and resource (PRD §15 row 13), cross-linked from
   `/faq/how-does-the-retainer-end`.
10. **Prompt 21 — adoption telemetry. Done 2026-10-02.** Built as
    `/blog/adoption-telemetry-measuring-if-ai-is-actually-used` plus
    `/resources/adoption-telemetry-dashboard-template`, from
    `investigation/06-adoption-telemetry-research.md`. The page is built around the evidence against
    its own premise: METR's 2025 trial measured developers 19% slower while they believed they were
    20% faster. Twelve owner questions, section 17.
    ORIGINAL NOTE: One new article plus a new dashboard-template artifact —
    the most expensive item here, since the dashboard template is a new artifact type, not an
    extension of an existing one (PRD §15 row 12).
