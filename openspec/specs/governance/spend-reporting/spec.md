# governance/spend-reporting Specification

## Purpose
The machine spends real money without being asked each time, so the only control the owner keeps is
knowing what it has spent. This capability says what the writer must report: every paid call in
exactly one total, the month so far against the ceiling that stops it, and a line for a run that
ended with no entry, because a silent week of failures otherwise reads as a cheap week.

## Requirements

### Requirement: One report states what every generated entry cost

The pipeline SHALL keep `audits/spend-report.md`, regenerated from the generation records and the
ledgers by `site/scripts/spend-report.mjs` and never appended to. It SHALL hold one row per record
with its instant, format, slug, tokens, the cost of its writing calls and the cost of its repair
calls, and SHALL state the model and the rates each cost was computed at.

#### Scenario: Nothing has been generated

- **WHEN** no generation record exists
- **THEN** the report says in words that no entry has been generated, and holds no entry row, no
  entry total and no rate

#### Scenario: The same records are rendered twice

- **WHEN** the report is regenerated from an unchanged set of records with the instant stamped in
  the file
- **THEN** the file is byte for byte the same, and `npm run audit:spend` leaves a file that is
  already current untouched, so a later day changes nothing until a record changes

#### Scenario: The rates change between two entries

- **WHEN** a later entry was priced at rates different from an earlier one
- **THEN** the earlier entry keeps the cost its record stored, and the report lists both pairs of
  rates with the first and last entry each one priced

### Requirement: Three windows are totalled and each is defined in the file

The report SHALL total the entries of the newest run, the entries generated in the 30 × 24 hours
that end at the newest record's instant, and every entry recorded, and SHALL print each boundary as
an instant. It SHALL say that the 30 days are not the UTC calendar month of the monthly spend
ceiling.

#### Scenario: A run writes an article and a term

- **WHEN** one run writes both
- **THEN** the report lists both entries as the newest run and totals them by format

#### Scenario: An entry sits on the boundary

- **WHEN** an entry was generated exactly 30 × 24 hours before the newest record
- **THEN** it is outside the 30-day window, which opens after that instant

### Requirement: The month comes before the explanation of the file

The first section after the title and the two stamps SHALL be `This month`. The explanation of how the
file is made and what its words mean SHALL follow it, under its own heading `About this file`, and
SHALL keep the definitions the tables need.

#### Scenario: The report is opened

- **WHEN** the report is opened
- **THEN** the lines after the title and the two stamps are the heading `This month` and its
  sentence, and `About this file` is the second section

### Requirement: The report says what the month has spent against the ceiling

The report SHALL read the clock once, when it is written, and print that instant as `Generated-at:`
on the line after `Generated-from:`. Its first section, `This month`, SHALL open with one sentence
that names the UTC month of that instant, what was spent in it, the monthly ceiling and what is
left, or, at or over the ceiling, says that none is left and that the writer does not run for the
rest of the month.

#### Scenario: The month has room

- **WHEN** the committed records show 0.022748 USD spent in a month and the ceiling is 25 USD
- **THEN** the first section reads `2026-11 so far: 0.022748 USD spent of the 25.00 USD monthly ceiling, 24.977252 USD left.`

#### Scenario: The ceiling is reached

- **WHEN** the spend of the month equals or exceeds the ceiling
- **THEN** the sentence says that none is left and that the writer does not run for the rest of the
  month

#### Scenario: Nothing was spent

- **WHEN** no ledger and no record exists
- **THEN** the sentence still names the month and says 0.00 USD spent, in numbers and not in silence

#### Scenario: The month turns

- **WHEN** the records do not change across the end of a month
- **THEN** the file is not rewritten, and it still names the earlier month beside the instant it was
  stamped at, which says when the figure was true

#### Scenario: The figure says what it counts

- **WHEN** the report is read
- **THEN** `This month` says that the figure counts the ledgers and records committed in the
  repository, and that the ceiling job also counts the spend on branches that are not merged yet, so
  the figure it stops on can be higher

#### Scenario: The file reads no network

- **WHEN** the report is written
- **THEN** it reads the ledgers and records of the working tree and the clock, and no network

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

### Requirement: The report totals every call the machine paid for, each in exactly one row

The report SHALL total, for the month and for all time, four kinds of paid call and their sum: the
writing calls of entries, the repair calls, the runs that ended with no entry, and the spend of a
ledger that no generation record names. A paid call SHALL be in exactly one of the four, so they add
up to the sum, and `site/scripts/spend-sum.mjs` SHALL be the only code that adds them, so that the
report and the ceiling cannot disagree.

#### Scenario: A repair failed

- **WHEN** a ledger holds an attempt whose repair ended with no repaired entry, so no record holds
  its calls
- **THEN** the paid tables count its cost under Repair calls and no entry row shows it

#### Scenario: A run ended with no entry

- **WHEN** one entry cost 0.05 USD and a run that ended with no entry cost 0.027 USD
- **THEN** the all-time entry total reads 0.05, the paid tables read 0.027 under Runs that ended with
  no entry and 0.077 for everything paid for, and the Notes say what the noted runs cost together

#### Scenario: A warned ledger is counted

- **WHEN** a ledger whose verdict is merged records a generation of 0.027 USD and no generation
  record names it
- **THEN** the paid tables count 0.027 USD under Spend with no generation record, the Warnings name
  the ledger and say that its cost is counted there, and the sum includes it

#### Scenario: A ledger holds only repair attempts

- **WHEN** a ledger records no generation, repair attempts of 0.2 USD and no generation record
- **THEN** the sentence that names it states the 0.2 USD, and the paid tables count it

#### Scenario: Each total is the cost of the lines its section lists

- **WHEN** the corpus holds runs that ended with no entry and warned ledgers
- **THEN** the Notes total is the all-time row Runs that ended with no entry, the total the Warnings
  state is the row Spend with no generation record, and the cost of the ledgers each section lists
  adds up to its row

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

### Requirement: An incomplete corpus is reported, not summed in silence

When a ledger records a generation and no generation record carries its slug, when a record names a
ledger that does not exist, when a record and its ledger disagree about writing spend, or when a file
cannot be read, the report SHALL print one sentence naming the slug or the file and what is wrong, in
the form `spendWarnings` in `site/scripts/spend-sum.mjs` already uses for writing spend.

#### Scenario: A record is missing

- **WHEN** a ledger whose verdict is open or merged records a generation and no record carries its slug
- **THEN** the report names the slug and says no entry is counted for it, the entries that do exist
  are still totalled, and the ledger's spend is counted under Spend with no generation record

#### Scenario: A run stopped before it wrote anything

- **WHEN** a ledger is stopped, holds a generation and has no record
- **THEN** the report prints no warning and lists the run under Notes, because no entry was ever meant
  to exist

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

### Requirement: The report is committed with every change to the spend

Every commit that adds a call to a ledger or a record SHALL hold the regenerated report: the
unattended writer's one commit (`site/scripts/write-run.mjs`), a repair commit and the ledger-only
commit of a repair that spent and failed (`site/scripts/repair-finish.mjs`), and the commit of a
failed write (`.github/workflows/write-daily.yml`). Without it `npm run gate:autowriter` fails on
that branch or on `main`.

#### Scenario: A run writes an entry

- **WHEN** the writer commits an article
- **THEN** the same commit holds the report with a row for that article

#### Scenario: A repair adds a call

- **WHEN** a repair attempt adds a repair call to a record and an attempt to its ledger
- **THEN** the same commit holds the report regenerated from them, whose Repair column and paid
  tables count the repair

#### Scenario: A repair fails after it spent

- **WHEN** a repair made model calls and ended in an error
- **THEN** the commit that records its spend holds the regenerated report beside the ledger

#### Scenario: A write fails after it spent money

- **WHEN** the workflow commits the ledger that holds the spend of a failed write
- **THEN** the same commit holds the report regenerated from that ledger

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

### Requirement: An entry is announced as live only when its page answers on the live origin

After the smoke step, `.github/workflows/publish-live.yml` SHALL run `node scripts/live-entry.mjs`, which
asks `site.site`, never the `pages.dev` address, for the page of each new entry through `probeUntilLive`
in `site/scripts/live-probe.mjs`: at most 8 attempts, after waits of 0, 5, 10, 15, 20, 30, 30 and 30
seconds, each request time-limited. A 2xx on the final address after redirects is live; any other status
or a network error is not. The message states the check time in UTC.

#### Scenario: The page answers at once

- **WHEN** the page of a new entry answers 200 to the first request
- **THEN** one live message is posted, and it says that the page answered HTTP 200 on attempt 1 and when
  it was checked

#### Scenario: The page appears late

- **WHEN** the page answers 404 twice and then 200
- **THEN** the live message says the page answered on attempt 3, and no warning is posted

#### Scenario: The page redirects

- **WHEN** the page answers a redirect to an address that answers 200
- **THEN** the page is live, and the message links the address of the entry

#### Scenario: The deploy succeeded and the page does not answer

- **WHEN** the deploy and smoke steps passed and the live origin answers 404 to all 8 attempts
- **THEN** no live message is posted for that entry

### Requirement: An entry that merged and is not reachable is a warning of its own

When the page of a new entry does not answer 2xx after the last attempt, `unreachableMessage` in
`site/scripts/live-slack.mjs` SHALL build a message with the month first and a warning section, `An entry
that merged is not reachable`, naming the slug, the address, the last status or error, the attempts and
the check time, and saying that a person has something to do. `live-entry.mjs` SHALL print a
`::warning::` line, exit zero and leave the entry unannounced, so the next publish checks it again.

#### Scenario: The page never answers 200

- **WHEN** the page answers 404 to every attempt
- **THEN** the warning message names the slug, the address, `HTTP 404`, 8 attempts and the check time,
  one `::warning::` line is printed, the exit code is 0 and the state file does not list the entry

#### Scenario: The connection is refused

- **WHEN** the live origin refuses the connection on every attempt
- **THEN** the warning names the refused connection instead of a status

#### Scenario: One entry is live and one is not

- **WHEN** a publish carries two new entries and only one page answers
- **THEN** the live message names the first, the warning names the second, and only the first is recorded

#### Scenario: The next publish finds the page

- **WHEN** an entry that was unreachable is live at the next publish
- **THEN** it is announced as live, once

### Requirement: Every surface an entry has is a link, listed from the parity derivation

`surfacesOf` in `site/scripts/entry-surfaces.mjs` SHALL list the page and every other surface the entry is
owed (its `.md` sidecar, its social card, the feeds and the `llms` files it entered) by calling
`owedFor` and `SURFACES` of `site/scripts/route-parity.mjs`, the derivation `npm run gate:parity`
judges, and never from a second list. A surface that does not answer 2xx SHALL be plain text,
`<label> (<reason>, checked <time>)`, with a warning section, and the entry is still announced.

#### Scenario: The parity derivation gains a surface

- **WHEN** `owedFor` is owed a new surface for entries
- **THEN** `surfacesOf` returns it with the label and address of the derivation, and the live message
  carries it as a link and asks the live origin for it

#### Scenario: A surface does not answer

- **WHEN** the page answers 200 and its social card answers 404
- **THEN** the card is shown as plain text with its status and check time, a warning section says a
  person has something to do, and the entry is recorded as announced

### Requirement: The live message opens with the month and names the cost and the purpose

Blocks 0 and 1 of the live message SHALL be `monthPart(status)` and the first line of its `text` SHALL be
`monthLineOf(status)`, as in every other message. Each entry SHALL then carry its title, slug, the buyer
prompt of `claim.prompt` in its generation record, its tokens and dollars in tables no wider than
`PHONE_COLUMNS`, and its surfaces as link fields; `text` SHALL carry every one of these facts alone.

#### Scenario: One article is announced

- **WHEN** an article of 12,345 input and 6,789 output tokens that cost 0.123456 USD is live
- **THEN** block 0 is the month header, block 1 the month table, and the entry follows with its title, slug,
  the prompt its record names, the tokens and the cost, and the first line of `text` is the month sentence

#### Scenario: The prompt is read from the record

- **WHEN** the generation record of the entry holds prompt 7 and its passage
- **THEN** the message quotes that number and passage, and never a prompt chosen by any other means

### Requirement: An entry is announced once, and a publish with several says so in one message

`site/scripts/live-state.mjs` SHALL keep `.live-entries.json`, a map of routes to the instant they were
announced, which `publish-live.yml` restores before the live step and saves in the very next step, under
the key `live-entries-${{ github.run_id }}`. A route SHALL be added only when Slack took its live message.
The new entries are those in the build that the map does not list; at most 3 share a message, oldest
first, and none posts nothing and prints one line.

#### Scenario: A publish carries two new entries

- **WHEN** two new entries are live
- **THEN** one message names both, and both are recorded

#### Scenario: The same build is published again

- **WHEN** every entry of the build is recorded
- **THEN** nothing is posted, the live origin is asked for nothing, and one line says that no entry is new

#### Scenario: Slack refuses the message

- **WHEN** the webhook answers 404 to the live message
- **THEN** the entry is not recorded, a `::warning::` is printed, and the next publish announces it

### Requirement: The first run announces only what is recent

With no state file, `live-entry.mjs` SHALL record every entry of the build as announced without a
message, except an entry whose generation record is dated within 48 hours before the publish, which is
announced as usual, so that the whole archive is never announced at once.

#### Scenario: The first run meets an archive

- **WHEN** there is no state file, the build holds 30 entries, and one was generated 5 hours before the publish
- **THEN** that entry is announced, the other 29 are recorded without a message, and the state file exists

#### Scenario: The recent entry fails to post

- **WHEN** the first run cannot deliver the message of the recent entry
- **THEN** it stays unannounced, however old it grows, and the others are still recorded

### Requirement: A missed live message never fails the publish

`deliverNotice` in `site/scripts/slack-notice.mjs` SHALL return whether the message was delivered, and
`live-entry.mjs` SHALL exit zero when Slack does not take it or when a page is unreachable. Exit 1 stays
for input that cannot be read and exit 2 for a command that is not understood. The webhook SHALL appear in
no printed line, no posted message and no state file.

#### Scenario: Slack is unreachable

- **WHEN** the post of a live message fails
- **THEN** the command prints a `::warning::` line, exits 0 and the publish stays green

#### Scenario: The state file is unreadable

- **WHEN** `.live-entries.json` is not JSON
- **THEN** the command exits 1, names the file, posts nothing and leaves the file as it was

#### Scenario: The command is misused

- **WHEN** `--dist` or `--state` is missing
- **THEN** the command exits 2 with its usage and posts nothing

#### Scenario: Slack echoes the webhook back

- **WHEN** the answer to a refused post repeats the webhook address
- **THEN** no printed line, no message and no state file holds it

### Requirement: Publish Live checks the live origin after the smoke step with only the webhook

The step of `.github/workflows/publish-live.yml` that runs
`node scripts/live-entry.mjs --dist dist --state .live-entries.json` SHALL come after the smoke step and
before the IndexNow step, SHALL set `continue-on-error`, and SHALL receive `SLACK_WEBHOOK_URL` as its
only environment, as `site/scripts/publish-live-entry.test.mjs` pins.

#### Scenario: The workflow is read

- **WHEN** the test parses `publish-live.yml`
- **THEN** exactly one step runs the command, after the smoke step and before the IndexNow step, and its
  environment names the webhook and nothing else

#### Scenario: A later step fails

- **WHEN** the IndexNow step fails after the live step
- **THEN** the state was saved by the step that follows the live step, so no entry is announced twice

### Requirement: A report that disagrees with its records is refused

`npm run gate:autowriter` SHALL regenerate the report from `audits/autowriter` with the instant
stamped in the committed file, and SHALL refuse a missing report, a report with no readable
`Generated-at` line and a report that differs from the regeneration, naming the first line that
differs or the missing line.

#### Scenario: A record is added and the report is not

- **WHEN** a generation record is committed and `audits/spend-report.md` is left as it was
- **THEN** the gate exits non-zero with `spend-report-differs`

#### Scenario: A figure is edited by hand

- **WHEN** a figure in the committed report is changed and no record changed
- **THEN** the gate exits non-zero with `spend-report-differs` and names the line

#### Scenario: The instant is removed

- **WHEN** the `Generated-at` line is deleted from the committed report
- **THEN** the gate exits non-zero with `spend-report-differs` and names `Generated-at`

#### Scenario: The report is deleted

- **WHEN** `audits/spend-report.md` does not exist
- **THEN** the gate exits non-zero with `spend-report-missing`, even when no record exists

### Requirement: The proof of the report guard does not depend on what the report says today

Each planted specimen of the report guard SHALL pin a token that the gate prints for every state of
the committed report, and a specimen that adds a record SHALL date it at the stamp of the committed
report, so that the proof holds for a report with no entry, a report with notes and a report with
entries alike.

#### Scenario: The first entry is merged

- **WHEN** the committed report goes from the variant with no entry to one that lists an entry
- **THEN** every specimen of the report guard still turns `gate:autowriter` red on the plant and
  leaves it green without it

#### Scenario: The report is stamped in another month

- **WHEN** the committed report is stamped in a month other than the one the specimen was written in
- **THEN** the specimen that adds a record files it in the month of the stamp, and the gate is red on it

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

### Requirement: A topic proposal is part of the entry's cost

The model call that proposes the topic of a category entry SHALL be recorded in the entry's
generation record with the role `topic`, and every proposal call the run made for that entry,
including the proposals that were refused, SHALL be recorded the same way. The monthly ceiling and
the spend report SHALL count those calls with the draft and correction calls of the entry.

#### Scenario: A category entry costs a proposal and a draft

- **WHEN** a category entry is written after one refused proposal, one accepted proposal and one
  draft
- **THEN** the generation record lists three calls, its totals equal their sum, the ledger's
  generation figure equals the same sum, and the monthly ceiling counts it

#### Scenario: Every proposal is refused

- **WHEN** a run proposes for every configured category and every proposal is refused or fails
- **THEN** the run ends without an entry, the spend of the proposals is printed in the run's
  summary, and no ledger exists to carry it because no entry has a slug
