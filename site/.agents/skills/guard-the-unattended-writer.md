# Guard the Unattended Writer

Change `20-write-without-a-human` lets a machine judge, repair and merge its own article under
bounds the owner set (locked row L62). Phase one calls no model: it only watches a pull request and
escalates. Everything the machine writes about a run lives in a ledger, one file per article at
`audits/autowriter/<year>/<month>/<slug>.json`, and every topic it holds lives in a claim at
`audits/autowriter/claims/<year>/<month>/<slug>.json`. Both have a JSON Schema beside the scripts, and both are strict:
an unknown field is a finding. `scripts/record-layout.mjs` builds these paths from the claim's `claimedAt` and lists them at any depth. A claim says where its topic came from in `origin` (`demand` when absent; `weak-demand` and `category` carry no `prompt`), and the claim block of a generation record follows the same rules (`originProblems`; findings `claim-schema` and `generation-schema`).

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
- **generation-\* (unreadable, schema, name, entry-missing, entry-unreadable):** a file at
  `audits/autowriter/generations/<year>/<month>/<slug>.json` that is off `scripts/generation-record.schema.json` (a record with no `band` too), is not named by its slug, or whose entry file is missing. With no file the gate checks none and says `0 generation records`. A pipeline commit that removes a record, at any depth, is refused by `scripts/commit-to-main.mjs` and found in history as `generation-record-removed-committed`, because the band and the length record leave out every entry that has one; a person may still delete one in a visible diff.
- **record-layout:** a ledger, claim, generation record or generated disposition not filed under the `<year>/<month>` of its claim, or of any claim of its slug once a lapsed claim was claimed again in a later month; the finding names where it belongs.
- **The claim table and sentence band of a record:** the rules of `scripts/claim-sources.mjs` and `scripts/sentence-band.mjs`, run on the entry re-measured from its committed file against `audits/sentence-band.json`, never on the record's word. Sources match by id, or by the address that was cited, `original ?? url`: a row the link repair job rewrote keeps that address in `original` beside a stand-in `url` (`link-out.md`), so its claim rows still bind and a standard's primary domain is read from the cited host.
  `band-measurement-differs`: the record's measurement is not what the entry measures. The limits a record carries are only a note of what it was judged against, so a re-measure of the band never invalidates an old record. `generation-band-unjudged`: no band for the entry's format.
- **record-missing, record-\*-stale, band-record-unmeasurable, length-record-\*:** `audits/sentence-band.json` or `audits/entry-length.json` is absent or differs from a fresh measurement; repair each with `node scripts/measure-sentence-band.mjs --write` and `node scripts/measure-entry-length.mjs --write`.
- **body-too-short, too-few-sections, section-too-thin, length-unjudged:** the rules of `scripts/entry-length.mjs`, run on each generated entry re-measured from its committed file against `audits/entry-length.json`. `length-unjudged`: no limits for the entry's format.
- **spend-report-missing, spend-report-differs:** `audits/spend-report.md` is absent or is not what the records give; see `report-what-the-writer-spends.md`.

The numbers (12-hour quarantine, 3 attempts, $25 a month) live in `scripts/autowriter-ledger.mjs`;
a site that keeps a locked row for them pins it with a test of its own. The gate itself is
`scripts/autowriter-gate.mjs`, over `scripts/autowriter-claims.mjs`, `scripts/autowriter-records.mjs`, `scripts/autowriter-record-rules.mjs` and `scripts/autowriter-length-rules.mjs`. The cron block of `write-daily.yml` is guarded by `gate:schedule` instead (`schedule-the-unattended-writer.md`).

## Escalate, and prove it arrived

`scripts/escalate.mjs` (requests in `scripts/escalate-channels.mjs`; `scripts/pr-watch.mjs` passes the pull request number)
opens a GitHub issue, posts to Slack and writes a receipt (instant, HTTP status, issue number or error) into the ledger:

```
npm run escalate -- raise --ledger <path> --kind no-convergence --title <text> --detail <text>
npm run escalate -- redeliver --ledger <path> --id esc-1
```

The Slack message is Block Kit `{ text, blocks }` from `scripts/escalation-slack.mjs`: a header with the kind, the title, the
detail with addresses as links, fields Pull request, Workflow run and Issue, the ledger path; `text` repeats it for a phone.
Slack carries `spend-ceiling`, `credential` and `no-convergence` at once; `hard-stop` and `unrepairable` open an issue and wait
for the digest. It reads `GITHUB_TOKEN`, `GITHUB_REPOSITORY` and `SLACK_WEBHOOK_URL`. Unlike the statistics message a missed one is
never quiet: the receipt names it, the command exits 1, the gate stays red until `redeliver`. A 4xx on the blocks is retried as `text` alone; that receipt is delivered, its `error` says the formatted message was refused, and the run prints a `::warning::`. No secret, the webhook included, is logged. An escalated pull request can re-enter the loop: `resume-an-escalated-pull-request.md`.

## The aggregate check

GitHub counts a skipped required check as passed, and `ci.yml` cancels its own run when a job fails.
So the job `all-required-jobs-passed` runs `always()` and `scripts/ci-aggregate.mjs` fails on a needed
job that failed, was cancelled, or was skipped when the diff needed it. **The check the owner requires
on `main` is `all required jobs passed`**; a push run is named `all required jobs passed (push)`, so it
can never shadow it. A new job in `ci.yml` goes into that job's `needs` and into the table in
`scripts/ci-aggregate.mjs`; `scripts/ci-aggregate-wiring.mjs` names what is missing.

## A push, and whether it starts CI

A push made with the workflow's default `GITHUB_TOKEN` starts no CI run: the commit has no check run, and its
one `pull_request` run ends `failure` with no job or waits as `action_required` until a person re-runs it.
`regen-baselines` in `ci.yml` commits as `baseline-bot` with that token, so its commits take this form. A push
made as a user does start CI. So the writer and the watcher push with the `AUTOWRITER_PAT` secret. The watcher
reads a push that starts no run as `no-checks` on the second look and escalates, never as green. The dated
evidence for each form is under `investigation/`.

## Add a failure mode

Write the failing test, then the rule, then a planted specimen in `scripts/autowriter-specimens.mjs` (generation records, the band and the entry length: `scripts/autowriter-record-specimens.mjs`) and a row in
`scripts/mutation-smoke.mjs` (`extend-mutation-smoke.md`). A finding that names no file, or no cause, is not finished.

## Trap

A red receipt is the gate working. Fix the secret, run `redeliver`, and never edit a receipt by hand:
the ledger is the only record that an escalation did or did not reach a person.
