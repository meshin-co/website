# Tasks

## 1. The numbers enter the repository

- [x] 1.1 `npm run audit:demand` reads the service account from `site/.env`, queries a 90-day
      window and writes `audits/search-demand.md`
- [x] 1.2 The report carries: the window and the day it was taken, totals, every query with
      impressions, the pages that carried them, and the per-prompt table
- [x] 1.3 A missing or invalid key fails with the command that fixes it, never with a silent empty
      report
- [x] 1.4 `site/.env.example` documents both variables and the Restricted permission

## 2. The loop names its input

- [x] 2.1 A skill states how the next article is chosen from the report, with the three signals
      and the rule that the choice is recorded with its number
- [x] 2.2 `run-the-growth-loop.md` carries the step, before the article is written
- [x] 2.3 Locked row L61 records the decision

## 3. The gate keeps it honest

- [x] 3.1 `npm run gate:demand` fails on a report older than 35 days, a core prompt with no row,
      and a document claiming a prompt is won while the report shows no impressions
- [x] 3.2 It runs offline on the committed report and is wired into CI
- [x] 3.3 A planted specimen proves each failure mode

## 4. Calibration Gate

- [x] 4.1 `npm run test:smoke` proves every guard family can still fail
- [x] 4.2 Run the Calibration Gate and commit the report it generates for this change
