---
question: 'How does the mutation smoke prove a description floor can fail?'
description: 'Too short.'
answer: 'By planting an otherwise valid FAQ entry whose hand-authored description is far under the 120-character floor. The schema must reject it and name the description field, rather than silently shipping a broken meta snippet.'
category: general
relatedPage: /services
order: 999
publishDate: 2026-09-12
updatedDate: 2026-09-12
draft: false
noindex: false
---

Specimen body. The mutation smoke drops this file into `src/data/faq/` and asserts `astro build`
exits non-zero naming the `description` field.
