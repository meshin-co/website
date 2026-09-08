---
title: only.help — agentic support triage in production
description: How a support triage agent went from a demo notebook to a production path with evals in CI and a named owner.
publishDate: 2026-08-18
updatedDate: 2026-09-08
client:
  name: only.help
  industry: Consumer software
  size: Own product
problem: A support inbox growing faster than the people reading it, and a prototype agent nobody would let near a real customer because there was no way to tell whether an answer was good.
approach: Pick the one flow with volume and a measurable outcome, build an eval set from real tickets before touching the prompt, then put the eval run in CI so a regression blocks the merge rather than the customer.
outcome:
  metrics:
    - label: Tickets triaged without a human first touch
      before: '0%'
      after: '62%'
    - label: Median first response
      before: 5h 40m
      after: 9m
    - label: Answer quality regressions caught before release
      before: None measured
      after: Every merge
stack:
  - TypeScript
  - Model Context Protocol
  - OpenTelemetry tracing
  - GitHub Actions eval gate
duration: 11 weeks
offer: 90-day-production-sprint
anonymized: false
---

## Why this one first

The inbox was the only place where volume and a measurable outcome met. Every other candidate needed a survey to tell whether it had worked, and a metric you have to ask about is a metric you cannot gate a release on.

## What made it shippable

Three things, in this order. An eval set built from tickets that had already been answered, so there was a known-good answer to compare against. Tracing on every call, so a bad answer could be traced to the retrieval step rather than argued about. A cost ceiling per ticket, checked in the same CI job as the evals.

## What I would do differently

I built the eval set from the last thirty days of tickets. Seasonality made the first week of results look better than the system was. Sampling across a longer window would have caught that before anyone celebrated.
