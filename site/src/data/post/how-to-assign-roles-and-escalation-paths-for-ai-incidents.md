---
title: How to assign roles and escalation paths for AI incidents
description: How to assign roles and escalation paths for AI incidents, including stop authority, backup contacts and restart decisions.
publishDate: 2026-11-21
updatedDate: 2026-11-21
shortAnswer: To decide how to assign roles and escalation paths for AI incidents, name an incident lead and a deputy for each system. Give technical, business, security and privacy contacts explicit decision rights. Set triggers for escalation, record who can stop the system, and test the contact path before an incident.
fullAnswer: |-
  Assign AI incident roles by starting with the person who can coordinate the response and make decisions. Name a deputy, then identify the people who can stop the system, assess harm, secure evidence and speak to affected parties. Record each person's authority and contact route alongside the system they cover.

  Escalation paths should start with observable conditions, such as an unsafe action, exposed data or a failed control. They should say who receives the alert, who takes over if that person is unavailable, and when the business owner joins. A vendor contact belongs in the plan when a supplier controls part of the service, but the business still needs its own lead.

  Agree on the path before an incident. Walk through a realistic case, check that contacts can act, and fix any gaps in access or authority. Keep the plan with the system record and review it when ownership or the service changes.
keyTakeaways:
  - Give each system an incident lead, a deputy and a named person who can stop it.
  - Set escalation triggers around observable harm, failed controls and uncertainty about impact.
  - Keep technical containment, business decisions and external communications under explicit ownership.
  - Test the contact path and restart authority before the system needs them.
faq:
  - q: Who should lead an AI incident?
    a: Choose someone who can coordinate technical and business decisions for the affected system. That person needs access to responders and authority to call for containment. Name a deputy with the same practical access.
  - q: Should the AI vendor lead the response?
    a: A vendor should investigate the parts it controls, but the customer still needs an internal lead. That lead coordinates the vendor with business, security and privacy contacts and owns decisions within the customer's control.
  - q: When should an AI issue go to security or privacy?
    a: Send suspected unauthorized access, exposed credentials or hostile instructions to security. Bring in privacy when personal data may have been exposed, used incorrectly or sent to an unexpected destination. If the facts are unclear, ask the relevant team to assess them.
  - q: Who decides when the system can restart?
    a: Assign restart approval before an incident occurs. The approver should receive evidence that containment holds, the affected workflow has been checked and any remaining risk has an owner.
category: operating-model
tags:
  - ai-governance
  - production-readiness
  - security-review
sources:
  - title: 'Incident Response Recommendations and Considerations for Cybersecurity Risk Management: A CSF 2.0 Community Profile'
    url: https://csrc.nist.gov/pubs/sp/800/61/r3/final
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-21'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-21'
  - title: OWASP Top 10 for Large Language Model Applications
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
    publisher: OWASP
    retrieved: '2026-11-21'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
  - handover-playbook
---

## Who should own the response for each system?

The practical answer to how to assign roles and escalation paths for AI incidents starts with a named incident lead. Choose someone who knows the service and can bring the right people together. The lead does not need to perform every technical task. That person must be able to accept an alert, set a response owner and call for a stop.

Name a deputy with access to the same contact list and response tools. Record a reachable team or on-call route for times when neither person responds. Avoid a plan that sends an urgent message to a shared inbox without an expected recipient.

Put the assignments beside the system's entry in the [AI register](/glossary/ai-register). Include the affected workflow, the business owner, the technical owner and the route to the response team. If the same service supports several workflows, identify who can judge harm in each one.

A central response team can coordinate several systems. Each system still needs a local contact who understands its users, data and stop controls. Use the [operating model](/glossary/ai-operating-model) to place those responsibilities with existing teams.

## Which decisions should each person be able to make?

Write decisions as actions, not just job titles. An incident lead coordinates the response and calls in other teams. A technical responder can pause a workflow, restrict a tool or restore a known configuration. The business owner can decide whether a manual process can safely replace the affected service.

Security assesses suspected hostile activity and protects access. Privacy assesses possible effects on personal data. Legal and communications contacts advise on external obligations and messages when the facts call for them. The incident lead should know how to reach each team without waiting for a full diagnosis.

| Decision or task                     | Assigned role       | What the role needs                                |
| ------------------------------------ | ------------------- | -------------------------------------------------- |
| Coordinate the response              | Incident lead       | Contact routes and authority to call responders    |
| Stop or restrict the workflow        | Technical responder | Tested access to the relevant controls             |
| Assess business harm                 | Business owner      | Knowledge of affected users and decisions          |
| Assess a security or privacy concern | Relevant specialist | Access to the facts and a secure evidence route    |
| Approve restart                      | Named approver      | Evidence of checks and ownership of remaining risk |

A person may hold several roles in a small team. Check that the combination still leaves someone available to challenge a restart decision. The [handover playbook](/resources/handover-playbook) can help make access and ownership explicit when staff change.

## What should trigger an escalation?

Set triggers that a user or responder can observe without proving the cause. An unexpected payment request, a suspected data disclosure or a tool action outside its permitted scope should reach a named responder. A failed stop control deserves escalation even when no harm is yet confirmed.

Separate the first alert from the later assessment. A service desk contact can report what happened without deciding whether the issue is a security incident. The incident lead then brings in security, privacy or the business owner as the available facts require.

Record the condition, the receiving role and the next route if nobody accepts it. Use a higher-urgency path for ongoing harm or loss of control. If impact remains uncertain, state who must investigate and when the report should be raised again. Set response times that fit the workflow and check that the receiving team can meet them.

Review the [incident response guidance](https://csrc.nist.gov/pubs/sp/800/61/r3/final) when setting the wider response path. For AI-specific failure cases, use the [AI risk management framework](https://www.nist.gov/itl/ai-risk-management-framework) as a source for the scenarios your team tests.

## How does an alert reach someone who can act?

Give staff a simple reporting route that works from the tools they already use. The first message should identify the system, the observed behavior, the time of observation and any immediate harm. Ask for a safe reference to evidence rather than a copy of sensitive material in an open channel.

The receiving team should acknowledge ownership and tell the reporter what to do next. If the receiver cannot reach the incident lead, the plan should route the alert to the deputy. If both are unavailable, it should name the team that can stop the workflow or call the duty manager.

A handoff is complete when the next person accepts it, not when a message is sent. Until then, the current owner keeps trying the fallback route and records what has been attempted. That rule prevents an alert from disappearing between a vendor queue and an internal team.

Test the route with an ordinary user account as well as an administrator account. A plan that only works for people with privileged access leaves users without a reliable way to report harm.

## When should the vendor and outside teams join?

Bring the vendor in when the issue touches a service, model or control the vendor operates. Give the supplier the incident reference, the affected service and a clear request. Ask who owns the investigation on its side and how updates will reach the internal lead.

Do not wait for the vendor to confirm a cause before using a local stop control. The business owner and technical responder should know which actions remain available inside their own environment. If the supplier alone can disable a component, record that dependency and the fallback for an unanswered request.

Security should join when the facts suggest unauthorized access, exposed credentials or hostile instructions. Privacy should join when personal data may have reached an unexpected recipient or been used outside its intended workflow. Ask legal and communications contacts to assess any notice or reporting duties against the facts and applicable rules.

The lead keeps a single decision record across these workstreams. That record should distinguish what the vendor has confirmed from what the internal team has observed. Share only the evidence each recipient needs, using an approved channel.

## How should the team contain harm and preserve evidence?

Give the technical responder a short list of controls for the affected workflow. Depending on the system, that might mean pausing automated actions, removing a tool permission or routing work to a person. The business owner should confirm what happens to work already in progress.

Before changing a system, capture the information needed to understand the issue when it is safe to do so. Useful records can include the affected request, tool calls, configuration and timestamps. Restrict access to those records because they may contain sensitive data or credentials.

Containment can take priority when a delay would allow harm to continue. Record the action taken and preserve what remains available after the stop. The lead should also note who authorized the change and any uncertainty about its effect.

Use the site's guidance on [tracing tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) to plan what responders can inspect. Review the [language model application security project](https://owasp.org/www-project-top-10-for-large-language-model-applications/) for cases to include in the response exercise. Neither source replaces a test of the actual controls and access paths in your service.

## Who can approve a restart?

Name the restart approver separately from the person who applies the fix where staffing permits. The approver needs a concise account of the failure, the containment action and the checks performed. Include unresolved questions and the person responsible for each remaining risk.

The business owner should confirm that the proposed workflow is acceptable for affected users. Security or privacy should review the restart when their area was involved in the response. If the approver accepts a temporary restriction, record the restriction and who will check that it remains in place.

Test the path from the user's side before restoring normal traffic. Check that the stop control still works and that the behavior which prompted the alert no longer appears in the tested case. A successful check does not prove that every failure has been removed, so keep the response contact available after restart.

For a deployment change, use the [rollback procedure](/blog/how-to-roll-back-an-ai-agent-deployment) to agree on the technical steps in advance. If the team cannot establish a safe operating state, keep the affected action paused and use the agreed fallback.

## How can a team test and maintain the path?

Run a tabletop exercise with the people named in the plan. Give them a plausible report, such as an agent sending data to an unexpected destination. Ask the reporter to use the real contact route and ask the lead to identify the next decision.

Continue until the group has named who can stop the action, who contacts the vendor and who assesses affected users. Then change a condition: the lead is unavailable, or the stop control does not work. The deputy and fallback team should be able to explain what they would do without relying on the missing person.

Capture missed calls, unclear authority and access failures as assigned work. Give each fix an owner and a date for review. Repeat the relevant part of the exercise after the fix rather than treating a revised document as proof that it works.

Review contacts when teams, vendors or system permissions change. A new owner should accept the role and check access before the previous owner leaves. Keep the current plan near the system record, and make the reporting route visible to the people who use the service.
