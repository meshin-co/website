---
title: What does human oversight require under the EU AI Act?
term: Human oversight
description: Human oversight is the EU AI Act duty that a person assigned to watch a high-risk system can actually understand it and stop it.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Human oversight is the EU AI Act requirement that a person watching a high-risk AI system has the training, time and authority to understand what it is doing and catch a wrong output. It also means the power to stop the system, not just a name on a workflow diagram.
definition: |-
  Article 14 splits the mechanism into two kinds of measure. Some are built into the system itself by the provider before it ships. An example is an interface that flags a low-confidence output. Others are measures the provider identifies for the deployer to carry out instead, such as a rule about when a person must review a case before it proceeds.

  Article 14 spells out five specific capacities the overseeing person needs. They must understand the system's real limits well enough to spot a malfunction, and stay alert to automation bias rather than trusting the output by default. They also need to correctly read what the output actually means, disregard or reverse a specific output when needed, and have a way to halt the system outright.
relatedTerms:
  - human-in-the-loop
  - high-risk-ai-system
  - provider-vs-deployer
sources:
  - title: Article 14 - Human oversight
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

It differs from asking whether a human is in the loop. That is a design question about where a person sits in a workflow. Human oversight is a legal test of whether that person is equipped to catch a bad output, with the time, context and authority to stop it. An auditor tests this by asking what the overseer would do in a specific bad case, not whether a review step exists on a diagram.

## What to do about it

Name the specific person or role authorised to halt each high-risk system, not a team, and check they have time per case to evaluate output rather than approve on reflex. Train that person specifically on automation bias. A rushed or over-trusting reviewer defeats the requirement even when the process looks correct. The [Fractional CAIO Retainer](/services/fractional-caio-retainer) includes reviewing who watches each system, and whether they could catch a failure this week.
