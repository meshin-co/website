# Regenerate Visual Baselines

Snapshots cover one representative route per template family (`scripts/templates.mjs`), at
1440x900 and 375x812, light and dark. Baselines are per-platform under
`site/tests/__screenshots__/` — macOS and Linux rasterize fonts differently, so each OS keeps
its own set, and BOTH sets are regenerated together, in the same commit.

## darwin (local)

    cd site && npx playwright test --update-snapshots

## linux (preferred: the CI runner itself)

`gh workflow run ci --ref main` triggers the `regen-baselines` job in
`.github/workflows/ci.yml`. It builds on the same runner image that verifies the snapshots,
regenerates `tests/__screenshots__/linux/` and commits as `baseline-bot`. Use this first: a
container matching the image is still not the runner, and a one-line sub-pixel wrap difference
between them cost a full red CI round on 2026-09-13.

Pull the bot commit before continuing: `git pull --rebase origin main`.

## linux (fallback: CI-matching container)

Use when the runner is unavailable, or to reproduce a failure locally. Run from `site/` so the
volume maps the installed packages:

    docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work \
      mcr.microsoft.com/playwright:v1.63.0-noble npx playwright test --update-snapshots

**Never regenerate baselines this way on Apple Silicon.** `--platform linux/amd64` on an arm64
host runs under QEMU, and its timing is not the runner's. Measured on 2026-09-14: repeated full
runs of the same commit against the same baselines failed 24, then 27, then 9, then 14 tests, a
different set each time, while the real runner passed all three visual shards on the same code.
Every failure was a whole-page **dimension** mismatch — two stable heights per page, 18 to 57 px
apart, symmetric between runs — never same-size pixel noise. Emulated failures are not evidence
about the site, and baselines recorded under emulation may not match the runner. Use the
container only to reproduce a failure the runner already reported, and regenerate on the runner.

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

## Brand assets (OG image, favicons)

`npm run assets:og-default` regenerates `src/assets/images/og-default.png` from
`src/config.yaml`'s `metadata.description`; `npm run assets:favicons` regenerates
`src/assets/favicons/apple-touch-icon.png` and `favicon.ico`. Run both after any brand color,
wordmark, or description change and commit the resulting PNGs.
