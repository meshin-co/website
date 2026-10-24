---
title: 'Adoption telemetry for AI tools: what a trial found'
description: 'Adoption telemetry for AI tools: six measures, each with a stated limit, and the 2025 METR trial that shows why self-report misleads.'
publishDate: 2026-10-02
updatedDate: 2026-10-25
shortAnswer: "Adoption telemetry for AI tools should show whether use lasted and whether an agreed outcome moved. In METR's 2025 trial, developers believed AI made them 20% faster, while their tasks took 19% longer. METR now marks that result out of date. Count use by team, then read one outcome per use case against a baseline or comparison group."
fullAnswer: "Adoption telemetry for AI tools usually reports seats, logins, active users and prompts. That is an inference from the sources cited here. None of them shows any of those counts predicting a business result. Self-reports can mislead too. In METR's 2025 trial, 16 experienced developers expected a 24% speed-up. Afterwards they believed they had been 20% faster. Their tasks took 19% longer. METR now marks that result out of date. In an NBER working paper issued in February 2026, nearly 6,000 senior executives reported that 69% of firms use AI. Nine in ten reported no impact on employment or productivity over three years. That is also self-report. A smaller set is easier to defend: coverage, retention by team, one agreed outcome, delivery health, cost per outcome and a trust survey read as opinion. That set is a synthesis, not a finding any source states. Collect it by team, and screen any per-person view first."
keyTakeaways:
  - 'A seat or login count shows exposure. None of the sources cited here shows such a count predicting a business result.'
  - "People can misjudge what AI does for them. In METR's 2025 trial, developers believed they were 20% faster while their tasks took 19% longer. METR now marks that result out of date."
  - 'Executives report little effect, and that is also self-report. In an NBER working paper issued in February 2026, nine in ten of nearly 6,000 senior executives reported no impact on employment or productivity over three years.'
  - 'Telemetry shows whether use lasted. In this set, only the outcome measure can show whether it worked, against a baseline or comparison group. That is a synthesis, not a finding any source states.'
  - 'Collect by team, in groups of five or more. Screen any per-person view for a DPIA first, and where a works council exists, check its rights and engage it before you switch anything on.'
faq:
  - q: 'Is a daily active user count a useful adoption metric?'
    a: 'Not as a measure of value. A count says someone used the tool. It does not say work improved. If you show one, write the definition on the panel, because GitHub, Microsoft and DORA each define use differently. Mine is two different active days within four weeks. Paid versus active use and retention by team are the usage views this article supports.'
  - q: 'Do vendor hours-saved figures show value?'
    a: 'Not on their own. Microsoft builds its assisted-hours figure from action counts, fixed minutes per action, and meeting recaps counted by meeting length. A default hourly rate then values those hours. GitHub says its ROI figures are estimates rather than exact financial results.'
  - q: 'Can a staff survey tell us whether an AI tool works?'
    a: "It tells you what people believe, and belief can run ahead of what a trial finds. In METR's 2025 trial, developers believed AI had sped them up by 20% while their tasks took 19% longer. METR now marks that result out of date. Use a survey for trust and friction, and read it as opinion. I reuse DORA's published items word for word, with credit, once a quarter."
  - q: 'Can we report AI usage by named employee?'
    a: 'Not by default. I report by team only, in groups of five or more. A named view needs a narrow stated purpose, a written record and approval by two people. It is kept 30 days. A DPIA screening comes first. In Germany a works council has a say over tools that can monitor staff. Whether that covers an AI usage log is an inference. Ask your data protection officer or counsel first.'
category: operating-model
tags:
  - production-readiness
  - ai-governance
  - shadow-ai
  - ai-pilots
sources:
  - title: 'METR: Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity'
    url: 'https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/'
    publisher: METR
    retrieved: '2026-10-02'
  - title: 'METR: We are Changing our Developer Productivity Experiment Design'
    url: 'https://metr.org/blog/2026-02-24-uplift-update/'
    publisher: METR
    retrieved: '2026-10-02'
  - title: 'METR: Measuring the Self-Reported Impact of Early-2026 AI on Technical Worker Productivity'
    url: 'https://metr.org/blog/2026-05-11-ai-usage-survey/'
    publisher: METR
    retrieved: '2026-10-02'
  - title: 'NBER working paper 34836: Firm Data on AI'
    url: 'https://www.nber.org/papers/w34836'
    publisher: NBER
    retrieved: '2026-10-02'
  - title: 'Brynjolfsson, Li and Raymond: Generative AI at work, Quarterly Journal of Economics 140(2)'
    url: 'https://ideas.repec.org/a/oup/qjecon/v140y2025i2p889-942..html'
    publisher: RePEc
    retrieved: '2026-10-02'
  - title: 'DORA: State of AI-assisted software development 2025'
    url: 'https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf'
    publisher: Google Cloud / DORA
    retrieved: '2026-10-02'
  - title: 'DORA: Accelerate State of DevOps 2024'
    url: 'https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf'
    publisher: Google Cloud / DORA
    retrieved: '2026-10-02'
  - title: 'DORA: Measurement frameworks'
    url: 'https://dora.dev/insights/measurement-frameworks/'
    publisher: DORA
    retrieved: '2026-10-02'
  - title: 'GitHub Docs: Copilot usage metrics'
    url: 'https://docs.github.com/en/copilot/concepts/billing-and-usage/copilot-usage-metrics/copilot-metrics'
    publisher: GitHub
    retrieved: '2026-10-02'
  - title: 'Microsoft Learn: Microsoft 365 Copilot Dashboard'
    url: 'https://learn.microsoft.com/en-us/viva/insights/org-team-insights/copilot-dashboard'
    publisher: Microsoft
    retrieved: '2026-10-02'
  - title: 'Microsoft Learn: Viva Insights privacy settings'
    url: 'https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/privacy-settings'
    publisher: Microsoft
    retrieved: '2026-10-02'
  - title: 'Claude Code documentation: Monitoring'
    url: 'https://code.claude.com/docs/en/monitoring-usage'
    publisher: Anthropic
    retrieved: '2026-10-02'
  - title: 'Intercom Help: Fin AI Agent outcomes'
    url: 'https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes'
    publisher: Intercom
    retrieved: '2026-10-02'
  - title: 'Speed at the cost of quality: how Cursor AI increases short-term velocity and long-term complexity (arXiv 2511.04427, preprint)'
    url: 'https://arxiv.org/abs/2511.04427'
    publisher: arXiv
    retrieved: '2026-10-02'
  - title: 'Faros AI: The AI productivity paradox report 2025'
    url: 'https://www.faros.ai/blog/ai-software-engineering'
    publisher: Faros AI (vendor)
    retrieved: '2026-10-02'
  - title: 'Ziegler and others: Productivity assessment of neural code completion (arXiv 2205.06537, preprint)'
    url: 'https://arxiv.org/abs/2205.06537'
    publisher: arXiv
    retrieved: '2026-10-02'
  - title: 'DX: AI measurement framework'
    url: 'https://getdx.com/research/measuring-ai-code-assistants-and-agents/'
    publisher: DX
    retrieved: '2026-10-02'
  - title: 'Regulation (EU) 2016/679 (GDPR), Articles 5 and 35 - EUR-Lex'
    url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng'
    publisher: EUR-Lex
    retrieved: '2026-10-02'
  - title: 'Article 29 Working Party: Opinion 2/2017 on data processing at work (WP 249)'
    url: 'https://ec.europa.eu/newsroom/article29/redirection/document/45631'
    publisher: Article 29 Working Party
    retrieved: '2026-10-02'
  - title: 'Betriebsverfassungsgesetz, section 87(1) no. 6'
    url: 'https://www.gesetze-im-internet.de/betrvg/__87.html'
    publisher: gesetze-im-internet.de
    retrieved: '2026-10-02'
  - title: 'Bundesarbeitsgericht, 1 ABR 20/21, 8 March 2022'
    url: 'https://www.bundesarbeitsgericht.de/entscheidung/1-abr-20-21/'
    publisher: Bundesarbeitsgericht
    retrieved: '2026-10-02'
  - title: 'Wet op de ondernemingsraden, article 27'
    url: 'https://wetten.overheid.nl/BWBR0002747/2023-02-18#HoofdstukIVA_Artikel27'
    publisher: Overheid.nl
    retrieved: '2026-10-14'
  - title: "CNIL: Le contrôle de l'activité des personnes employées"
    url: 'https://www.cnil.fr/fr/controle-de-lactivite-des-personnes-employees'
    publisher: CNIL
    retrieved: '2026-10-02'
  - title: 'ICO: Monitoring workers'
    url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers/'
    publisher: ICO
    retrieved: '2026-10-02'
author: dmitri
relatedResources:
  - adoption-telemetry-dashboard-template
---

In my reading of the sources cited here, adoption telemetry for AI tools needs six measures:

- Coverage of approved tools.
- Paid versus active use, with retention by team.
- One agreed outcome per use case.
- Delivery health, for engineering use cases.
- Cost per outcome.
- A short repeated survey, read as opinion.

That set is a synthesis, not a finding any source states. The evidence for it starts with a randomised trial.

In July 2025, METR published a randomised trial. Sixteen experienced open-source developers worked on 246 issues. Before the trial they expected AI to make them 24% faster. Afterwards they believed it had made them 20% faster. Their tasks took 19% longer with AI allowed. METR now marks that result as out of date.

That gap between what the developers believed and what the trial found is why the list above treats a survey as opinion. In my reading, a dashboard built on self-report inherits it, and no cited source shows usage counts predicting a result. Because METR marks the result as out of date, take the lesson as one about method. It is not a lesson about the size of any one effect.

Executives report little effect, and that is also self-report. An NBER working paper issued in February 2026 surveyed nearly 6,000 senior executives in the US, UK, Germany and Australia. It found that 69% of firms use AI. Nine in ten executives reported no impact on employment or productivity over three years.

## How far apart can belief and evidence be?

The table sorts six sources by how each one got its result: a trial or study, work-system data, or what people said.

| Source and date                                                    | Kind                           | Result                                                                                                                                                                             | How far to trust it                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| METR randomised trial, 10 July 2025                                | Randomised trial               | Tasks took 19% longer with AI allowed. Developers had expected a 24% speed-up and afterwards believed 20%. 16 developers, 246 issues.                                              | Small, with early-2025 tools. METR now marks the result out of date.                                                                                                                                                                  |
| METR follow-up, 24 February 2026                                   | Follow-up study                | Raw estimates: returning developers 18% faster, new developers 4% faster. Both intervals include a slowdown. 57 developers, 800 or more tasks.                                     | METR calls it "an unreliable signal". Many developers declined to include tasks they did not want to do without AI, which likely biases the estimate downward. METR calls its data "only very weak evidence" of the size of the gain. |
| Brynjolfsson, Li and Raymond, Quarterly Journal of Economics, 2025 | Measured from work-system data | Issues resolved per hour rose 15% on average across 5,172 support agents. Less experienced agents improved on speed and quality. Gains for the most experienced agents were small. | Journal article with a staggered rollout. One setting, customer support. Figures are from the abstract.                                                                                                                               |
| METR survey, 11 May 2026                                           | Reported by people             | 349 technical workers. Median self-reported speed-up of three times, and 1.4 to 2 times in the value of their work.                                                                | Convenience sample, with a response rate near 2% for emailed invitations. METR says survey estimates tend to be larger than field-experiment estimates.                                                                               |
| NBER working paper 34836, February 2026 (revised March)            | Reported by executives         | Nearly 6,000 senior executives in the US, UK, Germany and Australia. 69% of firms use AI. Nine in ten report no impact on employment or productivity over three years.             | Executive self-report. Figures are from the abstract.                                                                                                                                                                                 |
| DORA report, September 2025                                        | Reported by people             | Survey of nearly 5,000 people. More than 80% say AI raised their productivity.                                                                                                     | A snapshot. DORA describes comparisons, not effects. Published by a vendor (Google Cloud).                                                                                                                                            |

Reported figures disagree. Executives report little impact, while technical workers report large gains. They were asked different questions. Technical workers were asked about their own speed and the value of their work. Executives were asked about employment and productivity over three years.

The first three rows disagree in size and sign, and METR flags both of its own results as limited. In February 2026 METR said it believes developers are likely more sped up in early 2026. It called its own data "only very weak evidence" of the size of the gain. Any sentence that says AI makes people faster or slower ages quickly.

A survey of your own staff belongs in the reported group. METR says survey estimates tend to be larger than field-experiment estimates.

## What do the usual adoption panels count?

The panels below are the usual ones in the sources cited here. That is an inference, not a count.

Each tool defines an active user its own way. Figures from two tools do not compare.

| Source                          | What counts as active                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Copilot usage metrics    | At least two active days in the trailing 28 to be placed in a usage phase. GitHub says "Passive" is not a measure of inactivity. |
| Microsoft 365 Copilot Dashboard | Usage levels over a rolling 12 weeks. A returning user has at least one action in both the current and the previous period.      |
| DORA 2025 report                | No log rule. Adoption is a survey factor made of reliance, trust and reflexive use.                                              |

Each panel below has a reason it misleads.

| Measure                                      | What it counts                                  | Why it misleads                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seats or licences                            | Money spent.                                    | In GitHub's reports, seat data is not included. It sits in a separate user-management API.                                                                                                                                                                                                                                                                                                                                    |
| Daily or weekly active users                 | One event in a window.                          | The window and the event differ by vendor, as the table above shows.                                                                                                                                                                                                                                                                                                                                                          |
| Usage frequency, prompt counts               | How often.                                      | DORA's 2024 report, also published by Google Cloud, said measuring usage frequency is "likely not as meaningful as measuring reliance".                                                                                                                                                                                                                                                                                       |
| Lines of code accepted, pull requests merged | Output volume.                                  | GitHub calls its lines figure directional. A preprint on Cursor, covering open-source projects, found a short jump in lines added and lasting rises in static-analysis warnings and complexity. Faros, a vendor, found that teams with high adoption completed 21% more tasks and merged 98% more pull requests, with 91% longer review time and no significant link to company-level improvement. Its data is observational. |
| Acceptance rate                              | Suggestions taken.                              | In a 2022 preprint on Copilot users, it tracked how productive users said they felt, rather than how long the accepted code lasted.                                                                                                                                                                                                                                                                                           |
| Vendor hours saved and ROI                   | Action counts times fixed minutes times a wage. | Microsoft builds assisted hours from action counts, fixed minutes per action, and meeting recaps counted by meeting length. A default hourly rate then values them. GitHub says its ROI figures are estimates rather than exact financial results.                                                                                                                                                                            |
| Self-reported speed-up                       | Opinion.                                        | METR says that in its 2025 trial people overestimated the effect on their task time by 40 percentage points. METR now marks that result out of date.                                                                                                                                                                                                                                                                          |
| Vendor resolution or deflection              | Conversations that ended.                       | Intercom counts a customer who leaves without asking again as resolved, and charges for it, even if the customer is unhappy, unless its agent escalates.                                                                                                                                                                                                                                                                      |
| Adoption multiplier                          | Engaged users against passive users.            | GitHub divides the average merged pull requests of engaged users by that of passive users. That compares people who chose the tool with people who did not, so it cannot isolate the tool's effect. That is an inference, not a GitHub statement.                                                                                                                                                                             |

DORA's 2025 report says: "The conversation must shift from adoption to effective use." DORA's page on measurement frameworks calls it a "common misconception that logs-based metrics are objective".

None of the sources cited here shows a usage count predicting a business result. The research behind this article found no independent study that tests whether a usage-based adoption metric predicts outcomes.

## What should adoption telemetry measure instead?

This set is a synthesis of the evidence above. No source states it in these words.

Sort every number by where it came from. Logs show what people did. Surveys show what people said. The system where the work is recorded shows what happened there, and a randomised trial compares like against like. No one of these is the whole truth on its own. Six measures hold up better, and each has a limit.

| Measure                                   | Question it answers                                                                   | What it cannot tell you                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| Coverage                                  | How much AI use at work runs through approved tools?                                  | Whether those tools help.                    |
| Paid versus active, and retention by team | Which seats sit unused, and do people who tried a tool keep using it?                 | Whether the tool works.                      |
| One outcome per use case                  | Did the outcome agreed before rollout move, against a baseline or a comparison group? | Why it moved, if there is no comparison.     |
| Delivery health (engineering use cases)   | Did throughput or instability get worse as use grew?                                  | Whether the use case pays off.               |
| Cost per outcome                          | What does one unit of the outcome cost?                                               | Whether it is the right outcome.             |
| A short repeated survey                   | Do people trust the output, rely on it, and say where it gets in the way?             | Whether work got faster. Read it as opinion. |

The first two rows are diagnostics. Coverage is a governance question about where AI is used. Paid versus active use and retention show where a tool sits unused, which wastes money and points to a workflow problem. In this set, only the third row can show value. Put the weight on the outcome, delivery health, cost and survey rows, and read the survey as opinion.

The [approach page](/approach) says I check who is still using the system a month after launch. The rule is people active in week four over people active in week one, per team, from gateway logs. Active means two different active days within four weeks. I count people, not accounts.

When a team stops using a tool, I treat it as a workflow question, not a people question.

Delivery health is on the list because DORA's 2025 report, published by Google Cloud, found AI adoption going with higher delivery throughput and still with higher instability. DORA describes that as a comparison in a snapshot, not an effect.

For the survey, I reuse the items DORA publishes on trust, reliance and AI stance. I use them word for word and credit DORA. I ask once a quarter, and it takes five minutes to answer.

This agrees with the [approach page](/approach). There, [evals](/glossary/evals) in CI, [tracing](/glossary/observability), [cost per outcome](/faq/how-is-cost-per-outcome-measured) and a rollback path come before a workflow touches a customer. The measures here add one line. Telemetry shows whether use lasted. An outcome measure shows whether it worked.

These are different jobs. The [evals in CI article](/blog/evals-in-ci-for-llm-agents) covers testing a change before it ships. Adoption telemetry asks whether people keep using the system.

## How do you tell whether it worked?

Agree the outcome before rollout. Read it from the system that already records it, such as ticketing, CI or your CRM, and not from the AI tool's own logs. The [pilot article](/blog/why-your-ai-pilot-never-reached-production) covers how to pick an outcome you can measure.

Each use case gets one outcome metric. The client's owner chooses it and signs it before the start.

The support-agent study in the table read its outcome, issues resolved per hour, from work-system data and not from tool logs. It used a staggered rollout.

Then compare against something. A clean comparison is hard, even for researchers. METR's 2026 follow-up produced what it called an unreliable signal. METR's stated reasons include developers choosing not to participate rather than work without AI. It also lists developers becoming more selective about which tasks they submitted.

I roll a tool out in waves by team. The teams still waiting are the comparison group.

## What should you check before collecting data about people?

The rules below are general rules for monitoring staff, applied here by analogy. The sources cited here include no regulator text or court decision on AI usage logs.

Start with the risk that is easy to miss. A team count built to plan training can turn into a person-level view used to judge performance. The ICO, the UK regulator, gives a clear example. Data collected to manage workspace capacity should not be re-used for performance management without a new lawful basis and a test of necessity and proportionality. That is UK law, not EU law.

Treat a log that names a person as personal data about staff. The GDPR asks for a stated purpose, no more data than needed and no longer retention than needed (Article 5). Screen the plan for a DPIA first, and read the [DPIA entry](/glossary/dpia) for when monitoring staff triggers one.

A client's data protection officer or counsel runs the DPIA screening. I hand them the question set.

Do not rely on staff consent. The Article 29 Working Party's 2017 opinion said consent is highly unlikely to be a legal basis for data processing at work. The exception is where employees can refuse without adverse consequence. That opinion was written under the old Data Protection Directive, so treat it as persuasive guidance, not current law.

Where a works council or staff body exists, check its rights before you switch anything on.

| Country     | What the text says                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | How far to trust it                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Germany     | Works Constitution Act, section 87(1) no. 6: the works council has a say over technical devices meant to monitor behaviour or performance. The Federal Labour Court (1 ABR 20/21, 8 March 2022) reads this as objective suitability: a device counts if it can collect such data, whatever the employer intends. That case concerned Microsoft Office 365, where the parties did not dispute that the data could be used to check behaviour or performance. Applying it to AI usage logs is an inference. | Statute and court decision, both read in the original.                                   |
| Netherlands | Works Councils Act, article 27(1): the works council must consent to rules on the processing and protection of staff personal data. It must also consent to provisions aimed at or suitable for checking presence, behaviour or performance, where they cover all or a group of staff.                                                                                                                                                                                                                    | Secondary copy of the statute. The official text was not read.                           |
| France      | CNIL: a monitoring device must pass tests of justification and proportionality, go to staff representatives (the CSE, at employers with 50 or more staff) and be announced to staff beforehand.                                                                                                                                                                                                                                                                                                           | Regulator guidance, dated 9 July 2026, read in the original French and paraphrased here. |

I take clients with works councils. Engaging the council before switch-on is a standard step.

Keep three things off any dashboard: rankings of named people, prompt content and re-use for performance reviews. The reasons are the ICO example above, the GDPR rule on data minimisation and a warning from DX, a vendor of measurement software. DX warns against using these metrics to judge individuals and says code volume is "particularly susceptible to gaming".

Claude Code's documentation says prompt text is off by default. It includes the signed-in user's email, and the documentation tells operators to filter it at their own backend if that is a concern. That is an inference, not something the documentation says: the choice between named and team data sits at your own collector.

Set a smallest group you will show, so that a count cannot point at one person. Microsoft's Viva Insights asks administrators to set a minimum group size of at least five. That is a product setting, not a legal figure, and the sources cited here give no legal threshold.

The same page says the end-user opt-out does not apply to Copilot usage data, which stays available at the row level. That suggests a group-size floor limits what a report shows, not what is stored. That is an inference.

Tell staff before the first log is collected. The CNIL says staff must be told beforehand. The ICO says to seek and document workers' views unless there is a good reason not to. The [acceptable use policy article](/blog/ai-acceptable-use-policy-for-a-50-person-company) covers the policy itself, not the telemetry behind it.

I show breakdowns by team only, and a group needs at least five people. I collect no prompt content. I tell staff before telemetry starts.

A named-person view is never the default. It exists only for a narrow stated purpose, recorded, approved by two people and kept 30 days.

## Where does the dashboard template fit?

The [Adoption Telemetry Dashboard Template](/resources/adoption-telemetry-dashboard-template) turns these measures into eight panels. Paid versus active and retention become two panels, and the survey splits into trust and policy clarity. Each panel names the question it answers, the data source and the decision it supports. It is a page to copy into your own tool, not a live dashboard. Version 0.1 covers coding assistants and chat assistants.

The coverage panel reads gateway logs, sign-in app lists, expense lines, API bills and the [AI register](/glossary/ai-register). The [register article](/blog/how-to-build-an-ai-system-register-in-a-week) shows how to build one. The [unapproved tools answer](/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval) covers what to do about tools staff already use without approval. The [gateway config](/resources/llm-gateway-governance-config) already sets rate limits per team, not per user.

The [90-Day Production Sprint](/services/90-day-production-sprint) builds a dashboard that shows tracing and cost per outcome side by side. Its page promises no other panels. The [fractional CAIO retainer](/services/fractional-caio-retainer) includes a review of every AI initiative, shadow tools included.

## What does this article leave out?

It reports no client results and no numbers from my own telemetry. The evidence it cites comes from public studies and vendor documents. Most of the experimental evidence predates agentic tools, so treat each figure as a dated finding.

It does not say which baseline method suits your company or which person-level views to allow. Those depend on your company, your country and your staff representatives. It does not say whether a plain count dashboard is an AI system under the [EU AI Act](/glossary/eu-ai-act), and no source cited here settles that.

It is a summary of public texts, not legal advice. Take the legal questions to your data protection officer or counsel.
