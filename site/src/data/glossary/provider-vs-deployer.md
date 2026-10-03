---
title: What is the difference between a provider and a deployer?
term: Provider vs deployer
description: Provider and deployer are EU AI Act roles - a provider builds or brands a system, a deployer uses it, and the two owe different duties.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: Provider vs deployer is the EU AI Act split between the company that builds an AI system and the company that runs it. Most of the Act's paperwork depends on which of the two roles a company holds.
definition: |-
  Article 3 defines a provider by two acts done together. The first is developing the system, or having someone else develop it. The second is placing it on the market or putting it into service, under the provider's own name or trademark. Payment is irrelevant. Giving the system away under your own brand still makes you the provider.

  A deployer is defined by use, not branding: using the system under the deployer's own authority. The only carve-out is personal, non-professional activity. A company using a tool internally is a deployer even if it never touches a customer.

  That test has a sharp edge. A company that fine-tunes a vendor's model and ships the result under its own product name has made itself the provider of that product. It does not matter that it built none of the underlying model. Owning the brand is what matters, not how much of the system the company actually wrote.
relatedTerms:
  - high-risk-ai-system
  - human-oversight
  - sub-processor
sources:
  - title: Article 3 - Definitions
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: Article 26 - Obligations of Deployers of High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
---

## Why it comes up

It surfaces in a contract negotiation once both sides realise the label matters more than expected. A provider owes technical documentation and a conformity assessment, while a deployer mainly owes human oversight and monitoring. A board hears about it when a vendor's contract quietly assigns the company duties it assumed the vendor carried. Getting the role wrong can leave a company holding an obligation nobody budgeted for.

## What to do about it

Run the provider-or-deployer test per system, not per company. Rebranding one vendor's model can make a company a provider for that product while it stays a deployer for everything else it merely uses. Write the answer into the AI register alongside the risk tier, since a security questionnaire will eventually ask for both. The [Fractional CAIO Retainer](/services/fractional-caio-retainer) is where I answer this kind of question inside a live negotiation.

## Deployer obligations checklist

Article 26 of the EU AI Act sets these duties for a deployer of a [high-risk AI system](/glossary/high-risk-ai-system). They apply to high-risk systems only. The provider carries a separate set of duties, and public authorities and some biometric uses carry further duties in the same Article.

- Use the system as the provider's instructions for use say.
- Assign [human oversight](/glossary/human-oversight) to people who have the competence, training, authority and support to do it.
- Make sure the input data you control is relevant and representative for the system's purpose.
- Monitor the system against those instructions. If you have reason to think it presents a risk, tell the provider, importer or distributor and the market surveillance authority without undue delay, and suspend its use.
- Report a [serious incident](/glossary/serious-incident-reporting) at once, to the provider first.
- Keep the logs the system generates, as far as you control them, for at least six months unless other law says otherwise.
- If you are an employer, tell the workers' representatives and the affected workers before you use a high-risk system at work.
- Tell people when a high-risk system listed in Annex III makes or helps make a decision about them.
- Use the provider's information for your [data protection impact assessment](/glossary/dpia) where one is required.
- Cooperate with the competent authorities.
