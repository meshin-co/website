---
title: How to build an AI system register in a week
description: 'A step-by-step way to build an AI system register in a week without buying a tool, so a security reviewer gets the document they ask for first.'
publishDate: 2026-09-08
updatedDate: 2026-09-15
shortAnswer: 'An AI system register lists every AI tool a company builds, buys or lets a team adopt: what it does, what data it touches, who owns it, and how risky it is. A security reviewer asks for this list before anything else. A team builds a usable version in a week with a spreadsheet and five interviews, no software required.'
fullAnswer: 'A security reviewer asks for an AI system register before model choice, prompt design or accuracy come up. It is the inventory of every AI system in use, however it got there. Each entry records what it does, what data reaches it, which vendor sits behind it, who owns it, and how risky it is. Every later question a reviewer asks only makes sense once that list exists. Most companies of thirty to three hundred people do not have one, not because the work is hard, but because nobody was ever assigned to write it down. Building the first version does not need a tool or a budget line. It needs a spreadsheet, a short interview with each team that touches a model, and one person who agrees to keep the list current once the interviews stop.'
keyTakeaways:
  - 'An AI system register is the document a security reviewer asks for before anything else, because every later question about data, contracts or incidents depends on already knowing what runs.'
  - 'A usable register lists what each system does, what data it touches, which vendor sits behind it, who owns it internally and a rough risk tier, one row per system.'
  - 'The fastest way to build the first version is a spreadsheet and direct interviews with engineering, marketing, finance and support, not a survey people can quietly skip.'
  - 'A register nobody updates gets treated the same as no register in a review, so it needs one named owner and a fixed date to recheck every row.'
faq:
  - q: 'Do you need a register if your company only uses ChatGPT and a few SaaS tools with AI features?'
    a: 'Yes. A register covers more than models a company builds. It should list any AI feature that can see company or customer data. That includes a tool a team subscribed to on its own, since that is exactly the kind of system a reviewer or an incident finds first.'
  - q: 'How is an AI system register different from a data flow diagram or a risk assessment?'
    a: 'The register comes first. A data flow diagram maps how data moves through one system in detail, and a risk assessment scores how risky a system is. Both need the list of systems, owners and data that the register provides before that work can start. Skip the register and the same discovery gets repeated every time someone asks.'
  - q: 'Does an internal register satisfy the registration duty under the EU AI Act?'
    a: 'No. An internal register is a record a company keeps for itself. The public registration duty under Article 49 of the EU AI Act applies separately, only to certain high-risk systems, and is filed in the database the Commission set up under Article 71. Building the internal register first is still the fastest way to find out which systems might owe that separate duty.'
  - q: 'Who should own the register after the first week?'
    a: 'One named person, not a shared folder. They do not need to personally approve every new AI tool. But they need standing to ask why an unlisted system turned up, and a fixed date on the calendar to confirm every row is still accurate.'
category: governance
tags:
  - ai-register
  - security-review
  - ai-governance
  - eu-ai-act
sources:
  - title: 'NIST AI Risk Management Framework Playbook - Govern Function'
    url: 'https://airc.nist.gov/airmf-resources/playbook/govern/'
  - title: 'Regulation (EU) 2024/1689 (Artificial Intelligence Act), Articles 12 and 49 - EUR-Lex'
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj'
  - title: 'ISO/IEC 42001:2023 - Artificial Intelligence Management System | ISO'
    url: 'https://www.iso.org/standard/42001'
author: dmitri
relatedResources:
  - ai-governance-starter-kit
---

A security review of an AI system usually starts with one question: what is actually running. If the honest answer takes a week of digging through chat logs and old tickets, the review stalls before it reaches architecture or data flows. An AI system register is the fix: one document listing every AI system a company runs, who owns it, and how risky it is.

## What is an AI system register?

An AI system register is the full inventory of every AI system a company runs, regardless of how it got there. That includes a customer-facing feature, an internal copilot, or a marketing tool with a model switched on inside it that nobody called an AI project when they signed up.

A working entry names what the system does, what data can reach it, which vendor or model sits behind it, who owns it, and a rough risk tier. Some call this same list an [AI register](/glossary/ai-register) rather than an AI system register. Most of the systems on it never started as a formal AI project, which is why the list has to go looking for them rather than wait to be told.

## Why does a security reviewer ask for it before anything else?

A security or procurement reviewer asks one version of the same question first: what touches our data. Without a register, answering that means paging engineering, marketing, finance and support one by one, and hoping nobody forgot a tool.

The [NIST AI RMF](/glossary/nist-ai-rmf) treats this as a named control, not a nice extra. Its Govern function includes a specific requirement: a mechanism to inventory AI systems, resourced according to how much risk the organisation is willing to carry.

Everything a reviewer asks next, a data flow diagram, a vendor contract clause, an incident plan, gets scoped against rows already on this list. Skip the register, and the reviewer either stalls the process or signs off on a system nobody can fully describe.

## What should the register record?

A register only earns its keep if a reviewer can answer their own questions from it, without a follow-up meeting. What follows is close to the version I hand a client: enough fields to answer a first review, and no field that exists only to look thorough.

| What to record                                                                          | Why a reviewer wants it                                                                                      | Who fills it in                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Name the system and what it does.                                                       | A reviewer cannot scope a check against a system they cannot picture.                                        | The system's product or engineering owner.                            |
| Note whether it was built in-house or bought, and which vendor or model sits behind it. | A vendor's own controls become part of the risk the moment its API touches your data.                        | Whoever set up the account or the integration.                        |
| List the data the system can see.                                                       | This sets the risk tier and decides which contract terms and legal duties actually apply.                    | The team that owns the data source, with legal signing off.           |
| Record who relies on the system's output.                                               | Blast radius matters as much as data sensitivity when a reviewer decides how much scrutiny to apply.         | The system owner, from usage or team headcount.                       |
| Mark its deployment status: pilot, production or retired.                               | A pilot running on sample data is a different conversation from a live system holding real customer records. | The system owner, kept current as status changes.                     |
| Name one internal owner.                                                                | A reviewer wants a person who can answer for the system, not a distribution list nobody reads.               | Whoever runs the team that operates the system.                       |
| Assign a risk tier.                                                                     | This decides how much documentation, testing and sign-off the reviewer expects before anything ships.        | Whoever runs the security or risk review, not the system's own owner. |
| Log the date it was last checked.                                                       | A register that has not moved in a year gets treated the same as no register at all.                         | Whoever owns the register process, on a fixed schedule.               |

## How do you build one in a week without buying a tool?

None of this needs procurement. A spreadsheet, a shared document and five short conversations get a usable first version out the door.

- **Monday.** Create the spreadsheet with those three columns, and seed it with every system already in use: the model inside the product, the support tool, the analytics dashboard that quietly added an AI summary.
- **Tuesday and Wednesday.** Interview engineering, marketing, finance and support directly, not by survey. Ask each team what they actually use day to day, since a spreadsheet plug-in with a model behind it belongs on the list too.
- **Thursday.** Fill in the vendor, data and risk-tier columns from what you heard, and flag anything nobody could describe clearly for a follow-up conversation rather than a guess.
- **Friday.** Assign an owner to every row, pick a reviewer for the risk tiers, and put a recheck date on the calendar before anyone calls the list finished.

## What a register does not do

Building the register is the easy part of this, and several harder parts of AI governance sit outside it.

It does not replace a lawyer's read of a vendor contract. The register tells legal which vendor to check and what data reaches them. It says nothing about whether that vendor's specific contract terms are safe to sign, and those terms change often enough that last year's answer will not do.

The registration duty in the [EU AI Act](/glossary/eu-ai-act) is a separate, public step for certain high-risk systems. It means registering under Article 49, in the database the Commission set up under Article 71, before the system goes live. An internal register is how you find out fast which systems might owe that separate duty; it is not a substitute for filing it.

It does not stay accurate on its own, either. A register nobody owns drifts out of date within a quarter, and a stale register reads to a reviewer as no register at all.

If you would rather someone else run the discovery and the first risk pass, an [AI Readiness & Risk Assessment](/services/ai-readiness-and-risk-assessment) does the same work in two weeks and hands you a finished register. The [starter kit](/resources/ai-governance-starter-kit) has a blank version of this table, ready to copy into your own document.
