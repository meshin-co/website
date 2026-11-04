# Repair a Dead Citation

A page the site cites goes away. No gate fails and no pipeline stops (`link-out.md` lists what does block). A daily job
repairs the citation, and a person is needed only for what it cannot place. This is the map of that job, how to read
what it leaves and what a person does with it. `follow-a-citation-across-days.md` says what it looks at again later.

## The job and its files

`.github/workflows/repair-links.yml` runs at 04:41 UTC and on dispatch, on `main` only. Without the secret
`AUTOWRITER_PAT` it says so in its summary, repairs nothing and stays green. It builds the site, restores the watch file
from the cache, runs `node scripts/repair-links.mjs` (flags `--repo-root`, `--today`, `--watch`; the workflow names the
file with `REPAIR_LINKS_WATCH`) and saves the watch file again, even when the run failed. It has no npm script and no
dry run, because it connects to GitHub first (`GITHUB_REPOSITORY`, `AUTOWRITER_PAT`; `GITHUB_API_URL` aims it
elsewhere). Exit 0 whatever it finds, 1 when it could not do its work, 2 on a bad flag.
`REPAIR_LINKS_ARCHIVE_SPACING_MS`, `WAYBACK_AVAILABILITY_URL` and `WAYBACK_PLAYBACK_ORIGIN` shorten the pause and name
another archive, for a rehearsal.

- `scripts/repair-links.mjs` is the command and the order of the steps below.
- `scripts/link-repair-sweep.mjs` plans: the dead addresses, the cap, each citation's rung, the unplaced rows.
- `scripts/link-repair-archive.mjs` is rung 2 for one address, with ten seconds between archive calls.
- `scripts/link-repair-report.mjs` words the branch name, the commit message, the pull request and the summary line.
- `scripts/link-repair-publish.mjs` makes the branch, the one commit through the commit sink and the pull request.
- `scripts/link-repair-settle.mjs` formats the entries, rebuilds, restates the stale dispositions and formats them.
- `scripts/link-rot-register.mjs` is the register: its shape, its digest, the merge of a run's rows, the count it
  prints; `scripts/link-rot-specimens.mjs` plants the hand-edited register `gate:links` must refuse, in `test:smoke`.
- Underneath: `scripts/link-probe.mjs` judges one address, `scripts/outbound-links.mjs` lists those in `dist/`,
  `scripts/wayback.mjs` asks the archive, `scripts/snapshot-support.mjs` checks a capture still carries the title,
  `scripts/citations.mjs` finds the source rows that cite an address, `scripts/entry-surgery.mjs` edits one entry in
  place and `scripts/citation-rewrites.mjs` makes each rewrite.

## What a run does

1. A pull request from a branch `autowriter/link-rot-*` is open: nothing is checked, search links included, the last
   line says so, exit 0. A writer's article pull request does not hold it back.
2. It probes each outbound address in `dist/` except `THIRD_PARTY_HOSTS` (`scripts/links-gate.mjs`) and any address that
   is already a stand-in. Dead is two 404 or 410 and no 2xx, or a host name that did not resolve on three days in a row;
   anything else is `unverified` and changes nothing.
3. It acts on the first 20 dead addresses in sorted order, the rest wait for the next run, and it finds the source rows
   that cite each one in a post, glossary term, FAQ, service or resource. None: `unplaced`.
4. Rung 2 needs the capture nearest the day cited (`retrieved`, else `updatedDate`: set `retrieved` when you cite a
   page), never the newest, which can be a different document: within 180 days, carrying 75% of the title's words (short
   and common words aside). Else rung 3, a search for the title and publisher, because one for the dead address finds
   nothing. A capture that is not HTML, a PDF above all, is taken unchecked and the register says so. An archive that
   does not answer leaves the citation as it is (`waiting`) and the next run asks again.
5. It rewrites addresses only: the row's `url`, a new `original` line, and the same address wherever the entry's prose
   links it. It leaves `updatedDate` alone. An entry it cannot edit safely (a flow-style row, an address still cited in
   code, no title to search for, no day to cite from) stays as it is and the address is `unplaced` with the reason.
6. It looks again at up to 20 of the originals behind search links (`follow-a-citation-across-days.md`).
7. It settles the rewrites before committing: Prettier over the rewritten entries (a longer address widens a Markdown
   table), a build, then the editorial dispositions the rewrites made stale, restated with a reason that says the job
   rewrote an address and no human read the text, and formatted. A run that changed no entry, or a repository with no
   disposition record, skips all of it.
8. One commit by the bot holds the entries, the register and the restated dispositions. One pull request goes to `main`
   and the watcher starts on it (`watch-an-unattended-pull-request.md`).

## Read what it leaves

The last log line is
`repair-links: dead=N archive=N search=N unplaced=N waiting=N watching=N restored=N upgraded=N pr=<url or none>`.
The pull request lists what changed (entry, day cited, old and new address, why) under `Repaired from the Internet
Archive`, `Resting on a search link`, `Moved up from a search link to the Internet Archive`, `Restored to the original
address`, `Left on a search link` (an entry it could not rewrite), `Not placed`, `Hosts that no longer resolve` and
`Waiting`: up to 100 rows a section, and past 60,000 characters fewer rows, search rows last to go. A table a longer
address widened is re-aligned, so its diff shows padding. `audits/link-rot.json` holds one row per citation: `original`,
`entry`, `outcome` (`archive`, `search` or `unplaced`), `replacement`, `citedOn`, `firstSeenDead`, `why`, and `pages` on
an unplaced row. A restored citation has no row. Never edit it: its digest covers the rows, `npm run gate:links` fails
on a hand edit, and the job will not write over a register that fails its guard.

## What a person does

- `unplaced`: `pages` names the routes that carry the address and `why` says why nothing was repaired. An address no
  entry cites sits in a template, a page or a data file: edit it or remove the link. An entry the rewrite refused needs
  a hand edit. The row leaves the register when the address answers again or has left the build.
- `search`: the job asks again every day and may restore it or move it up. Replacing it with a real source is by hand
  (`follow-a-citation-across-days.md`).
- `archive`: nothing is owed. Readers see the note, and the copy is the page as it stood near the day it was cited.

The job changes an address, never a word. What it leaves on purpose is in `docs/plan/reference/known-gaps.md`: G50 to
G54 and G56 to G62.
