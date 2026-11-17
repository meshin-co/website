---
title: How to set a per-task spending limit for an AI agent
description: Set and enforce an AI agent's task budget with cost reservations, shared limits, clear failure rules, and reconciliation.
publishDate: 2026-11-15
updatedDate: 2026-11-15
shortAnswer: Set a per-task spending limit for an AI agent by reserving the worst-case cost before each paid action. Keep the reservation and task balance in a shared ledger, reject actions that exceed the remaining budget, and reconcile actual charges afterward. Include retries, parallel work, and paid tools in the same limit.
fullAnswer: To decide how to set a per-task spending limit for an AI agent, start with a cap on the whole task. Give each task a durable budget record that every model call and paid tool must check. Before a call starts, reserve enough to cover its maximum permitted charge. Reject the call if the remaining balance cannot cover that reservation. Afterward, replace the reservation with the actual charge when reliable usage data arrives. A shared ledger matters when an agent retries work or runs several steps at once. Each step must draw from the same balance, rather than keeping its own copy. Set a clear rule for unknown prices and uncertain outcomes. If a tool can charge more than its reservation, the task cap cannot be a hard guarantee. Test the boundary before release, then compare the ledger with provider bills to find charges the controls missed.
keyTakeaways:
  - Reserve the maximum permitted cost before a paid action starts.
  - Make parallel steps and retries draw from the same task balance.
  - Keep uncertain charges reserved until their outcome can be established.
  - A hard cap requires enforceable limits on every included cost.
faq:
  - q: Can I enforce a task budget with a prompt?
    a: A prompt can tell an agent to spend less, but enforcement belongs outside the model. A service that controls paid calls should check and reserve the budget before it sends each request.
  - q: What happens when a task reaches its spending limit?
    a: Reject further paid actions and return a clear budget-exhausted result. Preserve work already completed, and route any request for more funds through an approved budget change.
  - q: Does a per-task cap cover an external tool's charges?
    a: It covers those charges only if the tool's price and maximum possible charge can be bounded and enforced. Otherwise, exclude the tool from a hard-cap claim or put it behind a control that can enforce the bound.
category: agentic-architecture
tags:
  - agentic-architecture
  - policy-enforcement
  - production-readiness
sources:
  - title: Production best practices
    url: https://platform.openai.com/docs/guides/production-best-practices
    publisher: OpenAI
    retrieved: '2026-11-15'
  - title: Idempotent requests
    url: https://docs.stripe.com/api/idempotent_requests
    publisher: Stripe
    retrieved: '2026-11-15'
  - title: Create, edit, or delete budgets and budget alerts
    url: https://cloud.google.com/billing/docs/how-to/budgets
    publisher: Google Cloud
    retrieved: '2026-11-15'
author: dmitri
relatedResources:
  - llm-gateway-governance-config
  - agent-evals-ci-starter
---

## Where should the task budget live?

Keep the budget in a service that controls access to paid calls. Do not rely on an instruction in the agent's prompt or a counter held in its memory. The agent may ask to run an action, but the service decides whether to authorize it. That boundary also makes the decision available to every worker handling the task.

Create the budget record when the task is accepted. Give it a stable task identifier, a currency, an approved cap, and an owner. Record the amount already settled and the amount still reserved for calls in flight. The available balance is the cap less both amounts. Store the price basis and the time it took effect, so later bills can be compared with the decision made at the time.

A task can contain several steps, handoffs, or delegated jobs. They should carry the same task identifier and charge the same record. A new worker must not receive a fresh allowance just because it starts with a clean context. The site's [agentic workflow glossary](/glossary/agentic-workflow) provides context for those handoffs.

Decide who can set or raise the cap. An application may select a cap within an approved range, while a larger change needs a named approver. Record changes as events rather than silently replacing the old value. That history helps explain why a task was allowed to continue.

## Which costs belong in the cap?

List each paid action the task can trigger before choosing an amount. Model input and output are common entries, but retrieval, search, storage, and outside services may also charge for work. Include retries and any charges caused by child jobs. If a cost sits outside the limit, name that exclusion in the task record and in the result shown to its owner.

For each action, find a price basis and an enforceable upper bound on use. Model calls need a bound on both the request and the permitted response. A tool may need a fixed quote or a provider-side ceiling. Count charges in a common currency and use a documented conversion rule where necessary. If tax, fees, or exchange movement sit outside the estimate, say so rather than calling the cap absolute.

| Cost item  | Before the action                                                 | After the action                                            |
| ---------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| Model call | Bound input and output, then reserve their estimated maximum cost | Settle from provider usage and the recorded price basis     |
| Paid tool  | Obtain a bounded quote or reject the action                       | Settle the confirmed charge and release any excess          |
| Retry      | Reserve against the original task                                 | Keep uncertain earlier charges until their outcome is known |

The [provider's production guidance](https://platform.openai.com/docs/guides/production-best-practices) is a useful starting point for planning model usage. Check the actual contract and price schedule for every service in the path. A budget service cannot promise a hard ceiling for an unbounded charge it does not control.

## How do you reserve money before a call?

Calculate the largest charge the requested action can create under its enforced limits. Include the full permitted response, not just the response length the agent usually needs. Add any applicable fee covered by the task budget. If the price or usage bound is missing, reject the action or route it to a separate approval path.

The budget service should compare that amount with the available balance and create a reservation in one atomic operation. Atomic means the balance check and reservation succeed together, even when workers make requests at the same time. A read followed by a separate write can let competing requests each see the same available funds.

Pass the reservation identifier to the component that sends the paid request. That component must confirm the reservation before sending. It must also prevent a caller from raising the response limit or changing the tool after approval. Otherwise, the actual request could cost more than the amount held for it.

For example, a research task might have enough balance for a short answer but not for a broad search. The service can reject the search while allowing a smaller request if its bound fits. The agent can then return partial work or ask for approval. It should not silently switch to a paid path outside the budget service.

## How do parallel steps share the limit?

Every worker needs access to the same authoritative balance, including workers created after the task begins. Give each proposed action its own reservation, but keep those reservations under the parent task. Child jobs can have smaller internal allowances if useful, yet their combined reservations must still fit the parent cap.

A shared database transaction or another consistent ledger can protect the check and reserve operation. Choose an approach that remains safe when workers race, restart, or lose contact with the service. If the ledger cannot confirm a reservation, stop the paid action. A local estimate may help an agent plan, but it cannot authorize spending.

Settle each reservation against the action that created it. Record who requested the action, which service received it, the quoted price basis, and its current state. Avoid recording sensitive prompt content unless it is needed and approved. The task identifier and action identifier should be enough to join budget events to operational traces.

Use [tool-call tracing](/blog/how-to-trace-ai-agent-tool-calls-in-production) to connect those events to the work performed. A trace helps investigate a discrepancy, but it should not become a second source of truth for the balance. The ledger must still reject a call when the trace service is unavailable.

## What should happen on a timeout or retry?

A timeout does not prove that a provider stopped work or charged nothing. Keep the original reservation until the outcome is confirmed or a defined reconciliation process resolves it. Starting a retry may require another reservation, because both attempts could incur a charge. If the remaining balance cannot cover that risk, return a pending or budget-exhausted result.

Use a stable action identifier for attempts that represent the same intended operation. Where a provider supports a retry key, pass it through according to that provider's rules. The [Stripe guide to idempotent requests](https://docs.stripe.com/api/idempotent_requests) illustrates how retry keys can prevent repeated operations. Support and billing behavior differ by service, so check the contract for each tool.

Keep the retry decision separate from the budget decision. A request may be safe to repeat but too costly to run again. It may also fit the remaining budget while risking a duplicate external action. The article on [preventing duplicate agent actions](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) covers that second concern.

Do not release an uncertain hold merely because a worker has died. Send it to a queue for status checks and settlement. Give an operator enough context to resolve a stuck case without granting the agent more money by default.

## When can a reservation be released?

After a call completes, obtain usage or a confirmed charge from the source named in the pricing agreement. Calculate the settled amount using the price basis attached to the reservation. Release the unused part only after that calculation succeeds. Keep the original estimate and final amount so a reviewer can see why they differ.

If the provider returns no usage, mark the action as unresolved rather than treating missing data as free work. A later usage report, invoice, or provider inquiry may resolve it. Define who reviews old holds and how to handle adjustments that arrive after the task appears complete. An operator should be able to see both the open hold and the reason it remains open.

Reconcile task records with provider billing at a regular cadence. Look for requests with no reservation, charges with no task identifier, and settled amounts that exceed their holds. Shared account fees may need a separate allocation rule rather than a guess attached to each call. The [cloud billing budget documentation](https://cloud.google.com/billing/docs/how-to/budgets) describes account-level budget tools that can support that broader review.

Account alerts do not replace the task ledger. A billing view can reveal a gap after work has run, while the reservation check must decide before the call. Keep both controls and assign an owner to each discrepancy.

## What should the agent return when funds run out?

Stop new paid calls and return a result that states what completed, what remains, and why the next action was blocked. Preserve useful intermediate work where the data policy permits it. A caller can then decide whether partial work has value or whether the task needs a higher approved cap.

Make the result distinct from a provider error. A budget refusal means the service deliberately withheld permission, while a timeout may leave a charge unresolved. Show the task owner the settled amount, outstanding holds, and remaining available balance. Do not present a pending hold as money that is definitely spent or definitely free.

If a higher cap is approved, update the same task record through an authorized path. Record the approver and reason, then let the agent request its next action again. Do not restart the task with a fresh identifier solely to bypass the original cap. A genuinely separate task needs a clear reason and its own owner.

A lower-cost path can be offered when it meets the original need. For example, the agent might answer from material already retrieved instead of buying another search. The user should see that the result is partial and know what work was left out.

## How can you test the cap before release?

Use a test provider with predictable charges and controllable failure modes. Exercise a call that fits, a call that does not, and a call whose maximum exactly matches the available balance. Check the ledger after each case, including the amount held and the amount settled. Test with the same budget service and request path used for real calls.

Run competing requests against a balance that cannot cover all of them. Verify that only reservations within the cap succeed, even when workers start together. Then interrupt a worker after the provider accepts a request but before the result returns. Confirm that the hold remains and that a retry needs its own valid authorization.

Test price changes, missing usage, currency conversion, and a tool that returns a charge above its quote. The last case should raise an incident and expose the gap in the cap, rather than hiding the excess. Also try a direct provider call that bypasses the budget service. Remove or restrict any credentials that make that path possible.

Add these cases to the [agent evals starter](/resources/agent-evals-ci-starter) and make the spending checks part of release review. After deployment, inspect denied calls and unresolved holds alongside bill reconciliation. Use those findings to fix the control path before raising task allowances.
