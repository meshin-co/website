# Phase 5.1 · Harness integrity, while launch waits on the owner

Goal: while Phase 5 sits blocked on Cloudflare, DNS and search-console access nobody but the owner
can grant, keep the gates that guard every other phase honest, and ship the owner-facing GEO and
compliance work that does not need the domain flip. Evidence: commit messages cited below (no
`audits/phase-5.1/` directory — none of this work produced a generated report of its own).

This phase exists because the plan tree stopped tracking work: `15ba58e` (2026-09-15) was the last
commit to rename a phase file, and 26 commits landed after it before this file was written. Five
of them touched no phase file at all — `685d40c`, `a8ef430`, `0534b44`, `3e436cd`, `6a0c9c2` — and
a sixth, `d412cc6`, is a small regression fix inside already-`.done` Phase 4.7 that never got a
line either. This file is the catch-up, and the reason it exists at all is recorded below under
"Machine check considered, not implemented."

## Round 1 — first external audit (`685d40c`, 2026-09-22)

An external review of a fork found six things wrong with the repo; five reproduced. Each got a
fix and a machine check so the class cannot silently return:

1. `gate:editorial` and `gate:registers` were defined and never ran in CI — L36 says a gate not in
   `ci.yml` is not a gate, and nothing had enforced L36 itself. `gate:plan` now fails on a
   `gate:*` script missing from `ci.yml`.
2. `gate:search` did not exist; the search byte budget ran nowhere in CI. Added and wired in.
3. CI installed only `chromium`; `playwright.config.ts` had run `webkit` and `firefox` projects
   since the morning of the same day. `gate:plan` now fails when a configured Playwright browser
   is missing from every `npx playwright install` line in `ci.yml`.
4. `public/humans.txt` claimed the site was built with Pagefind; it never was. `gate:machine` now
   fails when `humans.txt` names a component that is not a real dependency.
5. `site/README.md` was still the AstroWind template — 315 lines describing a different project
   and citing a skill that does not exist. Rewritten to 41 lines describing what this actually is.
6. The brand literal was typed into three modules that each redeclared it. Consolidated into
   `src/utils/brand.mjs`, read once from `src/config.yaml`.

A claim that did not reproduce: `report.mjs` reading a `gate.overBudget` field `gate.mjs` never
wrote. Disputed at the time; round 2 found the dispute itself was wrong (see below).

A separate read-only audit of all 56 locked rows in the same pass found 33 enforced, 13 partial, 9
unenforced (the external review had said 8) — real work, left open rather than rushed.

Verified at the time: build 0, check 0, 681 unit tests, 903 of 906 Playwright (the 3 failing were
a firefox contention flake, fixed in the same commit), 16/16 mutation families, thirteen cheap
gates 0, budgets 0, 37 skills clean, `gate:docs` 151 files 0 findings, `gate:plan` 0 findings.

## Round 2 — second external audit (`6a0c9c2`, 2026-09-23)

A second external audit made 41 claims; six read-only agents re-derived every one against the real
code and the real build, and 36 reproduced. The important ones were not doc drift — they were
guards that had never been able to fail, in a tree whose whole method is that a guard must be
provably able to fail:

- `checkFontPolicy` parsed fontsource-style filenames while Astro emits content-hashed ones, so it
  returned 0 families and 0 faces against every real build and its `<=3/<=4` assertion passed over
  nothing — the committed artefact printed `"pass | 0 families, 0 faces"`, stating its own
  vacuity. Now parses real `@font-face` blocks: 2 families, 3 faces.
- `docDriftFindings` compared only route-cell lines, so the 20 generated non-table lines could
  drift silently. Mutating every heading gave 0 findings before the fix, 1 after.
- `search-budget` never checked the shard count: 1 of 7 shards exited 0 and nobody noticed.
- `generate-gaps` silently dropped a declared GAP row the allowlist did not recognise, publishing
  9 of 10 with no sign of loss.
- The JSON-LD property floor only applied to types a route declares, so the `WebPage` companion
  node on 45 routes had no floor at all. Scoped to nodes a page actually owns, it found 7 pages
  emitting no `dateModified` (see `known-gaps.md` G12, and `0fce63f` below).
- `gate:editorial` wrote into `audits/` while running as a CI gate.
- `plan-gate`'s `localOnlyGates` check was bare truthiness — `true`, `1` and `" "` all excused a
  gate. Only a non-empty trimmed string does now.
- `gateNames` read only `gate:*` scripts, which is exactly how the broken font guard escaped: it
  lived under `audit:prelaunch`, which runs in no CI job. The rule now covers every script whose
  output is committed under `audits/`.
- The four plan-gate rules round 1 added had no planted specimen proving they could fail. They
  have one now, and the mutation tally no longer counts the synthetic baseline row as a family or
  a `--fast` skip as a pass.

The round-1 dispute was resolved against round 1: `report.mjs:96` really does read
`gate.overBudget`, which `gate.mjs` had never written, so the byte-budget assertion in every
`audits/phase-N/REPORT.md` had always iterated an empty array beside a hardcoded sentence that
never read `budgets.json`. Fixed; Lighthouse metric budgets were unaffected throughout.

Also fixed: `gate:docs` ran in a job with no build and two tracked documents legitimately cite
`dist/gate-routes.json` — a clean export with no `dist/` exited 1. The citation is now verified
when the build is present and skipped when it is absent. Widening `gate:docs` to every tracked
file had also pulled in 69 article entries, so article prose is now excluded from it (still
covered by `gate:content` and `gate:editorial`, as before). Dead weight removed per L40: a 332 KB
unreferenced image, 34 lines of `ClientRouter` machinery AGENTS.md forbids, an unused `Newsletter`
interface, a no-op `replace`; `relatedResources` was authored in 3 of 4 posts and discarded by the
template, and now renders. `/404` was invisible to the shrink gate (it counted only `index.html`);
`html-validate` gained a declared ruleset. `docs/plan/reference/known-gaps.md` (G1–G12) is new in
this round: an accepted gap now carries a written reason instead of reading like an oversight.

Verified: build 0, check 0, 710 unit tests, 16/16 mutation families, thirteen cheap gates 0, byte
budgets 0, 906 Playwright across chromium, webkit and gecko, editorial ledger 0 stale and 0
unreviewed.

**Follow-up, same round (`0fce63f`, 2026-09-23):** the fix above is what made G12 (the
`dateModified` on `/security`, `/approach` and `/imprint`) unrepeatable in the first place — this
commit's own file touches moved `git log -1`'s answer for those three files to 2026-09-23, so the
derivation the G12 row describes cannot be re-run the same way twice. Declared, not silently
absorbed.

## Round 3 — third external audit (in progress, this session)

A third external audit ran the harness rather than reading it and found 13 defects plus 2 stale
numbers. Concurrent tasks are closing them; this file is one of the fixes (the plan tree itself
was defect 13). Facts established so far, not yet all landed as of this file's own commit:

- `check-skills.mjs`'s `GENERATED_PREFIXES` lists `dist/` but not `site/dist/`, so a clean
  `git archive` with no build fails with two `missing-path` findings `docs-gate.mjs` already
  guards against — the same fix `685d40c` gave `docs-gate.mjs` was never carried to this script.
- The docs gate's file count is reported as 83 in at least one place that should read 84.
- `known-gaps.md` G9 reports 53 unlinked concept uses; `gate:registers` on the current tree prints
  57 — a second stale number.
- A planted brand literal in a module leaves 708/710 unit tests green and ESLint exit 0: there is
  still no check for a typed brand literal anywhere, three phases after `685d40c` consolidated the
  known instances into `brand.mjs`. Brand-literal count has moved 650 → 643 → 648 across three
  revisions with nothing tracking the trend.
- `npm run assets:gaps` throws on the real document. This was a deliberate change from a silent
  drop to a loud error (see G11); the generator is correspondingly unusable until the owner
  resolves the phrasing mismatch G11 names.

## Feature work shipped in this window

Two owner-facing features landed alongside the audit fixes and were never given a phase-file row
either, though neither is an audit response:

- **Outbound link policy, `a8ef430` (2026-09-16).** Owner requirement, locked as **L55**. 443
  outbound anchors across the site were inconsistent — 105 LinkedIn and 105 GitHub links carried
  no `rel` at all, some carried `nofollow noopener` but not `noreferrer`. `externalRelAttrs(href)`
  in `src/utils/pipeline.mjs` is now the one source of the rel tokens, applied by the
  `rehypeExternalLinks` pass for markdown bodies and spread by components for everything else.
  `npm run gate:external` fails an outbound link missing a token and an internal link wrongly
  carrying `nofollow` (which had actually happened once, caught by `gate:orphans` reporting three
  orphaned routes). `/now` gained the two links the owner asked for under the same locked row.
- **GEO measurement and citable-answer marking, `0534b44` and `3e436cd` (2026-09-16).**
  `npm run audit:geo-probe` sends all 30 buyer prompts to four live engines with retrieval on
  (OpenAI, Claude, Gemini, Perplexity via OpenRouter) and records cited/mentioned/absent per
  answer — first run: 120 answers, 0 cited, 0 mentioned, 120 absent, the expected zero while the
  site is still `noindex`. `/now` became a dated log fed by Apple's lookup API rather than memory.
  Separately, every page's h1-section lead and hero subtitle are now marked as the page's citable
  answer unit by construction (`Section`/`Hero`, no per-page opt-in), which is what raised
  Phase 5's "Buyer-prompt structural readiness" line from 12/30 to 26/30 — a number this file's
  own phase-5 neighbour carries, landed by `6a0c9c2` a week after the commit that actually earned
  it, with no line describing the mechanism until now.

## Machine check considered, not implemented

The brief for this file asked whether `gate:plan` should fail when `HEAD` sits more than N commits
past the newest phase-file change, so this class of drift trips a gate instead of waiting for a
fourth external audit. Two things rule it out as currently buildable:

1. **It cannot detect the actual defect.** In this repository's real history, a phase-status
   commit habitually carries a one-line companion edit to `INDEX.md` (the L-count in the reference
   table bumps almost every time `locked-decisions.md` gains a row — see the `685d40c` and
   `a8ef430` diffs above, each exactly one line). A "commits since any file under `docs/plan/` was
   touched" counter never climbs past single digits in this history, even though the narrative
   documentation lagged 26 commits and three audit rounds. A gate that resets on a trivial
   companion bump is the same shape of problem this whole audit exists to fix: a check that looks
   green without being able to fail on the thing it claims to guard.
2. **The signal narrow enough to mean something was, at the time, unreachable where the gate
   runs.** Anchoring instead to the last _rename_ in `docs/plan/phases/` (git detects both
   `15ba58e` and `82740c2` as renames, at 96% and 100% similarity — a real, hard-to-game signal)
   would correctly reproduce the 26-commit, 2026-09-15 fact this file opens with. `gate:plan` runs
   in CI's `types-and-units` job, which took the default shallow clone, so the `git log` such a
   count needs could not see the history. That half is now resolved: `types-and-units` requests
   `fetch-depth: 0`. Reason 1 stands on its own, and it is the one that decides this.

Recorded as `known-gaps.md` G14 rather than built. Building a gate that cannot fail on the failure
it claims to catch would be the exact fake-green pattern this repository's own audits keep
finding.

## Not in this phase

No launch checklist item — those stay in Phase 5. No new locked row beyond L55 (already recorded
in `locked-decisions.md`). No fix to the round-3 findings this file does not itself own — those
land in their own commits, from the tasks named above.
