---
title: Why your AI pilot never reached production
description: 'Most AI pilots stall on ownership, data rules and a missing outcome metric, not the model. Here is what has to be true before one reaches production.'
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortAnswer: 'Most AI pilots stall because no single person owns the risk, legal has never decided which data may reach a vendor, and success has no number attached to it. A pilot reaches production once someone is accountable for it, the data path is classified, an outcome is measured, and a regression triggers an automatic rollback.'
fullAnswer: 'AI pilots usually work in a demo and stall before production for organisational reasons, not technical ones. A prototype only has to impress the person running it. A production system has to survive a change of prompt, a change of model, and a change of the person who built it, without anyone noticing except through a number on a dashboard. Three conditions decide whether that happens. First, one named person owns the outcome and can be asked about it in a year, not just at launch. Second, someone with the authority to decide has classified which data the system may send to a vendor, so the question is answered before a security review asks it. Third, the team has picked a number that moves when the system works and put an automatic check in the build pipeline that fails when that number drops. Skip any one of the three and the project stays a pilot indefinitely.'
keyTakeaways:
  - 'A pilot stalls in the gap between a working demo and a system nobody has to babysit, and that gap is organisational, not technical.'
  - 'Production needs one named owner who is still answerable for the system a year after launch, not just on the day it ships.'
  - 'A system without a measured outcome cannot be defended in a security review, because there is nothing to point to when someone asks if it works.'
  - 'Evals in the build pipeline and a rollback path are what let a team change a prompt or a model without turning every release into a gamble.'
faq:
  - q: 'Why do AI pilots never make it to production?'
    a: 'Because a demo only has to impress the person running it, while production has to survive changes of prompt, model and staff without anyone noticing except through a dashboard number. Most pilots skip the ownership, data rules and measurement that make that possible, so they stay pilots indefinitely rather than failing outright.'
  - q: 'Who should own an AI project once it goes live?'
    a: 'One named person on the team that will run the system day to day, not the person who built the prototype. They need the authority to pause the system, the budget line for its running cost, and enough context to answer for it in a review a year after launch.'
  - q: 'How do you measure whether an AI pilot is actually working?'
    a: 'Pick one outcome the business already tracks, such as resolved tickets per hour or hours saved on a task, and set a floor for it before the pilot starts. Wire an automatic eval into the build so a prompt or model change that drops the number blocks the release rather than reaching users.'
category: operating-model
tags:
  - ai-pilots
  - production-readiness
  - ai-governance
  - llm-evals
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

A pilot stalls in the space between working once and working every time. Most proof-of-concepts skip four things production always needs: a named owner who still answers a year after launch, a decision about which data may leave the building, a number that says whether it is working, and an automatic check that catches a regression before a customer does.

## Where pilots actually stop

### Nobody owns the risk

Pilots are usually built by whoever was curious enough to try, and that person is rarely still around, or still in charge, once the project needs a decision about risk. Nobody has the standing to say the system is ready, and nobody has to explain a bad output to a customer or a regulator. Ownership is not a shared inbox or a Slack channel; it is one name attached to the outcome, with the budget and the authority to pause the system if it misbehaves. Without that name, every stall becomes permanent, because nobody is accountable for unsticking it.

### Legal has not said which data may leave

Most pilots reach a vendor's API before anyone has classified the data going into the prompt. That is fine for a demo running on sample records; it stops a rollout the moment a security review asks what customer data the system touches and where it goes. The NIST AI RMF treats this as a governance decision under its Govern function, not a technical detail to settle after launch. Without a data classification written down in advance, every new use case reopens the same argument with legal, and the pilot waits on a decision nobody has been asked to make yet.

### There is no measurable outcome

A pilot that nobody can prove is working also cannot be proven to be failing, which is worse. Teams show accuracy on a curated test set, or a handful of good transcripts, but nobody has picked the business number the system is meant to move, such as tickets resolved, hours saved, or the error rate on a defined task. Without that number, a debate about whether to invest further has no evidence on either side, and the safest move for everyone involved is to let the pilot run quietly forever rather than kill it or fund it properly.

### Nobody would notice a regression

Prompts change, the underlying model changes on a provider's own schedule, and traffic drifts, but pilots rarely have a way to detect when any of that makes the output worse. There is no test suite running against real examples before a change ships, so a regression surfaces first as a customer complaint or a bad downstream decision, not as a failed build. That is the opposite of how the rest of the engineering organisation ships software, and it is usually the reason a platform or security review declines to sign off.

## What has to be true to ship

Six conditions turn a pilot into something a platform team will actually run. None of them are exotic; most engineering teams already do the equivalent for every other production system they own.

- **An owner.** One name, on the team that will run the system after the person who built it moves on, with the authority to pause it and a line in someone's job description that says they answer for it.
- **A data classification.** A written answer, agreed with whoever owns data risk, to what goes into a prompt, what a vendor may store, and what never leaves the building. Decide this once, in general terms, and reuse it, so it does not reopen for every new feature.
- **A measurable outcome.** One number the business already tracks, tied to the process the system touches, with a floor below which the system should not ship. If nobody can name that number, there is no way to know when to stop the project either.
- **Evals in CI.** A test set of real, representative inputs with expected outputs or acceptable ranges, run automatically on every prompt or model change, so a regression fails the build instead of reaching a user. OWASP's guidance for large language model applications treats this kind of automated check as basic hygiene against known failure classes, not an advanced feature to add later.
- **Tracing and cost per outcome.** Every run logged in enough detail to reconstruct what happened, with a cost figure attached to each successful outcome that a finance team can read without an engineer translating it.
- **Rollback.** A way to revert to the previous prompt, model or version within minutes, exercised at least once before launch so it is not the first time anyone tries it during a real incident.

For a system that touches decisions about people, the EU AI Act sets a similar bar for higher-risk uses: a documented risk-management process, records that make a decision traceable, and a human who can step in. Meeting the six conditions above gets most of the way there even for teams the Act does not yet cover.

## How I would sequence it

I run this as one pass, not six parallel workstreams, because the six conditions above depend on each other. You cannot set a rollback threshold before you have a measured outcome, and you cannot classify data before someone owns the decision to do it.

### Pick one process

Choose a single workflow with enough volume to matter and an outcome you can measure without a survey, not five pilots running at once. An AI Readiness & Risk Assessment is the fastest way to get that choice onto paper: two weeks of reading the systems and vendor list that already exist, ending in a memo that names an owner candidate, a first data classification, and the number the process should move.

### Build it in ninety days

A 90-Day Production Sprint turns that memo into a running system: evals written alongside the first working version rather than bolted on at the end, tracing and cost per outcome live on a dashboard from week one, and the rollback path rehearsed before real traffic arrives rather than during the first incident.

### Hand it to someone who was in the room

The internal owner should have written at least one eval case and watched the rollback rehearsal, so the runbook describes a system they already understand. A handover document given to someone who was not part of the build is a liability with a due date, not a transfer of knowledge.

## What this does not solve

This sequence gets one process into production with the six conditions in place. It does not solve everything else that makes AI governance hard.

It does not decide your risk appetite for you. Two companies with the same pilot and the same data can reasonably choose different answers about what a vendor is allowed to see; that is a decision for whoever owns risk at your company, not something a framework or an outside advisor can make for you.

It does not replace a legal review of your contracts with model vendors. Classifying data tells your lawyers what question to ask; it does not answer whether a specific vendor's terms are acceptable, and that answer changes as vendors change their terms.

It does not make the underlying model more reliable. Evals catch regressions against the cases you thought to test; they do not catch every way a general-purpose model can fail on a case nobody wrote down, which is part of why the rollback path matters as much as the evals do.

And it does not scale to five processes at once. The sequence above is built for one workflow with one owner. Running it for a second or third process repeats the same ninety days; it does not shortcut them.
