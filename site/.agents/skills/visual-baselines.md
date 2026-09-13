# Regenerate Visual Baselines

Snapshots cover one representative route per template family (`scripts/templates.mjs`), at
1440x900 and 375x812, light and dark. Baselines are per-platform under
`site/tests/__screenshots__/` — macOS and Linux rasterize fonts differently, so each OS keeps
its own set, and BOTH sets are regenerated together, in the same commit.

## darwin (local)

    cd site && npx playwright test --update-snapshots

## linux (CI-matching container)

Run from `site/` so the volume maps the installed packages:

    docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-jammy \
      npx playwright test --update-snapshots

## Same-commit rule

Every baseline change adds an entry to `docs/VISUAL_CHANGELOG.md` in the same commit, format
`YYYY-MM-DD · route or component · what changed visually · why`. An updated baseline without
an entry fails review. The platform-scoped snapshot path template lives in
`site/playwright.config.ts`; the spec is `site/tests/visual.spec.ts`.

## Traps (docs/FRONTEND-EXCELLENCE-ISSUES.md)

- Sweep against the built output (`npm run preview`), never a long-running dev server: a
  stale module graph serves a newly added scoped style as absent, which reads as a design
  defect.
- axe contrast failures at a ~1:1 ratio on one viewport mean the element was measured while
  invisible behind a scroll or intersection animation. Remove the animation so the resting
  state is visible; do not nudge the palette.
