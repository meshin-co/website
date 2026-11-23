---
title: How to create an AI training plan by employee role
description: Learn how to create an AI training plan by employee role, with exercises, checks, and clear ownership.
publishDate: 2026-11-23
updatedDate: 2026-11-23
shortAnswer: 'How to create an AI training plan by employee role: map each group’s tasks, tool access, and decision rights. Give everyone the same basic rules, then add practice for the risks each role faces. Check skills with realistic exercises, record gaps, and assign an owner to keep the plan current.'
fullAnswer: 'How to create an AI training plan by employee role: start with the work people do and the decisions they can make. Map each group’s tasks, approved tools, data access, and likely mistakes. Use that map to set shared rules and select role-specific exercises. A support agent might practise checking a drafted reply, while a manager practises deciding when a tool should be paused. Assign a named owner to each part of the plan and agree on what a successful exercise looks like before training starts. Use safe examples that resemble real work, and give staff a route to ask questions or report a problem. Record demonstrated skills and follow up where an exercise exposes a gap. Review the plan when tools, duties, or company rules change. The result is a working plan that connects instruction to the choices employees make at work.'
keyTakeaways:
  - Map training to tasks, tool access, and decision rights rather than job titles alone.
  - Give every employee shared rules, then add exercises for each role’s risks.
  - Check performance with realistic exercises and follow up on gaps.
  - Assign owners to maintain training as tools and responsibilities change.
faq:
  - q: Should every employee take the same AI training?
    a: Everyone who uses an approved tool should learn the rules that apply to that tool. Add role-specific practice for people who review outputs, approve access, manage vendors, or make decisions using AI.
  - q: How do we check whether AI training worked?
    a: Ask employees to complete a realistic task and explain when they would stop or seek help. Score the work against a shared rubric, record gaps, and offer another attempt after coaching.
  - q: Who should own an AI training plan?
    a: A named plan owner should coordinate the material and records. Managers should confirm role-specific tasks, while tool and policy owners check that exercises reflect current rules.
category: operating-model
tags:
  - ai-governance
  - acceptable-use-policy
sources:
  - title: Guidelines for Human-AI Interaction
    url: https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/
    publisher: Microsoft Research
    retrieved: '2026-11-23'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-23'
  - title: People + AI Guidebook
    url: https://pair.withgoogle.com/guidebook/
    publisher: Google
    retrieved: '2026-11-23'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
  - adoption-telemetry-dashboard-template
---

## Where should an AI training plan start?

To decide how to create an AI training plan by employee role, first map actual work. Ask managers which tasks involve an approved tool, what information staff enter, and who acts on the output. Record the tools and duties people have today, rather than the duties a job title suggests. A team member who drafts an internal note needs different practice from a person who sends a customer reply.

Include people who approve access, buy tools, review output, or handle problems. They may rarely write a prompt, but their choices shape how others use the tools. Note where a person can act alone and where a review is required. The existing [AI operating model](/glossary/ai-operating-model) can help identify those handoffs.

Give each group a short task statement, a tool list, and an escalation contact. Mark unknowns for the plan owner to resolve with the relevant manager. If a team has several distinct duties, split the training path by task. If staff move between duties, assign the exercises that match each duty.

## Which skills should each role practise?

Start with a shared baseline for staff who use AI tools. Cover approved access, permitted data, output checks, and the route for reporting a concern. Show employees where to find the current rules rather than asking them to remember every detail. The [acceptable use policy](/blog/ai-acceptable-use-policy-for-a-50-person-company) can provide the starting point for those rules.

Then add practice tied to the decisions each group makes. The table offers a starting pattern, which the plan owner should adapt to actual duties and tool access.

| Role                 | Practice task                                            | Evidence to look for                                                     |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| General user         | Draft an internal summary from approved sample material. | Checks the draft against the source and removes unsupported claims.      |
| Customer support     | Review a proposed reply to a customer.                   | Checks the answer and sends uncertain cases for review.                  |
| Manager              | Decide whether a proposed use can proceed.               | Identifies the decision owner and the conditions for approval.           |
| Tool owner           | Respond to a report of an unsafe output.                 | Records the issue, limits use where needed, and contacts the right team. |
| Procurement reviewer | Examine a proposed vendor’s data handling terms.         | Finds the open questions and routes them to the people who can answer.   |

The same person may need more than one path. Match the exercise to their authority, and avoid giving them approval duties they do not hold. Where a task involves employee information, use the company’s rules on [which employee data can be used in AI tools](/blog/how-to-decide-which-employee-data-can-be-used-in-ai-tools).

## How do you turn rules into useful exercises?

Choose a work sample that staff can recognise without exposing real sensitive information. Give the learner the task, the tool’s proposed output, and the rules that apply. Ask for the action they would take and the reason for it. A facilitator can then compare the answer with the agreed review points.

For example, a support exercise can include a draft that states a refund has been approved. The sample record can show that approval is still pending. The learner should catch the mismatch, check the source, and use the right route for approval. The exercise tests a work decision, not just recall of a policy sentence.

Add a second case where the output is incomplete or the source is unavailable. Make it clear whether the employee should stop, ask a colleague, or proceed with a caveat. The article on [reviewing AI-generated customer support replies](/blog/how-to-review-ai-generated-customer-support-replies) provides a place to develop that exercise.

Use the same method for other roles. A manager can review a request for a new use, while a tool owner can work through an incident report. Keep the examples close enough to real work that the next action is meaningful.

## How should you handle data and tool access in training?

Prepare a safe training space before asking staff to practise. Use sample records that the data owner has approved for the exercise. Check whether the tool retains inputs or shares them under its settings and contract. If the answer is unclear, keep the exercise away from live company data until the owner resolves it.

Show learners how to find the approved tool and check the account they are using. Walk through the difference between information they may enter and information that needs a separate decision. For a disputed example, ask the learner to identify whom they would consult. Do not turn the exercise into a guessing game about rules the company has not yet settled.

Tool owners need a separate check on access and settings. They should know who can grant access, where the record is kept, and how a departure or role change reaches the access owner. The [access review process](/blog/how-to-run-a-quarterly-ai-tool-access-review) gives that group a practical handoff to rehearse.

Keep training copies and exercise results only where the plan owner has agreed they belong. Explain who can see individual feedback and why it is retained. A learner should be able to ask for a correction if a record is wrong.

## What should count as passing an exercise?

Write a rubric before the first session, using the decisions the exercise is meant to test. For a drafted answer, the rubric might require a source check, a correction, and an escalation when approval is missing. A fluent answer alone is not evidence that the learner checked it. Share the criteria with learners before they start.

Use a trained reviewer or an agreed answer key to judge the exercise. Record which step the learner completed, which step needs work, and what coaching was offered. If the learner misses a safety step, pause the relevant activity until the manager has arranged suitable follow-up. The manager should also check whether the instructions or tool design contributed to the mistake.

Offer another attempt with a fresh example after coaching. Someone who still needs help may need a different task, more supervised practice, or a change in access. Agree that decision with the person’s manager and the tool owner. Do not treat a completion record as a substitute for a demonstrated work skill.

For exercise design, the [human interaction guidance](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) offers a useful lens on how people understand and correct system output. Use it to frame practice around the decisions employees actually face.

## Who keeps the plan current?

Name a plan owner who can collect changes and ask for decisions. That person need not own every policy or tool. Each manager should confirm the tasks assigned to their team, and each tool owner should check exercises against current access and settings. A policy owner should resolve unclear rules before they appear in training.

Keep a simple record of each learning path, its intended audience, its exercise, and its reviewer. Add the date of the last content change and the person who approved it. Link each path to the current source of company rules, so staff can find the answer after the session. The [handover playbook](/resources/handover-playbook) can help document ownership when the plan changes hands.

Trigger a review when a tool changes its use of data, a role gains new authority, or an incident exposes a gap. The owner should decide whether to revise the exercise, notify staff, or pause a task. Record that decision and tell managers what their teams need to do. For broader prompts on risk ownership and review, consult the [risk management resource](https://www.nist.gov/itl/ai-risk-management-framework).

## How do you schedule training without stopping work?

Sequence the paths around access and need. Give new users the shared baseline before they use an approved tool for work. Schedule role-specific practice before someone takes on a review, approval, or tool-owner duty. Managers can group staff who share a task, even when their job titles differ.

Use short sessions with enough time to complete the exercise and discuss the result. Provide the same task in a format that works for remote staff and people with different access needs. A facilitator should be available for questions that the written rules do not settle. Send unresolved questions to the plan owner rather than inventing an answer during the session.

For an existing team, start with the tasks where an unchecked output can affect a customer, employee, or business decision. Then work through lower-impact uses and people who support the process. The [use-case ranking article](/blog/how-to-rank-ai-use-cases-by-risk) can help managers agree on that order.

Leave time for staff who miss a session or need another attempt. Their manager should know what work they can perform while the follow-up is pending. Keep the route to the current exercise and contact details easy to find.

## How do you tell whether the plan needs to change?

Look at exercise results alongside questions and problem reports. A cluster of missed source checks may call for a better example, a clearer rule, or a change to the workflow. Ask reviewers what they saw before deciding which response fits. A poor result can expose a weak instruction as well as a learner’s gap.

Usage records can help show whether people are reaching an approved tool after training. They cannot show whether a particular output was checked well. Pair any use data with exercise evidence and manager feedback, and avoid collecting more employee detail than the review needs. The [adoption telemetry template](/resources/adoption-telemetry-dashboard-template) can support a discussion about what to measure.

Ask staff whether the exercise matched their work and whether they could find help. Compare that feedback with the tasks managers listed at the start. Where the task has changed, revise the path and ask the affected staff to practise the new decision. The [people and AI guidebook](https://pair.withgoogle.com/guidebook/) offers prompts for designing around the people who use a system.

End the review with an assigned change, an owner, and a check that the revised material reaches the right group.
