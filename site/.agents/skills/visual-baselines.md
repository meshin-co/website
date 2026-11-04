# Regenerate Visual Baselines

Snapshots cover one representative route per template family (`scripts/templates.mjs`), at
1440x900 and 375x812, light and dark. Baselines are per-platform under
`site/tests/__screenshots__/` — macOS and Linux rasterize fonts differently, so each OS keeps
its own set, and BOTH sets are regenerated together (the linux set arrives as a separate commit).
The path template lives in `playwright.config.ts`; the spec is `tests/visual.spec.ts`.

## Why a new entry does not move a baseline

The screenshots are taken from `dist-visual`, not from `dist`: a second build of the same site over
a frozen corpus. `astro build --mode visual` makes every collection read only the files that
`src/data/visual-corpus.json` lists (`src/utils/visual-corpus.mjs`, called from
`src/content.config.ts`). The blog list, the tag pages and "Keep reading" show that frozen set, so
an entry written tomorrow changes none of them and cannot change which route sorts first in its
template. `scripts/visual-site.mjs` names the folder, port and template list. Everything else, the
axe tests included, still reads the live `dist`.

Only a person changes the set: `npm run assets:visual-corpus`, then regenerate both platforms. Do it
when you add a template or want the gate to see a new entry. A pinned file that is renamed or
deleted fails the visual build and prints that command. The unattended writer never edits the
manifest, a pinned entry or a baseline, so its pull request leaves every baseline alone.

`npm run gate:visual` builds `dist-visual` first, so it cannot read a stale one; the live
`npm run build` must still come before it. Ports: live 4322, visual 4323. A planted layout defect
still fails it: the mutation family `layout-regression-on-the-frozen-corpus`.

## darwin (local)

    cd site && npm run build && npm run gate:visual -- --update-snapshots

Only screenshots that differ are rewritten; `git status` must show only what you meant to move.

## linux (preferred: the CI runner itself)

`gh workflow run ci --ref main` triggers the `regen-baselines` job in `.github/workflows/ci.yml`. It
builds on the same runner image that verifies the snapshots, regenerates
`tests/__screenshots__/linux/` and commits as `baseline-bot`. Use this first: a container matching
the image is still not the runner, and a one-line sub-pixel wrap difference between them cost a full
red CI round on 2026-09-13. Then pull the bot commit: `git pull --rebase origin main`.

## linux (fallback: CI-matching container)

Use when the runner is unavailable, or to reproduce a failure the runner already reported. Build on
the host first (`npm run build && npm run build:visual`), then run from `site/`:

    docker run --rm --platform linux/amd64 -v "$PWD":/work -w /work \
      mcr.microsoft.com/playwright:v1.63.0-noble npx playwright test --update-snapshots

**Never regenerate baselines this way on Apple Silicon.** `--platform linux/amd64` on an arm64 host
runs under QEMU, whose timing is not the runner's. Measured on 2026-09-14: repeated full runs of
the same commit against the same baselines failed 24, then 27, then 9, then 14 tests, a different
set each time, while the real runner passed all three visual shards. Every failure was a whole-page
**dimension** mismatch, never same-size pixel noise. Emulated failures are not evidence about the
site, and baselines recorded under emulation may not match the runner.

## Traps

- A baseline change needs no `docs/VISUAL_CHANGELOG.md` entry and no gate checks for one:
  `regen-baselines` commits as `baseline-bot`, which cannot write prose. When the reason is worth
  keeping, add `YYYY-MM-DD · route or component · what changed visually · why`.
- Sweep against the built output (`npm run preview`), never a long-running dev server: a stale
  module graph serves a newly added scoped style as absent, which reads as a design defect.
- axe contrast failures at a ~1:1 ratio on one viewport mean the element was measured while
  invisible behind a scroll or intersection animation. Remove the animation; do not nudge the palette.
- A baseline no test reads is dead weight (L40). Entries that sorted first once left sixteen behind;
  delete one in the commit that finds it, after checking its name against the visual build.
- `playwright.config.ts` pins `workers: 4`: the gate server is one process, and the machine default
  failed in the hundreds while every project passed alone.
- A capture timeout is not a visual regression. On 2026-10-16 shard 1 failed `home-light-desktop`
  with "Failed to take two consecutive stable screenshots", yet `actual` and `expected` were
  pixel-identical: a shared runner is slower than a laptop. The spec now measures the height after
  the fonts land and clips to it. Read the artifact before regenerating a baseline.
- Brand assets: `npm run assets:og-default` and `npm run assets:favicons` regenerate the OG image and
  favicons from `src/config.yaml`; run both after a brand color, wordmark or description change.
