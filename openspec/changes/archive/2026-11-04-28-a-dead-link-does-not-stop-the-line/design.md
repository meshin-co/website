# Design: a dead link does not stop the line

## Context

The first link gate asked every outbound address, through linkinator, on every build. A third party's page could therefore turn `main` red (the false alarm in the proposal), and a person had to fix a citation before anything else could ship. The owner's rule binds this design: nothing about a dead outbound link ever fails a gate or stops the pipeline.

## Decisions

### The gate never fetches an outbound address

`npm run gate:links` crawls the build only. It fails on what only this repository can break: a link inside the build that does not answer, an outbound address that is no address, and a register whose digest does not match its rows. A third party's page is not a defect in this change. Judging it belongs to a job that cannot block anything.

### The probe is GET only

`site/scripts/link-probe.mjs` sends a GET and follows redirects, up to three attempts with a backoff or the host's `Retry-After`. Two 404 or 410 answers and no 2xx is dead. A timeout, a refusal, a 429 or a 5xx is `unverified`: reported, never dead, never repaired. A host that has not answered two addresses in a row is not asked about the rest. A HEAD is never sent, because a server may answer a HEAD differently from a GET. NIST does: HEAD 404 and GET 200 for the PDF behind the DOI of the trigger. Measured again on 2026-11-04: HEAD 404 (`text/html`), GET 200 (`application/pdf`, 1,946,127 bytes).

The probe identifies itself honestly. A browser user agent was tried and refused. Commit 123e944 records that Cloudflare challenged a Chrome user agent sent from Node with a 403 on doi.org while an honest one was answered. A run on 2026-11-04 from the machine that wrote this record got 200 for both agents on doi.org and www.nist.gov, so the challenge depends on where the request comes from. An honest agent does not depend on it, and a site that blocks it is `unverified`, which blocks nothing.

### The chain, and why the snapshot nearest the citation date

A dead citation goes through three rungs, and the chain never ends in a failure:

1. The cited address, while it resolves.
2. The Internet Archive capture nearest the day the source was cited (`retrieved`, else the entry's `updatedDate`), never the newest. The capture must be within 180 days of that day and still carry the source title (75% of its significant words, `site/scripts/snapshot-support.mjs`). The newest capture of a dead address is often another document: a parked domain, a home page, an error page that answered 200. The capture nearest the day of the citation is the page the author read.
3. When the archive definitively holds nothing usable, a search link built from the source's title and publisher.

An archive that does not answer is not an archive that holds nothing. The citation stays as it is, counted as `waiting`, and the next run asks again. The chain never falls to a search link on an outage.

### A search link is built from the title and the publisher

A search for the dead address finds nothing, because the address is what is gone. A search for the title and the publisher finds where the page moved. The machine never chooses a replacement source: it cannot judge what a source says, and the owner ruled that it never guesses at another source. The rendered citation says plainly that the original page has gone and that the link is a search for it. The `original` line keeps the address that was cited, and the build refuses an `original` that `url` does not stand in for.

### The machine changes addresses, never words

The job rewrites the row's `url`, adds `original` and re-points the same address wherever the entry's prose links it. It never edits a claim. A person reads the pull request, and the claim beside a stand-in still describes the page that was cited (G50).

### The register and its digest

`audits/link-rot.json` is generated. It holds one row per repaired or unplaced citation, sorted, and a digest over the rows and the day it changed. Only the job writes it. `gate:links` fails on a register whose digest does not match its rows, so a hand edit cannot pass, and the job refuses to write over a register that fails its own guard. It is the one place where a person can see everything that rests on a stand-in. It is the current state, and history is in git: a citation restored to its address loses its row. A missing register is read as no register and is not a problem.

### The streak of a lapsed domain lives outside the repository

A host name whose every attempt fails `ENOTFOUND` is `unresolved`, and a redirect to a lapsed name does not count. One failed lookup says nothing about a domain, so the host counts as dead only when it did not resolve on 3 consecutive scheduled runs on 3 different days (`RUNS_BEFORE_DEAD`). A gap of more than 3 days (`MAX_GAP_DAYS`) restarts the count, a second run on one day adds nothing, and any other verdict deletes the host's entry. Then every outbound address on the host takes the chain, with the streak's first day as `firstSeenDead` and the evidence in `why`.

The count is a small JSON file (`--watch <file>` or `REPAIR_LINKS_WATCH`) that the workflow carries between scheduled runs with the Actions cache. It is not in the repository because the register travels in a pull request that can sit unmerged for days, and every transient failure would cost a pull request. A lost cache only restarts the count and never makes a host dead. With no watch path the job never repairs on a DNS verdict, and says so.

### Three runs, and what three days are

Three is a choice and not a measurement (G60). One failure is noise. Two can be a provider's bad weekend. Three on three different days is a name that has not come back. The unit is the calendar day, because the schedule is daily and a second run on one day learns nothing new, so three days can be as little as about 47 hours. The price of caution is a few more days on a citation that is already gone.

### The resolver-wide guard

A runner whose own network or resolver is down fails every name at once. Counted naively, three such days would make every host lapsed and send every citation of the site to a search link. So a run moves or resets a count only if, in the same run, an address on a different host produced an HTTP response of any status. A run with no such witness moves nothing, resets nothing and prints one plain line. The guard catches a down runner. It does not catch a resolver that fails for one name only (G59).

### Re-examination, and its rotation

A search link is the last rung, not a verdict. Every run, after the sweep, `site/scripts/link-repair-reexamine.mjs` re-examines the rows that rest on a search link. It finds them by parsing the entries and never trusts the register. It asks about at most 20 distinct originals a run (`MAX_REEXAMINED_PER_RUN`), chosen by a stateless rotation over the sorted originals that starts at `(days since 1970-01-01 x 20) mod n`. No state is kept, and every original is reached over time. For each original:

- If it answers again and the live page still carries the source title (`site/scripts/live-page.mjs`; a PDF that answers 2xx is accepted unchecked, G62), the row is restored. `url` goes back to `original`, the `original` line goes, the prose that linked the search links the address, and the register row is removed.
- Otherwise, if the archive now holds a usable capture nearest the citation date, the row moves up to the archive. Its register row becomes `archive` and keeps `firstSeenDead` and `citedOn`.
- Otherwise nothing changes. An outage of the archive, or an `unverified` original, changes nothing and never downgrades a row.

Restores and moves up travel in the same single pull request as the sweep's repairs, `autowriter/link-rot-<date>`.

### One pull request, and a pause while one is open

The job opens at most one pull request a day. While a pull request from a `autowriter/link-rot-*` branch is open, the job stops before it probes anything, so two pull requests never rewrite the same sealed register. The price is that a count stalls and restarts after more than 3 days (G58).

### The job never fails because of what it finds

The command exits 0 whatever it finds, 1 only when it could not do its work, and 2 for a bad flag. The workflow without its token says so in its summary and stays green. The last stdout line is `repair-links: dead=N archive=N search=N unplaced=N waiting=N watching=N restored=N upgraded=N pr=<url|none>`. Only `summaryLine` in `site/scripts/link-repair-report.mjs` writes it.

## Deliberately left open

Each is a row in `docs/plan/reference/known-gaps.md`, with its reason:

- G56: the register keeps its rows after a person replaces a citation by hand.
- G57: an archive row is never re-examined. An archive snapshot is a faithful copy, so it stays even if the original returns.
- G58: a count stalls while a repair pull request is open.
- G59: a name that fails to resolve only from the runner's resolver is still counted. There is one vantage point, the same limit as G54.
- G60: three days are three calendar days.
- G61: an address on a lapsed host beyond the cap of 20 waits for the next run.
- G62: a restored page that is not text is accepted unchecked.
