# Shard the writer's records by month, so no directory outgrows what GitHub will list

## Why

The unattended writer leaves four files for every entry it writes:

- the attempt ledger, `audits/autowriter/<slug>.json`
- the topic claim, `audits/autowriter/claims/<slug>.json`
- the generation record, `audits/autowriter/generations/<slug>.json`
- the editorial disposition, `audits/phase-4.7/dispositions/generated-<slug>.json`

At one entry a day each directory reaches about 1800 files within five years. GitHub stops listing a
directory after 1000 entries, so a person could no longer browse the record of what the machine did.
The cost is not only for people. `gate:autowriter`, the spend reader, the topic picker and the
editorial gate each read every file of these directories on every run, so every gate would slow down
at the same rate the directories grow.

The owner asked for this directly.

## What changes

**The records are filed by month.** Each record moves into a directory named for the year and month
of its entry, for example `audits/autowriter/2026/11/<slug>.json`. The claims, the generation records
and the generated dispositions take the same shape under their own directories. The month is the UTC
month of the claim's `claimedAt`, which every entry already records. It is never the time at which a
file is read or written, so a file never moves after it is written, and a directory holds at most
thirty-one entries of one family.

**One function turns an entry and its date into a path.** `recordPath(family, slug, date)` in
`site/scripts/record-layout.mjs` is the only code that spells a record directory. The writers, the
repair, the watcher and the specimens call it. The four copies of a directory constant and of a path
helper that existed before (`ledgerFile`, `claimFile`, `generationFile` and the disposition
directory) are removed, and every caller is migrated in the same change.

**Every reader finds a record at any depth, and says how many it read.** The readers of these
directories now list them recursively through `recordFiles(repoRoot, family)`. The summary of each
reader already printed how many files it read, and it still does, because a reader that silently
finds nothing after a layout change is the failure to fear here: the spend reader that finds no
ledger reports no spend, and the ceiling never fires. The spend reader's output gains the two counts
it did not print before.

**A stray flat record fails the gate.** `gate:autowriter` gains one finding, `record-layout`. It
fails on a ledger, a claim, a generation record or a generated disposition that is not filed under
`<year>/<month>`, or that lies in a month other than the month of its claim, and it names the path
where the file belongs. It has a planted specimen and a row in the mutation smoke manifest.

**What exists is moved with `git mv`.** The ledger and the claim of the entry on `main` move into
`2026/11`, and `git log --follow` on a moved file still shows the commits from before the move.

**The ledger and the generation record stay two files.** The proposal considered one file per entry
and rejected it. The ledger records what each attempt cost, and the generation record records what
the model calls cost. `spendWarnings` in `site/scripts/spend-sum.mjs` compares the one with the other
and names an entry where they disagree. One file written by one code path would make that comparison
agree by construction, and the cross-check would no longer check anything.

**The spend reader counts every call and every record.** The monthly spend was the cost of each ledger's
generation and attempts, and a generation record counted only through its ledger. Three kinds of spend
fell out of it. A generation record whose ledger is gone counted as nothing. The record of a glossary term,
which names the ledger of the run that wrote it, was read as a ledger of its own. And a repair that spent
and then failed recorded its cost only in the JSON that its step printed. `site/scripts/spend-sum.mjs` now
pairs each record with the ledger it names (`spendItemsOf`), and the month's spend is the sum of three kinds
of part, each dated by its own instant: the writing calls, which are the larger of the ledger's generation
and the record's writing calls; the repair calls, which are the ledger's attempts plus any repair call a
record holds that no attempt covers; and the spend of a ledger that no record names. A record whose ledger
is gone is counted from the record alone, and `spendWarnings` says so. An attempt beyond what the repair
calls of a record account for is the spend of a failed repair: it is counted and never a warning.
`spend-sources.mjs` reads the records into the same items, so the ceiling job and the report add the same
parts.

**A repair that spent and failed records its spend.** `repairRun` now catches an error after any model call
and makes one local commit that changes the ledger and the spend report that counts it, and nothing else,
with the subject `fix(autowriter): record the spend of a repair of <slug> that ended as <outcome>` and a
`Provenance:` trailer. The entry and the generation record do not move. The sha goes on the error,
`repair-entry.mjs` prints it, and the `rewrite` step of
`watch-pr.yml` pushes it, because that step keeps a `commit` only when it is 40 hex characters. When the
commit itself cannot be made, the original error is still the one thrown, with its spend, and its message
says the spend could not be recorded and why. A repair that made no model call makes no commit.

**A held slug is refused in words that name no unsafe remedy.** A slug that already has a ledger is refused
as before, but the message no longer tells a person to remove the ledger. Removing it would take a real
spend out of the monthly total, and no procedure frees a slug safely yet: that needs ledgers keyed by run,
which is its own change.

## What this does not change

- `site/src/data/post/` and `site/src/data/glossary/` are the site's content. Their file names are
  route addresses and they are not sharded.
- The hand-written disposition files in `audits/phase-4.7/dispositions/` (`routes.json`,
  `glossary.json` and the others) are named for the layer of the site they cover, not for an entry.
  They carry no date to shard by, there are 13 of them and they do not grow with the writer, so they
  stay where they are. The gate accepts them flat and refuses a flat `generated-<slug>.json`.
- The schema of every record is unchanged, except that the `ledger` field of a generation record
  accepts the month path of its ledger as well as the flat path (see the next section).

## Reading what was written before

A record written before this change names its ledger at the flat path, and some of those records sit on
`autowriter/*` branches that have not merged. They record real spend, and the spend reader reads every
ref. A layout change must not turn the safety ceiling into a command that fails on its own history, so
the generation record schema accepts both the flat and the month form of the `ledger` field. This is a
tolerance for reading only. The writer has one path function and no flat branch, the `record-layout`
finding judges the working tree and never a ref, and a record the schema still refuses is named with
its path and fails the reader. It is never skipped and never counted as zero.

The tolerance ends when no `autowriter/*` branch older than this change remains. The commit that ends
it removes the optional month group from the `ledger` pattern in
`site/scripts/generation-record.schema.json`. From then on `gate:autowriter` refuses a flat ledger name
in any generation record in the working tree, and `spend-ceiling` refuses it on any ref.

## Consequences for work in flight

Pull request 78 (`autowriter/fractional-caio-vs-full-time-caio-cost`) held its generation record
and its disposition at the flat paths. The owner closed it unmerged on 2026-11-02 and its branch was
deleted, so neither file reaches `main` and there is nothing to move: the ledger and the claim of that
entry were already filed in `2026/11`. That branch was the one reason for the tolerance above. The
tolerance stays until a person ends it with the commit described there, after `git fetch --prune` has
dropped the remote-tracking ref of the deleted branch. Once it ends, `spend-ceiling` refuses a flat
ledger name on every ref it reads, so a clone that still holds that ref would stop.

Change 23 (`23-write-at-the-length-of-the-corpus`) was written while the generation records lay flat,
so two of its readers named that one directory: the removal refusal, `isGenerationRecord`, and the
list of entries the sentence band and the entry length record leave out, `generatedSlugs`. Left alone,
a record filed in its month would be neither refused on removal nor left out of the measurements, and
the machine's own entries would count as hand-written and move the floor and the band. Where the two
changes meet, both read through the layout module, and the scenario of change 23 that said a path in
a subdirectory is not a record now says a path in a sibling directory is not.
