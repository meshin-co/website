# Guard the Unattended Writer

Change `20-write-without-a-human` lets a machine judge, repair and merge its own article under
bounds the owner set (locked row L62). Phase one calls no model: it only watches a pull request and
escalates. Everything the machine writes about a run lives in a ledger, one file per article at
`audits/autowriter/<slug>.json`, and every topic it holds lives in a claim at
`audits/autowriter/claims/<slug>.json`. Both have a JSON Schema beside the scripts, and both are strict:
an unknown field is a finding.

## What `gate:autowriter` refuses

`npm run gate:autowriter` runs offline in the `types-and-units` job, with no secret. It prints
`AUTOWRITER <rule> <path>: <what is wrong>` and exits 1 on any of these:

- **ledger-schema, ledger-name:** a ledger off `scripts/autowriter-ledger.schema.json`, with spend that
  is not the sum of its attempts, or filed under a name that is not its slug.
- **attempt-cap:** more attempts than the cap (3).
- **title-collision:** an unexpired claim whose title, after case and punctuation are folded, is already a
  title anywhere in the generated layer of `docs/SEMANTIC-CORE.md`, or is held by another claim.
- **escalation-undelivered:** an escalation with no delivered receipt for a channel its kind needs, or only
  a failed one. The message quotes the reason the receipt gives.
- **aggregate-\*:** a `ci.yml` whose aggregate job no longer covers every required job (below).
- **generation-\* (unreadable, schema, name, entry-missing, entry-unreadable):** a file directly in
  `audits/autowriter/generations/<slug>.json` that is off `scripts/generation-record.schema.json` (a record with no `band` too), is not
  named by its slug, or whose entry file is missing. With no file the gate checks none and says `0 generation records`.
- **The claim table and sentence band of a record:** the rules of `scripts/claim-sources.mjs` and `scripts/sentence-band.mjs`, run on the entry re-measured from its committed file against `audits/sentence-band.json`, never on the record's word. Sources match by id, or by URL.
  `band-measurement-differs`: the record's measurement is not what the entry measures. The limits a record carries are only a note of what it was judged against, so a re-measure of the band never invalidates an old record. `generation-band-unjudged`: no band for the entry's format.
- **record-missing, record-\*-stale, band-record-unmeasurable:** `audits/sentence-band.json` is absent or differs
  from a fresh measurement; repair it with `node scripts/measure-sentence-band.mjs --write`.

The numbers (12-hour quarantine, 3 attempts, $25 a month) live in `scripts/autowriter-ledger.mjs`;
`scripts/autowriter-ledger.test.mjs` fails when locked row L62 disagrees with them. The gate itself is
`scripts/autowriter-gate.mjs`, over `scripts/autowriter-claims.mjs`, `scripts/autowriter-records.mjs` and `scripts/autowriter-record-rules.mjs`.

## Escalate, and prove it arrived

`scripts/escalate.mjs` (requests in `scripts/escalate-channels.mjs`) opens a GitHub issue and posts to
Slack, then writes a receipt (instant, HTTP status, issue number or error) into the ledger:

```
npm run escalate -- raise --ledger <path> --kind no-convergence --title <text> --detail <text>
npm run escalate -- redeliver --ledger <path> --id esc-1
```

Slack carries three kinds at once: `spend-ceiling`, `credential`, `no-convergence`. `hard-stop` and
`unrepairable` open an issue now and wait for the morning digest. It reads `GITHUB_TOKEN` (Issues:
write), `GITHUB_REPOSITORY` and `SLACK_WEBHOOK_URL`, a repository secret the owner creates. A missing
one is never skipped quietly: the receipt names it, the command exits 1, and the gate stays red until
`redeliver` records a delivery. No secret value reaches a receipt, a message or the log.

## The aggregate check

GitHub counts a skipped required check as passed, and `ci.yml` cancels its own run when a job fails.
So the job `all-required-jobs-passed` runs `always()` and `scripts/ci-aggregate.mjs` fails on a needed
job that failed, was cancelled, or was skipped when the diff needed it. **The check the owner requires
on `main` is `all required jobs passed`**; a push run is named `all required jobs passed (push)`, so it
can never shadow it. A new job in `ci.yml` goes into that job's `needs` and into the table in
`scripts/ci-aggregate.mjs`; `scripts/ci-aggregate-wiring.mjs` names what is missing.

## A push, and whether it starts CI

Settled on the history. A push made with the workflow's default `GITHUB_TOKEN` starts no CI run. `regen-baselines` in
`ci.yml` commits as `baseline-bot` with that token: its commit `5709cadb2201f76a61ff486bba19a9c822ebb322` on pull
request 68 has no check run, and its one `pull_request` run, `41194290941`, ended `failure` with no job. Four older
bot commits show the other form, a run whose attempt 1 is `action_required` with no job until a person re-ran it. A
push made as a user does start CI: commit `4e0075150d6cffbc30114c554eb0eba9707ab5a3` by `meshin-dev` drew run
`41360101540` and its jobs. So the writer and the watcher push with the `AUTOWRITER_PAT` secret. No such token exists
yet, so a push with it is unobserved: the watcher reads a push that starts no run as `no-checks` on the second look
and escalates, never as green.

## Add a failure mode

Write the failing test, then the rule, then a planted specimen in `scripts/autowriter-specimens.mjs` (generation records and the band: `scripts/autowriter-record-specimens.mjs`) and a row in
`scripts/mutation-smoke.mjs` (`extend-mutation-smoke.md`). A finding that names no file, or no cause, is not finished.

## Trap

A red receipt is the gate working. Fix the secret, run `redeliver`, and never edit a receipt by hand:
the ledger is the only record that an escalation did or did not reach a person.
