---
title: How to prevent duplicate AI agent actions on retries
description: Learn how to prevent duplicate AI agent actions on retries with stable operation keys, durable records, and checks for uncertain outcomes.
publishDate: 2026-11-10
updatedDate: 2026-11-10
shortAnswer: Prevent duplicate AI agent actions on retries by giving each intended action a stable key and recording its state before sending it. Reuse that key for every retry, rely on downstream duplicate protection where available, and check uncertain outcomes before sending an action again.
fullAnswer: An AI agent can send the same action again when a tool call times out, even if the first call already changed something. Give each intended action a stable operation key, and store that key with the request before the action leaves your system. A retry must reuse the key rather than create a fresh one. The receiving service also needs to honor the key, or the caller needs a safe way to check whether the action took effect. Keep a durable record of the request, its state, and any receipt so a restarted worker can continue without guessing. If the outcome remains uncertain, stop automatic retries and send the case for review. This design reduces duplicate effects, but it cannot promise that every outside service will prevent them. The safe choice depends on what the receiving service can guarantee and how long its protection lasts.
keyTakeaways:
  - Create an operation key for the intended business action, not for each call attempt.
  - Store the action and its state in durable storage before making an external call.
  - A timeout requires an outcome check when the receiving service cannot safely deduplicate a retry.
  - Test concurrent workers, lost replies, and expired protection before allowing retries in production.
faq:
  - q: Can an AI agent retry a timed-out action safely?
    a: It can retry safely when the receiving service honors the same operation key for that request and the protection still applies. Otherwise, check the outcome first and hold the action if the result remains uncertain.
  - q: Does a queue prevent an agent from sending duplicate actions?
    a: A queue can deliver a message again, so the worker still needs a durable operation record and a safe way to handle repeated delivery. An external action also needs protection at the receiving service or an outcome check.
  - q: Should a changed request reuse the same operation key?
    a: No. Reject a retry if its action details differ from the stored request. If the change is intentional, approve it as a new action and give it a new key.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
  - evals-in-ci
sources:
  - title: Making retries safe with idempotent APIs
    url: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
    publisher: Amazon Web Services
    retrieved: '2026-11-10'
  - title: Idempotent requests
    url: https://docs.stripe.com/api/idempotent_requests
    publisher: Stripe
    retrieved: '2026-11-10'
  - title: At-least-once delivery
    url: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html
    publisher: Amazon Web Services
    retrieved: '2026-11-10'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Where can a retry cause a duplicate action?

To decide how to prevent duplicate AI agent actions on retries, start where an effect becomes real. A customer message may be sent, a refund issued, or a record changed. The agent can lose the reply after the receiving service has already done the work. A timeout tells the caller that it lacks an answer, not that the action failed.

The same problem can occur when a worker crashes after sending a request. A queue may deliver the task again, or a person may restart a failed workflow. Another agent run might reach the same business decision and submit it as fresh work. Each path needs a way to identify the intended action across attempts.

Draw the boundary around the actual effect, not just the model response. A repeated draft may be harmless, while a repeated payment may cost money. List each tool that can change data or contact someone. For each tool, write down who receives the request and how to find proof of the result.

## What should an operation key identify?

Assign a stable key when the system accepts an intended business action. Keep it through queue delivery, worker restarts, and calls to the receiving service. The key should identify the action the user approved, rather than the process that happens to execute it. Generating a new key inside each retry defeats the protection.

A refund request, for example, needs a key tied to that particular approved refund. A later, separately approved refund needs a different key, even if the customer and amount match. Avoid deriving the key from the customer alone, since that could suppress a valid later action. A unique key created at approval can distinguish those cases.

Store the approved request beside the key, including the target and the material details. When a retry arrives, compare those details with the stored request. Reject a mismatch and ask for a new approval if the action has changed. Scope keys to the right account or tenant so one customer's request cannot collide with another's.

The [AWS guidance on safe retries](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) discusses caller-provided request identifiers and the risk of treating similar requests as the same intent. Use that distinction when choosing where the key is created.

## What record should survive a worker restart?

Keep a durable action record outside the agent's memory. It should hold the operation key, approved request, current state, attempt history, and any receipt from the receiving service. Record who approved the action when approval is part of the workflow. A worker that restarts can then read the record before deciding what to do.

The state should distinguish work that has not been sent from work whose outcome is unknown. It should also distinguish a confirmed result from a request that was rejected. The table gives a practical starting point for those states.

| State           | What the worker should do                                     |
| --------------- | ------------------------------------------------------------- |
| Ready           | Claim the action before attempting the call.                  |
| Sending         | Keep other workers from sending the same action concurrently. |
| Outcome unknown | Check the receiving service or use a protected retry.         |
| Confirmed       | Return the stored result without sending again.               |
| Rejected        | Record the reason and require a deliberate next step.         |

A lock or claim needs an expiry so abandoned work can be recovered. Expiry alone must not authorize another external call. The new worker still has to resolve any earlier call that may have reached the receiver.

## How do concurrent workers avoid sending twice?

Make the claim on an action an atomic change in the durable store. That means the store accepts the claim as a single change, rather than letting workers separately read and update the same record. Enforce uniqueness for the operation key within its intended scope. Only the worker that wins the claim may start the send path.

A worker can pause after claiming the action while another takes over an expired claim. The first worker might then resume and send a request anyway. Use a claim version to stop stale workers from updating local state, and check ownership immediately before sending. That check narrows the race but cannot by itself prevent a stale worker from reaching an outside service.

For the external effect, send the same operation key to a receiver that supports duplicate protection. If the receiver lacks that protection, a local lock cannot close the gap between checking the claim and making the call. Hold uncertain cases for a check instead of treating claim expiry as proof of failure.

## What if the service accepts the request but the reply is lost?

Treat a lost reply as an unknown outcome, not as a rejection. First look for a receipt or a status record using the operation key or a receiver-issued reference. Make sure the lookup covers the account and action being checked. A result that matches the approved request can move the local record to confirmed.

A missing result is harder to interpret. The receiver may take time to make a new action visible, or its search may not cover every action. Only treat absence as proof of failure when the service's documented lookup makes that conclusion safe. Otherwise, retain the unknown state and ask an owner to resolve it.

Some services accept an operation key and use it to recognize a repeated request. Check the service's rules for matching request details, returned errors, and the period when the key remains valid. [Stripe's documentation on idempotent requests](https://docs.stripe.com/api/idempotent_requests) describes these rules for its API. Do not assume another provider behaves the same way.

Once a provider's protection has expired, reusing the old key may create a fresh effect. Reconcile the earlier attempt before any new send, including a send initiated by a person.

## Can a queue or local transaction solve the whole problem?

A queue helps carry work between parts of a system, but delivery alone does not prove an action happened once. The worker must handle a message that arrives again after a crash or a lost acknowledgement. The [Amazon SQS guide on repeated delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) gives an example of a queue where consumers need to account for that case.

Use a local database transaction to save the approved action and a pending delivery record together. A transaction is a group of local changes that commit together or do not commit at all. A separate worker can then send the pending record and update its state. This avoids losing the intent when the process stops between saving the action and scheduling the work.

The local transaction does not include a remote provider unless both systems share a suitable transaction mechanism. A crash after the provider acts can still leave the local record uncertain. The worker therefore needs the same key, receiver protection, or outcome check described for a direct call.

## What should happen when a retry stays uncertain?

Give each action a clear owner and a path for review. Show that person the approved request, prior attempts, last known state, and any receipt or lookup result. The reviewer needs enough context to distinguish a missing effect from an effect that is merely hard to find. Restrict who can send again or approve a replacement action.

A review screen should not offer a generic retry button without explaining the risk. If a receiver has no reliable lookup and no duplicate protection, a fresh send may cause another effect. The owner may need to contact the recipient or check a separate business record. Record the decision and its evidence alongside the action.

For reversible changes, define a separate recovery action and approve it on its own terms. Reversing a record does not necessarily undo an email or recover a payment. The [agent rollback guide](/blog/how-to-roll-back-an-ai-agent-deployment) covers the wider deployment response, while this record tracks the fate of each affected action.

## How should teams test the retry path?

Test with a controllable receiver that can accept a request and then drop the reply. Restart the worker before it records the result, and verify that the next attempt keeps the same key. Check the receiver's effect count as well as the local state. A successful response in the application does not prove that the recipient saw only the intended effect.

Run competing workers against the same action and pause one after it claims the work. Let the claim expire, resume the paused worker, and inspect what each worker sends. Test a changed request with an existing key and confirm that the system rejects it. Also test a valid new action that resembles an earlier one.

Exercise a receiver whose duplicate protection has expired and a lookup that returns no conclusive result. Both cases should reach review rather than a blind send. Add these cases to the checks described in [agent evals in CI](/blog/evals-in-ci-for-llm-agents), and keep the fake receiver's behavior distinct from the real provider's documented guarantees.

## What evidence should operators keep?

Record the operation key and state changes in traces without placing sensitive request details in every log. Keep the approved payload and receipts in a protected store with access limited to people who need them. Link attempts to the same action so an operator can follow the path across worker restarts. The [tool-call tracing guide](/blog/how-to-trace-ai-agent-tool-calls-in-production) covers how to connect those events.

Set retention for action records around the period when retries, disputes, and manual checks can occur. Compare that period with the receiver's key retention before enabling automatic retries. If the local record expires too early, a later delivery can look like new work. If the receiver forgets first, a retained local key alone cannot prevent a second external effect.

Review unknown outcomes and repeated delivery as operational signals. A rising backlog can point to provider failures, missing receipts, or a lookup that cannot settle cases. Assign someone to inspect the backlog and resolve individual actions before clearing their records.
