# Run the Pre-Launch Checklist

`npm run audit:prelaunch` walks the 24-section pre-launch checklist from
`'/Users/developer/.agents/skills/ctxr-skill-frontend-excellence'` against the shipped build and writes
`audits/phase-5/pre-launch.md`. Takes about 4 minutes, because it runs the axe suite and both
other browser engines on the way.

    npm run build
    GATE_SERVER_PORT=4340 node scripts/gate-server.mjs dist &
    npm run audit:prelaunch

## Four statuses, and the rule behind them

`pass` means a command or an artifact said so in this run. `n/a` names why the item cannot apply
to this site. `owner-blocked` names what is missing and who holds it. `fail` exits the runner
non-zero.

**A typed `pass` with no command behind it is prohibited.** Every passing row is derived: a gate
exit code, a Playwright run, a measurement over `dist/`, or a git query. The first draft of this
runner hard-coded seven rows to `pass` with prose evidence; that is the fake-green this project
exists to prevent, and it was replaced with derivations before the artifact was ever committed.

Three rows are permanently `owner-blocked` and say so: the screen-reader pass, the live-edge
header check, and the human smell test. They are judgement or production access, not
measurement.

## Detector precision

The checks live in `scripts/pre-launch.mjs`; `scripts/run-pre-launch.mjs` is the driver. Each
detector carries precision controls with tests, because the first run produced four failures and
three were the detector's own noise:

- a colour literal inside a `//` comment is an issue reference, not a colour
- `theme-color` and `mask-icon` colours cannot come from a token, because they paint browser
  chrome
- generated components (`LogoSymbol.astro`, `LogoMark.astro`) are emitted by
  `scripts/generate-logo.mjs`, so their gradient stops are not hand-authored
- `border-bottom-color` is not a layout transition, even though it ends in a layout word

The fourth was real: the runner called `editorial-gate.mjs` with the wrong arguments and read the
sweep's prose instead of its count. Both are now derived from the same strings the gates print.

## When a row fails

Read the row's evidence, reproduce the named command, and fix the site or the detector; never the
artifact. If the detector was wrong, the fix needs a test that fails on the old rule, the same
discipline as the editorial ledger.

## Cross-browser, and what its flake means

`tests/cross-browser.spec.ts` runs the 105 derived routes through WebKit and Gecko: the first
heading paints, the document does not scroll sideways at 375 or 1280 px, and nothing from our own
origin logs an error or fails to load. Chromium is covered by the rest of the suite.

Two harness facts, both measured:

- **WebKit applies `upgrade-insecure-requests` to `127.0.0.1`; Chromium exempts localhost.** Left
  alone, WebKit upgrades every request to `https://127.0.0.1:4340`, the TLS handshake fails, and
  the page renders with no CSS at all. The spec strips that one directive from the document
  response and leaves the rest of the CSP intact, so the gate server keeps serving the real
  header. A "table overflows in WebKit" finding was this, not a layout bug.
- **Navigation under load.** These projects carry a 90 s test timeout and a 60 s navigation
  timeout. In isolation the spec is stable: 315 of 315 over three repeats. Inside the full
  906-test suite at 8 workers, one navigation can still exceed the budget; CI's single retry
  absorbs it. Never widen the overflow tolerance to silence it: read the failure message, which
  prints `scrollWidth`, `clientWidth` and the widest offending element.
