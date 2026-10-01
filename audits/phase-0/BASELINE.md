# Phase 0 baseline — untouched AstroWind template

Generated-from: 9fd5605 (the template as scaffolded, the revision whose build was measured)

Summarised by hand from Lighthouse runs of that build. No script writes this file.

Route: `/` from the production build of the template exactly as scaffolded.
Median of 3 runs per form factor. Informational only: this is the starting point, not a gate.

| Form factor | Performance | Accessibility | Best Practices | SEO |
| ----------- | ----------- | ------------- | -------------- | --- |
| desktop     | 100         | 100           | 100            | 100 |
| mobile      | 99          | 96            | 100            | 100 |

Raw Lighthouse JSON is no longer tracked: `audits/*/baseline/`, `lh-mobile/` and `lh-desktop/`
are gitignored, because 272 MB of reproducible runs were bloating every clone. Re-derive any of
it with `npm run gate:lh` against the commit you care about.

## Template defects to clear in Phases 1-2 (mobile)

- `color-contrast` (accessibility) — Background and foreground colors do not have a sufficient contrast ratio.
