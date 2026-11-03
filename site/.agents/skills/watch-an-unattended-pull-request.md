# Watch an Unattended Pull Request

Change `20-write-without-a-human` lets a machine open an article pull request and merge it without a
person. The watcher is the part that judges that pull request. Phase one calls no model: it reads
GitHub, decides, and then merges, waits by starting its own successor, or escalates.

```
npm run watch:pr -- --pr <number> [--observed <token>]
```

`.github/workflows/watch-pr.yml` (Watch PR) runs it, one run per look, never sleeping in a job.
`scripts/pr-watch.mjs` is the runner and `scripts/pr-github.mjs` holds every request. The decision is
pure and tested on real API payloads: `scripts/pr-classify.mjs` judges the pull request and
`scripts/pr-checks.mjs` judges its checks. `scripts/json-schema.mjs` validates the ledger with no
dependency, so the job needs no `npm ci` while it holds a token that can merge.

## The verdicts

- **merge:** every required job `success`, the aggregate `all required jobs passed` `success`, every
  commit by `autowriter-bot@meshin.co`, and the pull request at least 12 hours old. The runner squash
  merges the head it judged; a 409 means the head moved, so it starts a successor instead.
- **unsettled:** a job still running, a head that moved since the checks were read, a quarantine not over,
  or the first sight of a cancellation. The runner starts a successor.
- **repairable:** only `cheap-gates` or `build` failed, in a step that is not setup. Phase one repairs
  nothing, so the runner escalates it as `unrepairable`.
- **escalate:** `hard-stop` (zero check runs, a head with checks but no `pull_request` run, a skipped,
  missing or neutral required job, an absent or red aggregate, a run that needs approval or has no job,
  a merge GitHub refuses, a second cancellation), `unrepairable` (a failing job that is not a
  content gate, or a failure in setup) or `no-convergence` (3 attempts spent, or a chain older than 36
  hours). Each opens one issue; `no-convergence` also posts to Slack, the rest wait for the digest.
- **blocked-by-human:** closed, draft, label `autowriter-hold`, a branch that is not `autowriter/<slug>`
  from this repository, or any commit not made by the bot. The runner writes a summary and nothing else; a pull request
  closed on purpose is recorded by hand, as `report-what-the-writer-spends.md` says.
- **done:** merged, or the ledger already says `escalated`, `stopped` or `discarded`, so nothing is raised twice.

The exact order is in `scripts/pr-classify.mjs`; each rule has a test in `scripts/pr-classify.test.mjs`.

## First look, second look

A cancelled job with no failure may be a cancelled run, so it is read twice. The outcome carries an
`observe` token, `cancelled:<head>:<run id>:<attempt>`, and the runner passes it to its successor as the
input `observed`; a look that finds the same token again is a hard stop. Zero check runs are not read
twice: a push that starts no run is the 1.5 finding below. The classifier keeps no state of its own.

Only the `pull_request` run of `ci.yml` counts: a `push` run beside it has the same job names and
different results. `cancel-on-failure` makes one real failure show as one `failure` and several
`cancelled` jobs, so cancelled siblings are ignored once a job failed. GitHub counts a skipped required
job as passed, so a skipped one is never green.

## What the owner creates once

1. The secret `AUTOWRITER_PAT`: a fine-grained token of the bot account, this repository only, with
   Contents, Pull requests and Actions write access. Without it the run fails naming the secret; a token
   GitHub refuses raises a `credential` escalation. Every write uses it; every read uses `GITHUB_TOKEN`.
2. The secret `SLACK_WEBHOOK_URL`, described in `guard-the-unattended-writer.md`.
3. The environment `autowriter-tick` with a 3 minute wait timer, which spaces the looks without a
   runner waiting: `gh api -X PUT repos/<owner>/<repo>/environments/autowriter-tick -F wait_timer=3`.
   The runner reads the environment first and refuses to start a successor without the timer.
4. A chain starts by hand with `gh workflow run watch-pr.yml -f pr=<number>`.

## Why each permission

`contents: read` checks out `main` and reads the ledger from the branch. `pull-requests: read`,
`checks: read` and `actions: read` read the pull request, the head's check runs and the run with its
jobs. `issues: write` opens the escalation issue. Nothing else is granted: every other write uses the
secret above, and the job runs only from `main`.

## Traps

A push made with `GITHUB_TOKEN` starts no CI run, so the watcher never relies on one; the evidence is
under "A push, and whether it starts CI" in `guard-the-unattended-writer.md`. The runner never pushes
to a branch a person has touched. A new failure mode starts as a payload captured with `gh api`
into `scripts/fixtures/pr-watch/<scenario>.json`, then a failing test, then the rule.

A run that fails for any reason other than a verdict (an outage, a malformed ledger, a missing secret)
ends its chain and nothing restarts it: read the log, fix the cause, start a chain again. The workflow
can be dispatched only once it is on `main`. It never reads which files a pull request changed; what
the writer may touch is for the phase that builds the writer.
