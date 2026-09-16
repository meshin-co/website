# Smoke the Live Site

`npm run smoke:prod <origin>` makes 18 real requests against a running origin and writes
`audits/phase-5/smoke-prod.md`. It is the scripted half of the Calibration Gate's edge checks,
which were prose until 2026-09-15.

    npm run smoke:prod https://meshin.co

Default origin is `https://meshin.co`. Any origin works, which is how the check is proven:

    GATE_SERVER_PORT=4340 node scripts/gate-server.mjs dist &
    npm run smoke:prod http://127.0.0.1:4340

## What it asserts

- All six security headers are present, and the CSP carries neither `unsafe-inline` nor
  `unsafe-eval`. Verified on the response, never read from the source header file.
- The home page does not carry a `noindex` robots meta. Removing it is what the launch flip does,
  so this is the check that proves the flip happened.
- Ten canonical routes and six machine surfaces answer 200. A 301 fails: after the flip a
  canonical route lands directly, and a redirect means the apex or the trailing-slash rule is
  wrong.

## Proven able to fail

Serve `dist/` with a plain server that sends no headers and the gate reports 8 of 18, naming every
missing header and every 301. Run it that way after changing the checks; a smoke test that cannot
fail is decoration.

    cd dist && python3 -m http.server 4344 --bind 127.0.0.1 &
    node scripts/run-smoke-prod.mjs http://127.0.0.1:4344 /tmp/planted.md

## When the flip happens

Run it against the production URL immediately, commit the artifact, and strike the matching line
from `docs/plan/phases/phase-5-launch.next.md`. CG-5 is not closed until this file records a pass
against `https://meshin.co`.
