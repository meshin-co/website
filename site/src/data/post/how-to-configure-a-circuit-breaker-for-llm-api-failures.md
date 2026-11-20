---
title: How to configure a circuit breaker for LLM API failures
description: How to configure a circuit breaker for LLM API failures, from failure rules and recovery probes to safe fallbacks.
publishDate: 2026-11-20
updatedDate: 2026-11-20
shortAnswer: 'How to configure a circuit breaker for LLM API failures: count transient provider failures and open the circuit at a tested threshold. Allow a controlled probe after a cooldown. Set deadlines and retry limits separately, choose a safe fallback, and test recovery under load before enabling the breaker.'
fullAnswer: 'How to configure a circuit breaker for LLM API failures: set a failure threshold, a cooldown and a recovery probe for each provider route. Count timeouts and transient provider errors, but handle bad requests and credential faults outside the breaker. Base thresholds on load tests and the time your users can wait. When the circuit opens, stop sending calls to the failing route and return a safe fallback or queue work within its deadline. Limit probes during recovery so a burst of traffic cannot overwhelm the provider as service returns. Keep retries within the same deadline and count actual provider attempts, not just final task outcomes. Record state changes and give an operator a way to inspect them. Test low traffic, streaming failures and shared state across replicas before rollout. A breaker protects a failing dependency, but it cannot make an unsafe fallback acceptable.'
keyTakeaways:
  - Count transient provider failures separately from request and credential errors.
  - Set the opening threshold and cooldown from load tests and user deadlines.
  - Limit recovery probes and keep retries within the task deadline.
  - Test the fallback and shared breaker state before rollout.
faq:
  - q: Should rate limits open the circuit breaker?
    a: It depends on their scope. A provider-wide capacity limit may justify opening a route breaker. A limit tied to one tenant or credential should usually affect only that scope, so other traffic can continue.
  - q: Can a circuit breaker replace retries?
    a: No. A retry handles a transient failure within a bounded request, while a breaker stops calls to a route that appears unhealthy. Keep both within the task deadline and avoid retrying through an open circuit.
  - q: What should users see when the circuit is open?
    a: Return a clear unavailable status or use a fallback that has been approved for the task. Do not present stale, partial or substitute output as a normal model response.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
sources:
  - title: Circuit Breaker pattern
    url: https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker
    publisher: Microsoft
    retrieved: '2026-11-20'
  - title: Timeouts, retries and backoff with jitter
    url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
    publisher: Amazon Web Services
    retrieved: '2026-11-20'
  - title: Handling Overload
    url: https://sre.google/sre-book/handling-overload/
    publisher: Google
    retrieved: '2026-11-20'
author: dmitri
relatedResources:
  - llm-gateway-governance-config
---

## Where should the breaker sit?

To decide how to configure a circuit breaker for LLM API failures, place it around the outbound provider call. Place it where every caller of that route must pass through the same policy. A shared [LLM gateway](/glossary/llm-gateway) can be a useful enforcement point when it owns the provider calls.

Choose the scope before choosing a threshold. A route can include the provider, endpoint, model and region. If those paths can fail independently, give them separate breaker state. Otherwise, a fault on one path can stop work that could still succeed elsewhere.

Also check which credentials and quotas the route shares. A limit tied to a tenant should not automatically block every tenant. A provider-wide outage, by contrast, may need a broader response. Record the chosen scope beside the route configuration so operators can explain which calls a state change will affect.

The breaker should reject calls before they consume retry budget at the provider. Calls already in flight need their own deadline and cancellation handling. Opening the circuit does not prove those calls have stopped, so their results and side effects still need normal handling. The [Microsoft circuit breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) describes the state-based approach behind this placement.

## Which failures should count?

Count failures that suggest the route may be temporarily unable to serve calls. These can include connection failures, provider timeouts and transient server errors. Check the provider's error details before adding a response to the list. A status alone may not tell you whether the fault belongs to the route or to a single request.

Keep malformed requests, unsupported parameters and credential faults out of the route failure count. Reject or repair those requests and alert the owner when credentials need attention. Opening a shared breaker for them could hide the fault while blocking unrelated callers.

Treat rate limits according to their scope. If a shared provider capacity limit affects the whole route, it may be reasonable to count it. If a limit applies to a tenant, key or model quota, isolate that scope or apply a separate rate policy. Follow any provider guidance on when to try again, subject to the task deadline.

For streaming calls, define success before rollout. A connection that opens but fails before the required response arrives should not automatically count as a healthy call. Decide how to record partial output and whether it can be shown, saved or discarded. Never turn a partial stream into an apparent complete answer without an explicit product rule.

## How do you choose the settings?

Start with a deadline for the user task, then measure provider latency and failure patterns under representative load. Set the provider timeout inside that task deadline, leaving time for any permitted retry and the fallback. Choose an opening threshold that reacts to sustained failure without opening on an isolated fault.

Use the table as a configuration review before setting values in your gateway. The values depend on the route and workload, so validate them against traces and load tests rather than copying a preset.

| Setting              | Decision to record                                       |
| -------------------- | -------------------------------------------------------- |
| Failure rule         | Which provider errors and timeouts count toward opening  |
| Sample and threshold | How much recent traffic to consider and when to open     |
| Low-traffic rule     | How to detect repeated faults when few calls arrive      |
| Cooldown             | How long to wait before allowing a probe                 |
| Probe policy         | How many test calls may enter and what counts as success |
| Deadline and retries | How long a task may wait and which attempts it permits   |
| Fallback             | What callers receive while the route is unavailable      |

For a low-volume route, a rate based on a large sample may react too late. A consecutive-failure rule can be easier to reason about, though it may open after a short cluster of faults. Test that trade-off with actual traffic patterns. Document who can change the settings and how the team will review an opening that proves too sensitive.

## How should retries interact with the breaker?

Put the retry policy and breaker in a clear order. Each outbound attempt should ask the breaker for permission and report its own outcome. A retry must stop when the circuit opens or when the remaining task deadline cannot support another attempt.

Avoid counting the same provider failure at several layers. If the gateway retries internally, an outer application should not count its final error as another provider attempt. Trace both the task result and the individual calls so the team can see whether retries are masking an unhealthy route.

Use backoff with jitter for permitted retries. Jitter spreads retry attempts over time rather than making callers return in the same burst. The [AWS Builders' Library discussion of timeouts, retries and backoff](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) explains why retry traffic needs limits during failures.

Do not retry a tool action merely because a model call failed afterward. The tool may already have changed an external system. Preserve the action result and use the safeguards in [preventing duplicate agent actions on retries](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries). If the outcome of an action is unknown, resolve that uncertainty before sending it again.

## What happens while the circuit is open?

When the circuit opens, reject new calls to that route without contacting the provider. Return a distinct error that the application can handle. Do not disguise the rejection as a model answer, and do not allow another retry layer to keep calling the same open route.

Choose the fallback by task. A support drafting workflow might send the case to a person instead. A background job might wait in a queue if its data and deadline permit it. A user-facing task might need an unavailable message and a way to try again later.

An alternate model or provider is a separate product and risk decision. Check data handling, tool access, output quality and cost before routing work there. A fallback that sends sensitive input to an unapproved destination can create a larger incident than the original outage. Mark substitute output so the application can apply the right review rules.

Set a limit on queued work and define what happens when it expires. Otherwise, a recovered provider can receive a surge of stale requests. The [Google SRE guidance on handling overload](https://sre.google/sre-book/handling-overload/) gives useful context for controlling work during a capacity problem. Test the fallback itself, including the case where it is unavailable.

## How do you let the route recover?

After the cooldown, allow a controlled probe rather than releasing the full backlog. The probe should exercise the affected route and use a request that is safe to repeat. If it succeeds under the defined success rule, close the circuit and resume traffic gradually. If it fails, reopen the circuit and wait before the next probe.

Decide whether the probe is a real waiting task or a synthetic request. A real task tests the path users need, but its data and side effects require care. A synthetic request is easier to control, though it may miss failures tied to request size or a particular model feature. In either case, bound its timeout and record its result.

Multiple application replicas can each hold a local breaker, or they can share state. Local state is simpler but can allow several probes at once. Shared state needs atomic transitions, a probe lease and a plan for lease expiry if the holder crashes. Decide what callers do if the state store itself fails.

Do not close a circuit solely because an operator sees a quiet error chart. Rejected calls may have stopped the chart from receiving new provider failures. Use probe results alongside provider health and application traces before restoring normal traffic.

## How do you test and operate the policy?

Exercise the breaker before relying on it in production. Inject timeouts and transient errors into a test route, then check that calls stop at the configured threshold. Verify that excluded errors reach the right owner without opening the shared route. Repeat with sparse traffic, concurrent callers and a failed recovery probe.

Test the full user path while the circuit is open. Confirm that the fallback respects the deadline, labels partial output and does not trigger hidden retries. For queued jobs, check expiry and the release rate after recovery. Use the approach in [load testing an AI agent](/blog/how-to-load-test-an-ai-agent-before-launch) to include realistic concurrency and task mixes.

Record the route scope, state changes, eligible failure counts, rejected calls, probe outcomes and time spent open. Link those events to request traces without logging sensitive prompts by default. The article on [tracing agent tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) covers the wider trace around a model request.

Give an owner permission to inspect and change the policy, with an audit trail for overrides. An override should have a clear expiry or review point. Revisit thresholds after changes to traffic, provider routing or task deadlines, and replay failure tests before accepting the new policy.
