# Diagnose an LCP Plateau

An LCP that lands on the same value to within a millisecond across every route and every run is
not variance. `throttling-method=simulate` computes LCP from the request graph, so a plateau means
a fixed structural cost, and re-running it three times proves nothing.

## Find the gating resource by removing it

Serve `dist` through the gate server, then measure with the settings from `lighthouserc.cjs` while
blocking one class of resource at a time:

    npx lighthouse http://127.0.0.1:4340/ --throttling-method=simulate \
      --throttling.requestLatencyMs=562.5 --throttling.downloadThroughputKbps=1474.56 \
      --blocked-url-patterns="*woff2*"

Compare LCP against the unblocked run. On 2026-09-15 this separated three candidates in minutes:
inlining all CSS moved FCP 1055 to 904 and left LCP unchanged, so CSS was not the gate; blocking
fonts moved LCP 1504 to 1355, so fonts cost 150 ms; and the largest single cost was not on the
page at all.

## Check whether the gate's own config inflates the number

`lighthouserc.cjs` blocks `*plausible.io*` for determinism. A blocked request still sits in the
simulated graph: the same build measured **1806 ms blocked and 1504 ms unblocked**. Before
optimising anything, measure both ways. If the gap is large, the finding is in the measurement or
in the critical path, not in the content.

The fix that holds in both places is to keep the third party out of the initial graph.
`Analytics.astro` appends the Plausible tag on the window `load` event from a hashed inline
script, so a blocked, failed or slow third party cannot move LCP. That took the gate from 1806 to
1656 against an 1800 budget.

## Byte weight on the critical path still matters

The same run had 63 KB of the 101 KB HTML in two copies of the inline brand mark, one in the
header and one in the footer: 180 paths and 170 gradients per page. `generate-logo.mjs` now emits
the geometry once as a `<symbol>` mounted by `PageLayout.astro`, and `LogoMark.astro` is a `<use>`
reference. HTML fell to 69 KB, gzip 20.3 KB to 14.7 KB.

Mind the CSP when you do this: the symbol's `style="position:absolute"` was an inline style
attribute, which `style-src 'self'` blocks, and best-practices dropped to 0.93 on all 28 routes
before it became a `logo-symbol` utility class. Hashing covers inline `<style>` elements, never
style attributes.
