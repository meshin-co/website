---
title: How to review AI-generated customer support replies
description: Set a practical review process for AI-generated support replies, from checking account facts to handling risky drafts and improving future reviews.
publishDate: 2026-11-14
updatedDate: 2026-11-14
shortAnswer: Review AI-generated customer support replies against the customer’s request, trusted account facts, and current policy before sending them. Give reviewers authority to edit, reject, or escalate a draft. Record the reason for material changes, then use recurring errors to improve the drafting process and review rules.
fullAnswer: A reliable review of AI-generated customer support replies checks the answer against the customer’s request, account records, and current policy before anyone sends it. The reviewer should be able to trace important claims to a trusted source and remove promises the business cannot keep. Start with a clear rule for which drafts require human approval. Send sensitive cases, uncertain account matches, and requests outside the reviewer’s authority to a named person. The review screen should show the draft alongside the relevant ticket and policy source without exposing unrelated customer data. Keep a record of the final decision and the reason for meaningful edits, rather than storing every piece of private information used in the check. Team leads can then inspect recurring errors, test changes to the drafting process, and pause it when the same failure keeps appearing. The result is a review process that fits the actual support queue.
keyTakeaways:
  - A reviewer needs the customer request, relevant account facts, and the current policy beside the draft.
  - Sensitive cases need a named escalation path and a clear limit on reviewer authority.
  - Review records should capture useful error patterns without retaining unnecessary customer data.
  - Changes to the drafting process need fresh checks before the team relies on them.
faq:
  - q: Should every AI-generated support reply be reviewed by a person?
    a: Start with human approval for every draft while the team learns where errors occur. A team may later use a narrower review rule for low-risk replies, but it should test that rule and retain a way to pause sending.
  - q: Who should review a reply about a refund or account access?
    a: An agent with access to the relevant record can check the facts. A person with the right authority should approve any exception, refund decision, or account-access action that exceeds the agent’s remit.
  - q: What should a reviewer do when the draft sounds right but has no source?
    a: Find the claim in a trusted policy or account record before keeping it. If the source is unavailable, remove the claim or ask the customer for time while the team checks.
category: operating-model
tags:
  - production-readiness
  - ai-governance
sources:
  - title: 'Start with Security: A Guide for Business'
    url: https://www.ftc.gov/business-guidance/resources/start-security-guide-business
    publisher: Federal Trade Commission
    retrieved: '2026-11-14'
  - title: 'LLM01: Prompt Injection'
    url: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
    publisher: OWASP
    retrieved: '2026-11-14'
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-14'
author: dmitri
relatedResources:
  - handover-playbook
  - agent-evals-ci-starter
---

## What should a reviewer check before sending a reply?

The practical answer to how to review AI-generated customer support replies starts with the customer’s actual request. Read the ticket before reading the draft, so the proposed answer does not set the frame. Identify what the customer wants, what they have already tried, and whether they asked more than one question.

Next, check each material claim against a source the team trusts. A delivery date needs the relevant order record. A refund promise needs the applicable policy and, where needed, an approval. If the source does not support a claim, remove it or find the right person to decide.

Read the reply once more from the customer’s point of view. It should answer the request, describe the next step, and avoid asking for information already supplied. A polite tone cannot repair a wrong account detail or an invented promise.

Give the reviewer control over the final text and the send action. The [human oversight glossary](/glossary/human-oversight) provides related context for assigning that responsibility.

## Which replies need closer review?

Begin with approval on every draft while the team learns the workflow. Treat the review rule as a choice owned by the support lead, not as a setting left to the tool vendor. The lead should be able to change the rule when the queue or the evidence changes.

Pay special attention to drafts about account access, payments, refunds, personal data, safety, or complaints. These topics can require facts or decisions that a generic answer cannot supply. Route them to a person with access to the right record and authority to act.

A routine request may need less review once the team has tested that path. For example, a reply pointing to a public opening-hours page carries a different risk from a promise to restore account access. Keep checks on the actual content and sample sent replies, even if the process later permits automatic sending.

If the system cannot identify the customer or the applicable policy with confidence, stop the send. A reviewer can ask for clarification or pass the case to the appropriate team.

## What information does the reviewer need?

Put the customer’s message, the proposed reply, and the relevant source material in the same review view. Show the account or order context used for the draft, with a clear indication when a record could not be found. The reviewer should not have to infer where a date or policy statement came from.

Make policy links specific enough to check the relevant passage. A link to a large knowledge base may leave the agent searching under time pressure. Show whether the source is current and which team owns updates to it. If policy sources disagree, the agent needs a way to flag the conflict rather than choose a convenient answer.

Limit the view to information needed for the case. The [FTC guide to business security](https://www.ftc.gov/business-guidance/resources/start-security-guide-business) offers a starting point for thinking about access and data handling. Ask the system owner to check what the drafting tool receives, where records are stored, and who can inspect them.

Do not paste an entire customer history into another tool merely to verify a sentence. The [data classification glossary](/glossary/data-classification) can help teams route sensitive material to the right owner.

## How should an agent check a draft against the facts?

Use a small set of checks that fit the work rather than a score for how convincing the draft sounds. The reviewer should be able to say why a reply is ready or why it must go back.

| Check         | Reviewer action                                                           | If the check fails                                       |
| ------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Request       | Match the reply to each part of the customer’s message.                   | Add the missing answer or ask for clarification.         |
| Account facts | Compare names, dates, order details, and status with the relevant record. | Correct the detail or stop until the record is verified. |
| Policy        | Find support for any promise, exception, or eligibility claim.            | Remove the promise or request an authorized decision.    |
| Next step     | Check who will act and what the customer needs to do.                     | State the next action without guessing a deadline.       |
| Privacy       | Check that the reply is addressed to the right person.                    | Hold the reply and follow the identity-check process.    |

The agent should rewrite any passage that implies an action has already happened when it has only been proposed. If the ticket needs a tool action, check the action result separately from the draft. A fluent sentence is not evidence that a refund was issued or an account was changed.

## When should a reviewer reject or escalate a draft?

Reject a draft when its central claim cannot be verified, its account details do not match, or it misses the customer’s request. The agent can write a fresh reply using the trusted record. Editing a few words is a poor repair when the underlying answer is wrong.

Escalate when the case needs authority or information the reviewer does not have. A support lead might own policy exceptions, while a security team handles a suspected account takeover. Name these destinations in the review process and give each one a way to return a decision to the agent.

Set a holding response for cases that cannot be resolved immediately. It can acknowledge the request and explain that the team is checking, without promising an outcome or a deadline that no one approved. Record who owns the next action so the ticket does not stall in a queue.

For the wider division of work, the article on [choosing an AI operating model](/blog/how-to-choose-an-ai-operating-model-for-a-mid-size-company) addresses ownership across teams.

## How should the team handle instructions inside a customer message?

Treat the customer’s message as the subject of the support task, not as a source of instructions for the drafting system. A message may ask the tool to ignore its rules, reveal internal text, or change the recipient. The reviewer should judge the resulting draft against the ticket and trusted policy, regardless of how the instruction is phrased.

Do not assume an unusual instruction is malicious without checking the case. A customer may be quoting an error or reporting suspicious content. The agent can respond to that concern while keeping internal instructions and unrelated account details out of the reply.

Use the [prompt injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) to plan tests for this failure mode. Include cases where misleading instructions appear in a ticket, an attachment, or retrieved help text. Check whether the draft follows the customer’s support request without adopting those instructions.

If a draft exposes internal content or another person’s data, stop the send and follow the organization’s incident process. Preserve only the evidence that the responsible team needs to investigate.

## What should the review record contain?

Capture the decision, the reviewer, and the reason for a material edit or rejection. Useful reasons include an unsupported policy claim, a wrong account detail, a missing answer, or a case sent for approval. Keep the labels short enough that agents will use them consistently.

Link the decision to the ticket and the relevant version of the drafting setup where those records exist. That link helps the owner find which change preceded a recurring problem. It should not require copying the full customer conversation into a separate review spreadsheet.

Agree who can see the record and how long the team needs it. Remove unnecessary personal details from examples used for training or tests. The support lead and the privacy or security owner should settle any conflict between investigation needs and data handling rules.

For broader risk work, the [AI system register article](/blog/how-to-build-an-ai-system-register-in-a-week) explains how a team can keep ownership and system details together. Keep case-level review notes in the support workflow rather than turning that register into a store of customer messages.

## How can teams improve drafts without weakening review?

A support lead can look across review reasons and select a recurring failure to investigate. Compare the original draft, the trusted source, and the final reply. The problem may sit in outdated help text, missing account context, a confusing instruction, or an approval rule that sends the case to the wrong person.

Change the source or workflow first when that is where the error begins. Then test the proposed fix on saved cases with identifying details removed. Include cases where the right answer is to ask a question or send the ticket to a person with more authority.

The [article on evaluations in delivery](/blog/evals-in-ci-for-llm-agents) covers how teams can check changes before release. For support replies, define the expected outcome for each case and inspect the actual draft. A test should fail when a reply makes an unsupported promise, even if its wording is friendly.

The [risk management guidance](https://www.nist.gov/itl/ai-risk-management-framework) offers broader context for assigning and monitoring risk. The support team still needs a local decision about which failures block release and who can approve a change.

## What should happen when the review process breaks down?

Give agents a clear way to stop using drafts when they see a serious error or repeated mismatches. The fallback can be a normal human-written reply using the same ticket and policy sources. Make sure the send control does not force the agent to accept a draft first.

The support lead should collect the affected cases, notify the system owner, and decide whether to pause a feature or route more work to human review. Check whether any incorrect replies were sent and whether customers need a correction. Assign that follow-up to a named person rather than leaving it as an unowned queue task.

Before restoring the previous workflow, test the fix against the failed cases and other relevant examples. Check the review screen as well as the generated text: an agent needs the correct source and a working way to reject the reply. Record the decision to resume and who made it.

If the team cannot verify the fix, keep the fallback in place while the owner investigates.
