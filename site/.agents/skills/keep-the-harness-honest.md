# Keep the Harness Honest

A gate that never runs reads exactly like a gate that passes. So does a document that names a
command nobody defined. This project found four of the first and two of the second in one review,
and L56 now makes the harness check its own wiring.

`npm run gate:plan` fails on five wiring faults:

- **gate-not-in-ci** — a `gate:*` script in `package.json` that `ci.yml` never runs. This is L36
  ("a gate not in `ci.yml` is not a gate") made mechanical instead of asserted. Only `ci.yml`
  counts: a gate named in `deploy.yml`, which a person dispatches by hand, is not run on every
  change, and reading both files would let it pass as if it were.
- **gate-undefined** — `scripts/README.md` names a gate `package.json` does not define.
- **browser-not-installed** — `playwright.config.ts` runs a project whose browser `ci.yml` never
  installs. The suite would die on the first CI run, long after the change that caused it.
- **stale-gate-declaration** — `localOnlyGates` names a gate that no longer exists.
- **unwaivable-gate-declared-local-only** — `localOnlyGates` names a harness-integrity gate, such as `gate:docs`.

## The only way out of CI

`package.json` → `localOnlyGates`, a gate name mapped to a reason:

```json
"localOnlyGates": {
  "gate:lh": "the CI lighthouse matrix runs gate:lh:one per form factor and route shard"
}
```

An entry with an empty reason does not excuse the gate. The declaration is the audit trail: a
reader can see what is not in CI and why, instead of discovering it during an incident.

## Why the docs gate reads everything

It used to read `AGENTS.md`, `docs/` and `.agents/skills/` — 66 files. `scripts/README.md` sat
outside that set and cited `gate:search`, a command that did not exist, for as long as it took an
outside reviewer to find it. The gate now reads every tracked Markdown file, excluding `audits/`
(generated evidence, historical by design), `site/dist/` (build output) and `site/src/data/`
(content entries, not documentation prose). The count changes with every file anyone adds or
removes, so this document does not pin one — `git ls-files '*.md'` against
`scripts/docs-gate.mjs`'s `IGNORED_ROOTS` gets the current figure. It falls back to a filesystem
walk when git is unavailable, because the mutation smoke runs it in a synthesized tree that is
not a repository.

## Four properties, not one

A gate has four independent properties, and this project has shipped three of four while
publishing a false result:

1. **It exists.** `gate:search` was cited in two documents and defined nowhere.
2. **It is wired.** `gate:editorial` and `gate:registers` were defined and ran in no CI job.
3. **It can fail.** `checkFontPolicy` parsed a filename shape the build stopped emitting and
   returned `0 families, 0 faces` for months, passing every time.
4. **Its artefact is fresh.** Eight phase reports under `audits/` printed `Result: PASS` computed
   from an assertion array nothing wrote.

`gate:plan` covers 1 and 2. `npm run test:smoke` covers 3. `npm run gate:evidence` covers 4, via
`scripts/evidence-gate.mjs` and `scripts/run-evidence-gate.mjs`: every Markdown file under
`audits/` must carry a `Generated-from:` line whose first word is a commit hash — 7 to 40 lowercase
hex digits that `git cat-file -t` calls a `commit` — by path, whether or not the file says it is
generated. A file that decides for itself whether it counts as evidence can leave itself out. A
generator writes the line from `generatorRevision()`, which throws, naming the file it was
stamping, when git cannot name the revision; `scripts/report.mjs` also stamps `Asserted:` so a
report cannot claim a family it never ran. A record no script regenerates carries the commit its
content describes and says that nothing regenerates it. The one exemption is
`LEGACY_PROSE_PROVENANCE`: the 8 Calibration Gate reports of phases 1 to 5, written before any
generator stamped a revision. They may keep prose in place of a hash, but they still need the line,
and a hash on them must still name a commit. A unit test pins the 8 keys, and the gate prints them.

## What this cannot catch

Whether a gate's assertion is _meaningful_. `gate:plan` proves a gate runs; only a planted
specimen in `test:smoke` proves it can fail. Both are required, and one without the other is
theatre. Likewise `gate:evidence` proves the named commit exists, not that the content was
generated from it: any commit in the repository passes. Ancestry is not checked, because the
2026-09-15 rewrite changed every earlier hash and an ancestry rule would fail on honest history. A
clone without full history cannot resolve the hashes, so the gate fails there: run it on a full
clone (`fetch-depth: 0`).

Related: `run-the-gate.md` for the gate list, `keep-the-docs-honest.md` for the document rules,
`extend-mutation-smoke.md` for proving a new gate can fail.
