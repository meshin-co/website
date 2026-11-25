---
title: How should boards run an AI incident tabletop exercise?
description: A practical board tabletop for an AI incident, from scenario design and escalation decisions to follow-up.
publishDate: 2026-11-25
updatedDate: 2026-11-25
shortAnswer: Boards should run an AI incident tabletop around a plausible business incident that forces directors to make decisions with incomplete information. Management presents changing evidence, the board tests escalation and oversight, and a facilitator records decisions, gaps and owners. The exercise ends with tracked changes to plans and a review of whether they work.
fullAnswer: |-
  Boards should run an AI incident tabletop by rehearsing the decisions they would face as an incident unfolds. How should boards run an AI incident tabletop exercise? Choose a plausible use of AI, give directors an initial report, and introduce new facts that change what they know. Keep the scenario close enough to the business that participants can test real reporting lines and approval rights.

  Management should explain what it is doing and what it needs from the board. Directors should challenge the evidence, weigh business harm, and decide when the board or a committee needs to act. The facilitator should record uncertainty as well as decisions, including who can stop a service and who can approve its return.

  After the session, assign each gap to a named owner with a due date. Ask for evidence that changes work, rather than treating attendance or a completed discussion as proof of readiness.
keyTakeaways:
  - Choose a scenario that exposes board decisions rather than technical trivia.
  - Test what reaches directors, when it reaches them and who has authority to act.
  - Give each gap an owner, a due date and evidence of completion.
  - Rehearse recovery and customer remedy as well as containment.
faq:
  - q: Who should attend an AI incident tabletop?
    a: Include the board members who may receive an escalation, the chief executive, the relevant business owner and the people responsible for technology, security, legal advice and communications. A facilitator should run the scenario and a separate note taker should capture decisions and gaps.
  - q: Should directors decide how to fix the AI system?
    a: Management should direct the technical response. Directors should test whether management has the authority, information and resources to contain harm, and make decisions reserved for the board under the company's own governance arrangements.
  - q: How does the board know the exercise led to change?
    a: Ask each owner to show the revised plan or other evidence of a completed action. Retest important changes with the people who would use them, and keep unresolved gaps on the board's risk agenda.
category: executive
tags:
  - ai-governance
  - security-review
sources:
  - title: CISA Tabletop Exercise Packages
    url: https://www.cisa.gov/resources-tools/services/cisa-tabletop-exercise-packages
    publisher: Cybersecurity and Infrastructure Security Agency
    retrieved: '2026-11-25'
  - title: Exercise in a Box
    url: https://www.ncsc.gov.uk/information/exercise-in-a-box
    publisher: National Cyber Security Centre
    retrieved: '2026-11-25'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-25'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

## What should the chair prepare?

Start with a business decision that directors may have to make under pressure. The chair and facilitator should agree on the purpose before inviting participants. A useful aim is to test whether the board receives enough information to oversee a response and make decisions reserved for it.

Choose a service with a clear owner, a meaningful customer or staff impact, and a known link to an AI tool. Use the [AI register](/glossary/ai-register) to identify the service, its supplier and the teams that depend on it. Ask the owner to check that the scenario reflects the actual workflow without revealing the planned twists.

The facilitator should gather the current incident plan, contact paths and board delegation rules. These are working materials, not a pre-session test of memory. Give directors a short briefing on the service and their role, but keep the later evidence out of that briefing. Protect any real customer details used to make the exercise credible.

## Which scenario will produce useful decisions?

Pick a failure that could spread through an ordinary business process. For example, imagine an AI-supported customer service tool sends incorrect account instructions. Staff notice conflicting replies, while the supplier says it is investigating a recent change. The company does not yet know how many customers acted on the instructions.

This is a fictional exercise, not a claim about an actual supplier or customer. Its value comes from the choices it creates. Management must decide whether to pause the tool, how to support affected customers and what evidence to preserve. Directors must decide what they need to know and whether any reserved decision has reached them.

Write the scenario from the business impact backward. If the service cannot be paused without disrupting support, make that trade-off visible. If a vendor controls part of the service, specify what the company can and cannot do on its own. Leave some facts unresolved so the group must state assumptions instead of waiting for certainty.

The [exercise materials from CISA](https://www.cisa.gov/resources-tools/services/cisa-tabletop-exercise-packages) can help the facilitator shape the session. Adapt the prompts to the company's own services, contracts and decision rights.

## Who needs to be in the room?

Invite the directors who would receive an escalation and the executives who would lead the response. Include the business owner, technology and security leads, legal counsel and the person responsible for customer communications. Bring in the supplier relationship owner if the scenario depends on a vendor. A facilitator runs the discussion, while a separate note taker records decisions and gaps.

Make roles explicit before the scenario starts. Management directs the response and brings recommendations to the board. The chair keeps directors focused on oversight, reserved decisions and the risks of the proposed course. The company's own delegations determine who may authorize a pause, a public statement or a return to service.

Use the existing [incident roles and escalation paths](/blog/how-to-assign-roles-and-escalation-paths-for-ai-incidents) as the starting point. Ask each participant to name a deputy and a way to reach that person. If an essential role is absent from the exercise, record how its absence affects the response rather than silently giving its authority to someone else.

## How should the scenario unfold?

Give the group an initial report with a known impact, an uncertain cause and a pending decision. Ask management to explain its immediate response before directors discuss what they need. The facilitator then introduces changes as the discussion proceeds. Each change should make a previous assumption or decision worth testing again.

| Scenario prompt                                | Decision to test                                 | Evidence to request                                       |
| ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| Staff report conflicting customer instructions | Whether to pause the affected workflow           | Scope of the affected service and available alternatives  |
| A customer reports a loss                      | Whether to change the response and escalation    | What is known about harm and how reports are collected    |
| The supplier offers a fix                      | Whether the proposed recovery has enough support | Test results, limits and an independent review            |
| A journalist asks for comment                  | Who approves a response and what can be said     | Confirmed facts, open questions and the next update owner |

Do not give the group a full answer to every prompt. Ask what it would do with the evidence at hand, who would act and when the decision would be revisited. Record disagreements and the information that could change a decision. The [exercise resources from the UK National Cyber Security Centre](https://www.ncsc.gov.uk/information/exercise-in-a-box) offer another starting point for building prompts.

## What should reach the board, and when?

Test the actual route from the person who spots the problem to the chair or relevant committee. Ask the first recipient to describe what they would send, to whom and by which channel. Then let the intended recipient say whether that message supports a decision. A report that names a technical fault but omits customer impact may leave directors unable to judge the business risk.

The first board update should separate confirmed facts from estimates and unknowns. It should say what management has done, what may still be happening and which decision or support it seeks. The next update should explain what changed, including any decision that management reversed. Use the existing [board risk report](/blog/what-should-a-board-request-in-a-quarterly-ai-risk-report) as a reference for owners and risk context, while adapting the format to the incident.

Do not assume every incident belongs with the full board. Check the company's own thresholds, committee remit and delegation rules. Where a threshold is unclear, ask who can settle it during the incident and how that choice will be recorded. The exercise should expose a missing route before someone needs it.

## How should directors challenge the response?

Ask management to present a recommendation with its alternatives and the cost of waiting. Directors can then test whether the proposed response protects affected people while keeping essential services available. They should ask what would make management pause the tool, broaden the response or seek further authority. They should also ask what work can continue safely without the tool.

Keep the distinction between oversight and execution clear. A director can challenge the evidence for a technical fix without choosing the fix personally. If management needs a decision reserved for the board, the chair should state the decision, the options and any conflict that needs attention. The note taker should capture the rationale and the person responsible for carrying it out.

Consider customers who may have relied on an incorrect output. Ask who will identify them, how they can report harm and what remedy is available. A useful challenge also covers staff who must handle those contacts. The [customer appeal process](/blog/how-to-let-customers-appeal-ai-assisted-decisions) offers a route for examining how affected people can contest an outcome.

## What makes recovery safe enough to approve?

A supplier's promise to fix the issue should trigger questions, not automatic approval to resume. Ask the service owner to describe the proposed test, its limits and who will review the result. Test a case where the fix works for the reported error but the cause remains uncertain. Directors should see what residual risk management proposes to accept and who has authority to accept it.

The recovery plan should cover more than switching the tool back on. It should include checks for affected customers, a way to spot a repeat and a fallback if the problem returns. Ask how staff will learn that the service is available again and what they should do if they see another faulty response. If the vendor must act, identify the contact and the evidence the company needs from it.

Use the [AI risk framework](https://www.nist.gov/itl/ai-risk-management-framework) as a reference when framing questions about oversight and risk. For the exercise itself, tie each question to the service and the decisions in the room. A general statement that the risk is controlled is not enough to show that the proposed recovery addresses the observed harm.

## What happens after the exercise?

The facilitator should produce a record of decisions, open questions and gaps while the discussion is still fresh. Separate a missing plan from a plan that exists but did not work in practice. Capture strengths as well, including contacts or reports that helped the group act. Do not treat a participant's confidence as proof that a control works.

Give every gap an owner, a due date and a clear completion test. An owner might revise an escalation threshold, confirm a supplier contact or test a manual fallback with the service team. The board should ask for the resulting evidence, not just a status label. Where a gap crosses teams, name the person accountable for bringing the work together.

Review the action list through the normal board or committee process. If an owner cannot complete a change, record the reason and the interim risk decision. Rehearse the changed path with the people who will use it, including deputies where practical. Close an action only when the agreed evidence shows that the change works.
