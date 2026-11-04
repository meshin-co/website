# A rejected block still delivers

## Why

Every Slack message the unattended writer sends is a Block Kit payload, and only one of the four kinds has been delivered to the real webhook: the live-entry message, which answered HTTP 200 during the publish of run 41769900204. The spend message, the no-entry message and the watcher's escalation have only been validated against a schema and a local receiver.

A failed delivery of a notice prints a warning and exits 0, on purpose, so that a notification cannot fail a run whose article is written and whose money is spent. The consequence: if Slack answered `invalid_blocks` to one of those payloads, the owner would silently stop receiving that kind of message and nothing anywhere would go red.

## What changes

**A rejected payload falls back to its text.** Every message carries a `text` that holds its essential facts. When Slack answers 4xx to the blocks, `postSlackMessage` (`site/scripts/escalate-channels.mjs`) sends the `text` alone before giving up. A malformed block is a formatting defect, and the facts are still worth delivering. A 5xx, a redirect and a failed request are not formatting defects and are not retried.

**The defect leaves a trace where a person reads.** A retry Slack takes is a delivery, and it is recorded in three places:

- the Slack message itself ends with a line saying Slack refused the formatted version, because the owner reads Slack and does not read run logs;
- the run prints `::warning::<label>: slack delivered as plain text` with Slack's reason, an annotation on the run page, and the step summary of the spend step carries the same line;
- an escalation's receipt in the ledger is `delivered: true` with the refusal in `error`, so the ledger committed to the pull request branch keeps it.

**The asymmetry stays.** A plain text that Slack refuses too is the old failure: a warning and exit 0 for a notice, an `EscalationError`, a receipt that is not delivered and exit 1 for an escalation.

## Not in scope

- The content and the layout of any message.
- Any gate, and the writer's loop.
- A new channel for a formatting defect, such as an issue: a notice is not worth an issue, and the line in Slack is what makes the owner open the log.

## Impact

- Changed: `site/scripts/escalate-channels.mjs`, `escalate.mjs`, `escalate-run.mjs`, `slack-notice.mjs`, the spec `governance/spend-reporting`.
- Documents: `site/.agents/skills/report-what-the-writer-spends.md`, `guard-the-unattended-writer.md` and `site/scripts/README.md`.
