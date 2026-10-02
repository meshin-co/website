---
title: What is observability for an AI system?
term: Observability
description: Observability means seeing exactly what a user asked a live AI system, what it did and what it answered, for any one case.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: Observability is the ability to see, after the fact, exactly what a user asked a live AI system. For any one case someone points to, it also shows what the system retrieved or called, and what it answered. An aggregate chart alone cannot explain one specific customer's bad experience.
definition: |
  An agentic workflow is a system that also calls tools to look things up or take actions on its own. Its record has to extend further. It needs every tool call made along the way, and what each one returned, not just the final input and output. A wrong outcome usually traces back to one step in a longer chain. Skipping tool-call logging leaves exactly that step unrecorded.

  Observability differs from a simple uptime dashboard. It can show a system is running while saying nothing about whether one specific answer, given to one specific person, was actually right. NIST's risk management framework calls this its Measure function: a system only counts as measured if it keeps being tested and tracked after release, not just before.
relatedTerms:
  - post-market-monitoring
  - red-teaming
  - hallucination-rate
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

A customer or an internal investigation asks: show me exactly what happened in this one case. A system with only aggregate metrics cannot answer. That is precisely the gap a security review is testing for when it asks about monitoring. It also comes up after a customer complaint that a specific answer was wrong. The honest response depends entirely on whether that exact exchange was ever recorded.

## What to do about it

Log the full input, every step the system took including tool calls, and the output for every real request, not a sample. Keep those logs long enough to support an investigation. Make sure any one case can be pulled up by its own reference, rather than only appearing inside an average. This logging, plus a cost-per-outcome view, ships from the first release in the [90-Day Production Sprint](/services/90-day-production-sprint).
