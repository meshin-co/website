# Judge a Mutation Smoke Run

`npm run test:smoke` (`scripts/mutation-smoke.mjs`) proves that a guard can fail. This skill says what counts as that proof, what a
control is and how to read the run. `extend-mutation-smoke.md` says how to add a family.

## What a refusal must show

A `gate`, `build-then-gate` or `build` family meets the four requirements `proveWithSpecimen()` holds: the guard is green on compliant
input, the compliant output does not already hold a token, the planted run is red, and the planted output holds every token. A guard that is
red on every input fails the first, so a broken guard cannot pass as a refusal.

| kind              | compliant input                                                                                                                                                                                            | planted run                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `gate`            | the real command on the pristine `dist`: `node scripts/gate.mjs dist budgets.json`, `node scripts/run-docs-gate.mjs ..`, `node scripts/run-external-links.mjs dist` or `node scripts/jsonld-gate.mjs dist` | the same command on a synthetic bad input   |
| `build-then-gate` | `node scripts/content-gate.mjs dist` on the pristine `dist`                                                                                                                                                | plant the fixture, build, then run the gate |
| `build`           | the baseline build, whose output holds none of the tokens, and the compliant twin                                                                                                                          | plant the fixture, build                    |

Each `gate` command, its arguments and its synthetic input sit in one row of the `GATE_RUNS` table in `scripts/mutation-smoke.mjs`, so a new
gate adds a row, not a branch.

## Controls

`control` is a list of files in `tests/guard-mutations/fixtures/`: the family's `fixture` with the violation repaired and nothing else
changed, named `<fixture without .md>-control.md`. `manifestFamilies()` throws `family <id> (<kind>) is missing control` for a `build` or
`build-then-gate` family without one. A `fixture` may be a list: `spec-address-duplicated` plants two entries at the synthetic address
`zz-specimen/1.0`, which no site content holds, so the family also runs in an exported engine, and its control is two entries of one series
at different versions.

A control must be valid in its collection. Plant every control in a scratch copy under `/tmp` and run `npx astro sync`: it must exit 0.
Plant one violating fixture instead: sync must refuse it with the family's token. Sync does not render pages, so check a `build-then-gate`
control with a build and the real gate.

## The rows and the exit code

The run prints one row per family and two more:

- `baseline-green-copy`: the pristine copy builds.
- `compliant-twins-green`: the controls of every `build` and `build-then-gate` family are planted together, one build is green, and none
  of the tokens is in its output. A build that is red on every input that holds the trigger fails this row even when the baseline is green.

Neither row counts as a proven family. A failed row fails the run and counts in `FAILED`; when the baseline build is red no family runs and the
exit code is still 1. The exit code is 1 when any row failed, 2 when none failed and a family was skipped (`--fast`), and 0 otherwise.
`.githooks/pre-push` reads only that code.
