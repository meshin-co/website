# Make the engine extractable, and prove a copy of it works

## Why

The owner will start other websites and wants to copy the engine, not rebuild it. Three verbs
follow: extract, adopt, interview. Change 20 made the site-specific values configurable and added
`npm run gate:engine`. Three things still stop a copy.

- Nothing says which tracked file is the engine and which belongs to this site. The adoption skill
  says how to configure an engine that has already been copied.
- No one has copied the engine into an empty repository and run the gates there. Until that happens,
  portable is an opinion.
- The questions only the owner can answer live in finished documents, not in a set of questions.

Measured on 2026-11-02 with the partition this change adds (`node scripts/run-partition-gate.mjs`):
1,618 tracked files, of which 835 are engine, 129 are site, 652 are evidence and 2 fit no rule. The
same run finds 37 engine files that name the brand, the host or the author of this site, and 9
anchor files that the engine expects and that nothing ships, seeds or measures. A copy made today
would carry the name of this site into the next one, and `gate:engine` would fail on arrival.

The run also shows a third kind of drift that no rule names yet: about 57 site or evidence paths are
cited by engine skills, so `gate:skills` would report each as `missing-path` in a new repository.

## What changes

**The partition (delivered).** Every tracked file is engine, site or evidence. The class comes from
an ordered list of rules that read properties a file has: where it lives, whether a script reads it,
whether it names a collection entry, whether a generator writes it, whether the engine ships a seed
for it. No rule reads a list of paths. A file that fits no rule is a finding, never a default. An
engine file that names the brand, the host or the author of the site is a finding. An anchor file
that nothing ships, seeds or measures is a finding.

**The adoption skill (delivered).** `extract-the-engine-from-a-site.md` says how a file gets its
class, what each finding asks of the person who sees it, and what does not transfer: the Cloudflare
account and project, the domain, the Search Console property and its service account, anything
priced per vendor, the budgets measured on this site's pages, every measured record, and the locked
decisions L1 to L67.

**The export (delivered).** `npm run export:engine -- <empty directory>` writes every engine file and 27
seeds at their target paths, with `engine-export.json`. A copy of it was installed, built and run through the
gates for an invented second site, `field-notes.example`: `npm test` passes there (5167 tests, 182 failed
before this pass) and so does every gate except the three that measure the owner's own work, `gate:demand`,
`gate:evidence` and `gate:editorial`. `npm run gate:export` repeats the build on demand.

**The interview (delivered).** `docs/plan/reference/new-site-interview.md` holds 97 questions in the order they
are needed, each with its options, a recommendation, where the answer lands and what breaks when it is wrong.
`interview-the-owner-of-a-new-site.md` is the procedure. `gate:engine` fails when the bank does not name a
config value, a workflow secret or variable, or a variable of `.env.example`.

**Still open.** 27 engine files still name this site (`gate:partition` allows up to 27 of them, prints each,
and fails on a 28th), engine markup and data carry this site's words without naming it, and the Calibration
Gate was not run. `tasks.md` lists each with its state, and section 6 lists what adopting found and did not fix.

## Measured records never travel

The sentence band, the body-length floor and the demand report describe one corpus and one property. The
engine already refuses to use another site's numbers: `bandFor` and `lengthFor` throw when
`audits/sentence-band.json` or `audits/entry-length.json` is absent, and `gate:autowriter` reports
`record-corpus-stale` for a record whose corpus differs from the tree.
This change keeps that behaviour and adds the rule that no record under `audits/` is ever exported.

## Impact

- New: the partition modules and their tests, `scripts/export-engine.mjs`, `scripts/check-export.mjs`,
  `scripts/partition-specimens.mjs`, `scripts/engine-named-paths.mjs`, `scripts/interview-coverage.mjs`,
  `src/utils/page-exists.mjs`, 27 seeds under `seed/`, `site/src/data/static-pages.mjs`, and the skills
  `extract-the-engine-from-a-site.md` and `interview-the-owner-of-a-new-site.md`.
- New: `docs/plan/reference/new-site-interview.md`, 97 questions in the order they are needed.
- Changed: `machine-text.mjs` no longer holds the page catalogue; the three asset generators create their own
  output directories; `ci.yml` runs `gate:partition`; `check-engine.mjs` checks the interview;
  `check-skills.mjs` and `run-docs-gate.mjs` accept a cited path that an engine script names; the writer prompt
  reader accepts an empty list of numbers; `external-links`, `geo-probe`, `pr-github`, `escalate-channels` and the
  search index page read the host, the author and the agent name from the tree; the post page, the search page
  and the services and faq feeds no longer assume pages or collections a copy lacks; about 50 tests were split
  or made generic, and 8 `*.site.test.mjs` files keep what pins this site.
