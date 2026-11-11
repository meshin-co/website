---
title: How to set AI chat retention rules
description: Learn how to set AI chat retention rules by mapping copies, choosing periods, configuring deletion and testing vendor handling.
publishDate: 2026-11-11
updatedDate: 2026-11-11
shortAnswer: To understand how to set AI chat retention rules, map where conversations and their copies go, then choose a justified period for each purpose. Configure deletion in every system you control, agree on vendor handling, and test the outcome. Record exceptions, owners and evidence so the rules remain workable.
fullAnswer: AI chat retention rules should cover the conversation, its copies and the systems that receive them. Start with the purpose for keeping each kind of record, then choose a period that fits that purpose and any applicable duties. The period should have a clear start event, an owner and a deletion method. Check settings and contracts for chat history, uploads, logs, exports and backups. A user deleting a chat may not remove every copy. Ask the vendor what happens to each copy, including data held by other providers. Decide who can place a hold on deletion and how that hold ends. Test the rules with a sample conversation and keep evidence of the result. Where a system cannot meet the chosen rule, restrict its use or record an approved exception with a review date. Give staff a plain instruction on what they may enter and how they can report a retention problem.
keyTakeaways:
  - Set retention periods by purpose and data type, rather than applying one chat setting to every copy.
  - Record the start event, deletion method, owner and hold process for each retention rule.
  - Test both your own systems and vendor handling before treating deletion as complete.
  - Restrict sensitive uses when the available controls cannot meet the chosen rule.
faq:
  - q: Should every AI chat have the same retention period?
    a: A single period is easier to administer, but it may not fit every purpose or copy. Set periods for the records you need, and restrict uses that the available settings cannot handle.
  - q: Does deleting a chat remove it from the vendor's systems?
    a: A deleted chat may have copies in logs, backups or other systems. Ask the vendor which copies are removed, when removal occurs and what evidence is available.
  - q: Who should approve an exception to a chat retention rule?
    a: Assign an accountable business owner and involve legal, privacy or security staff as needed. Record the reason, affected data, safeguards and review date before granting the exception.
category: governance
tags:
  - ai-governance
  - policy-enforcement
  - security-review
sources:
  - title: Regulation (EU) 2016/679 of the European Parliament and of the Council
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    publisher: European Union
    retrieved: '2026-11-11'
  - title: 'Principle (e): Storage limitation'
    url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
    publisher: Information Commissioner's Office
    retrieved: '2026-11-11'
  - title: NIST Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-11'
  - title: Guidelines for Media Sanitization
    url: https://csrc.nist.gov/pubs/sp/800/88/r1/final
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-11'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## Where do AI chat copies go?

To see how to set AI chat retention rules, start by mapping where each conversation goes. List the approved chat tools and the business processes that use them. Include browser tools, embedded chat features and systems built by your own team. The [AI system register](/glossary/ai-register) gives you a place to connect each tool to an owner.

Trace a sample conversation from entry to removal. Include prompts, responses, uploaded files and any material retrieved to answer the user. Look for copies in application storage, support tools, analytics, exports and staff downloads. Ask administrators about security logs and backups as well.

| Record or copy        | Question to settle                               |
| --------------------- | ------------------------------------------------ |
| Chat history          | What starts its retention period?                |
| Uploaded files        | Do they follow the chat or a separate rule?      |
| Logs and traces       | What content is recorded, and who can see it?    |
| Exports and downloads | Who owns copies outside the chat tool?           |
| Backups               | When do expired records cease to be recoverable? |

Treat the table as a starting inventory, not a list of required periods. For each tool, note unknown paths and assign someone to resolve them. A rule cannot be tested against a copy that nobody has identified.

## How do you choose a retention period?

Start with the reason for keeping a record and the decision it supports. A service team may need a conversation for a customer follow-up. A security team may need a separate record to investigate misuse. Those purposes can call for different content, access and retention periods.

Ask the record owner to explain why the proposed period is needed. Check whether a shorter record, such as a case reference without the full chat, would serve the same purpose. Record the start event as well as the period. For example, the clock might start when a conversation ends or when a case closes.

The GDPR sets a purpose-based limit on how long personal data may be kept in identifiable form. Read the [regulation](https://eur-lex.europa.eu/eli/reg/2016/679/oj) with counsel when it applies, including its exceptions. The [storage limitation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/) provides prompts for setting and reviewing periods.

Do not borrow a period from another company without checking your own duties and uses. Record the rationale, approver and next review alongside each rule. Where no purpose supports keeping a copy, decide whether to stop collecting it.

## What should you ask the vendor?

Ask the vendor for a written account of each copy it retains. Separate the user-visible chat history from service logs, safety records, backups and support records. Request the event that starts deletion and any delay before each copy is removed. Ask what changes when an account or contract ends.

Check who can change retention settings and whether the setting applies to every user and workspace. A contract may offer a choice that an administrator must still turn on. Ask whether uploads, tool results and conversation metadata follow the same setting as chat text. Record any limits on access to deletion evidence.

Training use needs its own question. Ask whether prompts, responses or files can be used to improve models, and what choices apply to your account. The answer to a training question does not settle how long records remain stored. The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) can help put these questions into a purchase review.

Where the vendor cannot support the proposed rule, document the gap before use. The owner can seek different terms, restrict the data sent or choose another tool. Keep the vendor's response with the decision, rather than relying on a sales call.

## How do you turn the rule into settings?

Write a rule that an administrator can apply without guessing. Name the workspace, record type, retention period, start event and deletion action. Specify who can change the setting and who checks it after a change. Keep the approved rule beside the system record so the business owner can find it.

Set controls in the chat product and in connected systems under your control. A chat setting may leave an exported transcript or an application trace untouched. Apply the relevant rule to each destination, or stop sending content there. Limit access to retained records to people who need it for the stated purpose.

Test the actual account and workspace, not just a vendor demonstration. Use a harmless sample that can be identified in search and logs. Record the settings before the test, then check each mapped destination after deletion should occur. Include any separate file store or support queue in the check.

If the tool offers only a broad workspace setting, align permitted uses with that limit. Staff should not place data in the tool when its required handling cannot be met. Link the rule to the [acceptable use policy](/blog/ai-acceptable-use-policy-for-a-50-person-company) so that staff see the restriction before use.

## What happens when deletion must be paused?

Create a process for a hold before someone needs to use it. A hold may be needed for a dispute, investigation or another duty to preserve records. The person requesting it should identify the affected records and the reason. Legal or another designated authority should decide whether the hold applies.

Record who placed the hold, when it started and who can release it. Limit the hold to the records and people needed for the stated purpose. Tell the system owner which deletion jobs or vendor requests must be paused. Avoid changing a global retention setting when a narrower control will work.

When the reason ends, the decision maker should release the hold in writing. The system owner can then apply the ordinary rule and check whether overdue deletion has run. Keep evidence of the hold and release without retaining unnecessary chat content in the hold record.

Some tools may lack a way to preserve a narrow set of records. Resolve that gap with counsel and the vendor before relying on the tool for affected work. An exception needs a named owner, a reason, safeguards and a date for review.

## How do you handle backups and other copies?

Separate removal from active systems from removal of older backup copies. Ask how long an expired record may remain recoverable and who can restore it. Record the vendor's answer and compare it with the period your policy permits. If they conflict, the owner needs a decision before sensitive use starts.

Plan for a restore as well as routine expiry. A restored backup can bring back records that were already due for deletion. The restore procedure should identify those records and reapply the deletion rule before normal access resumes. Keep a record of the check without copying the chat text into a new log.

Exports need an owner outside the chat system. A transcript saved to a shared drive should follow an assigned rule there, even if the original chat is gone. Restrict export where the team cannot track or delete the resulting copies. Ask staff to report existing copies so the owner can decide how to handle them.

For retired storage, ask the provider how it removes data and what proof it can provide. The [media sanitization guidance](https://csrc.nist.gov/pubs/sp/800/88/r1/final) can inform those questions. Match the evidence request to the systems and contracts involved.

## How do you prove the rule works?

Run a test for each distinct retention path, including files and downstream logs. Create a harmless sample chat with a marker that the test team can search for. Note its creation event, applicable rule and expected deletion event. Keep the marker free of real customer or staff data.

Check the user view, administrator view and mapped destinations after the rule should take effect. Ask the vendor for evidence where your team cannot inspect a system directly. Record what was checked, who checked it and whether the result matched the rule. A missing chat in the user view alone does not prove that all copies are gone.

If a copy remains, find out whether a hold, backup schedule or failed job explains it. Record the cause and assign a correction with a review date. Restrict the affected use while the gap remains open if the retained content presents a risk. Repeat the relevant test after the correction.

The [privacy framework](https://www.nist.gov/privacy-framework) offers a broader way to track privacy risk alongside this record. Keep test evidence accessible to the owner and reviewers without storing another full transcript for convenience.

## What should staff know before they use chat?

Give staff a short instruction at the point where they choose a tool. Name the approved workspace and the types of information they may enter. Explain how long the workspace is intended to retain chats and what happens when a user deletes one. Where a vendor's process has a delay, say so plainly.

Tell users how to handle uploads and exports, not just typed prompts. If a work record belongs in a case system, explain how to save the needed result there. Avoid asking staff to keep personal transcript archives as a workaround. Those copies make the retention rule harder to apply.

Provide a route for reporting a mistaken upload, an unexpected retained chat or a deletion failure. The receiving team should know who can investigate and when to involve privacy or security staff. Users should not have to determine the technical cause before reporting a problem.

Keep the instruction consistent with the product's actual settings. If an administrator changes the retention period, update the notice and tell affected teams. Review requests for unapproved tools through the process for [tools staff already use](/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval).

## When should you review a retention rule?

Review a rule when the purpose, data flow or available control changes. A new integration may send chat content to a system that was not in the original inventory. A vendor contract change may alter the choices available to an administrator. A new use of uploaded files may call for a separate decision.

The business owner should compare the written rule with the live settings and the vendor's current terms. Ask whether staff still need the retained content for the stated purpose. Check open exceptions, test failures and holds that may be ready for release. Record the decision even when the rule stays the same.

Use a change request when a team wants to keep chats longer or collect more content. The request should identify the purpose, affected records, proposed period and controls. Privacy, legal and security reviewers can assess the change as needed. The owner then updates the settings and schedules a test.

Keep the evidence with the system record so the next owner can continue the process. The [governance starter kit](/resources/ai-governance-starter-kit) can support that handover. Close the review by assigning any unresolved deletion gap to a named owner.
