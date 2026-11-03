---
title: 'Mutation specimen: a source whose original is not the address its url stands in for'
term: Source original specimen
description: 'A specimen glossary term whose only violation is a source original that its url is neither an Internet Archive snapshot of nor a search for.'
publishDate: 2026-09-12
updatedDate: 2026-09-12
shortDefinition: 'A specimen term that proves the source original guard can fail. It is a valid glossary entry except for one source whose original address is not the address its url stands in for, so the build must name that field.'
definition: |-
  A repaired source keeps two addresses. The url is what a reader follows: an Internet Archive snapshot of the cited page or, when no snapshot exists, a search built from the title and publisher of the source. The original is the address that was first cited, kept so the entry still says what it rests on.

  The two must agree: a snapshot has to be a capture of exactly that original address, and a search has to be the one built from this source's own title and publisher. This specimen plants one source whose original names a different page from the one its snapshot captured. The schema must refuse it and name the original field of the first source. Otherwise a reader could follow a copy of one document while the entry claims to cite another.

  Every other field of this entry is valid, so the build must exit non-zero for this one reason only. The copy is discarded after the check, so the live site never carries it.
sources:
  - title: 'Artificial Intelligence Risk Management Framework (AI RMF 1.0) | NIST'
    url: 'https://web.archive.org/web/20251025031200/https://www.nist.gov/itl/ai-risk-management-framework'
    original: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10'
    publisher: NIST
    retrieved: '2026-10-25'
---

Specimen body. The mutation smoke drops this file into `src/data/glossary/` and asserts `astro build`
exits non-zero naming the `sources.0.original` field.
