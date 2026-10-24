# Prove Lighthouse ran locally

Lighthouse measures a browser under load, so a shared CI runner is the wrong instrument: the hosted
matrix took most of every run's wall time and still produced 97–99 scores that had to be re-run. It
runs on a quiet machine instead, and a push proves it ran (L59).

## Run it

```bash
cd site
npm run build                                   # the only build that may be measured
GATE_PHASE=<bucket> npm run gate:lh             # both form factors, ~40 min
GATE_PHASE=<bucket> npm run lh:record           # the evidence, only if that run passes
```

`GATE_PHASE` is required: `collect-reports.mjs` files each run under `audits/phase-<bucket>/`, and
`lh:record` reads that same folder; a bucket is a phase number or a change name.
`scripts/run-lh-parallel.mjs` shards both form factors across workers (`scripts/lh-parallel.mjs`
decides how many, a quarter of the cores unless `LH_WORKERS` says otherwise), each in its own
`.lh-run/<factor>-<index>` directory because lhci keeps its state in the working directory, each on
its own port. `scripts/lh-port.cjs` owns that choice: a shard uses the port it was handed and only
spaces itself off 4330 when run by hand, because two owners of one port number collided at four
workers. A shard that outruns its finished peers by 2.5x, or that passes the 15-minute floor before
any have finished, is stopped: `SIGTERM` to its process group, then `SIGKILL` after a grace period.
Ctrl-C stops every live shard the same way. A shard that exits cleanly but files no report fails
the run, because a silent zero is the oldest way for a gate to look green.

Run nothing else _outside_ the sharded run while it works: four shards beside a baseline
regeneration once took 2h37m and all failed, then passed singly in four minutes each.

## What the record proves

`lh:record` is a separate command, not a step inside `gate:lh`, so a planted specimen can prove the
gate still fails without writing evidence about its own defect; forgetting it is caught by the
hook, which names both commands. It calls `phaseVerdict` in `scripts/report.mjs` — the same
function that renders the committed REPORT.md — and writes `audits/lighthouse-green.json` only when
that verdict has no failures. So the record means what the Calibration Gate means: every audited
route present on both form factors, three runs each, all four categories at 100 (noindex routes
scored without `is-crawlable`), and the median LCP, CLS and TBT budgets met. A partial audit cannot
satisfy it: the expected route set comes from `dist/`, not from the run.

It also refuses while any build-surface file is uncommitted: the record keys a fingerprint of HEAD,
from `scripts/lh-evidence.mjs`, of every tracked file that can change the built output, and a run
measured from a dirty tree would certify bytes nobody measured. `scripts/build-surface.mjs` answers
which files count: content markdown under `site/src/data/` does, a test file or a fixture does not,
prose under `docs/`, `audits/`, `openspec/`, `investigation/` or `site/.agents/` never does. The
order is commit, build, measure, record, then commit the record, which lands under `audits/` and so
does not move the fingerprint it just wrote.

`run-lh-parallel.mjs` reads that fingerprint as the run starts and writes it to `lh-measured.json`
(git-ignored) only once every shard has finished, so an aborted run leaves no stamp and half a
measurement cannot be recorded as a whole one. `record` refuses reports with no stamp or another
tree's; a dirty tree leaves none either.

A refusal names the factor, the route and what failed, and writes nothing:

```
LIGHTHOUSE mobile /pricing performance: 99
LIGHTHOUSE desktop /blog: 2 runs, gate requires 3
LIGHTHOUSE audits/phase-13-free-analytics is not a passing calibration run (2 failure(s))
LIGHTHOUSE audits/phase-13-free-analytics was measured from tree 4360ea9388a1, not the tree being recorded, a32a4eba84b2; nothing recorded.
```

## The push

`.githooks/pre-push` runs `scripts/run-lh-evidence.mjs check`. It refuses a push whose tree no
recorded run measured, naming when the last run happened; a prose-only commit changes no
fingerprint and pushes freely. `npm install` points `core.hooksPath` at `.githooks`, so after a
fresh clone run it once before pushing or the hook is simply absent. There is no waiver: a tree
that needs a new measurement gets one.

## The one request the run blocks

`lighthouserc.cjs` blocks `https://cloudflareinsights.com/cdn-cgi/rum*`. Cloudflare answers a
local analytics POST with `Access-Control-Allow-Origin: http://127.0.0.1`, without a port, so the
gate server's own origin never matches and the browser logs a CORS error that costs
best-practices 4 points. The block is scoped to that one endpoint: `beacon.min.js` is still
fetched and still measured at its real transfer size, so the page weight a visitor pays is what
the run reports. Confirm after any change to the beacon by reading `network-requests` in one
report: the script must appear with status 200.
