---
title: What is a model card?
term: Model card
description: A model card is a short document that a model's maker publishes about the model's intended use, its performance and where not to use it.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: A model card is a short, standard-shaped document a model's maker publishes. It says what the maker built the model for, and how it performs across groups and conditions. It also names where not to use the model, closer to a spec sheet than a sales page.
definition: |
  The format comes from a 2018 paper. The paper proposed model cards as a response to models shipping with no consistent account of how their makers had actually tested them. A rigorous card reports evaluation broken out by group: race, geographic location, sex, skin type. It also breaks out intersections, such as age combined with race, instead of one blended figure that hides where performance drops.

  NIST's risk management framework expects the same thing in substance. A model should be explained, validated and documented, not simply shipped. A vendor who has actually done that evaluation work typically wants to show the results, since they usually help on some axis. One who cannot produce a card has most likely skipped the evaluation itself, not just the paperwork describing it.
relatedTerms:
  - model-provenance
  - technical-documentation
  - hallucination-rate
sources:
  - title: Model Cards for Model Reporting
    url: https://arxiv.org/abs/1810.03993
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

Procurement asks a model vendor for it directly once evaluating more than one option. A card makes two vendors comparable on the same axes, rather than on whatever each chose to advertise. A technical due-diligence review reads the limitations section specifically. That is where a vendor is most likely to have been honest about where the model actually struggles.

## What to do about it

Ask every model vendor for their card before signing. Read the limitations section before the headline numbers: the numbers are chosen by the vendor, and the limitations rarely are. If a company fine-tunes or wraps a base model itself, write a short card of its own. Describe what changed and what the company tested. The vendor questionnaire this request belongs in is one of the four documents in the [AI Governance Starter Kit](/resources/ai-governance-starter-kit).
