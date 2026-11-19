# Keep Every Pull Request Moving

A pull request the loop means to judge can fall out of sight with nothing failing: its watcher chain ended and nothing
started another, or its repair job died and the escalation was final. The sweep (`.github/workflows/resume-pr.yml`,
`scripts/pr-resume.mjs`) starts a watcher for each such pull request and resumes a failed repair once.
`resume-an-escalated-pull-request.md` has the rest of the sweep.

## When a pull request gets a watcher

Its ledger verdict is `open`, or `escalated` with a resume later than the verdict (the loop took it back), and no run of
`watch-pr.yml` that is queued, in progress, waiting or pending is titled `Watch pull request #N`. That title is how a
run names its pull request: keep the number in `run-name`. The sweep dispatches `watch-pr.yml` with `pr`, using
`AUTOWRITER_PAT`, and prints `#138 watcher started`.

- **Never a second chain.** A pull request with an active run is left as `chain-alive`. A pull request this sweep has
  just started or resumed counts at once, because the list of runs can lag, so two sweeps in a row start one chain.
  The wait timer of the environment `autowriter-tick` spaces the looks, so between two looks the successor sits in a
  run with status `waiting`: a live chain always has an active run.
- **A person's pull request is left**, as for a resume: a draft, the hold label, or a commit by anyone but the bot is
  `human-touched`.
- **At most three chains alive** (`CHAIN_CAP` in `scripts/pr-chains.mjs`), counted as pull requests with an active run,
  whoever started them. The lowest number goes first, a resume takes a place like any chain, and the rest are left as
  `chain-cap` until a later sweep. A look makes 10 reads with `GITHUB_TOKEN`, and a chain looks every `loop.tickMinutes`
  (3): 200 reads an hour for a chain, against the 1000 an hour the repository gets. Three chains use 60% of it, eight
  would use 160%; `scripts/pr-chains.test.mjs` derives the cap from these numbers. Run minutes cost nothing, as the
  repository is public.
- **A run with no number in its title** could be the chain of any pull request, so while one is active the sweep
  starts no chain (`run-unattributed`). Runs that began before `run-name` carried the number are such runs.

The sweep has no schedule, so a pull request left as `chain-cap` waits for the next push to `main` or a dispatch of
`resume-pr.yml`. When this reaches `main`, dispatch it once more after the first numbered run has appeared.

## A repair that failed

The repair job can die before it finishes, which says nothing about the article. The sweep resumes it once, by the rule
of any resume: kind `hard-stop` with a detail that reads `The repair of pull request #N ended as failed: ...`, and a
code change on `main` since the verdict. The cap is counted from the ledger, with no counter:
`scripts/pr-resume-repair-failed.mjs` counts the `resumes` made after a failed-repair escalation. If the repair fails
again after that, the pull request is left as `resume-spent` and its escalation issue gets one comment, `not resumed:
the one resume a failed repair gets was already spent`; the sweep reads the issue first, so the note is made once. A
resume by the owner is that one.

## The owner's run

`gh workflow run resume-pr.yml -f pr=<number>` resumes one pull request. It is the only way back for `chain-too-old`
(a head still unsettled 36 hours after it was committed), which the sweep never resumes. It ignores the chain cap and a
run with no number, not a chain that is alive, and it starts no chain for a pull request that is not escalated.

## Trap

A chain the sweep starts on a head older than 36 hours is judged at once. If the checks read `unsettled` at that first
look (three cancelled jobs, say), the pull request is escalated `chain-too-old`: the clock is the age of the head, not
of the chain (`scripts/pr-classify-head-age.test.mjs`).
