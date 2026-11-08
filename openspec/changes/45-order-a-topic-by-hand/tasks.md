# Tasks

## 1. The order reaches the picker

- [ ] 1.1 `workflow_dispatch` of `.github/workflows/write-daily.yml` takes `prompt` and `title`, each
      optional, each reaching the pick step through `env` and never interpolated into the script text
- [ ] 1.2 `scripts/pick-a-topic.mjs` takes `--order-prompt <number>` and `--order-title <text>`,
      refuses both together with a usage error naming both flags, and refuses a prompt number that is
      not a positive integer

## 2. The order is checked like every other choice

- [ ] 2.1 `walkOrdered` in `scripts/topic-walk.mjs` resolves a prompt number against the report and a
      title as typed, then hands it to `examineQuery`, the same occupancy check every automatic arm uses
- [ ] 2.2 A refused order returns a `none` decision naming the order and the refusal, with no
      fallback, no strengthen report and no proposal

## 3. The origin is carried end to end

- [ ] 3.1 `ordered` is added to the origin enum of `scripts/generation-record.schema.json` and
      `scripts/autowriter-claim.schema.json`, and to the main specs this change carries deltas for
- [ ] 3.2 The writer prompt, the commit message and the claim rules accept the new origin

## 4. The guard is proven able to fail

- [ ] 4.1 `scripts/order-guard-checks.mjs` plants mutants that ignore an order, fall back after a
      refusal, and exempt an order from the occupancy checks; each is caught with its own message
- [ ] 4.2 `npm run test:smoke` carries the two new families

## 5. Calibration Gate

- [ ] 5.1 `npm run build`, then `GATE_PHASE=45-order-a-topic-by-hand npm run gate:lh` reading 100 on
      both form factors for every audited route, then `npm run lh:record`
- [ ] 5.2 `node scripts/report.mjs 45-order-a-topic-by-hand ../audits/phase-45-order-a-topic-by-hand`
      generates the report, and it reads `Result: PASS`
