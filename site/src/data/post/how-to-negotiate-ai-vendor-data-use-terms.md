---
title: How to negotiate AI vendor data-use terms
description: Learn how to negotiate AI vendor data-use terms with clear limits on training, retention, supplier access, and deletion.
publishDate: 2026-11-26
updatedDate: 2026-11-26
shortAnswer: Negotiate AI vendor data-use terms by listing the data the tool receives, the uses you permit, and the uses you prohibit. Put those limits in signed contract terms, cover the vendor’s suppliers, and agree on retention, deletion, evidence, and remedies before staff use the service.
fullAnswer: A plan for how to negotiate AI vendor data-use terms starts with the data and uses the contract covers. Start with the actual workflow, including prompts, uploaded files, outputs, logs, and feedback. Ask the vendor to identify every party that can access that material and every purpose for which it may be used. Then turn the answers into contract language, rather than relying on a sales promise or a settings screen alone. Pay particular attention to model training, human review, retention, and onward sharing. A no-training promise can still leave room for other uses that your business would reject. Legal and security teams should check the proposed terms against the data involved and the service configuration. Before signing, settle how you will verify the controls and what happens if the vendor changes them.
keyTakeaways:
  - List permitted and prohibited uses for each type of data the service receives.
  - Bind supplier access and product settings to the signed agreement.
  - Agree on retention, deletion, evidence, and remedies before the service starts.
  - Resolve conflicts between the order form, contract, and vendor policies.
faq:
  - q: Is a no-training promise enough for our AI vendor contract?
    a: No. Ask whether the vendor can use data for testing, human review, service improvement, or other purposes. The contract should state which uses are permitted and cover outputs, logs, feedback, and supplier access.
  - q: Can we rely on a vendor’s data-use settings?
    a: Settings help enforce an agreement, but they can change or be applied to the wrong account. Record the required settings, check them before launch, and put the underlying use limits in the contract.
  - q: What should we ask for when an AI contract ends?
    a: Agree on an export process, deletion scope, deadlines, and written confirmation. The terms should identify any data kept for legal or security reasons and restrict its use during that period.
category: governance
tags:
  - ai-governance
  - security-review
sources:
  - title: Regulation (EU) 2016/679
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
    publisher: European Union
    retrieved: '2026-11-26'
  - title: Contracts and liabilities between controllers and processors
    url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors/
    publisher: Information Commissioner's Office
    retrieved: '2026-11-26'
  - title: Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-26'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## What data and uses should the contract cover?

To decide how to negotiate AI vendor data-use terms, start with the actual workflow. Ask the team to trace what enters the service and what comes back. Include prompts, uploaded files, retrieved records, generated outputs, feedback, and logs. Note whether staff or software sends each item and whether it contains customer or employee information.

Next, ask the vendor what it does with each item. Serving a request may require temporary processing, but that purpose should have clear boundaries. Ask separately about model training, testing, abuse monitoring, troubleshooting, product improvement, and human review. A broad phrase such as service improvement can cover uses the buyer did not expect.

Use [data classification](/glossary/data-classification) to decide which information can enter the proposed workflow. The team responsible for the data should approve that scope before procurement accepts the vendor’s terms. If the use case changes later, repeat the review before sending a new class of information.

Take a sample transaction to the vendor and ask it to trace the data. A useful answer identifies the product, account, service components, recipients, and purposes. If the vendor cannot explain a step, record the gap and keep that data out of the pilot until the parties resolve it.

## How do you turn the answers into contract language?

Create a schedule that pairs each data type with an allowed purpose and a restriction. Make the schedule part of the signed agreement, and identify the products and accounts it covers. Ask counsel to adapt the language to the deal rather than treating a sample clause as a complete contract.

| Data or use          | Point to settle in the agreement                                                       |
| -------------------- | -------------------------------------------------------------------------------------- |
| Prompts and files    | Processing needed to provide the named service and any separate uses the buyer permits |
| Outputs              | Whether the vendor may store, review, share, or reuse generated material               |
| Training and testing | Whether customer material may be used and what separate approval would permit it       |
| Logs and feedback    | Fields collected, permitted purposes, access, and retention                            |
| Supplier access      | Which suppliers receive data and which restrictions follow that data                   |

A starting instruction might say that the vendor may process customer content to provide the contracted service. Add that any other named purpose needs the customer’s written approval. The scope should cover copies and relevant derived material, while spelling out any agreed exception.

Ask the vendor to mark up its standard terms against the schedule. Resolve broad rights to use feedback or improve services rather than assuming the narrowest clause will prevail. If a right remains disputed, restrict the affected workflow or leave the feature disabled until the parties agree.

## What should you ask about training and human review?

Ask for a direct answer about whether prompts, files, outputs, or feedback can be used to train or tune models. Cover the vendor’s own models and models operated by its suppliers. State whether the restriction applies to future training, existing retained material, and data held in support systems. Ask how the vendor will handle material already collected before the restriction takes effect.

A no-training term still needs a close look at testing and human review. Ask when people may see content, who they work for, and whether access requires a support request. Agree on the cases where review is allowed and whether the buyer can exclude sensitive material. A vendor may need some information to investigate abuse or faults, so negotiate the smallest scope that meets that need.

Check how staff feedback reaches the vendor. A feedback button may send a prompt and output together, even when the user only meant to rate a response. If the contract permits that flow, tell staff what the submission includes and decide who may send it.

The question about [models trained on customer data](/faq/are-models-trained-on-our-customer-data) is a starting point. For the deal itself, ask the vendor to confirm the answer for the exact service and account you are buying.

## Which suppliers can receive the data?

Ask for a current list of suppliers that may receive or access the relevant data. For each supplier, request the service it provides, the data it receives, and where processing may occur. Include model providers, hosting services, support tools, and any other party in the actual workflow. The [sub-processor](/glossary/sub-processor) page explains the term used in many contract schedules.

The agreement should require the vendor to pass the agreed data-use limits to relevant suppliers. It should also say who remains responsible for those suppliers and how the buyer receives notice of changes. Ask what happens if a new supplier cannot meet the agreed restrictions. Possible responses include an alternate service, a pause in the affected feature, or a right to end the affected service.

When the vendor acts as a processor, GDPR Article 28 requires documented instructions, subject to legal exceptions. The [regulation](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) is the primary source for that duty. Counsel should assess the parties’ roles and the terms needed for the actual processing.

For another contract checklist, compare the draft with the [UK regulator’s guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors/). Ask counsel which guidance applies to the deal rather than copying its wording without review.

## How should retention and deletion work?

Ask the vendor for a retention schedule that covers production data, logs, support records, backups, and supplier-held copies. The schedule should say when each period starts and what event triggers deletion. Check whether closing an account, deleting a chat, and ending the contract produce different results.

Negotiate an export path before the service holds data you need to keep. Specify the format, who can request the export, and how long access remains available after termination. Test a sample export before signing off on the process. A file that downloads successfully may still omit fields or context the business needs.

For deletion, agree on a deadline and a written confirmation that describes the scope. Ask the vendor to identify exceptions for backups, legal holds, security records, and supplier systems. The agreement should limit access and further use of retained material during any exception. Avoid a blanket promise of immediate deletion if the vendor cannot explain how it handles copies.

Connect these terms to the company’s [chat retention rules](/blog/how-to-set-ai-chat-retention-rules). The contract and the product settings should support the same schedule. If they differ, decide which data may enter the tool until the gap is fixed.

## How do you resolve conflicts between vendor documents?

Collect the order form, main agreement, data terms, security schedule, and product policies before the final review. Mark every passage that gives the vendor a right to use data or change a service. A narrow order form can lose force if another document grants a broader right and the agreement does not resolve the conflict.

Ask counsel to set an order of precedence for the signed documents. Put deal-specific restrictions in the document that controls over conflicting standard language. Identify any online policy incorporated by reference and record the version the parties accepted. A link to a policy alone leaves the buyer with a moving target.

Negotiate notice and a response for changes that affect data use, suppliers, or retention. The buyer may need time to review the change, disable a feature, or move its data. Make the remedy fit the risk and the practical cost of leaving. A right to object has little value if the agreement never says what happens after an objection.

Keep the signed documents and approved settings together with the vendor assessment. The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) can help collect the open points, but the signed terms should settle them. Record who accepted any remaining exception and why the workflow can proceed.

## What evidence should you request before launch?

Ask the vendor to show how the contracted restrictions apply to the purchased account. Request the relevant settings, the person allowed to change them, and a way to confirm their current state. Check the production account rather than relying on a demonstration in a separate environment. Record the result with the contract and the internal approval.

Test the boundaries that matter to the workflow. Send a safe sample through the service, inspect the output and logs, and check the export and deletion paths. A test can show what happened in that account; it cannot prove every vendor or supplier practice. For claims the buyer cannot observe, seek written attestations, audit rights, or other evidence the vendor can provide.

Agree on notice, investigation, and remedies if an unauthorized use occurs. The terms should identify who receives notice, what information the vendor must provide, and who can require a pause. Ask counsel to align those duties with the rest of the agreement and any duties that apply to the data.

Use the [privacy framework](https://www.nist.gov/privacy-framework) as a prompt for a broader risk review. Then assign an internal owner to check settings, supplier notices, and contract changes during the service. Before renewal, compare the live workflow with the uses the parties actually approved.
