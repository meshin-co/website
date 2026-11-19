---
title: How to require approval for AI agent payments
description: See how to require approval for AI agent payments with a human review gate before money is sent.
publishDate: 2026-11-19
updatedDate: 2026-11-19
shortAnswer: Require a human to approve the exact payment before a separate service can send it. Keep payment credentials away from the agent, bind approval to the recipient and amount, and check it again at execution. If details change or approval expires, stop and request a fresh review.
fullAnswer: An AI agent can prepare a payment, but a separate payment service should control whether it is sent. That service presents a fixed payment request to an authorized reviewer and checks the decision before calling the payment provider. The reviewer needs enough context to verify the recipient, amount, currency, funding account and business reason. Approval must apply to those exact details, not to a chat message or a broad instruction from the agent. The service should reject changed requests, expired decisions and attempts to use the same approval for another payment. It should also record what happened and reconcile uncertain provider responses before trying again. This design still needs sound access controls around the payment service and the review interface. A person who can approve a payment should not be able to bypass the checks by changing its details after review. Test the whole path, including failures, before allowing real transfers.
keyTakeaways:
  - Place payment credentials and the final send action outside the agent's reach.
  - Bind each approval to a fixed request and check it at the payment boundary.
  - Treat uncertain payment outcomes as a reconciliation task, not permission to send again.
faq:
  - q: Can an agent prepare a payment without sending it?
    a: Yes. Let the agent draft a request with payment details and supporting context. A separate service should hold the credentials and send the payment only after an authorized reviewer approves the fixed request.
  - q: What happens if the amount or recipient changes after approval?
    a: The payment service should reject the old approval and create a new request for review. The reviewer must see the changed details before the service sends money.
  - q: Can a spending limit replace human approval?
    a: A spending limit can reduce exposure, but it does not establish that a recipient or payment is legitimate. Use it alongside approval when the payment policy requires a person to review the transaction.
category: agentic-architecture
tags:
  - agentic-architecture
  - policy-enforcement
  - security-review
sources:
  - title: Idempotent requests
    url: https://docs.stripe.com/api/idempotent_requests
    publisher: Stripe
    retrieved: '2026-11-19'
  - title: Security best practices in IAM
    url: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
    publisher: Amazon Web Services
    retrieved: '2026-11-19'
  - title: Prompt Injection
    url: https://owasp.org/www-community/attacks/PromptInjection
    publisher: OWASP
    retrieved: '2026-11-19'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Where should the approval gate sit?

To decide how to require approval for AI agent payments, start at the bank-facing payment tool. The agent may gather an invoice and propose a transfer, but it should not hold the credentials needed to send money. Put those credentials in a separate payment service that enforces the approval rule. The service, rather than the model, decides whether a request is eligible to execute.

A prompt that tells the agent to ask permission is useful for the conversation, but it cannot enforce the payment boundary. The agent might receive conflicting instructions or call an unexpected tool. A user might also reach a payment endpoint through another path. Check every path that can create, change or release a payment, including admin tools and provider dashboards.

The payment service should reject a send request when it cannot check approval. A timeout, missing reviewer record or unavailable policy store must leave the payment unsent. Design a separate emergency process for operators, with its own access controls and audit trail. Do not turn an outage into a quiet bypass.

## What should the reviewer approve?

Create a fixed payment request before asking for a decision. Show the reviewer the recipient, destination account, amount, currency, funding account and payment purpose. Include the invoice or other evidence used to prepare the request. The reviewer needs a link to the source record, not just a summary written by the agent.

Bind the decision to the exact request held by the payment service. Store a version or digest of its payment fields with the approval. At execution, compare the stored version with the request being sent. If any payment field differs, reject the decision and ask for a new review.

| Item                 | What the reviewer needs to check                                      |
| -------------------- | --------------------------------------------------------------------- |
| Recipient            | The named payee matches the business record.                          |
| Destination          | The account matches a trusted record or a separately verified change. |
| Amount and currency  | The total matches the invoice and agreed terms.                       |
| Funding account      | The selected account is allowed for the payment.                      |
| Purpose and evidence | The payment has a valid reason and supporting record.                 |

A familiar supplier name is not proof that a new bank account is genuine. Give reviewers a safe way to verify changed details outside the message that requested the change. Show enough of the destination to distinguish accounts, while restricting access to sensitive details.

## Who can approve a payment?

Set reviewer permissions outside the agent's conversation. The payment service should look up whether the signed-in person can approve that kind of payment, from that funding account, under the current policy. Authentication establishes who is making the decision. The authorization check establishes whether that person may approve this request.

Keep request preparation separate from approval when your policy calls for separation of duties. An agent acting for a requester should not be able to select its own reviewer or approve on that person's behalf. If a payment needs several reviewers, record each decision and check the required set before execution. Make delegation explicit, time-bound and subject to the same checks.

Reviewers also need a meaningful choice. Show the evidence and the exact payment details before they approve or reject. A notification can carry a link to the review screen, but the approval action should take place in the authenticated service. Avoid accepting a free-form chat reply as the sole proof of authorization.

Access to the service itself needs review as well. The [access-control guidance for cloud accounts](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html) is a useful starting point for limiting permissions and protecting credentials. Apply those principles to operators, service accounts and the agent's tool access.

## When does an approval stop being valid?

An approval should have an expiry set by the payment policy. The service should check that expiry when it is about to send the payment, rather than relying on the state shown when the reviewer clicked. It should also check whether the reviewer still has authority and whether the request remains eligible.

Any change to the payment fields should create a new version and invalidate the earlier decision. Treat changes to the payee account, currency or funding source as material, even if the total stays the same. Changes to supporting evidence may also need a new review under the firm's policy. Keep the old version and decision for the audit trail rather than editing them in place.

Provide a way to withdraw approval before execution. The send process must check the current decision at the payment boundary and prevent a withdrawn request from proceeding. Design the check and state transition together so concurrent workers cannot both claim the same approved request. Once a provider has accepted a payment, withdrawal becomes a separate cancellation or recovery process whose availability depends on that provider.

## How should the service handle retries?

A network failure can leave the service unsure whether the provider accepted a payment. Do not create a fresh payment merely because the agent did not receive a success message. Record the attempt and mark its result as uncertain until the service can check the provider's records.

Use a stable request key for retries when the provider supports that feature. The key should identify the payment attempt, stay the same across a retry and never be reused for a different request. The provider's [guidance on retry keys](https://docs.stripe.com/api/idempotent_requests) describes how its API handles repeated requests. Check the actual provider's scope, retention rules and failure behavior before relying on its implementation.

A retry key does not settle every uncertainty. If the provider cannot return a reliable status, pause the request and send it to an operator for reconciliation. The operator should compare the internal request, provider activity and bank records before deciding what happens next. The [guide to preventing duplicate agent actions](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) covers the wider retry design.

## How do you protect the reviewer from the agent's input?

Treat text supplied by the agent, a vendor or an invoice as evidence to inspect, not as instructions to the payment service. An invoice might contain a request to skip review or change the destination account. The service must apply its own policy regardless of that text. The [prompt injection guidance](https://owasp.org/www-community/attacks/PromptInjection) explains why instructions embedded in supplied content deserve scrutiny.

Keep payment fields separate from narrative text in the review screen. Fetch the approved vendor record from a trusted source and show any mismatch beside the proposed destination. Do not let an agent-generated summary hide a changed account or an unusual payment purpose. The reviewer should be able to open the underlying record without following a link supplied inside the invoice.

The agent should receive only the permissions it needs to prepare a request. It should not be able to edit vendor bank details, change approval policy or administer reviewer accounts. If the workflow includes those tasks, put them behind separate controls and review. A payment approval cannot make a compromised vendor record trustworthy.

## What should the audit trail and reconciliation show?

Record the request version, its evidence references, reviewer identity, decision and decision time. Keep the policy result and the identity of the service that sent the payment. Record the provider reference and final status when available. Store enough detail to reconstruct what the reviewer saw and what the provider received.

Protect the record from edits by the agent and ordinary requesters. Limit access to account details and avoid putting secrets in application logs. An audit record should point to controlled evidence rather than copy sensitive documents into every event. Give an operator a way to link later corrections or recovery actions without overwriting the original history.

Reconcile approved requests against provider and bank records. Investigate payments with no matching approval, approvals with no matching payment and requests stuck in an uncertain state. Assign an owner for each exception and record the resolution. The [guide to tracing agent tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) can help connect the payment record to the agent's activity, while the payment service remains the source of the approval decision.

## How do you test the gate before sending real money?

Start with a test provider or a controlled environment that cannot move real funds. Exercise the full path from the agent's draft to the payment service, reviewer screen and provider call. Check that the service refuses a direct send without approval, even when the agent claims that approval exists. Test every alternate tool and operator path that can reach the same funding account.

Then try changes after review: alter the amount, recipient, currency and funding account in separate tests. The old decision should fail for each changed request. Test an expired approval, a removed reviewer, a withdrawn decision and an unavailable policy store. Run concurrent send attempts and confirm that the service does not create duplicate transfers.

Add cases for misleading invoice text and a changed vendor account. Test provider timeouts both before and after acceptance, using the provider's test behavior where available. Confirm that uncertain results go to reconciliation instead of a new send. The [agent evaluation starter](/resources/agent-evals-ci-starter) can help keep these cases in the release process.

Before launch, have the payment owner review the evidence and the exception process. Set a task-level budget as a further constraint, using the [spending limit guide](/blog/how-to-set-a-per-task-spending-limit-for-an-ai-agent). If a test exposes a bypass, close the payment path until the control and its test both work.
