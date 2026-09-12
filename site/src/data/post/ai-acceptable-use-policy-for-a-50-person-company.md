---
title: What actually belongs in an AI acceptable use policy
description: 'What a working AI acceptable use policy has to decide, what it must refuse to do, and how a company of 30 to 300 people gets staff to follow it.'
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortAnswer: 'An AI acceptable use policy for a company of 30 to 300 people classifies which data may reach which AI vendor, names who approves a new tool, and requires review before AI output reaches a customer. It must not try to ban AI outright or list every tool by name. It also names who decides after a breach.'
fullAnswer: 'An AI acceptable use policy only earns its place once it decides who approves a new AI tool and which data tier may reach which category of vendor. It also decides whether a person checks AI output before it reaches a customer or a contract, and when a customer must be told they are dealing with an AI system. Most templates answer the first two questions and stay quiet on the rest. That is exactly why staff read them once and then ignore them. A policy this size needs one named owner, not a committee, and a review interval short enough to catch the tool people started using without asking. ISO/IEC 42001 treats a policy like this as one part of a management system, not a standalone document. The EU AI Act already requires disclosure once an AI system talks to a customer directly. Skip the enforcement clause and none of the rest holds.'
keyTakeaways:
  - 'A policy earns compliance when it names an owner, a data tier and a request path for a new tool, not when it lists every AI product by name.'
  - 'The EU AI Act already requires disclosure once an AI system talks to a customer directly or generates content someone could mistake for work a human did, regardless of whether the system counts as high-risk.'
  - 'Banning AI outright does not remove the risk. It moves the same activity out of sight, which is how shadow AI starts.'
  - 'A rule with nobody named to decide what happens after a breach is a suggestion, and staff work that out within days.'
  - 'ISO/IEC 42001 treats the policy as part of a recurring cycle: owned, reviewed on a schedule, and checked against what the AI register actually shows people using.'
faq:
  - q: 'Does a company of 30 people really need a written AI policy?'
    a: 'Yes. Once more than one person can install a browser extension or open a chatbot account, verbal guidance stops being enough. A one-page policy with a named owner is less work than the meeting that follows the first incident.'
  - q: 'Should the policy list every approved AI tool by name?'
    a: 'No. A named-tool list goes stale within weeks and implies anything missing from it is fine by default. Classify data instead, and give staff a fast path to add a tool, so the approved list stays current without a rewrite.'
  - q: 'Who should own the policy?'
    a: 'One named person with the authority to approve or block a tool, and the standing to answer for that decision. That is usually whoever already owns AI risk generally, not a committee and not an HR document nobody maintains.'
  - q: 'What happens the first time someone breaks the policy?'
    a: 'It depends on intent. Someone who used an unapproved tool without knowing the rule gets a conversation and a correction. Someone who ignored a direct no, or hid that AI wrote something they signed their own name to, goes through the same disciplinary process as any other policy breach.'
  - q: 'How is this different from a data protection or security policy?'
    a: 'It sits next to them, not instead of them. A security policy controls access and infrastructure. A data protection policy covers personal data generally. This one is specific to what staff paste into an AI system and what a vendor may do with it.'
category: governance
tags:
  - acceptable-use-policy
  - ai-governance
  - shadow-ai
  - policy-enforcement
sources:
  - title: 'ISO/IEC 42001:2023 - AI management systems'
    url: 'https://www.iso.org/standard/42001'
  - title: 'Regulation (EU) 2024/1689 (Artificial Intelligence Act) - EUR-Lex'
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj'
  - title: 'OWASP GenAI LLM Top 10 2026'
    url: 'https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

Most companies between 30 and 300 people already have staff using AI tools, whether or not a policy says so. The policy that works is not the longest one. It states which data may go where, who approves a new tool, and what happens when someone gets it wrong, in language a new hire reads in one sitting.

## What does a working AI acceptable use policy actually need to say?

A policy that survives contact with real staff decides a short list of things, not a long one. Six sections make up a working one. Each row here names the section, the decision it forces, and the specific failure it exists to prevent.

| Section                     | What it decides                                                                          | Failure it prevents                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Scope                       | Which staff, contractors and AI tools the policy covers.                                 | A contractor or a new hire assuming the rules do not apply to them.                       |
| Data classification         | Which data tier may reach which category of AI vendor.                                   | Client or personal data pasted into a public chatbot with no data agreement.              |
| Approved tools and requests | Which AI systems are pre-approved, and how staff add another one.                        | Staff picking an unapproved tool because asking takes too long.                           |
| Human review                | Whether a person checks AI output before it reaches a customer, a contract or a filing.  | An unreviewed AI draft going out under someone's name.                                    |
| Customer disclosure         | When a customer must be told they are talking to an AI system or seeing AI-made content. | A hidden AI interaction reaching a customer where disclosure is a legal duty.             |
| Vendor training use         | Whether a vendor may use company or client input to train its own models.                | Confidential input quietly improving a vendor's public model.                             |
| Ownership and review        | Who owns the policy, and how often it is checked against what staff actually use.        | A policy that describes a tool nobody uses, and stays silent about the one everyone does. |
| Incident reporting          | What staff do the moment an AI system produces something wrong or exposes data.          | A bad output or a leak going unreported because nobody knew who to tell.                  |
| Enforcement                 | What happens after a breach, and who decides.                                            | A rule everyone knows is never actually enforced.                                         |

The customer disclosure row is not optional once a system talks to people outside the company. Article 50 of the EU AI Act already requires a provider or a deployer to tell a person they are interacting with an AI system.

It also requires labelling content the system generated, whether or not that system counts as high-risk. A staff-facing policy has to name who checks that duty before a customer-facing AI feature ships, not leave it to whoever built the feature to remember.

## What should the policy refuse to try to do?

A policy that tries to be the technical control fails twice: once because a paragraph of text cannot stop a paste into a browser, and once because staff read that overreach as proof the whole document is for show. Access limits, contract terms and vendor settings do the technical work. The policy states the rule those controls exist to support.

Listing every approved tool by name reads as complete on the day it is published and is wrong within weeks, because a new model or a new vendor account always arrives faster than a document gets updated. A policy built around named tools also implies that anything missing from the list is quietly fine, which is the opposite of what a reviewer wants to see.

An outright ban is the easiest policy to write and the least effective one to run. It does not remove the reason someone went looking for an AI tool in the first place. It just moves that search out of sight, where it is much harder to see or govern.

## What do you do about the tools staff are already using?

By the time a policy is drafted, some staff are already drafting client emails in a personal chatbot account, running a browser extension nobody vetted, or building a habit around a coding assistant they picked themselves, without asking anyone first. That is [shadow AI](/glossary/shadow-ai), and treating it as rare is the first mistake a policy can make.

Two moves fix more of it than a warning email does. First, make the approved path faster than the workaround: a fast yes for a low-risk tool beats a slow review nobody wants to wait for. Second, check instead of asking. Checking browser extensions, expense claims and what the company actually pays AI vendors shows what people are really running, which beats trusting a self-reported survey.

## What happens when someone breaks the policy?

Most breaches are not sabotage. Someone pastes a client's contract into a personal chatbot account to move faster, not to leak it. That is different from someone who was told a tool was blocked and used it anyway, or who hid AI involvement in work they signed off as their own. A policy that cannot tell the two apart will punish the wrong case or excuse the real one.

One named role decides what happens next: the same person who owns the AI register and the policy itself, not a group chat and not a vote. They classify what happened, decide whether legal or an affected client needs to hear about it, and choose the response, from a conversation to removal of access to company systems.

That decision runs through the disciplinary process HR already has for any other policy breach. The AI policy does not need a punishment system of its own; it needs a clear point where that existing process starts. Silence is its own answer too: a policy that never states what happens after a breach gets tested once, and staff learn from the result whether any of it is real.

## Who should own it, and how does it stay current?

The same person who is already accountable for AI risk generally should hold this document, for the reason a shared inbox cannot hold it: someone has to be answerable when a customer or an auditor asks a direct question. [ISO/IEC 42001](/glossary/iso-iec-42001) treats a policy like this as one part of a management system, reviewed on a schedule and checked against a live inventory.

A review interval only works if it is tied to something that actually changes: a new hire, a new vendor account, a client contract that names a data rule of its own. Quarterly is a reasonable default for a company this size. The exact interval matters less than the fact that one exists and someone is accountable for keeping it.

The version I run for my own practice is public at [my AI policy](/ai-policy), one page, as a worked example of the same shape at a much smaller scale. The [Starter Kit](/resources/ai-governance-starter-kit) sets out the same structure as a table you can copy, sized for a company with more than one person to coordinate.

## What doesn't a policy like this solve?

A written policy does not tell you whether anyone inside the company actually owns AI risk today. If nobody does, that gap usually surfaces during an [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment) before it ever reaches the policy stage, because there is no obvious person to hand the draft to.

Someone determined to break the rule will do it regardless; no policy stops that. What it removes is the excuse of not knowing, and it gives the company a fair, defensible reason to act when someone crosses the line anyway.

Nobody enforces it without an owner, a review date and a stated consequence. Skip those and it is a page people skim once and never open again.
