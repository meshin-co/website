# Harness timing, October 2026

Generated-from: a5d3176

What the harness costs to run, measured on 2026-10-13 on the machine that develops this site
(Apple Silicon, Node 26.8.1), after `gate:spec` and its 16 mutation families were added. The point
of the record is a before-and-after figure: if a later phase doubles one of these numbers, the
table says which step moved.

Every number is a wall-clock measurement of the real command, not an estimate.

| Step                                       | Seconds | What it covers                                                    |
| ------------------------------------------ | ------- | ------------------------------------------------------------------ |
| `npm run build`                            | 6       | 112 built pages, the only build Lighthouse may measure            |
| `npm test`                                 | 2       | 1073 unit tests                                                   |
| `npm run check`                            | 17      | `astro check`, eslint, prettier                                   |
| `npm run gate:plan`                        | <1      | the CI wiring rules, the gap register, the pending specimens      |
| `npm run gate:skills`                      | 1       | 39 skill files, every path and command they name                  |
| `npm run gate:docs`                        | <1      | 87 documents, 6 records exempt                                    |
| `npm run gate:evidence`                    | <1      | 23 artefacts under `audits/`                                      |
| `npm run gate:spec`                        | 1       | 10 specs, 130 requirements, the change rules, the calibration rule |
| `npm run gate:brand`                       | <1      | 181 files scanned for a typed brand literal                       |
| `npm run test:smoke`                       | 277     | 60 mutation families, each proven able to fail                    |

Total for everything above: about 305 seconds, of which `test:smoke` is 91%.

## What the figures do not include

`npm run gate:lh` is not in this table. It audits every unique page plus one leaf per template
family across two form factors and takes about 30 minutes, which is why CI shards it 2 x 4. It was
not re-run for this record, because `gate:spec` adds no route, no byte and no script to the built
output: it reads `openspec/` and a git range, and the build it would measure is unchanged.

## What `gate:spec` cost

Adding the spec tree moved the cheap-gate total by about 1 second and `test:smoke` from 258 to 277
seconds, the latter because 16 new families each copy the tree, plant one violation and run the
gate twice. Measured: 59 families in 258 s before the provenance and waiver families landed, 60 in
277 s after.

## The honest caveat

These are local numbers. CI has not run in this repository since 2026-10-02: the last 15 workflow
runs were refused for billing (`gh run list`), so no figure here has ever been reproduced on a
GitHub runner. The gap register records that as row G33.
