---
title: How should boards divide AI oversight among committees?
description: How should boards divide AI oversight among committees, and when should the full board decide?
publishDate: 2026-11-16
updatedDate: 2026-11-16
shortAnswer: Boards should give each material AI issue a lead committee, name the committees that must contribute, and reserve cross-company trade-offs for the full board. Audit and risk can examine controls, technology can examine systems, and people committees can address workforce effects. Management remains responsible for operating the systems and reporting evidence.
fullAnswer: Boards should divide AI oversight by decision, with a lead committee for each issue and a clear path to the full board. The audit or risk committee can examine controls and exposure, while a technology committee can review system changes and security. A people committee can consider workforce effects and incentives. These are starting points, not fixed assignments. The right split depends on the board's charter, its skills and the company's activities. Management should provide a shared record of systems, owners, incidents and decisions so committees work from the same facts. When an issue spans several committees, the lead committee should gather their views rather than send management through separate, conflicting reviews. The full board should settle trade-offs that affect strategy, risk appetite or major investment. It should also check that committee charters leave no material issue without an owner. This approach keeps oversight distinct from the work of designing and running AI systems.
keyTakeaways:
  - Assign each material AI issue to a lead committee and record who else must contribute.
  - Keep management accountable for operating systems and supplying evidence to the board.
  - Send cross-company trade-offs and unresolved committee conflicts to the full board.
  - Review the allocation when the company's AI use, committee structure or risk profile changes.
faq:
  - q: Should a board create a separate AI committee?
    a: A board can use its existing committees if their charters, skills and meeting time cover the work. A separate committee may help when the workload or the need for specialist scrutiny warrants it. The full board should still retain decisions that cross committee boundaries.
  - q: Which committee should lead on an AI incident?
    a: The lead should follow the main exposure and the board's agreed allocation. A security incident may go first to the technology or risk committee. The lead should bring in other committees when customers, financial reporting or employees are affected.
  - q: Who decides when committees disagree?
    a: The full board should resolve a material disagreement that committees cannot settle within their delegated authority. The committee chairs should present the options, the evidence and the decision needed from the board.
category: executive
tags:
  - ai-governance
  - ai-register
  - security-review
sources:
  - title: G20/OECD Principles of Corporate Governance 2023
    url: https://www.oecd.org/en/publications/g20-oecd-principles-of-corporate-governance-2023_ed750b30-en.html
    publisher: OECD
    retrieved: '2026-11-16'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-16'
  - title: UK Corporate Governance Code
    url: https://www.frc.org.uk/library/standards-codes-policy/corporate-governance/uk-corporate-governance-code/
    publisher: Financial Reporting Council
    retrieved: '2026-11-16'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## How should boards divide AI oversight among committees?

Start with the decisions the board needs to supervise, then assign each decision a lead. Use existing committee charters as the starting point, not a new structure drawn around every AI tool. The board should approve the allocation and record where a matter returns to the full board.

| Area                             | Possible lead          | Other input to seek           |
| -------------------------------- | ---------------------- | ----------------------------- |
| Controls and financial exposure  | Audit or risk          | Technology and management     |
| System changes and security      | Technology or risk     | Audit and operational leaders |
| Workforce effects and incentives | People or compensation | Risk and business leaders     |
| Strategy and major trade-offs    | Full board             | All relevant committees       |

Treat the table as a design choice, not a rule for every company. A board without a technology committee can place those questions with risk or the full board. The [corporate governance principles](https://www.oecd.org/en/publications/g20-oecd-principles-of-corporate-governance-2023_ed750b30-en.html) offer a useful starting point for considering the board's role. Local law, the company's governing documents and its existing delegations still need review.

## What should audit or risk committees examine?

Give audit or risk the lead on whether management can identify material exposures and show that controls work. Ask for the owner of each significant use, the review performed before release and the evidence behind any exception. The committee can also examine how management records incidents and tracks overdue fixes.

Where AI affects financial reporting, audit should ask how the relevant finance controls address that use. A system that drafts a finance report may need a different review from one that changes an underlying record. The committee should ask management to show the distinction, rather than accept a broad statement that a person checks all output.

Risk does not need to run technical tests itself. It needs enough evidence to challenge management's assessment and request further work when a control fails. The [risk framework](https://www.nist.gov/itl/ai-risk-management-framework) can help management organise that discussion. If another committee owns security, the chairs should agree which findings require a joint review.

## Where should technology and security oversight sit?

A technology committee, where one exists, can examine how material systems are built, changed and retired. Its questions should cover access to data, changes to suppliers, testing before release and the ability to stop a failing workflow. The committee should ask who can make each change and who reviews it.

Security deserves a named lead even when the board has no technology committee. That lead can review access failures, supplier dependencies and the response to a compromise. Link those discussions to the [vendor assessment questionnaire](/blog/ai-vendor-assessment-questionnaire-template) when management relies on an outside provider. The board should see the remaining exposure after the proposed controls, not just a list of vendor promises.

If a technical issue could affect customers or financial records, the lead committee should involve the relevant chairs. A failed release test may be a technology matter at first. A decision to keep a flawed service running can become a business and risk trade-off for the full board.

## What belongs with the people committee?

The people or compensation committee can examine how AI changes roles, training needs and management incentives. Ask management which work may change, who will make decisions about redeployment and how staff can report problems. The committee should seek the views of the leaders responsible for the affected work.

Incentives need particular care when targets reward fast deployment or claimed savings. A target can encourage teams to report an output as a success before anyone has checked its quality. The committee can ask whether pay and performance measures account for service quality, staff review and unresolved risks.

The people committee should not make technical release decisions on its own. When a tool affects hiring, pay or employee monitoring, it should ask the risk and technology leads for their findings. Management remains responsible for the process and for getting legal advice where needed. The full board should resolve a proposed change that has material effects across the company.

## How do committees handle an issue that crosses their remits?

Choose a lead based on the decision at hand, then name the other committees whose input is needed. Record that choice with the matter, rather than relying on an informal agreement between chairs. The lead committee should gather the views and return a single recommendation to the board when escalation is needed.

Consider a supplier tool used to screen job applicants. The people committee might lead on the effect on candidates and hiring practice. Technology could examine access and supplier changes, while risk reviews the controls and any open exceptions. The lead should ask management for a joined-up paper that shows how those concerns affect the proposed decision.

If the issue changes, the lead can change too. A supplier outage may move the immediate discussion to technology or risk, while the people committee stays involved in the effect on applicants. Record the handoff and the next decision owner. This avoids leaving a material issue between agendas when the first committee has finished its review.

## What evidence should management bring to each committee?

Use a shared [AI system register](/blog/how-to-build-an-ai-system-register-in-a-week) as the starting point for committee papers. The register should let directors trace a material use to its business owner, supplier, purpose and status. Each committee can then ask for detail relevant to its remit without creating a separate list of systems.

A useful paper shows the decision requested, the evidence management relied on and the risks that remain. It should identify failed tests, open incidents and exceptions that need a decision. Where a benefit is claimed, ask for the baseline and the costs of staff review. The approach in [how boards can verify AI cost savings](/blog/how-can-boards-verify-ai-cost-savings) helps frame that request.

Ask management to distinguish a missing control from a control that exists but has not been tested. Both matter, but they call for different responses. A committee can request a corrective plan with a named owner and a return date. The board should be able to follow that item until someone confirms the work is complete.

## When should an issue go to the full board?

Escalate when a decision crosses delegated limits, changes the company's risk appetite or requires a major strategic trade-off. The board should also hear a material issue when committees disagree and cannot resolve it within their authority. Set these triggers in advance so a chair does not have to invent the route during an incident.

The escalation paper should state what has happened, what remains uncertain and what management wants the board to decide. Include the affected committees' views and the consequences of each available option. If delay has a cost, explain that cost alongside the case for waiting. The [board memo format](/blog/board-memo-ai-strategy-one-page) can help keep the decision visible.

Urgent matters need a contact path outside the normal meeting cycle. Agree who alerts the board chair, which committee chair coordinates the review and how other directors receive updates. Management should retain authority to contain an incident while directors consider matters reserved to them. Record the decision and bring follow-up work back through the assigned committee.

## How can a small board cover the work?

A small board can assign AI matters to existing committees or retain them on the full board agenda. The key is to name a lead for each area and give that person time to prepare. A chair can draw on outside advice where the board lacks a skill, while keeping the board accountable for its own decisions.

Avoid copying a larger company's committee chart without checking the actual workload. If the same directors sit on every committee, repeated papers may add meetings without improving scrutiny. A shared paper with distinct decision requests can make the work easier to follow. Directors can still record which remit they used to review each part.

The [governance starter kit](/resources/ai-governance-starter-kit) can help management assemble material for that review. Ask for a concise view of the uses that could materially affect customers, staff, operations or financial records. Then agree which matters need deeper evidence. The allocation should reflect the company's exposure and the directors' available skills, not the number of tools in use.

## When should the board revisit its allocation?

Review the split when a material new use, incident or supplier change exposes a gap in oversight. A change in committee membership can also leave a lead without the time or skills the role needs. The board chair should ask whether each material decision still has an owner and a route for escalation.

Use a recent decision as a test of the arrangement. Trace the paper from management to the lead committee, through any other chairs and back to the board if needed. Look for repeated requests, missing evidence and decisions that stalled between meetings. The [UK corporate governance code](https://www.frc.org.uk/library/standards-codes-policy/corporate-governance/uk-corporate-governance-code/) is a useful reference when reviewing board arrangements, subject to its scope and the company's circumstances.

Update the allocation and the relevant charters if the board changes a responsibility. Tell management who now receives each paper and who can approve an exception. Keep the old decision record available so directors can see why the handoff was made.
