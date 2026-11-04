---
title: Named person responsible for AI risk in vendor procurement
description: How a named AI risk owner coordinates vendor review, records decisions, and answers customer procurement questions.
publishDate: 2026-11-03
updatedDate: 2026-11-03
shortAnswer: A named person responsible for AI risk in vendor procurement coordinates the review, records unresolved risks, and routes decisions to the people authorized to approve them. That person needs access to vendor evidence and internal specialists. The role should be written into the purchasing process and customer questionnaire workflow.
fullAnswer: |-
  A named person responsible for AI risk in vendor procurement gives buyers and internal teams a clear contact for evidence, decisions, and follow-up. The role covers the AI service being purchased, the data it will handle, and the risks that remain open. It does not replace the legal, security, or business owners who hold their own approval rights.

  The named owner should know which vendor is under review, what the business wants to do with the service, and who can accept any remaining risk. They should record the evidence behind each answer and keep the review current when the service or its use changes. For a customer asking about your own company, the same discipline applies in reverse: the owner gathers answers from the teams that operate the service and makes sure commitments match what those teams can deliver. The purchasing team can then see who will respond when an answer is challenged.
keyTakeaways:
  - Name an AI risk owner for each vendor review and give that person a clear route to decision-makers.
  - Keep the evidence, open risks, and approval record with the specific vendor use case.
  - Separate the person who coordinates the review from the people who can accept risk or sign a contract.
  - Check customer questionnaire answers against the service as it actually operates.
faq:
  - q: Who should be named as the AI risk owner during vendor procurement?
    a: Name someone who can coordinate the review, obtain evidence, and reach the people who own security, legal, and business decisions. The right person may be an internal AI lead or an agreed external officer. Record the scope and approval limits of the role.
  - q: Can an external AI officer sign off every vendor risk?
    a: An external officer can coordinate a review and recommend a decision. Whether that person can accept a risk or sign a contract depends on the authority the company has granted. Keep that authority explicit in the engagement and approval record.
  - q: Who answers a customer's AI security questionnaire?
    a: The named owner can coordinate the response and collect evidence from the teams that run the service. Security, legal, engineering, and the business may need to check answers within their remit. The final response should identify any conditions or gaps.
category: governance
tags:
  - ai-governance
  - security-review
  - ai-register
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-03'
  - title: Cyber Supply Chain Risk Management
    url: https://csrc.nist.gov/projects/cyber-supply-chain-risk-management
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-03'
  - title: Guidance on AI and data protection
    url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/
    publisher: Information Commissioner's Office
    retrieved: '2026-11-03'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
  - build-vs-buy-ai-kit
  - handover-playbook
---

## Who should own AI risk in a vendor review?

The named AI risk owner coordinates vendor review, records unresolved risks, and routes each decision to the person with authority to approve it. Choose someone who can follow the purchase from the first request through the final decision. A job title alone does not give that person access to evidence or the authority to resolve a dispute.

Start with the intended use. A writing tool used for public copy raises different questions from a service handling customer records. The owner needs the business request, the proposed data, the expected users, and a description of where the vendor's output will go. Ask the requester to name the decision or workflow that depends on the output.

The owner then finds the specialists needed for that use. Security can assess access and technical controls. Legal can examine contract terms and data commitments. The business owner can judge whether the remaining risk is acceptable for the intended work, within the company's approval rules.

Record a deputy or a handover contact for absences. Without one, a review can stall when a customer or vendor asks a question after the purchase. The [AI register](/glossary/ai-register) can link the service to its owner and review record without turning the register into a substitute for the underlying evidence.

## What authority does the named person need?

The owner needs permission to request documents, convene reviewers, challenge an incomplete answer, and return a purchase for more work. They also need a route to someone who can decide when the evidence remains incomplete. These rights should be agreed before a difficult review reaches a deadline.

Use the following split as a starting point, then adapt it to the company's actual approval rules.

| Role                         | Decision or contribution                                       |
| ---------------------------- | -------------------------------------------------------------- |
| AI risk owner                | Coordinates the review, records gaps, and recommends a path.   |
| Business owner               | Confirms the use case and seeks approval for residual risk.    |
| Security and legal reviewers | Assess evidence and terms within their respective remits.      |
| Authorized approver          | Accepts risk or signs the purchase within delegated authority. |

One person may hold more than one role. The record should still show which decision they made and under what authority. If the AI risk owner is external, the engagement should say whether that person can make decisions or only recommend them.

A recommendation to proceed is not a contract signature. Equally, a security review does not establish that the business has accepted every remaining risk. Link each open issue to the person who can close it, accept it, or stop the purchase.

## What should the owner ask the vendor for?

Ask for evidence that matches the proposed use, rather than sending a questionnaire without context. Give the vendor a short description of the workflow and the kinds of data involved. Ask which parts of the service receive that data and which other providers take part in delivering it.

Request the terms and technical material that explain access, retention, deletion, incident handling, and changes to the service. Where model training is relevant, ask whether the vendor uses customer data for that purpose and what choices are available. Check the answer against the contract and the settings the team will actually use. The site's [answer about model training and customer data](/faq/are-models-trained-on-our-customer-data) offers a related starting point for that discussion.

Evidence needs a clear scope. A document about a vendor's general security program may not describe a particular model, product feature, or deployment. Ask the vendor to identify the service and configuration covered by each answer. If the vendor cannot provide a document, record the gap and ask what alternative evidence it can share.

The [cyber supply chain guidance](https://csrc.nist.gov/projects/cyber-supply-chain-risk-management) is useful background for examining supplier relationships. Apply its ideas to the actual purchase rather than treating a vendor's completed form as the decision itself.

## How should the owner test claims against the intended use?

A vendor answer is useful only if the team can connect it to the proposed workflow. Compare the response with the planned data flows, user access, and output handling. If the purchase request says customer records will be entered, a promise about public test data does not answer the question.

Ask engineering to show where data enters the service and where results return. Find out whether staff can change the model, add connected tools, or send output to another system. Those choices can change the risk even when the supplier and contract stay the same.

For a service that generates an answer used in a decision, agree how people will check the result. Define who may rely on it and what happens when the output is wrong or unsupported. The [human oversight](/glossary/human-oversight) page provides a related route for examining that part of the workflow.

The [risk framework guidance](https://www.nist.gov/itl/ai-risk-management-framework) provides a broader structure for assessing AI risks. The owner can use that structure to frame questions, while the technical and business teams supply evidence from their own use. Keep the distinction clear between a vendor's description of a control and proof that the chosen setup uses it.

## How are gaps and risk acceptance recorded?

Keep a decision record with the purchase, not just a copy of the vendor's answers. Describe the intended use, the evidence reviewed, the open gaps, and the person responsible for each follow-up. State whether the business can proceed, must change the proposed use, or needs a further decision.

For each gap, write down its practical consequence. An unclear deletion term, for example, matters because the business may not know what happens to submitted data when the service ends. Record the vendor's response, any internal check, and the conditions attached to approval. Avoid marking a gap closed merely because someone has agreed to revisit it.

If a decision-maker accepts a risk, record the scope of that acceptance. Approval for a limited internal trial should not silently become approval for customer-facing use. The record should identify the approver, the reason for the decision, and the event that prompts another review.

The [risk sign-off answer](/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off) connects this step to the site's wider approach. Link the decision from the register so a later reviewer can find the source documents and see what was actually approved.

## Who answers a customer's procurement questionnaire?

When your company is the supplier, the question comes from the other direction. The customer wants to know who can explain your AI controls and stand behind the answers. The named owner gathers the response, checks its scope, and brings in the people who operate the service.

The site's [customer questionnaire answer](/faq/who-answers-customer-security-questionnaires) states: “I do, as the named officer on record.” For the retainer, confirm the named contact, the work covered, and the decision rights in the engagement. The [fractional chief AI officer service](/services/fractional-caio-retainer) is the relevant route for that discussion.

Before sending a response, compare it with the product the customer will receive. Ask engineering to check the deployment and data flows. Ask security and legal to review statements in their areas. If a control is planned or applies only to a different service, say so rather than presenting it as universal.

Keep a record of the submitted answers and the evidence behind them. A customer may return with a contract clause or an audit request that refers to the response. The owner should be able to find the source, identify who checked it, and route a challenge to the right team.

## When should a vendor review be reopened?

Reopen the review when the proposed use changes enough to affect an earlier decision. Examples include a new category of data, a wider group of users, or a connection that lets the service send results elsewhere. A vendor change can matter too, especially when it affects the service or evidence the company relied on.

The owner should agree how teams will report such changes. Procurement may hear about contract changes first, while engineering may see a new feature in use. A short route back to the owner helps both teams flag changes before an old approval gets reused in a different setting.

Check whether the original decision still covers the new use. If it does not, ask the relevant reviewers to examine the change and record a fresh decision. Keep the earlier record so the team can see what changed and why. Do not erase an accepted gap just because the vendor has supplied an updated document.

For questions about personal data, the [data protection guidance for AI](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/) offers material to discuss with the person responsible for privacy. Their review should follow the actual data and service configuration, rather than a generic product label.

## What should be agreed before an external owner starts?

Set the boundary of the work before naming an external person in a procurement response. Identify the services and vendor reviews they will cover, the internal contacts they can call on, and the records they can access. Agree who answers when the named person is unavailable.

The company should retain a clear route for decisions it has not delegated. Give the external owner a way to raise an urgent gap and identify the internal person who can pause a purchase or accept a risk. If the officer will speak directly to customers, agree who checks the response and who may make contractual commitments.

Also decide where review records will live. The company needs access to vendor evidence, decision notes, and customer responses after the engagement ends. A handover should identify open actions and the next contact for each one. The [handover playbook](/resources/handover-playbook) provides a place to start that discussion.

Before sending the next questionnaire, test the arrangement with an actual request. Ask the proposed owner to trace an answer from the customer's question to the supporting evidence and its internal reviewer. Any missing access or unclear approval right is then visible before the answer becomes a commitment.
