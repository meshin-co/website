# Add a Collection Entry

One markdown file per entry in `site/src/data/`: post, service, resource, case, glossary, faq,
author. The schema in `site/src/content.config.ts` is the contract: the build fails on any
refinement violation, and every guard has a planted violating specimen under
`site/tests/guard-mutations/fixtures/`.

## Every publishable entry

title · description (155 chars max, it is the meta description) · publishDate · updatedDate
(never before publishDate) · draft · noindex · optional canonical and ogImage, consumed by the
templates. FAQ routes use the static default OG instead of a rendered one.

## Per collection

- post: shortAnswer 40–60 words · fullAnswer 130–170 · keyTakeaways 3–5 · faq up to 5 ·
  category from the four-value enum · tags only from the controlled vocabulary in
  `site/src/data/tags.mjs` · sources min 1 · author as a reference · relatedResources.
- service: name, tagline, shortAnswer, feeShape, duration · forWhom, notForWhom, deliverables
  lists · process steps · schedule 3–5 stages · faq 3–8 · cta · sources min 1 · order.
- resource: name · type enum (template, kit, scorecard, repo, checklist) · version, license,
  status · whatInside min 1 · howToUse · sources min 1 · relatedPosts.
- case: client (industry and size always; a name only with a confirmed checklist row) ·
  problem · approach · outcome.metrics max 3, owner-confirmed numbers only · stack min 1 ·
  offer reference · anonymized.
- glossary: term · shortDefinition 50 words max · definition 100–200 · relatedTerms ·
  sources min 1.
- faq: question (length-capped for the OG card) · answer 80 words max · category · order ·
  optional relatedPage and sources. The hub teaser is derived from the answer's first
  sentence by `site/src/utils/faq-meta.mjs` (140 chars max) — there is no teaser field.

## Dates and sources

updatedDate changes only when the content changed. Feeds and indexes sort on
max(publishDate, updatedDate) through the shared helper in `site/src/utils/lastmod.mjs`, so a
bumped date is a visible freshness claim on every machine surface. Sources carry title and
url; claims about standards cite primary domains (iso.org, eur-lex.europa.eu, nist.gov,
owasp.org).

## After writing

Add the `site/content-facts.json` row (content-gate.md), rebuild, run Half A, then the judge
panel. Machine surfaces update at build time (machine-interfaces.md); no interface is
hand-edited.
