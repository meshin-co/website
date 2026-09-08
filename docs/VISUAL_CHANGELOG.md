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
