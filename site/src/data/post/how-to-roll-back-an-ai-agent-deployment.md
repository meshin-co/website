---
title: How to roll back an AI agent deployment
description: 'How to roll back an AI agent deployment: stop actions, restore a known release and check in-flight work before resuming.'
publishDate: 2026-11-08
updatedDate: 2026-11-08
shortAnswer: 'How to roll back an AI agent deployment: stop new tasks and block risky actions, then restore a known release with its matching configuration. Reconcile work already in flight and check external effects before reopening traffic. If the old release is unsafe, keep the agent paused and use a manual path.'
fullAnswer: 'How to roll back an AI agent deployment: contain its ability to act, restore a known release and check the work left behind. The recovery target includes more than application code. Prompts, model settings, tool permissions, routing and stored state can all change the outcome. Name an incident lead who can pause the agent and decide when it may resume. Preserve the current settings and execution records before switching, as long as doing so does not delay containment. Work out which tasks are running, which external actions may have completed and which need a human decision. Test the restored release with safe inputs and a restricted tool account before sending work back. If the fault affects both releases, or the old release cannot read current state safely, leave the agent paused. Route urgent work to an approved manual process while the team repairs the fault.'
keyTakeaways:
  - Block new work and risky tool actions before changing the release.
  - Restore a tested release bundle that includes prompts, settings and permissions.
  - Treat completed external actions as separate recovery work.
  - Resume traffic only after safe checks and an explicit release decision.
faq:
  - q: Can we roll back an agent by switching the model?
    a: A model switch may help if the model change caused the fault. Check prompts, tool access, routing and stored state too. Keep actions blocked until the chosen combination has passed safe checks.
  - q: What if the previous agent release is also unsafe?
    a: Keep the agent paused and use an approved manual path for urgent work. Restore service only after the team has a release that can pass the required checks.
  - q: Does a rollback undo messages or purchases the agent already made?
    a: Restoring a release does not itself undo external actions. Review the action records, confirm what took effect and ask the right owner to correct or compensate for each confirmed effect.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
  - evals-in-ci
sources:
  - title: Deployments
    url: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
    publisher: Kubernetes
    retrieved: '2026-11-08'
  - title: Automating safe, hands-off deployments
    url: https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments/
    publisher: Amazon Web Services
    retrieved: '2026-11-08'
  - title: Canarying Releases
    url: https://sre.google/workbook/canarying-releases/
    publisher: Google
    retrieved: '2026-11-08'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## What should you stop first?

To decide how to roll back an AI agent deployment, stop its ability to take risky actions before changing versions. Pause admission of new tasks at the entry point. Then block tool calls that can send messages, change records or spend money. Keep a safe read path open only if the incident lead needs it and can verify its scope.

Check that the pause covers scheduled jobs, retries and direct callers as well as the main interface. A banner in the user interface does not stop a worker that already has a task. Ask the service owner to confirm the actual block at the tool boundary. If the pause does not take effect, isolate the affected worker or revoke its access through the normal emergency process.

Keep the containment change separate from the release switch. A shared credential may serve other workloads, so identify its users before revoking it. If access must be cut at once, record the wider effect and alert those owners. Do not wait for a complete diagnosis while the agent can still cause harm.

## How do you choose a safe release to restore?

Find the last release that passed the checks needed for this workflow. The target must include the agent code, prompt versions, model selection, tool configuration and routing rules. Capture the identifiers from the release record rather than relying on a person’s memory. Link the target to the checks that supported its release.

Check whether that bundle still works with current data and external services. An older worker may read a newer task state incorrectly, or its model endpoint may no longer be available. An earlier permission set may also restore access that the team has since removed for safety. Review those changes before granting the old agent any authority to act.

Keep the current release record and relevant logs for investigation, subject to the team’s data handling rules. Save enough detail to compare the failing and chosen bundles. Avoid copying sensitive task content into an incident chat when a protected link will do. If no known release is safe, leave the agent paused and send urgent work to a manual queue.

## How do you switch the deployment back?

Use the normal deployment control to select the chosen release while the action block remains in place. Restore its matching configuration from versioned records. Confirm the model endpoint, prompt, tool allowlist and routing rules that each worker actually receives. A release label alone is not proof that every setting changed.

If the agent runs on Kubernetes, the [Deployment documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) describes its revision and rollback controls. Those controls cover the deployment resource, so check separately for settings or services managed outside it. Apply any needed configuration change through its own controlled path. Record what was restored and what was deliberately left unchanged.

Watch for old and new workers running at the same time during the switch. Keep the queue paused until the team knows which version can claim work. If the restored worker fails to start or cannot read current state, stop the rollout rather than repeatedly restarting it. The incident lead should choose a repair or manual path before more traffic enters.

## What happens to tasks already in flight?

List tasks accepted before the pause and group them by their last confirmed state. The table gives the team a starting point for deciding what to inspect. Record the evidence for each task before moving it to a new state.

| Last confirmed state           | Check before proceeding                                         |
| ------------------------------ | --------------------------------------------------------------- |
| No tool call made              | Check that the restored release can read the saved task safely. |
| Tool call sent, result unknown | Check the destination before any retry.                         |
| External action confirmed      | Ask the destination owner whether a correction is needed.       |

Stop automatic retries while the team inspects those records. A retry can repeat a payment, send another message or overwrite a change. Where the tool supports a stable request key, check the result against that key before deciding whether to retry. If the result remains unknown, ask the system owner to verify it at the destination.

Treat saved conversations and task state with care when moving between releases. The restored agent may have different expectations about fields, tool results or pending approvals. Test a copy of representative state in a restricted environment before resuming those tasks. Quarantine records that cannot be read safely, and give their owners a clear route for manual completion.

## How do you handle actions that already happened?

Build a record of actions that may have reached systems outside the agent. Use task history, tool logs and the destination system to establish what actually happened. Include the affected account or record, the action, its status and the person responsible for the next decision. Protect that record as you would the underlying data.

Do not assume every action has an automatic inverse. A sent message may need a correction, while a changed record may need its prior value restored. A purchase or payment may need a separate cancellation or refund. Ask the owner of the destination system to approve the remedy and confirm the result.

Keep uncertain cases open until someone checks them at the destination. If a correction could overwrite a later human change, compare the current record with the expected state first. Tell affected users what they need to do when a remedy changes their work. Record the outcome beside the original task so a later retry does not repeat it.

## How do you check the restored agent safely?

Start with a restricted test account and tools that cannot make live changes. Run representative tasks through the restored path, including a case that exposed the fault. Check the selected model, prompt, tool calls and final result. Inspect the worker logs as well as the output shown to the user.

Next, test the action boundary with an approved destination that can tolerate a controlled change. Confirm that blocked actions stay blocked and that allowed actions reach only their intended target. Check that a failed call does not create an uncontrolled retry. Have the service owner inspect the destination record rather than relying only on the agent’s report.

Use the team’s existing [evals in continuous integration](/blog/evals-in-ci-for-llm-agents) to select repeatable checks, and add the incident case when its data can be handled safely. Compare results with the release criteria agreed before the test. A fluent answer does not show whether a tool call was safe. If any required check fails, keep the action block in place and repair the release.

## When can traffic return?

The incident lead should ask the service and risk owners to review the test results and open issues. Agree who can approve the return, which users or tasks enter first, and what signs require another pause. Record that decision where the on-call team can find it. The [agentic architecture articles](/blog/category/agentic-architecture) provide context for the wider system around that decision.

Release a small, controlled share of work only after the tool boundary and queue are ready. Watch task outcomes, tool calls, retries and reports from the destination systems. Compare the restored path with its expected behaviour, including whether human approvals are being reached. Keep the team available to stop work again if the fault returns.

Expand access only when the agreed checks remain satisfactory. Do not clear a quarantine queue merely because new tasks are working. Each held task still needs a decision about its state and any external effect. If the team cannot observe a critical action, keep that action blocked until it can be checked.

## How do you prepare for the next rollback?

Write a runbook with the actual controls, owners and links for the deployed system. It should say how to pause each entry point, block each tool and locate a release bundle. Include the manual route for urgent work and the authority needed to reopen traffic. Store the runbook where the on-call team can reach it during an outage.

Practice with a test agent and a queue that cannot affect live users. Change a prompt or routing setting, then restore the recorded bundle and verify what each worker receives. Include a task with an uncertain tool result so the team must check the destination before retrying. Note any step that depends on a single person or an undocumented credential.

The [safe deployment practices described by Amazon](https://aws.amazon.com/builders-library/automating-safe-hands-off-deployments/) and the [release checks in Google’s canarying guidance](https://sre.google/workbook/canarying-releases/) can inform that exercise. Fit the checks to the agent’s actual tools and failure modes. Update the runbook after the exercise, and assign an owner to test any change that affects the recovery path.
