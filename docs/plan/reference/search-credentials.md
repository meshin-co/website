# Search Credentials for a New Site

The engine reads search demand from two instruments and announces new pages to a third. Each needs a
credential the owner obtains once. None of them costs money: every tier used here is permanently free, which
is the rule L58 states and `npm run gate:paid` enforces for anything the browser loads.

This file says where each credential comes from, what shape it has, where it is stored, and what breaks when
it is absent. `site/.agents/skills/adapt-the-engine-to-a-new-site.md` is the rest of the move.

## Where a credential is stored

Two places, always both:

- `site/.env` for local runs. The file is git-ignored. `site/.env.example` lists every name with a comment
  saying what it is for; copy it to `site/.env` and fill it in.
- A repository secret for the workflows, under Settings, Secrets and variables, Actions.

A credential is never committed, never interpolated into a `run:` line, and never printed. Workflows pass it
through a step's `env:` block, and `scripts/measure-keywords.test.mjs` fails if a key reaches the shell any
other way. The error messages redact it: `keyword-demand.mjs` replaces the key, its URL-encoded form and its
query-string form with `[key]` before any message is written.

## 1. Google Search Console

**What it answers.** Which queries already send impressions and clicks to pages the site has, at which
average position. It never reports a query the site does not already rank for, so it cannot find demand the
site has not reached. That limit is measured and written down in `investigation/09-what-the-demand-instruments-see.md`.

**How to get it.**

1. In Google Cloud Console create a project, or reuse one.
2. Enable the Search Console API for it.
3. Create a service account. Create a JSON key for that service account and download it.
4. In Search Console, open the property, Settings, Users and permissions, and add the service account's email
   address as a user with Full or Restricted access. This step is the one people miss: the key alone grants
   nothing.

**Where it goes.** The whole JSON file, as one line, in `GSC_SERVICE_ACCOUNT_JSON`. The property goes in
`GSC_PROPERTY`, in the exact form Search Console shows it: `sc-domain:example.com` for a domain property, or
the full URL with its trailing slash for a URL-prefix property.

**What breaks without it.** `npm run audit:demand` cannot refresh `audits/search-demand.md`, and the daily
write workflow stops before it selects a topic rather than choosing from a stale report. `gate:demand` and
`gate:evidence` stay red until the first report exists.

## 2. Bing Webmaster Tools

**What it answers.** How many times a phrase was searched on Bing, exact and broad, week by week, for any
phrase — including phrases the site does not rank for. That is the gap Search Console leaves.

**How to get it.**

1. Sign in at Bing Webmaster Tools with a Microsoft account.
2. Add the site. Importing from Search Console verifies it in one step; otherwise verify by DNS, by meta tag
   or by file.
3. Settings, API access, API key, and generate one.

**Where it goes.** `BING_WEBMASTER_API_KEY`.

**What it costs in requests.** One request per phrase, and this site builds about 311 phrases from its
concept register and glossary titles. The throttle is real and was measured on this account: four concurrent
requests lost 48 of 196; serial requests with no pause throttled after 100 to 200; a 700 ms pause ran 72
clean, and that is the value in `keywords.requestGapMs`. Separately, the keyword endpoint once answered
`ThrottleUser` for more than three hours while other endpoints stayed healthy, which looks like a daily cap.

The engine is built for that. `audits/keyword-demand.md` is a cache: a phrase measured within
`keywords.maxAgeDays` is carried forward and costs no request. When a throttle holds, the run writes the
phrases it did price, names the ones Bing never answered for, and exits 0 — the next week asks again. A
Bing failure therefore never costs the day's article, because the measurement is a separate weekly workflow,
`Measure keywords`, and the writer does not read its key at all.

**What it does not answer.** The related-keywords endpoint returns zero rows for every phrase tried,
including common ones. It prices phrases that are named to it; it never proposes new ones. Every phrase comes
from the site's own concepts and titles.

**What breaks without it.** `Measure keywords` reports green and measures nothing, saying which secret is
absent. Nothing else changes.

## 3. IndexNow

**What it answers.** Nothing. It announces: it tells search engines a URL changed, instead of waiting for a
crawl.

**How to get it.** Nothing to sign up for. Generate a random key, publish it at
`https://<the site>/<the key>.txt` with the key as the file's only content, and send the key with each ping.

**Who listens.** Bing, Yandex, Seznam and Naver share one IndexNow endpoint. **Google does not participate**,
so no IndexNow ping of any kind affects Google indexing or Search Console figures. A site whose traffic
question is about Google will not be answered by this.

## What the owner still does by hand

Branch protection on `main`, requiring the check `all required jobs passed`, and the first Lighthouse
measurement record from `npm run gate:lh` followed by `npm run lh:record` (L59). Neither can be done by a
workflow.
