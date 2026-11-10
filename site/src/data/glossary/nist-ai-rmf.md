---
title: What is the NIST AI RMF?
term: NIST AI RMF
description: The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework for managing AI risk across a system's whole lifecycle.
publishDate: 2026-09-08
updatedDate: 2026-11-10
shortDefinition: The NIST AI Risk Management Framework (AI RMF) is a voluntary US framework, published in January 2023, for identifying and managing an AI system's risks across its design, development and use.
definition: |
  The framework sets out four functions an organisation applies to an AI system. GOVERN covers policy and accountability, while MAP covers understanding context and risk. Testing and metrics fall under MEASURE. Acting on what it found is MANAGE's job.

  It is not a law, and it is not sector specific. A bank, a hospital and a ten-person startup can all use the same structure. NIST says it offers flexibility to organisations of all sizes, so small companies can use it too.

  US procurement teams, and increasingly non-US ones, ask about it. They ask because the framework gives a common vocabulary for a question that used to have no fixed answer. That question is how you know your company actually manages an AI system's risks, not just discusses them once.

  In practice, adopting the framework means someone can point to a specific function, and to a specific piece of evidence behind it. That beats a general assurance that everything is under control.
relatedTerms:
  - ai-governance
  - iso-iec-42001
  - human-in-the-loop
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
  - title: Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1
    url: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10
    publisher: NIST
    retrieved: '2026-11-03'
  - title: Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1, full text
    url: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
    publisher: NIST
    retrieved: '2026-11-10'
  - title: NIST AI RMF Playbook
    url: https://airc.nist.gov/airmf-resources/playbook/
    publisher: NIST
    retrieved: '2026-11-10'
  - title: 'Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile, NIST AI 600-1'
    url: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
    publisher: NIST
    retrieved: '2026-11-10'
---

## Why it comes up

It comes up in almost every vendor security questionnaire, and in board packs once a company runs more than one AI system.

A customer's risk team wants a framework they recognise, not a bespoke description of your process. They want it because it lets them compare you against every other vendor they review. A board wants the same thing for a different reason: a structure to ask questions against, rather than trusting that engineering thought of everything.

## NIST AI RMF framework: the four functions and what each asks for

The NIST AI RMF framework has two parts: Part 1 frames AI risk and describes seven trustworthiness characteristics, and Part 2 holds the Core of four functions and the profiles. The Core divides the functions into nineteen categories and seventy-two subcategories, which [NIST AI 100-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) lists in four tables.

| Function and size                       | What NIST asks, by category                                                                                                                                         | Examples of evidence you may already hold (not NIST text)                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GOVERN: 6 categories, 19 subcategories  | Working policies, accountable and trained people, workforce diversity and inclusion, a risk-aware culture, outside feedback, rules for third-party risk             | [AI register](/glossary/ai-register) with an owner per system (GOVERN 1.6, 2.1), [AI acceptable use policy](/blog/ai-acceptable-use-policy-for-a-50-person-company) (GOVERN 1.4), training records (GOVERN 2.2), vendor review procedure (GOVERN 6.1) |
| MAP: 5 categories, 18 subcategories     | Context and purpose documented, the system categorised, benefits and costs set against benchmarks, every component mapped for risk, impacts on people characterised | Intended-use statement per system (MAP 1.1), vendor documentation of limits (MAP 2.2), written procedure for [human oversight](/glossary/human-oversight) (MAP 3.5), risk assessment of likelihood and size of each harm (MAP 5.1)                    |
| MEASURE: 4 categories, 22 subcategories | Metrics chosen and applied, the system evaluated against the trustworthiness characteristics, risks tracked over time, feedback on the measurement gathered         | [Eval suite](/glossary/evals) with test cases and pass rates (MEASURE 2.1, 2.3), monitoring of the live system (MEASURE 2.4), security test report (MEASURE 2.7), user problem and appeal channel (MEASURE 3.3)                                       |
| MANAGE: 4 categories, 13 subcategories  | Risks ranked and answered, plans that raise benefit and cut harm, third-party risks managed, response, recovery and communication plans documented and monitored    | Go or no-go sign-off (MANAGE 1.1), risk decisions to mitigate, transfer, avoid or accept (MANAGE 1.3), switch-off or rollback steps (MANAGE 2.4), incident log (MANAGE 4.3)                                                                           |

The seven trustworthiness characteristics in Part 1 are valid and reliable, safe, secure and resilient, accountable and transparent, explainable and interpretable, privacy-enhanced, and fair with harmful bias managed. MEASURE evaluates a system against them.

GOVERN is where [AI governance](/glossary/ai-governance) sits in the framework. NIST calls it cross-cutting and says it is infused through the other three functions. MAP, MEASURE and MANAGE can be applied to a specific system at a specific lifecycle stage. NIST says most users start with MAP once GOVERN is in place, then continue to MEASURE or MANAGE. NIST adds that the process should be iterative.

NIST describes the framework as voluntary, and says its actions are not a checklist and not necessarily an ordered set of steps. An organisation may select some categories and subcategories or apply all of them. NIST's [Playbook](https://airc.nist.gov/airmf-resources/playbook/) adds suggested actions for each subcategory, and an organisation may borrow as many or as few suggestions as fit its use case. Read a subcategory's full wording before you claim a document answers it.

Profiles apply the Core to a setting. [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) is the Generative AI Profile, published in July 2024. It defines twelve risks that generative AI creates or worsens, and lists suggested actions under only some subcategories. A Current Profile records how you manage AI today, and a Target Profile records the outcomes you want. Comparing the two likely reveals your gaps.

The counts and mappings here follow NIST AI RMF 1.0, published in January 2023. NIST's [AI RMF page](https://www.nist.gov/itl/ai-risk-management-framework), last modified 13 August 2026, still offers it for download. The same page says NIST is revising the framework as part of the White House AI Action Plan. NIST's [Playbook page](https://airc.nist.gov/airmf-resources/playbook/) says the Playbook will be updated after the revision. Record which version your mapping uses.

To compare the framework with [ISO/IEC 42001](/glossary/iso-iec-42001) and the [EU AI Act](/glossary/eu-ai-act), read the [FAQ on what each requires](/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require).

## What to do about it

Read the four functions once, properly, rather than skimming a summary. Map what you already do against GOVERN, MAP, MEASURE and MANAGE, and write down the gaps honestly. You do not need to implement all of it before you can talk about it. A short document lists what you have, your review step, and what you still owe against each function. That document beats a claim of full compliance with nothing behind it.
