# Tasks

## 1. The gate keeps what only this repository can break

- [x] 1.1 `npm run gate:links` crawls the build only and reads outbound addresses from `dist/` without fetching one: `site/scripts/links-gate.mjs` and `site/scripts/outbound-links.mjs`, proven by `site/scripts/links-gate.test.mjs` and `site/scripts/outbound-links.test.mjs`
- [x] 1.2 The gate fails on a link inside the build that does not answer, a malformed outbound address and a register whose digest does not match its rows: `site/scripts/run-links-gate.mjs`, proven by `site/scripts/run-links-gate.test.mjs`
- [x] 1.3 Each remaining failure has a planted specimen in the smoke run (`link-to-a-missing-route`, `malformed-outbound-address`, `link-rot-register-hand-edited`, `source-original-must-match-its-stand-in`): `site/scripts/mutation-smoke.mjs` and `site/scripts/link-rot-specimens.mjs`, proven by `site/scripts/link-rot-specimens.test.mjs`

## 2. The probe judges by GET

- [x] 2.1 An outbound address is judged by GET only, two 404 or 410 answers and no 2xx is dead, and every other failure is `unverified`: `site/scripts/link-probe.mjs`, proven by `site/scripts/link-probe.test.mjs`

## 3. A dead citation goes through the chain

- [x] 3.1 `original` is the address a source was cited at, `url` stands in for it, and any other `original` is refused: `site/src/utils/archive-url.mjs` and `site/src/content.config.ts`, proven by `site/src/utils/archive-url.test.mjs` and `site/scripts/source-original-smoke.test.mjs`
- [x] 3.2 The archive is asked for the capture nearest the day cited, and the capture must still carry the title: `site/scripts/wayback.mjs`, `site/scripts/snapshot-support.mjs` and `site/scripts/link-repair-archive.mjs`, proven by `site/scripts/wayback.test.mjs`, `site/scripts/snapshot-support.test.mjs` and `site/scripts/link-repair-archive.test.mjs`
- [x] 3.3 An entry is rewritten in place and only addresses change: `site/scripts/entry-surgery.mjs`, `site/scripts/citation-rewrites.mjs` and `site/scripts/citations.mjs`, proven by `site/scripts/entry-surgery.test.mjs`, `site/scripts/citation-rewrites.test.mjs` and `site/scripts/citations.test.mjs`
- [x] 3.4 The sweep chooses the rung, caps a run at 20 addresses and records an address it cannot place: `site/scripts/link-repair-sweep.mjs`, proven by `site/scripts/link-repair-sweep.test.mjs`, `site/scripts/link-repair-sweep-selection.test.mjs` and `site/scripts/link-repair-sweep-register.test.mjs`
- [x] 3.5 The register is generated, sealed by a digest and refused when edited by hand: `site/scripts/link-rot-register.mjs`, proven by `site/scripts/link-rot-register.test.mjs`
- [x] 3.6 The daily job opens one pull request and exits non-zero only when it could not do its work: `.github/workflows/repair-links.yml`, `site/scripts/repair-links.mjs`, `site/scripts/link-repair-publish.mjs`, `site/scripts/link-repair-report.mjs` and `site/scripts/link-repair-settle.mjs`, proven by `site/scripts/repair-links.test.mjs`, `site/scripts/repair-links-e2e.test.mjs`, `site/scripts/repair-links-workflow.test.mjs`, `site/scripts/link-repair-report.test.mjs` and `site/scripts/link-repair-settle.test.mjs`

## 4. A lapsed domain is repaired

- [x] 4.1 A host name whose every attempt failed `ENOTFOUND` is `unresolved`, and a redirect to a lapsed name is not: `site/scripts/link-probe.mjs`, proven by `site/scripts/link-probe-unresolved.test.mjs`
- [x] 4.2 Three consecutive scheduled runs on three different days make a host's addresses dead, and the count is a file outside the repository: `site/scripts/link-rot-watch.mjs`, proven by `site/scripts/link-rot-watch.test.mjs` and `site/scripts/link-rot-watch-file.test.mjs`
- [x] 4.3 A run in which no host answered moves no count, repairs nothing and says so: `site/scripts/link-rot-watch.mjs` and `site/scripts/repair-links.mjs`, proven by `site/scripts/repair-links-watch.test.mjs` and `site/scripts/link-repair-sweep-lapse.test.mjs`
- [x] 4.4 The workflow carries the count between runs with the Actions cache: `.github/workflows/repair-links.yml`, proven by `site/scripts/repair-links-workflow.test.mjs`
- [x] 4.5 The whole path, from a name that does not resolve for three days to the pull request, runs against a world of fixtures: `site/scripts/repair-links-dns-e2e.test.mjs`

## 5. A search link comes back

- [x] 5.1 Every run re-examines at most 20 originals behind search rows, found by parsing the entries: `site/scripts/link-repair-reexamine.mjs`, proven by `site/scripts/link-repair-reexamine.test.mjs`, `site/scripts/link-repair-reexamine-entries.test.mjs` and `site/scripts/link-repair-reexamine-rotation.test.mjs`
- [x] 5.2 The live page is read once and cut at 2 MiB: `site/scripts/live-page.mjs` and `site/scripts/response-text.mjs`, proven by `site/scripts/live-page.test.mjs` and `site/scripts/response-text.test.mjs`
- [x] 5.3 A restore re-points the entry and removes the register row, and a move up keeps the first day seen dead: `site/scripts/citation-rewrites.mjs` and `site/scripts/link-rot-register.mjs`, proven by `site/scripts/citations-restore.test.mjs`, `site/scripts/citations-upgrade.test.mjs` and `site/scripts/link-rot-register-restore.test.mjs`
- [x] 5.4 The pull request lists what was restored, moved up and left on a search link: `site/scripts/link-repair-report.mjs`, proven by `site/scripts/link-repair-report-reexamine.test.mjs` and `site/scripts/link-repair-report-lapse.test.mjs`
- [x] 5.5 The whole path runs against a world of fixtures: `site/scripts/repair-links-reexamine-e2e.test.mjs`

## 6. The documents say what blocks and what never does

- [x] 6.1 Three skills, each at most 80 lines: `site/.agents/skills/link-out.md` (what blocks and what never does), `site/.agents/skills/repair-a-dead-citation.md` (the job and how to read it) and `site/.agents/skills/follow-a-citation-across-days.md` (the count and the re-examination), checked by `site/scripts/check-skills.mjs`
- [x] 6.2 The two main specs and the deltas of this change carry the same requirements: `openspec/specs/delivery/link-integrity/spec.md` and `openspec/specs/content/collection-schemas/spec.md`, checked by `site/scripts/run-spec-gate.mjs`
- [x] 6.3 G49 and G55 are closed with the date and the mechanism, and the limits left open are recorded as G56 to G62: `docs/plan/reference/known-gaps.md`, checked by `site/scripts/plan-gate.mjs`
- [x] 6.4 The script index describes each link script as it is: `site/scripts/README.md`, checked by `site/scripts/scripts-index.test.mjs`

## 7. Calibration Gate

- [x] 7.1 `npm run test:smoke` proves every guard family can still fail, the new link families among them
- [x] 7.2 Run the Calibration Gate and commit the report it generates for this change; the Lighthouse
      measurement is taken locally before the push
