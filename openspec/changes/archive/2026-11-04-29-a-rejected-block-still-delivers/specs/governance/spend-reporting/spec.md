# governance/spend-reporting Specification

## ADDED Requirements

### Requirement: A block payload that Slack refuses is delivered as plain text

When Slack answers 4xx to the blocks of a message, `postSlackMessage` in `site/scripts/escalate-channels.mjs` SHALL send the `text` alone, ending in a line that says Slack refused the formatted version. A retry Slack takes is a delivery: the run prints `::warning::<label>: slack delivered as plain text` with Slack's reason, and an escalation's receipt keeps the refusal in `error`. A 5xx or a failed request is not retried. `site/scripts/escalate-channels.test.mjs` pins it.

#### Scenario: Slack refuses the blocks and takes the text

- **WHEN** the webhook answers 400 `invalid_blocks` to the message and 200 to the second request
- **THEN** the second request holds `text` alone, a notice exits zero with one `::warning::` line naming the 400 and `invalid_blocks`, and nothing is written to a ledger

#### Scenario: Slack refuses the text too

- **WHEN** the webhook answers 4xx to both requests
- **THEN** a notice prints one `::warning::<label>: slack NOT delivered:` line naming both answers and exits zero, and an escalation exits non-zero with a receipt that is not delivered

#### Scenario: An escalation is delivered as plain text

- **WHEN** the webhook answers 400 to the blocks of an escalation and 200 to its text
- **THEN** the receipt of the slack channel is delivered with the refusal in `error`, the command exits zero with a `::warning::`, and `npm run gate:autowriter` accepts the ledger
