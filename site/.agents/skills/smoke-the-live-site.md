# Smoke the Live Site

`npm run smoke:prod <origin>` makes 18 real requests against a running origin and writes
`audits/phase-5/smoke-prod.md`. It is the scripted half of the Calibration Gate's edge checks,
which were prose until 2026-09-15.

    npm run smoke:prod https://meshin.co

Default origin is `https://meshin.co`. Any origin works, which is how the check is rehearsed:

    GATE_SERVER_PORT=4340 node scripts/gate-server.mjs dist &
    npm run smoke:prod http://127.0.0.1:4340

The gate server answers the way Cloudflare Pages does for a flat build: `/about` is 200, while
`/about/` and `/about.html` are a 308 to `/about`, and `/` is 200. Every canonical route here is
emitted without the trailing slash and built as `<route>.html`, so the rehearsal passes 18 of 18
and exits 0. A canonical route that answers 308 means the build went back to directory output
(`build.format` in `site/astro.config.ts` must stay `'file'`) or a route is emitted in the wrong
form.

## What it asserts

- All six security headers are present, and the CSP carries neither `unsafe-inline` nor
  `unsafe-eval`. Verified on the response, never read from the source header file.
- The home page does not carry a `noindex` robots meta. Removing it is what the launch flip does,
  so this is the check that proves the flip happened.
- Ten canonical routes and six machine surfaces answer 200. A 301 or 308 fails: after the flip a
  canonical route lands directly, and a redirect means the apex or the trailing-slash rule is
  wrong.
- `www` answers 301 to the apex, for `/` and for `/about`, with the path kept. Only when the
  origin is the real host: a rehearsal against `127.0.0.1` has no `www` to ask, so it reports 18
  of 18 while production reports 20 of 20.

## Proven able to fail

Serve `dist/` with a plain server that sends no headers and the gate reports 8 of 18, naming every
missing header, every 301 and every 404, because the plain server knows nothing of `<route>.html`.
Run it that way after changing the checks; a smoke test that cannot fail is decoration.

The two `www` rows cannot be reached that way, because the plain server is not the apex. They are
proven in `scripts/smoke-prod.test.mjs`, where `canonicalHostVerdict` fails a 200, a 302 and a 301
to the wrong path.

    cd dist && python3 -m http.server 4344 --bind 127.0.0.1 &
    node scripts/run-smoke-prod.mjs http://127.0.0.1:4344 /tmp/planted.md

## When the flip happens

Run it against the production URL immediately, commit the artifact, and tick the matching box in
`openspec/changes/archive/2026-10-24-11-launch/tasks.md`. CG-5 is not closed until the artifact records a pass
against `https://meshin.co`.
