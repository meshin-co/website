---
title: How to rank AI use cases by risk
description: How to rank AI use cases by risk using potential harm, likelihood, control evidence and uncertainty.
publishDate: 2026-11-19
updatedDate: 2026-11-19
shortAnswer: To know how to rank AI use cases by risk, compare plausible harm and likelihood for each real workflow, then check whether its controls work. Give severe or uncertain cases earlier review, even when expected use is low. Record the evidence, owner and next decision so the order can change when the facts do.
fullAnswer: Knowing how to rank AI use cases by risk starts with comparing plausible harm in each real workflow. Judge the use case in its actual setting, not by the model or the team proposing it. Start with a list of workflows and record who is affected, what data each uses and what actions it can take. For each workflow, describe a plausible failure and judge its impact and likelihood before considering controls. Then test the controls that could prevent the failure or limit its effects. Give cases with severe consequences or weak evidence early review, and keep uncertainty visible rather than treating it as low risk. Use the resulting order to decide what needs a deeper assessment, what can proceed with checks and what must wait. A risk ranking is a work queue, not permission to launch. The owner should revisit it when the workflow, users, data or supplier changes.
keyTakeaways:
  - Rank the workflow and its possible harm, rather than the model name alone.
  - Keep impact, likelihood and uncertainty visible instead of hiding them in one score.
  - A control should change the ranking only when evidence shows it works.
  - Assign a decision owner and revisit the order when the use case changes.
faq:
  - q: Should we rank an AI use case before a pilot?
    a: Yes. Use the planned users, data and actions to make an initial ranking. Mark missing evidence and limit the pilot until someone can test the most important assumptions.
  - q: Can a low likelihood make a severe AI risk low priority?
    a: A severe outcome can still need early review, especially when the likelihood estimate is uncertain. Record both judgments and give the decision owner a chance to challenge them.
  - q: Does a risk ranking approve an AI system for launch?
    a: No. The ranking orders review work. A launch decision needs a named owner, evidence about the controls and any required legal or specialist review.
category: governance
tags:
  - ai-governance
  - ai-register
  - security-review
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-19'
  - title: Guidance on AI and data protection
    url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/
    publisher: Information Commissioner's Office
    retrieved: '2026-11-19'
  - title: Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-19'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## How do you start with a list of use cases?

To decide how to rank AI use cases by risk, compare plausible harm before judging business value. Start with the work the system will actually do. A model used to draft internal notes may also be used to send messages to customers. Those uses need separate rows because their audiences and possible harms differ.

For each row, name the business owner and describe the input, output and next action. Record whether a person checks the output and whether the tool can act without that check. Note whose data enters the workflow and where the result goes. If the use is still proposed, write down the intended scope and mark it as untested.

Use the [AI register](/glossary/ai-register) to keep these records together. The [register build article](/blog/how-to-build-an-ai-system-register-in-a-week) covers how to assemble the list. Ask teams about tools already in use as well as planned projects. A list drawn only from purchasing requests can miss work that has already begun. If nobody can name an owner, record that gap and route it for review.

## What harm should you compare?

Describe a failure in terms of what happens to a person or the business. An incorrect summary could cause a staff member to miss a customer complaint. An automated reply could disclose private details to the wrong recipient. A tool with access to a business system could change a record that should remain untouched.

For each scenario, ask who is affected, how serious the effect could be and whether it can be undone. Consider financial loss, exposure of private data, unfair treatment, safety and loss of access to a service. Do not assume every category applies to every case. Choose scenarios that follow from the actual task and its permitted actions.

The [risk framework](https://www.nist.gov/itl/ai-risk-management-framework) can help teams frame those questions. In the register, write the scenario beside the judgment so another reviewer can challenge it. A label such as high impact is hard to test on its own. A description of a wrong recipient receiving a private reply gives the reviewer something concrete to examine.

## How do you judge likelihood with little evidence?

Look at the conditions that make the failure more or less plausible. Relevant details include how often the task occurs, how varied the inputs are and whether the output is sent onward without a check. A narrow trial with sample inputs may tell you less about unusual requests than a test using representative cases.

Use a plain judgment such as likely, possible or unclear. Attach the basis for that judgment, such as test results, staff experience or a supplier record. If the evidence does not support a judgment, write unclear. Do not turn a lack of reported incidents into proof that a failure is rare.

Keep impact and likelihood in separate fields. A possible error in a routine draft and an unclear chance of a serious disclosure call for different questions. Record the latter as uncertain and seek evidence before deciding it is safe. The purpose is to direct review toward the claims that matter, not to manufacture a precise probability.

## What ranking rules should a team use?

Agree on rules before sorting the list. The following bands are a starting point for review order, not a claim of legal status. Apply them to the most consequential plausible scenario for each workflow. Keep the reason for each placement in the record.

| Review band | Place a use case here when                                                                                      | Next step                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| High        | A plausible failure could cause severe harm, or the workflow can cause material harm and key facts are unclear. | Pause any wider launch and assign a deeper review.          |
| Medium      | Harm could be meaningful but is limited in reach, and the team has some evidence about the workflow.            | Test the weak points and set conditions for the next trial. |
| Low         | Plausible harm is limited and reversible, with evidence that the scope stays narrow.                            | Proceed within that scope and watch for changes.            |

When a case fits more than one band, use the higher band until the conflict is resolved. Within a band, review cases with greater potential harm first. If harm is similar, put the case with weaker evidence or broader reach earlier. An owner can change that order, but should record why. A useful queue makes room for judgment without losing the trail behind it.

## When should controls change the ranking?

First record the risk before relying on a control. Then ask what the control does, who runs it and what evidence shows it works in this workflow. A reviewer who checks every outgoing message may reduce the chance of an error reaching a customer. That depends on the reviewer having enough time and authority to stop the message.

Test the check against the failure you described. If the concern is disclosure, use a safe test case that asks the tool to send information to the wrong recipient. Record whether the check catches it and what happens after a catch. A written rule alone does not show that the path is blocked in practice.

Keep the original judgment beside the judgment after tested controls. If a check fails or its owner cannot explain how it runs, leave its effect unproven. The [customer support review article](/blog/how-to-review-ai-generated-customer-support-replies) offers a starting point for examining a human review step. Reviewers should also know how to report an error and stop further use while it is investigated.

## How would the ranking work in practice?

Imagine a team comparing an internal drafting tool, a tool that prepares customer replies and a tool that updates customer records. These are examples, not claims about a particular business. Each starts with a named owner and a description of the proposed task.

The internal drafting tool uses approved material and produces text that staff can edit. If tests support that narrow scope and mistakes are easy to correct, it may enter the low band. The customer reply tool could expose data or send a misleading answer. Until the team tests recipient checks and the review process, it may belong in the high band.

The record update tool can change information used by other staff. If its effects are limited and a reliable check exists, it may fit the medium band. If the team cannot show which records it can change, the uncertainty moves it into high review. The owner should resolve that access question before a wider launch. A different workflow or test result could change any of these placements.

## What needs a specialist review alongside the ranking?

A review band does not decide whether a use is lawful or whether a contract permits it. Ask the right specialist to check the actual data, users, purpose and location. This matters when staff data or customer details enter a tool, or when an output affects access to a service. Record the question and its answer alongside the risk row.

The [data protection guidance for AI](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/) is a source for questions about personal data. The [privacy framework](https://www.nist.gov/privacy-framework) can help structure a broader discussion of privacy risk. Use these sources to frame a review, not as a substitute for advice on the facts of the use.

For a supplier tool, ask what data it receives, who can access it and how changes are communicated. Compare the answers with the planned workflow rather than relying on a general sales description. The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) provides a place to start. If an answer is missing, put it in the open questions and retain the higher review band where warranted.

## Who decides the order and when should it change?

The business owner should propose the ranking because that person knows the task and its intended reach. A risk, security or data specialist should challenge the parts within their remit. Give a named decision maker authority to accept the remaining risk, request more evidence or stop the planned use. Record the decision and its reasons where the use case is listed.

A review should have a trigger as well as an owner. Revisit the row when the tool gains access to new data, reaches a new group or can take a new action. A supplier change, failed test or reported incident can also alter the judgment. Record what changed and which controls need another test.

When a team disagrees, keep both views and the evidence behind them until the decision maker resolves the issue. The [risk sign-off FAQ](/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off) covers the record and ownership question. Close the loop by assigning the next review task to a person, with a due date and a clear decision to make.
