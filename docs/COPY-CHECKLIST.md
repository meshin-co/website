# Copy checklist — facts only you can supply

This is the Phase 3 handoff the plan requires (L18). Fill the `Answer` column. Anything left blank
stays off the site: no claim ships without a row here marked `confirmed`.

Two audits of the shipped copy produced this list. Where a claim is already on the site and I could
not support it, the row says so, and I have already removed or softened it — those are marked
**REMOVED PENDING YOU**.

---

## 1. Identity and background

| # | Fact | Currently on the site | Answer |
|---|---|---|---|
| 1.1 | Title you practise under | "Fractional Chief AI Officer" | |
| 1.2 | Day job: employer type and size | "1,000+ person fraud-detection company, my day job as a platform engineer" | |
| 1.3 | Is the day job public? Can it be named? | Not named | |
| 1.4 | Career start year (drives the computed "18+ years") | 2008 | |
| 1.5 | ISO/IEC 42001 Lead Implementer — status today | "in progress" | |
| 1.6 | Any other credential to list, with status and year | None | |
| 1.7 | Location line | "Remote worldwide" | |
| 1.8 | Timeline rows for /about: year, role, one line each | No timeline shipped yet | |
| 1.9 | Your own AI products that may be named (PRD Appendix A mentions an agent orchestration platform, an AI receptionist, an App Store planner) | None named | |
| 1.10 | LinkedIn and GitHub URLs to use for `sameAs` | `linkedin.com/in/meshin`, `github.com/meshin-dev` | |

## 2. only.help — the blocking question

| # | Fact | Currently on the site | Answer |
|---|---|---|---|
| 2.1 | Is only.help your own product, a client engagement, or neither? | **CONFIRMED 2026-09-12: own product.** Case study, hub and blog mention all say so in their copy | confirmed |
| 2.2 | If a client: is there written permission to name them? | Assumed yes — unsupported | |
| 2.3 | Real numbers, if any exist: share of tickets triaged without a human first touch, before and after | **REMOVED PENDING YOU** (I had invented "0% → 62%") | |
| 2.4 | Real median first-response time, before and after | **REMOVED PENDING YOU** (I had invented "5h 40m → 9m") | |
| 2.5 | Real engagement length | **REMOVED PENDING YOU** (I had invented "11 weeks") | |
| 2.6 | Is the eval set really built from the last thirty days of tickets? | **REMOVED PENDING YOU** | |
| 2.7 | If no numbers exist: ship the case as an anonymized, metric-free story, or not at all? | Hub currently shows the empty state | |

## 3. Engagement terms

| # | Fact | Currently on the site | Answer |
|---|---|---|---|
| 3.1 | Assessment price and that it is fixed | **DECIDED 2026-09-12: no prices on the public site at all.** Fee shapes only ("Fixed fee", "Fixed scope, quoted once", "Monthly fee"); numbers are given on the fit call and written into the SOW | decided |
| 3.2 | Sprint entry price | Removed from the site with 3.1 | decided |
| 3.3 | Retainer entry price | Removed from the site with 3.1 | decided |
| 3.4 | Fee-credit window for the Assessment | credited against a Sprint starting within three months | |
| 3.5 | Cancellation notice on the retainer | thirty days | |
| 3.6 | Travel billed at cost, agreed in advance | yes | |
| 3.7 | Typical retainer length before handover | **REMOVED 2026-09-15:** `home.ts` and `src/data/service/fractional-caio-retainer.md` (deliverable + FAQ answer) no longer state a specific duration ("twelve to twenty-four months" / "12 to 24 months" / "two years") — the unconfirmed track-record claim is gone, wording now just says the engagement is built to end with a named internal owner | |
| 3.8 | Assessment interview load: how many conversations, how long each | "six to ten conversations", "two hours each" | |
| 3.9 | Fit call: free, thirty minutes, booked at cal.com/meshin | yes | |
| 3.10 | Written questions answered "usually the same day" — still true? | yes | |

## 4. Current state (/now)

`/now` was an empty holding line early on. Since commit `0534b44` (2026-09-16) it ships as a
dated log — "newest first", a line added only when something happens and never edited after —
with three real entries already live (the ISO/IEC 42001 study, and the Smarter Day 3.7.0 and
first-release dates). It is not blocked on the rows below; they stay open only if you want
capacity or availability lines added to the log format.

| # | Fact | Answer |
|---|---|---|
| 4.1 | Assessment capacity this month | |
| 4.2 | Sprint capacity, and from when | |
| 4.3 | Retainer slots: how many clients now, room for how many | |
| 4.4 | What you are actually building or shipping this month (3–5 lines, nameable) | |
| 4.5 | What you are reading or studying this month | |
| 4.6 | Who updates this page, and on what day of the month | |

## 5. Speaking — **REMOVED PENDING YOU**

I had shipped two talks that do not exist ("AI Engineering Israel meetup", "Fractional Leaders
podcast"). The page now shows the empty state from the spec.

| # | Fact | Answer |
|---|---|---|
| 5.1 | Any real past talk, podcast or panel: event, date, title, link | |
| 5.2 | Anything upcoming and public | |
| 5.3 | Topics you will accept invitations for | |

## 6. Resources — the five artifacts

The plan (L19) names five: `ai-governance-starter-kit`, `ai-readiness-scorecard`,
`agent-evals-ci-starter`, `llm-gateway-governance-config`, `build-vs-buy-ai-kit`.

| # | Fact | Currently on the site | Answer |
|---|---|---|---|
| 6.1 | Which of the five exist as real artifacts today? | Starter Kit page shipped, others not | |
| 6.2 | Repo URL for each that exists | `github.com/meshin-co/ai-governance-starter-kit` — does not resolve | |
| 6.3 | Licence for each | MIT assumed | |
| 6.4 | Version to show | v0.1 | |
| 6.5 | Status line per artifact | **REMOVED PENDING YOU** (I had invented "Published with the first engagement") | |
| 6.6 | Should I write the pages now and leave the download link off until the repos exist? | | |
| 6.7 | `/resources/sample-readiness-report` — may I write a fictional-but-labelled sample, or does it wait for a real redacted one? | Not written | |

## 7. Practice claims that assert infrastructure

Each of these says something operational exists. Confirm each is true today, or I soften it.

| # | Claim on the site | Where | Answer |
|---|---|---|---|
| 7.1 | "Every AI system I use for client work is listed in the register" | /ai-policy | |
| 7.2 | "If a vendor changes its terms, its register entry is re-checked before the next engagement day" | /ai-policy | |
| 7.3 | "Incidents are written down, including the ones with no consequence" | /ai-policy | |
| 7.4 | "Engagement material lives in an encrypted store on my own machines" | **REWRITTEN 2026-09-12 from your answers:** work happens in the client's systems; no copies of their documents, exports, tickets or logs; my notes deleted at handover | confirmed |
| 7.5 | "Hardware-backed keys for every account that matters, with no SMS fallback" | **REWRITTEN 2026-09-12:** two-factor on every work account, passwords in a password manager | confirmed |
| 7.6 | "Handover includes a list of every credential I held" | /security | |
| 7.7 | "Nothing client-owned is used to train or improve a model" — you check vendor terms before a tool touches client data | /security, FAQ | |
| 7.8 | Vulnerability reports answered "within two working days" | /security | |
| 7.9 | Data-subject requests answered "within thirty days" | /privacy | |

## 8. Legal

| # | Fact | Currently on the site | Answer |
|---|---|---|---|
| 8.1 | Legal entity: name, form, registration number if any | "Dmitri Meshin, trading as meshin.co" | |
| 8.2 | Jurisdiction whose imprint rules you want to satisfy | unstated | |
| 8.3 | Postal address, if the jurisdiction requires one | not shown | |
| 8.4 | VAT / tax ID, if applicable | not shown | |
| 8.5 | Governing law for the terms page | unstated | |
| 8.6 | Subprocessor list to publish (Cloudflare, Plausible, and anything else you use for client work) | Cloudflare, Plausible | |

---

## What I already fixed without you

These were mine to fix, not yours to answer:

- The blog post claimed "three conditions" in its lead and "six conditions" in the body. Now one number.
- Two glossary terms cited the EU AI Act through `ai-act-service-desk.ec.europa.eu`. Now `eur-lex.europa.eu`.
- One FAQ entry made claims about NIST, ISO and the EU AI Act with no sources. Now sourced.
- `/security` said "no forms" while `/search` shipped a real `<form>`. The sentence now says what is
  true: the search form never submits anywhere, and the CSP blocks form submission entirely.
- A category pillar claimed companies "have twice as many AI systems as they thought". The number
  is gone; the qualitative point stays.

---

## 9. Decided or confirmed on 2026-09-12

| Fact | Status |
|---|---|
| Prices are not published on the site; three fee shapes only (plan row L8) | decided |
| Home hero: "editorial ledger" variant, no spec card, no dollar figures (plan row L9a) | decided |
| Numbered section labels and figure-number chips removed from every page | done |
| Privacy retention: enquiries deleted 12 months after the last message; invoiced records kept 6 years for accounting | confirmed, live |
| Security posture: full-disk encryption with auto lock; 2FA everywhere; passwords in a manager; client-issued named accounts revoked at handover; no copies of client data; breach told within 24 hours | confirmed, live |
| only.help is your own product, publishable without client permission | confirmed, live |
| Case-studies hub keeps one honest entry, labelled as your own product | decided |
| Long FAQ questions (optional, style only — the build guard sits at 100): tighten toward ≤70 chars for tighter OG cards if you want; 10 of 25 run longer, longest 96 | optional |

The ten, with current lengths: what-does-a-fractional-chief-ai-officer-actually-do (96),
what-if-the-ai-we-are-building-goes-into-a-product-we-sell (90),
what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require (89),
can-you-work-with-our-existing-ai-vendor-or-platform (86),
what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue (83),
can-you-get-us-iso-iec-42001-certified-or-just-a-working-system (82),
how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer (80),
who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement (78),
whats-the-difference-between-the-assessment-the-sprint-and-the-retainer (75),
is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer (74).

Owner action from Phase 4.5a (plan row L23), dashboard setup only — no code: create an
"AI referrals" segment in Plausible so answer-engine traffic has a feedback loop. The segment
matches these referrer sources:

```json
{ "visit:source": ["chatgpt.com", "perplexity.ai", "copilot.microsoft.com", "gemini.google.com"] }
```

---

## 10. JSON-LD `dateModified` — pages with no visible date

Widening the JSON-LD property floor (audit item 26) caught 7 pages whose `WebPage` node carried
no `dateModified`. Four were wired to the date they already display (`/ai-policy`, `/now`,
`/privacy`, `/terms`). Three display no date anywhere on the page:

| # | Fact | Currently on the site | Answer |
|---|---|---|---|
| 10.1 | `/security` `dateModified` | Set to `2026-09-13`, `git log -1 --format=%cs` for `site/src/pages/security.astro` — a history fact, not invented | TODO(owner) |
| 10.2 | `/approach` `dateModified` | Set to `2026-09-13`, `git log -1 --format=%cs` for `site/src/pages/approach.astro` | TODO(owner) |
| 10.3 | `/imprint` `dateModified` | Set to `2026-09-13`, `git log -1 --format=%cs` for `site/src/pages/imprint.astro` | TODO(owner) |

Confirm `2026-09-13` is the date a reader should understand as "last reviewed" for these three
pages, or supply the real review date for each.
