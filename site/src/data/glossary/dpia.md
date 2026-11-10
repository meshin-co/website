---
title: What is a DPIA?
term: DPIA
description: A DPIA, or data protection impact assessment, is a written GDPR check of privacy risk before high-risk personal-data processing begins.
publishDate: 2026-09-08
updatedDate: 2026-11-10
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
  - title: 'EDPB: Template [2026] for Data Protection Impact Assessment, version 1.0'
    url: https://www.edpb.europa.eu/system/files/2026-05/edpb_dpia_template_2026_v1_en.docx
    publisher: European Data Protection Board
    retrieved: '2026-11-10'
  - title: 'EDPB: Template for Data Protection Impact Assessment, public consultation'
    url: https://www.edpb.europa.eu/public-consultations/template-for-data-protection-impact-assessment_en
    publisher: European Data Protection Board
    retrieved: '2026-11-10'
  - title: 'EDPB: Enhancing compliance and consistency: EDPB adopts DPIA template'
    url: https://www.edpb.europa.eu/news/enhancing-compliance-and-consistency-edpb-adopts-dpia-template_en
    publisher: European Data Protection Board
    retrieved: '2026-11-10'
  - title: 'EDPB: DPIA template explainer, version 1.0'
    url: https://www.edpb.europa.eu/system/files/2026-05/edpb_dpia_template_explainer_2026_v1_en.pdf
    publisher: European Data Protection Board
    retrieved: '2026-11-10'
  - title: 'ICO: Sample DPIA template'
    url: https://ico.org.uk/media2/migrated/2553993/dpia-template.docx
    publisher: Information Commissioner's Office
    retrieved: '2026-11-10'
  - title: 'ICO: How do we do a DPIA?'
    url: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/how-do-we-do-a-dpia/
    publisher: Information Commissioner's Office
    retrieved: '2026-11-10'
  - title: 'Regulation (EU) 2016/679 (GDPR), consolidated text of 4 May 2016: Articles 22, 35 and 36'
    url: https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04/eng
    publisher: EUR-Lex
    retrieved: '2026-11-10'
  - title: 'Regulation (EU) 2024/1689 (AI Act), consolidated text of 27 July 2026: Articles 13, 26, 27 and 113'
    url: https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng
    publisher: EUR-Lex
    retrieved: '2026-11-10'
---

## Why it comes up

Almost any AI system worth building processes personal data, which makes a DPIA the default question rather than an edge case. Legal or procurement asks for it specifically once a system moves from a prototype to something touching real customer records. People often confuse it with the newer AI Act impact assessment. That is why explaining the difference is usually the more useful answer than either document alone.

## When monitoring staff triggers one

Article 35(3) names three cases, but Article 35(1) asks for a DPIA wherever processing is likely to result in a high risk to people.

The Article 29 Working Party's 2017 guidelines list criteria that point to high risk. Systematic monitoring is one. Data about vulnerable people is another, and employees may count as vulnerable because of the power imbalance. Meeting two criteria means a DPIA in most cases.

Whether a dashboard of AI tool usage counts as systematic monitoring depends on how person-level it is. That is an inference, not a regulator's ruling.

## DPIA template: the headings and fields to copy

A DPIA template follows [Article 35(7) GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), which sets four minimum contents. They are a description of the processing and its purposes, an assessment of necessity and proportionality, an assessment of the risks, and the measures that address them.

The European Data Protection Board (EDPB) adopted a [DPIA template](https://www.edpb.europa.eu/system/files/2026-05/edpb_dpia_template_2026_v1_en.docx) on 10 March 2026 and [consulted on it](https://www.edpb.europa.eu/public-consultations/template-for-data-protection-impact-assessment_en) until 9 June 2026. The EDPB's [announcement](https://www.edpb.europa.eu/news/enhancing-compliance-and-consistency-edpb-adopts-dpia-template_en) says using it is not mandatory. The consultation page still offered the first version on 10 November 2026. The template has seven sections:

0. Overview of the processing
   - controllers and joint controllers, with the data protection officer (DPO) contact
   - each processor and [sub-processor](/glossary/sub-processor), with its tasks
   - processing name, launch date and end date
   - technical sheet: team, reasons for the DPIA, scope, completion date, validation date, publication plan
1. Systematic description of the processing
   - each personal data item, with data type, data subject category and special category flag (add your [data classification](/glossary/data-classification) tier)
   - purposes, secondary uses and their compatibility
   - nature, scope and context, including cross-border processing and international transfers
   - phases from collection to deletion, with a data-flow diagram
   - supporting assets, such as hardware, software, APIs and models, and people
   - approved codes of conduct
2. Analysis of the processing
   - legal basis for each purpose, and the Article 9(2) reason for each special category
   - per data item: need, recipients, retention period, quality threshold
   - measures for the Article 5(1) principles, data subject rights, consent, processors, transfers, design and default, and security, each marked planned, partially implemented or implemented
3. Considerations on necessity and proportionality
   - threats from the processing working as designed, with risk sources and impact
   - necessity: effective and least intrusive, with evidence and alternatives
   - proportionality: benefits weighed against the impact on rights
4. Risk assessment and management
   - threats from accidental, unlawful or abnormal events, at least illegitimate access, undesired modification and disappearance of data
   - method, then per risk: likelihood, severity, modulating factors, level, acceptable or not
   - additional measures, residual risk, and a plan with responsible team and timeline
5. Involvement of interested parties
   - DPO opinion and how it was implemented (Article 35(2))
   - views of data subjects or their representatives, or why they were not involved (Article 35(9))
6. Conclusion and decision
   - rejected, consult the supervisory authority, approved, or approved with conditions

The EDPB's [explainer](https://www.edpb.europa.eu/system/files/2026-05/edpb_dpia_template_explainer_2026_v1_en.pdf) says a responsible official, such as the managing director, must formally approve the DPIA.

The Information Commissioner's Office (ICO), the UK regulator, publishes a [sample DPIA template](https://ico.org.uk/media2/migrated/2553993/dpia-template.docx) in its [guidance on the UK GDPR](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/how-do-we-do-a-dpia/). Add its sign-off block after section 6. Each item takes a name, position and date:

- measures approved by
- residual risks approved by, after consulting the supervisory authority if a high risk remains (Article 36(1))
- DPO advice provided, with a summary of it
- DPO advice accepted or overruled by, with reasons if overruled
- consultation responses reviewed by, with reasons if the decision departs from individuals' views
- who keeps the DPIA under review (Article 35(11))

Record each DPIA's review date in your [AI register](/glossary/ai-register).

Check a finished DPIA against Annex 2 of the Article 29 Working Party's [DPIA guidelines](https://ec.europa.eu/newsroom/article29/redirection/document/47711). It lists four criteria for an acceptable DPIA: a systematic description, necessity and proportionality, managed risks, and involved interested parties.

For an AI system, add these fields. The first two come from the [EU AI Act](/glossary/eu-ai-act) and, under [Article 113](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) as amended, apply to [high-risk AI systems](/glossary/high-risk-ai-system) from 2 December 2027 for Annex III and from 2 August 2028 for Annex I:

- provider information: the Article 13 instructions for use, which Article 26(9) tells the [deployer](/glossary/provider-vs-deployer) to use for the DPIA, including intended purpose, accuracy, known or foreseeable risks to fundamental rights, input data specifications and [human oversight](/glossary/human-oversight) measures
- [AI impact assessment](/glossary/ai-impact-assessment): where Article 27 applies, the DPIA sections that already meet its obligations, for cross-reference under Article 27(4)
- automated decisions: where model output alone decides something with legal or similarly significant effect, the Article 22(2) ground (contract, authorising law or explicit consent) and its safeguards

## What to do about it

Write the DPIA before the system is built, not after, since a risk found during design is cheap to change. The same risk found after launch usually is not. Start from what the system actually collects and why, then fill in the template above. Consult the data protection officer while there is time to act. The [AI Governance Starter Kit](/resources/ai-governance-starter-kit) lays out the same data classification a DPIA starts from.
