# Copy checklist — facts only you can supply

This is the Phase 3 handoff the plan requires (L18). Fill the `Answer` column. Anything left blank
stays off the site: no claim ships without a row here marked `confirmed`.

Two audits of the shipped copy produced this list. Where a claim is already on the site and I could
not support it, the row says so, and I have already removed or softened it — those are marked
**REMOVED PENDING YOU**.

---

## 1. Identity and background

| #    | Fact                                                                                                                                       | Currently on the site                                                                                                                                                                                                                                                                                                                                   | Answer      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1.1  | Title you practise under                                                                                                                   | "Fractional Chief AI Officer"                                                                                                                                                                                                                                                                                                                           |             |
| 1.2  | Day job: employer type and size                                                                                                            | "1,000+ person fraud-detection company, my day job as a platform engineer"                                                                                                                                                                                                                                                                              |             |
| 1.3  | Is the day job public? Can it be named?                                                                                                    | Not named                                                                                                                                                                                                                                                                                                                                               |             |
| 1.4  | Career start year (drives the computed "18+ years")                                                                                        | 2008                                                                                                                                                                                                                                                                                                                                                    |             |
| 1.5  | ISO/IEC 42001 Lead Implementer — status today                                                                                              | "in progress"                                                                                                                                                                                                                                                                                                                                           |             |
| 1.6  | Any other credential to list, with status and year                                                                                         | None                                                                                                                                                                                                                                                                                                                                                    |             |
| 1.7  | Location line                                                                                                                              | `/about` body: "I am based in Israel and work remote worldwide." It comes from PRD §1 `LOCATION_TEXT` ("Israel · remote worldwide") and was added on 2026-10-02 as Phase 6 worklist item 1. `/contact`, `/imprint` and `humans.txt` still say "Remote worldwide". Confirm that you want Israel published, and say whether those three should change too | TODO(owner) |
| 1.8  | Timeline rows for /about: year, role, one line each                                                                                        | No timeline shipped yet                                                                                                                                                                                                                                                                                                                                 |             |
| 1.9  | Your own AI products that may be named (PRD Appendix A mentions an agent orchestration platform, an AI receptionist, an App Store planner) | None named                                                                                                                                                                                                                                                                                                                                              |             |
| 1.10 | LinkedIn and GitHub URLs to use for `sameAs`                                                                                               | `linkedin.com/in/meshin`, `github.com/meshin-dev`                                                                                                                                                                                                                                                                                                       |             |

## 2. Removed

The case study this section covered is deleted from the site (2026-10-07). The owner said on 2026-10-03 that the work was never implemented. None of these questions apply. Later sections keep their numbers so older references stay valid.

## 3. Engagement terms

| #    | Fact                                                             | Currently on the site                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Answer      |
| ---- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 3.1  | Assessment price and that it is fixed                            | **DECIDED 2026-09-12: no prices on the public site at all.** Fee shapes only ("Fixed fee", "Fixed scope, quoted once", "Monthly fee"); numbers are given on the fit call and written into the SOW                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | decided     |
| 3.2  | Sprint entry price                                               | Removed from the site with 3.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | decided     |
| 3.3  | Retainer entry price                                             | Removed from the site with 3.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | decided     |
| 3.4  | Fee-credit window for the Assessment                             | Four places state it, in different words. The Assessment page summary: "The fee is credited if a Sprint follows within three months". That page's FAQ: "If you go on to a 90-Day Production Sprint within three months, the full Assessment fee comes off the Sprint price". The FAQ "What does the two-week Assessment produce…": "if you move to the 90-Day Sprint within three months, the full Assessment fee is credited off the Sprint price". `/pricing`: "credited against a Sprint inside three months". `docs/PRD.md` says only "If we continue, the fee is credited toward the Sprint". None says when the three months start, or whether signing the Sprint or starting it counts. Change all four together once you answer | TODO(owner) |
| 3.5  | Cancellation notice on the retainer                              | thirty days                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |             |
| 3.6  | Travel billed at cost, agreed in advance                         | yes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             |
| 3.7  | Typical retainer length before handover                          | **REMOVED 2026-09-15:** `home.ts` and `src/data/service/fractional-caio-retainer.md` (deliverable + FAQ answer) no longer state a specific duration ("twelve to twenty-four months" / "12 to 24 months" / "two years") — the unconfirmed track-record claim is gone, wording now just says the engagement is built to end with a named internal owner                                                                                                                                                                                                                                                                                                                                                                                   |             |
| 3.8  | Assessment interview load: how many conversations, how long each | "six to ten conversations", "two hours each"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |             |
| 3.9  | Fit call: free, thirty minutes, booked at cal.com/meshin         | yes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             |
| 3.10 | Written questions answered "usually the same day" — still true?  | yes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |             |

## 4. Current state (/now)

`/now` was an empty holding line early on. Since commit `0534b44` (2026-09-16) it ships as a
dated log — "newest first", a line added only when something happens and never edited after —
with one real entry already live (the ISO/IEC 42001 study). The two product entries were
removed on 2026-10-03 at the owner's request: this site names and links no product. It is not blocked on the rows below; they stay open only if you want
capacity or availability lines added to the log format.

| #   | Fact                                                                        | Answer |
| --- | --------------------------------------------------------------------------- | ------ |
| 4.1 | Assessment capacity this month                                              |        |
| 4.2 | Sprint capacity, and from when                                              |        |
| 4.3 | Retainer slots: how many clients now, room for how many                     |        |
| 4.4 | What you are actually building or shipping this month (3–5 lines, nameable) |        |
| 4.5 | What you are reading or studying this month                                 |        |
| 4.6 | Who updates this page, and on what day of the month                         |        |

## 5. Speaking — **REMOVED PENDING YOU**

I had shipped two talks that do not exist ("AI Engineering Israel meetup", "Fractional Leaders
podcast"). The page now shows the empty state from the spec.

| #   | Fact                                                           | Answer |
| --- | -------------------------------------------------------------- | ------ |
| 5.1 | Any real past talk, podcast or panel: event, date, title, link |        |
| 5.2 | Anything upcoming and public                                   |        |
| 5.3 | Topics you will accept invitations for                         |        |

## 6. Resources — the five artifacts

The plan (L19) names five: `ai-governance-starter-kit`, `ai-readiness-scorecard`,
`agent-evals-ci-starter`, `llm-gateway-governance-config`, `build-vs-buy-ai-kit`.

| #    | Fact                                                                                                                                 | Currently on the site                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Answer      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 6.1  | Which of the five exist as real artifacts today?                                                                                     | Starter Kit page shipped, others not                                                                                                                                                                                                                                                                                                                                                                                                                                                        |             |
| 6.2  | Repo URL for each that exists                                                                                                        | All five `github.com/meshin-co/<slug>` URLs return HTTP 404 (checked 2026-10-02): `agent-evals-ci-starter`, `ai-governance-starter-kit`, `ai-readiness-scorecard`, `build-vs-buy-ai-kit`, `llm-gateway-governance-config`. The `github.com/meshin-co` organisation resolves. **REMOVED PENDING YOU:** the five `repoUrl` lines, so no page shows an "Open the repository" button                                                                                                            | TODO(owner) |
| 6.3  | Licence for each                                                                                                                     | MIT assumed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |             |
| 6.4  | Version to show                                                                                                                      | v0.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |             |
| 6.5  | Status line per artifact                                                                                                             | **REMOVED PENDING YOU** (I had invented "Published with the first engagement")                                                                                                                                                                                                                                                                                                                                                                                                              |             |
| 6.6  | Should I write the pages now and leave the download link off until the repos exist?                                                  | The pages are written and carry no repository link; their status line reads "Available as a page on this site. A repository copy is not published yet."                                                                                                                                                                                                                                                                                                                                     |             |
| 6.7  | `/resources/sample-readiness-report` — may I write a fictional-but-labelled sample, or does it wait for a real redacted one?         | Not written                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |             |
| 6.8  | How do I bring the "Open the repository" button back?                                                                                | Nothing links to a repository today. For each repository you publish, add `repoUrl: <url>` to `site/src/data/resource/<slug>.md` and replace that file's `status` line, which says a repository copy is not published yet. The page renders the button only when `repoUrl` is set, and its JSON-LD type goes back from `CreativeWork` to `SoftwareSourceCode` with a `codeRepository`. Make both edits together, or the page shows a button beside a line that denies the repository exists | TODO(owner) |
| 6.9  | Do the files the "What is inside" lists used to name exist?                                                                          | **REMOVED PENDING YOU** because no page contains them: the four templates (Starter Kit); a workflow file and a failure log format (CI starter); a worked example score (scorecard); a vendor due-diligence checklist and a build-path checklist (build vs buy kit); a redaction rule set, a logging schema and an escalation rule (gateway config). The CI starter's how-to line no longer says "Copy the job outline on this page", because the page never had one                         | TODO(owner) |
| 6.10 | Home-page proof line "Open-source AI Governance Starter Kit" (`site/src/data/home.ts`): is it true while no repository is published? | Unchanged on the home page and the styleguide                                                                                                                                                                                                                                                                                                                                                                                                                                               | TODO(owner) |

## 7. Practice claims that assert infrastructure

Each of these says something operational exists. Confirm each is true today, or I soften it.

| #   | Claim on the site                                                                                                     | Where                                                                                                                                                                  | Answer    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 7.1 | "Every AI system I use for client work is listed in the register"                                                     | /ai-policy                                                                                                                                                             |           |
| 7.2 | "If a vendor changes its terms, its register entry is re-checked before the next engagement day"                      | /ai-policy                                                                                                                                                             |           |
| 7.3 | "Incidents are written down, including the ones with no consequence"                                                  | /ai-policy                                                                                                                                                             |           |
| 7.4 | "Engagement material lives in an encrypted store on my own machines"                                                  | **REWRITTEN 2026-09-12 from your answers:** work happens in the client's systems; no copies of their documents, exports, tickets or logs; my notes deleted at handover | confirmed |
| 7.5 | "Hardware-backed keys for every account that matters, with no SMS fallback"                                           | **REWRITTEN 2026-09-12:** two-factor on every work account, passwords in a password manager                                                                            | confirmed |
| 7.6 | "Handover includes a list of every credential I held"                                                                 | /security                                                                                                                                                              |           |
| 7.7 | "Nothing client-owned is used to train or improve a model" — you check vendor terms before a tool touches client data | /security, FAQ                                                                                                                                                         |           |
| 7.8 | Vulnerability reports answered "within two working days"                                                              | /security                                                                                                                                                              |           |
| 7.9 | Data-subject requests answered "within thirty days"                                                                   | /privacy                                                                                                                                                               |           |

## 8. Legal

| #   | Fact                                                                                            | Currently on the site                 | Answer |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| 8.1 | Legal entity: name, form, registration number if any                                            | "Dmitri Meshin, trading as meshin.co" |        |
| 8.2 | Jurisdiction whose imprint rules you want to satisfy                                            | unstated                              |        |
| 8.3 | Postal address, if the jurisdiction requires one                                                | not shown                             |        |
| 8.4 | VAT / tax ID, if applicable                                                                     | not shown                             |        |
| 8.5 | Governing law for the terms page                                                                | unstated                              |        |
| 8.6 | Subprocessor list to publish (Cloudflare, Plausible, and anything else you use for client work) | Cloudflare, Plausible                 |        |

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

| Fact                                                                                                                                                                                                   | Status          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Prices are not published on the site; three fee shapes only (plan row L8)                                                                                                                              | decided         |
| Home hero: "editorial ledger" variant, no spec card, no dollar figures (plan row L9a)                                                                                                                  | decided         |
| Numbered section labels and figure-number chips removed from every page                                                                                                                                | done            |
| Privacy retention: enquiries deleted 12 months after the last message; invoiced records kept 6 years for accounting                                                                                    | confirmed, live |
| Security posture: full-disk encryption with auto lock; 2FA everywhere; passwords in a manager; client-issued named accounts revoked at handover; no copies of client data; breach told within 24 hours | confirmed, live |
| Long FAQ questions (optional, style only — the build guard sits at 100): tighten toward ≤70 chars for tighter OG cards if you want; 10 of 25 run longer, longest 96                                    | optional        |

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
{
  "visit:source": [
    "chatgpt.com",
    "perplexity.ai",
    "copilot.microsoft.com",
    "gemini.google.com"
  ]
}
```

---

## 10. JSON-LD `dateModified` — closed 2026-10-25, nothing for you to confirm

Three pages (`/security`, `/approach`, `/imprint`) carried a `dateModified` of `2026-09-13` that you
were asked to confirm as "last reviewed", and none of them displays a date. The site no longer
states a review date. Each static page now carries one date, the day its words last changed, in
`STATIC_PAGE_CATALOG` (`site/src/utils/machine-text.mjs`), and the sitemap, the `.md` sidecar and
the JSON-LD all read that value.

| #    | Fact                       | Currently on the site                                | Answer |
| ---- | -------------------------- | ---------------------------------------------------- | ------ |
| 10.1 | `/security` `dateModified` | `2026-10-02`, the day its prose was last rewritten   | closed |
| 10.2 | `/approach` `dateModified` | `2026-10-02`, the day its prose was last rewritten   | closed |
| 10.3 | `/imprint` `dateModified`  | `2026-10-17`, the day its Analytics row last changed | closed |

---

## 11. Blog copy: counts that disagree with their own page

The Phase 5.2 rewrite of the four blog posts kept each of these exactly as written,
because fixing one means choosing a number only you can pick. Rows 11.1 and 11.2 were then changed on
2026-10-02 to the count the page's own list supports; confirm or correct them.

| #    | Fact                                                                         | Currently on the site                                                                                                                                                                                                                                                                                                                                                                         | Answer      |
| ---- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 11.1 | AI acceptable use policy post: how many sections does a working policy have? | **CHANGED 2026-10-02** from "Six sections make up a working one" to "Nine sections make up a working one", to match the nine-row table directly below it (scope, data classification, approved tools and requests, human review, customer disclosure, vendor training use, ownership and review, incident reporting, enforcement). Confirm nine, or tell me which three rows are not sections | TODO(owner) |
| 11.2 | AI system register post: how many interviews, and with which teams?          | **CHANGED 2026-10-02** from "five interviews" (short answer) and "five short conversations" (week plan) to "four" in both, to match the four teams the Tuesday and Wednesday step names: engineering, marketing, finance and support. Confirm four, or name the fifth team                                                                                                                    | TODO(owner) |
| 11.3 | AI system register post: which "three columns" does the Monday step mean?    | Monday: "Create the spreadsheet with those three columns." Thursday: "Fill in the vendor, data and risk-tier columns". The table above them has three columns (What to record, Why a reviewer wants it, Who fills it in) and eight rows                                                                                                                                                       | TODO(owner) |

---

## 12. Commitments restored on 2026-10-02: confirm the claim before it stands

The site-wide copy rewrite named an actor on sentences that had none, which turned descriptions of the
work into first-person promises you never made. Those sentences are back to their earlier wording. The
row below is the one place where the restored wording itself rests on a fact only you can supply.

| #    | Fact                                              | Currently on the site                                                                                                                                                                                                                                                                                                                                                      | Answer      |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 12.1 | `/now`: is the log the whole of what you work on? | The lead ends "What is not on the list is not being worked on." The rewrite had changed it to "If it is not on the list, I am not working on it." Both are total claims. `/about` shows "1,000+ person fraud-detection company, my day job as a platform engineer", and the log does not list it. Keep the sentence, scope it (for example "on this practice"), or drop it | TODO(owner) |

## 13. Model Context Protocol — `/glossary/mcp`

Answered 2026-10-07 by the owner, in interview. Applied to the entry in the same session.

| #    | Question                                 | Answer                                                                                                                                                                                                                                                                 |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.1 | Default permissions for a new agent tool | As accepted: a new tool ALWAYS starts read-only; writing, spending money or touching personal data needs a named person's approval; credentials live with the gateway or server, never in the prompt, rotated quarterly. A practice commitment, not engagement history |
| 13.2 | Vetting third-party servers              | Pin the exact version and review the source before first connect. Approved-server list lives in the client's AI register                                                                                                                                               |
| 13.3 | Transport                                | Local STDIO in a container by default; remote HTTP only through the gateway with authentication                                                                                                                                                                        |
| 13.4 | Logging                                  | Through the gateway; call and result, never full arguments; 90 days; reviewed in the weekly ops check                                                                                                                                                                  |
| 13.5 | Which offer carries MCP security         | The two-week Assessment; server inventory and approved-server list land in the AI register                                                                                                                                                                             |
| 13.6 | Review cadence                           | Every new specification revision and any new class of CVE; "Last reviewed" date shown on the page                                                                                                                                                                      |
| 13.7 | Route                                    | `/glossary/mcp` confirmed; heading carries the full name                                                                                                                                                                                                               |

## 14. AI operating model — answered 2026-10-07

| #    | Question                   | Answer                                                                                                           |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 14.1 | The definition             | Confirmed as printed: three questions. Strategy feeds the model but is not part of it                            |
| 14.2 | The two positions          | Both confirmed. The site takes no public side on centralised versus decentralised                                |
| 14.3 | "In my engagements"        | No — the article stays on sources, no practice claims                                                            |
| 14.4 | The case study as evidence | Moot: the case study was removed on the owner's instruction (never implemented)                                  |
| 14.5 | EU AI Act dates            | Plan against the recorded dates (Annex III 2 Dec 2027, Annex I 2 Aug 2028); dates not placed in contracts        |
| 14.6 | Switch point               | Qualitative: the structure grows when the decision queue outruns one named owner's review                        |
| 14.7 | AI literacy                | Delivered: a short role-specific session plus a one-page do/don't per role; the client signs the internal record |

## 15. Multi-agent architecture — answered 2026-10-07

| #     | Question              | Answer                                                                                                                      |
| ----- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 15.1  | One or several        | Owner's default: reads suit several agents; writes that must agree suit one                                                 |
| 15.2  | Limits                | Mechanics published, no numbers: step limit per run, stop, alert, a person decides on resuming                              |
| 15.3  | Model pinning         | Pin by exact ID; change only through a version-control commit; rollback reverts the commit                                  |
| 15.4  | Human approval        | Two things always: money, and anything going outside the company. The rest under limits                                     |
| 15.5  | Eval gate             | A red eval blocks the merge; threshold set on first historical run, only rises; override by the owner, in writing in the PR |
| 15.6  | Tracing               | Full trace 30 days, then metrics only; personal data masked before it enters the trace                                      |
| 15.7  | Rollback target       | Minutes, one command — a target, not a measured case; a case is published when one happens                                  |
| 15.8  | The named owner       | Holds budget, access rights and the stop button; cannot change risk policy or disable the eval gate alone                   |
| 15.9  | only.help agent count | Moot: the case study was removed (never implemented)                                                                        |
| 15.10 | Runaway loop seen     | Yes — one incident, anonymised on the page; an automatic stop (step limit and cost ceiling) ended it                        |
| 15.11 | EU dates on the page  | Glossary link only; no dates in the article                                                                                 |
| 15.12 | Naming own tools      | No tools named                                                                                                              |
| 15.13 | "Read on" dates       | Kept                                                                                                                        |
| 15.14 | Absence wording       | Confirmed as printed                                                                                                        |

## 16. Handover — answered 2026-10-07

| #     | Question             | Answer                                                                                                                                                                                                                                            |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16.1  | Closing checks       | As accepted: three checks, judged by the outside lead — the new owner writes an eval case, runs a rollback rehearsal, and handles one incident WITHOUT the lead in the room                                                                       |
| 16.2  | Usual successor      | Tech lead or head of data; COO when AI is deep in processes; one person                                                                                                                                                                           |
| 16.3  | Duration             | As accepted: three months, three phases — months 1–2 work side by side; month 3 the new owner leads and the lead reviews; end of month 3 the final test and the signatures; the end date is fixed in the month-one plan, not the contract         |
| 16.4  | After the last day   | 30 days: email answered within one working day, one review call on day 30; beyond that a separate agreement                                                                                                                                       |
| 16.5  | Signatures           | The lead signs risk acceptance and name-bearing questionnaires until the date, then the internal owner; the client notifies its customers, the lead provides the letter template                                                                  |
| 16.6  | Precedent            | Stated plainly: no engagement has yet ended in a full handover by this method                                                                                                                                                                     |
| 16.7  | Term                 | "internal owner"                                                                                                                                                                                                                                  |
| 16.8  | Format               | Page-only, MIT, v0.1                                                                                                                                                                                                                              |
| 16.9  | Playbook phases      | Mirror 16.3: three phases, signatures at end of month three                                                                                                                                                                                       |
| 16.10 | Vendor contacts      | Not personal: a row in the AI register, renewal calendar moves with it                                                                                                                                                                            |
| 16.11 | Playbook after-cells | Mirror 16.4                                                                                                                                                                                                                                       |
| 16.12 | Access list          | As accepted: six categories (system register, gateway, CI/CD, cloud consoles, vendor panels, SSO admin); the client's internal owner or IT lead revokes each, confirmed in writing the same day; a revoke-all line sits on the last-day checklist |

## 17. Adoption telemetry — answered 2026-10-07

| #     | Question               | Answer                                                                                                                                                                                                                           |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17.1  | Publishing numbers     | No numbers from own or client telemetry                                                                                                                                                                                          |
| 17.2  | Retention rule         | As accepted: week-4 active over week-1 active, per team, from gateway logs; active = two different active days in four weeks; people, not accounts; a team that stops using a tool is a workflow question, not a people question |
| 17.3  | Comparison             | As accepted: waves by team, waiting teams are the comparison; one outcome metric per use case, CHOSEN and signed by the client's owner before the start                                                                          |
| 17.4  | Survey                 | DORA's items reused word for word with credit; quarterly; five minutes                                                                                                                                                           |
| 17.5  | Cost per outcome home  | The FAQ page, confirmed; articles link                                                                                                                                                                                           |
| 17.6  | People data            | Teams only, minimum five; named views never default — narrow purpose, recorded, two approvers, 30 days; no prompt content; staff told first                                                                                      |
| 17.7  | Works councils         | As accepted: clients taken; council engaged before switch-on as a standard step; the DPIA screening is run by the client's DPO or counsel and the lead hands them the question set; monitoring trigger moved to /glossary/dpia   |
| 17.8  | Voice                  | Evidence tone with the labelled synthesis, unchanged                                                                                                                                                                             |
| 17.9  | Template scope         | As accepted: v0.1 covers coding assistants and chat assistants; SaaS tools with built-in AI and internal agents are v0.2, written when clients running them appear                                                               |
| 17.10 | Panels                 | All eight confirmed as v0.1                                                                                                                                                                                                      |
| 17.11 | Seat names in template | Mirror 17.6                                                                                                                                                                                                                      |
| 17.12 | Artifact               | Panel specification; a real export ships when a real dashboard exists                                                                                                                                                            |
