---
title: Why your AI pilot never reached production
description: 'Most AI pilots stall on ownership, data rules and a missing outcome metric, not the model. Here is what has to be true before one reaches production.'
publishDate: 2026-09-08
updatedDate: 2026-10-25
shortAnswer: 'Most AI pilots stall because no single person owns the risk, legal has never decided which data may reach a vendor and success has no number attached to it. A pilot reaches production once someone is accountable for it, the data path is classified, an outcome is measured and a regression triggers an automatic rollback.'
fullAnswer: 'An AI pilot never reached production because of an organisational gap, not a technical one. A demo only has to impress the person running it. Production has to survive a change of prompt, a change of model and a change of the person who built it. It has to do that without anyone noticing except a number on a dashboard. Six conditions decide whether that gap closes. One named owner still answers for the system a year after launch. A data classification signed off by someone with authority says what a vendor may see. An outcome number moves when the system works, matched by an eval that runs in the build pipeline before every release. Tracing shows which step produced a bad answer, and a rollback fires on a threshold, not an argument. Most stalled pilots are missing the first two, and a team cannot build the rest until those exist.'
keyTakeaways:
  - 'A pilot stalls in the gap between a working demo and a system nobody has to babysit, and that gap is organisational, not technical.'
  - 'Production needs one named owner who is still answerable for the system a year after launch, not just on the day it ships.'
  - 'Nobody can defend a system with no measured outcome in a security review, because there is nothing to show when someone asks if it works.'
  - 'Evals in the build pipeline and a rollback path are what let a team change a prompt or model without making every release a gamble.'
faq:
  - q: 'Why do AI pilots never make it to production?'
    a: 'Because a demo only has to impress the person running it, while production has to survive changes of prompt, model and staff without anyone noticing except through a dashboard number. Most pilots skip the ownership, data rules and measurement that make that possible, so they stay pilots indefinitely rather than failing outright.'
  - q: 'Who should own an AI project once it goes live?'
    a: 'One named person on the team that will run the system day to day, not the person who built the prototype. They need the authority to pause the system and the budget line for its running cost. They also need enough context to answer for it in a review a year after launch.'
  - q: 'How do you measure whether an AI pilot is actually working?'
    a: 'Pick one outcome the business already tracks, such as resolved tickets per hour or hours saved on a task. Set a floor for it before the pilot starts. Wire an automatic eval into the build so a prompt or model change that drops the number blocks the release rather than reaching users.'
category: operating-model
tags:
  - ai-pilots
  - production-readiness
  - ai-governance
  - evals-in-ci
sources:
  - title: 'Artificial Intelligence Risk Management Framework (AI RMF 1.0) | NIST'
    url: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10'
  - title: 'Regulation (EU) 2024/1689 (Artificial Intelligence Act) - EUR-Lex'
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj'
  - title: 'OWASP Top 10 for Large Language Model Applications'
    url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

A pilot stalls in the space between working once and working every time. Most proof-of-concepts skip four things production always needs. Two of them are a named owner who still answers a year after launch and a decision about which data may leave the building. The other two are a number that says whether the system is working, and an automatic check that catches a regression before a customer does.

## Where do pilots actually stop?

### Nobody owns the risk

Pilots are usually built by whoever was curious enough to try. That person is rarely still around, or still in charge, once the project needs a decision about risk. Nobody has the standing to say the system is ready, and nobody has to explain a bad output to a customer or a regulator.

Ownership means one name attached to the outcome, with the budget and the authority to pause the system if it misbehaves. A shared inbox or a Slack channel does not count. Without that name, every stall becomes permanent, because nobody is accountable for unsticking it.

### Legal has not said which data may leave

Most pilots reach a vendor's API before anyone has classified the data going into the prompt. That is fine for a demo running on sample records. It stops a rollout the moment a security review asks what customer data the system touches and where it goes.

The NIST AI RMF treats this as a governance decision under its Govern function, not a technical detail to settle after launch. Without a data classification written down in advance, every new use case reopens the same argument with legal. The pilot waits on a decision nobody has been asked to make yet.

### There is no measurable outcome

A pilot that nobody can prove is working also cannot be proven to be failing, which is worse. Teams show accuracy on a curated test set, or a handful of good transcripts. Nobody has picked the business number the system is meant to move. Examples are tickets resolved, hours saved or the error rate on a defined task.

Without that number, a debate about whether to invest further has no evidence on either side. The safest move for everyone involved is to let the pilot run quietly forever, rather than kill it or fund it properly.

### Nobody would notice a regression

Prompts change, the underlying model changes on a provider's own schedule, and traffic drifts. Pilots rarely have a way to detect when any of that makes the output worse. There is no test suite running against real examples before a change ships. So a regression appears first as a customer complaint or a bad downstream decision, not as a failed build.

That is the opposite of how the rest of the engineering organisation ships software. This gap is usually the reason a platform or security review declines to sign off.

## What has to be true to ship?

Six conditions turn a pilot into something a platform team will actually run. None of them are exotic. Most engineering teams already do the equivalent for every other production system they own.

| Condition                     | What it means in practice                                                                   | What its absence looks like                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| An owner.                     | One named person, on the team that runs the system, with authority to pause it.             | No one can explain a bad output, so the stall becomes permanent.                           |
| A data classification.        | A written answer, agreed with whoever owns data risk, on what a vendor may store.           | Every new use case reopens the same argument with legal.                                   |
| A measurable outcome.         | One number the business already tracks, with a floor the system must clear.                 | Nobody can prove the pilot works, so it runs quietly forever instead of shipping or dying. |
| Evals in CI.                  | Real test cases run on every prompt or model change; OWASP treats this as baseline hygiene. | A regression reaches a customer before anyone on the team sees it.                         |
| Tracing and cost per outcome. | Every run logged well enough to reconstruct, with a cost a finance team can read.           | Nobody can say what a run costs, or which step produced a bad answer.                      |
| Rollback.                     | A rehearsed way to revert to the last prompt, model or version within minutes.              | The team improvises during the first real incident instead of using a tested path.         |

For a system that touches decisions about people, the EU AI Act sets a similar bar for higher-risk uses. It requires a documented risk-management process, records that make a decision traceable and a human who can step in. Meeting the six conditions above gets most of the way there even for teams the Act does not yet cover.

## How would I sequence it?

I run this as one pass, not six parallel workstreams, because the six conditions above depend on each other. You cannot set a rollback threshold before you have a measured outcome, and you cannot classify data before someone owns the decision to do it.

### Pick one process

Choose a single workflow with enough volume to matter and an outcome you can measure without a survey, not five pilots running at once. An [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment) is the fastest way to get that choice onto paper. Two weeks of reading the existing systems and vendor list end in a memo. The memo names an owner candidate, a first data classification and the number the process should move.

For a rougher first pass, the [AI readiness scorecard](/resources/ai-readiness-scorecard) takes an afternoon.

### Build it in ninety days

A [90-Day Production Sprint](/services/90-day-production-sprint) turns that memo into a running system. Evals get written alongside the first working version, rather than bolted on at the end. Tracing and cost per outcome go live on a dashboard from week one. The rollback path gets rehearsed before real traffic arrives, not during the first incident.

### Hand it to someone who was in the room

The internal owner should have written at least one eval case and watched the rollback rehearsal, so the runbook describes a system they already understand. A handover document given to someone who was not part of the build is a liability with a due date, not a transfer of knowledge.

## What this does not solve

This sequence gets one process into production with the six conditions in place. Several harder governance questions stay outside it.

Your risk appetite is still your call, not this sequence's. Two companies with the same pilot and the same data can reasonably choose different answers about what a vendor may see. That decision belongs to whoever owns risk at your company, not something a framework or an outside advisor can make for you.

It does not replace a legal review of your contracts with model vendors. Classifying data tells your lawyers what question to ask. It does not answer whether a specific vendor's terms are acceptable, and that answer changes as vendors change their terms.

The underlying model is exactly as reliable as it was before this sequence started. Evals catch regressions against the cases you thought to test. They do not catch every way a general-purpose model can fail on a case nobody wrote down. That is why the rollback path matters as much as the evals do.

It does not scale to five processes at once. The sequence above is built for one workflow with one owner. Running it for a second or third process repeats the same ninety days. It does not shortcut them.
