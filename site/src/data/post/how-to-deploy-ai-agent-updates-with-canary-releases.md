---
title: How to deploy AI agent updates with canary releases
description: Learn how to deploy AI agent updates with canary releases, including cohort selection, live checks and rollback.
publishDate: 2026-11-22
updatedDate: 2026-11-22
shortAnswer: A plan for how to deploy AI agent updates with canary releases sends a small share of live work to the candidate while the current release handles the rest. Compare outcomes and tool actions, hold if risk limits are breached, and expand only after the owner reviews the evidence.
fullAnswer: A canary release sends a limited share of live agent work to an update while the current release remains available. For an AI agent, the release includes more than application code. A prompt, model, retrieval setting or tool permission can change what the agent does. Record the candidate and its settings, then choose a cohort that can tolerate the risk. Before live traffic starts, agree on checks for task quality, cost and harmful actions. Keep each task on its assigned release, including retries, so the comparison stays useful. Watch both the candidate and the current release under similar conditions. If a check fails, stop new candidate assignments and route work back to the prior release. Some actions cannot be undone by changing a route, so prepare a response for work already in flight. Expand only when the release owner has enough evidence to make a decision.
keyTakeaways:
  - Record the full agent configuration that each release will run.
  - Keep a task and its retries on the assigned release.
  - Judge live quality and tool actions alongside system health.
  - Stop new assignments and handle work already in flight when a check fails.
faq:
  - q: Can I canary a prompt change without changing application code?
    a: Yes. Give the prompt change a release identifier and record the model, tools and settings used with it. Route a limited cohort to that configuration and compare its results with the current release.
  - q: What if the canary has too little traffic to judge?
    a: Keep the cohort open longer if the risk and operating conditions allow it. Use reviewed examples and checks from outside the live cohort as supporting evidence, but do not treat them as proof of live performance.
  - q: Does routing traffic back undo the agent's actions?
    a: No. Routing stops new work from reaching the candidate, but an action already sent to a tool may need separate repair. The release plan should name who checks and handles those actions.
category: agentic-architecture
tags:
  - agentic-architecture
  - production-readiness
sources:
  - title: Canarying Releases
    url: https://sre.google/workbook/canarying-releases/
    publisher: Google
    retrieved: '2026-11-22'
  - title: Deployments
    url: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
    publisher: Kubernetes
    retrieved: '2026-11-22'
  - title: Traces
    url: https://opentelemetry.io/docs/concepts/signals/traces/
    publisher: OpenTelemetry
    retrieved: '2026-11-22'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## What should the release include?

A plan for how to deploy AI agent updates with canary releases starts by recording the candidate as a complete configuration. Include the application build, prompt, model identifier, retrieval settings, tool definitions and permission rules. Record the current configuration with the same care. The comparison is useful only if the team can tell what each cohort ran.

Keep the settings in a release record that the routing layer can read. Record any external service or model alias that may change outside the build. If a provider cannot pin a model version, note that limit and watch for changes during the test. A stable label alone does not prove that the underlying service stayed the same.

Run the candidate through the existing [agent evaluation process](/blog/evals-in-ci-for-llm-agents) before sending it live work. Include cases that exercise the changed prompt or tool path. A pass supports the decision to start a canary, but live checks still matter. Real requests can expose different inputs, delays and failures.

## Which work should reach the candidate?

Choose a cohort that gives useful evidence without exposing sensitive work unnecessarily. For example, start with staff requests or a customer group whose work can be reviewed. Exclude tasks that can make payments or change records unless the release plan explicitly covers those actions. The cohort should reflect the intended use before the team expands it.

Assign work using a stable key, such as a task identifier. Store the assignment with the task so retries and later steps use the same release. Avoid routing each model call independently. Otherwise, a single task can mix prompts, tool rules and outputs from different candidates.

Check that the current release receives comparable work during the same period. A cohort made up only of easy requests can make a candidate look better than it is. Record exclusions and review them before extending access to other users. The [Google SRE Workbook's canary guidance](https://sre.google/workbook/canarying-releases/) provides a useful starting point for planning the comparison.

## How do you keep live actions safe?

List every tool the agent can call and the effect each call can have. A search call and a payment request need different release controls. Keep existing permission checks in force for both cohorts, even when the candidate appears to behave well. The routing decision should not grant new authority by itself.

For high-impact actions, require a person to approve the proposed action before the tool executes it. Give that person the task context and the release identifier. The separate guide to [agent payment approval](/blog/how-to-require-approval-for-ai-agent-payments) covers the approval path in more detail.

Retries need special care when an action may have succeeded but its response was lost. Use a stable action key and check the tool's recorded result before trying again. The guide to [preventing duplicate actions](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) describes that problem. Do not run both releases against the same live action merely to compare their answers. Compare proposed actions in a safe test path, or review the action taken by the assigned release.

## What should the team measure?

Set checks before the first live task reaches the candidate. Name the owner, the evidence source and the response for each check. Keep the checks close to the work the agent actually performs, rather than relying on a healthy server alone.

| Check          | Evidence to review                               | Decision                                       |
| -------------- | ------------------------------------------------ | ---------------------------------------------- |
| Task result    | Completed work and a sample reviewed by a person | Hold if quality falls outside the agreed limit |
| Tool behavior  | Calls, denied requests and unintended changes    | Stop new assignments for a harmful action      |
| Service health | Errors, delay and failed tasks in both cohorts   | Hold while the team finds the cause            |
| Cost           | Spend per completed task and failed attempt      | Hold if spend exceeds the agreed limit         |

Set limits with the service owner before launch. A missed limit should lead to a named action, not a debate during an incident. Record task type and cohort alongside each result so reviewers can compare like with like. If a check depends on manual review, arrange that review before the cohort starts.

## How do you trace a task across tools?

Attach the release identifier and cohort assignment to the task record. Carry those fields through model requests, tool calls, retries and completion events. A trace should let an operator follow the path from a user request to the resulting action. The [OpenTelemetry trace documentation](https://opentelemetry.io/docs/concepts/signals/traces/) describes the trace structure that can support this work.

Record enough detail to investigate a bad outcome without storing every piece of customer content. Apply the service's access and retention rules to traces and review samples. Where a trace omits sensitive content, keep a safe reference that an authorized reviewer can use to find the original record.

Check that events arrive from both releases before opening the cohort. A missing event stream can look like an absence of errors. The guide to [tracing agent tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) covers the task-level view. If evidence stops arriving during the test, pause expansion until the team can trust the comparison again.

## When should traffic increase?

Review the candidate against the current release after it has handled enough relevant work. Look at task types, outcomes and tool calls, not just the total count. A quiet period with few matching tasks may tell the team little about the candidate. Keep the cohort open longer when the risk and operating conditions permit it.

Review a sample of completed tasks as well as the reported checks. Automated checks may miss a reply that is polite but wrong, or a tool call that reached the wrong record. Give reviewers a clear way to flag those cases and connect each finding to its task trace.

The release owner should record the decision to expand, hold or stop. Include the evidence reviewed, open concerns and the next decision point. Expand in stages chosen for the service and its risk, with checks running throughout. If the intended workload changes during the test, reassess whether the earlier evidence still applies. Do not turn a lack of observed failures into a claim that the candidate is safe for every task.

## How do you stop and roll back the release?

Test the routing switch before launch. It must stop assigning new tasks to the candidate and send eligible work to the current release. Confirm that the prior build and its settings remain available. The [Kubernetes deployment documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) covers deployment controls that may form part of that path, but the application routing rules still need their own test.

Decide what happens to work already in flight. Some tasks can finish under the candidate without further action. Others should pause for review, especially if a tool call is pending or its result is uncertain. Preserve the task assignment and action record while the operator decides what to do.

Changing the route cannot reverse a message already sent or a record already changed. Give the incident owner a way to find affected tasks and contact the people who can repair them. See the [agent rollback guide](/blog/how-to-roll-back-an-ai-agent-deployment) for the broader recovery plan. Keep the candidate disabled until the cause is understood and the revised release has passed its checks.

## How should shared state change during a canary?

Check whether both releases can read and write the same task records safely. A candidate that writes a new field or changes a workflow state can leave the current release unable to resume work. Test that path before live traffic starts, including the path back after a stopped release.

Keep shared record changes compatible with the current release for the duration of the test. If a change cannot be made compatible, use an isolated store or plan a controlled transition with an explicit recovery path. Include external tool state in that review. A local task record may say a call failed even though the external service accepted it.

After a stop, reconcile uncertain actions before replaying tasks. The operator should check the external result, the action key and the task trace. Record any repair and its owner in the release log. That evidence gives the next candidate a concrete failure case to test before it receives live work.
