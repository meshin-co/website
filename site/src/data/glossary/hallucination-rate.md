---
title: What is a hallucination rate?
term: Hallucination rate
description: A hallucination rate is the share of a model's answers that are confidently wrong, measured against real questions with known correct answers.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: A hallucination rate is the share of a model's answers that state something false or invented in the same confident tone as a correct one. A team measures it against questions with known correct answers.
definition: |
  NIST's generative-AI risk guidance calls this failure confabulation, distinct from an ordinary software bug because confidence is never a reliable guide to accuracy here. That makes it different from a crash or an error message, which at least announces itself. A model rarely answers "I don't know". Left to guess, it produces a fluent answer instead. That is why a team has to measure the rate rather than assume it.

  Measuring it means running the model against questions with known correct answers. The score is how often the model invents an answer instead of giving a true one. An eval suite already applies the same discipline to other kinds of failure. That turns a vague worry into a tracked number.
relatedTerms:
  - evals
  - retrieval-augmented-generation
  - guardrails
sources:
  - title: 'Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile'
    url: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
  - title: 'A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions'
    url: https://arxiv.org/abs/2311.05232
---

## Why it comes up

A board asks this before it asks about model architecture or vendor choice. It turns "is the AI any good" into a number anyone can track quarter to quarter. A company that cannot answer with one, measured on its own real use cases, is really saying "we do not know." That reads differently in a board pack than an honest figure with the method stated plainly.

## What to do about it

Measure the rate on the eval suite's real cases, not a generic public benchmark. Behaviour on general trivia says little about a specific product's actual questions. Track the number after every prompt or model change, the way a team tracks an eval pass rate. Do not measure it once and assume it holds. The [90-Day Production Sprint](/services/90-day-production-sprint) puts this measurement inside continuous integration, so a regression blocks a release.
