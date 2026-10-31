---
title: Adoption Telemetry Dashboard Template
name: Adoption Telemetry Dashboard Template
type: template
description: 'An adoption telemetry dashboard template: eight panels, each with its question, data source and the decision it supports.'
publishDate: 2026-10-02
updatedDate: 2026-10-25
version: '0.1'
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - A table of eight panels for coding assistants and chat assistants, each with the question it answers, the data source and the decision it supports
  - Three definitions to fix before you build, covering what counts as active, when you check retention and the smallest group you show, each with the value I use
  - A list of eight measures that stay off the dashboard, each with its reason
  - Rules for people data, with teams of five or more, named views only for a narrow stated purpose, a screening before any named view, no rankings and no prompt content
howToUse: Copy the panel table into a spreadsheet or the dashboard tool you already run. Write the one outcome for each use case before rollout. Write down your definition of active and your smallest group size before the first chart exists. Put the weight on the outcome, delivery health, cost and trust panels, and treat the coverage, seat and retention panels as diagnostics.
sources:
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
  - title: 'DORA: State of AI-assisted software development 2025'
    url: 'https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf'
    publisher: Google Cloud / DORA
    retrieved: '2026-10-02'
  - title: 'DORA: Accelerate State of DevOps 2024'
    url: 'https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf'
    publisher: Google Cloud / DORA
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
relatedPosts:
  - adoption-telemetry-measuring-if-ai-is-actually-used
---

## What this is

A panel specification for tracking how AI tools are used at work. It has eight panels. Each names the question it answers, the data source and the decision it supports. It is a page, not a dashboard file. You copy the panels into whatever tool you already run.

Version 0.1 covers coding assistants and chat assistants. Version 0.2 will cover SaaS tools with AI built in and internal agents. I will write it when clients who run them appear.

The panels fall into three kinds. The coverage, seat and retention panels count what people did. The two survey panels count what people said. The outcome, delivery health and cost panels read what the work produced. The outcome, delivery health, cost and trust panels carry the weight, and the trust survey is read as opinion.

That order is a synthesis of the sources, not a finding any of them states. The [adoption telemetry article](/blog/adoption-telemetry-measuring-if-ai-is-actually-used) gives the evidence behind it.

## The eight panels

| #   | Panel                                   | Question it answers                                                                   | Data source                                                                                                                                                        | Decision it supports                                                          |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | Coverage                                | What share of AI use at work runs through approved tools?                             | [LLM gateway](/glossary/llm-gateway) request logs, the sign-in app list, expense lines, API bills and the [AI register](/glossary/ai-register)                     | Which tools to approve, replace or block, and where the approved path is hard |
| 2   | Paid versus active                      | Which paid seats see no use?                                                          | Vendor admin APIs, such as GitHub's user-management `last_activity_at`                                                                                             | Reclaim or reassign seats, and aim training                                   |
| 3   | Retention by team                       | Do people who tried a tool keep using it at 4, 8 and 12 weeks?                        | Gateway or vendor logs, with one written definition of active                                                                                                      | Change the workflow or retire the tool                                        |
| 4   | Outcome per use case                    | Did the outcome agreed before rollout move, against a baseline or a comparison group? | The system of record for that outcome, such as ticketing, CI or your CRM, not the AI tool's own logs                                                               | Scale, fix or retire the use case                                             |
| 5   | Delivery health (engineering use cases) | Did throughput or instability get worse as use grew?                                  | CI/CD and version control: DORA's lead time for changes, deployment frequency, failed deployment recovery time, change fail rate and rework rate, plus review time | Slow or pause a rollout when instability rises                                |
| 6   | Cost per outcome                        | What does one unit of the outcome cost?                                               | Spend and the outcome count from the outcome panel, as set out in [how cost per outcome is measured](/faq/how-is-cost-per-outcome-measured)                        | Budget, build versus buy, and model choice                                    |
| 7   | Trust and friction pulse                | Do people trust the output, rely on it, and say where it gets in the way?             | A five-minute survey once a quarter, using the trust and reliance items DORA publishes, word for word and with credit. The smallest-group rule applies             | Training and verification effort, and tool choice                             |
| 8   | Policy clarity                          | Do staff know what is expected, what is allowed and what applies to them?             | The same survey, using the four AI-stance items in DORA's 2025 report, word for word and with credit                                                               | Fix how the acceptable use policy is explained                                |

The delivery health and cost panels apply to engineering and workflow use cases. Write the outcome panel for each use case.

## Fix these definitions before you build

- What counts as active. GitHub needs two active days in the trailing 28 to place a user in a usage phase. Microsoft counts a returning user as one with an action in both the current and the previous period. Choose one rule, write it on the panel and keep it. Mine is two different active days within four weeks, and I count people, not accounts.
- When you check retention. The retention panel uses 4, 8 and 12 weeks. Week 4 is the first check. I read it as people active in week 4 over people active in week 1, per team, from gateway logs.
- The smallest group you show. Mine is five people. Microsoft's Viva Insights needs its minimum group size set to at least five. That is a product setting. The sources read here give no legal figure for a minimum group size. Write down your own.

## What stays off the dashboard

- Seat count as adoption. A seat shows money spent, and GitHub keeps seat data apart from its usage reports.
- Daily or weekly active users with no written definition. GitHub, Microsoft and DORA each define active differently.
- Prompt counts. DORA's 2024 report, published by Google Cloud, said measuring usage frequency is "likely not as meaningful as measuring reliance".
- Lines of code accepted as a success measure. GitHub calls its own lines figure directional.
- Acceptance rate as a success measure. In a 2022 preprint on Copilot users it tracked how productive users said they felt.
- Vendor hours saved or ROI as value. Microsoft builds assisted hours from action counts, fixed minutes per action, and meeting recaps counted by meeting length. A default hourly rate then values them.
- Rankings of named people. DX, a vendor of measurement software, warns against using these metrics to judge individuals.
- Prompt content. The GDPR asks for no more data than needed, and Claude Code's documentation says prompt text is off by default. I collect none.

## Who sees what

Show team-level figures by default, for teams of five or more. Where you control the collector, filter or redact the person field before data reaches the dashboard. Claude Code includes the signed-in user's email by default, and its documentation says to filter it at your own backend if that is a concern.

The paid versus active panel shows idle seats by team. Reclaiming a seat needs a name, and a name is person-level data. Show named views only for a narrow stated purpose, recorded, approved by two people and kept 30 days. Write down who sees the list. Then run the screening in the [adoption telemetry article](/blog/adoption-telemetry-measuring-if-ai-is-actually-used) before the list exists.

## What it is not

It is not a live dashboard, and it is not an export for one tool. It does not show that an AI tool works. Only the outcome panel can do that, against a baseline or a comparison group, and that is a synthesis, not a finding any source states. It is a summary of public documents, not legal advice.
