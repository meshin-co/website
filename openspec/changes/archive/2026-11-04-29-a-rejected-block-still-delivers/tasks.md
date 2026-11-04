# Tasks

## 1. The fallback

- [x] 1.1 A 4xx on the blocks is followed by the `text` alone, and a 5xx, a redirect, a failed request and a message with no blocks are not retried: `site/scripts/escalate-channels.mjs`, proven by `site/scripts/escalate-channels.test.mjs`
- [x] 1.2 A retry Slack takes is a delivery, a retry it refuses too is a failure naming both answers: `site/scripts/escalate-channels.mjs`, proven by `site/scripts/escalate-channels.test.mjs`
- [x] 1.3 A notice delivered as plain text prints one `::warning::` and exits 0, and one refused twice is still a warning and exit 0: `site/scripts/slack-notice.mjs`, proven by `site/scripts/slack-notice.test.mjs` and `site/scripts/spend-report.test.mjs`
- [x] 1.4 An escalation delivered as plain text has a delivered receipt with the refusal in `error`, and one refused twice still fails the step: `site/scripts/escalate.mjs` and `site/scripts/escalate-run.mjs`, proven by `site/scripts/escalate-run.test.mjs` and `site/scripts/pr-watch-escalation.test.mjs`

## 2. The documents

- [x] 2.1 `spend-reporting` states the fallback, the trace and the asymmetry: `openspec/specs/governance/spend-reporting/spec.md`
- [x] 2.2 The skills `report-what-the-writer-spends.md` and `guard-the-unattended-writer.md` and `site/scripts/README.md` say what a 4xx on the blocks now does
