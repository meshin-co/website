---
title: What is AI governance?
term: AI governance
description: AI governance is the decisions, roles and controls a company uses to manage the risk of the AI systems it builds or buys.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: AI governance is the set of policies, roles and controls an organisation uses to decide who may build or buy an AI system, what data it can touch, and who answers for it when it fails.
definition: AI governance is the layer of decisions sitting above the technology, covering who owns each AI system, what data it may see, which use cases are off limits, and who signs off before a system reaches customers. It is not a document on its own. It is a register of the systems in use, a policy engineers can actually follow, and a review step before something new goes live. A customer's procurement team asks for it during a vendor security review. A board asks for it after a pilot gets close to production and someone raises the question of who is liable if it makes a bad call. Regulators ask for pieces of it too, through frameworks like the NIST AI RMF and standards like ISO/IEC 42001. In practice, it changes three things. Someone specific owns each AI system instead of it belonging to whichever team built it, a new system needs a sign-off before it touches customer data, and a written answer exists the day a customer or auditor asks for one.
relatedTerms:
  - nist-ai-rmf
  - iso-iec-42001
  - ai-register
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
  - title: Regulation (EU) 2024/1689 (EU AI Act)
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
---

## Why it comes up

A customer's security team asks who owns AI risk before they will sign a contract. A board member reads about an AI failure at another company and asks what would happen here. An investor's due diligence checklist has a line for it now. In every case, the question is not whether the model is good. It is whether anyone can say, in writing, who is responsible for a given AI system, what it is allowed to touch, and who would notice if it started producing worse answers. Companies that have only run pilots rarely have an answer ready, because nobody owned the question until it was asked.

## What to do about it

Start with a one-page register: every AI system in use, who owns it, what data it touches, and whether a customer's data leaves the building because of it. Assign one named owner per system, not a team. Add a single sign-off step before a new system reaches production or customer data. Map what you already do against NIST AI RMF or ISO/IEC 42001, not to get certified immediately, but so you can point at a recognised structure when someone asks. None of this requires new tooling before it requires an owner and a list.
