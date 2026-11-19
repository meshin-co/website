---
title: How to run an AI agent in shadow mode
description: Learn how to run an AI agent in shadow mode while blocking live actions and comparing proposals with workflow outcomes.
publishDate: 2026-11-17
updatedDate: 2026-11-17
shortAnswer: Run an AI agent in shadow mode by feeding it real workflow inputs while blocking every action that could change the live system. Compare its proposed actions with the existing workflow, review meaningful differences, and set clear limits for data access, cost, and the decision to proceed.
fullAnswer: A shadow run lets a team examine an AI agent against live workflow inputs while the existing process keeps control of the outcome. The agent can propose a reply, a classification, or a tool call, but it must not send messages or change live records. Start with a bounded workflow and choose cases that reveal both routine work and costly mistakes. Give the agent only approved data and tools, and enforce the action boundary outside the model. Record the input, the proposed result, the live outcome, and enough context to explain differences. Review those differences with people who know the work. Agree on acceptable errors and a stop condition before the run begins. A close match can support a release decision, but it cannot prove that the agent is safe to act. Check the cases where the existing process was wrong, and test the controls again before granting any live permission.
keyTakeaways:
  - Block live actions outside the model, including actions hidden inside tool calls.
  - Compare proposed outcomes with the live workflow and review disagreements in context.
  - Set review criteria, spending limits, and stop conditions before the run starts.
  - Treat permission to act as a separate release decision.
faq:
  - q: Can an agent use live customer data in shadow mode?
    a: Only if the data use is approved for the agent and its service providers. Limit access to what the task needs, and apply the same care to stored prompts, outputs, and review records.
  - q: Does a shadow run need to match every human decision?
    a: No. Some differences expose errors or inconsistency in the existing process. Reviewers should judge the evidence and the cost of each kind of mistake rather than rely on agreement alone.
  - q: When should an agent move from shadow mode to live actions?
    a: Move only after the owner accepts the reviewed evidence, the action controls pass their tests, and the team has a rollback plan. Start with permissions narrow enough to limit the effect of a mistake.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
sources:
  - title: Traces
    url: https://opentelemetry.io/docs/concepts/signals/traces/
    publisher: OpenTelemetry
    retrieved: '2026-11-17'
  - title: Canarying Releases
    url: https://sre.google/workbook/canarying-releases/
    publisher: Google
    retrieved: '2026-11-17'
  - title: Making retries safe with idempotent APIs
    url: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
    publisher: Amazon Web Services
    retrieved: '2026-11-17'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Which workflow should you shadow first?

To see how to run an AI agent in shadow mode, start with a workflow that already has a clear owner. Choose a task where the team can inspect both the input and the eventual outcome. Support ticket routing is one example. The live process assigns the ticket, while the agent makes a separate routing proposal.

Keep the first scope narrow enough that reviewers can explain what a good result looks like. A workflow with many handoffs can hide the reason for a mismatch. Write down where the agent receives the case, what information it sees, and when the live process makes its decision. Make sure the agent cannot delay that decision if its own run is slow or fails.

Select cases that include routine requests and difficult exceptions. A sample made only from easy work can conceal the errors that matter most. Include cases where the correct response is to ask for help or leave the case unchanged. Record why each case entered the sample, so the team can see which work the run did not cover.

## How do you stop the agent from changing live systems?

Place the action boundary in code and infrastructure, outside the agent's instructions. Give the shadow process credentials that cannot write to production records, send messages, or trigger other live workflows. Where the agent expects a tool, provide an adapter that records its proposed call without carrying it out. The adapter should return a clearly marked simulated result.

Check the whole path for side effects. A tool that appears to read a record may also create a session, update a timestamp, or emit an event. External services can receive customer data even when no internal record changes. Restrict network access and provider use to the destinations approved for the run.

Test the boundary with a deliberate attempt to perform a blocked action. Inspect the receiving system as well as the agent log. A rejected call in the log is useful evidence, but the team should also verify that no message or record change occurred. Repeat the check after a tool, credential, or integration changes.

A simulated result can change later steps in the agent's reasoning. Record where that happens, and do not treat the resulting chain as proof of what would happen with a live tool. The distinction matters when an agent makes several dependent proposals.

## What should the agent receive and produce?

Capture the input at the same decision point as the live workflow. For a support ticket, that may mean the ticket text, permitted account context, and the routing rules available at assignment time. Avoid giving the shadow agent information that appeared only after the live decision. Otherwise the comparison rewards hindsight.

Use a stable case identifier to join the agent's proposal to the live result. Keep the identifier separate from sensitive fields where possible. Record the versions of the prompt, model, tools, and routing rules used for each run. If one changes, reviewers need to know which cases used the old setup and which used the new one.

Agree on an output format before collecting results. A useful proposal states the intended action, the target, the reason, and any uncertainty the workflow needs a reviewer to see. It should also record when the agent cannot make a proposal. A blank result, timeout, or failed tool call belongs in the review set rather than disappearing from it.

Limit retention and access for captured inputs and outputs. The review record may contain the same sensitive details as the original case. Remove fields that reviewers do not need, and make the deletion path part of the run setup.

## How do you compare proposals with live decisions?

A match is useful evidence, but the live decision is not always the right answer. Ask reviewers to inspect disagreements and a sample of matches. A shared mistake can look like success if the review checks agreement alone. Give reviewers the case context and the rules that applied at the time.

Use categories that lead to different decisions about the agent. The following table is a starting point for a routing task. Adapt the categories to the harm and cost of the actual workflow.

| Review result              | What the reviewer records                                           |
| -------------------------- | ------------------------------------------------------------------- |
| Both decisions are sound   | The case supports the proposed behavior.                            |
| Agent is wrong             | The error, its likely effect, and whether a control would catch it. |
| Live decision is wrong     | The evidence for a correction and any follow-up needed.             |
| Neither decision is clear  | The missing context or rule that prevents a judgment.               |
| Agent produced no proposal | The failure or delay and whether the live process continued.        |

For each category, keep the count of reviewed cases and the total cases considered. Include skipped cases and explain why they were skipped. Set acceptable results before inspecting the run, with tighter limits for errors that could harm customers or expose data. The [agent evals starter](/resources/agent-evals-ci-starter) can help the team turn reviewed cases into repeatable checks.

## What evidence should the run keep?

Keep enough detail to reconstruct the agent's path without storing every available field. For each case, retain the input reference, proposed output, tool requests, simulated responses, timing, and final review. Link each record to the relevant configuration. Restrict access because tool inputs and outputs can contain customer or business data.

Use [agent tool-call tracing](/blog/how-to-trace-ai-agent-tool-calls-in-production) to connect a proposal to the calls behind it. The [OpenTelemetry traces documentation](https://opentelemetry.io/docs/concepts/signals/traces/) describes the trace structure that can support this record. Check that a reviewer can follow the sequence when a call fails, repeats, or returns an unexpected result.

Separate operational failures from quality judgments. A timeout needs a different response from a confident but incorrect proposal. Record whether the live workflow was affected, even though the shadow run should be isolated from it. Track model and tool spend as well, with a limit that stops the shadow work before it can exhaust the budget.

The case record should also show gaps. If a log was missing or an input could not be joined to the live outcome, mark the case as unreviewable. Do not count it as a pass. Someone needs to own the repair of the evidence path before the next run.

## Who reviews the differences?

Assign a workflow owner to accept the review criteria and make the release recommendation. Give reviewers enough time and context to judge the cases. An engineer can explain a tool failure, while a person who handles the work can assess whether the proposed outcome makes sense. The same person need not fill every role.

Reviewers should note the evidence behind a decision, not just select a label. For a misrouted ticket, that might be the customer request and the rule that identifies the right queue. When the rule is unclear, send the question to its owner rather than changing the label to make the agent look better.

Handle disagreements between reviewers as evidence about the workflow. If people apply the rules differently, the agent may inherit that uncertainty. Resolve the rule where possible, then recheck affected cases against the agreed interpretation. Keep the earlier judgments so the team can see why the result changed.

Some cases may need a separate privacy or security review before the agent sees them. Others may be unsuitable for a shadow run at all. Document exclusions and their reason. A release decision should not imply coverage of work that the reviewers never inspected.

## When is the agent ready to act?

Before the run, write down who can approve a change in permissions and what evidence that person needs. Include acceptable error types, unresolved risks, coverage gaps, and the result of the action-boundary tests. The decision should cover the specific workflow and configuration that produced the evidence. A model or tool change can make that evidence less useful.

Start any live release with a narrow permission and a way to stop it. For example, an approved agent might propose a routing change for a person to confirm before it can make that change itself. Check the [rollback plan for an agent deployment](/blog/how-to-roll-back-an-ai-agent-deployment) before granting broader access.

A shadow comparison and a live release answer different questions. The former shows how proposals compare with observed work under the shadow setup. A live release tests the real action path, including effects that a simulated tool could not reproduce. The [Google SRE discussion of canarying releases](https://sre.google/workbook/canarying-releases/) describes a way to limit exposure while assessing a change.

If the run misses its agreed criteria, keep the existing workflow in control. Fix the observed issue, preserve the failed cases, and run them again alongside fresh cases. The owner can then review the new evidence instead of relying on a broad claim that the agent has improved.

## What should stop a shadow run?

Stop the shadow process if it can reach an unapproved system, exposes data, or interferes with the live workflow. Pause it as well when the team cannot tell which configuration produced its results. A run without a reliable case record is hard to assess and can consume review time without producing a sound decision.

Set a spend limit and an alert before sending cases to the agent. Decide who receives the alert and who can disable the process. If the agent retries failed calls, the limit should cover the repeated work as well as the initial request. The [AWS discussion of safe retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) explains why repeated requests need careful handling.

When a stop condition fires, preserve the relevant logs under the normal access rules. Record the affected cases, the cause if known, and the checks needed before restarting. Do not quietly discard failed cases from the evaluation. They are part of the evidence the workflow owner needs.

Before a restart, test the changed control against the failure that prompted the stop. Confirm that the live workflow still works independently and that reviewers can see the new configuration. Then resume only within the approved scope.
