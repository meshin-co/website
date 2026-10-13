# Add a Guard Family to Mutation Smoke

Every guard (zod refinement, gate script, pure check) must be proven able to fail before it is
trusted. `scripts/mutation-smoke.mjs` is that proof: it plants a violating specimen in a
disposable repo copy, runs the real pipeline, and asserts the guard died naming the right field.
Add a family here whenever a new guard ships; a guard with no entry is unproven.

## The kinds

`FAMILIES` entries declare a `kind`; each kind has its own required fields and executor. `proves` names
what the family is evidence for: `build`, or the `gate:*` script that the family exercises.

| kind              | required fields                                | proves                                                                                       |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `build`           | `proves`, `fixture`, `plant`, `tokens`         | a zod refinement fails `npm run build`                                                       |
| `build-then-gate` | `proves`, `fixture`, `plant`, `tokens`, `gate` | the specimen builds clean, then a named gate (`budget`, `jsonld`, `content-gate`) catches it |
| `gate`            | `proves`, `gate`, `tokens`                     | a gate fails against a synthetic bad `dist`, no build needed                                 |
| `pure`            | `proves`, `check`                              | a named pure function (`semantic-title`) rejects a bad input and accepts a good one          |
| `pagination`      | `proves`, `fixture`                            | pagination behavior at a real 13th live post                                                 |
| `specimen`        | `specimen`                                     | the real `gate:*` npm script is green on the copy, red on the planted specimen, green again  |

A `pagination` family takes an optional `scope` (`category` or `tag`; none builds the blog hub), and
`manifestFamilies()` throws on any other value. The tag family's head, control and sitemap checks are
pure functions in `scripts/pagination-markup.mjs`, so its test plants each defect without a build.

A `specimen` family names an entry in `SPECIMENS` (`scripts/mutation-specimens.mjs`, which spreads in the entries of
`scripts/spec-specimens.mjs` and `scripts/evidence-specimens.mjs`). Each entry holds the gate, the output token that
proves the right rule fired, and a `plant(copySite)` that makes the change and returns its own undo.
`proveWithSpecimen()` runs the npm command CI runs and requires four things: the gate is green on the pristine copy,
the pristine output does not already contain the token, the planted run is red, and the planted output contains the
token. The undo runs in a `finally`. An entry may also carry `env` (variables for the npm run) and `args` (passed to
the tool after `--`). Prefer this kind for any new gate: it runs the command CI runs, not a function beside it.

There is no kind that runs nothing. A `unit-covered` kind used to return a pass without executing
anything, so a family that could not fail was counted as proven; it was removed.

`manifestFamilies()` throws at collection time on an unknown `kind`, a missing required field, an
unknown `gate` (`budget`, `jsonld`, `content-gate`), an unknown `check` (`semantic-title`) or an
unknown `specimen` — a malformed entry fails loud, never silently skips.

## Every gate is covered, or owed

`mutation-smoke.test.mjs` fails when a `gate:*` script in `package.json` is proven by no family and is
not in `scripts/mutation-pending.mjs`. A pending entry names the phase that owes the specimen and says
why, and `gate:plan` fails when that phase does not exist, is already done, or the reason is blank.
Pending is a dated debt, never a waiver. The same test fails the other way too: an entry for a gate
that now has a family, or for a script that no longer exists, is stale and must be deleted.

## Plant-and-restore contract

`build` and `build-then-gate` families copy `tests/guard-mutations/fixtures/<fixture>` into
`entry.plant` inside the disposable copy, run the pipeline, and `rm` the planted file in a
`finally` block whether the run passed or threw. The specimen never survives past its own
family; the next family always starts from the pristine baseline copy. `specimen` families restore
`dist` from a snapshot of the baseline build before they run, so an earlier family's failed build cannot
poison them, and the copy keeps its `.git` because `gate:docs`, `gate:machine` and the plant helper
need it.

## Proving RED

1. Write the guard (zod refinement, gate check, or pure function).
2. For a build guard, add a `tests/guard-mutations/fixtures/<name>.md` (or reuse an existing fixture)
   that violates only the new rule. For a `gate:*` script, add an entry to `SPECIMENS` instead.
3. Add a `FAMILIES` entry with the right `kind` and the exact failure-message token(s) the guard
   prints — `expectedFailure()` fails the family if the guard's output does not contain every
   token, or if the guard exited zero.
4. Run `npm run test:smoke` (or `--fast` to skip the slow families that need a full build or a
   browser). Confirm the new family is the only one that changes when you delete the guard: that is
   proof it is load-bearing, not a decoration.

## Trap

A family whose `tokens` are too generic (e.g. a bare error class name) still passes when the
guard's failure reason changes underneath it. Token(s) should be the specific field or phrase a
human would grep for in the real failure output.

Two environment limits fail loud, never pass. A specimen that starts a server binds a fixed port
(`gate:visual` 4322, `gate:lh:one` 4330), so a dev server already on it turns the family red. And the
copy refuses to run from a git worktree: its `.git` is a link to the original repository, so
`git add` in the copy would stage into the original. Run from a clone.
