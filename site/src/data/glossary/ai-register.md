---
title: What is an AI register?
term: AI register
description: An AI register is a company's own inventory of every AI system it uses, who owns each one, and how risky it is.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: An AI register is a company's own inventory of every AI system it builds, buys or uses, listing what it does, what data it touches, who owns it and how risky it is.
definition: An AI register is the inventory a company keeps of every AI system it builds, buys or otherwise relies on, whether that is a customer-facing feature, an internal copilot, or a vendor tool an ops team subscribed to on a card. A working entry lists what the system does, what data it can see, which vendor or model sits behind it, who owns it internally, and a rough risk tier. It is the single most requested document in a procurement or investor due diligence process, because everything else, from a data flow diagram to a risk assessment, is built on top of the list it provides. The reason it gets asked for first is that most companies cannot produce one on short notice. Tools get added by individual teams without a central record, so the honest answer to "what AI do you run" is often "we are not sure." Building the register does not require new software. It changes practice by forcing one decision per system, an owner, that did not previously exist, and by turning a question a reviewer can spend a day chasing into a document you can hand over in a meeting.
relatedTerms:
  - ai-governance
  - eu-ai-act
  - shadow-ai
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
  - title: EU AI Act Article 71 - EU database for high-risk AI systems
    url: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-71
---

## Why it comes up

It is usually the first document a procurement team or an investor's due diligence checklist asks for, and the first one a company discovers it does not have. A security review cannot get past its first question, what AI systems touch our data, without one. A board asking about AI risk in the abstract gets a much shorter conversation once there is a list in front of them instead of a description. The EU AI Act raises the stakes further for high-risk systems, which must be entered into a public EU database, not just an internal one.

## What to do about it

Build a spreadsheet before you build anything more elaborate: system name, what it does, vendor or model, data it can see, owner, and risk tier, one row per system. Interview engineering, marketing, finance and support directly rather than relying on a self-reported survey, since that is how tools added outside a formal process get missed. Review the list on a fixed schedule, quarterly is reasonable, because a register that is a year out of date is worse in a review than admitting you do not have one yet.
