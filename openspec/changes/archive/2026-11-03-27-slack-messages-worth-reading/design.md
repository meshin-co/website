# Design

## One builder for every message

Each message is a list of parts. A part is `{ blocks, text }`: the blocks it adds and the lines it adds
to the fallback. `assemble` in `site/scripts/slack-blocks.mjs` concatenates the blocks, joins the
non-empty fallbacks with a blank line, and refuses a message with no fallback or more than 50 blocks.
The spend message, the no-entry message and the escalation message are built the same way, so the
month part is one function, `monthPart`, used by the first two.

The limits Slack documents are enforced where a block is made: 3000 characters in a section, 2000 in a
field, 10 fields, 10 context elements, 150 in a header and 50 blocks. A block that would exceed one
throws, except the header and the fallback, which are shortened with an ellipsis, because a long
title must not stop the escalation that carries it.

## Tables in code fences, not in fields

`fields` lay out in two columns whose widths Slack decides and which are proportional, so two numbers
in them never line up. A code fence is monospaced, so `monoTable` pads each column itself and aligns a
decimal column on its point. The limit of 34 characters per line, `PHONE_COLUMNS` in
`site/scripts/slack-table.mjs`, is this project's own: Slack documents no width for a code block on a
phone, so it is a measured allowance, and the test of a message fails when a line passes it.

`fields` stay for what they are good at, short key and value columns whose values are links: Pull
request, Workflow run, Escalation issue, What the run cost.

Slack's native `table` block was not used. Its documentation covers `chat.postMessage`, whether an
incoming webhook accepts it is undocumented, and its rendering on a phone is unknown. A message that a
webhook rejects is a message nobody reads.

## Links are built from the environment

`site/scripts/github-links.mjs` reads `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and `GITHUB_RUN_ID` and
returns `null` for any link the environment does not name. No host is written in the code, so a fork
or a GitHub Enterprise server gets its own addresses, and a local run gets no link rather than a wrong
one. A builder that receives `null` prints the label without a link. An address that is not `http` or
`https`, or that holds a space, a `|`, a `<` or a `>`, is also printed as plain text, because it would
break the link syntax.

The entry address is the origin of the site, `site.site` in `site/src/config.yaml`, followed by
`/blog/<slug>` or `/glossary/<slug>`, from `entryRoute`. The pull request number reaches the spend step
as `PULL_REQUEST`, set by the workflow from the output of the step that opens the pull request.

## Delivery failure

Before, `spend-ended.mjs` and `spend-report.mjs notify` exited 1 when Slack answered non-2xx or was
unreachable. The workflow steps have no `continue-on-error`, so the job went red, after the entry,
the ledger and the report were committed. The old spec called that "a red step and nothing more".

`deliverNotice` in `site/scripts/slack-notice.mjs` now prints `::warning::<label>: slack NOT
delivered: <redacted reason>` on stderr, which GitHub shows as an annotation on the run, and the
command exits 0. The reason is the receipt line of an escalation, passed through `redactorFor`, so the
webhook never appears.

An escalation is different, and its behaviour is deliberately unchanged. `requiredChannels` names the
issue and Slack for an immediate kind, a failed channel makes `escalate()` throw `EscalationError`, and
`deliveryProblems` in `npm run gate:autowriter` refuses a ledger whose immediate escalation has no
delivered receipt. Making that quiet would let a person-needed failure pass unseen.

## Warnings and notes

The report separates a warning, something a person can clear, from a note, a fact nobody can. The
message follows the same line: a warning count of zero is a context line that says what zero does and
does not mean, a count above zero is a section, and a note is never in the message.
