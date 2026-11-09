# Tasks

## 1. The spec moves first

- [ ] 1.1 The delta under `specs/` renames the ladder requirement of generated-articles to four rungs,
      modifies it and the origin requirement, and adds the requirement that a keyword candidate takes the slot
      ahead of the category rotation
- [ ] 1.2 When the change is archived after 44 and 45, the main specs say the same, and `openspec/INDEX.md` and
      `openspec/CENSUS.json` are regenerated

## 2. The candidates are read

- [ ] 2.1 `scripts/topic-keywords.mjs` turns the candidates of `audits/keyword-demand.md` into a list ordered by
      exact impressions, most first, and reads a missing, unreadable or empty report as an empty list
- [ ] 2.2 `scripts/pick-a-topic.mjs` hands the list to the picker as an input, and a preview reads it without
      calling a model

## 3. The rung takes the slot

- [ ] 3.1 `scripts/topic-walk.mjs` and `scripts/topic-selection.mjs` try the keyword candidates after the Search
      Console rungs and before the category rotation, and take the first whose concept no register row owns
- [ ] 3.2 A candidate whose concept a register row owns becomes a strengthening advisory naming the owning route,
      with the phrase and its exact impressions, as a register-owner refusal of the posts arm does; any other
      refusal leaves a trail step; the walk goes on to the next candidate, and the run ends only when no rung
      yields a topic
- [ ] 3.3 `keywordChoice` in `scripts/topic-wording.mjs` writes
      `Choice: keyword, "<phrase>", <N> exact impressions on Bing, measured <date>`, with the `Measured:` day of
      the report

## 4. The origin is carried end to end

- [ ] 4.1 `keyword` is added to the origin enum of `scripts/generation-record.schema.json` and
      `scripts/autowriter-claim.schema.json`, and a keyword claim carries `demand` with the exact count and a null
      position, and no prompt, category or weakness
- [ ] 4.2 The writer prompt, the commit message and the claim rules accept the new origin

## 5. The guard is proven able to fail

- [ ] 5.1 `scripts/keyword-guard-checks.mjs` plants a ladder that puts the keyword rung after the category rotation,
      lets it beat a Search Console lead, ends the run on an occupied candidate, writes a register-owned candidate
      and raises on a missing report; `scripts/mutation-smoke.mjs` carries it as `keyword-rung-breaks-the-ladder`,
      and `autowriter-keyword-claim-contradicts-its-origin` proves `gate:autowriter` refuses a keyword claim that
      carries a prompt, a category or no phrase
- [ ] 5.2 `npm run test:smoke` carries the new families

## 6. The record and the procedure

- [ ] 6.1 Row L69 of `docs/plan/reference/locked-decisions.md` records the order and the measurements behind it
- [ ] 6.2 `site/.agents/skills/choose-the-next-article.md` and `site/.agents/skills/run-the-growth-loop.md` name the
      keyword step, and `site/scripts/README.md` has a row for `scripts/topic-keywords.mjs`

## 7. Calibration Gate

- [ ] 7.1 `npm test` and `npm run check` pass on the tree
- [ ] 7.2 `npm run test:smoke` proves every family, the new ones included
- [ ] 7.3 No route changed: the diff touches `site/scripts/`, documents and the openspec tree, and nothing under
      `site/src/` or `site/public/`, so `npm run lh:check` reads that lighthouse evidence covers the tree
- [ ] 7.4 `node scripts/report.mjs 46-write-from-measured-keyword-demand ../audits/phase-46-write-from-measured-keyword-demand`
      generates the report, and it reads `Result: PASS`
