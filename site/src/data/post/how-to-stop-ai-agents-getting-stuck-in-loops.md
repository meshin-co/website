---
title: How to stop AI agents getting stuck in loops
description: 'How to stop AI agents getting stuck in loops: enforce shared limits, check progress and use safe retries.'
publishDate: 2026-11-15
updatedDate: 2026-11-15
shortAnswer: To stop AI agents getting stuck in loops, enforce a shared run budget outside the model, check for repeated states and define a safe exit. When progress stalls, stop new tool calls, preserve the run state and return a clear failure or route the task to a person.
fullAnswer: |-
  An AI agent can keep working without getting closer to an answer. Stop that loop by putting limits in the code that runs the agent, rather than asking the model to stop on its own. Set a shared budget for tool calls, elapsed time and spend. Check whether each new step changes the task state or repeats an earlier attempt. When a limit is reached, prevent further calls and record why the run stopped.

  The exit path matters as much as the limit. A stopped run may have already changed a record or sent a request. Check the result of those actions before retrying, and send uncertain cases to a person. Test the controls with repeated errors, changing inputs that lead nowhere and work passed between agents. The right limits depend on the task, its cost and the harm an unwanted action could cause.
keyTakeaways:
  - Enforce run limits outside the model and share them across all agents working on a task.
  - Compare attempts with task state so repeated work triggers a controlled stop.
  - Reconcile uncertain tool results before a retry can repeat an external action.
  - Test both the stop condition and the state left behind when a run ends.
faq:
  - q: Will a maximum tool-call limit stop every agent loop?
    a: A hard limit bounds tool calls, but it may not stop work that happens outside that count. Apply time and spend limits too, and make child agents share the parent run's budget.
  - q: Should we retry a run after it hits a loop limit?
    a: Review the stop reason and any external actions first. Retry only when the cause has changed and the system can avoid repeating an action that may already have succeeded.
  - q: Can the model decide when it is stuck?
    a: A model can flag uncertainty, but the runner should enforce the stop. Use model signals alongside state checks and limits that the model cannot reset.
category: agentic-architecture
tags:
  - agentic-architecture
  - evals-in-ci
  - production-readiness
sources:
  - title: Timeouts, retries, and backoff with jitter
    url: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
    publisher: Amazon Web Services
    retrieved: '2026-11-15'
  - title: Function calling
    url: https://platform.openai.com/docs/guides/function-calling
    publisher: OpenAI
    retrieved: '2026-11-15'
  - title: Building effective agents
    url: https://www.anthropic.com/engineering/building-effective-agents
    publisher: Anthropic
    retrieved: '2026-11-15'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Where should the stop control live?

The practical answer to how to stop AI agents getting stuck in loops is to enforce a hard stop outside the model. The runner should check permission to continue before it starts each model or tool call. A prompt can ask for a concise answer, but the runner must be able to refuse another step.

Give each task a run record with its goal, current status and remaining budget. The status should distinguish active work from a stop in progress and a finished run. When the runner decides to stop, it should reject new work for that run and record the reason. The caller then receives a result that says the task did not finish.

Keep the enforcement point close to the code that dispatches calls. A check in a user interface cannot protect work that continues on a server. A check inside a tool cannot bound repeated model calls that never reach that tool. Decide which component owns the run state and make every path consult it.

## What limits should an agent run have?

Set limits for elapsed time, model and tool calls, and spend. Each limit covers a different way a run can consume resources. A call count alone leaves room for a slow request to occupy a worker. A time limit alone can permit many rapid calls before the deadline.

Choose limits from the work the task needs, then test them against normal cases. A document search may need more reads than a lookup against a known record. Give the task enough room to finish, but keep the ceiling low enough that a failed run has a bounded cost. Record which limit fired so the team can adjust it on evidence.

Pass the same budget to child agents and background jobs. The shared counter needs an atomic reservation before a call starts, so concurrent workers cannot each spend the same remaining allowance. A child should not receive a fresh budget when it starts or retries. The [multi-agent architecture article](/blog/multi-agent-reference-architecture-in-production) covers the wider design around these handoffs.

## How can you tell whether an agent is making progress?

Compare each attempt with the task state, rather than relying on the agent's description of its work. Useful signals include the tool name, relevant inputs, returned status and the part of the task that changed. A repeated search with equivalent inputs and no new result is a reason to pause.

The comparison needs to fit the task. Removing harmless spacing may reveal that search queries are effectively the same. Removing a customer identifier from a write request, however, could make distinct actions look identical. Store a safe fingerprint of the fields that matter, and avoid placing sensitive content in general-purpose logs.

| Signal             | Check before continuing                           | Safe response                                |
| ------------------ | ------------------------------------------------- | -------------------------------------------- |
| Repeated call      | Are the relevant inputs and result unchanged?     | Stop or request different evidence.          |
| Changing calls     | Has the task state advanced despite new wording?  | Stop after the configured no-progress limit. |
| Pending work       | Is an external result still expected?             | Wait within the run deadline.                |
| Claimed completion | Does the result meet the task's acceptance check? | Return it or ask for review.                 |

A repeated call is not always a loop. A status check can be legitimate while a job is pending. Mark that wait explicitly, space the checks and keep the deadline in force. The acceptance check should use evidence available to the runner, such as a record status, rather than the model's assertion alone.

## What should happen after a tool error?

Classify the error before allowing another attempt. A temporary service failure may justify a bounded retry. Invalid inputs, missing access or a rejected request usually call for a change or a stop. Sending the same invalid request again gives the agent no new information.

Place retry rules in the tool wrapper, where they apply even if the model asks again. Set a retry allowance within the overall run budget and wait between attempts. Add variation to the wait when many workers may retry together. The [AWS guidance on retries and backoff](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) explains why retry behavior belongs in the design of a remote call.

Return a structured error to the runner with enough detail to select the next path. Avoid feeding secrets or raw internal traces into the model. If the same failure returns after the allowed attempts, stop and report the dependency and error class. A person can then decide whether the task should wait, be corrected or end.

## How do you stop retries from repeating an action?

Treat a timeout after a write as an uncertain outcome. The remote service may have completed the action even though the agent never received its reply. Before sending another write, look up the original request or its resulting record. If the result cannot be established, stop and send the case for review.

Assign an action key before dispatch and keep it stable across retries of the same intended action. Where the receiving service supports that key, use it to identify repeated requests. A new intended action needs a new key, while a retry must not quietly create one. Check the receiver's actual behavior before relying on this control.

A cancellation can also race with an already dispatched call. Mark the run as stopping, block further dispatches and track any calls still in flight. Then reconcile their results before describing the run as safely stopped. The guide to [duplicate actions on retries](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) goes deeper on the write path.

## Can agents pass a loop between each other?

Agents can keep a task moving between roles without resolving the underlying problem. One agent may ask for research, another may return an incomplete result, and the first may request the same research again. Local limits on each role do not bound the whole exchange if every handoff starts a fresh allowance.

Carry the parent run identifier, deadline and remaining budget through each handoff. Record the sender, recipient, requested result and reason for the transfer. Check the sequence for repeated handoffs that leave the same task state unchanged. A coordinator should stop the exchange when it reaches the shared limit or no-progress condition.

Define what a valid handoff must contain. For example, a research request should name the missing evidence, while the reply should either provide it or say why it is unavailable. If neither agent can supply the missing information, return that gap to the caller. The [agentic workflow glossary](/glossary/agentic-workflow) provides the broader context for this kind of work.

## What should the caller see when a run stops?

Return a distinct stopped status rather than a normal-looking answer. Include the stop reason, the last confirmed state and whether any external action is still uncertain. If the task produced partial work, label it as partial and say what remains unchecked. A caller should not have to infer success from a plausible paragraph.

Choose the next owner before deploying the workflow. A low-risk search can return a failure to the requester. A run that may have changed a payment or customer record needs a route to someone who can inspect the target system. Give that person the run identifier and a link to the relevant record, subject to access controls.

Preserve enough evidence to explain the stop without storing more task data than the team needs. Record the budget consumed, stop condition, tool outcomes and handoffs. Set access and retention rules for those records. The article on [tracing tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) describes how to connect events across a run.

## How do you test that the loop controls work?

Build test cases around the ways the workflow can stall. Return the same search result repeatedly, reject a tool request with an input error and leave a remote job pending. Also test a sequence whose wording changes while the underlying task state does not. Each case should reach the expected stop without another dispatch after the limit.

Test successful work near the limit too. A control that stops a valid task before its last required call may push users toward unsafe manual workarounds. Check that the result includes the right status, that partial output is labeled and that any pending action is tracked. Use a fake tool with a call log to verify what actually ran.

Include a case where a write succeeds but its response is lost. The test should show a lookup or review before another write is allowed. For shared budgets, start concurrent workers and check that their reservations cannot exceed the allowance. Run these cases alongside the workflow's other [agent tests](/blog/evals-in-ci-for-llm-agents).

The [OpenAI function calling guide](https://platform.openai.com/docs/guides/function-calling) describes the exchange between a model and application tools. Use that boundary in tests: the application, not the model, decides whether a requested call is allowed.

## What should the team do when stops increase?

Group stopped runs by reason and inspect a sample before changing limits. A rise in repeated searches may point to missing source material. A rise in timeouts may point to a dependency that needs repair. Raising every budget can hide both problems while leaving failed work running longer.

Compare stopped runs with completed tasks of the same kind. Check whether the acceptance rule rejects valid output or whether the agent lacks a tool it needs. Review changes to prompts, tools and routing against the first affected runs. Keep the stop in place while the team investigates.

For a live failure, pause the affected workflow if it is creating unsafe actions or consuming resources without progress. Reconcile in-flight work, correct the cause and run the relevant tests before restoring traffic. The [rollback article](/blog/how-to-roll-back-an-ai-agent-deployment) covers the release decision. Anthropic's discussion of [building effective agents](https://www.anthropic.com/engineering/building-effective-agents) also describes the need for stopping conditions in agent workflows.
