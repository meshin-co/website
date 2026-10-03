---
record: true
---

# 06 — Adoption telemetry for AI tools: what the 2026 evidence supports, 2026-10-02

Dated 2026-10-02. Research for the planned page `adoption-telemetry-measuring-if-ai-is-actually-used`
(PRD §15 row 12; buyer prompt 21 in `docs/SEMANTIC-CORE.md`). This is a record, not an instruction: it
holds what external sources said on this day. The URLs it cites are outside this tree and are not
expected to resolve here. "Read" means I fetched the source on 2026-10-02 and checked the claim in its
own text. Where I saw only a search snippet, a summary or a secondary copy, the record says so in the
same sentence. Claims marked "my reading" are inference, not something a source states.

## Verdict

- **Most adoption telemetry measures exposure or activity, not value.** Seats, logins, daily active
  users, prompt counts, lines accepted and vendor "hours saved" are the usual panels. In the sources
  below, none of them is shown to predict a business outcome, and several are shown to move the wrong
  way. This is my reading. No source says "most telemetry is theatre".
- **A smaller set is defensible**, and it is a different set: (a) coverage, meaning how much AI use
  runs inside approved tools; (b) paid-versus-active use and retention by team, as a cost and
  enablement check; (c) one outcome per use case, agreed before rollout, against a baseline or a
  comparison group; (d) delivery-health guardrails; (e) cost per outcome; (f) a short repeated survey
  on trust, reliance and friction, read as opinion. Section 2.5 turns this into panels.
- **On people, no source gives a bright line.** Aggregate by default. A per-person view needs a stated
  purpose, a DPIA screening and, where a works council exists in Germany, the Netherlands or France,
  that council's involvement. Section 2.4 has the sources and the gaps.

## 1. What the page must answer

**Buyer prompt, verbatim** (`docs/SEMANTIC-CORE.md` line 345): *adoption telemetry for AI tools*

Today it is a hard gap: "no route" (line 346). The plan is one article plus a dashboard-template
artifact, which is a new artifact type for this repo (SEMANTIC-CORE lines 634-636; PRD §15 row 12;
slug `adoption-telemetry-measuring-if-ai-is-actually-used`; category `operating-model`). The master
plan, `docs/sources/master-plan.mhtml` (Russian, quoted-printable), lists adoption telemetry with
"DAU/WAU of AI tools, deflection rate, time-to-resolution" and an "Adoption Dashboard" template that
can run on Grafana or Metabase over gateway logs.

What a buyer who types this wants. This is inferred from the prompt and the master plan; I found no
query data for it in the repo.

1. Which numbers to collect about AI tool use, and from which system.
2. Which numbers will mislead them, so they do not build a dashboard that looks good and decides
   nothing.
3. Whether they may collect any of it about named staff. EU buyers rarely type this, but a page that
   skips it is unsafe to copy.
4. A template to copy: for each panel, the question it answers, the data source and the decision it
   supports.

## 2. State of practice, 2026

### 2.1 What the tools report, and how each one defines "active"

There is no shared definition of an active user. The same company can look 70% adopted under one rule
and 40% under another. The rules below are the published ones.

- **GitHub Copilot usage metrics.** Generally available since 2026-02-27, with dashboards and
  enterprise, organisation and user-level APIs ([GitHub changelog, 2026-02-27](https://github.blog/changelog/2026-02-27-copilot-metrics-is-now-generally-available/)).
  The changelog says the user-level API is there "to support enablement and identify where teams may
  need training or better documentation". Since 2026-05-14 an admin can join a user-teams report to
  the per-user report to get team-level numbers; this is API-only, with no dashboard
  ([GitHub changelog, 2026-05-14](https://github.blog/changelog/2026-05-14-team-level-copilot-usage-metrics-now-available-via-api/)).
  The docs page ([GitHub Docs, undated, read 2026-10-02](https://docs.github.com/en/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics))
  says: most metrics come from client-side IDE telemetry, so users need telemetry enabled; Copilot
  Chat on GitHub.com and GitHub Mobile are not covered; seat data is not in the usage reports (the
  user-management API is "the source of truth" and carries `last_activity_at`); data arrives within
  two full UTC days; lines-of-code figures are "directional"; a user needs at least two active days in
  the trailing 28 to be placed in the "Code first", "Agent first" or "Multi-agent" phase, and
  "Passive" "is not a measure of inactivity"; the "adoption multiplier" divides the average merged
  pull requests of engaged users by that of Passive users; ROI figures "are estimates rather than
  exact financial results". My reading: the multiplier compares people who chose the tool with people
  who did not, so it cannot isolate the tool's effect.
- **Microsoft 365 Copilot Dashboard** ([Microsoft Learn, ms.date 2026-09-29](https://learn.microsoft.com/en-us/viva/insights/org-team-insights/copilot-dashboard)).
  Usage levels over a rolling 12 weeks: Power users average 15 or more actions a week and were active
  in at least 9 of 12 weeks; Habitual users average 1 to 14 actions and were active in at least 9 of
  12 weeks; Novice users were active in fewer than 9 of 12 weeks. "Returning users" means at least
  one action in both the current and the previous period. "Copilot assisted hours" is an estimate:
  action counts times fixed minutes (6 minutes per search or summary action, from a study of 163
  knowledge workers; 6 minutes per creation action, from a study of 147), valued at a default
  $72 an hour from US Bureau of Labor Statistics data. The page itself says Copilot "is not likely to
  be solely responsible for any metric differences shown in the dashboard".
- **Claude Code** exports OpenTelemetry (an open format for sending usage data) when
  `CLAUDE_CODE_ENABLE_TELEMETRY=1` ([Claude Code docs, page metadata modified 2026-10-02](https://code.claude.com/docs/en/monitoring-usage)).
  Metrics include `claude_code.session.count`, `lines_of_code.count`, `commit.count`,
  `pull_request.count`, `cost.usage`, `token.usage` and `active_time.total`. Team grouping is set
  through `OTEL_RESOURCE_ATTRIBUTES` (the doc's example: `department=engineering,team.id=platform`).
  Identity is on by default: `user.email` is "always included when available" for OAuth sign-ins, and
  `user.id` is a random per-installation value (an IdP subject when signed in through a gateway).
  Prompt text, response text and tool arguments are off by default; only lengths are recorded. The
  doc tells operators to filter or redact `user.email` at their own backend if that is a concern.
  My reading: for this tool the per-person versus aggregate choice is made at the collector, by you.
- **Intercom Fin** shows how a vendor defines an outcome ([Intercom Help, page modified 2026-09-23](https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes)).
  A "resolution" counts when the customer confirms the answer, or when the customer "exits the
  conversation without requesting further assistance" (an "assumed resolution"). A customer who
  leaves frustrated still counts as an assumed resolution and is charged, unless Fin escalates. The
  master plan names "deflection rate"; I found no shared definition of it. Vendors define their own
  and tie it to billing.
- **DX AI Measurement Framework** (vendor; DX sells measurement software; page undated in my fetch;
  [getdx.com](https://getdx.com/research/measuring-ai-code-assistants-and-agents/)). Three
  dimensions: utilization, impact, cost. Its direct impact metric is self-reported time saved; indirect
  metrics come from its own DX Core 4. It says "even leading organizations are only reaching around
  60% active usage" (no method given) and "strongly caution[s] against top-down mandates or using
  metrics for individual performance evaluation", adding that code-generation volume "is particularly
  susceptible to gaming". Its customer results (for example Intercom's 41%) come with no method; I do
  not repeat them.
- **DORA on frameworks** ([DORA, 2025-08-06, updated 2025-08-26](https://dora.dev/insights/measurement-frameworks/)).
  Decide the "why" first; no single framework (SPACE, DevEx, H.E.A.R.T., DORA) is recommended; it
  calls it a "common misconception that logs-based metrics are objective"; it suggests adding
  suggestion acceptance rate, model quality and trust to existing measures.

### 2.2 What the research says about value

Evidence is mixed, and it depends on the method. Each entry below says which method it used.

- **DORA 2025** ([Google Cloud / DORA, announced 2025-09-24](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf);
  read in full). Survey of nearly 5,000 people, fielded 13 June to 21 July 2025. 90% use AI; more than
  80% say it raised their productivity; 30% have little or no trust in AI-generated code. AI adoption
  now goes with higher delivery throughput, "a key shift from last year", but still with higher
  instability. Adoption itself is measured as a survey factor (reliance, trust, reflexive use), not
  from logs. Footnote 19 says the data is "a snapshot", and the report describes comparisons, not
  effects. The executive summary says: "The conversation must shift from adoption to effective use."
  Seven capabilities amplify the value of AI; one is a "clear and communicated AI stance", measured by
  four survey items (use feels expected; experimentation is supported; it is clear which tools are
  permitted; the AI policy applies to me). It is vendor-published research (Google Cloud).
- **DORA 2024** ([Google Cloud / DORA, 2024, report v2024.3; month not in the PDF text](https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf)).
  For each 25% rise in AI adoption: about 1.5% lower delivery throughput ("small, but likely
  negative") and 7.2% lower delivery stability; also 7.5% better documentation quality, 3.4% better
  code quality and 3.1% faster code review. The report says "measuring usage frequency is likely not as
  meaningful as measuring reliance".
- **METR randomised trial** ([METR, 2025-07-10](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)).
  16 experienced open-source developers, 246 issues. With AI allowed, tasks took 19% longer. Before
  starting, developers expected a 24% speed-up; afterwards they still believed in 20%. The page now
  carries a note that these results are out of date.
- **METR update** ([METR, 2026-02-24](https://metr.org/blog/2026-02-24-uplift-update/)). New study:
  57 developers, 143 repositories, 800+ tasks. METR says the data is "an unreliable signal", mainly
  because many developers declined to include tasks they did not want to do without AI, which likely
  biases the estimate downward. Raw estimates: returning developers 18% faster (interval 38% faster to
  9% slower); new developers 4% faster (interval 15% faster to 9% slower). METR believes developers
  are "likely more sped up" in early 2026, but calls its own data "only very weak evidence" of the
  size.
- **METR survey** ([METR, 2026-05-11](https://metr.org/blog/2026-05-11-ai-usage-survey/)). 349
  technical workers, February to April 2026. Median self-reported change in the value of their work:
  1.4 to 2 times; median self-reported speed change: 3 times. METR warns about a convenience sample
  and a response rate near 2% for emailed invitations. It repeats that in the 2025 trial people
  overestimated the effect on their task time by 40 percentage points, and that survey estimates tend
  to be larger than field-experiment estimates.
- **Cursor adoption study** ([arXiv 2511.04427, submitted 2025-11-06](https://arxiv.org/abs/2511.04427);
  preprint; I did not find peer-review status). Difference-in-differences (it compares projects that
  adopted the tool with matched similar projects that did not, before and after) on GitHub projects.
  Lines added rose 281.3% in the first month and 48.4% in the second; commits rose 55.4% and 14.5%.
  The speed-up was transient. Static-analysis warnings and code complexity showed "sustained"
  increases. The exact percentages for those two did not verify in the text I fetched, so none are
  given here. Open-source projects and proxy measures limit what this says about a company.
- **Field study in customer support** ([Brynjolfsson, Li and Raymond, Quarterly Journal of Economics 140(2), 2025](https://ideas.repec.org/a/oup/qjecon/v140y2025i2p889-942..html);
  abstract read). 5,172 support agents, staggered rollout. Issues resolved per hour rose 15% on
  average, with large differences by worker. Less experienced and lower-skilled agents improved speed
  and quality; gains for the most experienced and highest-skilled agents were small. This is the
  strongest positive result I read, and it measures an outcome from the work system, not tool logs.
- **Faros AI report** (vendor, sells engineering analytics; [Faros, 2025-07-23](https://www.faros.ai/blog/ai-software-engineering);
  read). Telemetry from 10,000+ developers in 1,255 teams, up to two years, analysis as of June 2025,
  Spearman correlations (observational). On teams with high adoption: 21% more tasks completed, 98%
  more pull requests merged, 91% longer review time, 154% larger pull requests and 9% more bugs per
  developer. "No significant correlation between AI adoption and improvements at the company level."
- **Denmark labour-market data** ([Humlum and Vestergaard, NBER WP 33777, issued May 2025, revised March 2026](https://www.nber.org/papers/w33777);
  abstract read). Linked surveys and administrative records, difference-in-differences: "precise null
  effects on earnings and recorded hours", ruling out effects larger than 2%, two years after
  ChatGPT's launch. Caveat (my reading): it measures pay and hours, not output per hour.
- **Firm survey** ([Yotzov, Barrero, Bloom and others, NBER WP 34836, issued February 2026, revised March 2026](https://www.nber.org/papers/w34836);
  abstract read). Nearly 6,000 senior executives in the US, UK, Germany and Australia. 69% of firms
  use AI; executives' own use averages 1.5 hours a week; "nine-in-ten" report no impact on
  employment or productivity over three years. It is executive self-report.
- **Skill formation trial** (vendor-authored; [Anthropic, published 2026-01-29, modified 2026-09-09](https://www.anthropic.com/research/AI-assistance-coding-skills);
  read). 52 mostly junior engineers learning a Python library. The AI group averaged 50% on a quiz
  against 67% for the hand-coding group (Cohen's d=0.738, p=0.01). The AI group finished about two
  minutes faster, not statistically significant. Patterns that handed all code to the AI scored below
  40%. The authors call the sample "relatively small". Relevance: heavy use and low understanding can
  sit together, and a usage count cannot tell them apart (my reading).
- **Acceptance rate** ([Ziegler and others, arXiv 2205.06537, 2022-05-13](https://arxiv.org/abs/2205.06537)).
  In a 2022 study of Copilot users, the rate at which users accepted suggestions, rather than how
  long the accepted code lasted, tracked how productive users said they felt. It ties acceptance rate
  to perception.
- **Practitioner qualitative data** ([DORA, 2026-03-10](https://dora.dev/insights/balancing-ai-tensions/)).
  1,110 open-ended answers from Google engineers in Q3 2025: a single company, qualitative. Themes: a
  "verification tax" and a heavier review burden on reviewers. DORA urges teams to "stop relying on
  such narrow, output-based metrics".

### 2.3 Measures that mislead

| Measure | What it counts | Why it misleads | Source |
| ------- | -------------- | --------------- | ------ |
| Seats or licences | Money spent | Says nothing about use; GitHub keeps seats in a separate API | [GitHub Docs](https://docs.github.com/en/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics) |
| Daily or weekly active users | One event in a window | Window and event differ by vendor; no shared definition | GitHub and Microsoft pages in 2.1 |
| Usage frequency | How often | DORA 2024 found reliance more meaningful than frequency | [DORA 2024](https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf) |
| Lines or code accepted | Output volume | GitHub calls it "directional"; the Cursor study found transient volume gains and sustained complexity; DX warns of gaming | [Cursor study](https://arxiv.org/abs/2511.04427), [DX](https://getdx.com/research/measuring-ai-code-assistants-and-agents/) |
| Acceptance rate | Suggestions taken | Tracks perceived productivity, not measured output | [Ziegler 2022](https://arxiv.org/abs/2205.06537) |
| Vendor "hours saved" and ROI | Actions times fixed minutes times a wage | Assumption times count; Microsoft says it is a "general estimate" | [Microsoft Learn](https://learn.microsoft.com/en-us/viva/insights/org-team-insights/copilot-dashboard) |
| Self-reported speed-up | Opinion | 40-point overestimate in the 2025 trial | [METR 2026-05-11](https://metr.org/blog/2026-05-11-ai-usage-survey/) |
| Vendor "resolution" or "deflection" | Conversations that ended | Can include customers who left unhelped | [Intercom](https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes) |
| Adoption multiplier | Engaged versus passive users | Self-selected groups | [GitHub Docs](https://docs.github.com/en/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics) |

### 2.4 EU and UK limits on measuring people

No source I read is about AI-usage telemetry specifically. The rules below are the general rules for
monitoring employees, applied by analogy (my reading). I searched for ICO, CNIL, EDPB and German
data-protection-conference material on AI-usage logs on 2026-10-02 (one or two queries each, not
exhaustive) and found only general employee-monitoring guidance.

**GDPR** ([Regulation (EU) 2016/679, EUR-Lex, OJ L 119, 4.5.2016](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng); read).

- Article 5(1)(b), (c), (e) and 5(2): purpose limitation, data minimisation, storage limitation, and
  the duty to show compliance.
- Article 35(1): a DPIA (data protection impact assessment) is required where processing is likely to
  result in high risk. 35(3) lists three cases. 35(4): each supervisory authority publishes a list of
  processing that needs one. 35(9): seek the views of data subjects or their representatives "where
  appropriate".
- Article 88(1)-(2): member states or collective agreements may add specific rules for employee data,
  including on "monitoring systems at the work place".

**DPIA trigger for employee monitoring.** The Article 29 Working Party guidelines
([WP248 rev.01, adopted 2017-04-04, last revised and adopted 2017-10-04](https://ec.europa.eu/newsroom/article29/redirection/document/47711);
read) list nine criteria. Three matter here: systematic monitoring; data about vulnerable data
subjects, a group that "may include" employees because of the power imbalance; and innovative use of
technology. The guidelines say that meeting two criteria means a DPIA "in most cases", and that one
criterion can be enough in some cases. Their example table lists "a company systematically monitoring
its employees' activities, including the monitoring of the employees' work station, internet activity,
etc.", with the criteria "systematic monitoring" and "data concerning vulnerable data subjects", and
answers "yes" to "DPIA likely to be required?" (I read the table as an image; the text extraction
scrambles the column.) Whether a usage dashboard counts as "systematic monitoring" depends on how
person-level it is (my reading). I did not read any national list under Article 35(4).

**Consent, proportionality, transparency** ([WP249, Opinion 2/2017 on data processing at work, adopted 2017-06-08](https://ec.europa.eu/newsroom/article29/redirection/document/45631);
read). It says "consent is highly unlikely to be a legal basis for data processing at work, unless
employees can refuse without adverse consequence"; legitimate interest "can sometimes be invoked", but
only if the processing is "strictly necessary" and meets proportionality and subsidiarity; "a
proportionality test should be conducted prior to the deployment of any monitoring tool"; employees
should get effective information; and "the information registered from the ongoing monitoring, as well
as the information that is shown to the employer, should be minimized as much as possible". It was
written under the old Data Protection Directive and "looks toward" the GDPR, so treat it as persuasive
guidance, not current law.

**Works agreements are not a free pass** ([CJEU, Case C-65/23, MK v K GmbH, 2024-12-19](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62023CJ0065);
read). Rules adopted under Article 88, including works agreements, must still meet Articles 5, 6(1)
and 9 (paragraphs 43, 49-50). Courts must be able to review them "without any restriction" (paragraph
55), the parties have no margin to apply the necessity test "less strictly or even disregarded"
(paragraph 56), and non-compliant provisions must be disregarded (paragraph 59).

**Germany.** § 87(1) Nr. 6 BetrVG gives the works council a co-determination right over "the
introduction and use of technical devices that are meant to monitor the behaviour or performance of
employees" ([BetrVG § 87, current text, read 2026-10-02](https://www.gesetze-im-internet.de/betrvg/__87.html);
my translation). The Federal Labour Court reads "meant to" as objective suitability: a device
qualifies "if it is objectively suited to collect and record behaviour or performance information about
the employee"; the employer's intent "does not matter" ([BAG, 1 ABR 20/21, 2022-03-08, paragraph 30](https://www.bundesarbeitsgericht.de/entscheidung/1-abr-20-21/);
read; my translation). That case concerned Microsoft Office 365, where the parties did not dispute that
the data could be used to check behaviour or performance; the group works council was the competent
body (paragraph 32). Applying it to AI-tool usage logs is my reading; I found no court decision on AI
usage dashboards. § 80(3) BetrVG says that when the works council must assess the use of AI, calling
in an expert counts as necessary, and § 90(1) Nr. 3 requires the employer to inform it about planned
work processes "including the use of artificial intelligence"
([§ 80](https://www.gesetze-im-internet.de/betrvg/__80.html), [§ 90](https://www.gesetze-im-internet.de/betrvg/__90.html); read).

**Netherlands.** Article 27(1) WOR requires works-council consent for a rule on "processing and
protection of personal data" of staff (sub k) and for "provisions aimed at or suitable for observing
or checking presence, behaviour or performance" of staff (sub l), where it concerns all or a group of
staff ([WOR art. 27 on maxius.nl](https://maxius.nl/wet-op-de-ondernemingsraden/artikel27); secondary
copy, consolidation date not shown; the official text is at wetten.overheid.nl, which I could not
fetch). The wording "suitable for" points the same way as the German test (my reading).

**France.** The CNIL says a monitoring device is lawful only if it meets three cumulative conditions:
it passes justification and proportionality tests; it is submitted to staff representative bodies (the
CSE, for employers with 50 or more staff); and staff are told beforehand. It calls constant
surveillance in general excessive, and says a tool set up for one purpose "must not pursue another,
hidden purpose". Its one example close to usage counts: software that transparently reports to a
manager the number of files each employee handles per quarter "seems proportionate", because the
reporting frequency is not constant surveillance
([CNIL, 2026-07-09](https://www.cnil.fr/fr/controle-de-lactivite-des-personnes-employees); read;
my translation).

**United Kingdom (not EU law, but the clearest regulator text I read).** The ICO says employers should
seek and document the views of workers or their representatives "unless there is a good reason not
to", and that a DPIA should cover it. Its purpose-limitation example: data collected to manage
workspace capacity "should not" be re-used "for performance management purposes without identifying a
new lawful basis and establishing the necessity and proportionality of this new purpose"
([ICO, monitoring workers guidance, read 2026-10-02; the ICO page shows no date in my fetch; law-firm notes date it 2023-10-03](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers/)).
This is the best published statement of the main risk for a dashboard: a team-level adoption view
quietly turning into a person-level performance view.

**EU AI Act.** The Digital Omnibus on AI, Regulation (EU) 2026/1744 of 8 July 2026 ([EUR-Lex Official
Journal text, read](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng)), makes three changes that
matter here. It replaces Article 4: providers and deployers must "take measures to support the
development of AI literacy" of their staff, and the duty "does not require providers or deployers to
guarantee any specific level of AI literacy of any individual". So a per-person literacy score is not
a legal duty (my reading). It moves the high-risk obligations for Annex III systems to 2 December 2027
(Annex I systems: 2 August 2028). And it enters into force on the third day after publication in the
Official Journal; I did not capture the publication date. Annex III point 4(b) lists as high-risk "AI
systems intended to be used … to allocate tasks based on individual behaviour or personal traits or
characteristics or to monitor and evaluate the performance and behaviour of persons" in work
relationships; Article 26(7) requires an employer deployer of a high-risk system at the workplace to
inform workers' representatives and the affected workers first; Article 5(1)(f) bans AI that infers
emotions at work, except for medical or safety reasons
([artificialintelligenceact.eu, Future of Life Institute copy of the 2024 text: Annex III, Art. 26, Art. 5](https://artificialintelligenceact.eu/annex/3/);
secondary; EUR-Lex blocked my fetch of the original). The Omnibus amendment list has no entry for
Annex III, Article 26 or Article 5(1)(f) (it adds points to Article 5(1) and paragraphs 1a and 1b), so
the 2024 wording should stand; I read the amendment headings, not every sub-paragraph. No source I read
says whether a count-based usage dashboard is an "AI system" under Article 3(1). A model that scores
staff on their AI use would fall under 4(b) (my reading). The page should not claim either way for a
plain count dashboard.

**What no source settles.** I found no legal threshold that separates "aggregate" from "personal"
data for a small group. Microsoft's minimum group size of five is a product setting: "You'll need to
set this number to at least five" ([Microsoft Learn, Viva privacy settings, ms.date 2025-11-20](https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/privacy-settings)).
The same page says the end-user opt-out "does not apply to Copilot usage data, which will still be
available at the row level". Do not present five as a legal figure.

### 2.5 What the dashboard template needs

This is what the template must specify, from the sources above. It is a requirements list, not page
copy. Items (a) to (f) in the Verdict map to panels 1 to 8 here. Panels 2 and 3 can run on team-level
data; panel 2's reclaim step needs person-level data (see Section 5, question 10).

| # | Panel | Question it answers | Data source | Decision it supports |
| - | ----- | ------------------- | ----------- | -------------------- |
| 1 | Coverage | What share of AI use at work runs through approved tools? | Gateway request logs, SSO app inventory, expense and API billing (the site's `shadow-ai` page names the last two), the AI register | Which tools to approve, replace or block; where the approved path is too hard |
| 2 | Paid versus active | Which paid seats see no use? | Vendor admin APIs: GitHub user-management `last_activity_at`; Microsoft licence view | Reclaim or reassign seats; target enablement |
| 3 | Retention by team | Do people who tried it keep using it, at 4, 8 and 12 weeks? | Gateway or vendor logs; published "returning user" (Microsoft) and "two active days in 28" (GitHub) rules as templates for the definition | Retrain, change the workflow, or retire the tool |
| 4 | Outcome per use case | Did the one outcome agreed before rollout move, against a baseline or comparison group? | The system of record for that outcome (ticketing, CI, CRM), not the AI tool's own logs | Scale, fix or retire the use case |
| 5 | Delivery-health guardrail (engineering use cases) | Did throughput or instability get worse as use grew? | CI/CD and version control: DORA's lead time for changes, deployment frequency, failed deployment recovery time, change fail rate, rework rate; plus review time | Slow or pause a rollout when instability rises |
| 6 | Cost per outcome | What does one unit of the outcome cost? | Billing and API cost, divided by panel 4's outcome count; defined on the existing FAQ page | Budget, build-versus-buy, model choice |
| 7 | Trust and friction pulse | Do people trust the output, rely on it, and say where it gets in the way? | A short repeated survey; DORA publishes trust and reliance items; minimum group size applies | Training and verification effort, tool choice |
| 8 | Policy clarity | Do staff know what is expected, permitted and applicable to them? | The same survey, using DORA's four "AI stance" items | Fix how the acceptable-use policy is communicated |

Notes for the writer (my reading from the sources):

- DORA 2025 says to move from adoption to effective use, so panels 4 to 7 carry the weight and panels
  1 to 3 are diagnostics.
- Do not put on the template: seat count as "adoption"; DAU or WAU without a stated definition; prompt
  counts; lines or code accepted as a success measure; vendor "hours saved" or ROI as value;
  per-person leaderboards; prompt content. Each has a source in 2.3 or 2.4.
- Panels 5 and 6 apply to engineering and workflow use cases only. Panel 4 has to be defined per use
  case; there is no universal outcome.
- Grafana or Metabase over gateway logs is the master plan's idea. I did not research either tool's
  current features or licence terms.
- Site constraints I verified: client JavaScript is limited to Plausible, the theme toggle and search,
  so the page cannot embed a live dashboard. Resource front matter uses `type`, `license`, `version`,
  `status`, `whatInside`, `howToUse`, `sources`.

## 3. What is contested or unsettled

### 3.1 Evidence against the premise: is adoption telemetry worth collecting?

The premise is that counting who uses AI tools, and how often, tells you whether the investment works.
The evidence I read mostly does not support that.

1. **Activity and perception diverge from measured outcomes.** In the METR trial, developers were 19%
   slower while believing they were 20% faster. METR's later survey work says self-reports run high.
   A dashboard built on usage or self-report inherits that gap.
2. **Output counts can rise while quality signals fall.** The Cursor study found a transient jump in
   lines added and a sustained rise in static-analysis warnings and complexity. Faros (vendor,
   observational) found merged pull requests up 98%, review time up 91%, bugs up 9%, and no
   company-level improvement. DORA 2024 estimated lower delivery stability, and DORA 2025 still finds
   higher instability.
3. **Where researchers looked for economy-level effects, they mostly found none yet.** Humlum and
   Vestergaard found precise null effects on earnings and hours; executives in the NBER firm survey
   mostly reported no productivity impact. Both measure things other than tool value (pay and hours;
   executive opinion), so they are weak evidence either way (my reading).
4. **The measurement community itself moved away from usage counts.** DORA 2024 preferred reliance to
   frequency; DORA 2025 tells readers to move from adoption to effective use, and its page on
   frameworks calls logs-based metrics "objective" a misconception.
5. **The headline vendor numbers are assumptions multiplied by counts.** Microsoft's assisted hours,
   GitHub's ROI estimate and Intercom's assumed resolutions all rest on a rule chosen by the vendor.
6. **High use can come with less learning.** The Anthropic trial (vendor-authored, 52 people) found a
   17% lower quiz result with AI. A usage count cannot see the difference.
7. **Measuring people has a cost.** Works-council rights, DPIA screening, the risk of re-use for
   performance management (ICO example) and gaming (DX warning) all apply. A dashboard nobody acts on
   still carries them.
8. **A clean test is hard at company scale.** METR could not get an unbiased estimate from 57
   developers and 800+ tasks, because developers withheld tasks. A 30-to-300-person company will
   rarely do better than a before-and-after view (my reading).

Evidence for the other side, for balance: the support-agent field study (15% more issues resolved per
hour); DORA 2025's finding that adoption now goes with higher throughput; and METR's own statement
that developers are likely more sped up in 2026, though it calls its data very weak evidence.

**Verdict.** Most telemetry is theatre in the narrow sense that it counts exposure and cannot show
value. Seat counts, DAU or WAU, prompt volume, lines accepted, acceptance rate and vendor "hours saved"
fall in that group. The defensible subset, each with its reason:

- **Coverage** (panel 1): a governance question about where AI is used, which needs no person-level
  data. It links to the register and to shadow AI.
- **Paid versus active, and retention by team** (panels 2 and 3): a cost and enablement diagnostic. It
  tells you where a tool is not used; it does not tell you the tool works.
- **One pre-agreed outcome per use case, against a baseline** (panel 4): the only panel that can show
  value.
- **Delivery-health guardrails** (panel 5): they catch the instability that DORA keeps finding.
- **Cost per outcome** (panel 6): it ties spend to the outcome.
- **A short repeated survey** (panels 7 and 8): it measures trust, reliance and policy clarity, read as
  opinion.
- **Hard rules on people data**: no leaderboards, no prompt content, no re-use for performance
  management without a new basis.

This verdict is my synthesis. It is not a claim that any source makes in these words.

### 3.2 Other open questions

- **No shared definition of "active".** GitHub counts a day with one interaction in its daily figure
  and needs two days in 28 for a phase; Microsoft uses one action in a window and 12-week bands; DORA
  uses a survey factor. Adoption rates from different tools are not comparable.
- **Causal wording.** DORA 2025 dropped "effects" for "comparisons" and says it has a snapshot, not
  panel data. The Cursor paper claims a causal estimate for a narrow population.
- **METR's two studies disagree**, and METR flags its 2025 result as out of date and its 2026 data as
  unreliable. Any sentence on "AI makes developers slower" or "faster" ages quickly.
- **Self-report versus experiment.** Surveys report larger gains than field experiments; how much
  larger is not settled (METR says so).
- **Tools change faster than studies.** Most experimental data predates agentic tools (METR names
  early and late 2025 as its latest trials). Treat any number here as a dated finding.
- **Legal scope for vendor dashboards.** Whether an aggregated vendor dashboard triggers works-council
  rights, and whether row-level exports do, varies by country and by case. The German test is
  objective suitability; I found no decision on AI-usage dashboards. I did not find a regulator text
  specific to AI-usage telemetry.
- **AI Act dates are new.** The Omnibus is under three months old (signed 2026-07-08). Dates may be
  amended again. Article 4(2)-(3) tasks the Commission and the Board with practical examples and
  recommendations; I did not check whether they have been published.
- **WP29 documents are from 2017**, written before the GDPR applied, by a body since replaced by the
  EDPB. I did not verify the EDPB's current status for WP248.
- **Other things I could not find:** an independent study that tests whether a usage-based adoption
  metric predicts outcomes; publication dates for the GitHub docs, DX and ICO pages; a legal figure for
  minimum group size; and a standard definition of "deflection rate". I opened the Dutch government's
  DPIA page on Microsoft 365 Copilot (rijksoverheid.nl) but recorded no finding from it, so this record
  makes no claim from it.

## 4. What is already on meshin.co

Checked in `site/src/data` and the built `site/dist` (built 2026-10-02 06:13, HEAD `bd0feb3`). L50 and
L51: one concept is defined on exactly one page, so the new page links to these and does not redefine
them.

| Route | What it already covers | What the new page does |
| ----- | ---------------------- | ---------------------- |
| `/faq/how-is-cost-per-outcome-measured` | The home of "cost per outcome" | Link for panel 6. Do not redefine it |
| `/glossary/shadow-ai` | "Look rather than ask": browser extension inventories, expense reports, API billing; fold findings into the register | Link for panel 1 |
| `/glossary/ai-register` | The register | Link for panel 1 |
| `/glossary/dpia` | Mirrors Article 35(3) only. It does not define the employee-monitoring trigger (WP248 criteria, national lists) | Gap. Either extend this page (one definition, per L50) and link to it, or define it in the article and link from the glossary. Owner decides (question 22) |
| `/glossary/observability` | Tracing of systems, not user adoption | Link and distinguish. Do not redefine |
| `/glossary/llm-gateway` and `/resources/llm-gateway-governance-config` | Gateway policy schema with a `log_retention` key; "rate limit per team, not per user" | Link as the log source and as the team-not-user precedent |
| `/glossary/post-market-monitoring`, `/glossary/evals`, `/glossary/human-oversight`, `/glossary/ai-impact-assessment`, `/glossary/data-classification`, `/glossary/eu-ai-act` | Adjacent terms | Link where used. `eu-ai-act` cites the consolidated text dated 2026-07-27 and, in the lines I grepped, states no application dates that the Omnibus changed |
| `/blog/ai-acceptable-use-policy-for-a-50-person-company` | "Check instead of asking". Says nothing on telemetry about staff or on telling staff they are monitored | Link; the new page adds what it lacks, by link and not by repeating |
| `/blog/why-your-ai-pilot-never-reached-production` | "A measurable outcome", "measure without a survey", tracing and cost per outcome | Link for panel 4 |
| `/blog/evals-in-ci-for-llm-agents` | Cost per completed run | Link; distinguish evals from adoption telemetry |
| `/blog/how-to-build-an-ai-system-register-in-a-week` | The register build | Link for panel 1 |
| `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval` | Unapproved tools | Link for panel 1 |
| `/resources/ai-governance-starter-kit`, `/resources/ai-readiness-scorecard`, `/resources/agent-evals-ci-starter`, `/resources/build-vs-buy-ai-kit` | Existing resources; none is a dashboard or telemetry resource | Link where relevant. The template is a new artifact type |
| `/services/90-day-production-sprint` | Deliverable: "Tracing and cost per outcome on a dashboard your finance team can read" | Link; the new page must not promise more than this |
| `/services/fractional-caio-retainer` | The retainer | Link as the next step |
| `/approach` and the home page `drivers` | "I check who is still using the system a month after launch, from logs, not from the announcement email"; "Telemetry, not a launch email, says if it lasted." | Reconcile (see below) |
| `site/src/data/categories.mjs` (`operating-model`, `executive`) | "A metric you have to survey for cannot gate a release"; "Do not ask for a token count … those measure activity, not risk." | Consistent with the verdict. Link `/blog/category/operating-model` |
| `/ai-policy`, `/case-studies/only-help-agentic-support` | The owner's policy; a case that mentions OpenTelemetry tracing and records no metrics | Do not cite as evidence of adoption results |

Findings:

- Nothing on the site mentions works councils, employee monitoring, seat counts or DAU/WAU.
- **Reconcile with `/approach` and the home line.** Both say telemetry shows whether use lasted. The
  evidence supports that. It does not support reading "lasted" as "worked". The page should say
  telemetry shows whether use lasted and an outcome measure shows whether it worked.
- `/approach` says "who is still using the system". In the EU, a log of who uses a tool is personal
  data. The page needs to say at what level the owner counts (question 11).
- Glossary pages carry `updatedDate` 2026-10-02 for `shadow-ai`, `ai-register` and `dpia`, so they
  were edited today by someone else; re-check them when writing.

## 5. What only the owner can supply

No source can answer these. The repo rule applies: never invent an owner fact, client name or metric.
Questions marked **(blocker)** stop the page from being written honestly.

**Experience and claims**

1. **(blocker)** Have you run adoption telemetry for a client, or for your own practice? Which figures
   may be published, anonymised? If none, the page must say it is method, not results.
2. **(blocker)** `/approach` says you check "who is still using the system a month after launch, from
   logs". What exactly do you count? For example, users active in week 4 divided by users active in
   week 1? From which log: gateway, vendor admin, SSO? What counts as "using": one request, or two
   active days in 28 as GitHub does?
3. When retention is low, what do you do (retire, retrain, change the workflow)? Is there a floor you
   commit to?

**Method and thresholds**

4. **(blocker)** How do you set a baseline or comparison group before rollout in a company of 30 to 300
   people: staggered rollout by team, before-and-after, or none? If none, should the page say so?
5. **(blocker)** Which one outcome per use case do you pick, and who signs it off before rollout? Give
   two or three you have really used, without client names. What is your definition of "deflection
   rate" and "time-to-resolution" from the master plan, given that vendors count assumed resolutions?
6. What minimum group size do you use for any breakdown? Why that number?
7. What log retention do you advise, compared with the `log_retention` key in your gateway config?
8. Which survey questions do you ask, how often, and may the page reuse DORA's published trust,
   reliance and AI-stance items with credit?
9. Which tool classes are in scope: coding assistants, chat assistants, SaaS tools with AI built in,
   internal agents? Does v1 of the template cover all, or one?

**People data**

10. **(blocker)** Do you ever look at named individuals' AI usage, for example to reclaim a seat? Under
    what rule, who sees it, and how long is it kept?
11. **(blocker)** What is your default: no person-level view at all, pseudonymised, or named for one
    narrow purpose? Same question for `/approach`: do you count people or accounts?
12. Do you advise collecting prompt content? (Claude Code does not export it by default.)
13. Do you advise telling staff before telemetry starts, and how: a policy clause, a notice, both?

**EU and legal**

14. **(blocker)** Do you take clients with works councils? In which countries (Germany, Netherlands,
    France, others)? Is "involve the works council before you switch it on" a standard step in your
    sequence?
15. **(blocker)** Who runs the DPIA screening for a client: you, the client's DPO, or their counsel? What
    is your referral route? Will the page carry a "not legal advice" line, and in what words?
16. Do you hold any privacy credential? The only public one is the ISO/IEC 42001 lead implementer course
    "in progress". Invent nothing beyond it.

**The template**

17. **(blocker)** Is there a working dashboard to export now, or must one be built? On which stack
    (Grafana, Metabase, spreadsheet) and over which logs?
18. Which formats ship (Grafana JSON, SQL views, spreadsheet), under which licence? Page only, or a
    `github.com/meshin-co/<slug>` repo?
19. Are the eight panels in 2.5 your v1? What do you cut or add?

**Voice and consistency**

20. **(blocker)** Do you accept publishing that most adoption telemetry is theatre? How should that sit
    beside `/approach` ("Adoption") and the home line "Telemetry, not a launch email, says if it
    lasted"?
21. Is `/faq/how-is-cost-per-outcome-measured` the canonical home of cost per outcome, with the new page
    linking to it only?
22. The `dpia` glossary page mirrors Article 35(3) only. Do you want the employee-monitoring trigger
    defined there, with the article linking to it, or defined in the article?

## 6. Sources

P means primary: a regulator, a court, legal text, a standards or research body, or the vendor's own
documentation for its own product. S means secondary: a summary, a copy or a news or law-firm note.
"Vendor" flags a commercial interest in the result. Read: **full** is the whole text; **part** is the
relevant sections; **abstract** is the abstract only; **snippet** is a search result only.

1. DORA, *State of AI-assisted Software Development 2025*. Google Cloud / DORA. Announced 2025-09-24
   (report v2025.2). P (survey authors); vendor-published. Read: full text.
   https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
2. DORA, *Accelerate State of DevOps 2024*. Google Cloud / DORA. 2024, v2024.3 (month not in the PDF
   text). P; vendor-published. Read: part.
   https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf
3. DORA, "Measurement frameworks". dora.dev. 2025-08-06, updated 2025-08-26. P. Read: full.
   https://dora.dev/insights/measurement-frameworks/
4. DORA, "Balancing AI tensions". dora.dev. 2026-03-10. P; single-company qualitative. Read: full.
   https://dora.dev/insights/balancing-ai-tensions/
5. METR, early-2025 developer study. METR. 2025-07-10. P. Read: full.
   https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
6. METR, uplift update. METR. 2026-02-24. P. Read: full.
   https://metr.org/blog/2026-02-24-uplift-update/
7. METR, AI usage survey. METR. 2026-05-11. P. Read: full.
   https://metr.org/blog/2026-05-11-ai-usage-survey/
8. *Speed at the Cost of Quality: How Cursor AI Increases Short-Term Velocity and Long-Term
   Complexity in Open-Source Projects* (arXiv 2511.04427). arXiv. Submitted 2025-11-06. P; preprint.
   Read: abstract and results text. https://arxiv.org/abs/2511.04427
9. Faros AI, "The AI Productivity Paradox Report 2025". Faros. 2025-07-23. P for its own data;
   vendor; observational. Read: part. https://www.faros.ai/blog/ai-software-engineering
10. Brynjolfsson, Li, Raymond, "Generative AI at Work", *Quarterly Journal of Economics* 140(2),
    889-942. Publisher per RePEc: President and Fellows of Harvard College. 2025. P; peer reviewed. Read: abstract (RePEc).
    https://ideas.repec.org/a/oup/qjecon/v140y2025i2p889-942..html
11. Humlum, Vestergaard, NBER WP 33777. NBER. Issued May 2025, revised March 2026. P; working paper.
    Read: abstract. https://www.nber.org/papers/w33777
12. Yotzov and others, "Firm Data on AI", NBER WP 34836. NBER. Issued February 2026, revised March
    2026. P; working paper; executive self-report. Read: abstract. https://www.nber.org/papers/w34836
13. Anthropic, AI assistance and coding skills (arXiv 2601.20245). Anthropic. Published 2026-01-29,
    modified 2026-09-09. P; vendor-authored. Read: full.
    https://www.anthropic.com/research/AI-assistance-coding-skills
14. Ziegler and others, "Productivity Assessment of Neural Code Completion" (arXiv 2205.06537). arXiv.
    2022-05-13. P; preprint. Read: abstract and results.
    https://arxiv.org/abs/2205.06537
15. GitHub Docs, Copilot usage metrics (concepts). GitHub. Undated. P (vendor documentation). Read:
    full. https://docs.github.com/en/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics
16. GitHub changelog, "Copilot metrics is now generally available". GitHub. 2026-02-27. P. Read: full.
    https://github.blog/changelog/2026-02-27-copilot-metrics-is-now-generally-available/
17. GitHub changelog, "Team-level Copilot usage metrics now available via API". GitHub. 2026-05-14. P.
    Read: full.
    https://github.blog/changelog/2026-05-14-team-level-copilot-usage-metrics-now-available-via-api/
18. Microsoft Learn, Microsoft 365 Copilot Dashboard. Microsoft. ms.date 2026-09-29. P (vendor
    documentation). Read: part.
    https://learn.microsoft.com/en-us/viva/insights/org-team-insights/copilot-dashboard
19. Microsoft Learn, Viva Insights privacy settings. Microsoft. ms.date 2025-11-20. P (vendor
    documentation). Read: part.
    https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/privacy-settings
20. Claude Code docs, "Monitoring". Anthropic. Page metadata modified 2026-10-02. P (vendor
    documentation). Read: part. https://code.claude.com/docs/en/monitoring-usage
21. DX, AI Measurement Framework. DX. Undated in my fetch. P for its own framework; vendor. Read:
    full. https://getdx.com/research/measuring-ai-code-assistants-and-agents/
22. Intercom Help, "Fin AI Agent outcomes". Intercom. Page metadata modified 2026-09-23. P (vendor
    documentation). Read: part. https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes
23. Regulation (EU) 2016/679 (GDPR). European Parliament and Council. OJ L 119, 4.5.2016. P. Read:
    Articles 5, 35, 88. https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
24. Article 29 Working Party, Guidelines on DPIA, WP 248 rev.01. Adopted 2017-04-04; last revised and
    adopted 2017-10-04. P. Read: criteria and examples table.
    https://ec.europa.eu/newsroom/article29/redirection/document/47711
25. Article 29 Working Party, Opinion 2/2017 on data processing at work, WP 249. Adopted 2017-06-08.
    P. Read: summary and conclusions.
    https://ec.europa.eu/newsroom/article29/redirection/document/45631
26. Court of Justice of the EU, Case C-65/23, MK v K GmbH. 2024-12-19. P. Read: paragraphs 34-59.
    https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62023CJ0065
27. Betriebsverfassungsgesetz §§ 80, 87, 90. Federal Ministry of Justice, gesetze-im-internet.de.
    Current consolidated text, read 2026-10-02. P. Read: the paragraphs cited.
    https://www.gesetze-im-internet.de/betrvg/__87.html (and `__80.html`, `__90.html`)
28. Bundesarbeitsgericht, 1 ABR 20/21 (ECLI:DE:BAG:2022:080322.B.1ABR20.21.0). 2022-03-08. P. Read:
    paragraphs 29-32. https://www.bundesarbeitsgericht.de/entscheidung/1-abr-20-21/
29. Wet op de ondernemingsraden, art. 27. maxius.nl copy; official text at wetten.overheid.nl
    (not fetched). S; consolidation date not shown. Read: article 27(1).
    https://maxius.nl/wet-op-de-ondernemingsraden/artikel27
30. CNIL, "Travail, ressources humaines : le contrôle de l'activité des personnes employées". CNIL.
    2026-07-09. P. Read: full.
    https://www.cnil.fr/fr/controle-de-lactivite-des-personnes-employees
31. ICO, Monitoring workers (guidance). UK Information Commissioner's Office. Page undated in my
    fetch. P (UK law, not EU). Read: main page and two subpages.
    https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers/
32. Taylor Wessing, "ICO publishes final guidance on data protection and monitoring workers".
    2023-10. S; used only for the ICO publication date (2023-10-03). Read: snippet.
    https://www.taylorwessing.com/en/insights-and-events/insights/2023/10/ico-publishes-final-guidance-on-data-protection-and-monitoring-workers
33. Regulation (EU) 2026/1744 (Digital Omnibus on AI). European Parliament and Council. Signed
    2026-07-08. P. Read: full Official Journal text.
    https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng
34. EU AI Act, Annex III, Articles 5 and 26 (copy of Regulation (EU) 2024/1689, OJ 12.7.2024).
    artificialintelligenceact.eu, Future of Life Institute. S (copy of a primary text). Read: the
    passages cited. https://artificialintelligenceact.eu/annex/3/
35. Repo documents: `docs/SEMANTIC-CORE.md`, `docs/PRD.md` §15 and §17.3, `docs/sources/master-plan.mhtml`,
    `AGENTS.md`. Internal. Read.

Unverified items, listed so a reader knows what was not checked:

- The EDPB's current status for WP248; any national DPIA list under Article 35(4).
- The official Dutch text of WOR art. 27 (read through a secondary copy) and the Dutch works-council
  size threshold.
- The German works-council size threshold, and any court decision on AI-usage dashboards.
- Peer-review status of the Cursor study; the exact percentages for its quality results.
- The Official Journal publication date of Regulation (EU) 2026/1744.
- Grafana and Metabase capabilities and licence terms.
- A regulator text specific to AI-usage telemetry (searched with a few queries, none found).

---

## Addendum, 2026-10-03: two errors found after publication

1. **Microsoft's assisted-hours method was recorded too narrowly.** Section 2 records the method
   as action counts times fixed minutes per action. The Copilot dashboard page (fetched
   2026-10-03) also counts meeting recaps by position in the meeting: "if a user summarizes a
   meeting a half hour into the one hour, that counts as 0.5 assisted hours". The $72 default
   hourly rate values the hours; it is not an input to them. Both were recorded imprecisely.
2. **METR's reasons for calling its 2026 data unreliable were compressed.** The record carries
   "mainly because many developers declined to include tasks they did not want to do without AI".
   METR's post names as its primary reason developers choosing not to participate at all because
   they do not wish to work without AI, and lists more selective task submission separately.
