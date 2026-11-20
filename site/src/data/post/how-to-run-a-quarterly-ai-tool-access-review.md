---
title: How to run a quarterly AI tool access review
description: Learn how to run a quarterly AI tool access review with clear owners, evidence, decisions and checks that changes take effect.
publishDate: 2026-11-16
updatedDate: 2026-11-16
shortAnswer: Run a quarterly AI tool access review by collecting current access lists, matching each account to an owner and checking whether its permissions still fit the work. Record decisions, remove or narrow access, and verify the changes. Track exceptions with an owner, a reason and an expiry date.
fullAnswer: A quarterly AI tool access review checks who can use each approved tool and what they can do with it. Start with a list of tools and their owners, then collect access records from both the identity system and each tool. Ask managers and tool owners to confirm the business need for each person, service account and privileged role. Record the decision beside the evidence used to make it. Remove access that is no longer needed, narrow permissions where the role is too broad, and check that each change took effect. Give unresolved cases an owner and a deadline rather than treating silence as approval. The review should cover direct accounts, group access, integrations and shared credentials. Keep evidence of the decisions and changes without copying prompts or customer data into the review sheet. Departures and urgent security issues still need action as soon as they are known.
keyTakeaways:
  - Compare identity records with tool-level permissions before asking owners to approve access.
  - Review service accounts, integrations and privileged roles alongside individual users.
  - Record each decision and verify that the requested access change took effect.
  - Give exceptions a named owner, a reason, an expiry date and a follow-up action.
faq:
  - q: Who should approve access to an AI tool?
    a: The person's manager should confirm the work need, while the tool owner checks whether the requested role fits that need. An independent reviewer should check privileged access when the tool owner holds it.
  - q: Should inactive accounts always be removed?
    a: Treat inactivity as a reason to investigate, not as proof that access is unnecessary. Confirm the account's purpose and the reliability of the activity record before deciding whether to remove it.
  - q: What happens if a tool cannot export its access list?
    a: Ask an administrator to inspect the available user and role screens, record the limits of that evidence, and arrange a second-person check for sensitive roles. Track the missing export as a gap rather than claiming the review covered access that could not be seen.
category: governance
tags:
  - ai-governance
  - security-review
  - policy-enforcement
sources:
  - title: Security and Privacy Controls for Information Systems and Organizations
    url: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-16'
  - title: Turn On MFA
    url: https://www.cisa.gov/secure-our-world/turn-mfa
    publisher: Cybersecurity and Infrastructure Security Agency
    retrieved: '2026-11-16'
  - title: Use Strong Passwords
    url: https://www.cisa.gov/secure-our-world/use-strong-passwords
    publisher: Cybersecurity and Infrastructure Security Agency
    retrieved: '2026-11-16'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## What should the review cover?

To decide how to run a quarterly AI tool access review, first name an owner and set its scope. Include approved chat tools, developer tools and applications that connect an AI feature to company data. Include accounts held by staff, contractors and external support teams. Record the boundary so reviewers know which tools they must inspect.

Use the [AI system register](/glossary/ai-register) to find known systems and their owners. Ask procurement, finance and technical teams to flag tools missing from that list. A tool found during the review needs an owner and a separate approval decision. Do not assume that a paid subscription means the tool has been approved for every use.

The review owner sets a cutoff for the access evidence and assigns a reviewer for each tool. A manager can confirm whether a person still needs access for their work. The tool owner checks the role and can arrange changes. Security should receive cases involving unexplained privileged access or a suspected account compromise promptly.

## Where can you find the actual access list?

Ask the identity team for the relevant groups and their current members. Then ask each tool administrator for its own user and role list. Compare the results, since a direct invitation or local account may sit outside the identity system. Note the date and source of each export so reviewers can judge its freshness.

Inspect group-based access as well as named users. A person may gain entry through a nested group or hold a role assigned within the tool. Record the path that grants access, not just the person's name. Otherwise, removing one grant may leave another path open.

Exports can omit pending invitations, service accounts or access granted through integrations. Ask administrators to check those areas separately and describe any blind spots. The [account management control catalog](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) offers a wider reference for the controls around account management. Keep the review sheet restricted because it contains a map of access to company systems.

## Who should make each decision?

Give each access entry a reviewer who knows why the account exists. A line manager can confirm a person's current duties and whether the tool remains useful. The tool owner can judge whether the requested permission fits the work. If neither can explain the need, send the case for investigation instead of approving it by default.

Avoid asking an administrator to approve their own privileged access without another person's check. Assign that check to a security lead or another owner with enough context to challenge it. The reviewer should see the role and its access path, not just a request to approve a name.

For contractors, ask the person responsible for the engagement to confirm the work and expected end date. For shared or automated accounts, identify a person who can explain the job and arrange any changes. If an owner has left, assign a temporary reviewer and resolve ownership before closing the case. Record a non-response as an open item, with an escalation path and a deadline.

## Which permissions need closer inspection?

Start with roles that can add users, change settings, reach sensitive data or connect other systems. Ask whether each holder needs that reach for current work. A person may need to use a tool without needing to administer it. Check the actual permissions attached to the role rather than relying on its label.

Use the following decisions to keep reviews consistent across tools:

| Decision    | When to use it                                            | Evidence to retain                               |
| ----------- | --------------------------------------------------------- | ------------------------------------------------ |
| Keep        | The owner confirms the account and role are still needed. | The reviewer, reason and review date.            |
| Narrow      | The work continues, but a smaller role would suffice.     | The requested role and proof of the change.      |
| Remove      | The work has ended or the account has no valid owner.     | The removal request and proof that access ended. |
| Investigate | The available records do not support a decision.          | The missing information, owner and deadline.     |

Reviewers should also consider which data a role can reach. The site's [data classification reference](/glossary/data-classification) can help owners discuss that scope. Keep the decision tied to the actual work, not to a person's job title alone.

## Are service accounts and integrations still needed?

Include accounts used by scripts, connectors and scheduled jobs in the same review. For each one, identify the person responsible, the task it supports and the systems it can reach. Ask whether the task still runs and whether the account needs its current permissions. A technical owner should be able to point to the job or configuration that depends on it.

Check whether an integration can read or change more data than its task needs. Look at permissions in both the AI tool and the connected system. The access review may find a connector that nobody recognizes, but absence of a clear owner does not prove it is safe to delete immediately. Find the dependency first, then agree on a controlled removal or an urgent response if the access poses an active risk.

Shared credentials need a named custodian and a plan to replace them where practical. When a credential is removed or rotated, check the dependent job and the old credential's status. Record any residual risk if the team cannot separate users yet.

## How should the team handle uncertain cases?

An activity record can help a reviewer ask better questions, but it rarely tells the whole story. A quiet account may support occasional work, while a recent sign-in may have no current business purpose. Check what the record actually measures before using it to support a decision. If the tool cannot show reliable activity, note that limit in the review.

Use a time-limited exception when access must remain while an owner resolves a known gap. The exception should name the account, the reason, the person accepting the risk and the expiry date. It should also say what will happen at expiry and who will carry out that action. A reminder alone does not remove access.

Do not leave an unexplained administrator account open simply because the review period has ended. Escalate the case to the appropriate security owner and agree on an interim restriction. The [guidance on unapproved tools](/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval) can help when the review reveals use outside the approved list. Keep the account decision separate from the broader decision about whether the tool should remain in use.

## When should access changes happen?

A quarterly review is a backstop for access that has drifted from current work. It does not replace the removal process when someone leaves or changes roles. Send those changes through the normal access process as soon as the relevant team learns about them. Escalate a suspected compromise immediately rather than waiting for the next review.

For each review decision, create a change request that names the account, tool and intended result. The person making the change should record when it was completed and what they changed. If a role is being narrowed, include the new role as well as the old one. For group-based access, identify the group that must change and check whether the person has another grant.

The person closing the review should inspect fresh evidence after the change. A completed ticket alone does not show that the account lost access. Where feasible, check the tool's current user list or test the affected path with an authorized administrator. If the result differs from the request, reopen the item and assign a fix.

## Can the team protect accounts while reviewing them?

Check whether privileged accounts have the protections the company expects for them. For example, ask administrators to confirm that sign-in controls apply to local accounts as well as centrally managed accounts. The [account sign-in guidance](https://www.cisa.gov/secure-our-world/turn-mfa) explains a control to consider when protecting access. Record gaps for the team that owns the sign-in setup.

Review recovery routes and dormant administrator accounts alongside ordinary access. An emergency account may have a valid purpose, but its owner should be able to explain how it is protected and checked. Avoid putting passwords, recovery codes or secret keys in the review sheet. Link to a restricted record of the control instead.

If a tool supports only shared administrator credentials, document who can retrieve them and how that access is checked. Agree on a plan with the tool owner if named accounts are available. The [password guidance](https://www.cisa.gov/secure-our-world/use-strong-passwords) is a useful reference for the separate process that manages credentials. The review should record whether that process has an owner, not reproduce its secrets.

## Does the evidence show the review is complete?

The review owner should be able to trace each decision from the access list to the reviewer and, where needed, to proof of change. Keep the original source date, the decision date, the reason and a link to the change record. Mark open cases and exceptions clearly so they cannot be mistaken for completed removals. Limit access to the evidence and follow the company's retention rules.

Ask tool owners to confirm which parts of their tool they could not inspect. An incomplete export, a missing group list or an unowned integration is a gap in coverage. Record who will fix the gap and when the owner will check again. A review can close with an accepted exception, but its record should make that choice visible.

Use the [AI governance starter kit](/resources/ai-governance-starter-kit) as a place to organize ownership and review records. Send the next review owner the open items, evidence locations and named contacts. For any access removal still awaiting proof, keep the task assigned until a fresh check confirms the result.
