---
title: How to load test an AI agent before launch
description: Load test an AI agent with realistic tasks, controlled demand, safe tool calls, and clear launch limits.
publishDate: 2026-11-17
updatedDate: 2026-11-17
shortAnswer: Load test an AI agent before launch by replaying realistic tasks at controlled arrival rates in a safe environment. Measure completed work, response times, errors, side effects, and cost together. Increase demand, introduce dependency failures, and launch only within a tested range that meets agreed limits.
fullAnswer: |-
  Deciding how to load test an AI agent before launch starts with realistic tasks, controlled demand, and checks on outcomes, delay, safety, and cost. Exercise the whole path from request to final action, rather than testing the model endpoint alone. Use a mix of short and long tasks, including work that calls tools or waits for approval.

  Run the test in an environment that protects real accounts and data. Record the demand offered, the work accepted, and the work that reaches a useful end state. Then raise demand in stages and test what happens when a dependency slows down or refuses requests. A fast response is not a pass if the agent gives a bad answer, repeats an action, or leaves work stranded. Set limits and an owner before the run, keep the results by test version, and use the findings to set a launch range and a stop plan.
keyTakeaways:
  - Test complete tasks at controlled arrival rates, including slow and tool-heavy paths.
  - Count useful completed work alongside latency, errors, side effects, and cost.
  - Use safe test data and isolated tools, while noting where substitutes hide real limits.
  - Set launch limits and a stop plan before applying load.
faq:
  - q: Can I load test an agent using only model requests?
    a: Model requests can reveal an endpoint limit, but they leave out the queue, tools, action checks, and final task result. Test those parts together before using the result to set a launch range.
  - q: Should a load test use real customer data?
    a: Use synthetic or approved test data where possible. If real data is necessary, get the right approvals and restrict access, storage, and retention before the run.
  - q: What if the agent stays fast but its answers get worse?
    a: Treat the run as a failure if answer quality falls below the agreed limit. Inspect the affected traces and task types before repeating the test.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
sources:
  - title: API load testing
    url: https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/
    publisher: Grafana Labs
    retrieved: '2026-11-17'
  - title: Timeouts, retries, and backoff with jitter
    url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
    publisher: Amazon Web Services
    retrieved: '2026-11-17'
  - title: Handling Overload
    url: https://sre.google/sre-book/handling-overload/
    publisher: Google
    retrieved: '2026-11-17'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Which tasks should the load test include?

Start with the work people will actually send to the agent. Build a task set from approved examples or synthetic cases that reflect the expected mix. Include short requests, long inputs, tool-heavy jobs, and requests that need a human decision. Keep the expected result or acceptance check beside each case.

Record the assumptions behind the mix. A support agent may face a burst after an outage, while an internal research agent may see demand during a team deadline. If launch demand is uncertain, test more than one plausible mix and state which range each result covers.

Use different input records across requests so the test does not merely exercise a warm cache. Keep a smaller repeatable set for comparing changes between runs. Reserve cases that the team has not used to tune the agent for the final quality check. For the workflow around those checks, see [evals in CI for LLM agents](/blog/evals-in-ci-for-llm-agents).

## Where can you run the test safely?

Use a test environment that resembles the launch path in the components that can limit capacity. Include the gateway, queue, worker pool, model access, storage, and tool connections where they matter. Record any differences in worker settings, provider limits, or data size before comparing results with launch expectations.

Replace tools that send messages, move money, or change customer records with isolated test endpoints. The test endpoint should record attempted actions and return realistic responses. Where a substitute responds faster or fails less often than the real service, treat the measured capacity as an estimate rather than proof.

Synthetic accounts and data reduce the chance of exposing customer information. If the team must use approved real data, restrict who can view traces and decide when to delete them. Agree on a spend cap and coordinate the run with service owners. Make sure the load generator cannot reach live action endpoints by mistake.

## How should you apply demand?

Set an arrival pattern before starting the run. Begin with a modest rate, hold it long enough to observe tasks finishing, and raise it in stages. Include a burst and a sustained period at the intended launch rate. After the peak, reduce demand and watch whether the queue drains and normal service returns.

An arrival-rate test schedules new tasks regardless of whether earlier tasks have finished. It can show how a queue grows when demand exceeds completion capacity. A fixed group of simulated users gives a different view: those users wait for results before sending more work, so offered demand can fall as responses slow.

Choose the pattern that matches the expected traffic, or run both and label them clearly. Measure the rate the generator intended to send and the rate it actually sent. If the generator itself runs out of capacity, fix that limit before drawing conclusions about the agent. The [API load testing guide](https://grafana.com/docs/k6/latest/testing-guides/api-load-testing/) describes ways to plan and run load against an API.

## What should you measure during the run?

Follow each task from submission to a terminal state. Count attempted, accepted, rejected, completed, failed, and still-pending tasks. A request that receives an early acknowledgement has not necessarily produced a useful result. Track queue wait separately from execution time, then measure end-to-end delay from submission to completion.

Choose a response-time percentile and an acceptable limit before the test. Report the slow tail as well as the typical result, and include failed or timed-out work in the outcome counts. A latency chart for successful requests alone can hide tasks that never finished.

| Measure            | What to inspect                                             |
| ------------------ | ----------------------------------------------------------- |
| Demand             | Scheduled arrivals, actual submissions, and rejected work   |
| Progress           | Queue age, active work, completed tasks, and stranded tasks |
| Quality and safety | Accepted outcomes, unsafe attempts, and repeated actions    |
| Resources          | Model use, tool calls, worker use, and total test spend     |

Use a shared task identifier to join events across components. The approach to [tracing agent tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) can help the team find where a slow or failed task spent its time.

## What happens when a dependency slows down?

Run a separate test in which a model or tool endpoint responds slowly, rejects requests, or becomes unavailable. Introduce each fault in a controlled way and record when it starts and ends. Keep the same task mix where possible so the team can compare the fault run with a healthy baseline.

Watch the queue, retry traffic, task deadlines, and the point at which the system refuses new work. Check whether callers receive a clear failure and whether accepted tasks remain visible for recovery. Restore the dependency while demand continues, then check how long the backlog takes to clear.

Avoid adding retries merely to make errors disappear from the caller. Repeated attempts can add demand to a service that is already struggling. The [AWS Builders' Library discussion of timeouts and retries](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) explains the risks and options for controlling retry traffic. Set retry limits and delays for the test, and inspect actual attempts rather than relying on configuration alone.

## How do you check tool actions under load?

Inspect every attempted action in the test ledger, including attempts that did not reach the downstream tool. Match each action to its task and intended result. Look for repeats after timeouts, actions attached to the wrong account, and work that continues after a user cancels it.

Create cases where the tool completes an action but its response is lost. The agent may see a timeout even though the action happened. Check that a retry uses the intended safeguards and that the final record shows what actually occurred. The article on [preventing duplicate agent actions](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) covers this failure path in more detail.

Test any approval step with a slow or absent reviewer. Check that the task remains visible and that no action happens before approval. If the test uses a substitute tool, verify the same protections against the real integration in an approved environment. Keep live side effects disabled unless the service owner has explicitly agreed to the exercise.

## Does the agent still do useful work at peak demand?

Run quality checks on results from every load stage, not just on a quiet baseline. Keep the task type and final outcome with each result so the team can see whether long or tool-heavy work degrades first. Include failures, incomplete work, and responses that arrive after the task deadline.

Use checks suited to the task. For a structured update, compare the recorded action and resulting state with the expected state. For a written answer, use agreed review criteria and inspect a sample of traces. Automated checks can narrow the review, but a score alone may miss a harmful tool action or an answer that sounds plausible and omits a key fact.

Keep the scoring method stable across runs. If the task mix or reviewer instructions change, note that change before comparing results. The [agent evals starter](/resources/agent-evals-ci-starter) provides a place to organize repeatable checks alongside the load test. Store failed examples so the team can reproduce them after a fix.

## How do you find the safe launch range?

Compare each stage with the limits agreed before the run. Include completion, queue age, end-to-end delay, quality, action safety, and spend. The safe range ends before any required limit is breached, with room for uncertainty in traffic and environment differences. Do not treat a brief peak as proof that the same rate can be sustained.

Check which component constrained the run. A worker pool may be full while model calls remain fast, or a provider limit may cause retries and queue growth. Change one suspected constraint at a time, then repeat the relevant test. Record the settings, task mix, and result so the team can tell whether the change helped.

The [Google SRE discussion of overload](https://sre.google/sre-book/handling-overload/) covers ways to shed work and protect a service under pressure. Decide how the agent will reject, defer, or route excess requests. Tell users what happens to accepted work and who can inspect a backlog.

## What must be ready before launch?

Write a short decision record with the tested demand range, pass limits, results, and known gaps. Name the person who can approve launch and the person who can stop traffic. If a test failed, describe the fix and the repeat run that checked it. If an important dependency was simulated, state what remains unproven.

Set alerts on queue age, failed tasks, unsafe action attempts, and spend. Confirm that the team can reduce intake, pause actions, and see which tasks need recovery. Keep a route for users to report bad outcomes that automated checks miss. Rehearse the stop plan with the people who will operate it.

After the run, remove test accounts and data according to the agreed retention plan. Preserve the test settings and results without keeping sensitive inputs unnecessarily. Start launch within the tested range and watch the same measures used for the decision. If behavior drifts, use the [agent rollback plan](/blog/how-to-roll-back-an-ai-agent-deployment) rather than waiting for a larger failure.
