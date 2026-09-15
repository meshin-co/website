---
title: Build vs Buy AI Kit
name: Build vs Buy AI Kit
type: kit
repoUrl: https://github.com/meshin-co/build-vs-buy-ai-kit
description: 'The build vs buy AI kit: a one-page worksheet of the six criteria I work through before recommending either path, and how to score them.'
publishDate: 2026-09-08
updatedDate: 2026-09-15
version: '0.1'
license: MIT
status: Written out in full on this page. A repository copy is not published yet.
whatInside:
  - Six criteria that decide more of the answer than most teams expect, from data residency to who owns it when it breaks
  - A worked scoring method — weight each criterion for your situation, score build and buy against it, and compare totals
  - A vendor due-diligence checklist for the buy path, asking the questions a security review will ask anyway
  - A build-path checklist covering what a build commits your engineering team to maintaining afterwards
howToUse: Score build and buy against the same six criteria before anyone states a preference out loud. Weight each criterion for your situation first. A tool that only reads data scores differently on residency than one that writes to a customer record. Keep your scored worksheet with the register entry once you decide.
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: NIST
    retrieved: '2026-09-08'
---

## What this is

A worksheet for one recurring decision: build the workflow yourself, or buy a vendor's version of it. It will not choose for you. It gives the choice a written reason, which is what a board or a buyer asks for later.

## The six criteria

| Criterion                 | Build tends to win when                                              | Buy tends to win when                                            |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Data residency            | Customer data cannot leave your infrastructure by contract or by law | A vendor already holds a data-processing agreement you trust     |
| Customisation depth       | The workflow is core to what makes your product different            | The workflow looks like everyone else's version of the same task |
| Time to a working version | You already have the engineers and the model access                  | Procurement moves faster than a hiring plan would                |
| Total cost over years     | Usage is high enough that a per-call fee compounds                   | Usage is uncertain, and a fixed fee caps the downside            |
| Exit cost                 | You can rebuild the model calls without rebuilding the product       | A second vendor could take over most of the same job             |
| Ownership when it breaks  | An internal team already owns the surrounding process                | A vendor's contract has a real answer to who to call             |

## Scoring it

Weight the six criteria for your situation, score build and buy against each one, and let the total argue with your gut feeling. A bought tool still needs an owner and a place in your [AI register](/glossary/ai-register).

[NIST's AI Risk Management Framework (AI RMF)](https://www.nist.gov/itl/ai-risk-management-framework) treats a vendor's model the same as one you trained, under its MAP function (one of the framework's four functions). The risk to your customer does not care who wrote the code.

## What it is not

It is not a procurement process, and it will not pick the vendor for you. It decides one thing: whether the job belongs inside your codebase or inside someone else's product. This is the call the [Fractional CAIO Retainer](/services/fractional-caio-retainer) reviews every quarter, alongside the [shadow AI](/glossary/shadow-ai) a team already bought without asking.
