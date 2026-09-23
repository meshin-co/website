# Phase 4.7 — Calibration Gate report

Generated from raw check output by `scripts/report.mjs`. Do not hand-edit.

Generated-from: a revision before `6a0c9c2`, whose byte-budget assertion read a field
`gate.mjs` never wrote. This report's `Result` covers Lighthouse scores and Lighthouse
metric budgets only; its byte-budget rows were printed, never asserted. The raw Lighthouse
runs behind it are gitignored, so it cannot be regenerated — it is kept as the record of
what was measured at the time, with its limit stated.

Result: PASS

## Lighthouse (median of 3 runs)

| Form factor | Route | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| mobile | `/` | 100 | 100 | 100 | 100 |
| mobile | `/404` | 100 | 100 | 100 | n/a (noindex) |
| mobile | `/about/` | 100 | 100 | 100 | 100 |
| mobile | `/ai-policy/` | 100 | 100 | 100 | 100 |
| mobile | `/approach/` | 100 | 100 | 100 | 100 |
| mobile | `/blog/` | 100 | 100 | 100 | 100 |
| mobile | `/blog/category/governance/` | 100 | 100 | 100 | 100 |
| mobile | `/blog/evals-in-ci-for-llm-agents/` | 100 | 100 | 100 | 100 |
| mobile | `/blog/tag/ai-governance/` | 100 | 100 | 100 | 100 |
| mobile | `/case-studies/` | 100 | 100 | 100 | 100 |
| mobile | `/case-studies/only-help-agentic-support/` | 100 | 100 | 100 | 100 |
| mobile | `/contact/` | 100 | 100 | 100 | 100 |
| mobile | `/faq/` | 100 | 100 | 100 | 100 |
| mobile | `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require/` | 100 | 100 | 100 | 100 |
| mobile | `/glossary/` | 100 | 100 | 100 | 100 |
| mobile | `/glossary/high-risk-ai-system/` | 100 | 100 | 100 | 100 |
| mobile | `/imprint/` | 100 | 100 | 100 | 100 |
| mobile | `/now/` | 100 | 100 | 100 | 100 |
| mobile | `/pricing/` | 100 | 100 | 100 | 100 |
| mobile | `/privacy/` | 100 | 100 | 100 | 100 |
| mobile | `/resources/` | 100 | 100 | 100 | 100 |
| mobile | `/resources/llm-gateway-governance-config/` | 100 | 100 | 100 | 100 |
| mobile | `/search/` | 100 | 100 | 100 | n/a (noindex) |
| mobile | `/security/` | 100 | 100 | 100 | 100 |
| mobile | `/services/` | 100 | 100 | 100 | 100 |
| mobile | `/services/fractional-caio-retainer/` | 100 | 100 | 100 | 100 |
| mobile | `/terms/` | 100 | 100 | 100 | 100 |
| desktop | `/` | 100 | 100 | 100 | 100 |
| desktop | `/404` | 100 | 100 | 100 | n/a (noindex) |
| desktop | `/about/` | 100 | 100 | 100 | 100 |
| desktop | `/ai-policy/` | 100 | 100 | 100 | 100 |
| desktop | `/approach/` | 100 | 100 | 100 | 100 |
| desktop | `/blog/` | 100 | 100 | 100 | 100 |
| desktop | `/blog/category/governance/` | 100 | 100 | 100 | 100 |
| desktop | `/blog/evals-in-ci-for-llm-agents/` | 100 | 100 | 100 | 100 |
| desktop | `/blog/tag/ai-governance/` | 100 | 100 | 100 | 100 |
| desktop | `/case-studies/` | 100 | 100 | 100 | 100 |
| desktop | `/case-studies/only-help-agentic-support/` | 100 | 100 | 100 | 100 |
| desktop | `/contact/` | 100 | 100 | 100 | 100 |
| desktop | `/faq/` | 100 | 100 | 100 | 100 |
| desktop | `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require/` | 100 | 100 | 100 | 100 |
| desktop | `/glossary/` | 100 | 100 | 100 | 100 |
| desktop | `/glossary/high-risk-ai-system/` | 100 | 100 | 100 | 100 |
| desktop | `/imprint/` | 100 | 100 | 100 | 100 |
| desktop | `/now/` | 100 | 100 | 100 | 100 |
| desktop | `/pricing/` | 100 | 100 | 100 | 100 |
| desktop | `/privacy/` | 100 | 100 | 100 | 100 |
| desktop | `/resources/` | 100 | 100 | 100 | 100 |
| desktop | `/resources/llm-gateway-governance-config/` | 100 | 100 | 100 | 100 |
| desktop | `/search/` | 100 | 100 | 100 | n/a (noindex) |
| desktop | `/security/` | 100 | 100 | 100 | 100 |
| desktop | `/services/` | 100 | 100 | 100 | 100 |
| desktop | `/services/fractional-caio-retainer/` | 100 | 100 | 100 | 100 |
| desktop | `/terms/` | 100 | 100 | 100 | 100 |

## Measured byte budgets (gzip)

| Route | JS | CSS | Page total |
|---|---|---|---|
| `/` | 1108 | 12534 | 28690 |
| `/404` | 1108 | 12534 | 24393 |
| `/about` | 1108 | 12534 | 26433 |
| `/ai-policy` | 1108 | 12534 | 26725 |
| `/approach` | 1108 | 12534 | 26938 |
| `/blog` | 1108 | 12534 | 26517 |
| `/blog/ai-acceptable-use-policy-for-a-50-person-company` | 1108 | 12534 | 33563 |
| `/blog/category/agentic-architecture` | 1108 | 12534 | 27062 |
| `/blog/category/executive` | 1108 | 12534 | 26554 |
| `/blog/category/governance` | 1108 | 12534 | 27202 |
| `/blog/category/operating-model` | 1108 | 12534 | 27028 |
| `/blog/evals-in-ci-for-llm-agents` | 1108 | 12534 | 34123 |
| `/blog/how-to-build-an-ai-system-register-in-a-week` | 1108 | 12534 | 32774 |
| `/blog/tag/acceptable-use-policy` | 1108 | 12534 | 25728 |
| `/blog/tag/agentic-architecture` | 1108 | 12534 | 25693 |
| `/blog/tag/ai-governance` | 1108 | 12534 | 26152 |
| `/blog/tag/ai-pilots` | 1108 | 12534 | 25727 |
| `/blog/tag/ai-register` | 1108 | 12534 | 25703 |
| `/blog/tag/eu-ai-act` | 1108 | 12534 | 25714 |
| `/blog/tag/evals-in-ci` | 1108 | 12534 | 25917 |
| `/blog/tag/llm-as-judge` | 1108 | 12534 | 25695 |
| `/blog/tag/policy-enforcement` | 1108 | 12534 | 25736 |
| `/blog/tag/production-readiness` | 1108 | 12534 | 25741 |
| `/blog/tag/security-review` | 1108 | 12534 | 25713 |
| `/blog/tag/shadow-ai` | 1108 | 12534 | 25734 |
| `/blog/tags` | 1108 | 12534 | 25885 |
| `/blog/why-your-ai-pilot-never-reached-production` | 1108 | 12534 | 32768 |
| `/case-studies` | 1108 | 12534 | 25959 |
| `/case-studies/only-help-agentic-support` | 1108 | 12534 | 27455 |
| `/contact` | 1108 | 12534 | 26055 |
| `/faq` | 1108 | 12534 | 28533 |
| `/faq/are-models-trained-on-our-customer-data` | 1108 | 12534 | 26616 |
| `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system` | 1108 | 12534 | 26991 |
| `/faq/can-you-work-with-our-existing-ai-vendor-or-platform` | 1108 | 12534 | 26806 |
| `/faq/how-do-you-charge-for-the-work` | 1108 | 12534 | 26707 |
| `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off` | 1108 | 12534 | 26718 |
| `/faq/how-does-the-retainer-end` | 1108 | 12534 | 26610 |
| `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed` | 1108 | 12534 | 26734 |
| `/faq/how-is-cost-per-outcome-measured` | 1108 | 12534 | 26520 |
| `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer` | 1108 | 12534 | 26688 |
| `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer` | 1108 | 12534 | 26633 |
| `/faq/what-counts-as-in-production-for-the-90-day-sprint` | 1108 | 12534 | 26719 |
| `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require` | 1108 | 12534 | 27214 |
| `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval` | 1108 | 12534 | 26784 |
| `/faq/what-does-a-fractional-chief-ai-officer-actually-do` | 1108 | 12534 | 26651 |
| `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue` | 1108 | 12534 | 26857 |
| `/faq/what-happens-if-the-evals-say-a-workflow-isnt-good-enough` | 1108 | 12534 | 26740 |
| `/faq/what-happens-on-a-fit-call-and-does-it-cost-anything` | 1108 | 12534 | 26670 |
| `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell` | 1108 | 12534 | 27025 |
| `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead` | 1108 | 12534 | 26798 |
| `/faq/what-size-of-company-do-you-actually-work-with` | 1108 | 12534 | 26623 |
| `/faq/whats-the-difference-between-the-assessment-the-sprint-and-the-retainer` | 1108 | 12534 | 26906 |
| `/faq/who-answers-customer-security-questionnaires` | 1108 | 12534 | 26568 |
| `/faq/who-owns-the-code-and-the-data` | 1108 | 12534 | 26608 |
| `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement` | 1108 | 12534 | 26764 |
| `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai` | 1108 | 12534 | 26537 |
| `/glossary` | 1108 | 12534 | 33089 |
| `/glossary/agentic-workflow` | 1108 | 12534 | 33244 |
| `/glossary/ai-governance` | 1108 | 12534 | 33207 |
| `/glossary/ai-impact-assessment` | 1108 | 12534 | 33373 |
| `/glossary/ai-management-system` | 1108 | 12534 | 33402 |
| `/glossary/ai-register` | 1108 | 12534 | 33286 |
| `/glossary/conformity-assessment` | 1108 | 12534 | 33491 |
| `/glossary/data-classification` | 1108 | 12534 | 33297 |
| `/glossary/dpia` | 1108 | 12534 | 33429 |
| `/glossary/eu-ai-act` | 1108 | 12534 | 33298 |
| `/glossary/evals` | 1108 | 12534 | 33235 |
| `/glossary/guardrails` | 1108 | 12534 | 33238 |
| `/glossary/hallucination-rate` | 1108 | 12534 | 33244 |
| `/glossary/high-risk-ai-system` | 1108 | 12534 | 33623 |
| `/glossary/human-in-the-loop` | 1108 | 12534 | 33188 |
| `/glossary/human-oversight` | 1108 | 12534 | 33233 |
| `/glossary/iso-iec-42001` | 1108 | 12534 | 33259 |
| `/glossary/llm-gateway` | 1108 | 12534 | 33233 |
| `/glossary/model-card` | 1108 | 12534 | 33183 |
| `/glossary/model-provenance` | 1108 | 12534 | 33222 |
| `/glossary/nist-ai-rmf` | 1108 | 12534 | 33128 |
| `/glossary/observability` | 1108 | 12534 | 33178 |
| `/glossary/post-market-monitoring` | 1108 | 12534 | 33372 |
| `/glossary/prompt-injection` | 1108 | 12534 | 33248 |
| `/glossary/provider-vs-deployer` | 1108 | 12534 | 33267 |
| `/glossary/red-teaming` | 1108 | 12534 | 33235 |
| `/glossary/retrieval-augmented-generation` | 1108 | 12534 | 33213 |
| `/glossary/serious-incident-reporting` | 1108 | 12534 | 33398 |
| `/glossary/shadow-ai` | 1108 | 12534 | 33097 |
| `/glossary/sub-processor` | 1108 | 12534 | 33165 |
| `/glossary/technical-documentation` | 1108 | 12534 | 33286 |
| `/imprint` | 1108 | 12534 | 25487 |
| `/now` | 1108 | 12534 | 25734 |
| `/pricing` | 1108 | 12534 | 27166 |
| `/privacy` | 1108 | 12534 | 26102 |
| `/resources` | 1108 | 12534 | 26561 |
| `/resources/agent-evals-ci-starter` | 1108 | 12534 | 28202 |
| `/resources/ai-governance-starter-kit` | 1108 | 12534 | 27766 |
| `/resources/ai-readiness-scorecard` | 1108 | 12534 | 28266 |
| `/resources/build-vs-buy-ai-kit` | 1108 | 12534 | 28143 |
| `/resources/llm-gateway-governance-config` | 1108 | 12534 | 28533 |
| `/search` | 2042 | 12534 | 25819 |
| `/security` | 1108 | 12534 | 26603 |
| `/services` | 1108 | 12534 | 26731 |
| `/services/90-day-production-sprint` | 1108 | 12534 | 29225 |
| `/services/ai-readiness-and-risk-assessment` | 1108 | 12534 | 29396 |
| `/services/fractional-caio-retainer` | 1108 | 12534 | 29475 |
| `/styleguide` | 1108 | 12714 | 30165 |
| `/terms` | 1108 | 12534 | 25988 |

Budgets: JS ≤10240 · CSS ≤20480 · page ≤256000 bytes gzip.

## Lighthouse route selection

One leaf per repeated template family (heaviest by built bytes) plus every unique page:
`/`, `/404`, `/about`, `/ai-policy`, `/approach`, `/blog`, `/case-studies`, `/contact`, `/faq`, `/glossary`, `/imprint`, `/now`, `/pricing`, `/privacy`, `/resources`, `/search`, `/security`, `/services`, `/terms`, `/blog/evals-in-ci-for-llm-agents`, `/blog/category/governance`, `/blog/tag/ai-governance`, `/case-studies/only-help-agentic-support`, `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`, `/glossary/high-risk-ai-system`, `/resources/llm-gateway-governance-config`, `/services/fractional-caio-retainer`

## Derived route list (all gates)

`/`, `/404`, `/about`, `/ai-policy`, `/approach`, `/blog`, `/blog/ai-acceptable-use-policy-for-a-50-person-company`, `/blog/category/agentic-architecture`, `/blog/category/executive`, `/blog/category/governance`, `/blog/category/operating-model`, `/blog/evals-in-ci-for-llm-agents`, `/blog/how-to-build-an-ai-system-register-in-a-week`, `/blog/tag/acceptable-use-policy`, `/blog/tag/agentic-architecture`, `/blog/tag/ai-governance`, `/blog/tag/ai-pilots`, `/blog/tag/ai-register`, `/blog/tag/eu-ai-act`, `/blog/tag/evals-in-ci`, `/blog/tag/llm-as-judge`, `/blog/tag/policy-enforcement`, `/blog/tag/production-readiness`, `/blog/tag/security-review`, `/blog/tag/shadow-ai`, `/blog/tags`, `/blog/why-your-ai-pilot-never-reached-production`, `/case-studies`, `/case-studies/only-help-agentic-support`, `/contact`, `/faq`, `/faq/are-models-trained-on-our-customer-data`, `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`, `/faq/can-you-work-with-our-existing-ai-vendor-or-platform`, `/faq/how-do-you-charge-for-the-work`, `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off`, `/faq/how-does-the-retainer-end`, `/faq/how-is-a-prompt-or-model-change-stopped-from-shipping-unnoticed`, `/faq/how-is-cost-per-outcome-measured`, `/faq/how-quickly-can-you-start-and-how-does-availability-work-for-a-remote-officer`, `/faq/is-my-company-too-small-or-too-early-for-a-fractional-chief-ai-officer`, `/faq/what-counts-as-in-production-for-the-90-day-sprint`, `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`, `/faq/what-do-we-do-about-tools-staff-are-already-using-without-approval`, `/faq/what-does-a-fractional-chief-ai-officer-actually-do`, `/faq/what-does-the-two-week-assessment-produce-and-is-the-fee-credited-if-we-continue`, `/faq/what-happens-if-the-evals-say-a-workflow-isnt-good-enough`, `/faq/what-happens-on-a-fit-call-and-does-it-cost-anything`, `/faq/what-if-the-ai-we-are-building-goes-into-a-product-we-sell`, `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead`, `/faq/what-size-of-company-do-you-actually-work-with`, `/faq/whats-the-difference-between-the-assessment-the-sprint-and-the-retainer`, `/faq/who-answers-customer-security-questionnaires`, `/faq/who-owns-the-code-and-the-data`, `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement`, `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`, `/glossary`, `/glossary/agentic-workflow`, `/glossary/ai-governance`, `/glossary/ai-impact-assessment`, `/glossary/ai-management-system`, `/glossary/ai-register`, `/glossary/conformity-assessment`, `/glossary/data-classification`, `/glossary/dpia`, `/glossary/eu-ai-act`, `/glossary/evals`, `/glossary/guardrails`, `/glossary/hallucination-rate`, `/glossary/high-risk-ai-system`, `/glossary/human-in-the-loop`, `/glossary/human-oversight`, `/glossary/iso-iec-42001`, `/glossary/llm-gateway`, `/glossary/model-card`, `/glossary/model-provenance`, `/glossary/nist-ai-rmf`, `/glossary/observability`, `/glossary/post-market-monitoring`, `/glossary/prompt-injection`, `/glossary/provider-vs-deployer`, `/glossary/red-teaming`, `/glossary/retrieval-augmented-generation`, `/glossary/serious-incident-reporting`, `/glossary/shadow-ai`, `/glossary/sub-processor`, `/glossary/technical-documentation`, `/imprint`, `/now`, `/pricing`, `/privacy`, `/resources`, `/resources/agent-evals-ci-starter`, `/resources/ai-governance-starter-kit`, `/resources/ai-readiness-scorecard`, `/resources/build-vs-buy-ai-kit`, `/resources/llm-gateway-governance-config`, `/search`, `/security`, `/services`, `/services/90-day-production-sprint`, `/services/ai-readiness-and-risk-assessment`, `/services/fractional-caio-retainer`, `/styleguide`, `/terms`
