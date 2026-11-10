---
title: What is technical documentation under the EU AI Act?
term: Technical documentation
description: Technical documentation is the dossier a provider keeps on a high-risk AI system - its purpose, design, data, performance and monitoring plan.
publishDate: 2026-09-08
updatedDate: 2026-11-10
shortDefinition: Technical documentation is the dossier a provider of a high-risk AI system must keep. It covers purpose, design logic, training data, performance metrics, risk process and monitoring plan. It has to be clear enough that a regulator can assess it without the original engineers in the room.
definition: |-
  The EU AI Act sets the content directly in Annex IV, rather than leaving it to the provider's judgement. A national authority or notified body has to be able to assess it without relying on the provider's own explanation. Article 11 lets SMEs, including start-ups, and small mid-cap enterprises provide the Annex IV elements in a simplified manner, using a form the Commission must establish.

  Article 18 sets how long to keep it: ten years from when the provider places the system on the market or puts it into service. A national competent authority can request it at any point in that window. The same retention duty covers the quality management system records and the EU declaration of conformity too, not the technical documentation alone.
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
  - title: Regulation (EU) 2024/1689, consolidated text of 27 July 2026
    url: https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng
    publisher: EUR-Lex, Publications Office of the European Union
    retrieved: '2026-11-10'
  - title: Regulation (EU) 2026/1744 (Digital Omnibus on AI)
    url: https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng
    publisher: EUR-Lex, Publications Office of the European Union
    retrieved: '2026-11-10'
  - title: AI Act Service Desk, Resources
    url: https://ai-act-service-desk.ec.europa.eu/en/resources
    publisher: European Commission
    retrieved: '2026-11-10'
  - title: Model Cards for Model Reporting
    url: https://arxiv.org/abs/1810.03993
    publisher: arXiv
    retrieved: '2026-11-10'
---

## Why it comes up

It is different from a marketing spec sheet or an engineering wiki page. A regulator or notified body wants the specific content the Act lists, not a general description of the product. It also comes up in procurement due diligence, where a buyer of a high-risk system sometimes asks to see excerpts before signing. A vendor who can produce none of it has told you something.

## Technical documentation template: the nine Annex IV headings and their fields

The template is [Annex IV](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) of the [EU AI Act](/glossary/eu-ai-act), which lists the minimum content of the technical documentation of a [high-risk AI system](/glossary/high-risk-ai-system). Article 11(1) requires it before the system goes on the market or into service, and requires it to stay up to date. The duty falls on the [provider](/glossary/provider-vs-deployer) (Article 16, point (a)). Copy these nine headings and fill the fields under each.

1. General description
   - Intended purpose, provider name, system version and its relation to earlier versions
   - Interactions with outside hardware, software or other AI systems, where applicable
   - Versions of relevant software or firmware, and any update requirements
   - All forms in which the system is placed on the market or put into service, such as embedded software, downloads or APIs
   - Hardware the system is meant to run on
   - For a product component: photographs or illustrations of external features, markings and internal layout
   - Basic description of the deployer's user interface
   - Instructions for use for the deployer
2. Elements and development process
   - Development methods and steps, including pre-trained systems or third-party tools and how you used, integrated or changed them
   - Design specification: logic and algorithms, key choices with rationale and assumptions about the people it is intended for, classification choices, optimisation target and parameter relevance, expected output and output quality, trade-offs made to meet Articles 8 to 15
   - Architecture: how software components build on or feed into each other, plus the computing resources used to develop, train, test and validate
   - Where relevant, datasheets on training methods and training data: provenance, scope, main characteristics, how it was obtained and selected, labelling, cleaning
   - Assessment of the [human oversight](/glossary/human-oversight) measures needed, including technical measures that help deployers interpret outputs
   - Where applicable, pre-determined changes to the system and its performance, with the technical solutions that keep it compliant
   - Validation and testing: procedures, test data, metrics for accuracy, robustness and the other requirements, potentially discriminatory impacts, test logs and reports dated and signed by the responsible people
   - Cybersecurity measures
3. Monitoring, functioning and control
   - Capabilities and limits, with accuracy for specific persons or groups and overall expected accuracy
   - Foreseeable unintended outcomes and sources of risk to health and safety, fundamental rights and discrimination
   - Human oversight measures needed under Article 14, with the technical measures that help deployers interpret outputs
   - Specifications for input data, as appropriate
4. Performance metrics: why they suit this specific system
5. Risk management system: a detailed description under Article 9
6. Lifecycle changes: relevant changes you made to the system
7. Standards: harmonised standards from the Official Journal applied in full or in part or, where none, the solutions used to meet Articles 8 to 15 and the other standards and specifications applied
8. EU declaration of conformity: a copy
9. Post-market evaluation: the system that evaluates performance after release, including the [post-market monitoring](/glossary/post-market-monitoring) plan

Add your own document control line above point 1: document version, date, system version covered. Annex IV does not list it.

Article 11(1), as [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng) amended it, lets SMEs, including start-ups, and small mid-cap enterprises provide these elements in a simplified manner. A company that takes this route must use a simplified form that the Commission has to establish, and notified bodies must accept it for the [conformity assessment](/glossary/conformity-assessment).

On 10 November 2026 the resource list of the Commission's [AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/resources) shows no such form. Until one appears, complete all nine headings.

Article 72(3) as amended tells the Commission to adopt guidance, including a template, on the post-market monitoring plan by 2 September 2027. Article 113 as amended applies Article 11 from 2 December 2027 to systems classified under Annex III and from 2 August 2028 to those under Annex I.

A [model card](/glossary/model-card) is not this dossier. The [paper that proposed it](https://arxiv.org/abs/1810.03993) suggests nine sections for a trained model, and none is a declaration of conformity or a monitoring plan. Annex IV requires both.

## What to do about it

Start the document on the first day of build, recording design decisions as you make them. Reconstructing the reasoning behind a choice months later is far harder than writing it down at the time. Version it alongside the system itself, so the documentation for a given release actually matches what shipped. The [AI Governance Starter Kit](/resources/ai-governance-starter-kit) covers the register and policy this documentation builds on, ahead of the deeper regulatory detail.
