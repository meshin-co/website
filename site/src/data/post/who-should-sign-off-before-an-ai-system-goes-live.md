---
title: Who should sign off before an AI system goes live?
description: Find out who should sign off before an AI system goes live and what evidence each reviewer needs.
publishDate: 2026-11-28
updatedDate: 2026-11-28
shortAnswer: The business owner should approve an AI system’s use, with technical, security and other relevant risk owners signing off on their areas. Privacy, legal and affected operations teams join when the use calls for them. A named decision-maker resolves open risks and records the final launch decision.
fullAnswer: Decide who should sign off before an AI system goes live by naming the business owner and the people responsible for technical and operational risks. The release owner confirms that the system can be deployed and supported. Security reviews access and exposure, while privacy and legal reviewers join when the data or use calls for their judgment. The team that will handle the output should confirm that the workflow is workable. Before asking for approval, agree on who can stop launch and who can accept an unresolved risk. Give each reviewer evidence tied to the actual release, including test results, data flows and a plan to pause or reverse the change. Record the decision, its scope and any conditions. If a required reviewer cannot approve, the launch owner should resolve the issue or send it to someone with authority to accept the risk. Silence should not count as approval.
keyTakeaways:
  - The business owner accepts the use and its remaining risks within their authority.
  - Each required reviewer should approve the area they can judge and control.
  - A launch decision needs evidence for the release that will actually ship.
  - Unresolved objections need a named decision-maker and a recorded outcome.
faq:
  - q: Does every AI launch need legal and privacy approval?
    a: No single review list fits every launch. Ask legal and privacy staff to decide whether their review is needed based on the intended use, data and applicable obligations. Record that decision rather than assuming the review is unnecessary.
  - q: Can the project lead approve their own AI launch?
    a: The project lead can recommend launch and provide evidence. The final decision should sit with someone who has authority over the business use and its remaining risks. Where the lead also holds that authority, keep independent checks for risks they cannot assess themselves.
  - q: What happens if a reviewer refuses to sign off?
    a: Hold the launch while the owner resolves the objection or sends it to an authorized decision-maker. Record the objection, the proposed response and any accepted risk. Do not treat a missed response as approval.
category: operating-model
tags:
  - ai-governance
  - production-readiness
  - security-review
sources:
  - title: AI RMF Playbook
    url: https://airc.nist.gov/airmf-resources/playbook/
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-28'
  - title: Secure Software Development Framework
    url: https://csrc.nist.gov/projects/ssdf
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-28'
  - title: Monitoring Distributed Systems
    url: https://sre.google/sre-book/monitoring-distributed-systems/
    publisher: Google
    retrieved: '2026-11-28'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
  - handover-playbook
---

## Who makes the final launch decision?

To decide who should sign off before an AI system goes live, start with the person who owns the business outcome. That person should have authority over the intended use, the people affected and the resources needed to run it. A project sponsor may be the right choice, but a sponsor title alone does not prove that authority.

The final decision-maker needs a clear view of what is being released and what remains uncertain. They should be able to defer launch, narrow its scope or accept a risk within their remit. If a risk sits outside that remit, they need to send it to the person who can decide.

Separate a recommendation from a decision. The delivery lead can assemble evidence and recommend release, while the business owner decides whether the use is acceptable. In a small team, one person may hold both roles. In that case, ask another qualified person to review areas where the owner lacks the skills or independence to judge.

Record the final decision against a named release and use case. A general approval for an AI tool does not settle whether every later use of that tool is acceptable.

## Which teams need to sign off?

Choose reviewers by the risks and work involved, rather than by a fixed list of job titles. Each reviewer should know what they are approving and have enough evidence to make that decision. The following split is a starting point for the launch owner.

| Role                      | Decision or input before launch                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Business owner            | Approves the use, scope and remaining business risk within their authority.                        |
| Technical release owner   | Confirms the release, tests, access controls and support arrangements are ready.                   |
| Security owner            | Reviews threats, access and the response to security findings.                                     |
| Privacy or legal reviewer | Determines whether the use and data need review in their area, then records any required decision. |
| Operations owner          | Confirms that staff can handle outputs, failures and customer issues.                              |

A reviewer may cover more than one role if they have the authority and skills for each. The launch record should still show which decisions they made. A vendor can supply test results and details of its service, but the organization using the system must decide whether that evidence is enough for its own use.

If a system affects customers, include the team that handles complaints or appeals. If it can spend money or change records, include the owner of those controls. The [operating model](/glossary/ai-operating-model) can help place these decisions within existing roles.

## What should each reviewer see?

Give reviewers a short release brief before asking them to approve. It should name the use, the users, the data involved and any actions the system can take. State where people will check outputs and where an output can trigger a change without a further check.

Attach test results that match the intended use. Show the cases tested, the results, the limits of the test set and any failures still open. A reviewer should be able to tell whether the evidence covers the release in front of them, rather than an earlier prototype.

Security needs a view of access, connected services and open findings. Operations needs the support route, alert ownership and a way to stop the workflow. The business owner needs the expected outcome, the costs they have agreed to bear and the risks that remain after controls.

Link the evidence to the [AI system register](/glossary/ai-register), so a later reviewer can find the decision and its context. Use the [secure software development practices](https://csrc.nist.gov/projects/ssdf) as a prompt for questions about release controls. Reviewers should ask for missing evidence before they sign, rather than approve a promise to find it later.

## How should open risks affect the decision?

An open finding does not always require a permanent stop. The right response depends on its possible effect, the strength of the proposed control and the authority of the person accepting the remaining risk. Record the finding in plain language, including who could be affected and how the team would detect a problem.

The reviewer who raised the issue should be able to state what would resolve it. That might mean a test, a narrower release or a change to access. If the issue remains open, the business owner should ask whether they have authority to accept it. A security or privacy owner may need to make a separate decision in their area.

Set a condition only when someone owns it and can check completion. Name the person, the required action and the event that triggers a further review. Avoid conditions such as monitoring closely unless the record also says what will be watched and who will respond.

If the parties disagree, preserve the objection alongside the final decision. The [risk sign-off FAQ](/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off) provides a related place to consider how the risk record is maintained.

## What counts as a decision to launch?

Use a small set of explicit outcomes: approve, approve with conditions, defer or reject. An approval should name the release and the use it covers. A conditional approval should say which controls must be in place before launch and which tasks may remain open afterward.

A deferred decision keeps the release on hold until the missing work is complete. A rejection closes the proposed release unless the team changes the proposal and asks for a fresh decision. In each case, the record should identify the decision-maker, the reviewers and the evidence they considered.

Do not turn a lack of response into consent. Set a review deadline through the normal release process, then follow up with any required reviewer who has not responded. If that person is unavailable, use a named alternate with the same decision authority. If no alternate exists, the owner should defer launch or escalate the gap.

The [governance playbook](https://airc.nist.gov/airmf-resources/playbook/) offers material for thinking through roles and risk decisions. Apply it to the actual release record, rather than treating a completed form as proof that the system is ready.

## Who owns the system after release?

Approval should include a handoff to the people who will run the system. Name an owner for service health, a contact for users and an owner for investigating harmful or incorrect outputs. Make sure each person can reach the team that can change or stop the system.

The operating team should know what normal use looks like and which signals call for action. Agree on how alerts reach a person who can respond, including outside the usual work period if the service runs then. An alert with no recipient is not a response plan.

Before release, walk through a failure that matters to the use case. For example, trace what happens if a system sends an incorrect customer response or attempts an unwanted change. Identify who pauses the workflow, who tells affected teams and who decides when it can resume.

The [monitoring chapter of the site reliability book](https://sre.google/sre-book/monitoring-distributed-systems/) is useful when choosing signals that prompt a response. For the ownership handoff, use the existing [system owner guidance](/blog/how-to-assign-an-owner-to-each-ai-tool). The launch decision should point to the live support arrangements, not just the project team’s draft.

## When should a change return for approval?

Set the boundary for renewed review at launch. A change to the intended users, data, connected tools or actions may alter the risks that reviewers accepted. A model or vendor change can also make earlier test results less useful for the release now planned.

The owner should decide which changes need a full decision and which need a focused check. A wording fix may need the usual release controls without a new business sign-off. Giving the system permission to send messages or make payments deserves review by the people who own those effects.

Keep the trigger tied to the scope of the prior decision. If the team cannot show that the changed system remains within that scope, bring the relevant reviewers back before release. Include the original objections and conditions so they can see what has changed.

For vendor updates, the [vendor model update review](/blog/how-to-review-ai-vendor-model-updates-after-deployment) covers a related decision path. Assign someone to receive change notices and decide whether a review is needed. Without that owner, a sound launch decision can become stale without anyone noticing.

## What should the launch record contain?

Keep the record short enough for reviewers to use and complete enough for someone else to reconstruct the decision. Include the release identifier, intended use, evidence links and the names and roles of required reviewers. Record each response and the final decision, with any conditions and open objections.

State the bounds of approval. Name the user group, data sources, allowed actions and any limits on where the system may run. If the team starts with a restricted group, record who can widen access and what evidence they need to see first.

Store the record where the system owner and support team can find it. Link to the current support route, the person who can pause the workflow and the process for reviewing a material change. Do not rely on a private message thread as the only record of a decision.

Before launch, the decision-maker should check that every required response is present and that any conditions due before release are complete. If evidence or authority is missing, keep the release on hold and name who will close the gap.
