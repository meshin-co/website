---
title: What is post-market monitoring under the EU AI Act?
term: Post-market monitoring
description: Post-market monitoring is the EU AI Act duty to keep collecting real-world data on a high-risk system after it ships, not just before.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Post-market monitoring is the EU AI Act duty on a provider to keep collecting and analysing real-world performance data on a high-risk AI system for as long as it is in use. Problems that appear after launch get caught this way, rather than assumed away by the original testing.
definition: |-
  Article 72 requires a documented monitoring system, sized to the technology and the risk of the specific system. It has to actively and systematically collect and analyse data on how the system performs once it is actually in use. Deployers feed into it directly, since Article 26 requires them to monitor the system on their end and report back to the provider. That way, the provider is not relying on its own visibility alone.

  The monitoring plan is not a separate document. Article 72 makes it part of the system's technical documentation, built and updated alongside it, not bolted on after a complaint. A pattern the monitoring turns up is also the raw material for the next duty in the chain: deciding whether what happened counts as a serious incident that has to be reported.
relatedTerms:
  - serious-incident-reporting
  - high-risk-ai-system
  - observability
sources:
  - title: Article 72 - Post-Market Monitoring by Providers and Post-Market Monitoring Plan for High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: Article 26 - Obligations of Deployers of High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

Does anyone keep watching this system, or was it tested once and left alone? That is the specific question a customer's security team or a regulator asks after any AI failure story in the press. A board hears it as reassurance that a problem would surface through a defined process rather than a customer complaint reaching the news first. Providers who can only describe pre-launch testing, and nothing after, usually have no answer.

## What to do about it

Write the monitoring plan before launch - what gets measured, who reviews it, how often - since a plan invented after a problem appears is not the same thing. Build a route for deployer-reported issues to reach the provider.

A monitoring system that never hears from the people using it day to day is monitoring very little. The [Fractional CAIO Retainer](/services/fractional-caio-retainer) I run keeps this review on a fixed schedule, not only when a customer complains.
