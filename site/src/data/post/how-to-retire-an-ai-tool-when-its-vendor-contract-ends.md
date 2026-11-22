---
title: How to retire an AI tool when its vendor contract ends
description: Learn how to retire an AI tool when its vendor contract ends, from preserving records and planning the cutover to checking deletion.
publishDate: 2026-11-21
updatedDate: 2026-11-21
shortAnswer: To decide how to retire an AI tool when its vendor contract ends, assign an exit owner, map its data and dependencies, and agree on a cutover before vendor access ends. Export what the business must keep, stop connected workflows, revoke access, and obtain evidence of deletion or document any limits and open risks.
fullAnswer: To decide how to retire an AI tool when its vendor contract ends, name an owner and write an exit plan. The owner needs to know who uses the tool, what data it holds, and which systems depend on it. The contract then sets the practical boundaries for export, support, deletion, and any access after the end date. Before cutting access, move needed records to an approved location and test a replacement or manual process. Stop automated work safely, revoke credentials, and check that connected systems no longer send data to the vendor. Ask the vendor for evidence of deletion, including the status of backups and any permitted retention. Keep an exit record that separates verified results from vendor statements and unresolved gaps. If the vendor cannot meet a needed condition, assign an owner and a date to resolve the risk.
keyTakeaways:
  - Name an exit owner before the vendor contract ends.
  - Test exports and replacement workflows while vendor access still works.
  - Revoke connected access after needed data and evidence are secured.
  - Record deletion evidence and unresolved retention risks separately.
faq:
  - q: Who should own an AI vendor exit?
    a: Name one person to coordinate the exit and record sign-off. That owner should draw on procurement, security, privacy, and the teams that rely on the tool.
  - q: Should we delete data before the contract ends?
    a: First preserve records the business must keep and check any hold or retention rules. Agree on the deletion scope and timing with the vendor while access and support remain available.
  - q: What if the vendor cannot prove data was deleted?
    a: Ask what the vendor can confirm, including the scope and limits of its statement. Record the gap, assess the remaining risk, and assign an owner to seek further evidence or approve a response.
category: operating-model
tags:
  - ai-register
  - security-review
sources:
  - title: Regulation (EU) 2016/679 of the European Parliament and of the Council
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    publisher: European Union
    retrieved: '2026-11-21'
  - title: Guidelines for Media Sanitization
    url: https://csrc.nist.gov/pubs/sp/800/88/r2/final
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-21'
  - title: Secrets Management Cheat Sheet
    url: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
    publisher: OWASP Foundation
    retrieved: '2026-11-21'
author: dmitri
relatedResources:
  - handover-playbook
  - ai-governance-starter-kit
---

## Where should the exit plan start?

The plan for how to retire an AI tool when its vendor contract ends starts with a named owner. That person coordinates the work and keeps a record of decisions. Procurement may manage the contract, but the team using the tool must help establish what can safely stop.

Find the contract end date, notice terms, renewal terms, and any separate dates for export or support. Confirm which date actually ends service and who can approve a change. Put those dates in a shared plan rather than relying on the billing system alone.

Use the [AI register](/glossary/ai-register) as a starting point for finding the tool and its owner. Check the record against invoices, access lists, and conversations with teams. A tool may have separate accounts or connected services that the contract record does not show.

Write down the intended end state: which work stops, which work moves, and who accepts the remaining risks. A clear end state gives each team a way to judge whether its part is complete.

## What should we check in the vendor contract?

Read the exit terms alongside the service agreement, data terms, and any support commitments. Check who can request an export, which formats are available, and whether the vendor charges for help. Ask whether support continues after the service ends and whether any export window is shorter than expected.

List the data locations covered by the agreement, including connected services and subcontractors where known. Separate a promise to stop using data from a promise to delete it. Ask how the vendor handles backups, security logs, and records it must retain.

Under GDPR, a processor must delete or return personal data after services end, at the controller's choice, unless law requires storage. The [contract terms for processors](https://eur-lex.europa.eu/eli/reg/2016/679/oj) set out that choice and address existing copies. Have the privacy team assess how those terms apply to the actual relationship and agreement.

If a term is unclear, get a written answer before the exit window closes. Record who gave the answer and whether it changes the plan. A support reply can clarify a process, but it may not change the contract.

## Which work will stop when the tool goes away?

Ask each team what it relies on the tool to do. Include work that happens through a browser, an application connection, or an automated job. A shared account can conceal several distinct uses, each with a different owner and fallback.

Trace the path from the source of a request to its final recipient. Note where the tool reads data, writes results, sends messages, or triggers another system. Check scheduled jobs and service accounts as well as staff access. The [access review process](/blog/how-to-run-a-quarterly-ai-tool-access-review) can help identify accounts that need attention.

For each use, agree on a replacement, a manual route, or a decision to stop. Test the route with the people who must operate it. For example, a support team may need to draft replies manually while keeping its existing review step.

Tell affected users when new work must stop entering the old tool. Give them a contact for records they cannot find or tasks that fail during the change. Include customers or suppliers when the change affects a service they receive.

## What data and settings should we preserve?

Make an inventory before requesting an export. Look for uploaded files, conversation records, generated outputs, saved prompts, settings, user lists, and activity records. Include records held outside the tool when they explain a decision or show who approved it.

For each item, name its owner, destination, access rules, and reason for keeping it. Apply the existing retention and legal hold process rather than exporting everything by default. The guidance on [AI chat retention](/blog/how-to-set-ai-chat-retention-rules) can help the team make those choices.

Ask for a sample export early enough to inspect it. Check whether files open, timestamps and identifiers make sense, and the content can be matched to the right business record. A download that completes successfully may still omit attachments or useful context.

Store the approved export in a controlled location and test access with its new owner. Keep a record of what was exported and what could not be retrieved. Do not put vendor credentials into the archive just because they appear in a settings file.

## How should we switch the work over?

Choose a cutover point with the teams that send work to the tool. Before that point, test the replacement or manual route with representative tasks and check the results. Assign someone to handle work that is already in progress when the switch begins.

Pause new requests to the old service, then deal with queued or incomplete work. Confirm whether each task finished, needs to be rerun, or needs a human decision. Do not replay actions that could send duplicate messages or make duplicate changes.

Keep a short fallback plan for a failed cutover. It should name the person who can pause the change, the conditions for returning to the old service, and the last date that service will remain available. Agree on that plan with the vendor if renewed access would require its help.

After the switch, check the destination systems for missing or unexpected results. Ask users to report failures through a named channel. Close the fallback option only when the business owner accepts the new route.

## How do we remove access without losing evidence?

Sequence access removal after the required export and checks, but before leaving the old service unattended. List every route into the vendor service and every route back into company systems. That list should cover staff accounts, shared accounts, service accounts, API keys, and connected applications.

Disable scheduled jobs and outbound connections that could continue sending data. Revoke vendor access to company systems and remove the old tool from sign-in assignments. Rotate shared secrets where the vendor or the retired tool could still know them. The [secrets management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) offers further guidance for handling those credentials.

Test the result from both sides where possible. A rejected sign-in alone does not show that a background job has stopped. Check job logs and connection settings for attempted traffic, then investigate anything still active.

Keep the access changes and their results in the exit record. If an account must remain open for a dispute or export, limit its scope and name the person responsible for closing it. Set a review date for that exception.

## What deletion evidence should we ask for?

Send the vendor a written request that names the accounts, data types, and connected services in scope. Ask whether the vendor will return or delete each category and what happens to existing copies. Include subcontractors and backups in the question rather than assuming they follow the same path.

Request a response that identifies who performed the work, what was covered, and when it was completed. Ask the vendor to explain any data it retains, why it retains it, and when that retention will end. A vendor statement is useful evidence of its position, but it does not by itself give the customer direct sight of every copy.

Where the contract permits a stronger check, agree on the method and who will review the result. For data stored on media the company controls, use the relevant [media sanitization guidance](https://csrc.nist.gov/pubs/sp/800/88/r2/final) when selecting and checking a disposal method.

Record the scope of each piece of evidence. If a vendor confirms deletion from active storage but describes a later backup process, keep those as separate entries. Do not mark the whole exit complete while a material question remains open without an accepted exception.

## What if the vendor cannot meet the exit request?

Start by identifying the exact gap. The vendor may lack an export format, need more time to process a request, or retain records under a term the business did not expect. Ask for the constraint in writing and request a workable alternative.

Assess the consequence with the data owner and the teams responsible for security and privacy. Consider what data remains, who can reach it, and whether a business process depends on retrieving it. If records cannot be exported, agree on how the team will preserve the decisions or work that remain accessible.

The exit owner should document the proposed response, its limits, and the person who can accept the risk. That response might require a contract discussion, a narrower export, or an agreed period of restricted access. Avoid treating a verbal promise as a completed action.

Set a date to revisit each open item and keep its evidence with the exit record. Escalate when the person handling the issue cannot resolve it within the available window.

## Who signs off the exit?

Use a small handover record that shows the status of each part of the exit. The business owner can confirm the replacement workflow, while procurement checks the contract close. Security can record access changes, and the data owner can confirm that needed records are usable.

| Exit item         | Evidence to keep                     | Decision owner            |
| ----------------- | ------------------------------------ | ------------------------- |
| Business workflow | Test result and fallback status      | Business owner            |
| Records           | Export inventory and access check    | Data owner                |
| Connections       | Revocation and traffic checks        | Security owner            |
| Vendor data       | Deletion response and retention gaps | Privacy or contract owner |

Update the [system register](/blog/how-to-build-an-ai-system-register-in-a-week) with the retirement status and a link to the exit record. Keep unresolved items visible until their owners close them or an authorized person accepts the risk.

Check the billing and renewal records against the agreed end state. Then give the remaining record owner the vendor contact details and the dates of any pending follow-up. That handover matters if a later access or deletion question needs an answer.
