---
record: true
---

# The remaining four: is there demand, or were the wrong phrases measured?

> Intended path was `/tmp/research/the-remaining-four.md`. The `write` tool available to this agent
> refuses all filesystem paths and accepts only `local://` session scratch, so this report lives at
> `local://the-remaining-four.md`. Copy it to the intended path if that location matters.

Retrieved and written 2026-11-10. All star counts, licences and dates below were read on that date
from `api.github.com` unless the line says otherwise. Claims that rest on a secondary source
(a blog summarising a tool, a vendor describing itself) are labelled as such. Inferences are
marked `[INFERENCE]` with the check that would settle them.

Scope: `ai-readiness-scorecard`, `build-vs-buy-ai-kit`, `handover-playbook`,
`adoption-telemetry-dashboard-template`. Reconnaissance only; no proposal for what to build.

---

## 0. The short answer

The four measured zero mostly because the measurement asked the wrong questions, but "the right
phrase exists" does not rescue all four equally. Three distinct situations hide behind one zero:

| Resource | Why it measured zero | Does real demand exist under another phrase? |
|---|---|---|
| `ai-readiness-scorecard` | The head phrase is real and large, but it is **occupied** — by a 195-country government index and by hundreds of gated vendor scorecards | Yes, heavily. Demand is not the problem; differentiation is |
| `adoption-telemetry-dashboard-template` | The name is a **term of art coined in an August 2026 academic paper**, not a thing buyers type | Yes. Buyers type "Copilot ROI", "measure AI impact", "AI adoption metrics" |
| `handover-playbook` | Generic word, split across two vocabularies ("handover" vs "handoff"), and the AI-specific version is a **young niche with no canonical artefact** | Small but real, and almost unserved by anything citable |
| `build-vs-buy-ai-kit` | Phrase is common but the intent is commercial-bottom-of-funnel; the field is a swamp of email-gated calculators | Yes in volume, no in winnable ground |

One repo-internal fact frames all of this. The site's own baseline prompt list already contains the
realistic phrasings — `audits/geo-baseline.md` line 25 "AI readiness assessment template for SMB",
line 35 "build vs buy AI 3-year TCO", line 37 "how to hand over AI leadership to internal team" —
while `site/content-facts.json` lines 93–98 map each resource route to the bare product name
("ai readiness scorecard", "handover playbook", "adoption telemetry dashboard template"). The
"no measured demand" verdict was produced by measuring product names and `<concept> + template`
patterns. It was never a measurement of the jobs. **Verified** (repo files).

---

## 1. `ai-readiness-scorecard`

### 1.1 What someone actually types

"AI readiness" is not a low-volume phrase — it is a contested one, and most of its weight belongs
to intents meshin cannot serve.

- **Country rankings own the head term.** Oxford Insights' *Government AI Readiness Index 2025*
  ranks 195 countries, published January 2026, United States top at 88.36
  (https://oxfordinsights.com/ai-readiness/government-ai-readiness-index-2025/, retrieved
  2026-11-10; the 88.36 figure via a secondary summary at
  https://alicelabs.ai/reports/global-public-sector-ai-index-2026, and the report PDF at
  https://oxfordinsights.com/wp-content/uploads/2026/01/2025-Government-AI-Readiness-Index-Report_01_26.pdf).
  Anyone typing "AI readiness index" or "AI readiness ranking" wants this, not a five-axis
  self-score. `[INFERENCE]` — that this intent absorbs a large share of head-term volume;
  confirmable by pulling SERP composition for "ai readiness" in a keyword tool.
- **The compliance buyer types "AI literacy", not "AI readiness".** EU AI Act Article 4 obliges
  providers *and* deployers to take measures supporting AI literacy of staff; it came into force
  **2 February 2025**, and Article 4(2) singles out SMEs for Commission support
  (https://artificialintelligenceact.eu/article/4/, retrieved 2026-11-10). **Verified** against
  the article text. This is the only readiness-adjacent phrase with a dated legal obligation
  behind it.
- **The enterprise buyer types "AI maturity assessment" or "data readiness".** Vendor and
  consultancy pages cluster on those (e.g. https://atlan.com/know/ai-agent/data-for-ai/ai-readiness-assessment/,
  https://www.cigen.io/data-readiness-assessment-template — both retrieved 2026-11-10 via search).
- **Applied long tails that look like real buyers:** "AI readiness checklist Word Excel"
  (https://www.mastt.com/resources/ai-readiness-checklist — 44 criteria, 7 dimensions, free, Word/
  Excel/PowerPoint), "AI readiness assessment template for one workflow"
  (https://gsconsultingllc.com/insights/ai-readiness-assessment-template — free Excel, 24
  questions, scoring rubric, worked example). Both retrieved 2026-11-10.

### 1.2 What exists already

This is the most saturated of the four, in three tiers.

**Tier 1 — standards and academia (citable, not usable as-is).**
- Jöhnk, Weißert & Wyrtki, "Ready or Not, AI Comes — An Interview Study of Organizational AI
  Readiness Factors", *Business & Information Systems Engineering* 63(1):5–20, 2021, DOI
  10.1007/s12599-020-00676-7 (https://link.springer.com/article/10.1007/s12599-020-00676-7).
  **25 expert interviews, 18 readiness factors, 58 indicators, 5 categories: strategic alignment,
  resources, knowledge, culture, data.** This is the closest thing to a validated instrument, and
  note the overlap with meshin's five axes in `site/src/data/resource/ai-readiness-scorecard.md`
  (strategy, data, delivery, people, governance) — three of five categories coincide. The paper is
  not cited in that file's `sources` block, which lists only NIST AI RMF and ISO/IEC 42001.
  **Verified** (paper metadata via multiple indexes; repo file read directly).
- NIST AI RMF and ISO/IEC 42001 are the sources the meshin page does cite. ISO/IEC 42001 is
  paywalled, which is itself the reason free derivative scorecards exist.

**Tier 2 — vendor frameworks that are sales funnels.** Microsoft's AI Readiness Assessment
(self-service, Microsoft Learn), Microsoft's four-dimension maturity model (strategy, culture,
capabilities, operations), Google Cloud's AI Adoption Framework (document, four themes: learning,
leading, scaling, securing), Gartner's five maturity levels (awareness, active, operational,
systemic, transformational) across seven dimensions. All of this reached me through secondary
comparisons, not the primary documents — chiefly
https://marcosnewsletter.substack.com/p/ai-maturity-frameworks-comparison (claims to have pulled
apart 17 frameworks: Gartner, McKinsey, Accenture, Microsoft, Google Cloud, AWS, Deloitte, PwC,
IBM, MIT CISR, Salesforce, MuleSoft) and https://www.entrans.ai/blog/ai-readiness-assessment-framework-comparison,
both retrieved 2026-11-10. That source's sharpest claim — "Microsoft's agentic model measures
readiness for Copilot and Azure AI Services; Google Cloud's framework assesses progress toward
Vertex AI adoption — they're sales funnels with maturity language" — is opinion, but it is
consistent with the Microsoft licensing facts in §4.2 below.

**Tier 3 — the gated lead-magnet layer, and it is enormous.** A single search surfaced ten
distinct free-or-gated readiness instruments; a second surfaced ten more. Representative, all
retrieved 2026-11-10:

| Artefact | Shape | Gate | Maintainer |
|---|---|---|---|
| https://www.mastt.com/resources/ai-readiness-checklist | 44 criteria / 7 dimensions, Word+Excel+PPT | free download | company (construction PM SaaS) |
| https://ambysoft.com/essays/ai-readiness-assessment.html | spreadsheet | free, no gate | individual (Scott Ambler), page ~3 years old |
| https://gsconsultingllc.com/insights/ai-readiness-assessment-template | Excel, 24 questions, worked example | free | small consultancy |
| https://robocfo.ai/scorecard | 8 dimensions, 40 questions, ~12 min | form | vendor |
| https://summittrails.com/tools/ai-readiness-scorecard/ | "free template and score calculator" | free | vendor |
| https://paperform.co/templates/ai-implementation-readiness-assessment-download/ | 4 dimensions | form template | SaaS |
| https://youraibusinessstrategy.com/resources/ai-readiness-checklist/ | 50+ criteria / 6 dimensions | download | individual/brand |
| https://qzzr.com/templates/ai-readiness-assessment-quiz/ | 8-question quiz | quiz template | SaaS |

The lead-generation hypothesis in the task framing is **confirmed in the vendors' own words**:
robocfo.ai/scorecard states "Consulting firms charge $10,000–$25,000 for a comparable readiness
assessment" directly on the scorecard page — the free scorecard is explicitly priced against the
paid engagement. meshin's own page does the same thing more honestly: it says the five axes "match
the ones in the [AI Readiness & Risk Assessment]" and that it "carries no evidence a reviewer would
accept" (`site/src/data/resource/ai-readiness-scorecard.md`). **Verified** both sides.

**Open-source tier — crowded and weightless.** Every open repo I could find in this category has
essentially no adoption:

| Repo | Stars | Forks | Licence | Last push | Maintainer |
|---|---|---|---|---|---|
| `jags-programming/Global-AI-Maturity-Model` | 1 | 0 | NOASSERTION | 2025-07-30 | individual |
| `Alex-Blumentals/assessment-maturity-model` (Twin Ladder, targets EU AI Act Art 4) | 1 | 0 | CC-BY-SA-4.0 | 2026-10-08 | individual/micro-company |

Also surfaced but not API-verified: `association-industrial-ai/industrial-ai-maturity-model`
(5×5 matrix), `szczepanskistasiek/open-ai-transformation-maturity-model`,
`yashodhantek/agent-readiness-scorecard` (18 questions, answers encoded in URL hash, nothing sent
to a server), `techtalk/ai-readiness-assessment` (a Claude Code / Copilot plugin),
`andrew-mooredl7263/ai-maturity-assessment-app`, `janhayes96/ai-maturity-assessment-app`,
`screwyforcepush/AIMM`. The pattern is unmistakable: **many authors, no readers.**

### 1.3 Is there a real job to be done?

Yes for the *buyer*, no for the *reader of a public repo*. The job exists — Article 4 is in force,
and twenty-plus vendors think a scorecard converts — but the evidence is almost entirely supply-side
(people publishing scorecards), not demand-side (people asking for one). I found no forum thread,
issue tracker or Hacker News discussion where a practitioner asked where to find an AI readiness
scorecard, having searched for open-source readiness repos, readiness templates, maturity-model
comparisons and reddit/HN discussion of readiness assessments. **That absence is a finding.**

### 1.4 Verdict

Demand is real; the category is unwinnable as a repository. "The reference people link to and cite"
cannot be won in a space where Gartner owns the enterprise vocabulary, Oxford Insights owns the
head term, and the free tier is a thousand lead magnets of which the best-adopted open one has
1 star. Keep it as a site page feeding the paid Assessment — which is exactly what it currently is.

---

## 2. `build-vs-buy-ai-kit`

### 2.1 What someone actually types

"Build vs buy" is a decades-old management phrase, so volume is not the issue. The AI-specific
variants that surfaced as real page titles: "build vs buy AI", "buy vs build LLM", "AI build vs buy
ROI", "AI agent ROI calculator", "3-year TCO", "make or buy analysis". The repo's own baseline row
(`audits/geo-baseline.md` line 35, "build vs buy AI 3-year TCO") is already closer to the live
phrasing than the measured template was.

### 2.2 What exists already

**The strongest primary source is academic and is about governments, not companies.** Lu, Xu, Tjhi,
Li, Bosselut, Koh, Kankanhalli, "Buy versus Build an LLM: A Decision Framework for Governments",
arXiv:2602.13033, published 2026-02-13 (https://arxiv.org/abs/2602.13033, retrieved 2026-11-10).
Evaluates sovereignty, safety, cost, resource capability, cultural fit, sustainability; explicitly
pluralistic ("buy first for rapid deployment, while simultaneously investing in talent and
infrastructure for a future build"). **Verified** via the arXiv API. Seven authors, public-sector
framing — it does not serve a 50-person company.

**Everything else is a content-marketing calculator.** Retrieved 2026-11-10:

| Artefact | Shape | Gate | Who |
|---|---|---|---|
| `nerd-shark/tco-model` | 5-year XLSX, live formulas, sensitivity analysis | MIT, **0 stars, 0 forks**, created and last pushed 2026-10-06 (API-verified) | individual |
| https://expertaiprompts.com/buy-vs-build-scorecard | 12-factor weighted model, 7-tab Excel + PDF | **email-gated** | unknown micro-vendor |
| https://centcept.com/resources/build-vs-buy-ai-calculator/ | volume/uniqueness/sensitivity/integration scoring | **work email + company required** | micro-vendor |
| https://mightybot.ai/tools/ai-agent-roi-calculator/ | 3-year build-vs-buy across labour, engineering, tokens, infra, governance, review | free web tool | AI vendor |
| https://aicost.ai/tools/buy-vs-build | 5-year TCO, "real V2.1 vendor data" | sign-in on some pages | vendor |
| https://theartofcto.com/tools/build-vs-buy-matrix | weighted make-or-buy matrix | free | individual brand |
| FinchWorks "Build vs Buy: AI Decision Matrix" Notion template (itch.io) | Notion, deliberately non-technical | free | individual |

Gartner's own make-or-buy material is paywalled; I did not reach it. **Not verified.**

Practitioner-side numbers worth keeping, all secondary:
- "Teams routinely exceeded their LLM cost budgets by 340%" (2025 multi-tenant SaaS analysis, cited
  at https://tianpan.co/blog/2026-04-15-build-vs-buy-llm-infrastructure); same source: Bedrock
  provisioned throughput "roughly $13/hr on a 6-month commitment", selective self-hosting of bulk
  traffic "reduces total AI spend by 40–70%". Single-author blog, no dataset published —
  **treat as claim, not fact.**
- CACM news: AI engineers at "$300,000 to $400,000" with 2–5% equity
  (https://cacm.acm.org/news/genai-the-buy-vs-build-solution). Secondary but reputable venue.
- Hacker News sentiment runs against building: "There's very little lock-in for inference… if you
  use the right library it's changing a config file" (https://news.ycombinator.com/item?id=44223448);
  "If your business case involves technical differentiation then build an AI stack"
  (https://news.ycombinator.com/item?id=38221552).

### 2.3 Is there a real job to be done?

Yes, but it is a *conversation*, not an artefact, and it decays fast. The numbers that make an AI
build-vs-buy model useful — token prices, provisioned-throughput rates, seat prices — change every
quarter. A repository that ships those numbers is wrong within two quarters; a repository that ships
only the structure is the twentieth weighted scoring matrix in the field and the structure is not
AI-specific.

### 2.4 Verdict

Do not publish as a repository. Worst ratio of the four: highest competitive noise, fastest decay,
least AI-specific substance, and nothing in the field worth displacing (the best open artefact has
0 stars, the best primary source is about national governments).

---

## 3. `handover-playbook`

### 3.1 What someone actually types

Two vocabularies, and the split is itself part of the zero reading:
- **British/consulting:** "handover", "handover document", "project handover checklist",
  "software vendor handover", "offboarding a fractional executive".
- **American/engineering:** "handoff", "on-call handoff", "production readiness review",
  "transition plan".
- **AI-specific, newly emerging:** "AI system handover", "AI consultant handover checklist",
  "AI vendor exit plan", "what the client owns after handoff", "named owner".

The repo's own baseline (`audits/geo-baseline.md` line 37) uses "how to hand over AI leadership to
internal team" — again, closer to reality than "handover playbook".

### 3.2 What exists already

**The general-engineering canon exists and is dormant.** API-verified 2026-11-10:

| Repo | Stars | Forks | Open issues | Licence | Created | Last push | Maintainer |
|---|---|---|---|---|---|---|---|
| `mercari/production-readiness-checklist` | **947** | 101 | 1 | MIT | 2020-07-14 | **2021-11-22** | company (Mercari/Merpay) |
| `dwarvesf/playbook` (has `engineering/handover.md`) | 264 | 58 | 1 | **none** | 2018-12-20 | 2026-08-21, **archived** | company (Dwarves Foundation) |
| `happysnaker/production-readiness-checklist` (claims launch gates + on-call handoffs) | **0** | 0 | 0 | MIT | 2026-06-30 | 2026-08-11 | individual, template repo |

So the most-adopted artefact in the adjacent category has not been pushed to in **five years**, and
the most explicitly handover-shaped one has **zero** stars. Also surfaced, not API-verified:
`marwantareks/production-checklist` (115 concerns, 10 categories),
`bregman-arie/sre-checklist`, `pgaijin66/production-readiness-review-document`, and Susan Fowler's
production-readiness checklist as a gist.

**The AI-specific layer is all blog posts from micro-consultancies, published in the last few
months.** Retrieved 2026-11-10: https://www.foresightaipartners.com/blog/what-an-ai-system-handover-should-include
(offers a four-area CSV: runbook, training, recovery, access),
https://www.lilachbullock.com/ai-consultant-handover-checklist/ ("a named internal person with full
access and the authority to make changes… the failure mode is: no name is on the system when it
misbehaves"), https://www.codiste.com/enterprise-ai-agent-deployment-consultant-owns (six artefacts
including "the evaluation suite with a named owner responsible for re-running it after model
changes"), https://itecs.ai/insights/ai-vendor-exit-plan-critical-workflows (nine-control exit
matrix), https://sfailabs.com/guides/the-ai-agency-client-onboarding-playbook-in-9-artifacts.
**None of these is a repository.** No stars, no licence, no forking, no citation surface. They are
SEO assets whose independent convergence on the *same* primitives — named owner, runbook, eval
ownership, access revocation, escalation path — is the strongest demand signal in this whole report:
five unrelated sellers independently decided this is what buyers ask about.

### 3.3 Does handover belong to AI at all?

Mostly no — but the residue that does belong is legally dated and unserved.

What is **general engineering, already served** (badly maintained, but served): runbooks, on-call
rotation, access revocation, work-in-progress status, monitoring handover. Those are SRE/PRR
material; Google's SRE book chapter 32 is already cited in
`site/src/data/resource/handover-playbook.md`, and the FCA's SYSC 25.9 handover-material rules give
the regulated-industry precedent (cited in that file's `sources` block; I did not open the FCA
handbook this session — **unverified by me**).

What is **genuinely AI-specific**, verified against the EU AI Act text
(https://artificialintelligenceact.eu/article/26/, retrieved 2026-11-10):
- **Art 26(2):** deployers "shall assign human oversight to natural persons who have the necessary
  competence, training and authority, as well as the necessary support." A handover that does not
  name that person and their authority leaves a statutory gap, not just an operational one.
- **Art 26(6):** deployers keep automatically-generated logs under their control "of at least six
  months". Who owns the log pipeline after the outside lead leaves is therefore a compliance
  question with a number attached.
- **Art 26(7):** employers must inform workers' representatives and affected workers before putting
  a high-risk system into service at the workplace.
- **Dates:** Article 26 comes into force **2 December 2027** (Annex III high-risk) and **2 August
  2028** (Annex I), per Article 113(c). Article 4 (AI literacy) has been in force since
  **2 February 2025**.
- Plus two non-statutory AI-specific items the general canon has no slot for: **who re-runs the eval
  suite after a model or prompt change**, and **who holds the rollback decision** — both appear in
  meshin's existing tables and in the consultancy blog posts independently.

### 3.4 Verdict

This is the one worth publishing. Not because search volume is large — it is not, and should not be
promised — but because the four conditions for "the thing people link to" actually hold: a real and
recurring job (five independent sellers converging on identical primitives), **no incumbent artefact
in repository form at all**, a dormant adjacent canon (947 stars, last push 2021) that cannot be
accused of covering it, and a dated regulatory hook that gives the content a reason to be revised
rather than to rot.

---

## 4. `adoption-telemetry-dashboard-template`

### 4.1 What someone actually types

**Not "adoption telemetry".** That phrase has one real owner, and it is three months old:
Damon A. Young, "Adoption Telemetry: Measuring Enterprise AI Adoption from Production Signals",
arXiv:2608.23617, published **2026-08-22** (https://arxiv.org/abs/2608.23617, **verified** via the
arXiv API). It *defines* the term — "the continuous measurement of behavior change from production
system signals, interpreted through an explicit model of change" — ships a five-stage
operationalisation called NANTE with published thresholds, an open-source reference implementation,
and an unusually honest limitation: the thresholds are "proposed constructs requiring empirical
validation against real outcomes… not a calibrated model". Validation is on synthetic populations.

A term coined in an August 2026 paper cannot have measurable 2026 search demand. The zero reading
for this slug is an artefact of naming, full stop.

What buyers type instead, inferred from the page titles that rank for the job (all retrieved
2026-11-10): **"Copilot ROI"**, "GitHub Copilot metrics", "how to measure AI impact on developers",
"AI adoption dashboard", "AI ROI measurement tools", "is Copilot worth it", "AI adoption metrics
framework".

### 4.2 What exists already — and this is the densest field of the four

**Primary, free, and strong for the single-vendor case:**

| Artefact | Numbers | Licence | Maintainer |
|---|---|---|---|
| `github-copilot-resources/copilot-metrics-viewer` | **648 stars, 327 forks, 53 open issues**, TypeScript | MIT | GitHub-adjacent org, actively developed (v3.0, per-user metrics, Postgres historical mode) |
| `microsoft/copilot-metrics-dashboard` | 203 stars, 97 forks — **archived by the owner 2026-09-03** (repo page via search; not API-verified) | — | Microsoft |

From the first repo's own README (**verified** by reading it): the legacy Copilot Metrics API "was
shut down on April 2, 2026"; Direct API mode returns only a **rolling 28 days**; a `ai_credits_used`
field was added to the `users-28-day` report on **2026-06-19**; team metrics must be *derived* from
per-user records because GitHub's Usage Metrics API has no team endpoints. That last point is a
real, documented hole a template could speak to.

**Microsoft's vendor dashboard is the incumbent for non-engineering adoption, and it is gated by
seat count.** From learn.microsoft.com and microsoft.com (retrieved 2026-11-10 via search citations):
the Copilot Dashboard in Viva Insights covers metric categories **"Readiness, adoption, impact, and
sentiment"**; **a minimum of 50 assigned Viva Insights or Copilot licences is required for data
processing to start**; advanced features require a Copilot licence plus a Viva/Workplace Analytics
licence; Advanced Reporting offers **more than 100 Copilot metrics** with Power BI templates. The
base dashboard needs neither a paid Viva nor a Copilot licence. **The 50-licence floor is the single
most actionable number in this section:** every company below ~50 seats is excluded from the
incumbent, by design.

**The commercial measurement layer is crowded.** DX publishes an "AI Measurement Framework"
(utilisation / impact / cost; https://getdx.com/blog/ai-measurement-framework-guide/, retrieved
2026-11-10), with the useful counter-number that "even leading organizations are only reaching
around 60% active usage of AI tools, and high adoption can coexist with low or negative impact if
measurement stops there". Jellyfish AI Impact, GitKraken's ROI dashboard (adoption tiers: Power
User, Regular, Explorer, Emerging, No AI Data), minware, Waydev, Axify, Larridin and others all sell
into the same gap. All vendor self-description — **weak evidence of capability, strong evidence that
money is chasing the problem.**

**The measurement problem is genuinely unsolved, and that is documented, not just asserted.**
CACM, "Beyond the Hype: The Efficiency-Throughput Gap with GitHub Copilot"
(https://cacm.acm.org/research/beyond-the-hype-the-efficiency-throughput-gap-with-github-copilot/,
retrieved 2026-11-10) reports no immediate direct correlation between Copilot use and gains in key
engineering metrics despite improved motivation and perceived skill. Secondary sources contrast
GitHub's 55.8%-faster trial with a field study finding experienced developers 19% *slower* while
feeling faster. Two widely-repeated survey figures — "60% of engineering leaders say lack of clear
metrics is their biggest AI adoption challenge" and "90% of teams use AI coding tools, only 20%
measure impact on outcomes (600+ respondents, 2025)" — reached me only through blog restatements;
I could not find the instruments. **Treat both as unverified.**

### 4.3 Is there a real job to be done?

The strongest demand evidence in this report, and it comes from the labour market rather than from
search. Indeed's query page for AI-adoption roles headlines **"52,000 Ai Adoption Jobs"**
(https://www.indeed.com/q-ai-adoption-jobs.html, retrieved 2026-11-10 via search; headline counts
on job aggregators are loose and include fuzzy matches — **treat the magnitude, not the digit**).
The job descriptions name the artefact directly:
- AHEAD, AI Adoption Lead: "**Own the business unit's AI adoption measurement framework** — design
  and instrument metrics, not just report on them"; "monitor adoption signals and adjust
  interventions based on real-time uptake data" (https://jobs.lever.co/thinkahead/d9c3ec26-7830-4653-80ea-89aa2a5cb781).
- ServiceNow, AI Adoption Lead: "measure adoption using a combination of system usage, sentiment
  analysis, feedback loops, and business impact metrics" (https://builtin.com/job/ai-adoption-lead/9378012).
- Aggregated postings: "measure adoption through usage, user acceptance, edits, rejections,
  escalations, and feedback."

People are being **hired** to build this dashboard. That is a stronger signal than any keyword
volume, and it is invisible to keyword measurement entirely.

### 4.4 Verdict

Worth publishing **only if renamed and narrowed**. Renamed, because "adoption telemetry" is a
three-month-old academic coinage with a competing owner who got there first and published
thresholds; narrowed, because the single-vendor engineering case is already well covered by a
648-star MIT repo and the enterprise case by a Microsoft dashboard with 100+ metrics. The defensible
strip is the one both incumbents exclude: **multi-vendor, under 50 seats, and tied to governance
rather than productivity** (idle-seat reclamation, shadow-AI coverage, policy-clarity sentiment) —
which is, in fact, what the existing page already does (`site/src/data/resource/adoption-telemetry-dashboard-template.md`
includes a coverage panel reading gateway logs, sign-in lists, expense lines and API bills against
the AI register, and a two-person-approval rule before any named view exists).

---

## 5. "AI readiness" vs "AI maturity": the same search?

**No.** They are different intents with different owners, and both differ again from the phrase the
law uses.

| | readiness | maturity |
|---|---|---|
| Question asked | "Can we start *this* use case now?" | "Where do we stand overall, and what is the next rung?" |
| Owner of the vocabulary | Oxford Insights (countries), Microsoft (free self-service diagnostic), hundreds of lead magnets | Gartner — described as "the most referenced framework in enterprise AI strategy" |
| Buyer | operator, SME, pre-first-deployment | board, enterprise, benchmarking |
| Shape | checklist, gate, go/no-go | 5-level ladder across 5–7 dimensions |

Sources: https://www.entrans.ai/blog/ai-readiness-assessment-framework-comparison ("an AI readiness
assessment evaluates whether an enterprise is prepared to deploy its first AI use cases today; an AI
maturity model describes capability levels"), https://prommer.net/en/tech/articles/gartner-ai-maturity-model/
("maturity describes where you are on a progression; readiness describes whether the prerequisites
for advancement are in place"), both retrieved 2026-11-10, both secondary.

Which phrasing carries weight: **"maturity" carries institutional weight** (Gartner, five named
levels, boardroom currency) while **"readiness" carries volume and noise** (a government index on
top, a lead-magnet swamp underneath). Neither is the phrase with legal force; that is **"AI
literacy"** (Art 4, in force 2025-02-02). Note Microsoft hedges by using both words at once — its
Copilot Dashboard's first metric category is literally "Readiness", followed by adoption, impact and
sentiment. `[INFERENCE]` on relative search volume specifically; settling it needs a keyword tool
run on "ai readiness assessment", "ai maturity assessment", "ai maturity model", "ai literacy
training" — which is exactly the measurement that was never done.

---

## 6. What a serious practitioner still cannot get

Stated precisely, because this is the part that decides whether anything should be published:

1. **A handover artefact that survives a regulator's question.** Everything available is either
   general SRE material with no AI-specific clauses (mercari, 947 stars, dormant since 2021-11-22)
   or an AI-flavoured blog checklist with no licence, no version and no repository
   (foresightaipartners, lilachbullock, codiste, itecs, sfailabs — all 2026). Nobody ties the
   handover to Art 26(2) named oversight with authority, Art 26(6) six-month log retention, and
   eval-ownership-after-model-change in one forkable document with a date on it.
2. **Cross-vendor AI adoption measurement below 50 seats.** The Microsoft dashboard will not process
   data under 50 licences; `copilot-metrics-viewer` reads GitHub Copilot only, over a rolling 28-day
   window, with no team endpoints; the commercial layer (DX, Jellyfish, Waydev, GitKraken) is
   enterprise-priced. A 30-person company paying for ChatGPT Team plus Claude plus Copilot has no
   free path to one coherent picture.
3. **An adoption measure that is governance-shaped rather than productivity-shaped.** Every
   incumbent answers "are we getting value?". None answers "what are we paying for that nobody uses,
   what is running outside the register, and do staff know what the policy permits?" — which is the
   question a security review and a board actually ask.
4. **A readiness instrument whose scores mean the same thing twice.** Jöhnk et al. (18 factors, 58
   indicators, 25 interviews) is the only instrument with any methodological grounding, and it is a
   2021 paywalled journal article, not a tool. Every usable artefact is self-scored, unvalidated and
   vendor-authored. This gap is real but, per §1.4, not winnable by a one-more-scorecard move.
5. **Honest, dated unit economics for build-vs-buy.** Every calculator either hides its numbers
   behind an email form or hard-codes prices that are already stale. Nobody publishes the inputs
   with retrieval dates. `[INFERENCE]` that this is why none of them is cited: a model you cannot
   audit is not citable. Confirmable by checking inbound links to any of the calculators in §2.2.

---

## 7. Recommendation

**Publish one. Rename and narrow a second. Do not publish the other two as repositories.**

1. **`handover-playbook` — publish first.** Unique in having no repository-form incumbent, a dormant
   adjacent canon, five independent sellers validating the primitives, and a dated statutory hook.
   Name it for both vocabularies ("AI system handover / handoff") and lead with the AI-specific
   deltas rather than re-publishing SRE material.
2. **`adoption-telemetry-dashboard-template` — publish second, renamed.** Keep the governance
   framing and the sub-50-seat, multi-vendor scope. Drop "adoption telemetry" as the headline term:
   arXiv:2608.23617 already owns it, with published thresholds and a reference implementation, and
   it would be both weaker and discourteous to compete on that name while the paper is three months
   old. Cite it instead.
3. **`ai-readiness-scorecard` — keep as a page, do not repo it.** The category is saturated and the
   honest competitive answer is "ours is a lead magnet too". Its current page states that plainly,
   which is its best feature.
4. **`build-vs-buy-ai-kit` — do not publish.** Fast-decaying numbers, no AI-specific structure, a
   field of gated calculators, and the only serious primary source is about national governments.

---

## 8. Assumptions in the framing I would challenge

- **"Measured search demand is the readiness test for publishing."** For three of these four, the
  decisive demand evidence is not search at all: it is 52,000 job postings whose duties name the
  artefact, and five competing consultancies converging on the same handover primitives. A keyword
  tool cannot see either. Conversely `ai-readiness-scorecard` has abundant demand and is still the
  worst thing to publish.
- **"Zero measured demand means the phrases were wrong."** True for `adoption-telemetry-*` (name
  coined in a paper two months before the measurement) and partly for `handover-playbook`
  (vocabulary split). **False for `ai-readiness-scorecard`**, where the phrase was fine and the
  problem is occupancy — and false in the opposite direction for `build-vs-buy-ai-kit`, where ample
  demand exists and is worthless.
- **"Each resource should become the reference in its category."** Two of these four have no
  category to be the reference *of*: "adoption telemetry" is one paper's term, and "build vs buy AI"
  is a conversation, not a category. Insisting on a reference artefact per resource forces a
  category into existence that no one is standing in.

## 9. Traps — options that look right from another frame

- **Trap: "four zeros, cut all four."** The demand-measurement frame reaches this cleanly and it is
  wrong on `handover-playbook`, where the absence of competition *is* the opportunity and the
  absence of search volume is the reason the competition is absent.
- **Trap: "publish the readiness scorecard first because it has the most demand."** The SEO frame
  loves it: biggest head term, existing site page, internal links. It fails because the term's
  volume belongs to a country index and a thousand gated lead magnets, and because the best-adopted
  open competitor in that category has 1 star — proof that adoption in this niche does not follow
  publication.
- **Trap: "keep the name `adoption-telemetry-dashboard-template` because it is distinctive."** The
  brand frame likes an uncontested phrase. It is uncontested because it is three months old and
  already owned by arXiv:2608.23617, whose thresholds are published and testable; shipping a
  template under the same name invites the comparison on the paper's terms.
- **Trap: "build-vs-buy converts, so ship it."** The commercial frame is right that the phrase sits
  at the bottom of the funnel. But the artefact decays within quarters, every competitor gates the
  same thing, and nothing in the field is cited — so the conversion argument buys a maintenance
  liability, not a reference.

## 10. Needs follow-up

Three facts I could not read and which would change specific lines above:

1. **Keyword volumes for the corrected phrases** — "ai maturity assessment", "ai readiness
   assessment", "copilot roi", "ai adoption metrics", "ai literacy training", "ai system handover",
   "project handover template". No tool published per-keyword figures for these, and
   https://patrickstox.com/tools/ai-search-volume/ notes plainly that "no one publishes per-keyword
   AI search volume for ChatGPT or Gemini" and that providers disagree with each other on the same
   keyword. Without this, §1.1, §4.1 and §5 rest on SERP-composition reasoning rather than numbers.
2. **The two survey instruments** behind "60% of engineering leaders cite lack of metrics" and
   "90% use / 20% measure (600+ respondents)". Both are quoted everywhere and sourced nowhere I
   could reach.
3. **Whether `microsoft/copilot-metrics-dashboard` is archived and why.** Its star/fork/archive
   facts came from the repository page via search, not the API. If Microsoft archived it in favour
   of the Viva dashboard, that strengthens §4.4's claim that the vendor path is the licensed path.

A note on the role contract: I was asked to tag every risk and trap with "one of the pattern ids
given below", but no pattern-id list was supplied in this assignment. §9 uses descriptive frame
names instead; relabelling is mechanical once the list exists.
