# governance/spend-reporting Specification

## ADDED Requirements

### Requirement: Every Slack message is a Block Kit message with a fallback text

Every message the unattended writer posts to Slack SHALL be `{ text, blocks }`, built by
`site/scripts/slack-blocks.mjs`, with `text` the fallback a phone notification shows. A builder SHALL
refuse a section, a field, a field list, a context line or a block list over the limit Slack documents,
shorten only a header and the fallback, and escape `&`, `<` and `>` in every text that is not a link.

#### Scenario: A message has no fallback

- **WHEN** a message is built with an empty fallback text
- **THEN** the builder throws and nothing is posted

#### Scenario: A section is over 3000 characters

- **WHEN** a section text is 3001 characters long
- **THEN** the builder throws and names the length and the limit

#### Scenario: A text holds an angle bracket

- **WHEN** a title or a detail contains `<` or `&`
- **THEN** the message carries `&lt;` or `&amp;`, so Slack does not read it as a link

### Requirement: Figures that are compared sit in preformatted tables, not in fields

The month against the ceiling, the token counts and the costs SHALL be in a code fence padded by
`monoTable` in `site/scripts/slack-table.mjs`, so that the figures line up at the decimal point, and no
line of a table SHALL be wider than `PHONE_COLUMNS`, 34 characters, a limit of this project because
Slack documents no code block width on a phone. `fields` SHALL hold only key and value link columns:
Slack lays them out in two proportional columns of unknown width.

#### Scenario: Costs of different lengths are tabulated

- **WHEN** the entries cost 0.022748, 0.1 and 12.5 USD
- **THEN** the table pads them so that the decimal points stand in one column

#### Scenario: A table is rendered for a phone

- **WHEN** the spend message is built for one article and one term of 12,345 input tokens, 6,789
  output tokens and 0.123456 USD each
- **THEN** no line of any table in it is wider than 34 characters

### Requirement: Every clickable reference is a Slack link built from the environment

A pull request, a workflow run, an escalation issue and a published entry SHALL be written as a Slack
link `<url|label>`: `#84`, `run 777`, `#41` and the slug. `site/scripts/github-links.mjs` SHALL build the
GitHub addresses from `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and `GITHUB_RUN_ID`, never from a host
in the code, and an entry address is `site.site` in `site/src/config.yaml` followed by `/blog/<slug>`
or `/glossary/<slug>`. The spend step takes the pull request number from `PULL_REQUEST`.

#### Scenario: The workflow names the repository

- **WHEN** the environment holds a server, a repository, a run id 777 and `PULL_REQUEST` 84
- **THEN** the message carries `#84` and `run 777` as links under that server and repository, and a
  published entry as a link under `site.site`

#### Scenario: The pull request number is missing

- **WHEN** `PULL_REQUEST` is empty or not a whole number
- **THEN** the message carries no pull request link and is still posted

#### Scenario: The environment does not name the repository

- **WHEN** `GITHUB_SERVER_URL` or `GITHUB_REPOSITORY` is absent
- **THEN** the builders return no link, and the message names nothing it cannot link

### Requirement: The escalation message says what happened and where to act

`escalationMessage` in `site/scripts/escalation-slack.mjs` SHALL build the Slack message of an
escalation: a header `Autowriter escalation: <kind>`, the title, the detail with each address written
as a Slack link, fields for the pull request, the workflow run and the issue, and a context line with
the escalation id and the ledger path. Its fallback text SHALL carry the same facts.

#### Scenario: The watcher escalates a pull request

- **WHEN** `site/scripts/pr-watch.mjs` raises an escalation for pull request 84 in workflow run 777
- **THEN** the message links the pull request as `#84` and the run as `run 777`, and the fallback text
  has a line for each

#### Scenario: The environment does not name the repository

- **WHEN** the environment holds no server, repository or run id
- **THEN** the message carries no pull request or run field, and the title and the detail are still
  there

#### Scenario: The detail already holds an address

- **WHEN** the detail contains the address of the pull request
- **THEN** the detail shows it as a link and the fields do not repeat it

### Requirement: The webhook appears in no output

`redactorFor` in `site/scripts/escalate.mjs` SHALL replace the webhook address and its path with
`[SLACK_WEBHOOK_URL]` in every reason line that any step posting to Slack prints, whichever kind of
message it posts.

#### Scenario: Slack answers with the webhook in its body

- **WHEN** the answer to a refused post repeats the webhook address
- **THEN** the line the step prints holds `[SLACK_WEBHOOK_URL]` and neither the address nor its path

## RENAMED Requirements

- FROM: `### Requirement: The Slack message carries the month sentence of the ceiling status`
- TO: `### Requirement: The Slack message carries the month first, as the sentence of the ceiling status`

- FROM: `### Requirement: A missed message is a red step and nothing more`
- TO: `### Requirement: A missed statistics message is a warning, and a missed escalation is still a failure`

## MODIFIED Requirements

### Requirement: The Slack message carries the month first, as the sentence of the ceiling status

The spend and no-entry messages SHALL open with the month against the ceiling: block 0 is a header
`<month> spend against the monthly ceiling`, block 1 is the table of Spent, Ceiling and Left, and the
first line of the fallback text is the sentence `monthLineOf` in `site/scripts/spend-ceiling.mjs`
builds from the ceiling status of the run, so that its figure is the one the ceiling job stops on,
including the spend on branches that are not merged yet.

#### Scenario: The message opens with the month

- **WHEN** a write produced an entry and the ceiling status says 0.022748 USD spent of 25 USD
- **THEN** block 0 is the header `2026-11 spend against the monthly ceiling`, block 1 is a table with
  0.022748 beside Spent, 25.00 beside Ceiling and 24.977252 beside Left, and the first line of the
  fallback text reads `2026-11 so far: 0.022748 USD spent of the 25.00 USD monthly ceiling, 24.977252 USD left.`

#### Scenario: The ceiling is reached

- **WHEN** the spend of the month equals or exceeds the ceiling
- **THEN** the table reads `none` under Left and a context line says that the writer does not run
  for the rest of the month

### Requirement: A row shows its repair cost, and the Notes and the message total the rest

The row of an entry SHALL carry the cost of the repair calls its record holds in its own column,
beside the cost of its writing calls. The Notes section SHALL state what the noted runs cost
together, and the Slack message SHALL show the sum and its four kinds in a table under
`Everything paid for`, and end the all-time lines of its fallback text with them in one labelled line.

#### Scenario: An entry needed repairs

- **WHEN** a record holds repair calls that cost 0.015 USD and its ledger holds the matching attempt
- **THEN** its row shows the cost of its writing calls unchanged and 0.015 under Repair, and the paid
  tables count 0.015 once, under Repair calls

#### Scenario: The message shows the sum and the four kinds

- **WHEN** a write produced an entry and the all-time spend is 0.086 USD of writing calls, 0.045 USD of repair calls, 0.0485 USD of runs that ended with no entry and 0.027 USD with no generation record
- **THEN** the table under `Everything paid for` has a row for each of the four kinds and one for the sum, and the all-time lines of the fallback text end with `Everything paid for: 0.2065 USD, of which writing calls 0.086 USD, repair calls 0.045 USD, runs that ended with no entry 0.0485 USD and spend with no generation record 0.027 USD.`

### Requirement: A line is a warning only when a person has something to do about it

The report SHALL list under Warnings only a line that a person can act on, and the Slack message SHALL
state the number of those lines, zero included. A ledger that spent and has no record, once its run
ended with the verdict `stopped`, `escalated` or `discarded`, SHALL be a note: it stays in
`audits/spend-report.md`, never in the Slack message, and no warning count or warning line includes
it. `site/scripts/spend-report-model.mjs` sorts each line.

#### Scenario: A discarded attempt and nothing else wrong

- **WHEN** a ledger is discarded, holds a generation and has no record, and every other ledger and
  record agrees
- **THEN** the report states the discard and its cost under Notes, the entries are still totalled, and
  the Slack message says `Warnings: 0`

#### Scenario: A failed write that the workflow escalated

- **WHEN** `site/scripts/escalate-run.mjs` has turned the stopped ledger of a failed write into
  `escalated`
- **THEN** its sentence is a note, because the run is settled and nothing a person does clears it

#### Scenario: A real mismatch

- **WHEN** a ledger records less writing spend than its record costs
- **THEN** the report lists it under Warnings, the record cost is still counted, and the Slack message
  counts it

#### Scenario: A message with no warning does not say the day was healthy

- **WHEN** every ledger agrees with its generation record
- **THEN** the Slack message shows the context line `Warnings: 0` and, in brackets, that every ledger
  agrees with its generation record and that this does not say that every run produced an entry

#### Scenario: Several warnings

- **WHEN** five lines are warnings
- **THEN** the Slack message shows the section `Warnings: 5` with `(each needs a person to look at it)`,
  lists three of the lines and ends with `and 2 more in audits/spend-report.md`

#### Scenario: A note is not in the message

- **WHEN** the report holds a note
- **THEN** the Slack message does not carry it, and the note stays in `audits/spend-report.md`

### Requirement: Slack receives the numbers after every generation

After a successful write the daily workflow, `.github/workflows/write-daily.yml`, SHALL post one
message through `node scripts/spend-report.mjs notify`: the month against the ceiling, each entry just
written with its cost and a link to it, the pull request and the workflow run, the 30-day totals, the
all-time totals with everything paid for, the rates and the warnings. It SHALL post nothing built
from zero records.

#### Scenario: Slack accepts the message

- **WHEN** the webhook answers with a 2xx status
- **THEN** the step exits zero and prints one line saying the message was delivered, with the status

#### Scenario: The write result names an entry no record holds

- **WHEN** the result of the write lists a slug and no generation record carries it
- **THEN** nothing is posted and the step exits non-zero naming the slug

#### Scenario: The ceiling status cannot be read

- **WHEN** the ceiling status of the run cannot be read
- **THEN** nothing is posted and the step exits non-zero with the reason

### Requirement: A day that ends with no entry still posts to Slack

When a daily run ends without an entry, `.github/workflows/write-daily.yml` SHALL post one message
through `node scripts/spend-ended.mjs`: the month against the ceiling first, then that no entry was
written on that UTC date, why, what the run cost, and links to the workflow run and to the escalation
issue when the run raised one. The four endings are the ceiling reached, a picker that chose nothing
or chose to strengthen a page, a write that ended with no entry, and a write that failed.

#### Scenario: The ceiling is reached

- **WHEN** the ceiling job stops the run
- **THEN** the message says that the month's spend reached the ceiling so the writer did not run,
  that the run cost 0.00 USD, and the month table reads `none` under Left

#### Scenario: The picker chooses nothing

- **WHEN** the picker decides `none`, or decides `strengthen`
- **THEN** the message names the reason or the page chosen, and the run cost 0.00 USD

#### Scenario: Every draft was skipped

- **WHEN** the write step succeeds and lists no entry
- **THEN** the message names each skipped draft with its reason, and the run cost is the sum of the
  generation and the attempts in the ledger

#### Scenario: The write failed

- **WHEN** the write step fails after it spent
- **THEN** the message names the slug and the kind of failure, its cost is the ledger's, it links the
  escalation issue, and it is posted after the escalation and after the ledger and the report were
  committed

#### Scenario: A step before the picker decided fails

- **WHEN** the demand refresh or the pick step itself fails
- **THEN** this message is not posted: the refresh has its own escalation, and a failed pick ends the
  job red, which is the signal

#### Scenario: The message carries nothing secret

- **WHEN** any of the four endings posts
- **THEN** the cost is read from the ledger of the run, and no line carries the failure text, the
  spend the writer printed or the webhook

### Requirement: A missed statistics message is a warning, and a missed escalation is still a failure

When Slack does not take the spend or no-entry message, `deliverNotice` in
`site/scripts/slack-notice.mjs` SHALL print `::warning::<label>: slack NOT delivered: <reason>` on
stderr and the command SHALL exit zero, with no issue, no second channel and no ledger. Exit 1 and
2 stay for causes that are not delivery. An escalation keeps its receipt, its `EscalationError` and
its non-zero exit, because `npm run gate:autowriter` refuses an undelivered immediate escalation.

#### Scenario: Slack refuses the statistics message

- **WHEN** the webhook answers 404, or the request fails, for the spend or the no-entry message
- **THEN** the command exits zero and prints one `::warning::` line with the status and the reason, the
  webhook removed, and no issue is opened and no ledger is written

#### Scenario: The cause is not delivery

- **WHEN** the write result cannot be read, names a slug no record holds, or the command is misused
- **THEN** the command exits 1 or 2 and posts nothing

#### Scenario: Slack refuses an escalation

- **WHEN** the webhook answers 404 to an escalation of an immediate kind raised by
  `site/scripts/escalate.mjs`
- **THEN** the receipt of the slack channel is recorded as not delivered, the command exits non-zero,
  and `npm run gate:autowriter` refuses the ledger
