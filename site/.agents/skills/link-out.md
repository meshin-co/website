# Link Out

Every link that leaves `meshin.co` carries exactly one rel value:

    rel="nofollow noopener noreferrer"

`npm run gate:external` reads every anchor in `dist/` and fails when an outbound link is missing
any of the three. The rule lives in `scripts/external-links.mjs` with tests in
`scripts/external-links.test.mjs`; `scripts/run-external-links.mjs` walks the build. It is a cheap gate, so it runs on every commit that touches the build.

## Why all three, and what each one stops

- **nofollow** — the site does not pass ranking signal to a standards body, an app store or a
  booking service. Those pages need no help from us, and PageRank that leaves does not come back.
- **noopener** — the opened page cannot reach back through `window.opener` and navigate ours.
- **noreferrer** — the destination is not told which page sent the visitor. It also implies
  `noopener` in current browsers, and is stated anyway because the gate checks the written value,
  not what a browser infers.

Extra tokens are allowed beside the three. `me` on an identity link and `sponsored` on a paid one
both pass.

## Where the value comes from

One place: `EXTERNAL_REL` in `src/utils/pipeline.mjs`.

- **Markdown bodies** get it from the `rehypeExternalLinks` pass, wired in `astro.config.ts`. An
  author writes a plain `[text](https://…)` link and the pass adds the rel and strips `target`.
- **Components and templates** use `externalRelAttrs(href)`, which returns the rel for an outbound
  href and an empty object for an internal one. Spread it: `{...externalRelAttrs(href)}`. Never
  type the three tokens by hand into a new component.

## The cache trap, which cost an hour

Astro's content layer caches rendered markdown in `node_modules/.astro`, not only in `.astro`.
After changing a rehype pass, `rm -rf .astro dist` is **not** enough: the old HTML comes back and
the gate keeps reporting links you have already fixed. Clear both:

    rm -rf node_modules/.astro .astro dist && npm run build

The plugin was correct for four rebuilds while the gate stayed red. Test the pass in isolation
first — `node -e "import('./src/utils/pipeline.mjs')…"` — and if it emits the right rel, suspect
the cache before you suspect a second renderer.

## Proven able to fail

`test:smoke` family `external-link-rel` writes a one-page site whose only link carries
`rel="noopener"` and asserts the gate names the missing `nofollow`. Run it after touching the rule.

## Whether the destination is still there

`gate:external` judges the markup; `gate:links` judges the links inside the build. It never fetches a
host outside it, so a gone outbound address never fails it: a third party's page is not a defect in
this change. It still fails on a link inside the build that does not answer, and on an outbound
address that is no address (whitespace, no parse, a host that is not a domain). linkinator crawls the
build alone, `scripts/outbound-links.mjs` reads the outbound addresses from `dist/` and
`scripts/links-gate.mjs` judges both. Smoke families `link-to-a-missing-route` and
`malformed-outbound-address` prove it can fail.

`scripts/link-probe.mjs` tells a gone address from a live one, for the sweep that repairs it. GET only:
linkinator kept a HEAD's 404 when its one follow-up GET failed, and NIST answers HEAD 404 and GET 200
for a live PDF (33 pages red in CI, 2026-11-03). Dead means two GETs answered 404 or 410; a timeout,
403, 429 or 5xx is `unverified`, never dead. The probe says who it is, because Cloudflare answers a
Chrome user agent sent from Node with a 403 challenge.

## A cited address that has gone

The reader follows an Internet Archive snapshot taken near the date the source was cited, never the
newest capture, which can be a different document. A source row keeps both addresses:

    url: https://web.archive.org/web/20251025031200/https://example.com/standard
    original: https://example.com/standard

`url` is what the page links to, so every consumer keeps working and the anchor still takes its rel
from `EXTERNAL_REL`. `original` is what was cited: `src/content.config.ts` refuses an `original`
that `url` is not a snapshot of, and the unattended writer binds its claims to the cited address.

`scripts/wayback.mjs` asks for the capture nearest the date, inside a window; `scripts/snapshot-support.mjs`
checks it still carries the title; `scripts/citations.mjs` rewrites the rows in place. No job calls them
yet, and the search-link rung that follows a missing snapshot is not built.
