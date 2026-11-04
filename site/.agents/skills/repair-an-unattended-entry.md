# Repair an Unattended Entry

Change `20-write-without-a-human` lets a machine write an entry and publish it without a person. When a content gate
fails on that entry's pull request, the machine repairs it: it rewrites the entry's prose and frontmatter, at most three
times, and escalates when the gate is still red. This skill holds the rules that bind a repair. The loop's smaller
scripts, the spend ceiling and the refusals are in `operate-the-repair-loop.md`.

The step that joins the parts is `npm run repair:entry`, described below. Never relax a rule to make a repair pass.

## What a repair may touch

A repair changes the entry's prose and frontmatter and nothing else. `repair-scope.mjs` lists the paths one repair commit
may hold: the entry, its ledger, its generation record, the spend report, its own dispositions, `docs/SEMANTIC-CORE.md`,
`audits/routes.json` and dispositions restated by the pipeline. It refuses a path outside that list, an unsafe path, and every refused path. The ledger is listed because a repair can change routes: the category and the tags make `/blog/category/<category>` and `/blog/tag/<tag>` pages. `repair-assembly.mjs` runs `npm run assets:routes` after the build, and a repair that would drop a route, by moving the entry out of the only category or tag it had, stops as `unrepairable`.

The attempt is written into the ledger in the same commit as the repair. A ledger-only commit classifies as prose, so
the content gates would skip it. `ledgerWithAttempt` (in `autowriter-ledger.mjs`) numbers the attempt, recomputes `spend`
and throws at the cap of three. `recordAfterRepair` and `writingTotals` (in `generation-record.mjs`) append the call roles
`repair` and `repair-correction` to the generation record and keep the cost of the writing calls apart.

## Reading the failure

The repair reads structured findings, never log text. `gate-findings.mjs` writes `gate-<name>.json` into the directory
named by `GATE_FINDINGS_DIR` when a gate fails and parses the file strictly. `ci.yml` uploads that directory as the
artifact `gate-findings-<run_attempt>`, and `repair-zip.mjs` reads the downloaded zip from memory with no install. It
refuses an unsafe name, a bad CRC, zip64, an unknown method and a size or entry count over its cap.

A failure is fingerprinted by rule and path only. Detail and line numbers move with the prose the repair just rewrote, so
including them would mean an identical failure is never recognised twice. The same rule and path twice in a row escalates
at once as `no-convergence`.

## Repair by deletion

A rewrite that turns the gate green by removing the text the gate objects to is refused.

- `repair-carry.mjs` checks that each original sentence is carried: at least half of its content words appear in one
  rewritten sentence, or in two adjacent sentences of the same block. A whole-entry rewrite needs a third.
- `repair-guard.mjs` keeps at least 90% of the words (75% for a whole-entry rewrite), and keeps the headings, FAQ items,
  key takeaways, sources and sourced claim rows. A failing rule may grant one loss through its `may` list. The passage is
  frozen. An unknown `may` name throws.

## Running one repair

`npm run repair:entry -- --pr <number> --head <sha>` repairs one pull request. Only the `repair` job of `watch-pr.yml`
runs it, for a verdict of `repairable`, on a checkout of the head the watcher judged. It needs `GITHUB_REPOSITORY`, a
read-only `GITHUB_TOKEN`, the writer variables of `write-daily.yml` and `AUTOWRITER_OPENAI_API_KEY`. Without the secret it
prints `AUTOWRITER_OPENAI_API_KEY is not set`, writes nothing and calls no vendor.

The last stdout line is one JSON object: `ok`, `outcome`, `commit`, `reason`, the spend. Exit 0 is `repaired`, 1 is any
other outcome, 2 is a usage error. The seven outcomes are in `repair-outcome.mjs`; `pr-watch-repair.mjs` turns each into
the watcher's next move. The step makes one local commit and the workflow pushes it.

1. `repair-open.mjs` checks the tree is at the judged head and asks `pr-classify.mjs` again: a moved head is `stale`.
2. `repair-findings.mjs` reads the CI findings artifact (`repair-zip.mjs`, `gate-findings.mjs`).
3. `repair-run.mjs` refuses before any spend: a repeated failure, the attempt cap, a finding `repair-kinds.mjs` refuses,
   a reached spend ceiling.
4. `repair-rewrite.mjs` asks the model through `writer-adapter.mjs`; the writer's checks and `repair-guard.mjs` judge it.
5. `repair-assembly.mjs` builds it with the writer's steps (`route-steps.mjs`, `repair-draft.mjs`).
6. `repair-finish.mjs` writes the attempt, the call and the regenerated spend report, checks scope and secrets, and commits
   through `commitRepair`. `generation-facts.mjs` and `writer-cli.mjs` are the parts the writer and the repair share.

A repair that made a model call and ends in any other outcome makes one ledger-only commit instead (`recordFailedSpend`,
with the report). Its sha is `commit` in the JSON line, so the spend counts and the workflow pushes it.

## Write prompt and repair prompt

The system message is the writer's house rules. Only the user message differs (`writer-prompt-repair.mjs`): a repair gives
the attempt, what CI found, the entry as the JSON the model must return and the frozen passage, has no run date, and its
correction message never says to remove text.

## Two repairs on one pull request

The `concurrency` group of `watch-pr.yml` holds one run per pull request, repair job included. `repair-open.mjs` ends
`stale` when the head moved. The push is a plain fast-forward from the judged head, so a moved branch fails the push.

## Measurement debt

A merge leaves a tree no Lighthouse run measured (L59). `pr-watch-debt.mjs` writes `measurementDebt` (built by
`measurement-debt.mjs`) into the ledger at merge: the commit, the tree fingerprint and the command the owner runs
(`npm run gate:lh`, then `npm run lh:record`). Publish Live warns of that tree, and the live-entry message says so, until a person has run both.
