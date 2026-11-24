---
title: How to prioritize competing AI project requests
description: How to prioritize competing AI project requests using a common intake, risk checks and delivery capacity.
publishDate: 2026-11-23
updatedDate: 2026-11-23
shortAnswer: Prioritize competing AI project requests by comparing the business problem, expected benefit, risk, evidence and delivery capacity on the same terms. Set safety and legal checks before ranking, then choose the work with the strongest case that the team can support. Record who decides, what waits and when to revisit the choice.
fullAnswer: Competing AI project requests need a shared decision process that weighs value, risk and delivery capacity. Ask each sponsor to describe the problem, the people affected and the result they want to change. Compare the requests against the same baseline, including the cost of leaving the current process alone. Check whether the proposed data, access and human review are acceptable before treating a request as ready to start. A strong business case still needs a team with time to build, test and support it. Rank the ready requests, record the trade-offs and tell each sponsor what happens next. Keep uncertain ideas visible rather than forcing them into a false order. When evidence or capacity changes, revisit the decision. The aim is a short list the business can actually deliver, with an owner for each choice and a clear reason for work that must wait.
keyTakeaways:
  - Use the same intake questions to compare requests from different teams.
  - Treat unresolved risk and missing capacity as decisions to address, not scores to average away.
  - Record the reason for each choice and the condition that would bring a waiting request back.
faq:
  - q: Who should make the final call on competing AI requests?
    a: Give a named business leader the final call, with input from the people who own delivery, risk and the affected process. That leader should record the trade-off and explain it to sponsors.
  - q: Should the request with the largest expected saving go first?
    a: Not automatically. Check the estimate against current work, delivery cost, risk and available capacity. A smaller request with stronger evidence and a clear owner may be a better choice.
  - q: What should happen to requests that are not selected?
    a: Tell the sponsor whether the request is waiting for capacity, needs evidence or has been declined. Record a condition for review so the request does not remain open without a purpose.
category: operating-model
tags:
  - ai-pilots
  - production-readiness
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-23'
  - title: Privacy Framework
    url: https://www.nist.gov/privacy-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-23'
  - title: Cybersecurity Framework
    url: https://www.nist.gov/cyberframework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-23'
author: dmitri
relatedResources:
  - ai-readiness-scorecard
---

## What information should every request contain?

To decide how to prioritize competing AI project requests, start with a common intake and ask sponsors to describe the work before proposing a tool. A request for an assistant tells the group little about the problem. A description of delays in handling customer queries gives the group something to test.

Ask for the current process, who performs it and where it breaks down. The sponsor should name the people affected and the outcome they want to change. Capture a reasonable baseline, even if it begins as an estimate. Mark the estimate as uncertain and identify who can check it.

The intake should also name a business owner who can make process decisions. Ask what data the work needs, which systems it touches and who will review its output. Include a proposed deadline and the reason for it. A deadline tied to an external commitment deserves a different discussion from a preferred launch date.

Keep the form short enough for teams to use. The intake is a starting point for comparison, not a demand for a finished design. If a sponsor cannot answer a question yet, record the gap and decide whether it blocks a fair review.

## How should you compare expected value?

Compare each request with the work that happens today, including the option of making no AI change. Ask what would improve for staff or customers and how the sponsor would observe that change. A request to reduce rework, for example, needs a way to count or sample that rework before and after a trial.

Separate potential benefit from confidence in the estimate. A sponsor may expect a large saving but have little evidence about how often the task occurs. Another may have a smaller expected benefit supported by process records. Show both the estimate and its basis, rather than letting the larger claim win by default.

Count the effort needed to reach and maintain the result. Include staff time for checking output, fixing errors and handling cases the tool cannot complete. The [shared cost allocation approach](/blog/how-to-allocate-shared-ai-tool-costs-across-departments) can help teams discuss costs that cross department lines.

Use a common comparison sheet with plain labels such as strong, uncertain and weak. Agree what those labels mean before reviewing submissions. The labels should prompt a discussion about evidence, not disguise a judgement as a precise forecast.

## Which risks should stop a request moving forward?

Review each request for harm before placing it in a delivery queue. Ask what could happen if the output is wrong, private data is exposed or an action reaches the wrong system. Consider who would notice the problem and who could stop it.

Some concerns call for a decision before work starts. For example, a team may lack permission to use the proposed customer data, or no person may be available to check a consequential output. Put the request on hold while the owner resolves the issue. A high expected benefit does not remove that need.

Other risks can be addressed during a limited test. Record the proposed control, the person responsible and the evidence needed before wider use. A test using a narrow set of approved records may answer a useful question without granting broad access. Agree those limits with the people who own the data and process.

Use the [risk management framework](https://www.nist.gov/itl/ai-risk-management-framework) as a source for structuring the review. The article on [ranking AI use cases by risk](/blog/how-to-rank-ai-use-cases-by-risk) offers a place to continue the risk discussion without folding every concern into a single value score.

## How do you account for delivery capacity?

A request is ready to rank for delivery only when the needed people and dependencies are visible. Ask the delivery lead for the work required to test the idea, connect systems and support the result. Include time from process owners, data owners and reviewers, not just the team building the tool.

Show the competing demand on the same people. If a specialist must review every proposal, that person's available time can set the pace for the whole queue. The same issue arises when several teams need access to a shared system or the same set of records.

Distinguish a small discovery task from a commitment to launch. A team might have room to inspect sample records but lack capacity to operate a customer-facing workflow. Record the discovery task as its own decision, with a question it must answer and a point at which the sponsor returns for approval.

For data and system access, consult the [privacy framework](https://www.nist.gov/privacy-framework) and the [cybersecurity framework](https://www.nist.gov/cyberframework) alongside the people responsible for those areas. The [readiness scorecard](/resources/ai-readiness-scorecard) can help the group surface gaps before it promises a start.

## What happens when requests score alike?

When requests look equally useful, compare the consequences of waiting. Ask each sponsor what will happen if the work starts later and what evidence supports that claim. A genuine deadline may settle the order, but the group should record the commitment behind it.

Next, compare the strength of the evidence and the effort needed to remove uncertainty. A request with accessible data and a willing process owner may be ready for a short test. Another may need access decisions before the team can learn whether the idea works. That difference affects the next step, even when both problems matter.

Use the table to make the choice visible rather than assigning arbitrary decimal scores.

| Comparison    | Request ready for a test             | Request needing more work              |
| ------------- | ------------------------------------ | -------------------------------------- |
| Evidence      | Current process can be observed      | Baseline is disputed or missing        |
| Access        | Data owner has agreed the test scope | Permission or source is unresolved     |
| Capacity      | Named staff can take part            | Required staff are committed elsewhere |
| Next decision | Approve a bounded test               | Assign an owner to close the gap       |

If the choice remains close, the decision maker should state the trade-off and choose. Rotating the favored department without regard to the evidence can leave important work waiting for the wrong reason.

## How should a decision meeting work?

Send the comparison sheet to participants before the meeting. Each sponsor should have a chance to correct the facts about their request. The delivery lead should flag shared dependencies, while the people responsible for risk and the affected process can challenge the proposed limits.

Give the meeting a named decision maker. That person needs authority to reserve capacity or ask the relevant budget owner for it. The [AI operating model](/glossary/ai-operating-model) is the place to examine how such responsibilities fit with the rest of the organization.

Decide which requests can start, which need more evidence and which should stop. For each selected request, name an owner, the next decision point and the capacity set aside. For requests that wait, state the reason and the event that would trigger another review.

Send the record to sponsors after the meeting. They should be able to see why a different request won without needing access to another team's sensitive data. If a sponsor disputes an assumption, give them a route to supply new evidence rather than a separate route around the queue.

## How do you handle an urgent request after priorities are set?

An urgent request should enter through the same intake, even if the review happens quickly. Ask what has changed, what harm could follow from waiting and who has authority to declare the work urgent. Capture the minimum facts needed to judge the request and assign the missing checks.

Make the displacement explicit. If the team starts the urgent work, identify the work that will pause and tell its owner. A sponsor who asks for immediate attention should understand the capacity being moved, rather than assuming the team has spare time.

The decision maker can approve a narrow response while the group gathers more evidence. For example, the team might inspect the affected process before building a tool. Record any temporary access or review limits and name the person who can end the work.

Bring the request back to the normal review once the immediate need is understood. If the case for urgency no longer holds, compare it with the waiting work. If it does hold, update the queue and the affected delivery commitments.

## When should the queue be reviewed again?

Set a regular review point that matches the pace of the work, and allow an earlier review when a material fact changes. New access to reliable data, a failed test or the loss of a key staff member can change the order. A louder sponsor, on its own, is not new evidence.

Ask owners to report what the team learned against the decision record. Check whether the test observed the problem described in the request and whether staff could review the output within the time available. Note any expected benefit that depended on work outside the team's control. Use the answers to decide whether to proceed, revise or stop.

Close requests that no longer have an owner or a credible next step. Tell the sponsor what would justify reopening them. Keep the record of the decision so a later team can see which assumption changed.

Before approving more work, check the capacity released by projects that stopped or shipped. The [adoption telemetry article](/blog/adoption-telemetry-measuring-if-ai-is-actually-used) covers how to examine use after release, when a priority decision becomes an operating commitment.
