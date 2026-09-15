---
title: What is an AI register?
term: AI register
description: An AI register is a company's own inventory of every AI system it builds, buys or uses, naming its owner and how risky it is.
publishDate: 2026-09-08
updatedDate: 2026-09-15
shortDefinition: An AI register is a company's own inventory of every AI system it builds, buys or uses, listing what it does, what data it touches, who owns it and how risky it is.
definition: |
  A working entry covers what a system does, what data it can see, which vendor or model sits behind it, who owns it, and a rough risk tier. That applies as much to a vendor tool an ops team subscribed to on a card as to a flagship product.

  It is the single most requested document in a procurement or investor due-diligence process. Everything else, from a data-flow diagram to a risk assessment, builds on the list it provides. Most companies cannot produce one on short notice, because tools get added by individual teams without a central record.

  The honest answer to "what AI do you run" is too often "we are not sure." Building a register does not need new software. It forces one decision per system: a named owner. That turns a question a reviewer might spend a day chasing into a document you hand over in a meeting.
relatedTerms:
  - ai-governance
  - eu-ai-act
  - shadow-ai
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
  - title: EU AI Act Article 71 - EU database for high-risk AI systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202401689
---

## Why it comes up

It is usually the first document a procurement team or an investor's checklist asks for, and the first one a company discovers it lacks. A security review cannot get past "what AI systems touch our data" without one. A board asking about AI risk gets a shorter conversation once a real list sits in front of it. The EU AI Act raises the stakes for high-risk systems: Article 71 requires joining a public EU database.

## What to do about it

Build a spreadsheet before anything more elaborate: system name, what it does, vendor or model, data it can see, owner, and risk tier, one row per system. Interview engineering, marketing, finance and support instead of relying on a self-reported survey. That is how tools added outside a formal process get missed. Review the list on a fixed schedule, quarterly is reasonable, since a stale register looks worse in review than admitting you lack one.
