# Semantic core (L33)

This document has two layers, and they are maintained differently:

- **Generated layer — the facts.** One table per route family, rebuilt from `site/content-facts.json` and the built `site/dist/` by `node scripts/semantic-core.mjs` (run from `site/`). It never drifts because it is never hand-edited: regeneration rewrites only the block between the `semantic-core` markers below. The Opening column reuses the content gate's own query rules (`h1-query`, `query-opening` in `site/scripts/content-rows.mjs`), so ✓ here means the same thing as green there.
- **Hand-authored layer — the why.** Everything below the markers: why each family exists, and the mapping of the 30 buyer prompts (PRD §17.3) to the route that must win each one, with the passage that answers it and the business reason. Regeneration leaves all of it intact.

Drift protection is a real doc-diff gate (L48). `node scripts/semantic-core.mjs --check` recomputes the generated table in memory from the same inputs `node scripts/semantic-core.mjs` regenerates from, and fails — naming every drifted route — if that differs from the committed block below; a stale `docs/SEMANTIC-CORE.md` cannot pass CI, because the same check rides `gate:content` (`site/scripts/content-gate.mjs` invoking `checkFindings()`), and `gate:content` is a CI step (L36). The same run also verifies: every `targetQuery` row maps to a built route and every gated built route has a row (no orphans either way); every built `<title>` follows its family's title grammar; every buyer-prompt "Must win" route below is actually built; every buyer-prompt "Passage" quote is still a literal substring of its cited route's rendered text; and every buyer-prompt GAP absence-claim (for example, "Israel" appears on no built page) still holds. Route coverage: **102 of 105** built routes carry a generated row below; the remaining 3 are intentionally ungated utility routes, documented with their reason in the table right after this paragraph.

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
| `/` | fractional chief ai officer | Fractional Chief AI Officer — meshin.co | Fractional AI leadership for 30–300 person companies: governance that passes enterprise procurement, and agentic systems shipped to production with evals and observability. | A Fractional Chief AI Officer you can name on the org chart. | 22 | ✓ |
| `/about` | dmitri meshin | About Dmitri Meshin — meshin.co | Platform engineer working as a Fractional Chief AI Officer for companies of 30 to 300 people. Remote worldwide. | Dmitri Meshin | 22 | ✓ |
| `/ai-policy` | ai acceptable use policy | AI acceptable use policy — meshin.co | My own acceptable-use policy for AI systems: what data may reach a vendor, what may not, and who decides. | My AI acceptable use policy | 22 | ✓ |
| `/approach` | how a fractional ai officer works | How I work — meshin.co | The six things that decide whether an AI initiative reaches production, and the order I work through them. | How a Fractional AI Officer works with your team | 22 | ✓ |
| `/blog` | ai governance writing | Writing — meshin.co | Notes on getting AI systems past security review and into production, written for founders and boards. | Writing on AI governance | 23 | ✓ |
| `/case-studies` | fractional chief ai officer case study | Case studies — meshin.co | One entry, not a client case: only.help, my own product, built with the method I use for clients. | Fractional chief AI officer case study | 22 | ✓ |
| `/contact` | book an ai leadership call | Contact — meshin.co | Book a 30-minute fit call or email hello@meshin.co. Remote worldwide, on site when the trip is worth it. | Book an AI leadership call | 23 | ✓ |
| `/faq` | fractional chief ai officer questions | Questions and answers — meshin.co | What a Fractional Chief AI Officer does, what each offer produces, and how AI risk gets recorded and signed off. | Fractional Chief AI Officer questions, answered | 47 | ✓ |
| `/glossary` | ai governance glossary | AI governance glossary — meshin.co | Plain definitions of the AI governance terms that come up in security reviews and board meetings. | AI governance glossary | 52 | ✓ |
| `/imprint` | imprint | Imprint — meshin.co | Who is responsible for this site, how to reach them, and what it is hosted on. | Imprint | 22 | ✓ |
| `/now` | what i am working on now | Now — meshin.co | What I am working on this month, what I am reading, and how much capacity is actually free. | What I am working on now | 22 | ✓ |
| `/pricing` | fractional chief ai officer cost | Pricing — meshin.co | Three fixed structures and no hourly billing: a two-week Assessment, a 90-Day Sprint, and a monthly Retainer. Every fee reaches you in writing before work starts. | What a Fractional Chief AI Officer costs | 25 | ✓ |
| `/privacy` | privacy policy | Privacy — meshin.co | What this site collects, which is almost nothing, and what happens to an email you send me. | Privacy policy | 22 | ✓ |
| `/resources` | ai governance templates | Resources — meshin.co | Open templates and checklists for AI governance: register, acceptable-use policy, data classification, vendor questionnaire. | AI governance templates | 22 | ✓ |
| `/security` | security practices | Security — meshin.co | How this site is built and served, how client data is handled, and where to report a vulnerability. | Security practices for client work | 23 | ✓ |
| `/services` | fractional ai leadership services | Services — meshin.co | Three ways to work with a Fractional Chief AI Officer: a two-week assessment, a 90-day production sprint, a retainer. | Fractional AI leadership services | 22 | ✓ |
| `/terms` | terms | Terms — meshin.co | What this site is, what the published prices mean, and which terms actually govern an engagement. | Terms. | 22 | ✓ |

### service (3)

title `{offer name} — meshin.co` · meta: one outcome sentence: what ships, in what timeframe · body intent: offer → deliverables → fit → CTA

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/services/90-day-production-sprint` | 90-day production sprint | 90-Day Production Sprint — meshin.co | A 90-day sprint that puts one agentic workflow into production with evals in CI, tracing, and a named owner. | 90-Day Production Sprint | 23 | ✓ |
| `/services/ai-readiness-and-risk-assessment` | ai readiness assessment | AI Readiness & Risk Assessment — meshin.co | A two-week AI readiness and risk assessment for companies of 30 to 300 people, ending in a memo your board can act on. | AI Readiness & Risk Assessment | 22 | ✓ |
| `/services/fractional-caio-retainer` | fractional caio retainer | Fractional CAIO Retainer — meshin.co | One or two days a week as your named AI officer: procurement answers, design reviews, board updates and a handover plan. | Fractional CAIO Retainer | 22 | ✓ |

### resource (5)

title `{artifact name} — meshin.co` · meta: one sentence naming the artifact and what you do with it · body intent: what it is → what is inside → how to use it

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/resources/agent-evals-ci-starter` | agent evals ci starter | Agent Evals CI Starter — meshin.co | A starter CI pipeline for agent evals. It runs on every pull request and blocks a bad merge before it ships. | Agent Evals CI Starter | 24 | ✓ |
| `/resources/ai-governance-starter-kit` | ai governance starter kit | AI Governance Starter Kit — meshin.co | AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire. | AI Governance Starter Kit | 23 | ✓ |
| `/resources/ai-readiness-scorecard` | ai readiness scorecard | AI Readiness Scorecard — meshin.co | A five-axis AI readiness scorecard you score yourself: strategy, data, delivery, people, governance. | AI Readiness Scorecard | 24 | ✓ |
| `/resources/build-vs-buy-ai-kit` | build vs buy ai kit | Build vs Buy AI Kit — meshin.co | The build vs buy AI kit: a one-page worksheet of the criteria I work through before recommending either path. | Build vs Buy AI Kit | 25 | ✓ |
| `/resources/llm-gateway-governance-config` | llm gateway governance config | LLM Gateway Governance Config — meshin.co | A governance config for an LLM gateway. It decides what gets logged, redacted, and who may call which model. | LLM Gateway Governance Config | 26 | ✓ |

### case-study (1)

title `{client} — {engagement} — meshin.co` · meta: how the system went from demo to production · body intent: problem → approach → outcome

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/case-studies/only-help-agentic-support` | agentic support triage | only.help — agentic support triage, on my own product — meshin.co | An agentic support triage workflow that went from a demo notebook to a production path with evals in CI and a named owner. | only.help — agentic support triage, on my own product | 22 | ✓ |

### article (4)

title `{short answer sentence} — meshin.co` · meta: the shortAnswer sentence, uncut · body intent: problem → mechanism → fix → takeaways

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/ai-acceptable-use-policy-for-a-50-person-company` | ai acceptable use policy | What actually belongs in an AI acceptable use policy — meshin.co | What a working AI acceptable use policy has to decide, what it must refuse to do, and how a company of 30 to 300 people gets staff to follow it. | What actually belongs in an AI acceptable use policy | 31 | ✓ |
| `/blog/evals-in-ci-for-llm-agents` | evals in ci | Evals in CI for LLM agents, without a golden answer — meshin.co | How to build an eval set from production traffic, score an LLM agent without a golden answer, and fail a merge in CI when it regresses. | Evals in CI for LLM agents, without a golden answer | 28 | ✓ |
| `/blog/how-to-build-an-ai-system-register-in-a-week` | ai system register | How to build an AI system register in a week — meshin.co | A step-by-step way to build an AI system register in a week without buying a tool, so a security reviewer gets the document they ask for first. | How to build an AI system register in a week | 32 | ✓ |
| `/blog/why-your-ai-pilot-never-reached-production` | ai pilot never reached production | Why your AI pilot never reached production — meshin.co | Most AI pilots stall on ownership, data rules and a missing outcome metric, not the model. Here is what has to be true before one reaches production. | Why your AI pilot never reached production | 26 | ✓ |

### blog-category (4)

title `{category name} — meshin.co` · meta: what the category covers, scoped to the 30–300 person buyer · body intent: curated list with one-line stakes per entry

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/category/agentic-architecture` | agentic architecture | Agentic architecture — meshin.co | Agentic architecture here means agent systems built to survive production: evals in CI, tracing, cost ceilings and a rollback path. | Agentic architecture | 22 | ✓ |
| `/blog/category/executive` | ai for boards | AI for boards — meshin.co | AI for boards is accountability, not literacy: what you are on the hook for, what to ask for in writing, and what not to ask for. | AI for boards | 22 | ✓ |
| `/blog/category/governance` | ai governance | AI governance — meshin.co | AI governance in a company of 30 to 300 people is four documents on a shared drive, not a maturity model built for a bank. | AI governance | 22 | ✓ |
| `/blog/category/operating-model` | ai operating model | AI operating model — meshin.co | An AI operating model is the decision structure that moves AI work from a pilot nobody owns to a process a team runs. | AI operating model | 22 | ✓ |

### tag-index (1)

title `Tags — meshin.co` · meta: what tags exist and how many articles carry each one · body intent: browse the tag list, then route into one tag

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/tags` | tags | Tags — meshin.co | The tags used across the writing, with how many articles carry each one. | Tags | 34 | ✓ |

### tag (12)

title `{tag name} — meshin.co` · meta: every article tagged {tag}, newest first · body intent: thin archive list; route straight to the tagged articles

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/blog/tag/acceptable-use-policy` | acceptable use policy | Acceptable use policy — meshin.co | Every article tagged Acceptable use policy, newest first. | Acceptable use policy | 23 | ✓ |
| `/blog/tag/agentic-architecture` | agentic architecture | Agentic architecture — meshin.co | Every article tagged Agentic architecture, newest first. | Agentic architecture | 23 | ✓ |
| `/blog/tag/ai-governance` | ai governance | AI governance — meshin.co | Every article tagged AI governance, newest first. | AI governance | 23 | ✓ |
| `/blog/tag/ai-pilots` | ai pilots | AI pilots — meshin.co | Every article tagged AI pilots, newest first. | AI pilots | 23 | ✓ |
| `/blog/tag/ai-register` | ai register | AI register — meshin.co | Every article tagged AI register, newest first. | AI register | 23 | ✓ |
| `/blog/tag/eu-ai-act` | eu ai act | EU AI Act — meshin.co | Every article tagged EU AI Act, newest first. | EU AI Act | 23 | ✓ |
| `/blog/tag/evals-in-ci` | evals in ci | Evals in CI — meshin.co | Every article tagged Evals in CI, newest first. | Evals in CI | 23 | ✓ |
| `/blog/tag/llm-as-judge` | llm as judge | LLM as judge — meshin.co | Every article tagged LLM as judge, newest first. | LLM as judge | 23 | ✓ |
| `/blog/tag/policy-enforcement` | policy enforcement | Policy enforcement — meshin.co | Every article tagged Policy enforcement, newest first. | Policy enforcement | 23 | ✓ |
| `/blog/tag/production-readiness` | production readiness | Production readiness — meshin.co | Every article tagged Production readiness, newest first. | Production readiness | 23 | ✓ |
| `/blog/tag/security-review` | security review | Security review — meshin.co | Every article tagged Security review, newest first. | Security review | 23 | ✓ |
| `/blog/tag/shadow-ai` | shadow ai | Shadow AI — meshin.co | Every article tagged Shadow AI, newest first. | Shadow AI | 23 | ✓ |

### term (30)

title `What is {term}? — meshin.co` · meta: the definition sentence · body intent: definition → why it matters → adjacent terms

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/glossary/agentic-workflow` | agentic workflow | What is an agentic workflow? — meshin.co | An agentic workflow is a task run by one or more LLM agents that plan steps, call tools and decide what happens next. | Agentic workflow | 22 | ✓ |
| `/glossary/ai-governance` | ai governance | What is AI governance? — meshin.co | AI governance is the decisions, roles and controls a company uses to manage the risk of the AI systems it builds or buys. | AI governance | 22 | ✓ |
| `/glossary/ai-impact-assessment` | ai impact assessment | What is an AI impact assessment? — meshin.co | An AI impact assessment is a written check, before a high-risk system goes live, of who it affects and whether they can challenge its decision. | AI impact assessment | 24 | ✓ |
| `/glossary/ai-management-system` | ai management system | What is an AI management system? — meshin.co | An AI management system is the recurring set of policies, roles and reviews a company runs to govern its AI, not a one-off risk assessment. | AI management system | 23 | ✓ |
| `/glossary/ai-register` | ai register | What is an AI register? — meshin.co | An AI register is a company's own inventory of every AI system it uses, who owns each one, and how risky it is. | AI register | 22 | ✓ |
| `/glossary/conformity-assessment` | conformity assessment | What is a conformity assessment? — meshin.co | A conformity assessment is the check, self-run or done by an outside body, that proves a high-risk AI system meets the EU AI Act before sale. | Conformity assessment | 23 | ✓ |
| `/glossary/data-classification` | data classification | What is data classification? — meshin.co | Data classification is labelling data by sensitivity, such as public, internal or restricted, before deciding what may reach an AI tool. | Data classification | 23 | ✓ |
| `/glossary/dpia` | dpia | What is a DPIA? — meshin.co | A DPIA, or data protection impact assessment, is a written GDPR check of privacy risk before high-risk personal-data processing begins. | DPIA | 23 | ✓ |
| `/glossary/eu-ai-act` | eu ai act | What is the EU AI Act? — meshin.co | The EU AI Act is an EU regulation that sorts AI systems into risk tiers and sets legal obligations, heaviest for high-risk systems. | EU AI Act | 22 | ✓ |
| `/glossary/evals` | evals | What are evals? — meshin.co | Evals are repeatable tests that score an AI system's output against fixed examples, run before release and after every change. | Evals | 22 | ✓ |
| `/glossary/guardrails` | guardrails | What are guardrails in an AI system? — meshin.co | Guardrails are checks enforced in code around what a model can be asked and what it can say or do, not rules typed into a prompt. | Guardrails | 23 | ✓ |
| `/glossary/hallucination-rate` | hallucination rate | What is a hallucination rate? — meshin.co | A hallucination rate is the share of a model's answers that are confidently wrong, measured against real questions with known correct answers. | Hallucination rate | 23 | ✓ |
| `/glossary/high-risk-ai-system` | high-risk ai system | What makes an AI system high-risk? — meshin.co | A high-risk AI system is one the EU AI Act singles out, by product-safety law or by use case such as hiring or credit, for its heaviest duties. | High-risk AI system | 24 | ✓ |
| `/glossary/human-in-the-loop` | human-in-the-loop | What is human-in-the-loop? — meshin.co | Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, not the system acting alone. | Human-in-the-loop | 22 | ✓ |
| `/glossary/human-oversight` | human oversight | What does human oversight require under the EU AI Act? — meshin.co | Human oversight is the EU AI Act duty that a person assigned to watch a high-risk system can actually understand it and stop it. | Human oversight | 23 | ✓ |
| `/glossary/iso-iec-42001` | iso/iec 42001 | What is ISO/IEC 42001? — meshin.co | ISO/IEC 42001 is the first international, certifiable standard for the management system a company runs to govern its AI. | ISO/IEC 42001 | 23 | ✓ |
| `/glossary/llm-gateway` | llm gateway | What is an LLM gateway? — meshin.co | An LLM gateway is a single service every call to a language model passes through, for auth, logging and filtering. | LLM gateway | 22 | ✓ |
| `/glossary/model-card` | model card | What is a model card? — meshin.co | A model card is a short document a model's maker publishes on what it was built for, how it performs, and where not to use it. | Model card | 23 | ✓ |
| `/glossary/model-provenance` | model provenance | What is model provenance? — meshin.co | Model provenance is a traceable record of what a model was built from - its base model, its training data, and the licence covering both. | Model provenance | 24 | ✓ |
| `/glossary/nist-ai-rmf` | nist ai rmf | What is the NIST AI RMF? — meshin.co | The NIST AI Risk Management Framework is a voluntary US framework for managing AI risk across a system's whole lifecycle. | NIST AI RMF | 22 | ✓ |
| `/glossary/observability` | observability | What is observability for an AI system? — meshin.co | Observability is the ability to see exactly what a live AI system was asked, what it did, and what it answered, for any one case. | Observability | 24 | ✓ |
| `/glossary/post-market-monitoring` | post-market monitoring | What is post-market monitoring under the EU AI Act? — meshin.co | Post-market monitoring is the EU AI Act duty to keep collecting real-world data on a high-risk system after it ships, not just before. | Post-market monitoring | 23 | ✓ |
| `/glossary/prompt-injection` | prompt injection | What is prompt injection? — meshin.co | Prompt injection is text, typed directly or hidden in a document a model reads, that gets the model to follow it as an instruction. | Prompt injection | 23 | ✓ |
| `/glossary/provider-vs-deployer` | provider vs deployer | What is the difference between a provider and a deployer? — meshin.co | Provider and deployer are EU AI Act roles - a provider builds or brands a system, a deployer uses it, and the two owe different duties. | Provider vs deployer | 23 | ✓ |
| `/glossary/red-teaming` | red teaming | What is red teaming for an AI system? — meshin.co | Red teaming is deliberately trying to break an AI system the way an attacker would, before they do, to find the failure nobody tested. | Red teaming | 23 | ✓ |
| `/glossary/retrieval-augmented-generation` | retrieval augmented generation | What is retrieval augmented generation? — meshin.co | Retrieval augmented generation, or RAG, has a model look up relevant passages at answer time instead of relying only on its training. | Retrieval augmented generation | 23 | ✓ |
| `/glossary/serious-incident-reporting` | serious incident reporting | What counts as a serious incident under the EU AI Act? — meshin.co | Serious incident reporting is the EU AI Act duty to tell a regulator, fast, when a high-risk system causes real harm or a rights breach. | Serious incident reporting | 23 | ✓ |
| `/glossary/shadow-ai` | shadow ai | What is shadow AI? — meshin.co | Shadow AI is any AI tool staff use for company work without IT or security's knowledge, from an app to a browser extension. | Shadow AI | 22 | ✓ |
| `/glossary/sub-processor` | sub-processor | What is a sub-processor? — meshin.co | A sub-processor is a vendor an AI provider uses behind the scenes to handle a company's data, and GDPR requires permission before it does. | Sub-processor | 23 | ✓ |
| `/glossary/technical-documentation` | technical documentation | What is technical documentation under the EU AI Act? — meshin.co | Technical documentation is the dossier a provider keeps on a high-risk AI system - its purpose, design, data, performance and monitoring plan. | Technical documentation | 24 | ✓ |

### faq-answer (25)

title `{question} — meshin.co` · meta: first sentence of the answer · body intent: direct answer → mechanism → next step

| Route | Query | Title | Description | H1 | Links | Opening |
|---|---|---|---|---|---|---|
| `/faq/are-models-trained-on-our-customer-data` | are models trained on our customer data? | Are models trained on our customer data? — meshin.co | Are models trained on our customer data? Not by default. I use vendor terms that exclude your data from model training, the same enterprise. | Are models trained on our customer data? | 22 | ✓ |
| `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system` | can you get us certified to iso/iec 42001, or do you just build a working system? | Can you get us ISO/IEC 42001 certified? — meshin.co | Certification comes from an accredited body after an independent audit, not from me: my work gets your management system and evidence trail audit-ready. | Can you get us certified to ISO/IEC 42001, or do you just build a working system? | 23 | ✓ |
| `/faq/can-you-work-with-our-existing-ai-vendor-or-platform` | can you work with our existing ai vendor or platform, or do you bring your own tools? | Can you work with our existing AI vendor? — meshin.co | Can you work with our existing AI vendor, or platform, or do you bring your own tools? I work with what you already run: OpenAI, Anthropic, Azure. | Can you work with our existing AI vendor or platform, or do you bring your own tools? | 23 | ✓ |
| `/faq/how-do-you-charge-for-the-work` | how do you charge for the work? | How do you charge for the work? — meshin.co | How do you charge for the work? Three fixed structures, no hourly billing. The Assessment is a fixed fee for the two weeks. | How do you charge for the work? | 23 | ✓ |
| `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off` | how does ai risk get recorded, and who signs it off? | How does AI risk get recorded, and who signs it off? — meshin.co | How does AI risk get recorded, and who signs it off? In an AI register: one line per initiative, its data flows, its risk level, and its owner. | How does AI risk get recorded, and who signs it off? | 23 | ✓ |
| `/faq/how-does-the-retainer-end` | how does the retainer end? | How does the Retainer end? — meshin.co | With a named internal owner in place and the decisions that got made written down, not with a call that quietly stops getting returned. | How does the Retainer end? | 23 | ✓ |
| `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed` | how is a prompt or model change stopped from shipping unnoticed? | How is a prompt or model change caught? — meshin.co | How is a prompt, or model change stopped from shipping unnoticed? Evals in continuous integration: a test set that runs on every change. | How is a prompt or model change stopped from shipping unnoticed? | 23 | ✓ |
| `/faq/how-is-cost-per-outcome-measured` | how is cost per outcome measured? | How is cost per outcome measured? — meshin.co | How is cost per outcome measured? On a dashboard built during the Sprint. Total spend on the workflow, model calls included. | How is cost per outcome measured? | 23 | ✓ |
| `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer` | how quickly can you start, and how does availability work for a remote officer? | How quickly can you start as a remote officer? — meshin.co | One client gets one or two days a week at a time, which is what makes me actually reachable instead of spread across five accounts. | How quickly can you start, and how does availability work for a remote officer? | 22 | ✓ |
| `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer` | is my company too small, or too early, for a fractional chief ai officer? | Is my company too small for a Fractional CAIO? — meshin.co | Is my company too small, or too early, for a Fractional Chief AI Officer? Size isn't the real test. If you're running pilots that never reach production. | Is my company too small, or too early, for a Fractional Chief AI Officer? | 22 | ✓ |
| `/faq/what-counts-as-in-production-for-the-90-day-sprint` | what counts as 'in production' for the 90-day sprint? | What counts as 'in production' for the 90-day Sprint? — meshin.co | What counts as 'in production' for the 90-day Sprint? Real users or real transactions, monitored, with a rollback path and someone on call — that is the bar. | What counts as 'in production' for the 90-day Sprint? | 23 | ✓ |
| `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | what do nist ai rmf, iso/iec 42001 and the eu ai act each require of a company our size? | What do NIST, ISO/IEC 42001 and the EU AI Act require? — meshin.co | What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size? None of the three sets a headcount threshold. | What do NIST AI RMF, ISO/IEC 42001 and the EU AI Act each require of a company our size? | 23 | ✓ |
| `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval` | what do we do about tools staff are already using without approval? | What about tools staff use without approval? — meshin.co | Put them in the register rather than pretend they aren't there; banning them after the fact just pushes the same behaviour further underground. | What do we do about tools staff are already using without approval? | 23 | ✓ |
| `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | what does a fractional chief ai officer actually do, and how is that different from an advisor? | What does a Fractional Chief AI Officer do? — meshin.co | I carry the AI risk register, review every initiative, sign the answers to security questionnaires, and sit in design reviews. | What does a Fractional Chief AI Officer actually do, and how is that different from an advisor? | 22 | ✓ |
| `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | what does the two-week assessment produce, and is the fee credited if we continue? | What does the two-week Assessment produce? — meshin.co | A memo your board can act on: a readiness score across strategy, data, delivery, people, and governance, a gap list against NIST AI RMF, ISO/IEC 42001. | What does the two-week Assessment produce, and is the fee credited if we continue? | 23 | ✓ |
| `/faq/what-happens-if-the-evals-say-a-workflow-isnt-good-enough` | what happens if the evals say a workflow isn't good enough? | What if the evals say a workflow is not enough? — meshin.co | What happens if the evals say a workflow isn't good enough? Then it does not ship. The Sprint ends with a written account of why the workflow fell short. | What happens if the evals say a workflow isn't good enough? | 23 | ✓ |
| `/faq/what-happens-on-a-fit-call-and-does-it-cost-anything` | what happens on a fit call, and does it cost anything? | What happens on a fit call, and does it cost anything? — meshin.co | What happens on a fit call, and does it cost anything? It costs nothing and runs thirty minutes, booked at cal.com/meshin. | What happens on a fit call, and does it cost anything? | 23 | ✓ |
| `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` | what if the ai we're building goes into a product we sell, not just an internal workflow? | What if our AI goes into a product we sell? — meshin.co | What if the AI we're building goes into a product we sell, not just an internal workflow? Both are covered, and the obligations differ. | What if the AI we're building goes into a product we sell, not just an internal workflow? | 23 | ✓ |
| `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead` | what if we already have a data science team or an internal ai lead? | What if we already have a data science team? — meshin.co | What if we already have a data science team, or an internal AI lead? Your data science team stays exactly where it is: I do not write models, tune pipelines. | What if we already have a data science team or an internal AI lead? | 22 | ✓ |
| `/faq/what-size-of-company-do-you-actually-work-with` | what size of company do you actually work with? | What size of company do you actually work with? — meshin.co | What size of company do you actually work with? Companies of thirty to three hundred people, usually with at least one engineer. | What size of company do you actually work with? | 22 | ✓ |
| `/faq/whats-the-difference-between-the-assessment-the-sprint-and-the-retainer` | what's the difference between the assessment, the sprint and the retainer? | Assessment, Sprint or Retainer: what differs? — meshin.co | What's the difference between the Assessment, the Sprint, and the Retainer? The Assessment is two weeks at a fixed fee, and ends in a memo on where you stand. | What's the difference between the Assessment, the Sprint and the Retainer? | 23 | ✓ |
| `/faq/who-answers-customer-security-questionnaires` | who answers customer security questionnaires? | Who answers customer security questionnaires? — meshin.co | Who answers customer security questionnaires? I do, as the named officer on record. That is a core part of the Retainer: procurement answers. | Who answers customer security questionnaires? | 23 | ✓ |
| `/faq/who-owns-the-code-and-the-data` | who owns the code and the data? | Who owns the code and the data? — meshin.co | Who owns the code and the data? You do, both. The code lives in your repositories from the first commit, under your licence, and your review rules. | Who owns the code and the data? | 22 | ✓ |
| `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement` | who owns the frameworks, templates and playbooks built during the engagement? | Who owns the frameworks and playbooks I build? — meshin.co | Everything written for your business — the register, the policies, the runbooks — belongs to you, the same as your code and data do. | Who owns the frameworks, templates and playbooks built during the engagement? | 23 | ✓ |
| `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` | why hire a fractional officer instead of a full-time head of ai? | Why hire a fractional officer over a full-time head? — meshin.co | A named officer on your customers' security reviews, and your board's roadmap — that is the accountability you get, without a full-time salary. | Why hire a fractional officer instead of a full-time head of AI? | 23 | ✓ |
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
Passage: "A named officer on your customers' security reviews and your board's roadmap — that is the accountability you get, without a full-time salary, a hiring process, or a seat that sits empty between AI decisions." (`/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`)
Why: the honest comparison is the sales objection to overcome before any call (PRD §6 CTO persona).
GAP: no side-by-side cost comparison with numbers — public prices are deliberately withheld (L8), so the comparison must argue cost _shape_, not figures; a dedicated comparison article is Phase 6.

**3. AI readiness assessment template for SMB**
Must win: `/resources/ai-readiness-scorecard`, support `/services/ai-readiness-and-risk-assessment`.
Passage: "A five-axis AI readiness scorecard you score yourself: strategy, data, delivery, people, governance." (`/resources/ai-readiness-scorecard`)
Why: "template" intent wants an artifact, not a service page — the free scorecard is the entry to the paid Assessment (PRD §4, PRD §5 downloads metric).

**4. AI governance consultant ISO 42001 small company**
Must win: `/services/ai-readiness-and-risk-assessment`, support `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`, `/glossary/iso-iec-42001`.
Passage: "My work is built to get your management system, risk register, and evidence trail to the point an auditor would recognise as ready." (`/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`)
Why: consultant-intent query with a standard named — the service page must own it before a directory or agency does (PRD §6).
GAP (thin): the planned article "ISO 42001 for companies without a compliance team" (PRD §15 row 10) would strengthen it; today's coverage is service + FAQ + definition.

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
Passage: "The EU AI Act is an EU regulation, in force since August 2024, that sorts AI systems into risk tiers, from banned practices to high-risk systems, and sets legal obligations that scale with the tier." (`/glossary/eu-ai-act`)
Why: regulatory facts must come from primary sources and be dated (PRD §15 editorial rules); definitions are the citable unit.
GAP (thin): the planned deployer-obligations article for small B2B (PRD §15 row 6) is not built; today's answer is definitional, not a checklist.

**9. why do AI pilots fail to reach production**
Must win: `/blog/why-your-ai-pilot-never-reached-production`.
Passage: "Most AI pilots stall on ownership, data rules and a missing outcome metric, not the model." (article lead)
Why: the #1 founder trigger (PRD §6 persona "пилоты не доходят до прода"); the home Signals block mirrors it for the 30-second test.

**10. LLM gateway for governance and audit**
Must win: `/glossary/llm-gateway`, support `/resources/llm-gateway-governance-config`.
Passage: "A governance config for an LLM gateway. It decides what gets logged, redacted, and who may call which model." (`/resources/llm-gateway-governance-config`)
Why: engineering-intent query from the CTO persona (PRD §6); the config artifact proves practice, feeding the downloads metric.
GAP (thin): the planned "LLM gateway as a governance control" article (PRD §15 row 7) would own the long-form answer.

**11. how to put evals for AI agents into CI**
Must win: `/blog/evals-in-ci-for-llm-agents`, support `/resources/agent-evals-ci-starter`.
Passage: "How to build an eval set from production traffic, score an LLM agent without a golden answer, and fail a merge in CI when it regresses." (article lead)
Why: the engineering credibility wedge — evals in CI is the Sprint's success criterion (PRD §4).

**12. AI vendor assessment questionnaire template**
Must win: `/resources/ai-governance-starter-kit`.
Passage: "AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire." (kit lead)
Why: the questionnaire is inside the kit; one artifact page covering four procurement documents matches how the buyer searches.
GAP (thin): if the kit under-performs for this prompt, split the questionnaire into its own resource page in Phase 6.

**13. build vs buy AI 3-year TCO**
Must win: `/resources/build-vs-buy-ai-kit`.
Passage: "The build vs buy AI kit: a one-page worksheet of the criteria I work through before recommending either path." (kit lead)
Why: executive-intent query (PRD §15 row 8 theme); worksheet answers the decision frame.
GAP: no 3-year TCO _model_ with worked numbers — the planned TCO template article (PRD §15 row 8) is not built. Client-side generic math is compatible with L8 (no public prices); Phase 6.

**14. AI operating model for mid-size company**
Must win: `/approach` + `/blog/category/operating-model`.
Passage: "This is how a Fractional AI Officer works: six signals, always in the same order, before I touch any code." (`/approach`)
Why: the operating model IS the approach's subject; the category clusters the supporting articles.
GAP: no dedicated "AI operating model" anchor article — the hub lists related articles but none owns the phrase. Phase 6.

**15. how to hand over AI leadership to internal team**
Must win: `/faq/how-does-the-retainer-end`, support `/services/fractional-caio-retainer`, `/approach` (sixth signal).
Passage: "The handover plan exists from the first month, not the last." (`/faq/how-does-the-retainer-end`)
Why: handover is the retainer's exit promise (PRD §4) and the approach's structurally hardest signal.
GAP: the planned handover playbook article + Handover Playbook artifact (PRD §15 row 13) are not built. Phase 6.

#### Locale prompts

**16. fractional AI officer Israel**
**17. fractional AI leader Europe remote**
Must win: `/about` (intended), support `/`, `/contact`.
Passage: "I'm Dmitri Meshin, a platform engineer by trade." (`/about`); "Remote worldwide." is the only location line, on `/about`, `/contact` and `/imprint` — Israel is never named.
Why: PRD §1 fixes LOCATION_TEXT "Israel · remote worldwide"; local queries are won by local evidence.
**GAP (hard for 16, thin for 17):** "Israel" appears on **no built page** as of 2026-09-13 (checked `dist/` site-wide); "Europe" appears only inside EU AI Act regulation names on `/glossary/eu-ai-act`, never as a location. The about page must state the full location line before prompt 16 can be won. Phase 6, copy fix.

#### Engineering prompts

**18. agentic automation consultant for B2B**
Must win: `/services/90-day-production-sprint`, support `/case-studies`.
Passage: "One process live in production, with evals in CI." (`/services/90-day-production-sprint`)
Why: consultant-intent mapped to the delivery offer; the sprint page is the transactional answer.

**19. MCP security best practices**
**GAP (hard):** no route. The glossary has no MCP term and no article covers it (the approach stack mentions "Tools via MCP (least privilege)" only in diagram labels). Needs a glossary term first (cheap, citable), an article second. Phase 6.

**20. multi-agent reference architecture production**
Must win (partial): `/approach` (referenced stack, PRD Appendix B).
Passage: the stack diagram layers agents, tools, gateway, evals, governance — strong material, but a diagram is not a citable reference architecture.
Why: the CTO persona validates the consultant on architecture before anything else (PRD §6 path `/approach → /resources → GitHub`); the diagram is that proof, prose is what retrieval can cite.
**GAP:** no article owns "reference architecture" as prose. Phase 6 (PRD §15 agentic-architecture theme).

**21. adoption telemetry for AI tools**
**GAP (hard):** no route. The planned article + dashboard template (PRD §15 row 12) are not built. Phase 6.

**22. AI incident response plan template**
Must win (partial): `/glossary/serious-incident-reporting`.
Passage: "Serious incident reporting is the EU AI Act duty to notify the relevant national authority after a high-risk AI system causes serious harm." (term definition)
Why: the regulatory duty is defined; the _template_ the prompt asks for does not exist.
**GAP:** incident-response plan artifact. Candidate addition to the starter kit or a standalone resource. Phase 6.

**23. data classification for LLM usage**
Must win: `/glossary/data-classification`, support `/resources/ai-governance-starter-kit` (classification included).
Passage: "Data classification means labelling what is in a dataset, document or prompt by sensitivity." (`/glossary/data-classification`)
Why: the exact bridge between the compliance term and the LLM use case; NIST-anchored (PRD §15 sourcing rules).

**24. ISO 42001 gap assessment**
Must win: `/glossary/iso-iec-42001` + `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`.
Passage: "ISO/IEC 42001 is an international standard that sets out what an AI management system must do." (term definition)
Why: gap-assessment intent is Assessment-adjacent — the service page maps gaps against ISO/IEC 42001 (PRD §4 Assessment).
GAP (thin): the gap-assessment sheet artifact (PRD §15 row 10) is not built.

**25. NIST AI RMF for small companies**
Must win: `/glossary/nist-ai-rmf`, support `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`, `/services/ai-readiness-and-risk-assessment` (scores against NIST AI RMF).
Passage: "The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework, published by NIST in January 2023, for identifying and managing the risks of an AI system across its design, development and use." (term definition)
Why: framework-of-record for the Assessment; the "for small companies" scoping comes from the FAQ's headcount answer ("None of the three sets a headcount threshold").

**26. fractional CAIO pricing**
Must win: `/pricing`, support `/faq/how-do-you-charge-for-the-work`.
Passage: "Every offer is a fixed structure rather than an hourly rate. The number reaches you in writing before any work starts." (`/pricing`)
Why: pricing queries are trust queries; fixed structures answer the trust without the numbers (L8 — prices only on the fit call, by owner decision 2026-09-12).

**27. what does a chief AI officer do in a 50 person company**
Must win: `/faq/what-does-a-fractional-chief-ai-officer-actually-do`.
Passage: "I carry the AI risk register, review every initiative, sign the answers to security questionnaires, and sit in design reviews, all as a named officer on your side." (FAQ answer)
Why: the definitional role query at SMB scale; one URL, one answer (L20).

**28. AI governance starter kit open source**
Must win: `/resources/ai-governance-starter-kit`.
Passage: "AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire." (kit lead)
Why: exact-match artifact query; the downloads metric (PRD §5) counts it. GitHub repos land later (L10) — until then the page carries the full content.

**29. AI readiness scorecard five drivers**
Must win: `/resources/ai-readiness-scorecard`, support `/services/ai-readiness-and-risk-assessment` ("score you on five readiness drivers").
Passage: "A five-axis AI readiness scorecard you score yourself: strategy, data, delivery, people, governance." (resource lead)
Why: the "five drivers" phrasing must appear verbatim-adjacent so retrieval can bind it; free scorecard → paid Assessment path.

**30. board memo AI strategy one page**
Must win: `/services/ai-readiness-and-risk-assessment`.
Passage: "Two weeks to a memo your board can act on." (service H1-adjacent lead; "ends in a memo your board can act on" in the body)
Why: the board-memo deliverable is the Assessment's output and the board-pressure trigger (PRD §6 Signals).

### GAP register — feeds Phase 6 content plans

| #                | Prompt                             | Gap                                                                                                         | Planned source                         |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 16, 17           | Israel / Europe remote             | "Israel" never appears site-wide; "remote worldwide" only as a three-page aside (copy fix, not new content) | PRD §1 LOCATION_TEXT into about/footer |
| 19               | MCP security best practices        | No route at all                                                                                             | new glossary term + article            |
| 21               | adoption telemetry                 | No route at all                                                                                             | PRD §15 row 12                         |
| 2                | fractional vs full-time cost       | No cost-shape comparison article                                                                            | PRD §15 executive theme, L8-aware      |
| 13               | build vs buy 3-year TCO            | Worksheet exists, TCO model absent                                                                          | PRD §15 row 8                          |
| 14               | AI operating model                 | No anchor article                                                                                           | PRD §15 operating-model theme          |
| 15               | handover to internal team          | FAQ covers it; no playbook                                                                                  | PRD §15 row 13                         |
| 20               | multi-agent reference architecture | Diagram only, no prose owner                                                                                | PRD §15 agentic-architecture theme     |
| 22               | AI incident response template      | Definition only, no artifact                                                                                | starter-kit addition                   |
| 4, 8, 10, 12, 24 | thin coverage                      | Definition/service exist; planned long-form/artifact missing                                                | PRD §15 rows 6, 7, 10                  |

Standing note (resolved 2026-09-13): `--check` had reported `/case-studies/only-help-agentic-support` built without a `content-facts.json` row; the row ("agentic support triage case study") was landed by a sibling packet and the orphan is closed. Remaining `--check` findings during the 4.5b landing window are the 13 tag-route facts rows ahead of their built routes — they clear at the integration build.

### Phase 6 worklist — cheapest fix first

One row per declared GAP prompt (the register above), ranked by build cost, cheapest first. This
names the page and what it must contain to win the answer; it does not author the content — the
owner supplies the facts (AGENTS.md: never invent an owner fact, a client name, a metric).

1. **Prompts 16, 17 — Israel / Europe remote.** Copy-only, zero new routes. Add the full
   `LOCATION_TEXT` ("Israel · remote worldwide", PRD §1) to `/about`'s visible body text, not only
   its `<meta name="description">` — today "Remote worldwide." exists only in meta on `/about`,
   `/contact` and `/imprint`. Closes the absence this doc's own `absenceFindings` check re-tests on
   every `--check` run.
2. **Prompt 2 — fractional vs full-time cost.** Copy-only, existing FAQ. One paragraph on
   `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` naming the cost _shape_:
   retainer fee vs. salary + equity + recruiting + ramp time. No dollar figures (L8).
3. **Prompt 13 — build vs buy 3-year TCO.** Copy-only, existing resource. Extend
   `/resources/build-vs-buy-ai-kit` with a TCO _framework_ section: the cost categories to fill in
   (build: engineering time, maintenance, drift monitoring; buy: license, integration, lock-in).
   Generic math only, no public prices (L8).
4. **Prompt 22 — AI incident response plan template.** Copy-only, existing resource. Add an
   incident-response-plan section to `/resources/ai-governance-starter-kit`: who is notified, in
   what order, tied to the EU AI Act serious-incident timeline already defined at
   `/glossary/serious-incident-reporting`.
5. **Prompt 19 — MCP security best practices.** One new term — the cheapest new route, since it
   reuses the `term` family's template exactly. New `/glossary/mcp` (or
   `/glossary/model-context-protocol`): a definition sentence, why an agent's tool access needs
   least-privilege scoping, adjacent terms `guardrails` and `prompt-injection`.
6. **Prompts 4, 8, 10, 12, 24 — thin-coverage batch.** Copy-only additions to five existing pages,
   no new routes: a gap-assessment paragraph on `/glossary/iso-iec-42001` and
   `/services/ai-readiness-and-risk-assessment` (24); a deployer-obligations checklist paragraph on
   `/glossary/provider-vs-deployer` (8); an "LLM gateway as a governance control" paragraph on
   `/glossary/llm-gateway` (10); split or flag the vendor questionnaire inside
   `/resources/ai-governance-starter-kit` (12); explicit ISO/IEC 42001 language on
   `/services/ai-readiness-and-risk-assessment` (4).
7. **Prompt 14 — AI operating model anchor.** One new article — full write, sourcing and evals per
   the article family's rules. A `/blog/...` article that owns "AI operating model" as prose,
   cross-linked from `/approach` and `/blog/category/operating-model`.
8. **Prompt 20 — multi-agent reference architecture.** One new article. A prose companion to the
   `/approach` stack diagram (PRD Appendix B) that retrieval can cite — a diagram is not a citable
   unit.
9. **Prompt 15 — handover to internal team.** One new article plus one new resource artifact.
   A "Handover Playbook" article and resource (PRD §15 row 13), cross-linked from
   `/faq/how-does-the-retainer-end`.
10. **Prompt 21 — adoption telemetry.** One new article plus a new dashboard-template artifact —
    the most expensive item here, since the dashboard template is a new artifact type, not an
    extension of an existing one (PRD §15 row 12).
