# Make the site do the job it was built for

## Why

Three read-only investigations measured the live site against its purpose — inbound enquiries for a
Fractional Chief AI Officer practice — on 2026-10-25. The gates are green and the site is fast; the
funnel is not.

**Promises with nothing behind them.** The home page calls the Starter Kit "Open-source"; the
resource cards and their JSON-LD carry `license: MIT`. `GET https://github.com/meshin-co/<slug>`
returns 404 for every one of the five slugs, the organisation lists one repository (`website`), and
`api.github.com/repos/meshin-co/website` answers `"license": null`. Three resource leads say the page
_is_ a pipeline, a config, a set of documents; the pages describe them instead. G43 already records
the owner's own rule — an empty repository behind a page that promises a deliverable is worse than no
link — and the rule is not applied to these claims.

**The booking path is missing where buyers land.** 51 of 108 sitemap routes carry no booking CTA in
the body, among them all 32 glossary terms, which are the likeliest answer-engine landing pages.
Those 32 exit to the Starter Kit instead, making glossary → kit → call a two-hop path. The header
button is `hidden lg:flex`, so on a phone the first booking CTA on an offer page is the last block.
Every CTA points at the Cal profile, which offers an unadvertised 15-minute event beside the 30-minute
one the copy promises.

**The pages that must win the money questions do not link to each other.** No page body links
`/pricing` at all; the two cost FAQs restate it and link nothing. The post that wins "why do AI
pilots fail" names the Assessment and the Sprint in plain text. The Assessment page never links the
Sprint whose fee it credits.

**Freshness is an artefact of the build, not of the content.** All 11 static routes share one
`lastmod` to the second, because the CI `build` job checks out at depth 1 and
`staticPageLastmods` asks `git log -1` per file. The same pages carry a fixed JSON-LD `dateModified`
from September that matches neither the sitemap nor the `.md` sidecar.

## What changes

**Every claim resolves or goes.** "Open-source" leaves the home chip, the `MIT` label and the JSON-LD
`license` leave the resource cards and pages until a licence exists, and the three overstated leads
describe what the page holds. Nothing is invented to replace them.

**The booking path exists on every page a buyer can land on.** The closing booking band renders on the
glossary, tag, blog-index, glossary-index and legal templates; the header button is reachable on a
phone; every CTA points at the 30-minute event the copy names.

**The money pages link each other.** `/pricing` is linked from the two cost FAQs and the three offer
pages; the pilot post links the Assessment and the Sprint; the Assessment links the Sprint and the
scorecard.

**Freshness states one date.** The `build` job clones at full depth, and one editorial date per static
page feeds the sitemap, the sidecar and the JSON-LD.

**Three new guards keep it fixed**, each with a planted specimen: a template that renders no booking
CTA fails, a route whose only inbound links are site chrome fails, and a page whose three dates
disagree fails.

## What this does not change

No price is published (L8), no case study is claimed (L11), no licence is asserted and no credential
is invented. Those stay owner decisions, recorded in the copy checklist. The performance budgets, the
100/100/100/100 bar and the free-tier rule are untouched: the work is markup, copy, links and one
workflow line.
