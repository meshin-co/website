---
title: What is a conformity assessment?
term: Conformity assessment
description: A conformity assessment proves a high-risk AI system meets the EU AI Act before sale. Either the provider or an outside body runs it.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: A conformity assessment is the process a provider completes before placing a high-risk AI system on the market. Either the provider checks the system internally, or an accredited outside body checks it. The assessment shows the system actually meets the EU AI Act's requirements, rather than merely claiming to.
definition: |-
  For almost every high-risk system, the provider checks its own work against the rules and signs a declaration, with no outside reviewer involved. Only biometric-identification systems sometimes need an independent outside checker, a "notified body," to sign off instead.

  Article 43 sets this split by Annex III area, the EU AI Act's list of high-risk use cases. Every area except biometric identification uses Annex VI, the self-check route with no notified body involved. Biometric identification uses Annex VII's notified-body route wherever harmonised standards are not fully applied or do not yet exist. Harmonised standards are the detailed technical rules the Commission recognises as proof of compliance.

  The assessment is not a one-time formality. Any substantial change to a system after launch triggers a new one, under whichever route applied the first time. The one exception is a system that keeps learning after deployment. A provider can plan for that drift in advance and record it in the technical documentation before the first assessment. Later changes that stay within that plan do not reopen the process.
relatedTerms:
  - high-risk-ai-system
  - technical-documentation
  - post-market-monitoring
sources:
  - title: Article 43 - Conformity Assessment
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

An investor or a board asks how a company knows its AI system is compliant. A vague assurance is not the same as pointing to a completed assessment and a signed declaration. A procurement team increasingly asks to see evidence the assessment happened at all, rather than taking a compliance claim on trust. It also surfaces at the worst time, during a late-stage system change, when nobody planned for a second assessment.

## What to do about it

Work out early, before the system is built, which assessment route applies. That matters because a notified-body review takes far longer to arrange than an internal one, and you cannot rush it at launch.

Keep the assessment evidence alongside the technical documentation it depends on, not in a file only one person can find. Mapping each system to its likely route is part of the [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment) done before a deadline forces the decision.
