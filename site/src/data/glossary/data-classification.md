---
title: What is data classification?
term: Data classification
description: Data classification is labelling data by sensitivity, such as public, internal or restricted, before deciding what may reach an AI tool.
publishDate: 2026-09-08
updatedDate: 2026-09-15
shortDefinition: Data classification means labelling what is in a dataset, document or prompt by sensitivity. Common tiers are public, internal, confidential and restricted. A company can then decide what is allowed to reach a given AI tool. That way nobody pastes something in and finds out the hard way.
definition: |
  NIST's own method for federal systems ties each category to a real question, not a subjective label: what actually happens to confidentiality, integrity or availability if this breaks? That means naming who could see this data, alter it, or take it offline. A scheme built the same way works for AI. That is what makes classification useful for a real decision, not a compliance exercise nobody consults.

  Every additional tool a company adopts multiplies the places a given tier could leak from. That is why the scheme has to live inside the AI register, not beside it. Without one, two employees facing the same document reach different answers. The wrong answer usually only surfaces after the data has already left the building through a chat prompt.
relatedTerms:
  - dpia
  - sub-processor
  - guardrails
sources:
  - title: NIST Special Publication 800-60 Vol. 1 Rev. 1 - Guide for Mapping Types of Information and Information Systems to Security Categories
    url: https://csrc.nist.gov/pubs/sp/800/60/v1/r1/final
  - title: ISO/IEC 27001:2022 - Information security management systems
    url: https://www.iso.org/standard/27001
---

## Why it comes up

It is the first practical question underneath any AI acceptable-use policy. Can this go into that tool? Nobody can answer that until someone has labelled what this actually is. A security reviewer asks for the classification scheme by name, not as an abstract principle. The scheme is what turns a policy from a statement of intent into something an employee can actually follow on a Tuesday afternoon.

## What to do about it

Keep the scheme small. Three or four tiers is enough for most companies, and a scheme nobody can remember gets ignored the same as none. Map every AI tool in the register to which tiers may reach it. Make the most important rule explicit: customer data and secrets never go into an unclassified tool. The [AI Governance Starter Kit](/resources/ai-governance-starter-kit) already includes this table, mapped to what may reach a vendor.
