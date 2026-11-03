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

- [ ] 5.1 Run the Calibration Gate and commit the report it generates for this change; the Lighthouse
      measurement is the owner's (owner)
