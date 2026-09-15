---
title: What is a DPIA?
term: DPIA
description: A DPIA, or data protection impact assessment, is a written GDPR check of privacy risk before high-risk personal-data processing begins.
publishDate: 2026-09-08
updatedDate: 2026-09-15
shortDefinition: A DPIA, short for data protection impact assessment, is a written GDPR review completed before a company begins personal-data processing likely to carry high privacy risk. It assesses what data is collected, why, and how that risk is being reduced, distinct from a fairness review of the decision itself.
definition: |-
  GDPR Article 35 makes this review mandatory, not a judgement call, in three situations. One is large-scale profiling with legal or similarly significant effects. Another is large-scale processing of special-category data, such as health or biometric records. The third is systematic large-scale monitoring of a public space. Most consequential AI systems land in the first of these by default.

  It has to describe the processing and why it is necessary. It has to assess the risk to the people concerned and set out the measures that reduce it. Where the company has appointed a data protection officer, that officer must be consulted while the assessment is carried out. Signing off afterward does not count.

  Where the system is high-risk under the EU AI Act, Article 26 points the other way too. A deployer must draw on the information the provider supplies under Article 13 when carrying out this GDPR assessment. The two obligations end up sharing evidence, not separate files.
relatedTerms:
  - ai-impact-assessment
  - sub-processor
  - data-classification
sources:
  - title: Article 35 GDPR - Data protection impact assessment
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
  - title: Article 27 - Fundamental Rights Impact Assessment for High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: Article 26 - Obligations of Deployers of High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
---

## Why it comes up

Almost any AI system worth building processes personal data, which makes a DPIA the default question rather than an edge case. Legal or procurement asks for it specifically once a system moves from a prototype to something touching real customer records. It gets confused with the newer AI Act impact assessment often enough that clarifying the difference is usually the more useful answer than either document alone.

## What to do about it

Write the DPIA before the system is built, not after, since a risk found during design is cheap to change and the same risk found after launch usually is not. Start from what is actually being collected and why, not from a template's headings, and consult the data protection officer while there is time to act. The [AI Governance Starter Kit](/resources/ai-governance-starter-kit) lays out the same data classification a DPIA starts from.
