# Operate the Repair Loop

Locked row L62 sets the bounds of the unattended writer; `guard-the-unattended-writer.md` lists what
`gate:autowriter` refuses. This skill names the smaller scripts around the loop, what each does and who
calls it. Each has a test beside it. Run one with `cd site && node --test scripts/<name>.test.mjs`.

## What automation may never do

- `scripts/human-only.mjs` reads the `AUTOWRITER_UNATTENDED` marker, set to 1 or true in a run with no
  person at the terminal. `refuseWhenUnattended` throws for a human-only action. `scripts/editorial-gate.mjs`
  (the seal), `scripts/lh-evidence.mjs`, `scripts/run-lh-evidence.mjs`, `scripts/run-lh-parallel.mjs` and
  `scripts/write-entry.mjs` call it.
- `scripts/autowriter-refusals.mjs` is the one list of paths automation may never write: the sentence band,
  the entry length record and the three Lighthouse records, each with the reason. It also spots a disposition seal by its
  signature, a digest that moves while its reason and status stay. `scripts/commit-to-main.mjs` and
  `scripts/entry-commit.mjs` refuse on it. A second list, `REMOVAL_REFUSALS`, holds what automation may never remove: a generation record, which the sentence band and the length record leave out. It judges the old path, so a rename out of the directory is a removal, and `scripts/commit-to-main.mjs` refuses it before it commits.
- `scripts/autowriter-refusal-rules.mjs` is the part of `gate:autowriter` that reads git history. A commit
  of the pipeline that changed a generation record may not have touched a refused path, and may not have removed one.
- `scripts/unattended-specimens.mjs` makes an unattended process try the seal, the Lighthouse record and the
  Lighthouse gate. Each must refuse. `scripts/mutation-specimens.mjs` runs them under `npm run test:smoke`.
- `scripts/repair-guard-checks.mjs` holds three checks that `npm run test:smoke` runs: the removal guard
  must flag dropped takeaways, the scope check must flag a file outside the entry and a refused record,
  and the ledger must refuse a fourth attempt and say the cap is 3.
- `scripts/autowriter-history-specimens.mjs` plants a pipeline commit that touches a refused path, one that
  removes a generation record and one that seals the dispositions. `npm run gate:autowriter` must name each one.

## What a repair may change

- `scripts/repair-guard.mjs` refuses repair by deletion. It checks that sentences are carried, the word
  floor, the counts of headings, FAQ answers, takeaways, sources and claims, and the frozen passage.
  `scripts/repair-rewrite.mjs` calls it.
- `scripts/repair-carry.mjs` decides whether an original sentence is still carried by a rewritten sentence
  or an adjacent pair, by the share of content words. `repair-guard.mjs` is its only caller.
- `scripts/repair-zip.mjs` reads a zip artifact from memory, with caps on size and entries and a CRC check,
  and refuses zip64, an unknown method and an unsafe name. `scripts/repair-findings.mjs` calls it.
- `scripts/gate-findings.mjs` writes and parses the findings file of a gate in the directory
  `GATE_FINDINGS_DIR`. A local run, with the variable unset, writes nothing. Each content gate writes it.

## Which findings a repair may touch

`scripts/repair-kinds.mjs` holds a closed table: every rule id the five content gates can emit, and whether
a rewrite of the entry's prose and frontmatter can fix it. A rule the table does not know is never
repairable. A finding that names a path outside the entry and its ledgers is never repairable.
`judgeFindings` sorts the findings of one run into rewrite, restate and refused, with the reason for each
refusal. `allowancesOf` says what the removal guard may let the rewrite drop. Two modules build the table:

- `scripts/repair-rows.mjs` builds a row. A row is a rewrite, a shared rewrite, a restate or a refusal, and
  each one carries the sentence that says why.
- `scripts/repair-kinds-content.mjs`, `scripts/repair-kinds-human.mjs`, `scripts/repair-kinds-ledger.mjs`
  (editorial and registers) and `scripts/repair-kinds-machine.mjs` hold the rows, one table for each gate.

Each gate stores its findings with a stable rule id. A test fails when a gate emits an id the table lacks.

- `scripts/gate-records.mjs` turns the findings of `gate:content`, `gate:human` and `gate:registers` into
  records. `scripts/editorial-findings.mjs` does it for `gate:editorial`. `scripts/machine-failures.mjs`
  keeps the failure log of `gate:machine`.

## The monthly spend ceiling

The `write-daily.yml` workflow runs `node scripts/spend-ceiling.mjs` before any model call. It writes
`stopped`, `notice` and `ledger` to the step output, and exits 2 for a usage error and 1 for data it cannot
read. Three modules sit under it:

- `scripts/spend-sources.mjs` reads every attempt ledger and generation record from the working tree and
  from the tip of `main` and of each `autowriter` branch, through git, into one item per run: a record joins
  the ledger it names, and a record whose ledger is gone is counted from the record alone. It refuses data it
  cannot read.
- `scripts/spend-sum.mjs` holds the month rule (the UTC calendar month of an instant), the integer
  micro-dollar sum (`monthlyBreakdown`: the writing calls, the repair calls, the runs that ended with no
  entry and the spend of ledgers no record names, told apart by their verdict through `hasEnded`, each
  dated by its own instant), the choice of one version of each slug and `spendWarnings`. A repair that
  failed after it spent is an attempt on the ledger, so it counts and raises no warning.
- `scripts/spend-notice.mjs` keeps the notice ledger `audits/autowriter/<year>/<month>/spend-ceiling-<year>-<month>.json`. It says
  whether a month was announced, and raises the `spend-ceiling` escalation once for that month.
- An escalated pull request waits for a person: `site/.agents/skills/unblock-an-escalated-article.md`.

## Add one

Write the failing test, then the script. Add a row to `scripts/README.md` and name the script here or in
the skill that owns its job, or `npm run gate:skills` reports it as undocumented.
