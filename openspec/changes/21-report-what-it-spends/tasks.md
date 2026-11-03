# Tasks

## 1. The report

- [x] 1.1 `site/scripts/spend-report.mjs` rewrites `audits/spend-report.md` from the generation records
      and the ledgers: one row per record with its instant, format, slug, tokens and cost, added up
      in integer micro-dollars with `microOf` and rendered as dollars only
- [x] 1.2 The file states every model and pair of rates its costs were computed at, with the first
      and last entry each pair priced
- [x] 1.3 The file defines the newest run, the 30 × 24 hours that end at the newest record and all
      time, prints both boundaries of the 30 days, and says they are not the ceiling's calendar month
- [x] 1.4 With no record the file says so in words and holds no row, total or rate; a ledger with no
      generation does not change that
- [x] 1.5 The same records render to the same bytes, and a test shows it for the empty corpus and for
      a corpus that holds an article and a term
- [x] 1.6 A ledger that records a generation no record carries, a record whose ledger is absent, a
      record and ledger that disagree about writing spend, and a file that cannot be read each print
      one sentence; the writing case calls `spendWarnings` unchanged
- [x] 1.7 A ledger that spent and has no record, once its run ended with the verdict `stopped`,
      `escalated` or `discarded`, is a line under Notes and not under Warnings, in a sentence of its
      own, and the file says that a note is not a warning; a ledger that is open or merged, a record
      whose ledger is absent, a disagreement about spend and an unreadable file stay warnings

## 2. The message

- [x] 2.1 `site/scripts/escalate-channels.mjs` exposes the Slack request as a function of its text,
      and the escalation message is built by its caller
- [x] 2.2 `site/scripts/escalate.mjs` exports its redactor and its receipt builder, and splits
      `describeReceipt` so a second caller prints a receipt in the same words
- [x] 2.3 `node scripts/spend-report.mjs notify --result <file>` posts one message built from the
      same model as the report, posts nothing built from zero records, names a slug no record holds,
      and prints one receipt line that never contains the webhook
- [x] 2.4 `.github/workflows/write-daily.yml` runs the step last in the write job, after a
      successful write even when the push failed, with the webhook as its only secret, and without
      `continue-on-error`
- [x] 2.5 The Slack message states how many warnings there are, zero included, and never carries a
      note

## 3. Staying current

- [x] 3.1 `site/scripts/write-run.mjs` puts the regenerated report in the writer's one commit
- [x] 3.2 A repair leaves the report as it was, which a test over the model shows, so
      `site/scripts/repair-finish.mjs` and `site/scripts/repair-scope.mjs` stay as they are
- [x] 3.3 The commit of a failed write in `.github/workflows/write-daily.yml` regenerates the report
      after the escalation and commits it beside the ledger, so `main` does not fail
      `npm run gate:autowriter` on the spend that ledger records

## 4. The guard

- [x] 4.1 `npm run gate:autowriter` regenerates the report and refuses a missing one and one that
      differs, naming the first line
- [x] 4.2 A planted specimen proves each refusal, each `plant` returning its restore: a record added
      without regenerating, a figure edited by hand, and a deleted report
- [x] 4.3 One row per specimen in the mutation smoke manifest, and `npm run test:smoke` is green at
      the family count it reaches: 123, three more than before

## 5. The map

- [x] 5.1 `site/scripts/README.md` carries a row for every new script
- [x] 5.2 The skills that own the writer's evidence and the gate's refusals say what the report is,
      how to regenerate it and why a missed message is not an escalation

## 6. Calibration Gate

- [ ] 6.1 Run the Calibration Gate and commit the report it generates for this change; the Lighthouse
      measurement is the owner's, taken locally before the push
