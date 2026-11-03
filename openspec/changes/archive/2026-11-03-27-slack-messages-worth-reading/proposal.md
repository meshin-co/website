# Make every Slack message worth reading

## Why

Change `21-report-what-it-spends` and change `20-write-without-a-human` made the unattended writer
post to Slack: the figures after every generation, a line for a day that ends with no entry, and an
escalation when a person has to act. All three were plain text. On a phone that text had three faults.
The month against the ceiling, which is the number the owner decides on, was the second block and
sat under the entry. Figures that are meant to be compared, token counts and costs, were lines of
prose that did not line up. And nothing was clickable: the pull request, the workflow run, the
published entry and the escalation issue were named and the owner had to go and find them.

A fourth fault was in the failure semantics. A message that Slack did not take ended its step red,
and the workflow has no `continue-on-error`, so a Slack outage turned a job red after the entry, the
ledger and the report were already committed. The red step carried no information that the next
message and the report do not carry.

## What changes

**Every message is a Block Kit message with a fallback.** The spend message, the no-entry message and
the escalation message are each `{ text, blocks }`, built from one set of pieces in
`site/scripts/slack-blocks.mjs`. `text` stays the fallback a phone notification shows, so a person who
never opens the message still reads what happened. The builders refuse a block over a limit Slack
documents and escape `&`, `<` and `>`.

**The month comes first.** Block 0 is a header, `<month> spend against the monthly ceiling`, and
block 1 is the table of Spent, Ceiling and Left. The first line of the fallback is the sentence
`monthLineOf` builds from the ceiling status. The earlier spec said the month is the second block;
that wording is replaced.

**Figures that are compared are in preformatted tables.** The month, the token counts and the costs
are in code fences padded by `monoTable` in `site/scripts/slack-table.mjs`, so they line up at the
decimal point. No table line is wider than 34 characters. `fields` hold only key and value link
columns: Pull request, Workflow run, Escalation issue and What the run cost.

**Every clickable reference is a Slack link.** The pull request (`#84`), the workflow run (`run 777`),
the published entry and the escalation issue (`#41`) are written as `<url|label>`. The GitHub
addresses come from `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and `GITHUB_RUN_ID` in
`site/scripts/github-links.mjs`, and the entry address from `site.site` in `site/src/config.yaml`. The
spend step receives the pull request number as `PULL_REQUEST`; with no number there is no link.

**A warning is something a person does.** Zero warnings is one quiet context line. One or more is a
section `Warnings: N` that says each needs a person to look at it, lists at most three and names
`audits/spend-report.md` for the rest. Notes, which are facts nobody can clear, never appear in the
message.

**A missed statistics message no longer turns the job red.** `deliverNotice` prints
`::warning::<label>: slack NOT delivered: <reason>` and the command exits 0. Exit 1 and 2 stay for
causes that are not delivery: an unreadable result, a slug with no generation record, a misused
command.

## What this does not change

An escalation that Slack did not receive is still a failure. `escalate.mjs`, `escalate-run.mjs`, the
watcher in `pr-watch.mjs` and `spend-notice.mjs` keep their receipts, `EscalationError` and non-zero
exit, because `requiredChannels` names Slack for an immediate kind and `npm run gate:autowriter`
refuses an escalation that has no delivered receipt. The webhook still appears in no output.

The ceiling, the report, its windows and the paid tables are unchanged, and so is what the messages
say: the same figures, in a different layout.

Out of scope: Slack's native `table` block. Its documentation covers `chat.postMessage` only, whether
an incoming webhook accepts it is undocumented, and how a phone renders it is unknown. The tables stay
in code fences until a measurement says otherwise.
