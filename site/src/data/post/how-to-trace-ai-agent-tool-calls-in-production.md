---
title: How to trace AI agent tool calls in production
description: Trace AI agent tool calls in production with linked spans, safe fields, retry handling and checks for missing evidence.
publishDate: 2026-11-09
updatedDate: 2026-11-09
shortAnswer: Trace AI agent tool calls in production by linking each tool attempt to its parent request and recording its outcome, timing and safe identifiers. Carry trace context across service boundaries, protect sensitive data, and test the resulting trace against real failures, retries and approval steps.
fullAnswer: |-
  A production trace should show how an agent request led to each tool call and what happened next. Start at the service that receives the request, then carry its trace context through the agent runtime and every tool boundary. Record each attempt separately, including rejected calls and retries. Capture enough detail to join the trace to service logs without storing raw prompts or tool payloads by default.

  A useful trace also makes gaps visible. An approval wait, a queued job or a call to an external service can break the chain unless the team plans for that boundary. Decide who may read trace data, how long it stays available and which events need a separate audit record. Then exercise the setup with a failed call and a retry. The result should let an engineer reconstruct the path without giving every reader access to customer data.
keyTakeaways:
  - Record each tool attempt with its parent request, outcome and safe identifiers.
  - Carry trace context across queues and service boundaries, and flag missing links.
  - Keep sensitive payloads out of trace fields unless an approved need justifies them.
  - Test tracing with denied calls, retries, delayed work and missing context.
faq:
  - q: Should we store every agent prompt in the trace?
    a: No. Start with identifiers, timing and outcomes. Capture prompt content only when there is a clear need, an approved access policy and a retention rule.
  - q: How do we trace a tool call that runs later in a queue?
    a: Carry trace context with the job when the queue supports it. Record the job identifier and link the worker's trace to the originating work. Test the path when context is missing or a job is delivered again.
  - q: Can a trace replace an audit record?
    a: A trace can help explain an event, but it may be sampled, deleted or unavailable. Keep required audit evidence in a record with its own access and retention rules.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
  - security-review
sources:
  - title: Traces
    url: https://opentelemetry.io/docs/concepts/signals/traces/
    publisher: OpenTelemetry
    retrieved: '2026-11-09'
  - title: Context propagation
    url: https://opentelemetry.io/docs/concepts/context-propagation/
    publisher: OpenTelemetry
    retrieved: '2026-11-09'
  - title: Handling sensitive data
    url: https://opentelemetry.io/docs/security/handling-sensitive-data/
    publisher: OpenTelemetry
    retrieved: '2026-11-09'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
  - llm-gateway-governance-config
---

## Where should the trace start?

Trace AI agent tool calls in production by linking every tool attempt to the request that caused it. Begin at the service that accepts the user request or scheduled job. Create a request span there, and carry its context into the agent runtime. Give each tool attempt its own span beneath the relevant agent step.

A span needs a clear start and end. For a tool call, start before the runtime sends the request and finish after it receives the outcome. Record the tool name, the attempt outcome and a safe identifier for the operation. Include the error class when the call fails, without copying the full error message by default.

A trace should show calls the runtime refused as well as calls it sent. A policy denial can otherwise look like an agent that stopped without explanation. Record the decision and its reason code at the boundary where the denial happens. Link the decision to the intended operation without storing the rejected payload.

The [OpenTelemetry trace documentation](https://opentelemetry.io/docs/concepts/signals/traces/) describes how spans form a trace. For the wider service design, see the site's [agent architecture article](/blog/multi-agent-reference-architecture-in-production).

## Which fields make a tool call useful to investigate?

Choose fields that let an engineer follow the path and identify the result. The table is a starting point for a tool span, not a demand to capture every field from the tool payload.

| Field                             | Investigation use                               |
| --------------------------------- | ----------------------------------------------- |
| Tool name and operation           | Shows which action the agent tried to run.      |
| Outcome and error class           | Separates success, failure, denial and timeout. |
| Attempt and operation identifiers | Connects retries to the same intended action.   |
| Trace and service identifiers     | Helps find related spans and service logs.      |
| Policy decision and reason code   | Shows why a call was allowed or stopped.        |

Add the version of the tool interface or agent release when it helps compare behavior after a change. Use a stable name for each operation so a dashboard does not split the same action across several labels. Keep free text out of labels used for grouping, since user input can create too many distinct values.

The operation identifier should be distinct from the trace identifier. A retry may belong to the same operation while producing a separate attempt span. Treat identifiers as potentially sensitive if they can be joined to a person or account. Apply the same access rules to related logs.

## How does context cross service and queue boundaries?

Pass trace context from the agent runtime to the service that executes the tool. Use the tracing library's propagation support at both ends, and check that any gateway preserves the context. The [OpenTelemetry context propagation guide](https://opentelemetry.io/docs/concepts/context-propagation/) covers propagation across process boundaries.

Queues need an explicit design because the worker may run after the request handler finishes. Put trace context in message metadata where the queue and its access rules allow it. At the worker, extract that context before recording the execution. Use a span link when a direct parent relationship would misrepresent the work, such as a batch that combines messages from different requests.

Record a safe job identifier on both sides of the queue. That identifier gives the team another way to investigate if context is missing. Do not silently attach unrelated work to a guessed parent. Mark the context gap and keep the worker's own trace so the execution remains visible.

External tools may not accept or return trace context. In that case, trace the outbound call locally and record a safe provider request identifier if one is available. Confirm that sharing any correlation field with the provider fits the data agreement.

## How should retries and side effects appear?

Give every attempt its own span, even when the runtime retries the same tool operation. Record the reason for the retry and link each attempt to the same operation identifier. A single span for the whole sequence can hide a timeout followed by a successful response.

For calls that change data or send messages, track whether the effect is known to have happened. A timeout can leave the outcome uncertain: the remote service may have acted before the response was lost. The trace should show that uncertainty rather than label the action as a clean failure.

Agree on an idempotency method with the tool owner before enabling automatic retries for a write. An idempotency key lets a receiving service recognize repeated requests for the same intended action. Record a safe reference to that key, not a secret or a customer payload. Check the tool's actual behavior before relying on the key to prevent duplicate effects.

When a human approves a proposed action, record the approval decision and link it to the operation. If execution happens later, preserve the link through the queue or job record. The trace should distinguish approval from completion of the action.

## What should stay out of a production trace?

Start with metadata and add content only for a documented investigation need. Raw prompts, retrieved passages, tool arguments and responses can contain customer data or secrets. A trace store may have a wider audience than the system that holds the original content.

Classify each proposed field before adding it to instrumentation. Decide who needs access, how long the field must remain available and whether it can be removed at collection. The site's [data classification glossary](/glossary/data-classification) is a starting point for that review. The [OpenTelemetry sensitive data guidance](https://opentelemetry.io/docs/security/handling-sensitive-data/) describes ways to reduce sensitive data in telemetry.

Filtering at the source reduces the chance that unwanted content reaches a collector or vendor. Review error paths too, because exception messages can contain request bodies or credentials. Test the filters with representative synthetic data, then inspect the trace store and linked logs.

A hash or masked value still needs review if it can be linked back to a person. Restrict access to traces by role and record who can change collection settings. Set a deletion path that covers copies sent to external systems as well as the primary store.

## How can a team find missing traces?

Make trace coverage a visible part of the service checks. Send a known test request through the agent and confirm that the expected tool attempt appears under the request. Run the same check through the deployed gateway and worker path, not just a local test.

Compare counts of tool attempts from the runtime with counts reaching the trace backend. A gap can point to dropped context, exporter trouble or a collection rule. Account for deliberate sampling before treating the difference as a fault. Keep the underlying counts free of customer content.

Sampling can reduce storage, but it means a particular request may have no complete trace. Decide which failures or high-risk actions need stronger capture, and verify that the chosen setup can keep them. Do not promise a complete investigation record from a sampled trace stream.

When the trace backend is unavailable, the tool boundary still needs a defined response. Choose whether the action can proceed, must wait or must be denied. Base that choice on the effect of the action and the separate evidence available. Alert the service owner when the chosen path is used.

## Which records need to survive beyond a trace?

Keep a separate audit record when an action needs durable evidence of a decision or change. A trace can point to that record, while the record keeps its own access and retention rules. This matters when traces are sampled, deleted on a shorter schedule or stored with a third party.

For a consequential tool action, the record can identify the actor or service, the intended operation, the decision and the known result. Include a safe link back to the trace when one exists. Record corrections as later events so an uncertain result can be resolved without erasing the earlier state.

Assign an owner for the tool and another contact for the trace pipeline if those duties sit with different teams. Agree who investigates a missing action record and who can approve changes to captured fields. The [system register guide](/blog/how-to-build-an-ai-system-register-in-a-week) can help place those responsibilities alongside the system record.

Review access to the audit record separately from access to traces. An engineer may need timing and error details without needing the full business record. A reviewer may need the decision history without access to runtime diagnostics.

## How do you test the tracing setup before release?

Build a test path that calls a harmless tool with synthetic inputs. Check the request span, tool span, outcome and service link in the trace backend. Then force a timeout and a retry, and confirm that each attempt has a distinct span tied to the same operation.

Test a denied call and a delayed queue job as well. Inspect the result when propagation metadata is removed, and confirm that the gap is visible without inventing a parent. For a write-capable tool, test an uncertain response and verify how the service records the final state.

Add checks for secret leakage in error messages and tool fields. Inspect both trace data and the logs reached through its identifiers. Repeat the checks after changes to the agent runtime, gateway or tool client, since any of those can break the chain.

The [agent evaluation starter](/resources/agent-evals-ci-starter) provides a place to connect these checks to release work. Keep a short runbook with the trace query, the service owner and the fallback record to inspect. Use it during a practice incident before relying on it for a live failure.
