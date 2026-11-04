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

## What blocks and what never does

**Blocks:** a missing `nofollow noopener noreferrer` (`gate:external`); a link inside the build that does not answer, an
outbound address that is no address (whitespace, no parse, a host that is not a domain) and a register whose digest does
not match its rows (`gate:links`); an `original` that `url` does not stand in for (the build). `test:smoke` plants each:
`external-link-rel`, `link-to-a-missing-route`, `malformed-outbound-address`, `link-rot-register-hand-edited`,
`source-original-must-match-its-stand-in`.

**Never blocks, and never stops a pipeline:** a gone outbound address, a citation resting on a search link, an
`unverified` host (403, 429, 5xx, timeout, no answer) and the archive being down. `gate:links` reads the outbound
addresses from `dist/` with `scripts/outbound-links.mjs` and never fetches one: a third party's page is not a defect in
this change. `scripts/link-probe.mjs` judges them, by GET only: linkinator kept a HEAD's 404 when its follow-up GET
failed, and NIST answers HEAD 404 and GET 200 (33 pages red in CI, 2026-11-03). Dead is two 404 or 410 and no 2xx.

## A cited address that has gone

A source row keeps `url`, what the page links to, and `original`, what was cited:

    url: https://web.archive.org/web/20251025031200/https://example.com/standard
    original: https://example.com/standard

Every consumer keeps working on `url`, and the anchor still takes its rel from `EXTERNAL_REL`. The unattended writer
binds its claims to `original ?? url`. `src/content.config.ts` refuses an `original` that `url` does not stand in for:
its Internet Archive snapshot, or the search for the source's own `title` and `publisher`.

The job takes three rungs and ends in no failure and no guess at another source. (1) The cited address, while it
answers. (2) The Internet Archive capture nearest the day it was cited (`retrieved`, else `updatedDate`), never the
newest, which can be a different document. (3) When the archive holds nothing usable, a search for the title and
publisher: a search for the dead address finds nothing, one for its title finds where the page moved.

The machine rewrites addresses, never words, so the claim beside a stand-in still describes the page that was cited. The
signals are the note the page prints (`Internet Archive copy, captured <day>`, or `the original page has gone; this link
is a search for it`) and the generated register `audits/link-rot.json`. A person acts only on an `unplaced` row (an
address no entry can be repaired for), or to replace a search link with a source read in a browser.
`.github/workflows/repair-links.yml` runs `scripts/repair-links.mjs` daily; `repair-a-dead-citation.md` has the files.
