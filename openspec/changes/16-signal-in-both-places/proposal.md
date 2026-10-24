# Say the AI terms where the readers actually look

## Why

Change 15 put the Content Signals policy in a response header and forbade the `robots.txt`
directive, because Lighthouse 12.6.1 called `Content-Signal` an unknown directive and scored SEO
0.92 on all 26 audited routes, against a hard rule of 100 with no waiver. The scanner at
`isitagentready.com` parses `robots.txt` and nothing else, so the check stayed red and row G45
recorded the loss.

The premise is gone. Lighthouse added `content-signal` to its directive safelist in 13.1.0;
`core/audits/seo/robots-txt.js` carries it in every release from 13.1.0 to 13.5.0. The gate ran
12.6.1 only because `@lhci/cli@0.15.1` pins it, and 0.15.1 is still the newest release.

So the trade-off was never between the two statements. It was between one statement and an old
copy of the measuring tool.

## What changes

**The signal is stated in both places, and they must agree.** `robots.txt` carries
`Content-Signal: search=yes, ai-input=yes, ai-train=yes` in all 23 user-agent groups, and every
response carries the same value as a header. One constant, `CONTENT_SIGNAL` in
`site/scripts/gen-headers.mjs`, is the single definition both read, so they cannot drift by typing.

**The gate refuses disagreement, not just absence.** `robotsSignalGaps()` compares every group
against the header word for word and names both values when they differ. A group added without the
directive is named by the agent it was added for.

**The gate measures with Lighthouse 13.5.0.** An `overrides` entry lifts the copy `@lhci/cli` would
otherwise pin. This also moves the measurement to the engine PageSpeed Insights runs today, which
is the version a reader of our scores would compare against.

## What this does not change

The byte budgets, the route set, the 100/100/100/100 bar and every other gate stay as they were.
The full calibration was re-run on 13.5.0 before this proposal was written: 8 shards, 0 failures.

Row G45 closes. Its three options are moot, because the cost it described no longer exists.
