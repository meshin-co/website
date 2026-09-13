---
title: Evals in CI for LLM agents, without a golden answer
description: 'How to build an eval set from production traffic, score an LLM agent without a golden answer, and fail a merge in CI when it regresses.'
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortAnswer: 'Evals in CI run a fixed test set on every change. A regression then fails the build, the way a broken unit test does. Most agent tasks have no single right answer. Score with a rubric-based judge, a groundedness check, or a comparison against the last good version. Track the pass rate over time.'
fullAnswer: 'Evals in CI put a fixed test set on every prompt, model, or code change. The build fails when the pass rate drops. A regression gets caught before a reviewer approves the pull request, not after a customer notices. Build the set from real production traffic. Sample across a period long enough that one quiet week does not flatter the result. Most agent tasks have no single correct answer. Score them in layers instead. Start with deterministic checks: a tool call shape, a required field, a data format. Add a reference-free judge for whether an answer is grounded in what the agent retrieved. Fall back to a comparison against the last known-good version for everything else. Treat the judge as a component that needs calibration against a human-labelled sample, not as ground truth. A cost ceiling per completed run sits in the same job as the score. An expensive change then fails the build for the same reason a wrong one does.'
keyTakeaways:
  - 'Build the eval set from real production traffic sampled across a window long enough that a quiet period does not flatter the result.'
  - 'Score agentic tasks in layers: deterministic checks for anything mechanical, a reference-free judge for groundedness, and a comparison against the last known-good version for everything else.'
  - 'Calibrate the judge against a human-labelled sample on a fixed schedule, and let it skip a case rather than force a score it cannot support.'
  - 'Put a cost ceiling per completed run in the same job as the quality score, so an expensive change fails the build for the same reason a wrong one does.'
  - 'A failing check blocks the merge by default; only a named reviewer can override it, and every override is logged next to the run it overrode.'
faq:
  - q: 'How many cases does an eval set need before it is useful in CI?'
    a: 'Fewer than most teams assume. A few dozen real, representative cases that cover the failure modes support has already seen catch most regressions, and a large synthetic set with no connection to real traffic often catches less. Add a case the day a bug reaches production, and the set keeps pace with how the agent is actually used, rather than how it was imagined at launch.'
  - q: 'Can an eval set built from old tickets go stale?'
    a: 'Yes, in two ways. The product changes and old cases stop representing real traffic, or a case with a wrong or outdated expected answer starts failing runs that are actually correct. Review the set on a fixed schedule, retire cases the product has outgrown, and pull in new ones from whatever just broke.'
  - q: 'Should a flaky eval block a merge the same way a clear regression does?'
    a: 'No. A check that disagrees with itself run to run is broken, not informative, and forcing it to gate a build just adds noise to the release process. Quarantine it: leave it running and visible, stop it from blocking anything, and assign someone to fix its rubric or its sampling before it rejoins the checks that actually gate a merge.'
  - q: 'Does the judge need to be a stronger model than the one being tested?'
    a: 'Not necessarily, but many teams find a stronger judge catches subtler failures than a same-tier one, since judging is its own hard task. Weigh that against cost: the judge runs on every case in the set, every time the pipeline runs, and a large judge model on a large eval set is usually where the cost ceiling gets tested first.'
category: agentic-architecture
tags:
  - evals-in-ci
  - llm-as-judge
  - agentic-architecture
sources:
  - title: 'Measure Function | NIST AI Risk Management Framework Playbook'
    url: 'https://airc.nist.gov/airmf-resources/playbook/measure/'
  - title: 'OWASP Top 10 for Large Language Model Applications'
    url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/'
  - title: 'CI/CD Integration for LLM Eval and Security | Promptfoo'
    url: 'https://www.promptfoo.dev/docs/integrations/ci-cd/'
  - title: 'LLM-as-a-judge scorers and classifiers | Braintrust'
    url: 'https://www.braintrust.dev/docs/evaluate/llm-as-a-judge'
author: dmitri
---

An eval suite that only runs on a laptop protects nobody. The same regression a developer catches by eye on a good day slips through on a bad one. A model provider's silent update slips through every time. Putting [an eval suite](/glossary/evals) in CI turns a habit into a gate. The pull request cannot merge until the numbers clear, whoever is watching.

## How do you build an eval set from production traffic?

Pull the first cases from what the agent has actually handled, not from what a spec said it should handle. Real traces carry the phrasing, the edge cases, and the odd multi-step requests. A person writing test data from imagination never thinks to include them. A support agent's eval set should read like a week of its own transcripts, because that is exactly what it is.

Sample across a period long enough that one good or bad week does not decide the result. On only.help, my own product, the support-triage rollout built its first eval set from tickets already answered. It then found that the [first week looked better than the system really was](/case-studies/only-help-agentic-support), purely from seasonal timing. A month of traffic spans weekdays, weekends, and spikes the business already expects. That mix is a sturdier base than one convenient week.

Mix the set on purpose. Include three kinds of case: routine ones that should always pass, a handful known to be hard, and a few with no single acceptable answer. Most agent tasks in production fall into that last kind. Store the set next to the code that it tests, in a format a reviewer can read in a pull request. Change it through the same review a code change gets.

Revisit the set on a fixed schedule rather than whenever someone remembers. Retire a case once the product has genuinely outgrown it. Add one the day a new failure reaches production. That keeps the set tracking how the agent is actually used.

## How do you score an agent when there is no golden answer?

Most agent tasks do not reduce to one correct string, so do not force them into that shape. A support reply, a summary, or a multi-step tool sequence can be right in more than one way. A scorer built for exact match will reject good answers as often as it catches bad ones. Score in layers instead, cheapest and most reliable checks first.

Start with deterministic checks on anything mechanical. Check whether the agent called the right tool, with a valid argument set, in a shape that downstream code can actually parse. These checks are cheap, and they never disagree with themselves. In most agentic systems, they catch a large share of regressions before a judge ever runs.

OWASP's list of risks in large language model applications names excessive agency as one of the standard failure modes worth testing for. Excessive agency means an agent taking an action its task never asked for. Write a case for every tool the agent can call. Each case should check that the tool stays quiet when not needed. It should also check that the tool fires correctly when needed.

For the answer's content, add a reference-free judge. Look at the question and whatever the agent actually retrieved. Then check whether every claim in the answer traces back to a document it had in hand. This catches a fluent, confident answer that is simply not supported by anything the system looked at. That is the failure mode a plain accuracy score misses entirely.

Where no rubric fits cleanly, fall back to a comparison against the last known-good version. Show a judge both outputs, blind to which one is new, and ask it to pick a winner. A judge finds picking a winner easier than defending an absolute score out of some invented scale. A win rate against a fixed baseline is also a steadier number to watch than a score with no anchor.

NIST's AI RMF frames this as a selection problem under its Measure function. Which method fits depends on what is actually being measured. A team documents why it chose a metric, and which ones it rejected. That team ends up with a sturdier suite than one that picked whatever was easiest to compute.

## What happens when the judge itself is flaky?

A judge model can score the same input differently on two runs, especially at a higher temperature. That alone will make a pipeline look unstable, even when the agent under test has not changed. Set the judge's own temperature as low as the provider allows. Treat any remaining run-to-run disagreement as a property of the judge to manage.

Calibrate the judge on a fixed schedule against a small set of cases a human has already scored. The number that matters is agreement between the judge and the human reviewers. A judge that is consistent but consistently wrong is worse than one that is honestly uncertain. Consistent wrongness hides the problem instead of surfacing it.

Let the judge decline a case it cannot confidently assess. A skipped case should fall out of the pass-rate calculation, rather than count as either a pass or a fail. A case the judge skips often is telling you the rubric does not cover that situation yet.

When one specific case flips between pass and fail on identical re-runs, treat that case as broken, not the whole gate. Quarantine it. Keep it running so you can see it, stop it from blocking a merge, and put a name against fixing its rubric or its sampling. Only then should it rejoin the set that actually gates a build.

## What should the pipeline check, and what does a failing check do to the build?

Not every check should carry the same weight. A wrong tool call and a slow response are both real problems, but only one of them should stop a release. The table below is the shape of a working gate. It shows what each row measures, how it gets a number, and what that number does to the build when it fails.

| What to score                            | How to score it                                                                                          | What a failing score does to the build                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Task success on labelled cases           | Exact match or a deterministic rule against a known-good answer.                                         | Blocks the merge immediately, with no override.                                                 |
| Task success with no golden answer       | A rubric-based judge scores the answer against stated criteria, not against a reference.                 | Blocks the merge once the pass rate drops below the floor set for that task.                    |
| Faithfulness to retrieved context        | A reference-free judge checks whether each claim traces back to a document the agent actually retrieved. | Blocks the merge; an unsupported claim counts as a defect, not a style note.                    |
| Preference against the last good version | Pairwise comparison: the judge sees both outputs, blind to which is new, and picks a winner.             | Blocks the merge if the new version loses on more cases than the agreed margin allows.          |
| Tool-call correctness                    | Deterministic check that the agent called the right tool with a valid, schema-checked argument set.      | Blocks the merge; a malformed call fails loudly instead of degrading quietly.                   |
| Judge-human agreement                    | Re-run the rubric against a human-labelled sample on a fixed schedule and compare agreement.             | Does not block a single pull request; a drop pages the eval owner to fix the rubric.            |
| Cost per completed run                   | Sum of model and tool cost across the eval set, divided by cases completed.                              | Blocks the merge once the run exceeds the ceiling set in the pipeline config.                   |
| Response time under load                 | Wall-clock time per case, measured in the same job as the scores.                                        | Warns on the pull request; blocks only if it breaches the budget agreed with the product owner. |

## Where does the cost ceiling sit?

Put a cost ceiling in the same job as the quality score. Do not put it on a separate dashboard someone checks once a week. Agent systems fail commercially long before they fail technically. Consider a tool call that retries a few times on a bad response: harmless in a demo, ruinous once real traffic hits it.

Measure cost per completed run, across the whole eval set, the way you measure the pass rate. A change that makes the agent slower or more expensive without a real gain is a regression. That holds even if every other score stays green. A [90-Day Production Sprint](/services/90-day-production-sprint) puts this gate in place before a workflow takes its first real user. That is a cheaper time to find the problem than after the first invoice.

## What does the pipeline do when a check fails?

A failing check blocks the merge by default. The pull request gets a summary next to the diff that caused it. That summary lists which cases failed, what the agent returned, and what the check expected. Nobody reconstructs the failure from a log.

Not every failure deserves the same response. A wrong tool call or an unsupported claim should stop the release outright. A latency or cost warning close to its budget can page an owner instead. So can a drop in judge-human agreement, without stopping every other change in the queue. Keep that distinction explicit in the pipeline config, not in someone's memory of which checks are actually load-bearing.

Only a named reviewer, not the author of the change, can override a hard block. That override has to write itself into the same log the eval results live in. An override that leaves no trace is indistinguishable from no gate at all. It gets used that way the next time someone is in a hurry.
