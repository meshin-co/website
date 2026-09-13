---
question: 'How does the mutation smoke prove a required date can fail?'
answer: 'By planting an otherwise valid FAQ entry whose frontmatter omits updatedDate entirely. The schema requires the date, so the build must exit non-zero and name updatedDate as the offending field rather than failing somewhere quieter.'
category: general
relatedPage: /services
order: 999
publishDate: 2026-09-12
---

Specimen body. The mutation smoke drops this file into `src/data/faq/` and asserts `astro build`
exits non-zero naming the `updatedDate` field.
