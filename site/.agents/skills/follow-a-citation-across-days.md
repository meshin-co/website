# Follow a Citation Across Days

The daily link job (`repair-a-dead-citation.md`) keeps two things from run to run and acts on neither until days of
evidence agree: a host name that stops resolving, and a citation that rests on a search link. Neither ever fails a gate
or stops a pipeline (`link-out.md`).

## A host name that stops resolving

- `scripts/link-probe.mjs` calls an address `unresolved` when at least two attempts all failed `ENOTFOUND` for the host
  it asked. A redirect to a lapsed name does not count, and `EAI_AGAIN`, a timeout or a refusal stays `unverified`.
  Once one address of a host is `unresolved`, the others on it are not asked.
- `scripts/link-rot-watch.mjs` counts runs. A host whose addresses all came back `unresolved` on 3 consecutive runs on
  3 different days (`RUNS_BEFORE_DEAD`) is lapsed: every outbound address on it counts as dead and takes the chain. A
  gap of more than 3 days (`MAX_GAP_DAYS`) restarts the count, a second run on one day counts nothing, any other
  verdict deletes the host's entry, and a host no page links any more is dropped. A hand-dispatched run counts too.
- A run moves or resets a count only when an address on another host got an HTTP answer, of any status, in that run.
  With none, the job prints `repair-links: no host answered this run`, repairs nothing and writes the state file as it
  was, so a runner whose own resolver is down never makes a host dead. `watching` reads 0 on that run, the entries
  stay. A name that fails only from the runner's resolver is still counted (G59).
- The count is not in the repository. `REPAIR_LINKS_WATCH` (or `--watch <file>`) names a small JSON file and the
  workflow carries it with `actions/cache/restore` and `save`: the register travels in a pull request that can sit
  unmerged for days, and every transient failure would cost one. A lost or corrupt file restarts the count and never
  makes a host dead. With no watch path the job never repairs a name that does not resolve, and says so.
- A register row's `firstSeenDead` is the first day of the count and its `why` names the host, the runs and the days.
  A host still counting is `watching` in the summary line and has a line of its own before it. A repaired host leaves
  the file, unless an address on it waits for the cap of 20 (G61) or for an archive that did not answer.
- While a link repair pull request is open the job stops before it probes, so no count moves, and a count restarts
  after more than 3 days without a probing run (G58). Three days are three calendar days, as little as about 47
  hours (G60).

## A citation on a search link

`scripts/link-repair-reexamine.mjs` runs after the sweep on every run. It finds the rows by parsing the entries
(`scripts/citations.mjs`), never by trusting the register, and asks about at most 20 distinct originals
(`MAX_REEXAMINED_PER_RUN`). The window starts at `(days since 1970-01-01 * 20) % n` on the sorted originals, so no
state is kept and every original is reached over time. For each one:

1. The original answers 2xx and `scripts/live-page.mjs` finds the source title in its page: the row is restored. `url`
   goes back to `original`, the `original` line goes, the prose that linked the search links the address, and the
   register row goes. A page that is not text, a PDF above all, is accepted unchecked, and the pull request says so
   (G62).
2. Otherwise the archive now holds a usable capture nearest the day cited (`repair-a-dead-citation.md`, rung 2): the
   row moves up to it, and its register row becomes `archive`, keeping `firstSeenDead` and `citedOn`. This holds even
   when the original could not be asked.
3. Otherwise nothing changes. An original that could not be asked (403, 5xx, a timeout) never restores, and an archive
   that did not answer never downgrades anything: the row is `waiting` and a later rotation asks again.

`scripts/live-page.mjs` is one GET with the probe's user agent, cut at 2 MiB by `scripts/response-text.mjs`, and every
failure is an answer, never a throw. Restores and moves up travel in the sweep's one pull request. A row on an archive
copy is never asked again (G57).

## What a person does

- Nothing for a host that is counting or a search link that is waiting: both are asked again tomorrow.
- Read a restored page the machine could not read, and any restored claim worth a second look: it checked a title,
  never a claim. Change the claim if it no longer holds.
- Replace a search link that never comes back with a real source. Read the source in a browser, and the part the claim
  rests on. In the row set `url` (and `title`) to that page, `retrieved` to today, and delete `original`: the build
  refuses an `original` that `url` no longer stands in for. Put that address in place of the search wherever the
  entry's prose links it, and change the claim if the page does not support it. Then `npm run fix:prettier`,
  `npm run build`, `npm run assets:seal` and `npm run gate:editorial`. The register keeps its row (G56): leave it.

What the job leaves open on purpose is `docs/plan/reference/known-gaps.md`, G56 to G62.
