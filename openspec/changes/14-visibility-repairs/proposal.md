# Repairs to what readers and retrievers actually receive

## Why

A six-perspective investigation on 2026-10-14 measured the site against what search engines and AI
assistants consume, and against how a reader reads a page. It found defects, not opportunities:
each item below is something the site does today that works against being found, understood or
trusted. The citation baseline it was measured from is `audits/geo-probe.json`: 120 answers, 62
with retrieval, zero citations — measured while the apex is unattached and the build is served
`noindex`, so it records the starting line rather than a failure.

## What changes

**The site publishes its own absence.** `/case-studies` says "Nothing is published yet" in HTML,
in its Markdown mirror, in the search index and in a feed. The most commercial query in the
semantic core is a case-study query, and the page that answers it is an admission. It becomes
unindexed and leaves the machine outputs until it has content.

**The machine corpus is unreachable.** `/llms.txt` is linked from nothing in the built output, and
the per-collection files under `/llms/` ship without the `noindex` rule their siblings carry. A
file no page references is a file a crawler reaches only by guessing.

**Updates are never announced.** `site/scripts/indexnow-ping.mjs` compares route sets, so a
rewritten article on an existing route changes nothing it can see and is never announced. Only a
new or deleted route triggers a ping.

**An ordered list that is not ordered, and ordered lists with no numbers.** The home page renders
its drivers as `<ol>`, claiming a sequence that does not exist, while the sequences that do exist —
"The order I work in", "What I measure", and the service process — render with no visible numbers
in a two-column grid, where a reader cannot tell whether to read down or across. Numbers are list
markers, not the numbered section labels L9a removed.

**Every footer link looks like a link.** Nineteen underlines in one block. In the footer the
underline carries no information: the whole block is navigation. Resting state becomes muted text;
underline and colour arrive on hover, focus and activation, so keyboard users lose nothing.

**A heading that disowns the rest of the site.** "In my words" implies the other words are someone
else's. It becomes "The detail".

## Out of scope

Off-site presence, the apex, and the search consoles: those belong to `11-launch` and need the
owner. Google Analytics and anything needing a published controller: deferred with change 13.
