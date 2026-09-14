# Visual changelog

Every commit that adds or updates a Playwright visual baseline must add an entry here in the same
commit. An updated baseline without an entry fails review.

Format: `YYYY-MM-DD · route or component · what changed visually · why`.

2026-09-07 · `/` and `/404` · first baselines recorded for the Phase 1 skeleton at 1440x900 and
375x812, light and dark, per platform (`darwin` locally, `linux` from the
`mcr.microsoft.com/playwright:v1.63.0-jammy` container) · Phase 1 CG.

## 2026-09-08 · `/` hero, section heads, CTA, footer
- Hero: the hairline grid is back and now draws both axes (vertical and horizontal rules). A
  pipeline motif was tried here and rejected by the owner: it read as unrelated decoration.
- Section heads: title and lead now share one vertical centre line instead of the lead sitting on
  the baseline.
- CTA: the button and the email fallback are one group, centred together from `lg` and left-aligned
  below it, so they never fight the left-aligned copy.
- Footer: colophon replaced with a copyright line that computes the current year.
- Three-card rows go from one column straight to three, so no card is stranded at tablet width.
- Copy: years of experience computed from January 2008; de-duplicated service bullets; plainer voice.
- Headline: restored the space Astro was dropping between the plain and accented halves of the
  hero `h1`, so it no longer reads "nameon the org chart".
- Component inventory completed: PostCard, AnswerBlock, KeyTakeaways, TableOfContents, FaqList,
  AuthorBox, SourceList, CaseMetrics. All eight are in `/styleguide`, checked at 1440 and 390 in
  both themes, plus the FAQ open state and keyboard focus rings.

## 2026-09-08 · Phase 3 · every content template
- New route templates, all captured at 1440x900 and 375x812 in both themes: `/services`,
  `/services/:entry`, `/resources`, `/resources/:entry`, `/blog`, `/blog/:entry`,
  `/blog/category/:entry`, `/glossary`, `/glossary/:entry`, `/case-studies`,
  `/case-studies/:entry`, `/faq`, `/about`, `/approach`, `/pricing`, `/contact`, `/now`,
  `/speaking`, `/ai-policy`, `/security`, `/privacy`, `/terms`, `/imprint`, `/search`.
- Lead section of every page now renders its title as `h1` (`headingLevel` prop on `Section`),
  which axe flagged as missing on the new routes.
- Footer columns changed from a 2x2 block hugging the right edge to four even columns beside the
  brand, because the brand column was leaving a dead half-width gap.
- Heading anchors in article prose are now an empty `a.heading-anchor` with the `#` drawn by CSS
  and hidden until the heading is hovered or the link is focused. Before, the glyph was a text
  child, so it appeared inline after every heading and leaked into the table of contents.
- Scrollable tables on `/pricing` and `/ai-policy` are keyboard focusable named regions.
- Snapshot scope changed: visual snapshots now cover one representative route per template
  (`scripts/templates.mjs`), while axe still runs on all 41 routes in both themes.

## 2026-09-12 — Brand: chip logo lockup `Fractional [CAIO]`

Header and footer brand replaced the green-square wordmark with the recreated
microchip mark (all four sides pinned, unequal pin lengths, 33/31 wall asymmetry
from the source PNG) widened horizontally to carry `CAIO` in IBM Plex Mono inside
the cavity, optically centered. `Fractional` in Fraunces precedes the figure.
Adaptive: mark and text inherit `currentColor`; `[CAIO]` keeps heading color.
Favicons regenerated from the same geometry (svg with dark-mode media query,
180px apple-touch on paper, 16/32/48 ico). Both platform baselines regenerated
in the same commit.

## 2026-09-13 — Phase 4.5b: breadcrumbs, blog navigation, tag pages

Breadcrumbs UI on every non-home route (component owns the single
BreadcrumbList). Blog hub + categories paginate at 12/page with crawlable
numbered links, page 2+ noindex-follow, page-one canonical. /blog/tags index
plus 12 tag pages, all indexed, controlled vocabulary schema-enforced. Posts
link up and sideways (prev/next, related, category, tags); footer gains
Topics. Inline links restyled with persistent underline (axe
link-in-text-block). Both platform baselines regenerated.

## 2026-09-13 — Plan validation fixes

Numbered chips removed from the step and signal lists (L9a had been applied to section headers
only). Footer gains a crawlable Search link. The tags index and tag routes now cover only tags a
live post actually carries, so two empty indexed pages are gone. Blog card tag and category links
carry the persistent underline. Every baseline regenerated on both platforms.

## 2026-09-14 — Fonts: three faces, no synthesized bold

Fraunces 700 is gone (no shipped page requested it through a class), so prose h2/h3/h4 now ask
for 600 like every other heading instead of letting the browser fake bold from 600. Both families
render with `font-display: swap`, which is safe now that the CSP no longer blocks the fallback
metric overrides. Deleting 38 unreachable template components cut the stylesheet from about
21 KB gz to 12.5 KB. Article pages are around 80 px shorter as a result; both platform baselines
regenerated.

## 2026-09-14 — Phase 4.6: dates, landmarks and related content on every leaf

Every leaf body is wrapped in `<article>`, and each one now shows a "Published … · Updated …"
line built from real `<time datetime>` values — glossary terms, case studies, resources and
services previously showed no date at all. FAQ, glossary, resource and service leaves gained a
related-content block (related questions, the service an answer concerns, glossary terms the
prose actually mentions), and the first honest mention of a term or service in a leaf's own copy
is now a link. Tag pages carry the `/blog/tags` level in their breadcrumb trail. Both date and
related blocks are marked `data-gate-ignore` because they are chrome, not prose; the content gate
still reads the rendered date from them.
