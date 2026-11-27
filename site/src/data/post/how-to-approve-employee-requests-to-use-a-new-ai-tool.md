---
title: How to approve employee requests to use a new AI tool
description: How to approve employee requests to use a new AI tool by reviewing the task, data, vendor terms and access conditions.
publishDate: 2026-11-27
updatedDate: 2026-11-27
shortAnswer: A review of the task, data, vendor terms and risks shows how to approve employee requests to use a new AI tool. Assign a decision owner, involve security and privacy reviewers where needed, and record the permitted use. Grant access only after the required conditions are met.
fullAnswer: To decide how to approve employee requests to use a new AI tool, review the task, data, vendor terms and access conditions. Ask what the employee wants to do, what information the tool will receive and who will rely on its output. A named owner can then route the request to the people who can assess data, security, purchasing and business risk. Give reviewers a way to approve a limited trial, ask for changes or decline the request. Record the decision alongside its conditions, such as which data may be entered and whether a person must check the output. Access should follow the decision, not precede it. Tell the employee what was decided and where to ask for a review if the task changes. A shared record also helps the company spot repeat requests and revisit approvals when a vendor changes its terms or features.
keyTakeaways:
  - Review the proposed task and data, not just the tool's name.
  - Give each request a decision owner and route it to reviewers based on risk.
  - Record the permitted use and conditions before granting access.
  - Revisit approval when the task, data or vendor terms change.
faq:
  - q: Can an employee try a new AI tool before it is approved?
    a: Allow a trial only after an owner has approved its scope and access conditions. Use test material that the company has cleared for that purpose, and keep the trial separate from live decisions.
  - q: Who should approve a new AI tool request?
    a: A designated business owner should make the recorded decision after the required reviewers have checked the request. Security, privacy, procurement and legal staff may need to contribute, depending on the proposed use.
  - q: Does approval for one team cover the whole company?
    a: Only if the recorded decision says so. A team using different data or relying on the output for a different purpose should ask the owner to review that change.
category: operating-model
tags:
  - ai-governance
  - security-review
  - acceptable-use-policy
sources:
  - title: Regulation (EU) 2016/679
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
    publisher: European Union
    retrieved: '2026-11-27'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-27'
  - title: Guidelines for secure AI system development
    url: https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development
    publisher: National Cyber Security Centre
    retrieved: '2026-11-27'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## What should an employee put in the request?

To decide how to approve employee requests to use a new AI tool, start with the work the employee wants to do. Ask for the task, expected users, proposed tool and the result the team wants. A request to draft internal notes has a different scope from one that sends replies to customers.

Ask the employee to describe the information the tool would receive. That includes files, prompts, connected systems and any records the tool might create. The employee should identify the most sensitive material they expect to use, even if the initial trial uses sample data.

The form should also ask whether the tool will suggest content, make a decision or take an action. Find out who will check its work and what happens when the output is wrong. An answer such as “improve productivity” is too broad to approve on its own.

Give the requester a place to name a sponsor and explain any time pressure. If a field is unknown, the owner can return the request for clarification. The employee should not have to negotiate vendor terms or complete a security review alone.

## Who makes the decision?

Give every request one decision owner who can coordinate the review and communicate the outcome. That person needs enough authority to accept the business risk or send it to someone who can. A team manager may sponsor the request without being the right person to sign off on every risk.

The owner should bring in reviewers according to the proposed use. Security can examine access, integrations and vendor controls. Privacy and legal staff can assess data handling and terms where their input is needed. Procurement can check the purchase route and contract owner. The business sponsor should explain the task and arrange a test of the output.

A reviewer should state whether their concern is resolved, still open or outside their remit. Silence should not count as approval. If reviewers disagree, the decision owner should document the issue and send it to the person authorized to accept that risk.

Set a normal response target that fits the team’s capacity, and name a backup for absences. Tell employees where to check progress. The existing [vendor risk sign-off guidance](/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off) can help connect the request to the company’s wider process.

## How much review does a request need?

The review should follow the proposed use. A restricted test with cleared sample text may need fewer checks than a tool connected to a customer database. A tool that can send messages or change records needs scrutiny of those actions, even if staff plan to watch it.

| Request feature                               | Review focus                                          | Possible decision                       |
| --------------------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| Sample material and no system connection      | Confirm the material, users and trial boundary        | Approve a limited test                  |
| Customer or employee information              | Check the data, terms and permitted processing        | Hold until the relevant reviewers agree |
| Access to company systems or external actions | Check permissions, output checks and ways to stop use | Limit access or require further review  |
| A use that cannot meet required controls      | Record the unresolved risk and available alternatives | Decline or return for changes           |

These rows are prompts for a decision, not automatic rules. A harmless-looking task can still expose sensitive material through an attachment or a connected account. Ask the requester to show the intended workflow before deciding that a review can be brief.

The [risk management framework](https://www.nist.gov/itl/ai-risk-management-framework) provides a useful reference for organizing the discussion. For a company-specific ranking method, use the existing [use case risk guidance](/blog/how-to-rank-ai-use-cases-by-risk).

## What data and vendor checks come before approval?

List the data the tool will receive and the data it may produce. Ask whether the vendor stores prompts and files, uses them to improve its services, or shares them with other providers. Check the contract and product settings rather than relying on a sales description. If the answers are missing, hold the request or narrow the trial to material cleared for it.

The GDPR requires personal data to be adequate, relevant and limited to what is necessary for the purposes of processing. The [regulation’s text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) is the source for that rule. The privacy reviewer should also decide what other legal checks the proposed use needs. A business approval does not settle those questions by itself.

Security review should cover account ownership, access controls, connected systems and the vendor’s response to a security issue. Ask who can see the submitted material and how the company can remove access. The [secure AI system development guidelines](https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development) offer a reference for security questions across a system’s life.

Keep the evidence with the decision. A link to the applicable terms, the settings checked and any unresolved vendor answer lets a later reviewer see what was actually approved. The [vendor questionnaire](/blog/ai-vendor-assessment-questionnaire-template) offers a fuller set of questions when the purchase needs one.

## When is a limited trial the right decision?

A limited trial can answer whether a tool helps with the proposed task before the company commits to wider use. The decision owner should name the participants, permitted material and intended test. Set an end point and a person responsible for reporting the result.

Use sample or synthetic material only after the data owner confirms it is suitable. Sample files can still contain real names, secrets or copied customer text. The trial should keep live records and connected systems out of scope unless the relevant reviewers have approved them.

Agree how the team will judge the output before testing starts. For example, a reviewer might compare draft replies with the source material and record errors that would matter to a customer. The test should include awkward cases, not just examples chosen because the tool handles them well.

A successful trial is evidence for a later decision, not permission to expand automatically. The owner should review the findings, outstanding risks and proposed changes. If the team wants to add live data or connect another system, it should submit that change for review before doing so.

## What should the approval record contain?

The record should let another person reconstruct the decision without searching through a long email thread. Store the request, decision date, owner, reviewers and their conclusions together. Include links to the terms and evidence used in the review, with access limited where the material is sensitive.

Describe the approved task in plain language. Name the user group, allowed data, approved account and any permitted connections. Record who must check outputs and whether the tool may send content or change records. If the answer is no, say so directly.

Conditions need an owner and a way to verify completion. For example, an approval might depend on disabling a vendor setting before access is granted. Record who will check that setting and where the proof belongs. An open condition should leave the request on hold, rather than produce an ambiguous approval.

Use the company’s [AI register](/glossary/ai-register) to link the request to the tool’s ongoing record. Keep a declined request too, along with the reason and any alternative offered. That history helps staff understand whether a later request is genuinely different.

## How should the decision reach the employee?

Send the requester a clear outcome: approved, approved with conditions, returned for changes or declined. State the task and data covered by the decision. Link to the record or provide a short copy of its practical limits. The employee should know what they may do without reading the contract.

For an approval with conditions, tell the employee which conditions are already met and who will handle the rest. Access should be granted through the company’s normal account process after those checks. A personal account or an unreviewed browser extension should not become a workaround for a pending request.

A decline should explain the risk in terms the requester can act on. Suggest an approved tool or a narrower task when one is available. If the employee disagrees or has new evidence, give them a route back to the decision owner. Keep that route separate from the process for reporting an urgent security concern.

Employees may already be using the tool when they submit a request. Ask them to stop the unapproved use while the owner assesses what happened and what data was involved. The [existing guidance on unapproved tools](/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval) covers that conversation.

## When should an approval be reviewed again?

Set a review point when the decision is recorded and name the person who will start it. The owner should check that the tool is still used for the approved task, that the user group is current and that required controls remain in place. The [access review process](/blog/how-to-run-a-quarterly-ai-tool-access-review) can provide a place to check who still needs an account.

A material change can also trigger an earlier review. Examples include a new data source, a wider user group, a new system connection or a vendor change to data use terms. The person proposing the change should describe it to the owner before the new use begins.

At review, the owner can renew the existing scope, revise its conditions or withdraw approval. Record the reason and tell affected users what happens to their access and work. If a contract ends or the tool is replaced, agree how to export or delete company material and who will confirm the account is closed.
