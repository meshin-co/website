---
title: What is a sub-processor?
term: Sub-processor
description: A sub-processor is a vendor an AI provider uses behind the scenes to handle a company's data, and GDPR requires permission before it does.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: A sub-processor is a vendor an AI provider hands a company's data to behind the scenes. The model provider behind a SaaS tool is a common example. GDPR Article 28 requires the provider to get the customer's permission, and to bind the sub-processor to the same data protections by contract.
definition: |
  GDPR Article 28 calls the AI vendor the processor and your company the controller. It gives the processor two ways to bring a sub-processor in. Specific authorisation names the sub-processor up front, so the controller signs off by name.

  General authorisation lets the processor add sub-processors as needed, but it has to tell the controller first and give a real chance to object. Either way, the processor must pass down the same data-protection obligations it owes directly, in the contract itself, not just a notice.

  The chain does not stop at one level either. The processor often runs its own infrastructure through a further sub-processor, such as a cloud host or a fine-tuning partner. That passes the same flow-down obligation another level down. Asking for the sub-processor list is really asking how many hops sit between a company's data and the last party that can actually see it.
relatedTerms:
  - dpia
  - data-classification
  - provider-vs-deployer
sources:
  - title: Article 28 GDPR - Processor
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
---

## Why it comes up

It is a routine line on a security questionnaire: "list your sub-processors." It is also a revealing one. Most AI features are built on someone else's model, which makes a sub-processor almost guaranteed rather than an edge case. A buyer who skips the question is signing a contract blind. They will not know where their data actually goes once it leaves the vendor's own systems.

## What to do about it

Ask every AI vendor for its sub-processor list, and how it notifies customers of a change. Then check honestly: does the notice give a real chance to object, or just a record that it happened? Fold the answer into the AI register entry for that vendor, next to the data classification of what reaches them. The [Fractional CAIO Retainer](/services/fractional-caio-retainer) is where I check vendor contracts for this gap before a renewal.
