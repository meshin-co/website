---
record: true
---

# 10. What already exists for each of the seven resources

Date: 2026-11-10. Read-only reconnaissance by five parallel research agents, no change to the site.

Every one of the seven `/resources/*` pages links to `https://github.com/meshin-co/<slug>`, and every one of
those links is a 404. Before writing any of them, this record establishes what a practitioner can already get
today, from whom, under what licence, and what is genuinely missing. The full agent reports are the evidence
behind the summaries here; the figures were read from the GitHub API, the npm and PyPI download APIs, OpenAlex
and the primary documents, on 2026-11-10 unless a different date is given.

A claim here is either **verified**, meaning an agent read it from the source named, or marked
`[INFERENCE]`. Nothing in this record is a plan. The decisions it feeds are taken elsewhere. The five raw
agent reports are kept beside this file in `investigation/10-sources/`, one per research question, because
this summary is lossy and the figures in it should be checkable against what the agent actually read.

## The finding that reorders everything

**Canonicity comes from being consumed by a tool, not from being read by a person.**

| Winner               | What reads it                                             | Scale of the reader                               | Scale of the artefact               |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Semantic Versioning  | the npm `semver` parser                                   | 1,172,512,764 downloads in the week to 2026-11-09 | 7,874 stars on the spec             |
| Keep a Changelog     | `git cliff --init keepachangelog`                         | —                                                 | —                                   |
| Contributor Covenant | GitHub's own `CODE_OF_CONDUCT.md` picker, from 2017-06-14 | every repository on GitHub                        | —                                   |
| caniuse              | `caniuse-lite`                                            | 283,476,974 downloads a week                      | single author, unknown at the start |

Every clear loser in the same study — CalVer, the EU's ALTAI, the Citizen Code of Conduct, TLDRLegal — has no
tool that eats it. The corollary is uncomfortable for a document kit: **a resource no program can read has no
mechanical path to becoming canonical.**

Three further results from the same research, each with a number behind it:

- **Comprehensiveness loses, in this exact category.** Model Cards 3,710 citations and Datasheets for Datasets
  3,897, against IBM's FactSheets — explicitly the more complete, whole-service version — at 527
  (OpenAlex W2897042519, W2795038878, W2911599914). Of ALTAI, free and Commission-backed:
  "No developer chose ALTAI final documentation as an option" (arXiv 2512.15791).
- **Licence is the mechanical lever, not freshness.** The Stack took only GitHub repositories whose licence
  permits redistribution. Semantic Versioning has no licence file at all and won anyway; Contributor Covenant
  reads `NOASSERTION`; the 12-Factor App had no substantive revision between 2012 and 2024-11-12 and stayed
  canonical. Dormancy kills only artefacts that enumerate a moving world — which a governance kit is.
- **`llms.txt` is not a distribution channel.** Ahrefs, 137,210 domains, May 2026: 28% publish it, 97% received
  zero requests for it, and AI retrieval bots accounted for 1.1% of requests, 233 in total. Google's own
  guidance says it does not use them, structured data is not required and chunking is unnecessary.
- **Winners are cited at versioned project paths, never at a repository URL** — `keepachangelog.com/en/1.1.0/`,
  not a GitHub link. Seven `github.com/meshin-co/<slug>` links are therefore seven liabilities in their
  current form.

Cold start, in every case studied, was one borrowed audience on one day: Keep a Changelog through The
Changelog podcast #127 on 2014-08-08, ten weeks after launch; the 12-Factor App through Hacker News in
November 2011, with 37 comments. Measured spans: about ten weeks to the first inbound link, eighteen months
to the first volunteer translation, three to four and a half years to being a stranger's default, seven to
thirteen years to institutional custody.

## 1. AI governance starter kit

**Demand.** `ai governance framework` 803 exact monthly impressions, unserved by any route; `ai governance`
2,923, served; `ai governance policy` 32, unserved. Adjacent: `nist ai rmf` 6,899, `eu ai act` 5,482,
`iso 42001` 991, `dpia` 1,041.

**The ceiling is low and the field is empty at the top.** A GitHub search for `"ai governance"` in name and
description returns 5,641 repositories. Every one of the top results by stars is software, not documents:
trustgraph 2,906, obot 1,178, verifywise 374. The highest-starred **document set** is
`finos/ai-governance-framework` at 118 stars, CC BY 4.0, under the Linux Foundation, last pushed 2026-11-04.
The highest-starred **template** repository is `Ankit-Uniyal/iso-42001-ai-governance-toolkit` at 33 stars, MIT,
last pushed 2026-08-02. There is no incumbent to displace, and equally no evidence that anyone forks
governance documents.

**One assumption going in was wrong.** The premise that no repository pairs each required document with the
role that signs it is false: `Ankit-Uniyal`'s `10-ANNEX-A-CONTROLS.md` carries per-control
`Document | Description | Owner` tables, a RACI matrix and an ownership register, and `nosistech`'s policy
carries an approval and signature block. The real gap is narrower and sharper: **nobody joins the inbound
question to the document to the signer to the evidence.** The questionnaire side exists free — HECVAT 4.1.6
carries an AI question set at no licence fee, and the CSA's AI-CAIQ has 320 questions. The document side
exists. The crosswalk between them is empty.

**Machine-readability is already solved upstream, by NIST.** `https://airc.nist.gov/docs/playbook.json` is the
Playbook as JSON: 72 subcategories, keyed `section_actions`, `section_doc`, `AI Actors`. There is an official
OSCAL catalogue at `usnistgov/oscal-content/nist.gov/AI100-1/v1.0`. FINOS carries YAML front matter with
`iso-42001_references`, `eu-ai-act_references`, `nist-sp-800-53r5_references` and `mitigates`.
`Principled-Evolution/gopal` holds 85 Rego policies under Apache 2.0. So "we made it YAML" is not novel.
**But nothing is consumed as a dependency:** an npm search returns zero content packages, and the nearest
runtime engines sit at 40 and 17 monthly downloads.

**What licences permit.** ISO/IEC 42001 costs CHF 225 and 42005 CHF 181, and the licence grants no rights of
reproduction, distribution, adaptation or derivative works — which is why a 175 KB MIT-licensed file
reproducing all 38 Annex A controls in near-ISO wording has no provenance trail. The Secure Controls Framework
is CC BY-ND 4.0, and its derivative ban covers AI-generated policies explicitly. The CNIL's nine AI sheets are
CC BY-ND 4.0 FR, so the French regulator's material cannot be adapted. Clean raw material: NIST (public
domain), the EU (CC BY 4.0 under Decision 2011/833/EU), the ICO (Open Government Licence v3.0), the OECD
(CC BY 4.0 for works published after 2024-07-01), FINOS and HECVAT.

**The deployer side is empty, and one state withdrew.** The EU has published GPAI templates only: a
training-content summary on 2025-07-24 and a serious-incident report for systemic-risk models on 2025-11-04.
The Annex IV technical-documentation form is unpublished. The Article 27 fundamental-rights impact assessment
questionnaire is unpublished. Article 26 deployer duties bind with no template at all: logs kept at least six
months, named competent oversight, notify and suspend. In the United Kingdom, DSIT confirmed in December 2025
that it will not publish the AI Management Essentials tool.

**The paid layer a free kit would displace.** Advisera sells 30 documents for US$897. IBM watsonx.governance
is US$3,500 to US$6,450 a month by IBM's own pricing page, and its AWS Marketplace listing starts at
US$42,000.

**Someone is building this right now.** `nosistech/governance-templates` was created 2026-10-19 and last
pushed 2026-11-10 — the same day as this research. CC BY 4.0. It promises an acceptable-use policy, a risk
register, a vendor questionnaire and an incident playbook; only the first exists, and the other three are
marked "coming soon". Same scope, same plain-language register.

## 2. Agent evals CI starter

**Demand.** `evals` 2,459 exact monthly impressions, served by the glossary route.

**The ranking by stars is wrong.** `inspect-ai` takes 2,896,739 PyPI downloads a month against `deepeval`'s
2,584,198, on one sixth of the stars (3,219 against 19,411). OpenAI's own `evals` repository has 19,724 stars
and 457 downloads a month, last commit 2026-04-14. Ragas has moved to `vibrantlabsai/ragas`, last commit
2026-02-24, and its `agent_evals` template still reads "coming soon" — 1.05M downloads a month of an
unmaintained library.

**The most-downloaded tool in the category is now owned by a model provider.** promptfoo's README states that
it is now part of OpenAI and remains open source under MIT; the latest commit, `b3603fa` on 2026-11-09, is
authored from an `openai.com` address. Its selling point was neutral comparison between GPT, Claude and
Gemini. It takes 4,137,504 npm downloads a month.

**The gap is the CI wiring, and one ratio proves it.** The only first-party GitHub Action in the category,
`promptfoo/promptfoo-action`, has 81 stars and 36 forks against 4.1M downloads of the runner it gates. Its own
README says it evaluates only the current checkout and does not run separate base and head evaluations — so
there is no baseline comparison.

**No forkable baseline-regression gate exists.** A GitHub repository search for agent-eval CI starters
returned `total_count: 0`. DeepEval's own guide to regression testing in CI contains no baseline at all: a
`threshold=0.5` in pytest, then the claim that a regression suite is now set up. An agent decaying from 0.95
to 0.55 passes that. The only public gate comparing a run against a committed score is
`BrickerP/inspect-eval-gate-lab`, at 0 stars, 0 forks, self-labelled "not production". **Every tool that can
detect a regression stores the baseline in its own database.**

**Trajectory support is real but split.** promptfoo ships `trajectory:tool-sequence`,
`trajectory:tool-args-match`, `trajectory:goal-success` and `tool-call-f1` with tunable partial credit,
parsing OpenAI, Anthropic and Vertex tool shapes — but the assertion throws if trace data is missing, so OTLP
comes first. DeepEval has the richest metric set: `StepEfficiency`, `PlanAdherence`, `ToolCorrectness`. Inspect
has the best agent execution — ReAct, Deep Agent, handoffs, bridge — and no trajectory scorers at all.

## 3. LLM gateway governance config

**Demand.** `llm gateway` 489 exact monthly impressions.

**The 63,000-star gateway ships a test rig as its only worked configuration.** `BerriAI/litellm` has 63,049
stars, 13,165 forks and 5,072 open issues, MIT except for `enterprise/`. Its `proxy_server_config.yaml`
contains `fake-openai-endpoint`, `bad-model`, `dangerously_allow_mock_testing_request_params: true`, a
commented-out `max_budget` and no guardrails. Team budgets are not file state at all: they are a `POST
/team/new` into Postgres. Its one opinionated library, `policy_templates.json` with at least 16 templates, is
entirely jurisdiction PII and NSFW regular expressions for Australia, the EU, the UAE, Singapore and Canada —
nothing for allowed models, cost caps, per-team policy or audit retention. Its own documentation page lists 2
of those 16. Kong's entire opinionated content is four invisible-Unicode regular expressions.

**A namesake already exists and is empty.** `javabbgit/llm-gateway-governance`: 0 stars, no licence, homepage
pointing at the author's LinkedIn. Separately, `envoyproxy/ai-gateway` now redirects to
`theagentrouter/agent-router`.

## 4. Prompt injection examples and the security layer

**Demand.** `prompt injection` 1,503 served; `prompt injection examples` 303 unserved; `guardrails` 3,308;
`red teaming` 1,251.

**OWASP's current edition is citable and has no test cases.** The 2026 edition was published 2026-08-04 under
CC BY-SA 4.0 with DOI 10.5281/zenodo.22109014, and ships machine-readable crosswalks to NIST AI RMF 1.0,
MITRE ATLAS 2026.06, CWE 4.20 and six others — but contains no test cases. ShareAlike infects derivatives.
promptfoo, at 27,027 stars, still documents the 2025 list three months after the new edition.

**The leading benchmark withholds its data.** Lakera's PINT has 4,314 inputs, never published; the harness is
MIT with 200 stars; its README puts indirect injection out of scope, while OWASP's LLM01:2026 treats indirect
injection as the main event. The newest published score is dated 2025-08-27.

**Examples are redistributable; the guards are not.** MIT-licensed corpora include `jailbreak_llms` with
15,140 prompts of which 1,405 are jailbreaks, JBB-Behaviors at 39,883 downloads, Gandalf at 1,000, HarmBench
at 510, AgentDojo at 97 and 629, and a HackAPrompt set in the 600,000 class. Against that, Llama Guard 4 and
Prompt Guard 2 are manually gated under the Llama 4 Community Licence with a "Built with Llama" requirement
and a 700M monthly-active-user clause. `deepset/prompt-injections` carries two conflicting licences on one
card.

**Nothing ships a usable rule set.** Llama Guard's taxonomy, S1 to S14, has no injection category at all.
Guardrails Hub is 65 validators. `protectai/llm-guard` is archived. `gpt-oss-safeguard-20b` is Apache 2.0 and
ungated but needs a policy nobody publishes.

## 5. The four with no measured demand

**`adoption-telemetry-dashboard-template` — the name is a three-month-old academic coinage.** arXiv
2608.23617, Damon A. Young, published 2026-08-22, defines the term, ships a five-stage model with published
thresholds and a reference implementation, and states that the thresholds are proposed constructs requiring
empirical validation rather than a calibrated model. Zero measured demand because the phrase is a naming
artefact. Buyers type "Copilot ROI". The demand is visible in the labour market instead: Indeed headlines
52,000 AI-adoption roles, and one specification asks the holder to own the business unit's AI adoption
measurement framework and instrument the metrics. Incumbents are strong:
`github-copilot-resources/copilot-metrics-viewer` has 648 stars, 327 forks, 53 open issues under MIT and is
actively developed; Microsoft's Viva Copilot Dashboard covers readiness, adoption, impact and sentiment across
more than 100 metrics, gated behind a 50-licence floor. That floor is the only defensible strip: multi-vendor,
under fifty seats, governance-shaped.

**`handover-playbook` — no repository-form incumbent, and the adjacent canon is dead.**
`mercari/production-readiness-checklist` has 947 stars under MIT and was last pushed 2021-11-22, five years
dormant. `dwarvesf/playbook` has 264 stars, is archived and carries no licence. A third claiming on-call
handoffs has 0 stars. The AI-specific layer is five micro-consultancy blog posts from 2026 independently
converging on the same primitives — named owner, runbook, eval ownership, access revocation — none forkable.
The AI-specific residue is statutory: EU AI Act Article 26(2) requires oversight by persons with competence,
training and authority; 26(6) requires logs kept at least six months; 26(7) requires informing workers'
representatives. These bind from 2027-12-02 for Annex III and 2028-08-02 for Annex I, and Article 4 on AI
literacy has been in force since 2025-02-02. General site-reliability material has no slot for any of it.

**`ai-readiness-scorecard` — occupied, and open publishing there earns nothing.** Oxford Insights' Government
AI Readiness Index 2025 owns the head term across 195 countries. The free tier is a lead-magnet field: one
vendor prices its own scorecard against US$10,000 to US$25,000 of consulting. Every open competitor is
weightless, at 1 star each. Readiness and maturity are different searches with different owners, and the
legally forced phrase is neither — it is AI literacy.

**`build-vs-buy-ai-kit` — nothing to build on.** The best open artefact found, `nerd-shark/tco-model`, has 0
stars; the best primary source, arXiv 2602.13033, is about national governments rather than companies.

## What this record does not establish

- Whether any of the seven is worth the owner's time. That is a decision, and it is not taken here.
- Cross-repository citation counts. `grep.app` returned HTTP 429 on four attempts, so how often any of these
  artefacts is referenced inside other people's repositories is unmeasured.
- Pricing for LangSmith and Braintrust came from third-party trackers rather than vendor pages, and is weaker
  than the rest of this record.
- Whether the audience for a gateway policy configuration and the audience for prompt-injection examples are
  the same person. The research did not settle it.
