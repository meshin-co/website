---
title: AI Readiness Scorecard
name: AI Readiness Scorecard
type: scorecard
description: 'A five-axis AI readiness scorecard you score yourself in an afternoon: strategy, data, delivery, people, and governance.'
publishDate: 2026-09-08
updatedDate: 2026-10-25
version: '0.1'
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - Five scored axes, the same groupings as the paid Assessment — strategy, data, delivery, people and governance
  - A scoring table with a row for each axis, from nothing written down to reviewed on a fixed schedule
  - A note on reading a low score, since most first attempts land low and that is not a verdict on the engineering
howToUse: Copy the table into a spreadsheet or your own wiki. Score each axis yourself, or better, ask three people to score it separately and compare notes. A gap between an engineer's score and a board member's score is often more telling than the total.
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: NIST
    retrieved: '2026-09-08'
  - title: 'ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system'
    url: https://www.iso.org/standard/42001
    publisher: ISO/IEC
    retrieved: '2026-09-08'
---

## What this is

Five axes, scored from zero to three, that give you a rough position before you pay anyone to check it properly. The axes match the ones in the [AI Readiness & Risk Assessment](/services/ai-readiness-and-risk-assessment). This is the self-administered version, without the evidence behind it.

## The five axes

| Axis       | 0 — not started                                            | 1 — informal                                 | 2 — documented                             | 3 — evidenced                                           |
| ---------- | ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| Strategy   | No one has named which processes to automate first         | Someone has an opinion, nothing written down | A ranked shortlist exists                  | The shortlist is reviewed by whoever owns the budget    |
| Data       | No one knows what a vendor tool can see                    | A rough sense exists, not written down       | A data classification table exists         | The table is checked before a new tool is approved      |
| Delivery   | Every pilot has stalled before production                  | One pilot is close to live                   | One system is live, unmonitored            | A system is live, monitored, with a rollback path       |
| People     | Only the original builder understands any AI system in use | One other person has read the code           | A second person has changed it and shipped | Ownership is written down and handed over on a schedule |
| Governance | No [AI register](/glossary/ai-register) exists             | A register exists, out of date               | A register exists, reviewed occasionally   | The register is reviewed on a fixed schedule            |

## Scoring it

Score each axis from zero to three using the table above, then add the five scores for a total out of fifteen. A low total early on is common. It usually means nobody has written anything down yet, not that the engineering is behind.

The five axes are not a substitute for the [NIST AI Risk Management Framework (AI RMF)](https://www.nist.gov/itl/ai-risk-management-framework) or [ISO/IEC 42001](https://www.iso.org/standard/42001). They are a rougher pass at the same territory, built to take an afternoon rather than an audit.

## What it is not

It is not the Assessment, and it carries no evidence a reviewer would accept. A self-given three is a claim until someone outside your team checks what you have actually written down.
