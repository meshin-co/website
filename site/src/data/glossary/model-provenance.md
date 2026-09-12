---
title: What is model provenance?
term: Model provenance
description: Model provenance is a traceable record of what a model was built from - its base model, its training data, and the licence covering both.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Model provenance is a traceable record of what a model is built from. That means which base model it started from, what data trained or fine-tuned it, and what licence covers the result. A buyer needs this to know what it is allowed to do with the output.
definition: |
  Article 53 of the EU AI Act turned this from a private claim into a published one for general-purpose models. Providers must publish a sufficiently detailed summary of training content, following a template the AI Office issued. That summary covers the scale of the data, and whether it includes licensed material, scraped web content, user data or synthetic data.

  For a smaller company building on someone else's model, provenance is a due-diligence question, not a publishing duty. Work through it before signing, not after. That distinction decides who actually reads the summary, and when: before a contract is signed, not after a customer's legal team goes looking for where the data came from.
relatedTerms:
  - model-card
  - retrieval-augmented-generation
  - data-classification
sources:
  - title: Article 53 - Obligations for Providers of General-Purpose AI Models
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
---

## Why it comes up

A customer's legal team asks it once a product's output could plausibly end up in something they publish, resell or use to make a decision. They inherit whatever rights problem the underlying model carries. It also comes up quietly in procurement: which model is actually behind a feature can have a different answer than the vendor's marketing page implies. That gap widens once a vendor swaps providers without telling anyone.

## What to do about it

Ask every model vendor what the model was trained on, or where its training-data summary sits if the vendor owes one. Ask what licence covers the weights and output. Record the answer in the AI register next to that system, not in an email thread nobody can find during a review. Reading the actual vendor list, not asking a company to describe it from memory, is what the [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment) does.
