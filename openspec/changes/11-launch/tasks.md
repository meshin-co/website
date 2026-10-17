## 1. Owner access

- [ ] 1.1 Point `www` at the apex with a 301. The zone holds no `www` record at all, so nothing
      resolves there and nothing is duplicated. The deploy token now carries `Zone → DNS → Edit`,
      which is enough to create the record but not the rule: `zones/<id>/rulesets` answers 403, and
      a redirect rule needs `Zone → Single Redirect → Edit` plus `Account → Rulesets → Edit`.
      Creating the record without the rule would serve the whole site twice
- [ ] 1.2 Submit the sitemap to Google Search Console and Bing, add both verifications and the IndexNow key
- [ ] 1.4 Point the LinkedIn person and company pages at the site. The site's half is done: the
      home page ships `https://www.linkedin.com/in/meshin/` and the company page in its JSON-LD
      `sameAs`. What is left is the website field on LinkedIn itself, which answers 999 to every
      automated request
- [ ] 1.5 Create the five `github.com/meshin-co/<slug>` repositories (L10, L19). Deferred by the
      owner on 2026-10-17 until the site is finished, one spec per artefact. Nothing links to them
      today: the built pages name only `https://github.com/meshin-co`, which answers 200
- [ ] 1.6 Answer `docs/COPY-CHECKLIST.md` sections 4 to 8: `/now`, `/speaking`, the five resource artefacts, the seven practice claims, the legal entity, the jurisdiction and the postal address

## 2. Verify the flip

- [x] 2.1 `npm run smoke:prod https://meshin.co` records 18 of 18 against the live origin, not the
      gate server. Measured 2026-10-17 after the owner published: 18 of 18, written to
      `audits/phase-5/smoke-prod.md`

## 3. Calibration Gate

- [ ] 3.1 Run the Calibration Gate against the production URL and commit `audits/phase-5/REPORT.md`
