---
title: What is human-in-the-loop?
term: Human-in-the-loop
description: Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, not the system acting alone.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Human-in-the-loop means a person reviews or can stop an AI system's output before it takes effect, rather than the system acting on its own once it starts.
definition: Human-in-the-loop describes an AI system built so a person reviews, approves or can stop its output before that output takes effect, rather than the system acting on its own from start to finish. It sits on a spectrum, full autonomy at one extreme, human-in-the-loop requiring a person's active approval at each step in the middle, and human-on-the-loop, where a person can intervene but does not have to act for the system to proceed, closer to the autonomous end. Where a system falls on that spectrum is a design decision, not a fixed property of the technology, and it is one of the first things a customer's security team or a regulator asks about for anything that can affect a person's money, employment or legal standing. The EU AI Act requires "effective" human oversight for high-risk systems, meaning oversight that can genuinely catch and correct a bad output, not a person who clicks approve without reading it. In practice, this changes where a company can safely remove a person from a workflow and where it still needs one.
relatedTerms:
  - agentic-workflow
  - eu-ai-act
  - nist-ai-rmf
sources:
  - title: EU AI Act Article 14 - Human oversight
    url: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

It comes up whenever an AI system's decision touches something that matters to a real person, a loan, a job application, a support case, a medical or safety-adjacent judgement. A customer's legal team wants to know, specifically, whether a person can catch and correct a bad output before it reaches someone affected by it, not whether a person is "involved" in some vague sense. A board asks about it after seeing a story where a fully automated system made a costly or embarrassing call nobody had reviewed.

## What to do about it

Decide, system by system, where full automation is fine, a wrong answer that costs little and is easy to reverse, and where a person needs to review before anything takes effect. Where a person is in the loop, make sure they have enough time and enough context to catch a bad output, rather than a rubber-stamp approval screen that exists only to tick a box. Write down which category each system falls into in the AI register, so the answer is already there when someone asks.
