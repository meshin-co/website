---
title: Build vs Buy AI Kit
name: Build vs Buy AI Kit
type: kit
description: 'The build vs buy AI kit: a one-page worksheet of the six criteria I work through before recommending either path, and how to score them.'
publishDate: 2026-09-08
updatedDate: 2026-10-02
version: '0.1'
license: MIT
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - Six criteria that decide more of the answer than most teams expect, from data residency to who owns it when it breaks
  - A scoring method — weight each criterion for your situation, score build and buy against it, and compare totals
  - 'A total cost of ownership framework: the cost categories to fill in for build (engineering time, maintenance, drift monitoring) and for buy (licence, integration, lock-in)'
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

[NIST's AI Risk Management Framework (AI RMF)](https://www.nist.gov/itl/ai-risk-management-framework) treats a vendor's model the same as one you trained. That sits under its MAP function (one of the framework's four functions). The risk to your customer does not care who wrote the code.

## Total cost of ownership

The Total cost over years criterion needs a total cost of ownership (TCO) estimate, and a vendor quote covers only part of it. Fill in the categories in the table below, for build and for buy. Use the same horizon for both sides, long enough to cover the longest contract you would sign. For each side, add what you pay once to what you pay in every period of that horizon.

| Side  | Cost category    | What to count                                                                                 |
| ----- | ---------------- | --------------------------------------------------------------------------------------------- |
| Build | Engineering time | Engineer hours for the first version, and the work those engineers would otherwise ship       |
| Build | Maintenance      | Upkeep as the model API, your libraries and your product change                               |
| Build | Drift monitoring | The [evals](/glossary/evals) and review that catch quality slipping as models and data change |
| Buy   | Licence          | The vendor's fee in the unit they meter it, and how it grows with your usage                  |
| Buy   | Integration      | Connecting the tool to your data, login and workflows, plus the security review               |
| Buy   | Lock-in          | The cost of leaving: moving data out, redoing prompts and workflows, retraining staff         |

Take every amount from your own quotes and payroll, because this page lists no amounts. Use the same usage forecast on both sides, since the criteria table above shows that usage often decides which side costs less. Lock-in is the cost behind the Exit cost criterion, so fill in both together.

## What it is not

It is not a procurement process, and it will not pick the vendor for you. It decides one thing: whether the job belongs inside your codebase or inside someone else's product. This is the call the [Fractional CAIO Retainer](/services/fractional-caio-retainer) reviews every quarter, alongside the [shadow AI](/glossary/shadow-ai) a team already bought without asking.
