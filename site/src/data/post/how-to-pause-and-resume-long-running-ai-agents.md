---
title: How to pause and resume long-running AI agents
description: Learn how to pause and resume long-running AI agents using durable checkpoints, approval checks, and recovery rules.
publishDate: 2026-11-22
updatedDate: 2026-11-22
shortAnswer: To pause and resume long-running AI agents, save their progress in durable storage before releasing the worker. Resume from a recorded step, check that the run still has permission to act, and reconcile any external action whose outcome is uncertain. Keep approval, retry, and cancellation rules with the saved state.
fullAnswer: |-
  To pause and resume long-running AI agents, persist the run state at a safe boundary and start again from that boundary when the required event arrives. The saved state should identify the next step, pending work, approvals, and any external action that may already have happened. A worker can then stop without losing the task or guessing where to continue.

  The hard part is the gap between saving progress and changing another system. A payment, email, or ticket update may succeed even if the agent never receives the reply. Record the action before sending it, use the recipient's duplicate protection where available, and check uncertain outcomes before trying again.

  Treat resume as a fresh authorization decision. Confirm the run has not expired or been cancelled, check the current permissions, and make sure the saved state still works with the deployed code. Test worker crashes and repeated resume requests before relying on the design.
keyTakeaways:
  - Save the next step and pending actions in durable storage before a worker stops.
  - Treat an external action with an unknown outcome as a reconciliation task, not an automatic retry.
  - Check approval, access, expiry, and code compatibility each time a run resumes.
  - Test pause and resume at crash boundaries, including repeated and competing requests.
faq:
  - q: Can an agent resume after its worker crashes?
    a: Yes, if another worker can load a durable checkpoint and safely claim the run. It must also check whether an external action happened before the crash. An in-memory conversation alone is not enough to recover reliably.
  - q: Should an approval stay valid while an agent is paused?
    a: Set an expiry and bind approval to the exact action and context the reviewer saw. On resume, check whether the approval, permissions, and relevant facts still apply. Ask for a new review when they do not.
  - q: What if the agent cannot tell whether an external action succeeded?
    a: Keep the action in an unknown state and check the recipient's records using a stable reference. Retry only when the recipient can prevent a duplicate or the original action is known not to have happened. Otherwise, send the case for review.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
sources:
  - title: Workflow Execution
    url: https://docs.temporal.io/workflow-execution
    publisher: Temporal
    retrieved: '2026-11-22'
  - title: Integrating services with Step Functions
    url: https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html
    publisher: Amazon Web Services
    retrieved: '2026-11-22'
  - title: Transaction Isolation
    url: https://www.postgresql.org/docs/current/transaction-iso.html
    publisher: PostgreSQL Global Development Group
    retrieved: '2026-11-22'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Where should an agent pause?

The practical answer to how to pause and resume long-running AI agents starts with choosing a safe boundary. Pause after the system has saved the result of a step and before it begins the next action. A review request, a wait for a document, or a scheduled hold can all use that boundary. The worker can then release its resources while the run remains open.

A pause request may arrive while a tool call is still running. Mark the run as pausing, stop it from starting new work, and let the current call finish if that is safe. Record its result before marking the run paused. If the call cannot finish safely, use the tool's cancellation mechanism and record whether cancellation succeeded.

Some calls cannot be stopped or queried reliably. In that case, record an unknown outcome rather than claiming the run is safe to continue. Send it for reconciliation before allowing a related action. Set a clear expectation for operators: requesting a pause does not mean every remote system has already stopped.

## What state must survive the pause?

Give each run a stable identifier and save the step it should execute next. Include the task inputs, relevant conversation or model context, tool results, and references to files the next step needs. Keep the workflow and state schema versions alongside them. A resumed worker needs enough context to continue without relying on the memory of the worker that stopped.

Save the status of each pending action, including its destination, stable request reference, and last known outcome. Record who can approve the next action and whether an approval has already arrived. Store expiry and cancellation conditions with the run. Avoid storing passwords or access tokens in the checkpoint; fetch current credentials from the normal secret store when work resumes.

Keep the checkpoint small enough to inspect and restore. Store large documents separately and save durable references with access rules and retention dates. If the agent relies on changing source material, record the version it used or require a fresh check. A missing file should produce a visible recovery decision, not a silent guess.

## How should the checkpoint be stored?

Use storage that survives worker restarts and supports a reliable update of the run record. Save the completed step, its output references, and the next step together. If those fields can be written separately, a crash may leave the run pointing at work whose result was never saved.

The table shows a practical set of run states. It is a design choice, so adapt the names to the workflow rather than treating them as a framework requirement.

| State       | What the scheduler may do                                                |
| ----------- | ------------------------------------------------------------------------ |
| Running     | Let the current owner advance the run.                                   |
| Pausing     | Block new steps while in-flight work settles.                            |
| Paused      | Wait for an allowed resume event.                                        |
| Reconciling | Check an uncertain external outcome.                                     |
| Cancelled   | Prevent further actions and retain the record under its retention rules. |
| Complete    | Stop scheduling work for the run.                                        |

Use a database transaction or another atomic update mechanism to change state and record the next work item. The [PostgreSQL transaction isolation documentation](https://www.postgresql.org/docs/current/transaction-iso.html) describes how concurrent transactions can interact. Pick and test the storage guarantees your implementation actually uses. A queue message alone should not be the only copy of the run state.

## How does a paused run receive a resume event?

A resume event can come from an approval, a file arrival, a timer, or an operator. Give the event the run identifier and a reference to the condition it satisfies. The receiver should check that the run is still paused for that condition before changing its state. An old event for a previous wait must not release a later wait by mistake.

Record the accepted event and the state change together where possible. A worker can then pick up the ready run from a durable queue or a database-backed scheduler. If a queue delivers the same event again, the saved state should make the later delivery harmless. Return a clear result to the sender when the event is stale or the run has already moved on.

Managed workflow tools can provide a callback mechanism for waits. For example, the [AWS Step Functions service integration documentation](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html) describes waiting for a task token. Treat any callback token as a secret, limit who can submit it, and apply expiry rules. The workflow still needs its own checks for approval and external effects.

## How do you keep competing workers from resuming the same run?

Have a worker claim the run through an atomic state change before it begins. The claim should identify the worker and include a lease or other recovery rule for a worker that disappears. A later worker can take over only after the prior claim is no longer valid. Record each claim and release so an operator can reconstruct what happened.

A lease on its own does not stop a worker that was delayed and then wakes up. Give each claim a generation value and check it before accepting writes from that worker. Reject results from an older claim. Check the value at the point that controls dispatch as well, not just when the worker loads the checkpoint.

Remote systems may not understand the claim value. Route sensitive calls through a controlled dispatcher, and use recipient-side duplicate protection where it exists. A stale worker might already have sent a request before its claim expired. The new owner must reconcile that request rather than assuming the lease kept it from happening.

## What happens to an action already sent?

Consider an agent preparing a customer refund. It records the proposed action and the approval, then sends a request to the payment service. The service may process the refund while the reply is lost. If the worker crashes at that moment, the saved run cannot safely label the refund failed.

Record an intent and a stable action reference before dispatch. Send that same reference to the recipient when it supports duplicate protection. Save the response and resulting status when it arrives. If the result is unknown, query the recipient by reference or use its documented reconciliation process before retrying.

Some recipients offer neither a lookup nor duplicate protection. For those systems, hold the run and ask an operator to check the outcome. Do not create a fresh request reference merely to make the retry go through. See the separate guide to [preventing duplicate agent actions on retries](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) for the broader retry design. For payments, bind the review to the amount and destination described in the [approval workflow](/blog/how-to-require-approval-for-ai-agent-payments).

## What must be checked before work resumes?

Check that the task remains open, the resume event is valid, and the requester still has access. Recheck the agent's permissions against the action it is about to take. A person who approved a draft may no longer have authority, and a destination may have changed while the run was waiting.

Bind approval to the action details that matter, such as recipient, amount, and purpose. Store who approved it, when it expires, and what evidence the reviewer saw. If those details change, request another review. A resumed run should not reuse an approval for a different action just because the task identifier stayed the same.

Also check whether saved inputs and outputs are still available and fit for use. If a document was deleted or access was withdrawn, stop and ask for a new input or close the run. Record the reason for the hold without copying sensitive content into an operator message. The [human oversight glossary page](/glossary/human-oversight) gives context for placing these checks under accountable review.

## How do code changes affect saved runs?

A paused run may outlive the code that created its checkpoint. A new release might rename a step, change a tool's inputs, or expect a field that older state does not contain. Record the workflow and state schema versions when saving the run, then check them before dispatching resumed work.

Choose a policy for each release. Keep compatible workers available for older runs, migrate saved state with a tested conversion, or stop affected runs for review. A migration should preserve pending action references and approval evidence. Never discard an unknown external outcome just to make the saved state load.

Test the change against copies of representative checkpoints before deployment. Include paused approvals, missing files, cancelled tasks, and actions awaiting reconciliation. If a conversion fails, retain the original state and show the operator a reason. The [rollback guide](/blog/how-to-roll-back-an-ai-agent-deployment) covers the deployment decision around a bad release. The [Temporal workflow execution documentation](https://docs.temporal.io/workflow-execution) provides context for systems that retain workflow progress across interruptions.

## How can the team test recovery before launch?

Build tests around the boundaries where state and external effects can disagree. Stop the worker before saving a checkpoint, after saving it, before dispatch, and after the recipient accepts a request. Repeat the resume event and run competing workers against the same saved task. Check the resulting state and the recipient's record, not just the agent's final message.

Include a delayed worker that returns after its claim has expired. Check that its old results cannot advance the run and that a previously sent request is reconciled. Test expired approvals, revoked access, deleted files, and a release that changes the saved state format. For a recipient without safe retry support, verify that the workflow holds for human review.

Give operators a view of the run state, last completed step, pending action, claim owner, and reason for any hold. Alert on runs that remain paused or reconciling beyond the team's chosen limit. The [agent evaluation starter](/resources/agent-evals-ci-starter) can help the team add repeatable checks to its delivery process. Before launch, assign a named operational role to resolve uncertain actions and document how that person records the outcome.
