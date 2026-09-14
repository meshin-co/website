# Diagnose a Red CI Before Touching the Code

A red run is not automatically a gate verdict. Establish which kind of red it is first, because
the platform can refuse a job for reasons that have nothing to do with the commit.

## Step 1: did our code run at all?

```
gh api "repos/meshin-co/website/actions/runs/<id>/jobs" \
  --jq '.jobs[] | {name, conclusion, steps: [.steps[]?.name]}'
```

A failed job with an **empty `steps` array**, finishing in seconds, never executed anything —
not checkout, not `npm ci`. Nothing in the diff can explain it. A real gate failure always shows
its steps, with the failing one marked.

## Step 2: read the annotation, not the log

For a refused job `gh run view --log-failed` returns nothing and the log endpoint answers
`BlobNotFound` with HTTP 404, because no runner ever produced a log. The message lives on the
check run:

```
gh api "repos/meshin-co/website/check-runs/<job-id>/annotations" \
  --jq '.[] | .annotation_level + ": " + .message'
```

Seen on 2026-09-14, across every job in the run:

> The job was not started because recent account payments have failed or your spending limit
> needs to be increased.

That is an account-level block. Re-running, re-pushing, or rewriting the change cannot clear it,
and each attempt looks like a fresh failure. Two cycles were burned this way before the
annotation was read.

## Step 3: decide what the red means for phase work

- **Gate verdict** (steps ran, one failed): main is blocked. Fix it before any phase work.
- **Platform refusal** (no steps, annotation explains): main carries no verdict. The last
  complete run plus its `audits/phase-N/REPORT.md` remains the evidence, and local gates are the
  only thing that can be made green today. Say so plainly rather than claiming a green CI.

## Keep spend from causing this

Lighthouse runs 8 matrix jobs and Playwright 3 shards on every push, including commits that touch
only Markdown. Before re-enabling heavy jobs after a billing block, gate them on changed paths so
a docs-only commit runs `types-and-units` and nothing else.
