---
title: What is human-in-the-loop?
term: Human-in-the-loop
description: Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, not the system acting alone.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, rather than the system acting on its own once it starts.
definition: |
  The concept sits on a spectrum, from full autonomy at one end to human-on-the-loop at the other, where a person can intervene but does not have to act. Human-in-the-loop sits in between: a person must actively approve each step before it happens.

  Where a system falls on that spectrum is a design decision, not a fixed property of the technology. It is one of the first things a customer's security team or a regulator asks about, for anything that can affect a person's money, employment or legal standing.

  Article 14 of the EU AI Act requires "effective" human oversight for high-risk systems: oversight that can genuinely catch and correct a bad output, not a person who clicks approve without reading it. In practice, this decides where a company can safely remove a person from a workflow, and where it still needs one.
relatedTerms:
  - agentic-workflow
  - eu-ai-act
  - nist-ai-rmf
  - human-oversight
sources:
  - title: EU AI Act Article 14 - Human oversight
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202401689
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

It comes up whenever an AI system's decision touches something real: a loan, a job application, a support case, a medical or safety-adjacent judgement. A customer's legal team wants to know whether a person can catch and correct a bad output before it reaches someone affected. That is not the same as a person being "involved" in some vague sense. A board asks after seeing an automated system make a costly call nobody had reviewed.

## What to do about it

Decide, system by system, where full automation is fine, a wrong answer that costs little and is easy to reverse. Decide, too, where a person must review before anything takes effect. Where a person is in the loop, give them enough time and context to catch a bad output. A rubber-stamp screen that exists only to tick a box does not count. Record which category each system falls into in the AI register.
