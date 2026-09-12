---
title: What is technical documentation under the EU AI Act?
term: Technical documentation
description: Technical documentation is the dossier a provider keeps on a high-risk AI system - its purpose, design, data, performance and monitoring plan.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Technical documentation is the dossier a provider of a high-risk AI system must keep. It covers purpose, design logic, training data, performance metrics, risk process and monitoring plan. It has to be clear enough that a regulator can assess it without the original engineers in the room.
definition: |-
  The EU AI Act sets the content directly in Annex IV, rather than leaving it to the provider's judgement. A national authority or notified body has to be able to assess it without relying on the provider's own explanation. Article 11 lets a small or micro enterprise use a simplified version of the same form, one the Commission publishes for that purpose.

  Article 18 sets how long it has to survive: ten years from when the system was placed on the market or put into service. A national competent authority can request it at any point in that window. The same retention duty covers the quality management system records and the EU declaration of conformity too, not the technical documentation alone.
relatedTerms:
  - conformity-assessment
  - model-card
  - high-risk-ai-system
sources:
  - title: Article 11 - Technical documentation
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: Article 18 - Documentation Keeping
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

It is different from a marketing spec sheet or an engineering wiki page, and a regulator or notified body wants the specific content the Act lists, not a general description of the product. It also comes up in procurement due diligence, where a buyer of a high-risk system sometimes asks to see excerpts before signing. A vendor who can produce none of it has told you something.

## What to do about it

Start the document on the first day of build, recording design decisions as they are made, since reconstructing the reasoning behind a choice months later is far harder than writing it down at the time. Version it alongside the system itself, so the documentation for a given release actually matches what shipped. The register and policy shape this documentation builds on sits in the [AI Governance Starter Kit](/resources/ai-governance-starter-kit) ahead of the deeper regulatory detail.
