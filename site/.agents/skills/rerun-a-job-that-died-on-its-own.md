# Rerun a Job That Died on Its Own

A CI run can end `cancelled` with no job failed: a shard reached its 20 minute limit, or lost its network. The watcher
reads that twice (`watch-an-unattended-pull-request.md`, "First look, second look"). On the second look it reruns the
failed jobs once if the job died on its own, and escalates if it cannot show that. This is the rule and the reason.

## How a job that died on its own shows

`cancel-on-failure` in `.github/workflows/ci.yml` runs only when a job it waits for failed, and it cancels its own run,
itself included. The three ways a run ends `cancelled` leave three different marks:

| How the run ended                       | `cancel-on-failure`         | A job `failure` |
| --------------------------------------- | --------------------------- | --------------- |
| A real failure, then the cancelling job | `cancelled`                 | yes             |
| A person cancelled the run              | `cancelled`, or no such job | no              |
| A job hit its limit or lost its network | `skipped`                   | no              |

The watcher calls the last row a job that died on its own when every cancelled job is one `cancel-on-failure` waits
for. `CANCEL_ON_FAILURE_NEEDS` in `scripts/pr-checks.mjs` lists them, and `scripts/pr-checks-rerun-wiring.test.mjs`
fails when `ci.yml` stops agreeing. A cancelled `deploy-preview` or aggregate is not covered: a cancel after the four
jobs ended would leave `cancel-on-failure` `skipped` too, so those stay a hard stop.

## What the watcher does

- First look: `unsettled`, with the token `cancelled:<head>:<run id>:<attempt>`.
- Second look, died on its own, attempt 1: `rerun`. The runner calls `rerun-failed-jobs` once with `AUTOWRITER_PAT`,
  then starts a successor with no token. A refused write is a `credential` escalation, as for every write.
- Second look, died on its own, attempt 2 or later: `no-convergence`, reason `rerun-cap`, whoever started the second.
- Second look, anything else: `hard-stop`, reason `inconclusive-cancel`, as before.
- A real failure never reaches this rule. A failed job is judged first, and a rerun of it would hide the defect.

`scripts/pr-resume.mjs` resumes neither escalation: both are `not-resumable-kind`, because a stalled runner has
nothing to do with `main`. Only the owner's forced resume clears them, and `scripts/pr-resume-cancelled-run.test.mjs`
holds that.

## Why the cap is one

Measured on 2026-11-20 from the 742 attempts of `ci.yml`, for the runs that started on or after 2026-11-06 19:24 UTC,
the first to carry the 20 minute limit:

- 9 of 149 attempts (6.0%) lost a shard to the limit: 3 of 62 autowriter attempts (4.8%). 12 of 447 shard runs (2.7%).
- Nine of the twelve shards stopped in `npx playwright install --with-deps`, three in `npm run gate:visual`.
- Four such runs were rerun on the same head with no code change: three ended green, one had a job fail.
- A rerun costs 6.7 runner minutes at the median (shard 5.1, deploy preview 1.3, aggregate 0.3), and 20.6 when the
  shard hangs again, because it then runs to the limit in full.

One rerun buys the recovery for 6.7 minutes. A second costs 20.6 minutes each time it is wrong, and two hangs in a row
on one head is how an outage looks: in run 43055514445 all three shards stopped together on
`Temporary failure resolving 'security.ubuntu.com'`. A person should see that, so one is the cap. A push starts a new
run with its own one rerun.

## Measure it again

A sample of the last 40 runs cannot tell 2% from 10%, so count from the API before moving the cap.
`gh api --paginate 'repos/<owner>/<repo>/actions/workflows/ci.yml/runs?per_page=100'` lists the runs, and
`gh api 'repos/<owner>/<repo>/actions/runs/<id>/attempts/<n>/jobs?per_page=100'` lists the jobs of one attempt. The
annotation of a job that hit the limit says "exceeded the maximum execution time". The specimen is run 44713195235 as
GitHub reported it: `scripts/fixtures/pr-watch/shard-timed-out.json`. Row G108 of `docs/plan/reference/known-gaps.md`
holds the cause that is still open.
