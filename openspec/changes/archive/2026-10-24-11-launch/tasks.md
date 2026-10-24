## 1. Owner access

The three steps that need the owner's own accounts — the search consoles, the LinkedIn pages and
sections 4 to 8 of `docs/COPY-CHECKLIST.md` — stay recorded in row G35 of
`docs/plan/reference/known-gaps.md`, not here, because this change cannot move them. Measuring the
production edge with Lighthouse left this change the same way, as row G44: the harness measures the
build, and no origin override exists.

- [x] 1.1 `www` answers 301 to the apex. The owner added `Zone → Single Redirect → Edit` on
      2026-10-17; `Account → Rulesets → Edit` turned out not to be needed. A redirect rule from a
      Cloudflare template already existed but matched on the `https://` scheme and dropped the
      query string, and no `www` record existed for it to fire on. The record is a proxied CNAME to
      the apex, and the rule now matches `http.host eq "www.meshin.co"` with the query string kept.
      Measured: `http://www.meshin.co/`, `https://www.meshin.co/`, `/about` and `/blog?utm_source=x`
      all answer 301 to the same path on the apex, and `npm run smoke:prod https://meshin.co`
      records 20 of 20

## 2. Verify the flip

- [x] 2.1 `npm run smoke:prod https://meshin.co` passes against the live origin, not the gate
      server. Measured 2026-10-17 after the owner published: 18 of 18, then 20 of 20 once the two
      `www` rows were added. Written to `audits/phase-5/smoke-prod.md`
