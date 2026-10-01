---
record: true
---

# 01 — What meshin.co absorbed from smarter.day v2, 2026-10-01

Dated 2026-10-01. Audits `smarter.day/website-v2` as it stood on 2026-10-01, against meshin.co at
`a96c323`, the commit the fork copied. This is a record, not an instruction: it describes another
repository at a moment in time, and the paths it names outside this tree are not expected to resolve
here.

## Why this record exists

`smarter.day/website-v2` was forked from this repository, kept the engineering, and replaced the
brand, the content and the purpose. While doing that it audited what it inherited. The owner asked
for the reverse trip: find everything in the fork worth bringing home, decide what fits a
single-practitioner consulting site, and take it.

Six read-only investigators mapped the donor in parallel: harness and gates, methodology and
skills, the SEO and GEO layer, content and editorial machinery, design and performance, and the
investigation corpus itself.

## The shape of the fork

The fork is not a pile of new skills. Both repositories define 45 npm scripts and share 42 of
them. One skill is donor-only, `deploy-to-workers`, and it exists because they moved to Cloudflare
Workers; this site stays on Pages. Three skills are ours alone — the GEO probe cluster, which the
fork deleted by owner decision rather than for quality.

The value sits in two places: **67 of the 91 shared scripts differ**, and **30 script files are
new**. Almost all of it serves one idea — making a guard actually able to fail, and making an
artefact unable to read greener than the gate that produced it.

## What the fork found in us

Nine findings were real and still open here. Each was reproduced before it was fixed, and all nine
landed in `712a471`.

| What                                                                     | Measured                                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| JSON-LD shipping inside the search index                                 | 14 of 33 page entries began with `{"@context":"https://schema.org"`; searching "schema" returned 14 false hits |
| `npm test` needed a build                                                | clean checkout: 750 pass, 1 fail — a unit test reading `dist/index.html`                                       |
| Cloudflare Pages 308 on every directory page                             | 103 of 105 canonical URLs; the local gate server served both forms 200 and hid it                              |
| `gate:evidence` let the checked file grant its own exemption             | 11 unstamped artefacts, including a report still publishing `0 families, 0 faces`                              |
| Fonts charged to no budget                                               | a 120 KB hard rule in `AGENTS.md` enforced nowhere                                                             |
| A register row citing a gitignored, never-existing file                  | G13                                                                                                            |
| A register row naming the wrong CI job                                   | G14; with the right job its blocker is one `fetch-depth` line                                                  |
| Target queries claimed by two routes each                                | 2 fixed, 5 are archive-versus-definition and need a content decision                                           |
| Orphaned baselines, no preview-host noindex, a Node pin against `.nvmrc` | 16 PNGs, `*.pages.dev`, Node 24 vs 22                                                                          |

## What the absorption itself found

Fixing the findings was not the end of them. While porting the record marker, the docs gate was
run against a clean export of `712a471` — the commit that had just closed the nine findings — and
it was **red**: `docs: 85 files checked, 1 findings`, `dead-path docs/plan/reference/known-gaps.md:
audits/phase-local/routes.json`. The row that the fork's fourth round had flagged was reworded in
that commit but still cited a gitignored path in backticks, so the gate read green on a developer's
machine, where `gate:routes` had written the file, and red anywhere the file does not exist.

That is the same defect class as everything above, one level up: the check that proves our
documents honest was itself only honest on a dirty tree. The row no longer names the path, and a
new rule fails any citation that exists on disk while `git check-ignore` matches it, skipping
silently where git is unavailable. A defect that recurs after being fixed in prose gets a machine
check, not a second rewording.

## What was taken

Highest payoff first.

1. **The specimen registry.** A `SPECIMENS` map and one executor: run the real gate on a pristine
   copy and require green, plant a defect, require red _naming a token_, restore. It replaces
   bespoke per-family code and answers the question our harness could not: which gate has no
   specimen?
2. **Dated debt.** A gate with no specimen names the phase that will add one, and the plan gate
   fails when that phase is missing or already done. An open-ended register row has no deadline;
   this does.
3. **The script and style strip** in the page-text extractor, which fixed the search index.
4. **Provenance by path.** Every artefact under a phase directory must name the revision it came
   from, whether or not it admits to being generated.
5. **Fonts as a measured budget key**, with a failure when the measurement is suspiciously zero.
6. **Lighthouse without the self-waiver**: a named list of by-design noindex routes instead of
   letting a page waive its own SEO category, and a report that fails a route with no run.
7. **The `record: true` marker**, which is why this file can live here.
8. **Host-scoped preview noindex**, a committed route baseline with a blank-reason rejection, and
   git-aware file scanning.

## What was refused, and why

- **Locale and RTL machinery, the screenshot pipeline, per-locale search shards.** This site is
  English only (L54) and has no app to photograph.
- **The glossary mention-index cache.** It exists for a 177-term quadratic ceiling. We have no
  such corpus.
- **`deploy-to-workers` and the redirects gate.** We are on Pages with no legacy URL map.
- **The keywords gate.** Its one unique catch — a declared keyword absent from a dated Search
  Console export — needs data this site cannot have before launch. Revisit afterwards.
- **Their semantic core.** It is ours, debranded and reduced: 8 families and 89 rows against our
  10 and 102.
- **Their JSON-LD gate.** Byte-identical to our widened version. Nothing to take.

## The limit of this record

The fork's own harness carries the hole it taught us to look for: its mutation smoke declares
families proving `gate:human` and `gate:keywords`, and neither npm script exists in its
`package.json` or its CI. The readability gate was adopted here with the wiring it lacked there.

A gate has four properties — it exists, it is wired, it can provably fail, and its artefact is
fresh. Three rounds of external audit each found a different one missing. This record is the
fourth round, run in the opposite direction.
