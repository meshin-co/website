## 1. Owner access

- [ ] 1.1 Attach apex `meshin.co` to Pages, point `www` at the apex with a 301, keep the L4 TXT record
- [ ] 1.2 Submit the sitemap to Google Search Console and Bing, add both verifications and the IndexNow key
- [ ] 1.3 Create the Plausible goals `book_call` and `download_resource`
- [ ] 1.4 Point the LinkedIn person and company pages at the site
- [ ] 1.5 Create the five `github.com/meshin-co/<slug>` repositories the resource pages link to (L10, L19)
- [ ] 1.6 Answer `docs/COPY-CHECKLIST.md` sections 4 to 8: `/now`, `/speaking`, the five resource artefacts, the seven practice claims, the legal entity, the jurisdiction and the postal address

## 2. Verify the flip

- [ ] 2.1 `npm run smoke:prod https://meshin.co` records 18 of 18 against the live origin, not the gate server

## 3. Calibration Gate

- [ ] 3.1 Run the Calibration Gate against the production URL and commit `audits/phase-5/REPORT.md`
