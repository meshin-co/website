---
title: only.help — agentic support triage, on my own product
description: An agentic support triage workflow that went from a demo notebook to a production path with evals in CI and a named owner.
publishDate: 2026-09-08
updatedDate: 2026-10-02
client:
  name: only.help
  industry: Consumer software
  size: My own product
problem: The support inbox was growing faster than the people reading it. Nobody would let the prototype agent near a real customer, because there was no way to tell whether an answer was good.
approach: Pick the one flow that has both volume and a measurable outcome. Build an eval set from real tickets before you touch the prompt. Then put the eval run in CI, so a regression blocks the merge instead of reaching the customer.
outcome:
  metrics: []
stack:
  - TypeScript
  - Model Context Protocol
  - OpenTelemetry tracing
  - GitHub Actions eval gate
offer: 90-day-production-sprint
anonymized: false
---

## Why this one first

The inbox was the only place where volume and a measurable outcome met. Every other candidate needed a survey to tell whether it had worked. You cannot gate a release on a metric you have to ask about.

## What made it shippable

Three things, in this order. An eval set built from tickets that already had answers, so there was a known-good answer to compare against. Tracing on every call, so a bad answer could be traced to the retrieval step rather than argued about. A cost ceiling per ticket, checked in the same CI job as the evals.

## What I built, in order

| Part                                                                           | What it's for                                                                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Eval set from real tickets                                                     | A known-good answer to check every change against, before it reaches a customer.               |
| [Model Context Protocol](https://modelcontextprotocol.io) as the tool boundary | Keeps what the agent may call explicit and narrow, instead of improvised inside a prompt.      |
| [OpenTelemetry](https://opentelemetry.io) tracing                              | Every call recorded, so a wrong answer traces back to a retrieval step, not a guess.           |
| GitHub Actions eval gate                                                       | Runs the eval set on every change so a regression blocks the merge before it reaches a ticket. |

## What I would do differently

I built the first eval set from tickets that already had good answers. Seasonality made the first week of results look better than the system was. Sampling across a longer window would have caught that before anyone celebrated.
