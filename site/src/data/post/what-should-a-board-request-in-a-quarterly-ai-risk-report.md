---
title: What should a board request in a quarterly AI risk report?
description: What boards should request in a quarterly AI risk report, from material exposures and control evidence to incidents and decisions.
publishDate: 2026-11-10
updatedDate: 2026-11-10
shortAnswer: A board should request a quarterly AI risk report that shows material exposure, changes since the last review, control failures, incidents, accountable owners, and decisions needed. The report should also state what management cannot yet verify and when the board can expect an update.
fullAnswer: |-
  A useful quarterly AI risk report gives the board a view of material exposure and the choices management needs it to make. It connects each significant risk to a business use, an accountable owner, evidence about controls, and a next step.

  The report should cover changes in AI use, incidents and near misses, supplier dependencies, and gaps in oversight. It should distinguish a control that exists on paper from one that has been tested in the relevant workflow. Where evidence is missing, management should say so rather than treat the absence of a reported problem as proof of safety.

  The board does not need every technical detail. It does need enough context to challenge a decision to accept a risk, fund a remedy, or pause a use. A short decision page can carry those choices, with a supporting register available for review.
keyTakeaways:
  - Tie each material AI risk to a business use, an owner, and evidence of control performance.
  - Show what changed since the last report, including gaps in the information available.
  - Give the board explicit decisions, options, and consequences rather than a list of status labels.
  - Escalate urgent issues when they arise instead of waiting for the next scheduled report.
faq:
  - q: Should the board review every AI tool?
    a: The board should review material exposure and the process management uses to find and assess tools. It can request details on a particular tool when its use, dependencies, or impact warrant closer scrutiny.
  - q: Who should prepare the quarterly AI risk report?
    a: An accountable executive should own the report and gather input from the teams responsible for risk, security, legal matters, procurement, and the affected business uses. Each material risk should have a named owner who can explain the evidence and proposed response.
  - q: Should an AI incident wait for the quarterly report?
    a: No. Management should use the company's escalation process for an issue that needs a timely decision. The next report can record what happened, what was decided, and what remains open.
category: executive
tags:
  - ai-governance
  - ai-register
  - security-review
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-10'
  - title: Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-10'
  - title: OECD AI Principles
    url: https://oecd.ai/en/ai-principles
    publisher: Organisation for Economic Co-operation and Development
    retrieved: '2026-11-10'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## What belongs on the board's decision page?

The decision page should show risks that could change a business decision. The test for the pack is simple: what should a board request in a quarterly AI risk report? Management should make the answer visible before directors reach the supporting detail.

For each material item, state the affected activity, potential harm, and accountable person. Then say what changed since the last review and why it matters. A new customer service use may matter because staff rely on its output. That can be true even if the underlying tool is familiar.

Use a compact table to make the choices clear for directors. The entries are prompts for management, not a substitute for supporting evidence.

| Board prompt | What the report should show                                |
| ------------ | ---------------------------------------------------------- |
| Exposure     | The business activity, people affected, and plausible harm |
| Change       | New uses, changed access, incidents, or missing evidence   |
| Control      | The safeguard in place and what its latest test showed     |
| Decision     | The options, proposed owner, and consequence of delay      |

Keep routine detail in an appendix that directors can request when needed. A status label helps readers scan the page but cannot justify acceptance. If management proposes to accept an open risk, describe the limits of that acceptance. State when the owner will bring the decision back for review.

The page should make disagreements visible rather than blend them into a rating. If teams differ on the proposed response, explain the basis for each view. Directors can then ask which facts would resolve the difference.

## Which AI uses and changes should the board see?

Ask management to group uses by business consequence rather than model or supplier. Internal note drafting and customer decisions may need different levels of scrutiny. The report should explain where people or business processes rely on each use.

The [AI register](/glossary/ai-register) can support this view of the company's uses. The board pack should highlight additions, retired uses, and changes in purpose. It should also flag uses that have no confirmed business owner. Link each material entry to the person who can authorize changes. Someone should check the register against the work people actually do.

Ask how management finds uses that are missing from the register. Procurement records, expense claims, staff reports, and access records offer different views. None should be presented as complete unless management can support that claim.

Where the picture is incomplete, identify affected teams and the plan to investigate. A claim that no unapproved tools were found needs a clear scope. The board should know whether anyone checked staff use before making it. Directors can then judge whether the proposed review has a suitable owner.

A change in use may also shift responsibility between business teams. The pack should show who accepts the risk after such a handover. If ownership is disputed, name the person charged with resolving it.

## What evidence should support a risk rating?

A risk rating needs enough evidence for a director to challenge it. Ask what could happen, who could be affected, and how harm might arise. The report should explain why management assigned that level of attention.

Separate the design of a safeguard from its performance in daily work. A rule requiring staff review tells the board what should happen. A sample of completed reviews can show what happened in practice. Include failures found in the sample and the follow-up assigned to an owner. If no test has been run, the report should say that plainly.

Evidence needs a clear scope and a named reviewer. A test of one workflow does not establish protection in another workflow. Note the use examined, the test conditions, the result, and the reviewer. Where a test found a gap, say whether the use continued. The pack should identify who approved that choice and on what basis.

The [risk framework](https://www.nist.gov/itl/ai-risk-management-framework) is a useful reference for shaping management's questions. For the board pack, readers should be able to trace ratings to evidence. A policy link alone does not show that a safeguard works in practice.

Directors should also ask when the evidence was last checked against the use. Old test results may say little about a workflow that has since changed. Management should identify the change and decide whether a fresh test is needed.

## How should incidents and near misses appear?

The report should describe material incidents and near misses in business terms. Include the affected use, potential harm, discovery time, and immediate response. Name the investigation owner and the person who can authorize a return to use.

Distinguish a confirmed event from an allegation that remains under review. If facts are incomplete, state what remains unknown and when management expects to report back. A near miss warrants attention when the same path could lead to harm. Describe the conditions that prevented harm and whether those conditions can be relied on.

Show whether the response addressed the source or only the visible effect. Correcting an output may leave the same input path open for reuse. The board should see what changed in the workflow after the event. Management should also say how it will check that the change holds.

A quiet reporting period needs context for the board's discussion too. Ask how staff raise concerns and who reviews reports before they reach leadership. Low reported volume may reflect few events or poor visibility. Management should explain which reading the available evidence supports and where doubts remain.

For a recurring issue, show the history of prior fixes and their results. That history can help directors judge whether the proposed response addresses the cause. It can also expose actions that were closed before anyone checked their effect.

## What should the board ask about suppliers and data?

For material supplier uses, identify the service and the business process it supports. Name the relationship owner and show what data enters the service. Summarize checks on access, retention, and further use of that data. Flag questions that remain open in the contract or in practice.

A supplier's assurance does not describe every way the company uses a service. Ask what the company verified in its configuration and what relies on supplier statements. The [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) can help frame that review.

Changes deserve a separate line in the pack for each material use. A new data source or wider staff access can alter the exposure. The same is true when a supplier changes the service itself. Management should name the reviewer and flag planned uses awaiting approval.

For questions about personal data, the [privacy framework](https://www.nist.gov/privacy-framework) offers a reference for discussion. The board should also see the response if a key supplier becomes unavailable. Options might include a manual fallback or a pause in the affected process. The business owner should test the chosen option before it is needed.

Where a supplier answer remains incomplete, record the question and its impact. The report should say whether management is comfortable continuing while it seeks clarification. That choice needs an owner and a date for checking progress.

## Which decisions and open actions need board attention?

Each decision request should name a decision maker and a date for an answer. Set out the options, recommendation, and exposure that comes with delay. Management may be able to decide within its existing authority. In that case, the report can record the choice without seeking duplicate approval.

For an open action, show the owner and the intended result. Include the evidence that will demonstrate completion, rather than just a target date. A plan to revise training differs from evidence that the affected team completed it. If the target has moved, explain why and what temporary protection remains.

Risk acceptance needs the same discipline as any other significant decision. Identify who accepted the risk and what facts supported that choice. State what would cause the owner to review the acceptance again. Monitoring may still be needed when the use or its data changes.

The [risk sign-off process](/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off) provides a route into the ownership question. Directors can also consult the [principles for responsible AI](https://oecd.ai/en/ai-principles) for a broader discussion. The report should translate those questions into choices about the company's activities.

When an action depends on another team, show that dependency beside the owner. A missed dependency can leave a remedy open even after its main task ends. The board can ask who will resolve the blockage and report progress.

## How should the board follow up between reports?

Agree on issues that management must escalate before the next scheduled review. Each trigger should describe the event and identify who receives the notice. An urgent issue should follow the company's escalation route without waiting for a draft pack.

The next report should show what happened after a board decision. Record whether the chosen action started and whether its owner changed. Explain if new evidence altered management's view of the original decision. If management took a different path, name who approved it and why.

Keep the reporting format stable enough for directors to compare changes over time. Leave room for a new material risk that does not fit existing rows. A comparison is useful only when the scope of reporting is clear. If a business unit joins the process, identify that change in coverage. Do not treat the wider view alone as a sudden rise in exposure.

Directors can use the [board memo on AI strategy](/blog/board-memo-ai-strategy-one-page) alongside the risk pack. It can support discussion when a proposed use needs a wider business decision. Close the meeting by recording decisions, follow-up owners, and evidence expected at the next review.
