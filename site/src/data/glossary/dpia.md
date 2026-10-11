---
title: What is a DPIA?
term: DPIA
description: A DPIA, or data protection impact assessment, is a written GDPR check of privacy risk before high-risk personal-data processing begins.
publishDate: 2026-09-08
updatedDate: 2026-10-07
shortDefinition: A DPIA, or data protection impact assessment, is a written GDPR review completed before a company begins personal-data processing likely to carry high privacy risk. It assesses what data the company collects, why, and how the company reduces that risk. It differs from a fairness review of the system's decision.
definition: |-
  GDPR Article 35 makes this review mandatory, not a judgement call, in three situations. One is large-scale profiling with legal or similarly significant effects. Another is large-scale processing of special-category data, such as health or biometric records. The third is systematic large-scale monitoring of a public space. Most consequential AI systems land in the first of these by default.

  The assessment has to describe the processing and why it is necessary. It has to assess the risk to the people concerned and set out the measures that reduce it. Where the company has appointed a data protection officer, the company must consult that officer while it carries out the assessment. Signing off afterward does not count.

  Where the system is high-risk under the EU AI Act, Article 26 also refers to the DPIA. A deployer must draw on the information the provider supplies under Article 13 when carrying out this GDPR assessment. The two obligations end up sharing evidence, not separate files.
relatedTerms:
  - ai-impact-assessment
  - sub-processor
  - data-classification
sources:
  - title: Article 35 GDPR - Data protection impact assessment
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
  - title: 'Article 29 Working Party: Guidelines on data protection impact assessment (WP 248 rev.01)'
    url: https://ec.europa.eu/newsroom/article29/redirection/document/47711
    publisher: Article 29 Working Party
    retrieved: '2026-10-02'
  - title: Article 27 - Fundamental Rights Impact Assessment for High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: Article 26 - Obligations of Deployers of High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
---

## Why it comes up

Almost any AI system worth building processes personal data, which makes a DPIA the default question rather than an edge case. Legal or procurement asks for it specifically once a system moves from a prototype to something touching real customer records. People often confuse it with the newer AI Act impact assessment. That is why explaining the difference is usually the more useful answer than either document alone.

## When monitoring staff triggers one

Article 35(3) names three cases, but Article 35(1) asks for a DPIA wherever processing is likely to result in a high risk to people.

The Article 29 Working Party's 2017 guidelines list criteria that point to high risk. Systematic monitoring is one. Data about vulnerable people is another, and employees may count as vulnerable because of the power imbalance. Meeting two criteria means a DPIA in most cases.

Whether a dashboard of AI tool usage counts as systematic monitoring depends on how person-level it is. That is an inference, not a regulator's ruling.

## What to do about it

Write the DPIA before the system is built, not after, since a risk found during design is cheap to change. The same risk found after launch usually is not. Start from what the system actually collects and why, not from a template's headings. Consult the data protection officer while there is time to act. The [AI Governance Starter Kit](/resources/ai-governance-starter-kit) lays out the same data classification a DPIA starts from.
