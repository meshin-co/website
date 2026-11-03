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

## The entry is live: a fact checked, not a step that passed

The spend message says an entry was written, and the pull request that carries it merges later, when
`Publish Live` is pressed by hand. A deploy step that exits zero says Cloudflare took an upload. The
owner wants the moment a page can be clicked, so `site/scripts/live-entry.mjs` runs after the smoke step
and asks for the page itself.

**The origin is `site.site`.** The address the visitor and the search engines use is
`siteOrigin(SITE_CONFIG)` from `site/scripts/links-gate.mjs`, the same function the spend message uses
for its entry links. The `pages.dev` address is the one the smoke step already proves, and a custom
domain that does not answer is exactly what this message exists to catch.

**The probe is bounded.** `probeUntilLive` in `site/scripts/live-probe.mjs` asks up to 8 times, after
waits of 0, 5, 10, 15, 20, 30, 30 and 30 seconds, 140 seconds of waiting in all, plus the time of the
requests themselves, so a page that appears inside that time is found and a page that does not is reported at its end. Each request has a time
limit, redirects are followed, and a 2xx on the final address is live; any other status and any network
error is not. The check time is the clock of the last attempt, printed in UTC to the second with the
number of attempts. `fetch`, `sleep` and `now` are arguments, so the tests wait for nothing.

**Entries and surfaces are probed concurrently.** A publish of three entries with six surfaces each is
probed in one pass, not in series. The page decides live or not; a surface that does not answer does
not stop the announcement, because the owner can still click the page. It is shown as plain text,
`<label> (HTTP 404, checked <time>)`, with a warning section, and the entry is recorded as announced:
a later publish does not check an announced entry again.

## Surfaces are derived once

Change `25-every-route-gets-every-surface` made `owedFor` and `SURFACES` in
`site/scripts/route-parity.mjs` the one list of what a route owes, and `npm run gate:parity` judges the
build against it. `surfacesOf` in `site/scripts/entry-surfaces.mjs` calls them for an entry, so the page,
its `.md` sidecar, its social card, the feeds and the `llms` files it entered are listed from the
derivation that the gate itself uses. A second list would drift: the day the derivation gains a
surface, a hand-kept list would not. `site/scripts/entry-surfaces.test.mjs` and
`site/scripts/live-entry.test.mjs` plant a surface in the derivation and require the list, the
message and the requests to the live origin to gain it. A surface that is a fact about the head of the
page, not an address of its own, adds no link.

## Announce once, and what the first run does

An entry is announced once, for as long as its memory lives. The state is a small JSON file,
`.live-entries.json`, a map from route to the instant it was announced, written by
`site/scripts/live-state.mjs` and read with the spend records by `site/scripts/entries-in-build.mjs`. A
runner has no disk between presses, so the workflow restores it with `actions/cache/restore@v4` and saves
it with `actions/cache/save@v4`, key `live-entries-${{ github.run_id }}` and `restore-keys: live-entries-`.
The file is git-ignored. The combined `actions/cache@v4`, which `.indexnow-routes.json` uses, was not
used, because it saves only in a post step that runs when the whole job succeeded: a later step that
failed would drop the memory and the next publish would announce the same entry again. GitHub evicts
a cache entry that nobody has used for 7 days, so a gap that long between publishes forgets the memory, the
same limit `.indexnow-routes.json` has.

An entry is recorded only when Slack took its live message, which is why `deliverNotice` now returns
whether it delivered. A message Slack refused leaves the entry unannounced, and the next publish
announces it. The entries a publish carries are the rows of the spend model whose built page exists in
`dist`, minus the recorded routes, oldest first; up to three share one message and a larger set takes
as many messages as it needs, none twice. A publish with no new entry posts nothing and prints one line.

The first run has no file, and the archive holds every entry the writer ever made. Announcing all of
them would be a flood of messages about pages that went live long ago. So with no file every entry is
recorded as announced without a message, except an entry whose generation record is dated within 48
hours before the publish, which is announced as usual. The 48 hours is this project's own allowance,
not a measured one. An entry among them whose message fails stays unannounced, however old it grows.

## A merged entry that does not appear is a warning

When the page does not answer after the last attempt, the entry is not recorded and
`unreachableMessage` builds a message that opens with the month, as every message does, and then a
warning section, `An entry that merged is not reachable`, naming the slug, the address, the last status
or error, the attempts and the check time, and saying that a person has something to do. The command also
prints a `::warning::` annotation. It exits 0: the deploy has happened and the publish is not the thing
that failed. The next publish finds the entry unannounced, checks it again and warns again until the
page answers, and then announces it as live.

## The workflow and the webhook

`publish-live.yml` runs the cache restore, the step and the cache save after the smoke step and before the
IndexNow step, so that the step does not depend on IndexNow and IndexNow cannot undo it. The step sets
`continue-on-error`, so a failure of its own, such as a build that cannot be read, never fails the job.
Its environment is `SLACK_WEBHOOK_URL` and nothing else: the runner supplies `GITHUB_SERVER_URL`,
`GITHUB_REPOSITORY` and `GITHUB_RUN_ID` for the run link. A post that fails is the `::warning::` of
`deliverNotice`. The webhook is in no printed line, no message and no state file, and
`site/scripts/live-entry.test.mjs` plants it in an answer from Slack to prove it.
`site/scripts/publish-live-entry.test.mjs` pins the order, the key and the environment.
