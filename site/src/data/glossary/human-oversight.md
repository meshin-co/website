---
title: What does human oversight require under the EU AI Act?
term: Human oversight
description: Human oversight is the EU AI Act duty that a person assigned to watch a high-risk system can actually understand it and stop it.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: Human oversight is the EU AI Act requirement that a person watching a high-risk AI system can understand what it is doing, catch a wrong output and stop the system. That takes training, time and authority, not just a name on a workflow diagram.
definition: |-
  Article 14 splits human oversight into two kinds of measure. The provider builds one kind into the system itself before it ships, such as an interface that flags a low-confidence output. The provider identifies the other kind for the deployer to carry out instead. An example of that kind is a rule about when a person must review a case before it proceeds.

  Article 14 lists five capacities the overseeing person needs. They must understand the system's real limits well enough to spot a malfunction. They must stay alert to automation bias, the tendency to trust the output by default. They also need to interpret the output correctly and to disregard or reverse a specific output when needed. Last, they need a way to halt the system outright.
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

It differs from asking whether a human is in the loop. That is a design question about where a person sits in a workflow. Human oversight is a legal test of whether that person can catch a bad output and has the time, context and authority to stop it. An auditor tests this by asking what the overseer would do in a specific bad case, not whether a review step exists on a diagram.

## What to do about it

Name the specific person or role authorised to halt each high-risk system, not a team. Check that the person has time per case to evaluate output rather than approve on reflex. Train that person specifically on automation bias. A rushed or over-trusting reviewer defeats the requirement even when the process looks correct. The [Fractional CAIO Retainer](/services/fractional-caio-retainer) includes reviewing who watches each system, and whether they could catch a failure this week.
