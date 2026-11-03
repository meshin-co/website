---
title: AI readiness assessment template for SMB
description: Use an AI readiness scorecard to assess a proposed workflow, record evidence, and decide what needs work before a pilot.
publishDate: 2026-11-03
updatedDate: 2026-11-03
shortAnswer: An AI readiness assessment template for SMB teams should test a proposed use case across strategy, data, delivery, people, and governance. Record evidence and an owner for each gap, then decide whether to proceed, fix a blocker, or pause. Use the scorecard as the working artifact.
fullAnswer: |-
  An AI readiness assessment template for SMB teams turns a proposed use case into a decision about what to do next. Start with the workflow and the outcome you want to improve. Then use the scorecard to review strategy, data, delivery, people, and governance against evidence from your own business.

  A useful assessment names the person who can supply each answer. It also separates a known gap from an answer nobody has checked. A promising use case may still need work on access, data handling, or staff review before a pilot can start.

  Keep the results close to the work rather than treating them as a company-wide verdict. A team may be ready to test an internal draft while another proposed use needs tighter controls. The output should be a short decision record, with owners and next steps, that a business lead and an engineering lead can both use.
keyTakeaways:
  - Assess a named workflow and its intended outcome rather than giving the whole company a single readiness label.
  - Record evidence, gaps, and owners across strategy, data, delivery, people, and governance.
  - Treat missing evidence as unknown and resolve blockers before a pilot handles live work.
  - Use the assessment to choose a next action, not to claim compliance or predict results.
faq:
  - q: Can a small business use the scorecard without an AI team?
    a: Yes. A business lead can start with a proposed workflow and ask the people who own its data, tools, and daily work for evidence. Bring in specialist help where the team cannot judge a risk or design a control.
  - q: Does a readiness assessment prove we are ready for every AI use?
    a: No. Readiness is tied to the workflow, data, users, and controls assessed. A new use may need a separate review, even when the same tool is involved.
  - q: What should we do if the assessment finds a serious gap?
    a: Record the gap, assign an owner, and hold the affected work until that owner can show the control works. If the gap cannot be closed, change the scope or choose another use case.
category: operating-model
tags:
  - ai-pilots
  - production-readiness
  - ai-governance
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-03'
  - title: Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-03'
  - title: OWASP Top 10 for Large Language Model Applications
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
    publisher: OWASP
    retrieved: '2026-11-03'
author: dmitri
relatedResources:
  - ai-readiness-scorecard
---

## What should the assessment cover?

An AI readiness assessment template for SMB teams works best when it starts with a specific piece of work. Pick a task with a clear owner, a known input, and an output someone can inspect. Writing a draft reply for staff to review is easier to assess than a goal to automate customer service.

Open the [AI readiness scorecard](/resources/ai-readiness-scorecard) and use its strategy, data, delivery, people, and governance axes to structure the review. The scorecard is the artifact. The notes you gather around it explain why you chose each answer and what needs to happen next.

Write down where the task starts and ends, who uses the result, and what happens when the result is wrong. Name the business outcome separately from the proposed tool. That distinction lets the team compare a different approach if the first tool cannot meet the need.

Keep the assessment scoped to the proposed use. A result for an internal draft does not settle whether the same tool should send replies to customers.

## Who should fill in the scorecard?

Ask the person accountable for the outcome to sponsor the review. That person should be able to decide whether the proposed work is worth pursuing and who can make time for it. The sponsor need not supply every technical answer.

Bring in the person who does the work, the owner of the data, and someone who can assess the proposed tools. Ask whoever handles security or privacy to review the parts within their remit. In a small company, one person may hold several of these roles.

Ask each participant for evidence rather than a general opinion. A staff member can show the current workflow and where exceptions occur. A data owner can identify the source and access rules. An engineering lead can show how the proposed tool would connect to existing systems.

Name a decision owner before the review ends. If nobody can accept the remaining risk or fund the fixes, record that as a gap rather than assuming approval will follow.

## How do we assess strategy and the work itself?

Describe the result the business wants in terms the workflow owner can check. For a draft reply, that might be less staff time spent composing routine answers while keeping the review step. Record how staff would judge whether a draft is usable, and keep examples of both usable and poor drafts.

Set a boundary around the proposed test. Note which requests belong in scope and which must go straight to a person. For example, a team might test routine account questions while excluding complaints and requests involving sensitive records.

Check whether the work occurs often enough to justify the setup and review effort. Ask what staff do today when a request falls outside the usual path. The answers may point to a simpler change in the workflow instead of a model.

Choose a comparison before testing. The team can compare reviewed drafts with its current process for the same kind of request. Record what counts as useful, what counts as an error, and who will judge disputed cases.

## What should we check about data?

List the inputs the proposed workflow needs, where they come from, and who is allowed to see them. Include material that staff may paste into a tool, as well as data passed through a system connection. Ask the data owner whether each input is needed for the task.

Review the quality of the source material with the people who use it. Old guidance, conflicting records, and missing fields can make a draft hard to trust. Record who can correct the source and how the team will know which version to use.

Use the site's [data classification](/glossary/data-classification) guidance to discuss the sensitivity of each input. Check the proposed vendor terms and settings for storage, access, deletion, and any use of submitted data. If an answer is unclear, ask the vendor and retain the response with the assessment.

For personal data, use the [privacy framework](https://www.nist.gov/privacy-framework) to help structure the review of data handling. Do not put live records into a test until the relevant owner has agreed on the scope and safeguards.

## How do we judge delivery readiness?

Trace the proposed path from input to reviewed output. Identify where the tool runs, who can access it, and what connects it to business systems. A sketch can expose a missing owner or an unexpected route for data before anyone builds the workflow.

Decide how the team will test outputs against the task. The [evals](/glossary/evals) page explains the site's term for that work. For the assessment, ask who will supply representative cases, review failures, and decide whether a change can proceed.

Plan for the ordinary failure path as well as the happy path. A reviewer needs a way to reject a draft, correct it, and complete the work without relying on the tool. If the tool cannot be reached, staff should know where the task goes instead.

Check access and security before connecting live systems. The [application security guidance](https://owasp.org/www-project-top-10-for-large-language-model-applications/) can help the technical owner frame a review of model-based applications. Record which checks apply to the proposed design and who will perform them.

## How do we assess people and governance?

Ask the staff who will use the tool where they need discretion. A reviewer should know what to check, when to reject an output, and whom to contact when the task falls outside the test scope. Include the work of reviewing and correcting outputs in the plan.

Record the person who owns the proposed use and the person who can stop it. They may be the same person, but the decision should be explicit. Agree how staff report a bad output or a data concern and where that report goes.

The [AI register](/glossary/ai-register) can provide a place to connect the use to its owner and review record. If staff are already using similar tools, ask how they use them and what information they enter. The answer may change the scope of the assessment.

The NIST AI RMF is intended for voluntary use. It can help the team frame its risk discussion, but an assessment using it does not by itself prove compliance or make a use safe.

## How should we record evidence and gaps?

Keep the scorecard answers tied to a working record. The table below is a suggested companion, not a description of fields in the downloadable scorecard. Copy its headings into a document or sheet and add a row for each issue that affects the proposed use.

| Review area | Evidence to seek                                     | Gap and next action                               |
| ----------- | ---------------------------------------------------- | ------------------------------------------------- |
| Strategy    | A named outcome, task boundary, and decision owner   | Define the outcome with the workflow owner        |
| Data        | Sources, access rules, and vendor data settings      | Confirm an unclear setting before using live data |
| Delivery    | A test plan, system path, and fallback               | Prepare test cases and agree who reviews them     |
| People      | Review instructions and a route for reporting errors | Walk staff through the proposed review step       |
| Governance  | A use owner, stop decision, and risk record          | Assign the owner and record the open decision     |

Use plain status labels in the companion record: ready, partial, blocked, or unknown. Agree what evidence is needed to move an item to ready. Unknown means the team has not checked, while blocked means it knows of a problem that prevents the planned test.

Link to the evidence where the team can find it. A policy title alone may be too broad. Point to the relevant section, decision, test result, or vendor response, and note who checked it.

## When is a pilot ready to start?

Review the open items with the decision owner and the people who will run the test. A pilot can start within its agreed scope when the necessary access, data handling, review process, and fallback are in place. Record any remaining limits and the person responsible for watching them.

Do not average away a blocker with strong answers elsewhere. A clear business goal cannot fix an unapproved data flow. If a control is missing, either close the gap or change the test so the gap no longer applies.

Write the decision in terms staff can use. For example, approve a draft-only test with named reviewers and specified inputs, rather than approving the tool for general use. State what would cause the owner to pause the test and how staff should report a problem.

If the team lacks the capacity to assess a material risk, seek a review before proceeding. The [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment) is an option when the business needs help turning open questions into a scoped decision.

## What happens after the assessment?

Assign each open action to a person who can complete it, and agree when the decision owner will check progress. Keep the evidence and decision record with the scorecard so a later reviewer can see what was known when the test was approved.

Revisit the assessment when the proposed use changes. Moving from staff-reviewed drafts to messages sent without review changes the decision, even if the same tool remains in place. New data sources, users, or system connections can also change what needs to be checked.

During a pilot, collect the examples that challenged the original assumptions. A rejected draft may reveal a weak source, an unclear instruction, or a task that should remain with staff. Route the finding to the person who can change that part of the work.

Use the [AI readiness scorecard](/resources/ai-readiness-scorecard) as the starting record, then update the companion notes as decisions and evidence change. Close an action only when its owner can show the agreed result.
