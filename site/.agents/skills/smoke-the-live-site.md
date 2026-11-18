# Smoke the Live Site

`npm run smoke:prod <origin>` makes 31 real requests against a running origin, 33 on the apex, and writes its report
under `audits/phase-local/`, which git ignores, so an ad-hoc run leaves the tree clean. It is the
scripted half of the Calibration Gate's edge checks, which were prose until 2026-09-15.

    npm run smoke:prod <origin>

Default origin is `https://` plus `site.name` from `site/src/config.yaml`. Any origin works, which is
how the check is rehearsed:

    WRANGLER_SEND_METRICS=false npx wrangler pages dev dist --port 4340 --persist-to "$(mktemp -d)" &
    npm run smoke:prod http://127.0.0.1:4340

`wrangler pages dev` runs `dist/_worker.js` and the real `_headers`, so the rehearsal passes 31 of 31
and exits 0. Every canonical route here is emitted without the trailing slash and built as
`<route>.html`, and a canonical route that answers 308 means the build went back to directory output
(`build.format` in `site/astro.config.ts` must stay `'file'`) or a route is emitted in the wrong
form.

The gate server answers the way Pages does for a flat build, but it does not run the edge handler,
so against it 27 of 31 pass and the four that fail are the ones that ask for markdown or for
`Vary: Accept`. It prints at start what else it does not model.

## What it asserts

- All six security headers are present, and the CSP carries neither `unsafe-inline` nor
  `unsafe-eval`. Verified on the response, never read from the source header file.
- The home page does not carry a `noindex` robots meta. Removing it is what the launch flip does,
  so this is the check that proves the flip happened.
- Ten canonical routes and six machine surfaces answer 200. A 301 or 308 fails: after the flip a
  canonical route lands directly, and a redirect means the apex or the trailing-slash rule is
  wrong.
- `www` answers 301 to the apex, for `/` and for `/about`, with the path kept. Only when the
  origin is the real host: a rehearsal against `127.0.0.1` has no `www` to ask, so it reports 31
  of 31 while production reports 33 of 33.
- The home page answers markdown to `Accept: text/markdown`, and both answers name `Accept` in
  `Vary`, so a cache cannot hand one representation to a client that asked for the other.
- Six `Accept` headers that a quality value decides: a refusal, a lower weight, a malformed or empty
  weight and a type inside a quoted parameter must get the page, and `*/*;q=0, text/markdown` must
  get markdown.
- For four path shapes (`/about/`, `/index`, `//about`, `//x/about`) markdown and HTML answer the
  same status and the same redirect, and no markdown answer carries a `content-location` that begins
  with two slashes, which would name a host.

## Proven able to fail

Serve `dist/` with a plain server that sends no headers and the gate reports 17 of 31, naming every
missing header, every 301 and every 404, because the plain server knows nothing of `<route>.html`.
Run it that way after changing the checks; a smoke test that cannot fail is decoration.

The two `www` rows cannot be reached that way, because the plain server is not the apex. They are
proven in `scripts/smoke-prod.test.mjs`, where `canonicalHostVerdict` fails a 200, a 302 and a 301
to the wrong path.

    cd dist && python3 -m http.server 4344 --bind 127.0.0.1 &
    node scripts/run-smoke-prod.mjs http://127.0.0.1:4344 /tmp/planted.md

The negotiation rows are proven in `scripts/run-smoke-prod-negotiation.test.mjs`: it runs the real
runner against the real worker and every one passes, then plants five faults in the worker (a quality
value read as a request, no `Vary`, a label naming a host, and the slash form and the `/index` form
answered with markdown) and asserts that exactly the rows naming each fault fail.

## When the flip happens

Run it against the production URL immediately, naming the committed artifact as the second
argument, and commit that file. The default path is ignored on purpose: a run without it never
overwrites the phase 5 record.

    npm run smoke:prod <origin> ../audits/phase-5/smoke-prod.md

That artifact is the only evidence this repository can produce about the live origin: Lighthouse
starts the gate server against the build and takes no origin, so no score here describes what the
edge served. Row G44 of `docs/plan/reference/known-gaps.md` holds that gap.
