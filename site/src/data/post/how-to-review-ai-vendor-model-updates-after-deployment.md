---
title: How to review AI vendor model updates after deployment
description: Learn how to review AI vendor model updates after deployment with paired tests, release decisions and a fallback plan.
publishDate: 2026-11-13
updatedDate: 2026-11-13
shortAnswer: Review AI vendor model updates after deployment by comparing the proposed model against the current workflow before release. Identify affected uses, run representative tests, check security and data terms, and record an owner’s decision. If the vendor controls the rollout, monitor the change closely and prepare a usable fallback.
fullAnswer: A plan for how to review AI vendor model updates after deployment starts with the affected workflows and the release controls. Start by identifying which workflows use the model and whether the vendor lets you choose the version. Collect the release notice, current configuration and any changes to data handling or service terms. Then compare the candidate with the current setup on tasks that reflect real use. Include cases where a wrong answer, unsafe action or delay would matter. Set decision limits before testing and give a named owner authority to approve, pause or reject the change. A model that performs well on general tasks can still fail a specific workflow. If a vendor applies updates without giving you a choice, ask for notice and evidence, watch the affected service, and agree on a fallback. Keep the decision and test results with the system record so the next reviewer can see what changed.
keyTakeaways:
  - Map each vendor update to the live workflows and owners it may affect.
  - Compare the candidate and current setup using representative cases and decision limits set in advance.
  - Record the release decision and prepare a fallback that the team can actually use.
  - For vendor-controlled updates, agree on notice, monitoring and escalation before a change arrives.
faq:
  - q: Should we retest every vendor model update?
    a: Review every notice for possible impact, then set the test scope by the affected workflow and the change. A low-impact change may need a short check. Changes affecting decisions, data handling or external actions need closer review.
  - q: What if the vendor updates the model without our approval?
    a: Ask the vendor for notice, a change record and a way to report regressions. Monitor the affected workflow and prepare an alternate route or a manual process. Record any risks that remain if the vendor cannot offer version controls.
  - q: Can vendor test results replace our own review?
    a: Vendor results can help identify changes, but they may not cover your data, users or failure costs. Test the tasks and controls that matter to your workflow before relying on the update.
category: operating-model
tags:
  - production-readiness
  - security-review
  - evals-in-ci
sources:
  - title: Deprecations
    url: https://platform.openai.com/docs/deprecations
    publisher: OpenAI
    retrieved: '2026-11-13'
  - title: Evaluation best practices
    url: https://platform.openai.com/docs/guides/evals
    publisher: OpenAI
    retrieved: '2026-11-13'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-13'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
  - ai-governance-starter-kit
---

## What changed, and which workflows use it?

Start with the vendor notice and the settings your service actually uses. Record the model identifier, the proposed replacement and the expected change window. Capture any related changes to prompts, tools, filters or output formats. A model comparison is hard to interpret when several settings move together.

Find each affected use in the [AI register](/glossary/ai-register). Ask the service owner to check the list against current traffic and vendor accounts. A shared model setting can serve workflows with different users and different risks. Note which teams receive outputs, which systems act on them and where a person can intervene.

| Review item | What to record                                                |
| ----------- | ------------------------------------------------------------- |
| Change      | Current and candidate identifiers, notice and expected timing |
| Scope       | Workflows, users, connected tools and accountable owners      |
| Control     | Who selects the version and whether release can be delayed    |
| Evidence    | Test results, known gaps, decision and fallback               |

If the notice lacks a clear identifier or date, ask the vendor. Treat missing details as a review gap rather than filling them in by guesswork. Keep the notice with the system record so another owner can trace the decision.

## Can you choose when the update goes live?

Check the actual account settings and contract before planning a release. A vendor may offer a fixed version, a moving alias or no visible version choice. Confirm whether a fixed version remains available long enough to complete the review. Record who can change the setting and where that change takes effect.

When your team controls the switch, keep the current setup available during testing. Use a separate test environment where possible, with the same relevant settings as production. Check that the candidate can be selected without changing unrelated workflows. Ask the vendor about any dependencies that could prevent a return to the current version.

When the vendor controls the switch, ask for advance notice and a contact for regressions. Use the vendor’s [deprecation notices](https://platform.openai.com/docs/deprecations) where they apply to the service you use. Agree internally on who watches the change window and who can pause the affected workflow. If no notice is available, document that gap and choose a monitoring response that does not depend on it.

## Which changes need closer review?

Set the depth of review from the possible harm, not the vendor’s release label. A workflow that drafts internal notes has different failure costs from one that sends customer messages. A system that can call tools or change records needs checks on those actions. The same model update may therefore need different tests across services.

Ask whether the change affects output quality, latency, cost, tool use or data handling. Include downstream rules that depend on a particular output format. Check whether the vendor has changed the way the service handles inputs or retains data. Send unclear terms to the person responsible for the vendor relationship and the relevant data owner.

The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) can help frame follow-up questions. Focus on what changed since the last decision, rather than reopening every procurement question. If the vendor cannot provide evidence on a material point, record the gap and its effect on the release decision. The owner can then decide whether to hold the change or accept the remaining risk.

## How do you compare the candidate with the current setup?

Build a test set from the work the service is meant to handle. Include common requests, difficult edge cases and examples of past failures. Remove or protect sensitive information before using real cases in a test environment. Make sure the test use fits your agreement with the vendor.

Run the same cases against the current and candidate setups. Keep prompts, tool access and other settings fixed unless they are part of the proposed change. Record the outputs alongside the model identifiers and test conditions. If results can vary between runs, repeat cases where that variation could change the decision.

Ask people who know the task to judge whether outputs are fit for use. For structured outputs, check required fields and whether downstream software can read them. For tool use, test in a safe environment where an error cannot affect customers. The [evaluation guidance](https://platform.openai.com/docs/guides/evals) can help plan the test process, while the [evaluation starter](/resources/agent-evals-ci-starter) offers a place to organize checks.

## What counts as a pass or a reason to stop?

Agree on decision limits before anyone sees the candidate results. Name the failures that block release, such as an unsafe tool call or a missing required field. Set acceptable ranges for measures the team can observe, including response time and task quality. Record who may approve an exception and what evidence that person needs.

Look beyond the overall result to cases where the candidate gets worse. A gain on routine requests may hide a serious loss on a rare but important task. Review both the rate of a failure and the harm it could cause. A small test set may reveal a problem without proving how often it will occur.

When results are mixed, fix the setup and rerun the affected cases. If the team cannot resolve a material gap, pause the switch or restrict the use. Do not treat a vendor’s broad benchmark as a pass for your own workflow. Save the failed cases and the reason for the decision, including any risk the owner accepts.

## How should you check data and tool access?

Compare the candidate’s data terms with the terms approved for the current service. Ask whether input handling, retention, training use or subprocessors have changed. Have the data owner review any difference against the information sent by each workflow. A model identifier alone cannot show whether the surrounding service terms have changed.

Inspect the tools and data sources the workflow can reach after the update. Use test accounts and safe substitutes for actions that would change real records. Check that the model respects access boundaries and that the application still checks each requested action. Include attempts to make the workflow reveal restricted data or use a tool outside its purpose.

Route unresolved questions through the existing security and vendor review process. The [risk management framework guidance](https://www.nist.gov/itl/ai-risk-management-framework) can inform that review. Give the release owner a clear account of open issues, affected data and proposed controls. If the vendor offers no answer, the decision should say so rather than imply the issue was checked.

## Who approves the change, and what gets recorded?

Give a named service owner responsibility for the release decision. Bring in the people who own the affected data, technical controls and business process. They need enough time to review results and raise concerns before the switch. The person changing a setting should know where approval is recorded.

Keep a short decision record with the current and candidate configurations. Link to the vendor notice, test cases, results and any security review. Record the decision, its owner, the release window and the fallback. List open issues with an owner and a condition for closing each one.

For a rejected change, say which evidence led to rejection and what happens next. For an accepted gap, describe the exposure and the control that limits it. Store the record where the next service owner can find it, alongside the [system register](/blog/how-to-build-an-ai-system-register-in-a-week). A chat message alone makes a poor handover when the release spans several teams.

## How can you release the update without surprising users?

Choose a release path that fits the controls the vendor provides. Where routing allows it, send a limited set of suitable requests to the candidate first. Tell the affected service team what will change and how to report problems. Avoid test traffic that could trigger real actions twice or expose data beyond its approved use.

Watch task outcomes as well as service health after the switch. Compare errors, response times, user reports and failed tool calls with the earlier baseline. A healthy connection does not mean that the answers remain useful. Give the team a clear way to stop expansion if the new setup misses its decision limits.

If the vendor changes all traffic at once, increase attention around the expected window. Ask users to report concrete examples and preserve enough context to investigate safely. Review those reports with the service owner, then decide whether to continue, restrict the workflow or use the fallback. Record the observed impact even when no regression appears.

## What is the fallback if the update fails?

A fallback needs a route, an owner and a way to confirm it works. If the previous model remains available, test how to restore it and its matching settings. Check that the account has permission to make the change and that dependent services still accept the result. Do not promise a rollback until the vendor confirms the old version can be used.

If returning to the old model is impossible, choose another safe operating path. That may mean routing suitable work to an approved alternate service or sending requests to a person. Check capacity, data terms and task quality before relying on an alternate. For workflows with external actions, pause those actions if the team cannot contain the risk.

The [agent rollback guide](/blog/how-to-roll-back-an-ai-agent-deployment) covers related release controls. After any fallback, tell affected teams what changed and how to handle work in progress. Keep the vendor ticket and internal incident record linked to the update decision.

## How do you handle a change with little notice?

Start by finding the workflows that face the greatest harm if behavior changes. Assign an owner to gather the notice, confirm the deadline and contact the vendor. Use the most relevant existing test cases first, including checks for unsafe actions and broken output formats. Record which parts of the normal review could not be completed.

If the deadline arrives before the evidence is ready, the owner must choose a safe operating path. The choices may include restricting the workflow, using an approved alternate or moving work to people. Make that choice explicit and tell the teams who depend on the service. A deadline does not make an untested fallback reliable.

After the urgent change, finish the missed checks and review any user reports. Ask the vendor for the missing notice or evidence, and update the system record. Use the gaps to renegotiate notice or version controls where the relationship allows it. The next review should start with a clearer account of what the team can control.
