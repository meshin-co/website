---
title: What is red teaming for an AI system?
term: Red teaming
description: Red teaming is deliberately trying to break an AI system the way an attacker would, before they do, to find the failure nobody tested.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Red teaming means deliberately trying to break an AI system, the way a motivated attacker or a determined bad-faith user would, before they actually do. It aims at finding the failure nobody wrote a test case for, not at confirming cases already known to work.
definition: |
  A red team engagement produces a different kind of output than a test run. It is a list of the specific techniques that worked, detailed enough for someone else to reproduce the failure. It also carries a judgement on what an attacker could actually do with it. That reproducibility is what separates a report from an anecdote about something that broke once.

  NIST's generative AI profile recommends red teaming as a check against specific categories of harm, including information leakage and harmful content generation. Those failures depend on someone actively trying to cause them; they rarely show up in ordinary use. The finding that matters is the one nobody predicted going in.
relatedTerms:
  - guardrails
  - evals
  - prompt-injection
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
  - title: 'Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile'
    url: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
---

## Why it comes up

Boards and security reviewers increasingly ask for it by name, rather than accepting "we ran evals" as a full answer. An eval suite built by the same team that built the system tends to test what that team already expected to go wrong. It matters more, not less, once a system can take actions or read outside content. A missed failure then moves from a bad reply to a completed action.

## What to do about it

Budget real time, not an afternoon, for someone to actively try prompt injection, data extraction and off-limits requests. Do it against the actual live system, not a sanitised demo. Write down exactly what broke, and fix the underlying guardrail, not just the one example that happened to get tried. I treat this as part of shipping in the [90-Day Production Sprint](/services/90-day-production-sprint), folding findings back into the eval suite before launch.
