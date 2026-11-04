# A dead link does not stop the line

## Why

On 2026-11-03 `gate:links` went red on `main` on 33 pages because of one address, `https://doi.org/10.6028/NIST.AI.100-1`. That was a false alarm. The citation was alive the whole time, and the corrected checker would not have called that address dead.

The evidence. CI run 41623809660 (job 125877724720, 11:06) reported `links: 487 found, 452 answered, 0 skipped, 33 dead, 2 unreachable`, and every dead line was that DOI answering 404. The same address passed at 05:58 (run 41586576349: `451 found, 450 answered, 0 dead`) and at 08:09 (run 41601158826).

The mechanism, reproduced against linkinator 8.1.0 on a local server. It sends a HEAD. When that is not a 2xx it sends one GET. When that GET fails in transit, the HEAD's 404 stands as the verdict and nothing retries it. HEAD 404 and GET 200 is OK. HEAD 404 and GET reset every time is BROKEN 404. HEAD 404 and GET reset once and then 200 is also BROKEN 404, because the server saw one HEAD and one GET. NIST answers HEAD 404 and GET 200 (`application/pdf`, 1,946,127 bytes) for the PDF behind that DOI, so one GET cut off in transit made a live citation look dead. The same night the glossary entry was re-pointed by hand to NIST's publication page (branch `fix/30-the-nist-citation-moved`). That edit was not needed for liveness.

The real defect was larger than one address: a third party's page could fail a gate and stop the line. The owner ruled that nothing about a dead outbound link may ever fail a gate or stop the pipeline. A daily job repairs every dead citation through a chain that never ends in a failure and never in a guess at another source.

## What changes

**The gate stops asking the world.** `npm run gate:links` crawls the build only and reads the outbound addresses from `dist/` without fetching one. It still fails on what only this repository can break: a link inside the build that does not answer, an outbound address that is no address, and a register whose digest does not match its rows.

**A probe that cannot be fooled by a HEAD.** `site/scripts/link-probe.mjs` judges an outbound address by GET only. Two 404 or 410 answers and no 2xx is dead. Any other failure (403, 429, 5xx, a timeout) is `unverified` and changes nothing. A host name that does not resolve is `unresolved`.

**A chain that never ends in a failure.** A daily job (`.github/workflows/repair-links.yml` running `site/scripts/repair-links.mjs`) repairs each dead citation: (1) the cited address while it resolves; (2) the Internet Archive capture nearest the day the source was cited (`retrieved`, else `updatedDate`), never the newest, and only while it still carries the source title; (3) when the archive definitively holds nothing usable, a search link built from the source's title and publisher. The cited address is kept in `original`. The machine never edits prose, and the rendered citation says plainly that it is an archive copy or that the original page has gone. A citation that fell to a search link is recorded in the generated register `audits/link-rot.json`.

**A lapsed domain is repaired.** A host name that did not resolve on 3 consecutive scheduled runs on 3 different days makes every outbound address on it dead. The count is a small file carried between runs by the Actions cache, never in the repository. A run counts only when an address on a different host answered in that same run, so a runner whose own resolver is down makes nothing dead.

**A search link can come back.** Every run re-examines up to 20 originals that rest on a search link. An original that answers again and still carries the source title is restored. A usable archive capture moves the row up to the archive. Otherwise nothing changes, and an outage never downgrades a row. Restores and moves up travel in the same single pull request as the repairs.

## Not in scope

- A second vantage point for a name that fails to resolve, a second look at archive rows, counting while a repair pull request is open and a PDF reader. Each is recorded with its reason as G54, G57, G58, G59 and G62 in `docs/plan/reference/known-gaps.md`.
- Choosing another source for a citation. The machine never guesses at one; a person replaces a search link by hand.
- Any change to what a page prints beside a citation, beyond the one note that says it is an archive copy or that the original page has gone.

## Impact

- New: `site/scripts/link-probe.mjs`, `outbound-links.mjs`, `wayback.mjs`, `snapshot-support.mjs`, `link-repair-archive.mjs`, `link-repair-sweep.mjs`, `link-repair-report.mjs`, `link-repair-publish.mjs`, `link-repair-settle.mjs`, `link-rot-register.mjs`, `link-rot-specimens.mjs`, `link-rot-watch.mjs`, `link-repair-reexamine.mjs`, `live-page.mjs`, `response-text.mjs`, `repair-links.mjs`, `citations.mjs`, `entry-surgery.mjs` and `citation-rewrites.mjs` under `site/scripts/`, `site/src/utils/archive-url.mjs`, and `.github/workflows/repair-links.yml`.
- Changed: `site/scripts/links-gate.mjs` and `run-links-gate.mjs`, `site/scripts/editorial-inventory.mjs` (the note is composed metadata, not source copy), `site/src/content.config.ts` (the `original` rule), `site/src/components/site/SourceList.astro` (the note), `site/src/utils/jsonld.mjs` (a search link is not offered as a citation), `site/src/pages/glossary/index.astro` (the host of a repaired source is the cited host) and the specs `delivery/link-integrity` and `content/collection-schemas`.
- Documents: `site/.agents/skills/link-out.md`, `repair-a-dead-citation.md` and the new `follow-a-citation-across-days.md`, `site/scripts/README.md`, and `docs/plan/reference/known-gaps.md` (G49 and G55 closed, G56 to G62 recorded).
- No content entry changes. No entry carries an `original` yet, and the register `audits/link-rot.json` is written by the first repair.
