# Resume an Escalated Pull Request

The watcher escalates a pull request it may not repair and stops. That used to be final: the ledger said
`escalated`, the watcher read it as done, and the pull request waited for a person even when the cause was gone, such
as a CI job that failed on a bad day. The sweep gives such a pull request a bounded way back into the loop.

## When a pull request re-enters

`.github/workflows/resume-pr.yml` (Resume escalated pull requests) runs `npm run resume:pr` on every push to `main`
and on a manual dispatch. It has no schedule, so nothing polls. `scripts/run-pr-resume.mjs` reads with the workflow
token and writes with the `AUTOWRITER_PAT` secret; `scripts/pr-resume.mjs` holds the decision and the sweep.

For each open pull request on an `autowriter/` branch of this repository it asks `resumeDecision`, and prints one line:
`#84 resumed (main-change, main e8874d4)` or `#84 left: cap-reached`. The reasons are `not-escalated`,
`not-resumable-kind`, `cap-reached`, `resume-spent`, `remeasure-spent`, `no-main-change-since-decision`, `human-touched`,
`already-resumed`. A stale verdict is re-measured instead: `remeasure-a-stale-verdict.md`. A pull request that waits for a watcher is the other case: `keep-every-pull-request-moving.md`.

## The brakes

1. **Kind.** Only four escalations may re-enter. Three are read from the watcher's own line `The watcher judged head
<sha>: escalate, <reason>.` in `detail`: kind `unrepairable` with reason `not-a-content-gate` (a job that is not a
   content gate failed); kind `hard-stop` with reason `approval-required` (the CI run waits for a person), once and at
   once; and kind `hard-stop` with reason `no-checks-catch-up-cap`, which the watcher filed until 2026-11-20 and files no
   more, so only a ledger that already carries it re-enters. `unrepairable` is also what the repair loop files for an article it cannot repair, so the kind alone is never enough. The fourth is a failed repair job, once: `keep-every-pull-request-moving.md`.
2. **An event.** A commit on `main` after the verdict whose files make `needsFullGraph` true in
   `scripts/build-surface.mjs`. Prose, audits and ledgers do not count. More than 30 commits since the verdict count.
3. **A cap.** `RESUME_CAP` is 2 automatic resumes per pull request, for good. Resumes by the owner do not count.
   A failed repair gets one of them, counted in `scripts/pr-resume-repair-failed.mjs`.

A person stops it too: a commit by anyone but the bot, the hold label, or a draft leaves it as `human-touched`.

So a pull request nobody fixes costs nothing until `main` changes in code, and at most two CI cycles ever.

## Why a real failure is never retried

A failing content gate at the attempt cap (`no-convergence`), `spend-ceiling`, `credential`, a skipped or missing
required check, a refused merge and every repair outcome but `failed` are caused by the article, the budget or the
setup. Running them again spends money to reach the same answer, so they stay with a person.

## What a resume does

1. Appends one entry to the ledger `resumes` and writes the ledger to the pull request branch as `autowriter-bot` with
   the PAT. That push starts the `pull_request` CI run unheld, as the default token does not, unless the branch conflicts with `main`: then no push starts one, and the watcher's catch-up is what does.
2. Comments `resumed: main-change, main e8874d4` on the escalation issue.
3. Dispatches `watch-pr.yml` with `pr`. If the dispatch fails after the write, the line says so and names the command
   to start it by hand; the run fails and no second resume is written: the next sweep starts the watcher it missed.

The same sweep closes the escalation issues of pull requests that merged (`merged as <sha>`, completed) or closed
(not planned). An issue of a pull request still open is left.

## Force one

```
gh workflow run resume-pr.yml -f pr=84
```

The owner's dispatch skips the kind, the event and the person, and is recorded `by: owner`. It keeps the cap and the
rest, except that a stale verdict is answered after the cap is spent. A pull request that is not escalated, or already
resumed, is refused and the run fails, so a green run always means the pull request re-entered the loop.

## Read `resumes`

`jq .resumes audits/autowriter/<year>/<month>/<slug>.json`. Each entry is `at`, `by` (`main-change`, `approval-held`
or `owner`), `mainSha` (null for the last two) and `failedJobs`, the jobs the escalation named. The list only grows.
A verdict binds only while no resume is later than its `decidedAt` (`verdictInForce` in `scripts/autowriter-ledger.mjs`);
when the watcher escalates again it writes a newer verdict and the pull request waits for the next event.

## Held in CI

`npm run gate:autowriter` fails a workflow step that runs `git push` without the bot token (`bot-push-token`, in
`scripts/bot-push-token.mjs`: the job checkout must drop the default token and the step must hold `AUTOWRITER_PAT`, or
the push holds the pull request's CI run for a click). It also fails a `changes` job whose `BEFORE` does not name
`github.event.pull_request.base.sha` (`classifier-judges-last-push`), without which a pull request is judged by its last
push and a ledger-only commit skips every gate.
It also fails a step that runs `scripts/commit-state.mjs` in a job that did not check `autowriter-state` out at `state/` before the step with `AUTOWRITER_PAT` as the checkout's token (`state-checkout`, in `scripts/bot-push-token.mjs`).

## Trap

Never edit `resumes` or `remeasures` by hand to buy another cycle: the cap and the one re-measure are read from them. To
go past either, fix the pull request on its branch, which makes it the person's, or discard it.
