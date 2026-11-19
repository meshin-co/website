---
title: Agent Evals CI Starter
name: Agent Evals CI Starter
type: kit
description: 'Agent evals CI starter: a four-field eval case format and a description of the pull-request gate that blocks a merge below a pass-rate floor you set.'
publishDate: 2026-09-08
updatedDate: 2026-11-12
version: '0.1'
license: CC-BY-4.0
status: Available as a page on this site. There is no repository copy.
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
  - title: Command line
    url: https://www.promptfoo.dev/docs/usage/command-line/
    publisher: promptfoo
    retrieved: '2026-11-12'
  - title: GitHub Action for LLM Prompt Evaluation
    url: https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/README.md
    publisher: promptfoo
    retrieved: '2026-11-12'
  - title: CI/CD Integration for LLM Evaluation and Security
    url: https://www.promptfoo.dev/docs/integrations/ci-cd/
    publisher: promptfoo
    retrieved: '2026-11-12'
  - title: Testing Prompts with GitHub Actions
    url: https://www.promptfoo.dev/docs/integrations/github-action/
    publisher: promptfoo
    retrieved: '2026-11-12'
  - title: Working with evals
    url: https://developers.openai.com/api/docs/guides/evals
    publisher: OpenAI
    retrieved: '2026-11-12'
  - title: Pricing
    url: https://www.braintrust.dev/pricing
    publisher: Braintrust
    retrieved: '2026-11-12'
  - title: Pricing
    url: https://www.confident-ai.com/pricing
    publisher: Confident AI
    retrieved: '2026-11-12'
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

## Why not the threshold you already have?

A pass-rate threshold cannot see a metric fall while the suite stays above it. The floor in the gate above is a threshold of this kind. The baseline in the [evals-baseline specification](/spec/evals-baseline/1.0) reports every fall beyond that metric's tolerance. Three differences can be checked.

- A threshold covers the suite, and a baseline covers each metric. promptfoo's [command-line reference](https://www.promptfoo.dev/docs/usage/command-line/) describes `PROMPTFOO_PASS_RATE_THRESHOLD` as "Set a minimum pass rate threshold (as a percentage)". The README of its [GitHub Action](https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/README.md) describes `fail-on-threshold` as "Required suite pass percentage from 0 to 100". A baseline stores a value and a tolerance for each metric.
- A threshold is typed into a workflow line, so nothing in the repository records when the suite last met it. The custom threshold check in promptfoo's [CI guide](https://www.promptfoo.dev/docs/integrations/ci-cd/) fails the build when `$PASS_RATE < 95`. A baseline is committed to the repository with the date it was recorded, and each check that reads it prints that date.
- With a threshold of 0.80, a metric can fall from 0.98 to 0.81 and the build stays green. A baseline of 0.98 with a tolerance of 0 reports `below-baseline` for a run that scores 0.81, because the drop, 0.17, is more than the tolerance ([rule 2 of the specification](/spec/evals-baseline/1.0#four-comparison-rules)). A check exits 1 on that finding only with `--strict`, and otherwise it warns and exits 0.

The README of promptfoo's GitHub Action disagrees with promptfoo's documentation page about whether the action compares a pull request with its base. The [README](https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/README.md) says: "The action evaluates only the current checkout; it does not run separate base and head evaluations." The [documentation page](https://www.promptfoo.dev/docs/integrations/github-action/) says: "On every pull request that modifies a prompt, the action will automatically run a full comparison".

## A baseline you do not own can be switched off

A baseline kept in someone else's [evals](/glossary/evals) service lasts as long as that service allows. Three vendors state their limits on their own pages, each read on 12 November 2026.

- [OpenAI's evals guide](https://developers.openai.com/api/docs/guides/evals) says: "Evals will become read-only for existing users on October 31, 2026, and the platform is scheduled to shut down on November 30, 2026."
- [Braintrust's pricing page](https://www.braintrust.dev/pricing) lists "14-day retention" for its free Starter plan.
- [Confident AI's pricing page](https://www.confident-ai.com/pricing) lists "5 test runs per week" for its free plan and adds "additional test runs are locked".

[The specification requires](/spec/evals-baseline/1.0#a-passing-check-must-be-expensive-to-fake) the baseline to be a file committed to your repository, and a check to read it without a network or a database. No evaluation vendor's plan, retention period or shutdown date applies to it.

## What it is not

It is not a considered eval set on its own. A handful of cases pulled from real conversations tests more than a long list invented at a desk. The starter takes no position on which cases you pick. Choosing the cases still maps to the MEASURE function (one of the framework's four functions) in [NIST's AI Risk Management Framework (AI RMF)](https://www.nist.gov/itl/ai-risk-management-framework).
