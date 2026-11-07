---
title: AI readiness scorecard five drivers
description: 'AI readiness scorecard five drivers: assess strategy, data, delivery, people, and governance for a specific workflow.'
publishDate: 2026-11-07
updatedDate: 2026-11-07
shortAnswer: The five drivers of an AI readiness scorecard are strategy, data, delivery, people, and governance. Score each against evidence from a specific workflow, then examine the weakest areas before committing to a wider rollout. The result is a starting point for decisions, not proof that a system is safe.
fullAnswer: |-
  An AI readiness scorecard shows whether a proposed AI workflow has the backing, data, delivery capacity, staff support, and risk controls it needs. Start with a workflow that has a clear owner and a decision someone needs to make. For each driver, record the evidence behind the score, the gaps, and the person who can resolve them.

  A useful review looks past the average. Strong data access cannot settle a dispute about who approves a release. Staff training cannot fix a workflow that lacks a way to test changes. Keep those gaps visible even when other parts of the scorecard look strong.

  The self-score gives a team a shared view of its starting position. Use it to decide whether to prepare the workflow, narrow its scope, seek a deeper assessment, or stop. Revisit the scores when the workflow, its data, or the people responsible for it change.
keyTakeaways:
  - Score a named workflow rather than an entire company in the abstract.
  - Keep a link to the evidence and an owner beside each score.
  - Treat a weak driver as a decision to resolve, even when the overall picture looks strong.
  - Use the scorecard to choose the next review or delivery task.
faq:
  - q: Who should fill in an AI readiness scorecard?
    a: The workflow owner should bring together people who know the data, delivery work, staff needs, and risk controls. Each person can provide evidence for the areas they know. The owner then records gaps and settles who will act on them.
  - q: Does a high readiness score mean we can launch?
    a: No. A score helps a team find gaps, but it does not replace a release decision. Check the evidence for the actual workflow, agree on acceptable results, and obtain the required approvals before launch.
  - q: When should we seek an AI readiness assessment?
    a: Seek a deeper assessment when key evidence is missing, owners disagree on risk, or the planned workflow needs decisions that the team cannot settle alone. Bring the scorecard and its supporting records so the review can focus on the open questions.
category: executive
tags:
  - ai-governance
  - ai-pilots
  - production-readiness
sources:
  - title: AI readiness scorecard
    url: https://meshin.co/resources/ai-readiness-scorecard
    publisher: meshin.co
    retrieved: '2026-11-07'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-07'
  - title: 'MLOps: Continuous delivery and automation pipelines in machine learning'
    url: https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning
    publisher: Google Cloud
    retrieved: '2026-11-07'
  - title: OECD AI Principles
    url: https://oecd.ai/en/ai-principles
    publisher: OECD
    retrieved: '2026-11-07'
author: dmitri
relatedResources:
  - ai-readiness-scorecard
---

## How do you use the scorecard for a real decision?

The AI readiness scorecard five drivers framework covers strategy, data, delivery, people, and governance. Begin with the [AI readiness scorecard](/resources/ai-readiness-scorecard) and choose a workflow your team can describe in plain terms. Name its intended users, the output they need, and the decision that follows from it.

A narrow scope makes the answers easier to check. For example, a team might review a proposed tool that drafts replies for staff to inspect. The review should cover the material used to draft replies, the review step, and what happens when the draft is wrong. It should not assume that a score for this task applies to every use of the same tool.

Use the scorecard's own instructions for scoring. Beside each answer, keep a link to the evidence, the name of its owner, and any unresolved question. A policy draft, a working test, and a promise to do the work later carry different weight. Mark missing evidence clearly rather than filling the gap with an optimistic score.

| Driver     | Evidence to look for                                          |
| ---------- | ------------------------------------------------------------- |
| Strategy   | A named problem, owner, and decision about scope              |
| Data       | Permission to use the inputs and a way to check their quality |
| Delivery   | A test method, release owner, and support plan                |
| People     | Time, training, and a clear route to report trouble           |
| Governance | A record of risks, approvals, and response duties             |

The table is a starting point for discussion, not a replacement for the scorecard. Ask each owner to show what exists today, then record what still needs a decision.

## What should strategy prove before work starts?

Strategy connects the proposed workflow to a problem worth solving. Ask the sponsor to describe the current task, who performs it, and what would change if the new workflow worked. The answer should name a business owner who can make trade-offs, not just a team that wants to try a tool.

Agree on an outcome that can be checked against the current process. That might be less time spent drafting a reply, provided the review work does not erase the saving. It might be a better way to find a relevant document, provided staff can check that the result is current. Record how the team will judge the outcome before choosing a vendor or building a demo.

Scope matters as much as the intended benefit. Write down what the workflow will handle, what stays outside it, and when a person must take over. If the sponsor cannot accept those limits, the team has a strategy gap even if the technology looks promising.

The [assessment service](/services/ai-readiness-and-risk-assessment) is a possible next step when the sponsor needs a deeper review of those choices. Bring the proposed scope and the decisions that remain open. This gives the discussion a concrete subject instead of a broad request to become ready for AI.

## Which data questions change the score?

Start with the actual inputs and outputs of the chosen task. List where the source material lives, who controls access, and whether the team has permission to use it for the proposed purpose. Include the text staff enter into the tool as well as the records the tool retrieves or produces.

Then inspect whether the material fits the task. A folder may be easy to reach but contain old instructions, repeated files, or records with no clear owner. Ask who can correct those problems and how the workflow will avoid relying on material that has been withdrawn. A sample review can expose questions that an access request alone will miss.

Sensitive material needs a clear handling decision before it enters a test. The team should know what can be shared with a vendor, where outputs will be stored, and who can see them. Use the site's [data classification](/glossary/data-classification) entry when deciding how to discuss different kinds of material with the people who own them.

Keep access and quality as separate notes. A team may have permission to use a source while lacking confidence in its content. It may also have useful records that cannot yet be shared for the proposed use. Each case calls for a different owner and a different next action.

## Can the team deliver and support the workflow?

A working demonstration gives the team something to inspect, but delivery needs a path for testing, release, and support. Ask who will build or configure the workflow, who can change it, and who will decide whether a change is ready for users. Those duties should survive the end of a pilot.

Prepare examples that represent the work staff expect to do. Include difficult cases and cases where the tool should decline or hand the task back. Agree on how reviewers will judge the results, then keep the examples available when the workflow changes. The [evals entry](/glossary/evals) gives the site definition for this kind of testing.

The team also needs a way to notice trouble after release. Decide where users report a bad result, who checks the report, and how the workflow can be paused or rolled back. Record who pays for support work and where that work sits among other team duties.

For a wider view of production practices, the [machine learning delivery guidance](https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning) offers material to consider. Apply its ideas to the proposed workflow rather than assuming that every practice fits a small internal tool.

## Are the people doing the work ready to use it?

Talk to the staff who will use the output, not just the sponsor who requested it. Ask what they need to inspect, where errors would be costly, and whether the proposed handoff fits their working day. A process that depends on careful review needs enough time for that review to happen.

Training should follow the task. Show users what the tool is meant to do, what material they may enter, and how to reject or correct an output. Give reviewers a route to a person who can answer questions. Keep the instructions close to the work rather than relying on a single launch session.

Check the effect on roles and workload. If staff must review every draft, their manager needs to account for that work. If a specialist must approve exceptions, the specialist needs time and a way to see the relevant record. An owner named on paper may not have the authority or capacity to carry out the role.

Ask for a small trial with the people who would use the workflow. Watch where they pause, work around the tool, or return to the old process. Record what they say alongside the scores. The [adoption telemetry template](/resources/adoption-telemetry-dashboard-template) can help a team plan what to observe once use begins.

## How should governance affect a launch decision?

Governance starts with clear ownership of the risks and decisions tied to the workflow. Identify who can approve the use, who can accept an open risk, and who must be told when something goes wrong. The site's [AI governance entry](/glossary/ai-governance) provides the definition used across these pages.

Put the decision in a record that the delivery team can find. Describe the intended use, the data involved, the main failure cases, and the controls the team plans to use. Note any open issue, its owner, and the decision needed to close it. A record with no route to approval leaves the team guessing at release time.

Vendor use deserves the same attention as an internal build. Ask what the supplier can access, what the contract permits, and how the team would stop using the service. The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) provides questions to take into that conversation. Have the relevant contract and security owners check the answers.

For a broader view of risk across design, use, and review, consult the [risk management framework](https://www.nist.gov/itl/ai-risk-management-framework). The [AI principles](https://oecd.ai/en/ai-principles) offer another source for questions about responsible use. Neither link settles the approval for a particular workflow. The named owner must make that decision against the evidence at hand.

## What should happen after the scores are recorded?

Read across the drivers before discussing any overall result. Look for a gap that could block the specific workflow, even if other areas appear ready. A team might have a clear business case and willing users, yet lack permission to use the source records. In that case, a delivery plan should wait for a data decision.

Turn each material gap into a task with an owner and a decision point. State what evidence would change the assessment, where that evidence will be kept, and who will review it. If the team cannot name those things, the next action may be to narrow the workflow rather than continue building it.

Keep disagreements in the record. A delivery lead may judge a test set adequate while a user sees missing cases. Ask both people to identify the examples behind their views, then agree on who can accept the remaining uncertainty. Do not erase the disagreement merely to produce a tidy score.

Revisit the scorecard when the workflow changes in a way that affects the answers. New users, new source material, or a different vendor can alter the evidence the team relied on. If the open questions span several owners or call for an independent view, take the completed scorecard into an [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment).
