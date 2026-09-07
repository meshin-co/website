# Phase 0 baseline — untouched AstroWind template

Route: `/` from the production build of the template exactly as scaffolded.
Median of 3 runs per form factor. Informational only: this is the starting point, not a gate.

| Form factor | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| desktop | 100 | 100 | 100 | 100 |
| mobile | 99 | 96 | 100 | 100 |

Raw Lighthouse JSON: `audits/phase-0/baseline/{mobile,desktop}/`.
## Template defects to clear in Phases 1-2 (mobile)

- `color-contrast` (accessibility) — Background and foreground colors do not have a sufficient contrast ratio.

