---
title: 90-Day Production Sprint
name: 90-Day Production Sprint
tagline: One process live in production, with evals in CI.
description: A 90-day sprint that puts one agentic workflow into production with evals in CI, tracing, a named owner, and a rollback path.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortAnswer: A 90-day production sprint exists to get one process running in production and keep it there. I build it with your engineers rather than beside them, so the team can change it after I leave. You get evals in continuous integration, tracing, a cost per outcome your finance team can read and a rollback path.
feeShape: Fixed scope, quoted once from the statement of work
duration: 90 days
order: 2
forWhom:
  - You have one process with real volume and a measurable outcome
  - You have at least one engineer who can own it after handover
  - You want it in production, not in a demo environment
notForWhom:
  - You want five workflows started at once
  - Nobody can name the outcome the process is supposed to move
  - Legal has not decided which data may leave the building
deliverables:
  - One agentic workflow live in production, with rollback and a named owner
  - Evals in CI, so a prompt or model change cannot ship unnoticed
  - Tracing and cost per outcome on a dashboard your finance team can read
  - A success number written into the statement of work before the sprint starts
process:
  - step: 1
    title: Pick the process
    detail: One process, chosen on volume and on whether the outcome is measurable without a survey.
  - step: 2
    title: Build with your engineers
    detail: Pairing, not delivery. Your team writes part of it, so they can change it later.
  - step: 3
    title: Evals and tracing
    detail: A test set that fails the build when quality drops, plus traces and cost per outcome.
  - step: 4
    title: Handover
    detail: An internal owner, written decisions, and a runbook for the failure modes the workflow hit.
schedule:
  - stage: Pick the process
    work: One process, picked on real volume
    output: A success number written into the statement of work.
  - stage: Build with your engineers
    work: Built with your team, not for them
    output: A team that can already change what gets built.
  - stage: Evals and tracing
    work: Nothing ships if the test set breaks
    output: Evals in CI, plus tracing and cost per outcome.
  - stage: Handover
    work: One accountable owner and a written runbook
    output: One workflow live in production, with rollback and an owner.
faq:
  - q: 'What counts as production?'
    a: Real users, real transactions, live monitoring, a rollback path and someone reachable if it breaks. A demo behind a feature flag does not count.
  - q: 'Who owns the code?'
    a: You do. It lives in your repositories from the first commit, under your licence and your review rules.
  - q: 'What if the evals say the workflow is not good enough?'
    a: Then it does not ship, and the sprint ends with a written account of why. That is a cheaper outcome than shipping it and finding out from a customer.
cta:
  label: Book a 30-min fit call
  href: https://cal.com/meshin
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: NIST
    retrieved: '2026-09-08'
---

## What this is

Ninety days, one process, in production. The measure of success is written into the statement of work before the first day.

## What you keep

The workflow, the eval suite, the traces, and an engineer on your team who has built it with me and can change it without me.

## Where this maps to a standard

Evals in CI apply the MEASURE function (one of the framework's four functions) inside the [NIST AI Risk Management Framework (AI RMF)](https://www.nist.gov/itl/ai-risk-management-framework). The scope is one production workflow, not a whole AI programme. A dashboard with cost per outcome is evidence a customer's security team can check, not a claim they have to trust.
