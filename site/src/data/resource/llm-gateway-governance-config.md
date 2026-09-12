---
title: LLM Gateway Governance Config
name: LLM Gateway Governance Config
type: template
description: 'A governance config for an LLM gateway. It decides what gets logged, redacted, and who may call which model.'
publishDate: 2026-09-08
updatedDate: 2026-09-08
version: '0.1'
license: MIT
status: Written out in full on this page. A repository copy is not published yet.
whatInside:
  - A policy file format — one entry per team or service, with its allowed models, rate limit and redaction rule
  - A redaction rule set for the fields most vendor contracts already forbid sending out, from names and emails to government IDs and payment details
  - A logging schema for what gets written on every call, and how long it is kept
  - An escalation rule for what happens when a call breaks policy, beyond a rejected request
howToUse: Use the schema on this page to build your own policy file, one row per team or workflow that calls a model, starting with whatever is already in production. Route every model call through the gateway before a second application starts talking to a model directly, and review your file on the same schedule as your AI register.
sources:
  - title: 'Regulation (EU) 2024/1689 (Artificial Intelligence Act) — Article 12, record-keeping'
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
    publisher: EUR-Lex
    retrieved: '2026-09-08'
  - title: 'NIST SP 800-53 Rev. 5 — Security and Privacy Controls for Information Systems and Organizations'
    url: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
    publisher: NIST
    retrieved: '2026-09-08'
---

## What this is

A policy file for whichever [LLM gateway](/glossary/llm-gateway) you run, hosted or self-built. It is the config, not the gateway itself. The decisions live in a file your team reviews, not in a script only one engineer remembers.

## The policy schema

| Key            | What it controls                                                   | Example                                           |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| allowed_models | Which providers and model versions a team may call                 | two named models, not an open list                |
| redact         | Fields stripped before a prompt or response is logged or forwarded | email, national_id, card_number                   |
| rate_limit     | Calls per minute before the gateway queues or refuses              | a ceiling per team, not per user                  |
| log_retention  | How long a request and response pair is kept                       | matches your data retention policy, not a default |
| fallback       | What happens if the primary provider is down                       | a named second provider, or a hard failure        |

## Logging and retention

The logging schema borrows its shape from [the EU AI Act's Article 12](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689), which requires automatic event logs for high-risk systems. Not every call through a gateway is high-risk. The habit costs little to build in now. It is expensive to retrofit once a regulator or a customer asks first.

The `allowed_models` and `log_retention` keys map to two [NIST SP 800-53](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) control families: Access Control and Audit and Accountability. A procurement questionnaire is often built from this catalogue, even when nobody names it.

## What it is not

It is not a gateway, and it will not stop a determined engineer from calling a model directly. It makes an unrouted call a [shadow AI](/glossary/shadow-ai) finding. That is the layer the [90-Day Production Sprint](/services/90-day-production-sprint) puts in front of a workflow before it counts as production.
