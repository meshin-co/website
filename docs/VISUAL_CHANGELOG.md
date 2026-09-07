# Visual changelog

Every commit that adds or updates a Playwright visual baseline must add an entry here in the same
commit. An updated baseline without an entry fails review.

Format: `YYYY-MM-DD · route or component · what changed visually · why`.

2026-09-07 · `/` and `/404` · first baselines recorded for the Phase 1 skeleton at 1440x900 and
375x812, light and dark, per platform (`darwin` locally, `linux` from the
`mcr.microsoft.com/playwright:v1.63.0-jammy` container) · Phase 1 CG.

## 2026-09-08 · `/` hero, section heads, CTA, footer
- Hero: removed the hairline grid, added a four-stage pipeline motif (pilot → evals → gateway →
  production) at the section foot, drawn in HTML at fixed type size so it stays legible on mobile.
- Section heads: title and lead now share one vertical centre line instead of the lead sitting on
  the baseline.
- CTA: the button and the email fallback are one group, centred together from `lg` and left-aligned
  below it, so they never fight the left-aligned copy.
- Footer: colophon replaced with a copyright line that computes the current year.
- Three-card rows go from one column straight to three, so no card is stranded at tablet width.
- Copy: years of experience computed from January 2008; de-duplicated service bullets; plainer voice.
