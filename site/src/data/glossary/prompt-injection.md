---
title: What is prompt injection?
term: Prompt injection
description: Prompt injection is text, typed directly or hidden in a document a model reads, that gets the model to follow it as an instruction.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Prompt injection is text that gets a model to treat it as an instruction rather than content. It can be typed by a user, or hidden inside a document, webpage or email the model reads. OWASP, a security-standards group, ranks it as the top risk for large language model applications.
definition: |
  Direct injection comes from whoever is typing into the box, phrased to override the model's own hidden starting instructions, its system prompt. Indirect injection is the more dangerous form. It arrives inside content the model retrieves on its own: a webpage it is summarising, a resume it is screening. No attacker ever touches the model directly. Multimodal systems add a further variant, since an instruction can hide inside an image processed alongside ordinary text.

  It has kept that position through every edition of the list, most recently the 2026 revision. The reason is structural: the model reads instructions and untrusted data through the same channel. A filter tuned on known patterns still misses a novel phrasing. Every mitigation available today reduces the odds of a successful attack; none removes them.
relatedTerms:
  - guardrails
  - red-teaming
  - retrieval-augmented-generation
sources:
  - title: LLM01:2025 Prompt Injection
    url: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
  - title: OWASP Top 10 for LLM Applications
    url: https://genai.owasp.org/llm-top-10/
---

## Why it comes up

It is the first thing a security reviewer probes on any AI feature that reads outside content. That means a webpage, an uploaded file, an email, or a customer's own message history. The concern is not academic. A model that can also send an email, issue a refund or query a database turns a successful injection into something already done. It is no longer just an embarrassing reply.

## What to do about it

Never let a model's output directly trigger a sensitive action without a check enforced in code. Keep the model's own permissions to the smallest set it needs. Treat anything the model reads from outside the conversation as untrusted input, the way a web application treats a user-supplied string. Evals for exactly this kind of attack belong in the same pipeline that gates every other change. That is how I structure the [90-Day Production Sprint](/services/90-day-production-sprint).
