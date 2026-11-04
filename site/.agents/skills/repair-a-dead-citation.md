# Repair a Dead Citation

A page the site cites goes away. No gate fails and no pipeline stops (`link-out.md` lists what does block). A daily job
repairs the citation, and a person is needed only for what it cannot place. This is the map of that job, how to read
what it leaves and what a person does with it.

## The job and its files

`.github/workflows/repair-links.yml` runs at 04:41 UTC and on dispatch, on `main` only. Without the secret
`AUTOWRITER_PAT` it says so in its summary, repairs nothing and stays green. It builds the site, then runs
`node scripts/repair-links.mjs [--repo-root <dir>] [--today <YYYY-MM-DD>]`: no npm script and no dry run, because it
connects to GitHub first (`GITHUB_REPOSITORY`, `AUTOWRITER_PAT`; `GITHUB_API_URL` aims it elsewhere). Exit 0 whatever it
finds, 1 when it could not do its work, 2 on a bad flag. `REPAIR_LINKS_ARCHIVE_SPACING_MS`, `WAYBACK_AVAILABILITY_URL`
and `WAYBACK_PLAYBACK_ORIGIN` shorten the pause and name another archive, for a rehearsal.

- `scripts/repair-links.mjs` is the command and the order of the steps below.
- `scripts/link-repair-sweep.mjs` plans: the dead addresses, the cap, each citation's rung, the unplaced rows.
- `scripts/link-repair-archive.mjs` is rung 2 for one address, with ten seconds between archive calls.
- `scripts/link-repair-report.mjs` words the branch name, the commit message, the pull request and the summary line.
- `scripts/link-repair-publish.mjs` makes the branch, the one commit through the commit sink and the pull request.
- `scripts/link-repair-settle.mjs` formats the entries, rebuilds, restates the stale dispositions and formats them.
- `scripts/link-rot-register.mjs` is the register: its shape, its digest, the merge of a run's rows, the summary line.
- `scripts/link-rot-specimens.mjs` plants the hand-edited register that `gate:links` must refuse in `test:smoke`.
- Underneath: `scripts/link-probe.mjs` judges one address, `scripts/outbound-links.mjs` lists those in `dist/`,
  `scripts/wayback.mjs` asks the archive, `scripts/snapshot-support.mjs` checks a capture still carries the title and
  `scripts/citations.mjs` finds the source rows that cite an address and rewrites them in place.

## What a run does

1. A pull request from a branch `autowriter/link-rot-*` is open: nothing is checked, the last line says so, exit 0. A
   writer's article pull request does not hold it back.
2. It probes each outbound address in `dist/` except `THIRD_PARTY_HOSTS` (`scripts/links-gate.mjs`) and any address that
   is already a stand-in. Dead is two 404 or 410 and no 2xx; anything else is `unverified` and changes nothing.
3. It acts on the first 20 dead addresses in sorted order. The rest wait for the next run.
4. It finds the source rows that cite each one in a post, glossary term, FAQ, service or resource. None: `unplaced`.
5. Rung 2 needs a capture within 180 days of the day cited that carries 75% of the title's words (short and common
   words aside), else the citation falls to the search link. A capture that is not HTML, a PDF above all, is taken
   unchecked and the register says so. An archive that does not answer leaves the citation as it is (`waiting`) and the
   next run asks again.
6. It rewrites addresses only: the row's `url`, a new `original` line, and the same address wherever the entry's prose
   links it. An entry it cannot edit safely (a flow-style row, an address still cited in code, no title to search for,
   no day to cite from) stays as it is and the address is `unplaced` with the reason.
7. It settles the rewrite before committing: Prettier over the rewritten entries (a longer address widens a Markdown
   table, and `npm run check` runs `prettier --check`), a build, then the editorial dispositions the rewrite made stale,
   restated with a reason that says the job rewrote an address and no human read the text, and formatted. A run that
   changed no entry, or a repository with no disposition record, skips all of it.
8. One commit by the bot holds the entries, the register and the restated dispositions. One pull request goes to `main`
   and the watcher starts on it (`watch-an-unattended-pull-request.md`).

## Read what it leaves

The last log line is `repair-links: dead=N archive=N search=N unplaced=N waiting=N pr=<url or none>`. The pull request
lists the repairs (entry, day cited, old and new address, why) under `Repaired from the Internet Archive`, `Resting on a
search link`, `Not placed` and `Waiting`: up to 100 rows a section, and when the body would pass 60,000 characters fewer
archive and unplaced rows first, then fewer search rows. An unplaced address names five pages, then `and N more pages`.
A table a longer address widened is re-aligned, so its diff shows padding. `audits/link-rot.json` holds every row, one
per citation: `original`, `entry`, `outcome` (`archive`, `search` or `unplaced`), `replacement`, `citedOn`,
`firstSeenDead`, `why`, and `pages` on an unplaced row. Its digest covers the rows and the day they changed. Never edit
it: `npm run gate:links` fails on a hand edit, and the job will not write over a register that fails its guard.

## What a person does

- `unplaced`: `pages` names the routes that carry the address and `why` says why nothing was repaired. An address no
  entry cites sits in a template, a page or a data file: edit it or remove the link. An entry the rewrite refused needs
  a hand edit. The row leaves the register when the address answers again or has left the build.
- `search`: nothing checks the claim beside it any more. Find the real source in a browser and read the part the claim
  rests on. In the row set `url` (and `title`) to that page, `retrieved` to today, and delete `original`: the build
  refuses an `original` that `url` no longer stands in for. Put that address in place of the search wherever the
  entry's prose links it. Change the claim if the page does not support it. Then `npm run fix:prettier` (a longer
  address re-aligns a table), `npm run build`, `npm run assets:seal` and `npm run gate:editorial`.
- `archive`: nothing is owed. Readers see the note, and the copy is the page as it stood near the day it was cited.

## Traps

- Set `retrieved` when you cite a page: without it the job dates the citation by the entry's `updatedDate`.
- The job changes an address, never a word, and leaves `updatedDate` alone. Rows it leaves open are in
  `docs/plan/reference/known-gaps.md`, G49 to G56: a stand-in is never revisited, a lapsed domain is `unverified`, and a
  row stays in the register after a person replaces its citation.
