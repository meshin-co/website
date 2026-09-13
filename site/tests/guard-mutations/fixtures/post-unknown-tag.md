---
title: 'Mutation specimen: unknown tag'
description: 'A specimen post whose only violation is a tag outside the controlled vocabulary in src/data/tags.mjs.'
publishDate: 2026-09-12
updatedDate: 2026-09-12
shortAnswer: 'This specimen exists to prove the tag vocabulary guard can fail. It is a schema-valid post in every other respect, whose only violation is one tag outside the controlled list, so the build must exit non-zero and name the tags field.'
fullAnswer: 'A guard that has never failed is a guard nobody trusts, so this specimen plants a single violation into a copy of the site and expects the schema to name it. The post is valid everywhere else: the short answer sits inside its word range, the takeaways count three, the source list carries one real reference, and the dates are in order. The only thing wrong is one tag that appears nowhere in the controlled vocabulary. When the build validates the frontmatter, the enum must reject the unknown tag and the exit code must be one. If the build stays green, the vocabulary is decoration, not a guard, and the mutation smoke fails the family. That is the whole point of the exercise: every guard is proven able to fail before anyone relies on it.'
keyTakeaways:
  - 'A guard that never failed is a guard nobody trusts, so each one gets a planted violation.'
  - 'The specimen is valid everywhere except the single field under proof.'
  - 'The copy is discarded, so the live site never carries a violation.'
category: governance
tags:
  - definitely-not-in-the-vocabulary
sources:
  - title: 'Artificial Intelligence Risk Management Framework (AI RMF 1.0) | NIST'
    url: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10'
author: dmitri
---

This paragraph exists only to give the specimen a body. It carries no violation; the unknown tag in
the frontmatter is the single field under proof.
