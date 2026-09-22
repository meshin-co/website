# Keep the Harness Honest

A gate that never runs reads exactly like a gate that passes. So does a document that names a
command nobody defined. This project found four of the first and two of the second in one review,
and L56 now makes the harness check its own wiring.

`npm run gate:plan` fails on five things beyond the phase tree:

- **gate-not-in-ci** — a `gate:*` script in `package.json` that `ci.yml` never runs. This is L36
  ("a gate not in `ci.yml` is not a gate") made mechanical instead of asserted.
- **gate-undefined** — `scripts/README.md` names a gate `package.json` does not define.
- **browser-not-installed** — `playwright.config.ts` runs a project whose browser `ci.yml` never
  installs. The suite would die on the first CI run, long after the change that caused it.
- **stale-gate-declaration** — `localOnlyGates` names a gate that no longer exists.
- the phase-status rules that were always there.

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
outside reviewer to find it. The gate now reads every tracked Markdown file, 151 of them,
excluding only `audits/`, which is generated evidence and historical by design. It falls back to a
filesystem walk when git is unavailable, because the mutation smoke runs it in a synthesized tree
that is not a repository.

## What this cannot catch

Whether a gate's assertion is _meaningful_. `gate:plan` proves a gate runs; only a planted
specimen in `test:smoke` proves it can fail. Both are required, and one without the other is
theatre.

Related: `run-the-gate.md` for the gate list, `keep-the-docs-honest.md` for the document rules,
`extend-mutation-smoke.md` for proving a new gate can fail.
