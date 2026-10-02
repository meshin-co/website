---
title: Agent Evals CI Starter
name: Agent Evals CI Starter
type: kit
description: 'A starter CI pipeline for agent evals. It runs on every pull request and blocks a bad merge before it ships, using a plain YAML case format.'
publishDate: 2026-09-08
updatedDate: 2026-10-02
version: '0.1'
license: MIT
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - A description of the workflow that runs on every pull request touching a prompt, a tool definition or a model version
  - An eval case format — an id, an input, an expected outcome and a tag, in a plain YAML file
  - A description of the pass-rate gate that blocks the merge below a floor you set once and tighten over time
howToUse: Add a job to your own CI workflow that runs the eval cases, and point it at an eval file you write yourself in the case format on this page. Start with a forgiving pass-rate floor for the first release, then tighten it once the set has caught a real regression. The build fails on a drop, not a channel message someone can miss.
sources:
  - title: OWASP Top 10 for Large Language Model Applications
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
    publisher: OWASP
    retrieved: '2026-09-08'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: NIST
    retrieved: '2026-09-08'
---

## What this is

A CI workflow and an eval case format for one [agentic workflow](/glossary/agentic-workflow). The same discipline sits inside the [90-Day Production Sprint](/services/90-day-production-sprint). A prompt or model change should not merge without passing a test set first.

## The eval case format

| Field    | Purpose                                                                    | Example                                           |
| -------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| id       | A stable name, so a failure is traceable across runs                       | refund-double-charge                              |
| input    | The exact prompt or tool call the agent receives                           | Customer says they were charged twice             |
| expected | A pass rule: an exact match, a check, or a second model acting as a grader | Refund issued, ticket closed, no invented apology |
| tags     | The failure mode a case guards against                                     | prompt-injection, tool-misuse, refusal            |

## The CI gate

The workflow runs the eval set on every pull request, scores it, and blocks the merge under your floor. Nobody has to remember to run it by hand, which is the part that fails first once a team is busy.

The tags borrow their shape from [OWASP's Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/). Prompt injection and excessive agency (the agent doing something nobody asked it to) appear in a support agent as often as in a public chatbot. A tagged case catches the regression either way.

## What it is not

It is not a considered eval set on its own. A handful of cases pulled from real conversations tests more than a long list invented at a desk. The starter takes no position on which cases you pick. Choosing the cases still maps to the MEASURE function (one of the framework's four functions) in [NIST's AI Risk Management Framework (AI RMF)](https://www.nist.gov/itl/ai-risk-management-framework).
