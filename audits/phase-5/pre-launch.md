# Pre-launch checklist

Every item carries a status and evidence. `pass` was measured from the shipped build,
`n/a` names why the item cannot apply to this site, and `owner-blocked` names what is
missing. Nothing is silently skipped.

Measured: **17 pass, 7 n/a, 3 owner-blocked, 0 fail**.

| Section | Item | Status | Evidence |
|---|---|---|---|
| 15. Security headers | CSP, HSTS, Permissions-Policy, COOP, CORP and nosniff on the live response | owner-blocked | public/_headers is verified inside dist/, but the real edge response needs the Cloudflare attach; CG-5 measures it against the production URL |
| 23. Final smell test | a person walks the site in a fresh browser | owner-blocked | judgement, not measurement: is the primary action obvious, would the owner share the URL |
| 4. Accessibility, manual | screen reader pass on the primary flow | owner-blocked | needs VoiceOver driven by a person; no automation substitutes for it |
| 11. Forms | labels, validation, autocomplete | n/a | no form ships: /contact is an email address and a Cal.com link (L18) |
| 12. Charts and tables | data visualisation | n/a | no charts ship; markdown tables scroll inside .table-scroll, verified at 320 px |
| 14. Real-user monitoring | web-vitals to a pipeline with p75 alerts | n/a | Plausible is the only client script and carries no RUM; adding one would breach the 10 KB JS budget (L6) |
| 16. Privacy and consent | consent surface, Sec-GPC, cookie banner | n/a | no page writes a cookie, so no consent surface is owed; Plausible runs cookieless by configuration (L6) |
| 17. Error tracking | source maps, a sanity throw, release tagging | n/a | no error tracker ships, so there is nothing to symbolicate or tag |
| 18. i18n | non-Latin locale, RTL, Intl formatting, per-route lang and dir | n/a | one locale, English only, verified in dist: availableLanguage "en" (L54) |
| 19. Service worker | kill switch, nosw bypass, cache versioning | n/a | no service worker registers, so no kill switch is owed |
| 1. Lighthouse | every audited route at 100/100/100/100, both form factors | pass | REPORT.md reads Result: PASS with 50 rows at 100x4; noindex routes read n/a on SEO |
| 10. State coverage | empty, error and 404 states carry real copy | pass | 9 state-conditional strings, each declared with the state that renders it in audits/phase-4.7/conditional-copy.json |
| 13. Cross-browser | WebKit and Gecko render every route with no console error and no sideways scroll | pass | npx playwright test tests/cross-browser.spec.ts --project=webkit --project=firefox |
| 2. Core Web Vitals | LCP, CLS and TBT inside their budgets | pass | the report reads maxNumericValue per route out of lighthouserc.cjs, not the category scores |
| 20. Documentation | the last commit touching markup also updated the visual changelog | pass | git show --name-only d412cc6 lists docs/VISUAL_CHANGELOG.md |
| 21. Git and review | the plan tree, its index and its phase statuses agree | pass | gate:plan; check, unit tests and the production build run in the same sweep |
| 22. Multi-page polish | every user-facing string is dispositioned, no unexplained drift | pass | gate:editorial over the whole ledger, and gate:registers for the concept and entity registers |
| 24. Evidence manifest | every artefact in this phase exists on disk | pass | audits/phase-5/ carries REPORT.md, polish-sweep.md and this file; raw Lighthouse runs are gitignored and reproduced by re-running the gate, per .agents/skills/run-the-gate.md |
| 3. Asset budgets | JS, CSS and page bytes from the shipped build | pass | node scripts/gate.mjs dist budgets.json, real gzip bytes including lazy chunks |
| 3. Asset budgets | font families and faces | pass | 0 families, 0 faces: ; three families is the documented L39 deviation |
| 4. Accessibility, automated | axe clean in both themes on every route, and the skip link is the first focus stop | pass | npx playwright test tests/visual.spec.ts, which runs AxeBuilder per route per theme |
| 4. Accessibility, automated | valid markup, one H1, no duplicate ids, alt on every image | pass | gate:html and gate:content over every built route |
| 5. Responsive | no overflow, no clipped text, targets at or above the AA floor | pass | npm run audit:polish over 105 routes at six widths; the artifact reports findings: 0 |
| 6. Theme | both themes verified independently, never by inversion | pass | the same run asserts per-theme baselines and per-theme axe, one pass each |
| 7. Motion | transform and opacity only, durations at or under 500 ms, reduced motion honoured | pass | transform and opacity only, every duration at or under 500 ms, reduced-motion honoured, measured in the shipped CSS |
| 8. Visual quality | no raw colour literal in any component | pass | every colour comes from an --aw-color-* token |
| 9. SEO | titles, descriptions, canonicals, OG, JSON-LD, sitemap and internal links | pass | gate:content, gate:jsonld, gate:links, gate:orphans and gate:machine over every route |
