# Add a Guard Family to Mutation Smoke

Every guard (zod refinement, gate script, pure check) must be proven able to fail before it is
trusted. `scripts/mutation-smoke.mjs` is that proof: it plants a violating specimen in a
disposable repo copy, runs the real pipeline, and asserts the guard died naming the right field.
Add a family here whenever a new guard ships; a guard with no entry is unproven.

## The six kinds

`FAMILIES` entries declare a `kind`; each kind has its own required fields and executor:

| kind              | required fields                      | proves                                                                                       |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `build`           | `fixture`, `plant`, `tokens`         | a zod refinement fails `npm run build`                                                       |
| `build-then-gate` | `fixture`, `plant`, `tokens`, `gate` | the specimen builds clean, then a named gate (`budget`, `jsonld`, `content-gate`) catches it |
| `gate`            | `gate`, `tokens`                     | a gate fails against a synthetic bad `dist`, no build needed                                 |
| `pure`            | `check`                              | a named pure function (`semantic-title`) rejects a bad input and accepts a good one          |
| `pagination`      | `fixture`                            | pagination behavior at a real 13th live post                                                 |
| `unit-covered`    | none                                 | the guard is already mutation-proven by a `node --test` file; no repo-copy run               |

`manifestFamilies()` throws at collection time on an unknown `kind`, a missing required field, an
unknown `gate` (`budget`, `jsonld`, `content-gate`), or an unknown `check` (`semantic-title`) — a
malformed entry fails loud, never silently skips.

## Plant-and-restore contract

`build` and `build-then-gate` families copy `tests/guard-mutations/fixtures/<fixture>` into
`entry.plant` inside the disposable copy, run the pipeline, and `rm` the planted file in a
`finally` block whether the run passed or threw. The specimen never survives past its own
family; the next family always starts from the pristine baseline copy.

## Proving RED

1. Write the guard (zod refinement, gate check, or pure function).
2. Add a `tests/guard-mutations/fixtures/<name>.md` (or reuse an existing fixture) that violates
   only the new rule.
3. Add a `FAMILIES` entry with the right `kind` and the exact failure-message token(s) the guard
   prints — `expectedFailure()` fails the family if the guard's output does not contain every
   token, or if the guard exited zero.
4. Run `npm run test:smoke` (or `--fast` to skip the slow `pagination` family). Confirm the new
   family is the only one that changes when you delete the guard: that is proof it is load-bearing,
   not a decoration.

## Trap

A family whose `tokens` are too generic (e.g. a bare error class name) still passes when the
guard's failure reason changes underneath it. Token(s) should be the specific field or phrase a
human would grep for in the real failure output.
