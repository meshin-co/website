# Phase 5 · Launch

Goal: public, indexed, measured.

- Full 19-phase polish loop over every route; `pre-launch.md` checklist; self-improvement
  checklist all "yes".
- Attach apex `meshin.co` to Pages, `www` → apex 301, remove `noindex`, keep L4 TXT record.
- Sitemap to GSC and Bing, IndexNow ping, Plausible goals (`book_call`, `download_resource`),
  LinkedIn person and company pointing at the site.
- Baseline the 30 buyer prompts (PRD §17.3) → `audits/geo-baseline.md`.

CG-5 runs against the production URL, not a preview.

## Done, with evidence

- Polish loop over all 105 routes at 320/375/768/1024/1280/1920: `audits/phase-5/polish-sweep.md`,
  0 findings. Two real defects fixed: a mobile grid track sized to a wide table's min-content, and
  eight components shipping 12-23 px tap targets.
- Pre-launch checklist, all 24 sections: `audits/phase-5/pre-launch.md`, 17 pass, 7 n/a,
  3 owner-blocked, 0 fail. Procedure in `.agents/skills/run-the-pre-launch-checklist.md`.
- WebKit and Gecko render every route: `tests/cross-browser.spec.ts`, 210 tests.
- Lighthouse on the local production build: `audits/phase-5/REPORT.md`, Result PASS, 50 of 54
  rows at 100/100/100/100, the four noindex rows n/a on SEO.
- Buyer-prompt structural readiness: `audits/geo-baseline.md`, 12 of 30 ready. This is not the
  citation baseline; PRD §17.3's mentioned/cited/absent run across five engines is external and
  manual, and the artifact says so on its first line.

## Blocked on the owner

Nothing below can be measured from this machine.

- Cloudflare: attach apex `meshin.co` to Pages, `www` → apex 301, remove `noindex`, keep the L4
  TXT record.
- Search: sitemap to GSC and Bing, both verifications, the IndexNow key.
- Plausible goals `book_call` and `download_resource`; LinkedIn person and company pointing at
  the site.
- The five `github.com/meshin-co/<slug>` repos the resource pages link to (L10, L19).
- `docs/COPY-CHECKLIST.md` §4-§8: `/now` content, `/speaking`, the five resource artifacts, the
  seven practice claims, the legal entity, jurisdiction and postal address.
- CG-5 itself: it measures real edge CSP headers and real compression against the production URL.
