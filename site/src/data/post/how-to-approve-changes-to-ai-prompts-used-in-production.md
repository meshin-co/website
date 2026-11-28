---
title: How to approve changes to AI prompts used in production
description: How to approve changes to ai prompts used in production, from version review and testing to sign-off and rollback.
publishDate: 2026-11-28
updatedDate: 2026-11-28
shortAnswer: To decide how to approve changes to ai prompts used in production, review the exact version, test results, risks and rollback plan. Give a named owner authority to accept or reject the change. Release the approved version in a controlled way, then check live results and record the decision.
fullAnswer: 'To decide how to approve changes to ai prompts used in production, assign a named approver and review test evidence and a release plan for the exact version. Even a small wording edit can change what a system says or which action it attempts. The review should match the effect of the change: an internal drafting tool may need a lighter check than a tool that sends customer messages or triggers payments. The person proposing the edit records the current and proposed prompts, the reason for the change, and the affected workflow. A reviewer checks test cases, known failures, access boundaries, and the plan for reversing the release. Approval applies to the tested version and its stated conditions, not to later edits. After release, the owner watches for errors and harmful output, records the outcome, and stops or reverses the change if the agreed limits are crossed.'
keyTakeaways:
  - Tie each approval to the exact prompt and runtime setup that were tested.
  - Match the depth of review to the actions and people a prompt can affect.
  - Record the decision, release conditions, and rollback owner before deployment.
  - Treat live monitoring and a tested rollback path as part of the approval.
faq:
  - q: Who should approve a production prompt change?
    a: The workflow owner should approve the business effect and be accountable for the release. A technical reviewer should check the test evidence and deployment path. Bring in security, legal, or another domain owner when the proposed change affects their area.
  - q: Does every prompt edit need the same review?
    a: No. Set a lighter review path for changes with limited impact and a deeper path for changes that affect sensitive data, customer-facing decisions, or external actions. The named owner still needs a record of what was approved.
  - q: Can a team make an emergency prompt change?
    a: Yes, if the team has a defined emergency path with a named decision maker and a way to restore the prior version. Record what changed and review the evidence after the immediate risk is contained.
category: operating-model
tags:
  - production-readiness
  - evals-in-ci
  - ai-governance
sources:
  - title: Evaluation best practices
    url: https://platform.openai.com/docs/guides/evals
    publisher: OpenAI
    retrieved: '2026-11-28'
  - title: About protected branches
    url: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
    publisher: GitHub
    retrieved: '2026-11-28'
  - title: Release Engineering
    url: https://sre.google/sre-book/release-engineering/
    publisher: Google
    retrieved: '2026-11-28'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
  - ai-governance-starter-kit
---

## How do you approve changes to AI prompts used in production?

To decide how to approve changes to ai prompts used in production, review the exact version, test results, release plan and rollback path. The decision should cover the workflow that will use the prompt, not just the text in isolation.

Start with a change record that a reviewer can inspect without chasing the author. Include the current prompt, the proposed prompt, the reason for the edit and a link to the affected service. Show the differences and name the person who will deploy the change.

The record should also identify the model, tools, retrieved material and settings used for the tests. If these differ from the planned release, explain the gap. A prompt that passes against a test model may behave differently with another model or different tool access.

The workflow owner can approve, reject or request changes. An approval should state any release conditions, including who watches the result. If the prompt changes after sign-off, send the changed version back for review.

## Which prompt changes need a deeper review?

Choose the review path by looking at the possible effect on people and systems. A wording edit in a staff drafting tool may have a narrow impact. An edit that changes customer messages, data access or tool use calls for closer scrutiny.

| Change                                               | Review focus                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tone or format in an internal draft                  | Check examples, output quality and whether staff can correct errors.               |
| Customer-facing content                              | Check accuracy, escalation rules and the cost of a misleading reply.               |
| Data access or tool instructions                     | Check permissions, sensitive data handling and the actions the system can attempt. |
| Eligibility, payment or other consequential workflow | Include the relevant business owner and examine failure cases and human checks.    |

These are starting points rather than automatic approval rules. A small edit can remove a warning or change when a tool is called. Ask what could go wrong in the actual workflow, then choose reviewers who can judge that harm. The existing process for [ranking AI use cases by risk](/blog/how-to-rank-ai-use-cases-by-risk) can help set those review paths.

## What should the author put in the review record?

A useful review record lets someone reproduce the decision and find the released version. Store the prompt in version control or another system that keeps a clear history. Link the record to a version identifier, rather than copying text into a chat thread.

Describe the intended behavior with a concrete example. For a support workflow, that might mean asking the system to route refund requests to a person instead of drafting a promise. Include an example of behavior that must remain unchanged, such as declining to expose another customer's account details.

Record the inputs and settings that affect the result. These can include the model identifier, tool permissions, output format and source material available during testing. Note any known mismatch between the test setup and the planned release.

Keep secrets and real customer data out of a broadly accessible review record. Use approved test data and link to restricted evidence where necessary. The workflow owner should still be able to see the decision, its scope and the people responsible.

## What evidence should reviewers ask for?

Run the proposed prompt against cases drawn from the work it will handle. Include ordinary requests, unclear requests, boundary cases and cases that have caused trouble before. Compare results with the current prompt under the same test conditions.

For each case, record the input, expected behavior and observed result. Where a response needs judgment, say who reviewed it and why it passed or failed. Keep examples of failed cases, including failures that the team accepts with a stated reason.

Add cases that challenge the proposed change itself. If the edit asks a support system to escalate billing disputes, test a clear dispute and an ambiguous billing question. Check that the system does not invent a refund or send a message without the required review.

Use the team's [evaluation process](/blog/evals-in-ci-for-llm-agents) to run repeatable checks. The [evaluation guidance from OpenAI](https://platform.openai.com/docs/guides/evals) offers a starting point for test design. A passing test set supports a decision, but reviewers should still examine gaps and possible harm.

## Who should sign off on the change?

Give the workflow owner the final decision on whether the proposed behavior fits the work. That person should understand who receives the output and who handles mistakes. Name a substitute who can make the decision when the owner is unavailable.

Ask a technical reviewer to check the version, test setup, tool access and release plan. For a sensitive data change, involve the person responsible for data handling. For customer commitments or regulated decisions, include the relevant business and legal owners under the company's review process.

Separate the person proposing a change from the person approving it where practical. If a small team cannot do that, record the constraint and seek a review from someone outside the immediate work. The decision record should say who approved which part and what evidence they saw.

A protected branch can help prevent an unreviewed edit from reaching the release path. See [GitHub's guidance on protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) for available controls. Access to the live prompt store also needs review if staff can edit it outside that path.

## How do you keep the approved prompt from changing before release?

Bind the approval to the version identifier and the release configuration. The deployment process should fetch that version rather than accepting pasted prompt text. Check that the model, tools and relevant settings match the conditions recorded at approval.

If an editor fixes a typo after sign-off, compare the new version with the approved one. Route it through the agreed review path, even when the author expects no behavior change. The reviewer can choose a light check when the effect is genuinely limited.

Keep draft access separate from the ability to publish. Restrict direct edits to the live prompt store and record any use of that access. If the vendor interface cannot preserve a reliable version history, save the approved text and release evidence in a controlled location.

Release engineering guidance from [Google's Site Reliability Engineering book](https://sre.google/sre-book/release-engineering/) can inform the deployment path. For an existing service, check how a [prompt or model change is stopped from shipping unnoticed](/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed).

## How should the team release and monitor the change?

Choose a release path that limits exposure while the team checks real behavior. Where the service permits it, send a small share of suitable traffic to the approved version. Keep the current version available and name the person who can stop the release.

Before deployment, agree on signals that would trigger a pause. These might include failed tool calls, unsafe replies, customer complaints or a rise in requests for human help. Set limits that fit the workflow and record them with the approval. Do not rely on a single quality score to reveal every kind of failure.

Check samples of live output using the company's access and retention rules. Give reviewers enough context to judge the result without exposing data they do not need. Record what was checked, any problem found and whether the release should continue.

A gradual release still needs an owner and a stop path. The article on [canary releases](/blog/how-to-deploy-ai-agent-updates-with-canary-releases) covers release mechanics that may fit this workflow. If the system cannot split traffic, use another controlled release method and state its limits.

## When should you roll back or seek a new approval?

Stop the change when an agreed limit is crossed or the owner sees an unacceptable harm. Route affected work to the previous prompt or a safe fallback, according to the release plan. If an external action has already happened, reversing the prompt will not undo that action. The team must handle affected records or customers separately.

Test the rollback path before release. Save the prior prompt and its compatible model, settings and tool configuration. A prior prompt alone may not restore the earlier behavior if the surrounding system has changed. Assign someone to confirm that the fallback is working and to tell the affected team.

Seek a fresh decision when the proposed prompt, model or material permissions change after approval. Also review a change when live evidence reveals a failure that the original decision did not consider. Document the new evidence and any revised release conditions.

The [rollback procedure for an AI agent deployment](/blog/how-to-roll-back-an-ai-agent-deployment) provides a related path for changes that affect more than the prompt.

## What happens when a prompt needs an emergency fix?

An emergency path should let a named person contain harm without hiding the change. Define who can authorize it, where they record the reason and how the team restores service. Use the narrowest edit that addresses the immediate problem, and keep the previous version available.

Run the checks that remain possible before release. If time or access prevents a normal test, record the missing evidence and the risk accepted by the decision maker. Tell the workflow owner and the people who operate the service what changed and what to watch.

Once the immediate problem is contained, review the actual prompt, test results and live effects. The normal approver can accept the change, request a revision or order a rollback. Keep the emergency record linked to the later decision so an auditor can follow the sequence.

If the fix exposes a wider incident, use the team's [incident roles and escalation paths](/blog/how-to-assign-roles-and-escalation-paths-for-ai-incidents). Close the prompt change record only after its owner has assigned any remaining work.
