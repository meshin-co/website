# skill-frontend-excellence friction log

Issues found while using `skill://frontend-excellence` on the meshin.co build. Raw material for
correcting or extending the skill. Append; do not rewrite history.

---

## 001 · `testing.md`'s Lighthouse CI example uses an invalid `preset`

- **When:** 2026-09-07, Phase 1, wiring the desktop Lighthouse run.
- **What the skill shows:** `"collect": { "numberOfRuns": 5, "settings": { "preset": "desktop" } }`.
- **What happens:** with `@lhci/cli@0.15.1` the run dies with
  `Argument: preset, Given: "desktop", Choices: "lighthouse:all", "lighthouse:recommended", "lighthouse:no-pwa"`.
  In lhci's config, `preset` is an **assertion** preset; the collect side wants
  `formFactor` plus `screenEmulation` and `throttling`.
- **Working replacement** (mobile vs desktop from one config, selected by env var):
  `formFactor: 'desktop' | 'mobile'`, `screenEmulation: { mobile, width, height, deviceScaleFactor, disabled }`,
  `throttling: { rttMs, throughputKbps, cpuSlowdownMultiplier }`, `emulatedUserAgent`.
- **Suggested fix:** replace the snippet, and say plainly that `assert.preset` and
  `collect.settings` are different namespaces.

## 002 · Two form factors overwrite one output directory, producing a fake-green report

- **What the skill shows:** a single `lhci autorun` per job, with `preset` switching the form
  factor. Nothing says what happens when you run mobile and desktop in sequence.
- **What happens:** both runs write to `./.lighthouseci`, so the second wipes the first. A report
  generator that reads that directory then sees only one form factor — and if it only iterates the
  rows it found, it prints PASS with the other form factor silently absent. That happened here and
  was caught by adding a guard that every derived route must have a run in **both** form factors.
- **Suggested fix:** in `testing.md`, show `--upload.outputDir=./.lighthouseci/<form-factor>` and
  state the invariant: a gate must assert the number of form factors and runs it expected, not just
  grade whatever rows it happens to find.

## 003 · The assertion thresholds in the examples are weaker than the skill's own targets

- **What the skill shows:** `categories:performance >= 0.9`, `accessibility >= 0.95`,
  `best-practices >= 0.95`, `seo >= 0.95` in `testing.md`.
- **Why that is a trap:** the North Star table in `SKILL.md` asks for 100 on Accessibility, Best
  Practices and SEO. Copy the example config and a 96 passes forever. The example teaches a gate
  that cannot enforce the skill's own bar.
- **Suggested fix:** make the example assert the North Star numbers, and put the relaxed numbers in
  a clearly-labelled "legacy codebase, ratchet upward" variant.

## 004 · No guidance on third-party scripts failing inside the lab run

- **What happened:** with Plausible in the page, every local Lighthouse run logged
  `Failed to load resource: 499` and `Refused to execute script … MIME type ('image/png')` for
  `plausible.io`, which trips `errors-in-console` and pins Best Practices at 96 — even though the
  script serves correctly (200, `application/javascript`) from the same machine.
- **Why it matters:** the skill treats third-party scripts as a budget and INP problem, and rule 7
  calls them "a Lighthouse hostage", but never mentions that the lab harness itself can make a
  healthy third party look broken and cost the Best Practices 100.
- **What was done here:** `blockedUrlPatterns: ['*plausible.io*']` during Lighthouse runs, with the
  analytics script verified separately (status, MIME, byte size, `defer`).
- **Suggested fix:** add this to `lighthouse.md` as a named recipe, including the honesty caveat —
  blocking a third party in the lab is only legitimate if that third party is verified by another
  check.

## 005 · Scroll-triggered fade-ins read as contrast failures, and `defects.md` does not say so

- **What happened:** the AstroWind template ships `motion-safe:md:opacity-0` plus an
  intersection-observer fade on the footer and several widgets. axe evaluated the footer while it
  was still at `opacity: 0` and reported 25 `color-contrast` violations with a computed foreground
  almost equal to the background (ratio 1.02) — at desktop widths only, because the `md:` prefix
  scoped the animation.
- **Why it is easy to misdiagnose:** the numbers look like a palette bug, so the obvious fix is to
  nudge token lightness. The actual cause is that the element is invisible when measured, and the
  deeper defect is that the content depends on JavaScript and a scroll event to become visible at
  all.
- **Suggested fix:** add a row to `defects.md`'s lookup — *symptom:* many contrast failures with a
  ~1:1 ratio, one viewport only; *cause:* element measured while `opacity: 0` behind a scroll or
  intersect animation; *fix:* remove the animation or make the resting state visible.


## 006 · The visual-regression recipe names the OS problem but its CI wiring ignores it

- **When:** 2026-09-07, Phase 1, first CI run of the visual gate.
- **What happened:** all 8 screenshot comparisons failed on GitHub Actions while passing locally.
  Baselines were recorded on macOS; the runner is Linux, so font rasterisation differs on nearly
  every glyph. `maxDiffPixelRatio: 0.002` cannot absorb that, and should not.
- **What the skill says:** `testing.md` does warn that "font rendering differs across OS, so CI
  and local runs disagree unless you pin the OS (Playwright's docker image)" — but its
  `toHaveScreenshot` example uses a single flat snapshot path, and its GitHub Action snippet runs
  the build and lhci with no container and no platform-scoped baselines. Following the recipe as
  written produces exactly this failure.
- **What was done here:** `snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}'`
  so each OS keeps its own baseline set, then recorded the Linux set with
  `docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-jammy npx playwright test --update-snapshots`.
  Both sets are committed; local runs compare against `darwin`, CI against `linux`.
- **Suggested fix:** put `{platform}` in the example `snapshotPathTemplate`, and add the docker
  command for recording baselines to the same section. Otherwise the warning is prose that the
  code sample contradicts.
## 007 · Visual verification against a long-running dev server can read stale scoped CSS
- **When:** 2026-09-07, Phase 2, adding a new component with its own scoped `<style>` block.
- **What happened:** the browser sweep showed the new widget completely unstyled (computed
  `font-size: 18px` instead of `9px`, zero-width nodes) even though the built `dist` HTML and CSS
  both contained the right rules. The dev server had been running through dozens of edits and was
  serving a stale module graph for the newly created file.
- **Cause:** the skill tells you to verify every change in a real browser, but never says which
  server to point it at, so a stale dev server reads as a design defect.
- **Suggested fix:** add a line to the audit workflow: when a sweep reports a widget as unstyled,
  first confirm the rule exists in the built output, then restart the dev server before treating
  it as a defect. Prefer serving `dist` for audit sweeps.
