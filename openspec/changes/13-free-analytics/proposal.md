# Analytics the site does not pay for

## Why

The owner's rule, stated on 2026-10-14, is that meshin.co uses no paid service: the domain is the
only thing bought. Plausible breaks that rule — it has no permanent free tier — and it is currently
the site's only analytics, loaded on every route and named as a subprocessor in the published
privacy text.

Cloudflare Web Analytics replaces it at no cost. It sets no cookie, keeps no client-side state and
needs no consent banner, so every privacy sentence the site already publishes stays true rather
than being rewritten into a weaker one. The site is already served by Cloudflare Pages, so the
beacon arrives from the same origin that serves the HTML.

Google Analytics was considered and deferred, not rejected: it is free, but it sets cookies, which
would require a consent banner with an equally visible refusal, a third subprocessor, a rewrite of
five published statements, and a promise to answer data-subject requests that the site cannot make
until its jurisdiction and controller are published. The owner chose Cloudflare now and GA later
only if event-level data is ever needed.

## What changes

- Plausible is removed: the script, the configuration, the subprocessor entry, and every sentence
  that names it.
- Cloudflare Web Analytics is enabled for the Pages project and verified in the live response.
- The privacy, AI policy and imprint texts are re-checked line by line against what is now true,
  and each one re-enters the editorial ledger with its disposition.
- A locked row records the rule itself, so the next contributor cannot reintroduce a paid
  dependency by accident.

## Out of scope

Google Analytics, the consent banner, and anything that needs a published controller or
jurisdiction. Those wait for sections 4 to 8 of `docs/COPY-CHECKLIST.md` and a separate decision.
