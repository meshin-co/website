# Tasks

## 1. The pieces

- [x] 1.1 `site/scripts/slack-blocks.mjs` builds header, section, fields, context, divider and
      preformatted blocks, `<url|label>` links and the `{ text, blocks }` message, refuses what exceeds a
      documented limit and escapes `&`, `<` and `>`
- [x] 1.2 `site/scripts/slack-table.mjs` pads a table into lines of at most 34 characters
      (`PHONE_COLUMNS`), left, right or decimal-point aligned
- [x] 1.3 `site/scripts/github-links.mjs` builds the run, pull request and issue links from
      `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and `GITHUB_RUN_ID`, and returns `null` when the
      environment does not name them
- [x] 1.4 `site/scripts/slack-notice.mjs` delivers a message and prints either one receipt line or a
      `::warning::` line, with the webhook removed

## 2. The messages

- [x] 2.1 `site/scripts/spend-slack.mjs` builds the spend message and the no-entry message with the
      month first, tables in code fences, link fields, and the warnings as a context line or a section
- [x] 2.2 `site/scripts/escalation-slack.mjs` builds the escalation message, and
      `site/scripts/escalate-channels.mjs` posts it as `postSlackMessage`; `escalate()` takes the
      pull request number
- [x] 2.3 `node scripts/spend-report.mjs notify` and `node scripts/spend-ended.mjs` exit 0 when Slack
      does not take the message, and keep exit 1 and 2 for causes that are not delivery
- [x] 2.4 `.github/workflows/write-daily.yml` gives the spend step `PULL_REQUEST`
- [x] 2.5 Escalations keep their receipts, `EscalationError` and exit code

## 3. The tests

- [x] 3.1 Each builder has a test that fails on a message over a limit, on an unescaped `<`, and on a
      table line wider than 34 characters
- [x] 3.2 The message tests assert the order of the blocks, the month first, the fallback text and the
      links, and a test of the delivery shows the exit code for a refusal and for an unreadable result

## 4. The documents

- [x] 4.1 `spend-reporting` states the Block Kit message, the month first, the tables, the links, the
      warnings, the delivery semantics, the escalation message and the webhook
- [x] 4.2 The skills `report-what-the-writer-spends.md` and `guard-the-unattended-writer.md` say what
      the messages are and what a missed one costs
- [x] 4.3 `site/scripts/README.md` carries a row for every new script

## 5. Calibration Gate

- [ ] 5.1 Run the Calibration Gate for the whole change, the live-entry message included, and commit
      the report it generates for this change; the owner runs the Lighthouse measurement (owner)

## 6. The live-entry message

- [x] 6.1 `site/scripts/entry-surfaces.mjs` lists the page of an entry and every surface it is owed from
      `owedFor` and `SURFACES` in `site/scripts/route-parity.mjs`, never from a second list
- [x] 6.2 `site/scripts/live-probe.mjs` asks for an address up to 8 times after waits of 0 to 30 seconds
      and answers whether it is live (a 2xx after redirects), with the attempts and the check time
- [x] 6.3 `site/scripts/live-slack.mjs` builds `liveMessage` and `unreachableMessage`, the month first
- [x] 6.4 `site/scripts/live-state.mjs` and `site/scripts/entries-in-build.mjs` read the announced entries
      and the entries a build carries, and apply the 48-hour rule of a first run
- [x] 6.5 `site/scripts/live-announce.mjs` and `site/scripts/live-entry.mjs` probe, post and record an
      entry only when Slack took the message; `deliverNotice` returns whether it delivered
- [x] 6.6 `.github/workflows/publish-live.yml` runs the step after the smoke step and before IndexNow,
      between a cache restore and a cache save, with only the webhook in its environment

## 7. The live-entry tests and documents

- [x] 7.1 Each new script has a test: `site/scripts/entry-surfaces.test.mjs`,
      `site/scripts/live-probe.test.mjs`, `site/scripts/live-slack.test.mjs`,
      `site/scripts/live-state.test.mjs`, `site/scripts/entries-in-build.test.mjs`,
      `site/scripts/live-announce.test.mjs` and `site/scripts/live-entry.test.mjs`
- [x] 7.2 `site/scripts/publish-live-entry.test.mjs` pins the step, its order, its cache key and its
      environment, and `site/scripts/slack-notice.test.mjs` pins the delivery result
- [x] 7.3 `spend-reporting` states when an entry is live, the warning for one that is not reachable, the
      surfaces from the parity derivation, the month first, announce once, the first run, a missed message
      and the workflow step
- [x] 7.4 The skills `publish-the-build.md` and `report-what-the-writer-spends.md` name the message
- [x] 7.5 `site/scripts/README.md` carries a row for every new script
