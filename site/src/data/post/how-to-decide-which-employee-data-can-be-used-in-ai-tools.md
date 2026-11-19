---
title: How to decide which employee data can be used in AI tools
description: How to decide which employee data can be used in AI tools depends on the task, the fields, vendor terms and approval controls.
publishDate: 2026-11-12
updatedDate: 2026-11-12
shortAnswer: Decide which employee data can be used in AI tools by checking the task, each field, the tool's data handling and the people affected. Start with the least data needed, hold sensitive records for review, and approve a specific use rather than granting a tool blanket access.
fullAnswer: A sound decision about employee data in AI tools starts with a specific task and a list of the fields it needs. A tool that drafts a job description has different needs from one that searches personnel files. Ask whether the task can be done with synthetic examples, redacted text or an aggregate instead of identifiable records. Hold health information, pay records, grievances and material used in employment decisions for a privacy and legal review before any upload. Check what the vendor retains, who can access it, where it goes and whether it can be used to train models. Record the decision with the data owner, permitted users, purpose and controls. Then test those controls in the actual workflow, including logs, exports and output. Approval should expire or be reviewed when the task, data or tool changes. If the safeguards cannot be checked, keep the data out.
keyTakeaways:
  - Approve a defined task and data set rather than an AI tool for all employee records.
  - Use the smallest useful input and check whether removed details can still identify someone.
  - Hold sensitive records and employment decisions for privacy, legal and people-team review.
  - Check retention, access, model training and downstream handling before sending real records.
  - Record an owner and a stop condition for each approved use.
faq:
  - q: Can staff paste employee records into an approved AI tool?
    a: Only if the approval covers that task, those records and the tool's actual settings. Tool approval alone does not establish that a personnel record is suitable for upload.
  - q: Can we use employee data if we remove names?
    a: Removing names can reduce exposure, but other details may still identify a person. Check the remaining text and the output against the people and records available to the intended users.
  - q: Who should approve an AI use involving employee data?
    a: The data owner should agree to the proposed use, with privacy, legal, security and people-team input where the records or decision warrant it. Record who made the final decision and what it covers.
category: governance
tags:
  - ai-governance
  - acceptable-use-policy
  - security-review
sources:
  - title: Data minimisation
    url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/
    publisher: Information Commissioner's Office
    retrieved: '2026-11-12'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-12'
  - title: Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-12'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## What task needs employee data?

The practical question is how to decide which employee data can be used in AI tools for a specific task. Start by writing down the action the user wants to take and the result they need. Include who will see that result and what decision, if any, it will support.

A manager who wants a draft job description can often start with a role outline. A request to summarize named staff reviews calls for a different check. The latter brings existing records and their context into the workflow, so the review must cover those records rather than the tool alone.

Ask the requester to show a sample input using invented details. Then ask what useful output would look like and whether a person could complete the task without uploading a record. A broad aim such as improving people operations does not establish which fields the tool needs.

Write the agreed task in the [AI system register](/glossary/ai-register). Name the team responsible for the use and the person who can stop it. That record gives later reviewers a clear boundary to test.

## Which fields are actually needed?

List every field and document the workflow would send, including attachments and text copied into prompts. For each field, state what it contributes to the result. If the requester cannot explain the need, leave the field out of the proposed input.

| Proposed input            | Decision to test                                       | Safer starting point                      |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| Role title and duties     | Does the draft need details about a particular person? | Use a generic role outline.               |
| Staff feedback            | Does the task require the original wording?            | Try themes reviewed by a person.          |
| Pay or health details     | Is there a specific need that warrants review?         | Keep the details out until review.        |
| Names and contact details | Must the recipient identify the employee?              | Remove them and check the remaining text. |

Use the site's [data classification](/glossary/data-classification) guidance when deciding how to handle the proposed fields. Compare the list with the regulator's [data minimisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/). Deleting a name is useful only if job details, dates or unusual events do not reveal the person anyway. Test the sample with someone who knows the team and can spot those clues.

## Which records should wait for review?

Hold health details, grievances, disciplinary records and pay information out of the tool while the relevant teams review the proposed use. Apply the same pause to records about candidates or staff where an output could affect hiring, pay, promotion or dismissal. The review should cover the decision process as well as the document itself.

Ask the people team what context a short extract would lose. A grievance summary, for example, may contain allegations that need careful handling and a route for correction. A pay analysis may expose a person even when the report shows only a small team.

Privacy and legal reviewers should assess the applicable rules, the purpose and whether affected people need information or a way to challenge the use. Do not treat an employee's agreement by itself as a substitute for that review. The answer can vary by location, record and task.

If the review is incomplete, use a fictional example to test the workflow. Do not send a real file simply to see whether the tool produces a useful answer.

## What must the vendor confirm before an upload?

Check the contract, product settings and any connected services against the proposed task. A sales statement about privacy is not enough to establish what happens in the account your staff will use. Ask for the terms and settings that apply to that account and its chosen features.

Find out whether prompts, files and outputs are stored, for how long, and whether the vendor or its service providers can access them. Check whether any of that material can be used to train or improve models. Also ask where processing and storage take place, how deletion works and what happens to backups.

Include logs, support access and connected search tools in the review. A short retention setting for uploaded files may not cover every copy produced by the workflow. Record unanswered questions as reasons to hold approval, rather than assuming the safest setting applies.

The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) can help structure these checks. Test the settings in the intended account before staff use it, and keep evidence of the configuration with the decision.

## Who can approve the proposed use?

The person responsible for the records should confirm that the task needs the proposed data. Security should check the tool and access controls. Privacy, legal and the people team should join when the records or intended decision warrant their review.

Give reviewers a short decision record with the task, sample input, expected output and users. Add the vendor findings, locations, retention settings and any unresolved questions. Make clear whether the use is approved, held for changes or refused, and name the person who made that call.

Approval should describe the actual boundary. For example, a team might receive permission to draft a role profile from a generic outline, while named employee reviews remain outside scope. A later request to summarize those reviews needs its own assessment.

Use the [AI risk guidance](https://www.nist.gov/itl/ai-risk-management-framework) to structure the discussion of risks and responses. Record any accepted risk with its owner and the reason for accepting it. If reviewers disagree, leave the proposed upload on hold until the decision owner resolves the issue.

## How should access and retention work?

Limit access to the people who need the approved task, rather than opening a shared workspace to the whole company. Check both the source records and the AI tool. A user who can run a prompt should not gain wider access to personnel files through a connected search feature.

Set the shortest retention period that meets the documented need and can actually be enforced. Check whether users can export results, share conversations or attach files from other systems. Decide who can change these settings and how the team will notice a change.

Run a test with invented records before connecting live data. Try an account that should have access and another that should not. Inspect what appears in the conversation history, audit records and any downstream storage, then remove the test material under the agreed process.

Use the [privacy risk guidance](https://www.nist.gov/privacy-framework) to help examine how data moves through the workflow. If the tool cannot enforce a necessary boundary, change the workflow or choose another tool. A written rule alone cannot block a shared link.

## How should staff handle prompts and outputs?

Give users examples that show the approved boundary in the place where they work. A policy can tell staff which tasks are allowed, but the upload screen also needs clear instructions about which files to leave out. Link the rule to the existing [acceptable use policy](/blog/ai-acceptable-use-policy-for-a-50-person-company).

Ask users to inspect copied text before sending it. Comments, document properties and pasted email threads may carry details beyond the passage they meant to submit. Where possible, prepare a clean input outside the tool and have the data owner check it.

Treat the output as employee-related material when it contains or reveals details about a person. Set rules for who can read it, where it can be saved and when it should be removed. A generated summary may also be wrong or omit context, so a qualified person should check it against the source before acting.

Give staff a way to report an accidental upload without hiding it. The response should cover access, deletion requests, internal review and any notice that the applicable rules require.

## When should the decision be reviewed or stopped?

Review the decision when the task, data source, users, vendor terms or tool settings change. A new feature that searches staff files can alter the data flow even if the product name stays the same. A change in the people who receive outputs can alter the risk too.

Set a review date in the decision record and name the person responsible for checking it. That person should confirm that the current configuration still matches the approval. They should also sample the workflow for uploads, exports or uses outside the agreed scope.

Stop the use if staff send records that were not approved, a required control fails or the vendor cannot answer a material question. Preserve the evidence needed to understand what happened, restrict further access and involve the teams named in the response plan. Restart only after the decision owner accepts the fix.

For each proposed use, leave the requester with a clear next step: prepare a fictional sample, remove an unneeded field or supply the missing vendor evidence. That makes a held decision useful without turning uncertainty into permission.
