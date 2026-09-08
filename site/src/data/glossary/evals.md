---
title: What are evals?
term: Evals
description: Evals are repeatable tests that score an AI system's output against fixed examples, run before release and after every change.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Evals are repeatable tests that score an AI system's outputs against a fixed set of examples and criteria, run before release and again whenever the prompt, data or model changes.
definition: Evals are repeatable tests that score an AI system's outputs against a fixed set of examples and pass criteria, in the same way a test suite scores ordinary software, except the thing under test can give a different answer each run. A typical eval is a set of inputs with known good answers or a scoring rule, run automatically whenever the prompt, the underlying model or the surrounding code changes, with a pass rate tracked over time rather than a single pass or fail. Engineering teams build them because "it worked when I tried it a few times" does not survive a prompt change six months later, when nobody remembers which cases mattered. Security reviewers and boards ask about them because an eval suite is the concrete answer to "how do you know it still works", which otherwise has no answer better than trust. In practice, having evals changes how a team ships. A prompt or model change goes through the same suite every time, and a drop in the pass rate blocks a release the way a failing test would.
relatedTerms:
  - agentic-workflow
  - llm-gateway
  - ai-governance
sources:
  - title: NIST Launches ARIA, a Program to Advance Testing and Evaluation for AI
    url: https://www.nist.gov/news-events/news/2024/05/nist-launches-aria-new-program-advance-sociotechnical-testing-and
  - title: A Survey on Evaluation of LLM-based Agents
    url: https://arxiv.org/abs/2503.16416
---

## Why it comes up

A security reviewer or a technical board member who has shipped ordinary software asks the same question they would of any release process, namely what stops a bad change from reaching customers. For a normal codebase the answer is a test suite. For an AI feature, the honest answer is either an eval suite or "we check by hand", and the second answer does not hold up well once the product has more than a couple of prompts or has changed hands between engineers a few times.

## What to do about it

Write down twenty to fifty real cases the system must handle correctly, drawn from actual support tickets or usage rather than invented examples, and include a few you know are hard. Score each case automatically where you can and by a human reviewer where you cannot, and track the pass rate over time rather than treating one run as final. Run the suite before every prompt or model change ships, not only when something has already gone wrong.
