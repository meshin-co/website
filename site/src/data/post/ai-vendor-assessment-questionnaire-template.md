---
title: AI vendor assessment questionnaire template
description: Use an AI vendor assessment questionnaire template to check data handling, security, model changes and incident response before buying.
publishDate: 2026-11-05
updatedDate: 2026-11-05
shortAnswer: An AI vendor assessment questionnaire template helps buyers ask how a supplier handles data, secures its service, tests its models and responds to incidents. Use the answers to assign a reviewer, request evidence and record a buying decision. The questions should match the intended use and the data involved.
fullAnswer: |-
  An AI vendor assessment questionnaire template helps a buyer check whether a supplier can support a proposed use without leaving data handling and risk decisions unclear. Start with the intended workflow and the information it will send to the service. Then ask the vendor for specific answers about data use, access, retention, model changes and incident response. Request evidence that applies to the product and contract you plan to buy.

  The questionnaire is a decision aid, not a substitute for a contract or a security review. A reviewer still needs to check whether the answers fit the intended use, identify gaps and assign any conditions for approval. The AI governance starter kit contains a vendor questionnaire alongside other procurement documents. The template here helps a buyer prepare the questions, judge the responses and carry open issues through to a signed decision.
keyTakeaways:
  - Scope the review around the proposed workflow and the data it will send.
  - Ask vendors for evidence that covers the product and contract under review.
  - Record unresolved gaps, decision owners and conditions before purchase.
  - Repeat the review when a material change affects the agreed use.
faq:
  - q: Can we use the same questionnaire for every AI vendor?
    a: Use a common set of questions, then adjust the depth for the proposed workflow, data and permissions. A tool with access to sensitive records or the ability to act on them needs closer review than a tool limited to public information.
  - q: What if a vendor will not share security evidence?
    a: Ask for a summary, an agreed review method or a relevant contract commitment. If the gap remains, record it and have the person responsible for the purchase decide whether to accept it, restrict the use or stop the purchase.
category: governance
tags:
  - ai-governance
  - security-review
sources:
  - title: Regulation (EU) 2016/679
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    publisher: European Union
    retrieved: '2026-11-05'
  - title: OWASP Top 10 for Large Language Model Applications
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
    publisher: OWASP Foundation
    retrieved: '2026-11-05'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-05'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## Where can I get an AI vendor assessment questionnaire template?

The [AI governance starter kit](/resources/ai-governance-starter-kit) contains a vendor questionnaire alongside the other documents used in a procurement review. Start there if you need the artifact. The questions in this article help you adapt a review to the service you want to buy.

Write down the product name, the proposed workflow and the business owner before sending questions. Describe what people will submit, what the service will return and who will use the output. Include any planned links to internal systems or customer records.

Give the vendor enough context to answer for the right product and settings. A response about a different service or a feature you will not buy may leave the actual use unchecked. Ask the supplier to identify any answers that depend on a contract, configuration or optional feature.

Keep the completed questionnaire with the review record, rather than treating the returned file as approval. The buyer still needs to compare the answers with the intended use and decide who will resolve gaps.

## What questions should we send the vendor?

Copy the prompts into your review record and leave space for an answer, evidence and a follow-up. Ask for the product and contract scope beside each response. The prompts below are a starting point, not a scorecard with automatic pass marks.

| Topic                | Prompt for the vendor                                                                                 | Evidence to request                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Data use             | Describe how inputs, outputs and uploaded files are used, including any model training.               | Product terms and settings that govern the proposed use.   |
| Storage and deletion | State where data is stored, how long it is kept and how deletion works.                               | Retention terms and a description of the deletion process. |
| Access and suppliers | Identify who can access customer data and which other suppliers handle it.                            | Access controls and the applicable supplier list.          |
| Security             | Describe how access, encryption and security testing apply to the service.                            | A recent security report or a written control summary.     |
| Model behavior       | Explain how the service is tested, changed and monitored for the intended task.                       | Test scope, known limits and change notices.               |
| Incidents            | Explain how the vendor detects, reports and handles incidents affecting customer data or service use. | Incident terms, contact route and response process.        |

Ask for a named contact who can clarify technical answers. If a response applies only under particular settings, have the vendor state those settings. Record who will check them before the service goes live.

## How much detail should the review ask for?

Match the review to what the service can see and do. A tool used with public text presents a different buying decision from a tool that can read customer records or change them. The reviewer should understand the proposed access before deciding how much evidence to request.

Map the path of the data from the user or source system to the vendor and back. Include files, prompts, outputs and any logs that may contain copies. Note who can view each part and whether the service can call another tool or take an action.

Use the site's [data classification](/glossary/data-classification) page when deciding what information may enter the service. If the intended data is not yet known, ask the business owner to settle that question before approval. A broad claim that the tool is safe for all data does not resolve the gap.

Document the boundary of the purchase as well. A pilot with restricted data and users may need different conditions from a service connected to live operations. The decision should say which use has been reviewed and which uses need another check.

## What should we ask about data and training?

Ask the vendor to distinguish service delivery from model training and other uses of customer content. Cover prompts, uploaded files, outputs and any data kept in logs. A reply that addresses only uploaded files may leave other copies outside the answer.

Request the default setting, the setting available under the proposed contract and the steps needed to change it. If an administrator must turn a control on, assign someone to verify it. Keep the written terms with the setting record so the team can see what was agreed.

Ask where the service stores and processes the data, including any suppliers involved. The [sub-processor](/glossary/sub-processor) page provides context for reviewing those relationships. Request notice of changes that would affect the agreed handling of the data.

For a processor handling personal data, GDPR Article 28 calls for a contract or other legal act that sets out the subject matter and duration of processing. Read the [regulation](https://eur-lex.europa.eu/eli/reg/2016/679/oj) alongside the proposed terms, and involve the person responsible for privacy review. The questionnaire should surface issues for that review rather than claim to settle them.

## How do we check security and access controls?

Ask how the vendor restricts access to the service and to customer data. Cover user accounts, administrator access and the process for removing access when a person leaves. If the product can connect to internal systems, ask which permissions it needs and how those permissions can be limited.

Request evidence that applies to the service being purchased. A security report for a parent company or a different product may still provide context, but it should not be treated as proof for the whole service. Ask what the report covers and whether any exclusions affect the planned use.

For a language model service, include questions about untrusted material reaching the model and the actions the model can trigger. Use the [language model security project](https://owasp.org/www-project-top-10-for-large-language-model-applications/) as a starting point for that discussion. Ask the vendor what protections apply in the proposed configuration and how customers can test them.

Where evidence is confidential, agree on a review method rather than asking for a public copy. Record who saw the material, what it covered and any questions left open. Do not record a control as verified merely because a document exists.

## How should we assess model quality and changes?

Describe the task the model will perform and the mistakes that matter to the business. Ask the vendor for test results that relate to that task, the language used and the conditions in which staff will rely on the output. General product demonstrations are useful context, but they do not establish fitness for your workflow.

Agree on a sample of cases your team can check before release. Include ordinary requests, difficult inputs and cases where the correct response is to decline or ask for help. The [evals](/glossary/evals) page covers the site's terminology for this work.

Ask how the supplier announces model or product changes and whether customers can test a change before relying on it. Record who will review a notice and decide whether the existing checks still apply. If the vendor cannot offer advance testing, agree on another way to detect a change that affects the workflow.

Use the [risk management framework](https://www.nist.gov/itl/ai-risk-management-framework) as a reference when deciding how the checks connect to ownership and ongoing review. Keep test results and known limits with the purchase record. Give users a route to report errors that the test cases missed.

## What evidence is enough for a buying decision?

Evidence should answer the question it is meant to support and cover the product in scope. For example, a retention policy can support a discussion about stored data, while contract terms can establish what the vendor agrees to provide. Neither should be treated as proof of an unrelated control.

Check the date, author and scope of each document the vendor supplies. Ask whether it reflects the current service and proposed hosting arrangement. When a claim rests on a product setting, request a description or demonstration of that setting and assign a buyer to check it.

Record exceptions without smoothing them into a pass. A vendor may have a planned control that is not yet available, or a control that applies only to a different plan. Note the effect on the proposed use and ask for a written commitment if the purchase depends on a change.

The reviewer can request a restricted document review when the vendor cannot send a report. If that is not possible, document the evidence gap and offer the decision owner clear choices. Those choices may include limiting the data, delaying the connection or choosing another supplier.

## Who signs off on the questionnaire?

The business owner should state why the service is needed and which workflow is in scope. Security, privacy and technical reviewers should assess the answers that fall within their remit. A named decision owner should then accept the remaining risk or send the purchase back for more work.

Use the site's guide to [AI risk ownership in vendor procurement](/blog/named-person-responsible-for-ai-risk-in-vendor-procurement) when assigning those roles. The person coordinating the questionnaire does not have to make every specialist decision. Each open issue should still have an owner and a clear route to a final decision.

Record the result as approved, approved with conditions, deferred or declined. For a conditional approval, specify the restricted use, the action required and who will check completion. Attach the relevant contract terms and evidence references so the team can find the basis for the decision later.

Share the decision with the people who will configure and use the service. An approval that assumes restricted access is hard to enforce if the administrator never receives that condition. Add the service to the [AI register](/glossary/ai-register) with a link to the review record.

## When should we ask the vendor again?

Set a review trigger when approving the service, and name the person who will watch for it. A change in data type, user access or connected systems can alter the basis of the original decision. A vendor change to its model, suppliers or data terms can also call for another look.

Start the follow-up with the original scope and the changed condition. Ask the vendor only for answers and evidence needed to assess that change, unless the earlier record is no longer reliable. This keeps the review tied to the decision rather than sending the whole form by habit.

Check whether open conditions were completed and whether the people who own the service have changed. Review error reports and incidents against the use that was approved. If the service now performs a different task, ask the business owner to describe that task before extending access.

Keep the old decision and add the new result to the record. That gives the next reviewer a way to see what changed, what was accepted and which conditions remain in force.
