## 1. Owner access

- [ ] 1.1 Point `www` at the apex with a 301. The apex is attached and the L4 TXT record is in
      place: `dig meshin.co` answers `188.114.97.7` and the `google-site-verification` TXT
      resolves, while `https://www.meshin.co/` does not connect (curl 000) on 2026-10-17
- [ ] 1.2 Submit the sitemap to Google Search Console and Bing, add both verifications and the IndexNow key
- [x] 1.3 No analytics goals exist to create. L58 retired Plausible on 2026-10-14, and Cloudflare
      Web Analytics carries no goal or custom-event concept the L13 JS budget would allow
- [ ] 1.4 Point the LinkedIn person and company pages at the site
- [ ] 1.5 Create the five `github.com/meshin-co/<slug>` repositories the resource pages link to (L10, L19)
- [ ] 1.6 Answer `docs/COPY-CHECKLIST.md` sections 4 to 8: `/now`, `/speaking`, the five resource artefacts, the seven practice claims, the legal entity, the jurisdiction and the postal address

## 2. Verify the flip

- [x] 2.1 `npm run smoke:prod https://meshin.co` records 18 of 18 against the live origin, not the
      gate server. Measured 2026-10-17 after the owner published: 18 of 18, written to
      `audits/phase-5/smoke-prod.md`

## 3. Calibration Gate

- [ ] 3.1 Run the Calibration Gate against the production URL and commit `audits/phase-5/REPORT.md`
