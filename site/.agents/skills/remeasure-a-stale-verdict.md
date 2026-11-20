# Re-measure a Stale Verdict

A repair that gives up escalates the pull request, and the escalation used to say only that it gave up. The ledger held
no cause, so a stop for a reason that a later `main` removed looked the same as a stop for a reason that stands. This
is how the ledger now says why, and how a stale verdict is proved without a model.

## What a repair that gives up writes

The repair prints one JSON line. `.github/workflows/watch-pr.yml` keeps the whole line and passes it as
`--after-repair '<line>'`; a bare outcome word is a usage error. `scripts/pr-watch-arguments.mjs` parses the arguments,
`scripts/pr-watch-report.mjs` keeps the outcome and only the fields it knows, and `repairFinding` writes them on the
escalation it files, next to a `Stop:` line in its detail. All are optional, so a ledger from before them stays valid.

- `stop`: `no-artifact` (the CI run left no findings file), `no-findings` (the file held none), `refused` (the judge
  refused a finding), `build-broke` (the rewrite broke the build) or `scope` (the rewrite left its scope).
  `scripts/repair-why.mjs` names them and raises them at the stop.
- `gate`, `rule` and `subject`: what the finding named. Only `refused` knows the rule and the subject.
- `ciRun`: the CI run the verdict judged.
- `measuredMain`: the `main` commit that run measured. `scripts/repair-judged-run.mjs` reads it from the merge commit
  the run checked out, whose first parent is `main`; it reads the one failed `npm run gate:` step for `gate`. It writes
  what it can read and nothing else: two failed gates, or a run whose logs have expired, give no `gate` and no
  `measuredMain`, and such a stop is never re-measured.

`build-broke` and `scope` say what the rewrite did, not what `main` held. They read nothing about the run and are never
stale.

## When a verdict is stale

`resumeDecision` compares `main` with `measuredMain`, never the clock: a new article on `main` is not evidence that a
cause is gone. `scripts/pr-resume-stale.mjs` calls a verdict stale when the stop is one of the first three, `gate` and
`measuredMain` are recorded, and `main` is no longer that commit. The sweep then asks for a re-measure and does not
resume.

## The re-measure

`scripts/pr-remeasure.mjs` writes a `remeasures` entry as `requested` before it dispatches
`.github/workflows/remeasure-pr.yml`, so a second sweep cannot start a second run. The workflow catches the branch up
(`scripts/catch-up-entry.mjs`), builds it, runs `npm run <gate>` for the one recorded gate and reads its exit status.
It calls no model and pushes nothing. `scripts/remeasure-record.mjs` (`npm run remeasure:record`) then writes the result:

- The gate **passes**: `clear`. The verdict was stale. `verdictInForce` reads a `clear` entry like a resume, and the
  watcher starts.
- The gate **fails**: `reproduced`. The verdict stands; the escalation issue says so and a person takes it.

A pull request gets one re-measure. The entry is `at`, `gate`, `measuredMain`, `mainSha` and `result`
(`requested`, `clear` or `reproduced`). It is a counter of its own, outside `RESUME_CAP`, which counts `resumes`. A
second stale verdict is left as `remeasure-spent`, as is a run that died before it reported, and the owner reads it.
`jq .remeasures audits/autowriter/<year>/<month>/<slug>.json` reads them. Never edit `resumes` or `remeasures` by hand.

The owner's dispatch of `resume-pr.yml` gets `cap-reached` after both resumes are spent, unless the verdict is stale:
then it resumes, because the cap was spent on a cause that is gone. `scripts/pr-resume-issues.mjs` and
`scripts/pr-resume-steps.mjs` hold what the sweep and the re-measure share.

## What it costs

One runner: a checkout, `npm ci`, the catch-up, one build and one gate. In run 44671747275 the install took 33 s, the
build 12 s and `gate:orphans` under 1 s; the catch-up was not timed on a runner. It is not the `cheap-gates` job again,
which installs a second time and runs every print-only gate, and it is not the visual shards.

## The print-only gates

Nine gates print their findings and write no findings file, so a repair of one stops with `no-artifact` and there is no
rule and no subject to record. The stop still records the `gate` the failing CI step named, `ciRun` and `measuredMain`,
and the re-measure runs that gate by name. It can say the verdict was stale; it cannot say which rule it was about, and
it does not make such a gate repairable. That stays open as G107, with the limit recorded as G109, in
`docs/plan/reference/known-gaps.md`.
