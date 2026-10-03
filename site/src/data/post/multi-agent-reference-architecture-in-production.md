---
# TODO(owner) [ma-position] section "Should the default be one agent or several?": the page reports that Microsoft, Google Cloud and Anthropic each advise starting small, then offers one working reading in the first person: reads suit several agents and writes that must agree suit one. That reading is the writer's inference and no source states it. Confirm it, or replace it with your own default shape and the test and number that move you from one agent to several.
# TODO(owner) [ma-limits] section "Where do limits and cost controls belong?": the page prints no step limit, cost limit, unit or alert level of yours. Add your step limit per run and its unit, what happens when a run reaches it, cost limits per run, ticket, key and day, who is alerted, and what happens at the cap. Also say whether the only.help per-ticket cost ceiling is a check on the eval set, a limit at run time, or both.
# TODO(owner) [ma-model] section "Can you roll back a multi-agent change?": whether you pin models by ID, which fallback model you use and what triggers it, and who reads the providers' retirement notices. The page states none of this as your practice.
# TODO(owner) [ma-approval-access] section "Who approves what, and who owns the system?": which actions you put behind a person, what the approver is shown, how agent identity and tool access are set, and how approval fatigue is handled. The page states no practice of yours.
# TODO(owner) [ma-eval-gate] section "Does an agent need durable state and traces?": what blocks a merge in your eval gate, where its thresholds come from, and who may override it. The page says evals in CI rests on two primary sources (Microsoft CAF and Anthropic), and that /approach commits to it. Confirm that pairing is acceptable.
# TODO(owner) [ma-tracing] section "Does an agent need durable state and traces?": what you trace per run, how long traces are kept, and how sensitive data is redacted. The page states none of this as your practice.
# TODO(owner) [ma-rollback] section "Can you roll back a multi-agent change?": any rollback target time you hold yourself to, and any rollback you have done and how long it took. The page says it found no target time in the sources it read.
# TODO(owner) [ma-owner] section "Who approves what, and who owns the system?": what the one accountable person owns and cannot decide alone, and who the "someone on call" in the in-production FAQ is for a system of several agents.
# TODO(owner) [ma-only-help] section "Does this site commit to any of it?": whether the only.help workflow used one agent or several. The page says the case study does not say, and uses it as evidence for neither.
# TODO(owner) [ma-failures-seen] section "What do the failure studies show?": whether you have seen a runaway loop or a hijack in client work that you may describe, anonymised.
# TODO(owner) [ma-eu-dates] section "Who approves what, and who owns the system?": the page prints no EU AI Act dates and links only the glossary entries. Confirm the dates you work to, and whether they belong on this page or only in the glossary.
# TODO(owner) [ma-vendors] whole article: the page names products only where a source names them, each with a date. Say which durable execution engine, framework, gateway and tracing stack you run in client work, and whether the page may name them.
# TODO(owner) [ma-checked-on] whole article: whether every outside claim may carry the "read on 2 October 2026" date the page prints. The research record recommends it in section 3.5.
# TODO(owner) [ma-search-method] section "Which claims have no source?": the page states absences found by searching named pages, including that two primary sources say evals in CI (Microsoft CAF and Anthropic). Confirm you stand behind that wording before it is published.
title: 'Multi-agent reference architecture in production'
description: 'What the sources say about multi-agent systems in production: where vendors agree, where they split, and what the research did not find.'
publishDate: 2026-10-02
updatedDate: 2026-10-02
shortAnswer: 'The sources reviewed here include no multi-agent reference architecture from a standards body. Microsoft, Google Cloud and Anthropic advise starting small. In my reading, Anthropic and Cognition mark out the two sides of one agent versus several, and the guidance says least about limits, rollback and ownership. Little of it is measured.'
fullAnswer: 'There is no standard multi-agent reference architecture in the sources reviewed here. What exists is vendor guidance from Microsoft, Google Cloud, AWS and Anthropic. In my reading, it repeats four ideas: a coordinating agent routes work, tools sit behind one controlled boundary, state lives outside the model, and every call is logged against a named identity. On whether several agents beat one, the disagreement is between Anthropic and Cognition, not among the clouds. Anthropic reports gains from its own multi-agent research system on breadth-first queries. Cognition argued in 2025 against agents working together, and in April 2026 said its observations still hold for parallel writers. A Google Research study found results from large gains to large losses, depending on the task. Production work needs limits on every run, state that survives a crash, and a trace of every call. It needs approval for high-impact actions, versioned changes with a way back, and one accountable person. The sources back these unevenly, and the table grades the points that matter most.'
keyTakeaways:
  - 'The sources reviewed include no multi-agent reference architecture from a standards body. What exists is vendor guidance, and almost none of it reports measured results.'
  - 'In my reading, the vendor guides repeat four ideas: a coordinating agent, controlled tool access, state outside the model, and a named identity per call. Starting small is the one every guide leans to. On whether several agents beat one, my reading is that Anthropic and Cognition mark out the two sides, and I found no source that tests it in a production workload.'
  - 'Failure studies cover open-source frameworks, benchmarks and a scan of public code. The Microsoft AI Red Team says its taxonomy rests on engagements against deployed systems, but that account comes from the vendor itself. The research found no dated, checkable post-mortem of a production runaway loop.'
  - 'Framework loop limits differ in unit and in default. Choose one from your own traces.'
  - 'I found no target time for rollback in the sources I read, and pinning a model ID may not freeze behaviour.'
faq:
  - q: 'Is there a standard multi-agent reference architecture?'
    a: 'Not in the sources reviewed here. Microsoft, Google Cloud and AWS each publish vendor guidance. NIST announced an AI agent standards initiative on 17 February 2026. Its page, updated on 14 August 2026, describes convenings and gap analyses, and I found no finished NIST guidance for agents. The ISO, IEC and IEEE catalogues were not browsed, so treat this as not found.'
  - q: 'Should a production system use one agent or several?'
    a: 'Start with one. Microsoft, Google Cloud and Anthropic advise the simplest design that works, and AWS warns of coordination overhead. On 22 April 2026 Cognition said its observations still hold for agents that write in parallel. Anthropic reports that its own multi-agent research system does best on breadth-first queries. I would expect the line to fall between reading and writing, but I found no source that tested that in a production workload.'
  - q: 'How many steps should an agent be allowed to take?'
    a: 'Frameworks ship different defaults and count different things: turns, steps or iterations. In my reading, a limit that suits one framework does not carry over to another. Set the limit from your own traces and evals, and decide in advance what happens when a run reaches it. The Claude Agent SDK documentation advises setting a budget for production agents.'
  - q: 'Can a multi-agent system be rolled back quickly?'
    a: 'I found no target time in the sources I read. Microsoft says to enable immediate rollback. Temporal promises instant rollback, with no measurement behind the word. Anthropic says infrastructure updates occasionally produce minor differences in behaviour even when the model ID is unchanged, so a pinned ID may not freeze behaviour. Run evals after any rollback.'
  - q: 'Do runaway agent loops really run up large bills?'
    a: 'The research found no dated, checkable post-mortem of one in production. The only accounts I found were blog posts that repeat one set of figures with no primary record. Anthropic says early versions of its research system spawned 50 subagents for simple queries. The Claude Agent SDK documentation advises a budget for production agents.'
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
  - evals-in-ci
relatedResources:
  - agent-evals-ci-starter
  - llm-gateway-governance-config
sources:
  - title: 'Multi-agent Reference Architecture: Reference Architecture'
    url: 'https://microsoft.github.io/multi-agent-reference-architecture/docs/reference-architecture/Reference-Architecture.html'
    publisher: 'Microsoft'
  - title: 'Multi-agent Reference Architecture: Security'
    url: 'https://microsoft.github.io/multi-agent-reference-architecture/docs/security/Security.html'
    publisher: 'Microsoft'
  - title: 'AI agent orchestration patterns'
    url: 'https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns'
    publisher: 'Microsoft'
  - title: 'Choose a design pattern for your agentic AI system'
    url: 'https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system'
    publisher: 'Google Cloud'
  - title: 'Multi-agent AI system in Google Cloud'
    url: 'https://docs.cloud.google.com/architecture/multiagent-ai-system'
    publisher: 'Google Cloud'
  - title: 'Agentic AI Lens'
    url: 'https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentic-ai-lens.html'
    publisher: 'AWS'
  - title: 'AGENTREL02-BP05 Establish tiered human oversight and approval workflows'
    url: 'https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentrel02-bp05.html'
    publisher: 'AWS'
  - title: 'Multi-agent architectures on AWS'
    url: 'https://aws.amazon.com/marketplace/build-learn/ai-agent-learning-series/multi-agent-architectures'
    publisher: 'AWS Marketplace'
  - title: 'Strategy for operationalizing agentic AI, focus area 4: build trust through identity, guardrails, and observability'
    url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-operationalizing-agentic-ai/focus-areas-trust.html'
    publisher: 'AWS'
  - title: 'Building effective agents'
    url: 'https://www.anthropic.com/engineering/building-effective-agents'
    publisher: 'Anthropic'
  - title: 'How we built our multi-agent research system'
    url: 'https://www.anthropic.com/engineering/multi-agent-research-system'
    publisher: 'Anthropic'
  - title: 'Scaling Managed Agents: Decoupling the brain from the hands'
    url: 'https://www.anthropic.com/engineering/managed-agents'
    publisher: 'Anthropic'
  - title: 'Process to build agents across your organization'
    url: 'https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/build-secure-process'
    publisher: 'Microsoft'
  - title: 'Demystifying evals for AI agents'
    url: 'https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents'
    publisher: 'Anthropic'
  - title: 'MCP specification: Tools'
    url: 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools'
    publisher: 'Model Context Protocol project'
  - title: 'Govern and secure AI agents across the organization'
    url: 'https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/governance-security-across-organization'
    publisher: 'Microsoft'
  - title: 'Why Do Multi-Agent LLM Systems Fail?'
    url: 'https://arxiv.org/pdf/2503.13657'
    publisher: 'Cemri et al.'
  - title: 'Updating the taxonomy of failure modes in agentic AI systems'
    url: 'https://www.microsoft.com/en-us/security/blog/2026/06/04/updating-taxonomy-failure-modes-agentic-ai-systems-year-red-teaming-taught-us/'
    publisher: 'Microsoft'
  - title: 'Towards a science of scaling agent systems: When and why agent systems work'
    url: 'https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/'
    publisher: 'Google Research'
  - title: 'Towards a Science of Scaling Agent Systems'
    url: 'https://arxiv.org/abs/2512.08296'
    publisher: 'Kim et al.'
  - title: 'When Agents Do Not Stop: Uncovering Infinite Agentic Loops in LLM Agents'
    url: 'https://arxiv.org/abs/2607.01641'
    publisher: 'Hou et al.'
  - title: 'Gartner Predicts Over 40% of Agentic AI Projects Will Be Canceled by End of 2027'
    url: 'https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027'
    publisher: 'Gartner'
  - title: "Don't Build Multi-Agents"
    url: 'https://cognition.com/blog/dont-build-multi-agents'
    publisher: 'Cognition'
  - title: 'Strengthening AI Agent Hijacking Evaluations'
    url: 'https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations'
    publisher: 'NIST'
  - title: 'How we contain Claude across products'
    url: 'https://www.anthropic.com/engineering/how-we-contain-claude'
    publisher: 'Anthropic'
  - title: 'OpenAI Agents SDK source: run_config.py'
    url: 'https://raw.githubusercontent.com/openai/openai-agents-python/main/src/agents/run_config.py'
    publisher: 'OpenAI'
  - title: 'OpenAI Agents SDK: running agents'
    url: 'https://openai.github.io/openai-agents-python/running_agents/'
    publisher: 'OpenAI'
  - title: 'Graph API overview: recursion limit'
    url: 'https://docs.langchain.com/oss/python/langgraph/graph-api'
    publisher: 'LangChain'
  - title: 'Microsoft Agent Framework: Workflow class'
    url: 'https://learn.microsoft.com/en-us/python/api/agent-framework-core/agent_framework.workflow?view=agent-framework-python-latest'
    publisher: 'Microsoft'
  - title: 'Google Agent Development Kit: loop agents'
    url: 'https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/'
    publisher: 'Google'
  - title: 'Claude Agent SDK: how the agent loop works'
    url: 'https://platform.claude.com/docs/en/agent-sdk/agent-loop'
    publisher: 'Anthropic'
  - title: 'Understanding Temporal'
    url: 'https://docs.temporal.io/evaluate/understanding-temporal'
    publisher: 'Temporal'
  - title: 'Why Temporal?'
    url: 'https://docs.temporal.io/evaluate/why-temporal'
    publisher: 'Temporal'
  - title: 'LangGraph persistence'
    url: 'https://docs.langchain.com/oss/python/langgraph/persistence'
    publisher: 'LangChain'
  - title: 'LangGraph interrupts'
    url: 'https://docs.langchain.com/oss/python/langgraph/interrupts'
    publisher: 'LangChain'
  - title: 'Semantic Conventions for GenAI agent and framework spans'
    url: 'https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-agent-spans.md'
    publisher: 'OpenTelemetry'
  - title: 'OpenTelemetry GenAI semantic conventions: manifest'
    url: 'https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/model/manifest.yaml'
    publisher: 'OpenTelemetry'
  - title: 'OpenAI Agents SDK: tracing'
    url: 'https://openai.github.io/openai-agents-python/tracing/'
    publisher: 'OpenAI'
  - title: 'OpenAI API deprecations'
    url: 'https://developers.openai.com/api/docs/deprecations'
    publisher: 'OpenAI'
  - title: 'MCP specification, overview'
    url: 'https://modelcontextprotocol.io/specification/2026-07-28'
    publisher: 'Model Context Protocol project'
  - title: 'Model IDs and versioning'
    url: 'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions'
    publisher: 'Anthropic'
  - title: 'Model deprecations'
    url: 'https://platform.claude.com/docs/en/about-claude/model-deprecations'
    publisher: 'Anthropic'
  - title: 'MCP specification: Authorization'
    url: 'https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization'
    publisher: 'Model Context Protocol project'
  - title: 'AI Agent Standards Initiative'
    url: 'https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative'
    publisher: 'NIST'
  - title: "Multi-Agents: What's Actually Working"
    url: 'https://cognition.com/blog/multi-agents-working'
    publisher: 'Cognition'
  - title: 'How and when to build multi-agent systems'
    url: 'https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems'
    publisher: 'LangChain'
  - title: 'AI Act Article 26: Obligations of deployers of high-risk AI systems'
    url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26'
    publisher: 'European Commission'
  - title: 'AI Act Article 14: Human oversight'
    url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14'
    publisher: 'European Commission'
  - title: 'Multi-agent Reference Architecture: Governance'
    url: 'https://microsoft.github.io/multi-agent-reference-architecture/docs/governance/Governance.html'
    publisher: 'Microsoft'
author: dmitri
---

Microsoft, Google Cloud and AWS each publish guidance on multi-agent systems. The guidance is useful, and it agrees on more than you might expect. It is also vendor guidance with little measured evidence behind it. In my reading it says least about limits, rollback and ownership. This page grades the main claims and says plainly where the research found nothing.

A multi-agent system, in these sources, puts several agents on one task. Each agent is a model with its own instructions and tools. One agent usually coordinates the rest. The sources call it an orchestrator, a supervisor, a coordinator, a manager agent or a lead agent. This page says orchestrator. The [agentic workflow](/glossary/agentic-workflow) entry in the glossary covers the wider idea.

Outside claims name their source, and a date where the page has one. I read each page on 2 October 2026, except the Gartner release. Gartner blocks scripted reads, so I checked its sentences on a reproduction. Several of the pages change often. Where I write that I found no source, I mean none among the sources I read. A miss does not prove nobody says it elsewhere.

## How far can each claim be trusted?

Treat most of it as advice. Almost none of it was measured in a production workload. The table grades the points that matter most, and the sections after it give the detail.

| Point                | What the sources show                                                                                                                                                                                                    | How far to trust it                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| One agent or several | Anthropic (13 June 2025) reports gains from its multi-agent research system. Cognition (12 June 2025) argued against agents working together. On 22 April 2026 it said its observations still hold for parallel writers. | Each is one vendor's own work. I found no source that compares both in a production workload.                             |
| Test failure rates   | A NeurIPS 2025 paper (revised 26 October 2025) found failure rates from 41% to 86.7% across seven open-source frameworks.                                                                                                | Peer reviewed. It tested open-source frameworks, not production systems with an eval gate.                                |
| Cancelled projects   | Gartner (25 June 2025) forecasts that over 40% of agentic AI projects will be cancelled by the end of 2027.                                                                                                              | A forecast. The release leans on a poll of 3,412 webinar attendees.                                                       |
| Runaway loops        | Anthropic says early versions spawned 50 subagents for simple queries. A preprint (2 July 2026) found loop-prone code in 47 projects.                                                                                    | Not found: a dated post-mortem from production. The only accounts found repeat one set of figures with no primary record. |
| Human approval       | Anthropic (25 May 2026) says users approved roughly 93% of permission prompts. Microsoft (4 June 2026) calls bypass of the human step the most consistently exploited failure mode.                                      | Each is the vendor's own finding. Anthropic's post gives no method for its figure.                                        |
| Evals in CI          | Microsoft's Cloud Adoption Framework (3 December 2025) and Anthropic's evals post (9 January 2026) say to run evaluations in CI/CD pipelines.                                                                            | Two primary sources among the pages searched. A practice, not a standard.                                                 |
| Rollback speed       | Microsoft says "immediate". Temporal says "instant".                                                                                                                                                                     | Not found: a target time in any source reviewed.                                                                          |

## Do the big vendors agree on a shape?

My reading is mostly yes, on four ideas. A coordinating agent routes work to others. Tool access goes through one controlled boundary. State lives outside the model. Every call is logged against a named identity. The guides do not all say all four, but each idea recurs.

Microsoft's [reference architecture](https://microsoft.github.io/multi-agent-reference-architecture/docs/reference-architecture/Reference-Architecture.html), last updated on 18 August 2025, has an orchestrator. It consults a classifier to route a request and a registry to find agents. It connects tools through a [Model Context Protocol](/glossary/mcp) server and keeps state in persistent storage. The [multi-agent guide](https://docs.cloud.google.com/architecture/multiagent-ai-system) from Google Cloud, last reviewed on 16 September 2025, also centres on a coordinator agent.

Microsoft, Google Cloud and Anthropic each advise starting small. Microsoft (12 February 2026) says to use the lowest level of complexity that reliably meets your requirements. Google Cloud (reviewed 28 May 2026) recommends starting with a single agent if you are early in agent development. Anthropic (19 December 2024, updated 10 August 2026) advises finding the simplest solution possible and adding complexity only when needed.

AWS (10 June 2026) warns of coordination overhead, handoff complexity and distributed failure modes. An undated AWS Marketplace learning module, written in the first person, also recommends the simplest pattern that fits your workflow.

These are companies that sell the platforms. The Microsoft and Google Cloud pages quoted above report no measured data. Their agreement tells you what the vendors advise.

## Should the default be one agent or several?

Start with one. Microsoft, Google Cloud and Anthropic each advise starting small, and the sources still disagree about what comes next. Two of the sources landed a day apart, and my reading is that they disagree on where the line sits. Cognition, which makes the Devin coding agent, published ["Don't Build Multi-Agents"](https://cognition.com/blog/dont-build-multi-agents) on 12 June 2025. Anthropic described its [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) on 13 June 2025.

Cognition wrote that "in 2025, running multiple agents in collaboration only results in fragile systems." One of its principles was to share context. Anthropic says its research system "uses a multi-agent architecture with an orchestrator-worker pattern". A lead agent coordinates specialised subagents that run in parallel. Anthropic's own evaluations show that such systems "excel especially for breadth-first queries". I read that as a read-heavy task, graded by the vendor itself.

Cognition came back to the question on 22 April 2026. Its original observations, it wrote, "still hold today for parallel-writer swarms". It also described a narrower pattern that works, in which several agents add intelligence to a task while "writes stay single-threaded".

The same post gives two rules that pull apart. One says to "share as much context as possible between the agents". For review agents, it says the technique works best when the coding and review agents "do not share any context beforehand".

I would expect the line to fall between reading and writing. Many independent reads suit several agents. Writes that must agree suit one. I found no source that tested that expectation in a production workload, so treat it as a working rule.

The closest measurement found is a Google Research study of agent designs on benchmark tasks. Its [paper](https://arxiv.org/abs/2512.08296), posted on 9 December 2025 and revised on 8 April 2026, compared several designs with a single agent. Results ran from a gain of 80.8% to a loss of 70.0%, depending on the task.

The Google Research blog post about the paper, of 28 January 2026, reports that independent agents amplified errors 17.2 times, and centralised ones 4.4 times. The blog counts fewer test configurations than the paper's latest abstract, so the paper changed after the blog. I cannot say the multipliers hold for the paper.

Anthropic's own post says multi-agent systems "work mainly because they help spend enough tokens to solve the problem". One reading is that more tokens help, however they are spent. I found no source that separates the gain from structure from the gain from extra tokens.

## What do the failure studies show?

Multi-agent systems fail often in tests, and the studies below do not show how often they fail in production. One is MAST, from Cemri and colleagues, accepted to the NeurIPS 2025 Datasets and Benchmarks track. It read the traces of seven open-source multi-agent frameworks and found [failure rates from 41% to 86.7%](https://arxiv.org/pdf/2503.13657). Repeated steps and agents that miss a finished task were among the common failures.

The paper is peer reviewed. It tested open-source frameworks, not production systems with an eval gate in front of them.

A runaway loop is a different case, because it costs money. The research found no dated, checkable post-mortem of one in production. The only accounts I found were blog posts that repeat one set of figures with no primary record.

What I found is weaker. Anthropic says early versions of its research system made errors such as spawning 50 subagents for simple queries. A [preprint of 2 July 2026](https://arxiv.org/abs/2607.01641), "When Agents Do Not Stop", scanned public agent repositories for code that can start an infinite loop. It counts code patterns and does not show a loop that ran in production.

Hijacking is another documented failure. NIST's CAISI tested agent hijacking on a public benchmark. The strongest new attack succeeded 81% of the time, against 11% for the strongest baseline attack.

[NIST published the result](https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations) on 17 January 2025 and updated it on 19 December 2025. That is a benchmark, so it shows what is possible. It gives no rate for real systems. NIST's wording is that many agents that read untrusted text are open to [prompt injection](/glossary/prompt-injection).

## Where do limits and cost controls belong?

On every run, set by a person, with a defined result when the limit is reached. The defaults in popular frameworks differ, and they count different things. The table shows five frameworks as read on 2 October 2026. The OpenAI default comes from its source code on GitHub, and the other rows from documentation pages.

| Framework                    | Default loop limit  | What it counts                                                      |
| ---------------------------- | ------------------- | ------------------------------------------------------------------- |
| OpenAI Agents SDK            | 10                  | Turns of the agent loop in one run. Setting none removes the limit. |
| LangGraph                    | 1,000               | Steps, since version 1.0.6.                                         |
| Microsoft Agent Framework    | 100                 | Iterations of a workflow run toward convergence.                    |
| Google Agent Development Kit | None stated         | A loop agent ends on a stop signal or on a maximum you set.         |
| Claude Agent SDK             | No limit unless set | The docs advise setting a budget for production agents.             |

A turn, a step and an iteration are different units, so in my reading the three numbers cannot be compared. Step limits and cost limits are also separate controls.

The Claude Agent SDK documentation says the loop runs until Claude finishes if you set no limits. It calls a budget a good default for production agents. The [FAQ on cost per outcome](/faq/how-is-cost-per-outcome-measured) gives this site's definition of the measure, and I would set a ceiling from your own traces.

## Does an agent need durable state and traces?

Yes, the sources say both. State has to survive a crash, and every call needs a trace.

Anthropic's [managed agents post](https://www.anthropic.com/engineering/managed-agents) of 8 April 2026 keeps the session log outside the process that runs the agent. Nothing in that process has to survive a crash. Temporal, which sells durable execution, says its service hands the work to another process after a crash and rebuilds the state. LangGraph's documentation says in-memory checkpoints are lost when the process restarts, and it recommends a durable checkpointer.

The principle is well supported. I found no source that says every production agent needs a separate engine, and none that measures the benefit.

Microsoft's Cloud Adoption Framework (3 December 2025) says to attribute every action to a specific agent instance and conversation ID. The OpenTelemetry conventions for agent spans were still marked as in development in the repository file read on 2 October 2026. Whether the core traces signal is stable is unconfirmed, so this page makes no claim about it.

OpenAI's Agents SDK turns tracing on by default, warns that traces may capture sensitive data, and does not offer tracing under zero data retention.

Anthropic (9 January 2026, updated 18 March 2026) says an eval suite makes problems visible before they reach users, and that it needs clear ownership. Running [evals](/glossary/evals) in the pipeline that ships changes is a narrower claim. Two primary sources say it: Microsoft's Cloud Adoption Framework and Anthropic's evals post, which calls automated evals especially useful pre-launch and in CI/CD.

That source is the Microsoft Cloud Adoption Framework, which says to integrate evaluations into CI/CD pipelines before production. The [post on evals in CI](/blog/evals-in-ci-for-llm-agents) is about running them without a golden answer.

## Who approves what, and who owns the system?

A person should approve high-impact actions, and one named person should own the system. The sources agree on the first and say less about the second.

The Model Context Protocol specification (revision 28 July 2026) says there should always be a [human in the loop](/glossary/human-in-the-loop) who can deny tool invocations. The word is "should", and the specification says the protocol cannot enforce its own security principles. AWS sorts actions into three tiers, autonomous, notify and approve, by impact and reversibility, so that not every action waits for a person.

Approval is also a control that can fail. Anthropic reports that its telemetry showed users approved roughly 93% of permission prompts (25 May 2026). It adds that the more approvals a user sees, the less attention each one gets.

Microsoft's [AI Red Team](/glossary/red-teaming) calls bypass of the human step the most consistently exploited failure mode (4 June 2026). Both are the vendors' own findings. Anthropic's post gives no method for its figure. This page cannot say how many prompts is too many.

Access follows the same logic. Microsoft's Cloud Adoption Framework (page updated 26 June 2026) says agent actions must be attributable and enforceable to a unique identity. The MCP authorization specification says authorization is optional for implementations. I read that as follows: a claim of least privilege through MCP describes how someone configured it, and the protocol does not guarantee it.

On ownership, Microsoft's framework says to give agent governance to the leaders who already own cloud governance, security and compliance. It also says to designate a human role accountable for approving deployments and monitoring compliance.

Microsoft's reference architecture site describes a cross-functional governance committee. In my reading these fit together if the committee advises and one person decides. This site's [approach page](/approach) asks for one named person who can refuse a launch and is accountable for AI risk.

The [EU AI Act](/glossary/eu-ai-act) names people with competence and authority too. Its [human oversight](/glossary/human-oversight) duties apply to [high-risk systems](/glossary/high-risk-ai-system) only. The Commission's AI Act service desk still shows the 2024 text of those articles.

## Can you roll back a multi-agent change?

Microsoft's guidance says yes, if you version everything that shapes behaviour. I found no target time in the sources I read, so I cannot say how fast.

Microsoft's security page for its reference architecture (updated 12 May 2025) says to version every agent's logic, prompt configuration and communication contract. It also says to enable immediate rollback to a previous version when anomalies are detected. Temporal's "Why Temporal?" page promises instant rollback, with no measurement behind the word.

Pinning a model does not always pin behaviour. Anthropic's documentation says infrastructure updates occasionally produce minor differences in observable behaviour even when the model ID and weights have not changed. I read that as follows: rolling back the model ID does not always roll back behaviour. Evals run after a rollback are how you would see the difference.

Providers also retire models on published schedules, so a pinned model has an end date. Anthropic and OpenAI each publish a deprecations page, and someone has to read it.

## Which claims did the research not find a source for?

The research looked for each of these and did not find it.

- A dated, checkable post-mortem of a production agent loop that ran away and cost real money.
- Any multi-agent reference architecture from a standards body. NIST announced an AI agent standards initiative on 17 February 2026. Its page, updated on 14 August 2026, describes convenings and gap analyses, and the research found no finished NIST guidance for agents. The ISO, IEC and IEEE catalogues were not browsed, so the honest wording is "not found".
- Measured results that compare one agent with several inside one company's production workload.
- A target time for rollback in any source reviewed.
- Support for the "four planes" model of control, execution, state and capability beyond one undated AWS Marketplace learning module, written in the first person.

One figure rests on a weak source. A LangChain blog of 16 June 2025 says to start small with evals and that even about twenty examples is enough. LangChain sells agent tooling and the post is commentary, so this page does not adopt the figure.

Retrieval and memory design were outside this research. The [retrieval-augmented generation](/glossary/retrieval-augmented-generation) entry covers the basics.

## Does this site commit to any of it?

Yes, to five controls. The [approach page](/approach) names evals in CI, tracing, cost per outcome, a rollback path and a named owner. In my reading, the sources above back them unevenly. Tracing recurs across the guides, and a named owner is clearest in Microsoft's Cloud Adoption Framework.

Rollback appears as a practice in three of the 14 pages I searched. Evals in CI appears in the two primary sources named above. The outside sources cover spend limits and spend per reasoning cycle or per agent, which is a different measure from cost per outcome. I found no target time for rollback in the sources I read. The FAQ on [what counts as in production](/faq/what-counts-as-in-production-for-the-90-day-sprint) gives the bar this site uses.

The [only.help case study](/case-studies/only-help-agentic-support) reports tracing on every call and a per-ticket cost ceiling checked in the same CI job as the evals. Its summary also names evals in CI and a named owner. It does not say whether the workflow used one agent or several, so this page does not use it as evidence for either. For one workflow taken to production, see the [90-day production sprint](/services/90-day-production-sprint).
