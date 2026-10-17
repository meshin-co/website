## 1. Owner access

- [x] 1.1 `www` answers 301 to the apex. The owner added `Zone → Single Redirect → Edit` on
      2026-10-17; `Account → Rulesets → Edit` turned out not to be needed. A redirect rule from a
      Cloudflare template already existed but matched on the `https://` scheme and dropped the
      query string, and no `www` record existed for it to fire on. The record is a proxied CNAME to
      the apex, and the rule now matches `http.host eq "www.meshin.co"` with the query string kept.
      Measured: `http://www.meshin.co/`, `https://www.meshin.co/`, `/about` and `/blog?utm_source=x`
      all answer 301 to the same path on the apex, and `npm run smoke:prod https://meshin.co`
      records 20 of 20
- [ ] 1.2 Submit the sitemap to Google Search Console and Bing, add both verifications and the IndexNow key
- [ ] 1.4 Point the LinkedIn person and company pages at the site. The site's half is done: the
      home page ships `https://www.linkedin.com/in/meshin/` and the company page in its JSON-LD
      `sameAs`. What is left is the website field on LinkedIn itself, which answers 999 to every
      automated request
- [ ] 1.6 Answer `docs/COPY-CHECKLIST.md` sections 4 to 8: `/now`, `/speaking`, the five resource artefacts, the seven practice claims, the legal entity, the jurisdiction and the postal address

## 2. Verify the flip

- [x] 2.1 `npm run smoke:prod https://meshin.co` passes against the live origin, not the gate
      server. Measured 2026-10-17 after the owner published: 18 of 18, then 20 of 20 once the two
      `www` rows were added. Written to `audits/phase-5/smoke-prod.md`

## 3. Calibration Gate

- [ ] 3.1 Run the Calibration Gate against the production URL and commit `audits/phase-5/REPORT.md`
