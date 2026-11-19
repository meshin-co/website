---
record: true
---

# Gateway governance and LLM-security material: what exists today

> **File location note.** The assignment named `/tmp/research/gateway-and-security.md`. The `write`
> tool in this session refuses every path outside `xd://` devices and `local://` session scratch
> ("Filesystem writes are not available elsewhere"), so this report is at
> `local://gateway-and-security.md`. Copy it to `/tmp/research/gateway-and-security.md` if that exact
> path is needed.

Reconnaissance only. Every figure below was retrieved on **2026-11-10** unless a different date is
given. Repository figures come from the GitHub REST API (`https://api.github.com/repos/<owner>/<name>`),
which returns `stargazers_count`, `forks_count`, `open_issues_count`, `license.spdx_id`, `pushed_at`
and `archived` in one document; a reader can re-run the same URL. Claims that are my reading rather
than a retrieved fact are tagged `[INFERENCE]`.

---

## 0. Headline: are (a) gateway governance and (b) security material one thing?

**In products, yes. In artifacts, no.** Every gateway vendor now sells traffic control and content
inspection from one surface: Cloudflare's AI Gateway docs file *Guardrails*, *Data Loss Prevention*,
*Rate limiting* and *Spend limits* under one `## Features` heading
(<https://developers.cloudflare.com/ai-gateway/llms.txt>, page last updated 2026-11-04); Kong's AI
Gateway 2.0 policy catalogue lists `ai-prompt-guard`, `ai-lakera-guard`, `ai-nvidia-nemo-guardrail`,
`ai-sanitizer` and `ai-rate-limiting-advanced` in the same index
(<https://developer.konghq.com/ai-gateway/policies/>); Portkey's repo description is "A blazing fast
AI Gateway with integrated guardrails… 50+ AI Guardrails".

But the *published artifacts* split cleanly in two and do not reference each other:

- Gateway-side material is **per-option reference documentation plus a database**. No vendor ships a
  worked, opinionated, committable policy file covering rate limits + DLP + allowed models + audit
  logging + cost caps + per-team policy together. Section 1.2 gives the evidence file by file.
- Security-side material is **prose risk taxonomy (OWASP, CC BY-SA 4.0) plus research corpora
  (mostly MIT) plus scanner plugin trees**. None of it emits gateway configuration, and none of the
  gateway docs cite any of it.

The gap is the join, not either half.

---

## 1. Gateways

### 1.1 The field

| Product | Repo / nature | Open? | Stars | Forks | Open issues | Licence | Last push | Maintainer type |
|---|---|---|---|---|---|---|---|---|
| LiteLLM | `BerriAI/litellm` | open core | **63,049** | 13,165 | **5,072** | MIT **except `enterprise/`** | 2026-11-10 | company (Berri AI) |
| Kong Gateway / AI Gateway | `Kong/kong` | open core | **44,375** | 5,239 | 228 | Apache-2.0 | 2026-10-19 | company (Kong Inc.) |
| promptfoo (adjacent, red team) | `promptfoo/promptfoo` | open | 27,027 | 2,705 | 962 | MIT | 2026-11-09 | company |
| Portkey Gateway | `Portkey-AI/gateway` | open core | **13,361** | 1,377 | 342 | MIT | **2026-05-25** | company |
| Helicone | `Helicone/helicone` | open | 6,276 | 703 | 192 | Apache-2.0 | 2026-10-28 | company (YC W23) |
| The Agent Router (was `envoyproxy/ai-gateway`) | `theagentrouter/agent-router` | open | 2,380 | 461 | 427 | Apache-2.0 | 2026-11-10 | org `theagentrouter` |
| Cloudflare AI Gateway | SaaS only, no public repo | **closed** | — | — | — | proprietary | docs 2026-11-04 | company |
| OpenRouter | SaaS only, no public repo | **closed** | — | — | — | proprietary | — | company |

Two facts in that table are easy to get wrong:

- **`envoyproxy/ai-gateway` no longer exists under Envoy.** `GET /repos/envoyproxy/ai-gateway`
  resolves to `https://api.github.com/repositories/875880554` =
  **`theagentrouter/agent-router`**, "Manages Unified Access to Generative AI Services built on Envoy
  Gateway", homepage `theagentrouter.ai`. Anyone citing "Envoy AI Gateway, a CNCF-adjacent project"
  is citing a redirect.
- **Portkey's open-source gateway has not been pushed since 2026-05-25** — 5.5 months — while the
  hosted product continues to ship. `pushed_at` is the check.

LiteLLM's licence needs reading, not assuming: `LICENSE` opens "Portions of this software are
licensed as follows: * All content that resides under the `enterprise/` directory… is licensed under
the license defined in `enterprise/LICENSE`. * Content outside… is available under the MIT license"
(<https://raw.githubusercontent.com/BerriAI/litellm/main/LICENSE>). The GitHub API reports
`license.spdx_id: "NOASSERTION"` for it, so "LiteLLM is MIT" is true only of the non-enterprise tree.

### 1.2 What a governance configuration for each one actually looks like

**LiteLLM — three disjoint surfaces, and the only shipped example config is a CI fixture.**

1. `config.yaml` carries the model list, `litellm_settings`, `router_settings`, `general_settings`.
2. Teams, keys, budgets and RBAC are **runtime REST + Postgres state**, not file state: team budgets
   are created by `POST /team/new` with `max_budget` / `budget_duration` / `rpm_limit` / `tpm_limit`
   (<https://docs.litellm.ai/docs/proxy/team_budgets>, <https://docs.litellm.ai/docs/proxy/users>).
   A governance posture therefore cannot be fully reviewed in a pull request.
3. Guardrail policy presets live in **`policy_templates.json`**, fetched at runtime from
   `https://raw.githubusercontent.com/BerriAI/litellm/main/policy_templates.json`
   (<https://github.com/BerriAI/litellm-docs/blob/main/docs/proxy/guardrails/policy_templates.md>).

The shipped root example, `proxy_server_config.yaml`
(<https://raw.githubusercontent.com/BerriAI/litellm/main/proxy_server_config.yaml>), is a **test
rig**: it defines `fake-openai-endpoint`, `fake-openai-endpoint-2..5`, `bad-model`, `good-model`,
`badly-configured-openai-endpoint`, sets `dangerously_allow_mock_testing_request_params: true`, and
leaves `max_budget` / `budget_duration` **commented out**. It contains no `guardrails:` block and no
team budgets. That is the flagship 63k-star gateway's only in-repo worked configuration.

`policy_templates.json` is more substantial than its own documentation admits. A grep of the file for
`"id":` returns at least **16 templates**: `advanced-au-pii-protection`, `baseline-pii-protection`,
`nsfw-content-filter-australia`, `nsfw-content-filter-basic`, `nsfw-content-filter-all-regions`,
`gdpr-eu-pii-protection`, `eu-ai-act-article5`, `mcp-security-unregistered-server-block`,
`airline-passenger-data-protection-uae`, `aviation-operations-security`, `uae-regulatory-compliance`,
`competitor-mention-detection`, `pdpa-singapore`, `mas-ai-risk-management`, `claims-agent-safety`,
`canadian-pii-protection`. The docs page's "Current Templates" section lists **two** of them (both
Australian PII) — documented drift against the file it points at.

What those 16 are, and are not: every one is a **content/PII regex or keyword guardrail keyed to a
jurisdiction or a vertical** (AU tax IDs, French NIR/INSEE + EU IBAN, Emirates ID, Singapore
NRIC/FIN, Canadian SIN/OHIP, airline PNR). There is **no template for allowed-model lists, cost
caps, per-team budgets, audit-log retention, or prompt injection**. The closest are
`mcp-security-unregistered-server-block` (blocks unregistered MCP servers) and one of five categories
inside `claims-agent-safety`. That template's description also carries an unsupported measurement —
"Evaluated on 243 test cases with 100% precision and 100% recall across all 5 categories" — with no
artifact in the file to check it against.

**Kong — ~60 named policies, declarative via `deck`, and exactly one opinionated snippet.**
<https://developer.konghq.com/ai-gateway/policies/> enumerates the catalogue (AI, Analytics,
Authentication, Logging, Monetization, Security, Serverless, Traffic Control). Config is real
declarative YAML (`_format_version: "3.0"`, applied with `deck gateway apply -`), and the frontmatter
on each policy page states the licensing boundary machine-readably:

- `ai-prompt-guard`: `products: [Kong Gateway, AI Gateway]`, `min_version: gateway 3.6` — ships with
  the Apache-2.0 gateway.
- `ai-rate-limiting-advanced`: `products: [AI Gateway]`, `min_version: ai-gateway 2.0`,
  `scopes: [ai-model, ai-consumer, ai-consumer-group, global]` — token-cost rate limiting is an AI
  Gateway product feature, not an OSS plugin.

Kong's one published *opinionated* rule is a "Best practices" block in the AI Prompt Guard page: four
PCRE patterns denying invisible Unicode (zero-width, bidi controls, tag-block characters). Four
regexes is the entire worked policy content in the catalogue. Everything else is per-option
reference: strategies (`local` / `cluster` / `redis`), sync-rate accuracy maths, ElastiCache IAM
wiring.

**Cloudflare AI Gateway — feature-complete, closed, and configured in a dashboard.** The doc index
(<https://developers.cloudflare.com/ai-gateway/llms.txt>) covers every item in question (a):
*Data Loss Prevention* with a separate "Set up DLP" page; *Guardrails* with set-up, supported model
types and usage-considerations pages; *Rate limiting* (fixed/sliding); *Spend limits* — "cost-based
budgets… by model, provider, or custom metadata dimensions like user or team"; *Logging* ("prompts,
responses, tokens, costs, and DLP actions"), Logpush, OpenTelemetry; *Audit logs* (configuration
changes only — "gateway creation, deletion, and updates"); *User Insights* ("organization-wide AI
spend, attribute usage to identities, and detect anomalous sessions"); *BYOK*; *Cloudflare Access*.
Allowed-model control is indirect: model aliases, dynamic routes (JSON configuration), custom
providers. There is a *Pricing* page covering "logs and premium features", so [INFERENCE] some of
DLP/Guardrails is paid — confirmable at
<https://developers.cloudflare.com/ai-gateway/reference/pricing/>.

**OpenRouter — closed, account-shaped governance, no file.** Management API keys are org-admin-only
and "unscoped: one key covers administrative actions across all of the account's workspaces".
Per-key controls are `limit` (credit cap), `limit_reset` (`daily`/`weekly`/`monthly`), `disabled`,
`include_byok_in_limit`, plus `usage_daily|weekly|monthly` read-back. Allowed-model control is
`is_filtered_model_catalog_enabled` (default `false`) at organisation level, where "which models
remain visible is decided by the active workspace's guardrails and provider preferences". Assigning
workspace roles "requires a Pro or Enterprise plan".
(<https://openrouter.ai/docs/guides/overview/auth/management-api-keys>)

**The long tail.** A GitHub-scoped search for published gateway governance configs returns a crowd of
single-author repos: `levi840714/ai-gov-gateway`, `javabbgit/llm-gateway-governance`,
`faaizzz/aws-ai-gateway-with-litellm-poc`, `ntepp/llm-gateway-governance-lab`,
`cybergavin/litellm-control-plane`, `NathanMaine/governed-llm-gateway`, `ktirupati/policyaware`,
`PalenaAI/litellm-operator`, `ASP-01/llm-guardrails-gateway`, `leo-hildegarde/llm-gateway-blueprint`,
`openziti/llm-gateway`, `vedantkumkar/LLM-Gateway`, `devilmango/llm_gateway`,
`AnshChhikara001/llm-safety-gateway`. Spot-checking the exact name collision:
`javabbgit/llm-gateway-governance` — "Governed LLM gateway for a regulated lender: PII data-residency
routing with fail-closed detection, team allowlists, budgets, chargeback and a policy audit trail.
One-command demo, 17 ADRs" — was **created 2026-10-22**, last pushed 2026-11-05, has **0 stars, 0
forks, `license: null`**, and its homepage field is the author's LinkedIn profile. The category has
no incumbent and a dozen unlicensed portfolio pieces.

### 1.3 Verdict on (a)

Everything in question (a) exists as a *capability*, in at least one open-source and one closed
product. What does not exist anywhere I could find: **a single, maintained, licensed, worked policy
configuration that an engineer can copy, commit, and defend in a security review** — rate limits,
DLP, allowed models, audit logging, cost caps and per-team policy in one reviewable file, with the
reasoning for each default written down. The nearest four candidates and why each falls short:
LiteLLM's example config is a mock-endpoint test rig; LiteLLM's 16 policy templates are jurisdiction
PII/NSFW regex packs delivered as dashboard JSON; Kong's catalogue is 60 reference pages plus four
Unicode regexes; Cloudflare's is a dashboard with per-option docs.

---

## 2. Prompt injection

### 2.1 OWASP Top 10 for LLM Applications — the current edition is 2026

- **Current release: 2026, published 2026-08-04.** Primary source: the project's own repository
  README, <https://github.com/GenAI-Security-Project/GenAI-LLM-Top10> (167 stars, 57 forks, 60 open
  issues), and the publication page
  <https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/> (resource index dates it
  2026-08-03).
- **Licence: CC BY-SA 4.0.** Stated in the README's own "License" section and badge. **ShareAlike
  matters**: a derivative work that adapts OWASP text must itself be CC BY-SA 4.0.
- **Citable**: Zenodo concept DOI `10.5281/zenodo.22109014`; 2026 version DOI
  `10.5281/zenodo.22109015`; `CITATION.cff` in repo.
- **Canonical source is Markdown in `2026/final/`**, one file per entry, plus
  `2026/final/mappings/` containing machine-readable crosswalks: `nist-ai-rmf-1.0.json`,
  `nist-ai-600-1.json`, `mitre-atlas-2026.06.json`, `mitre-attack-v19.1.json`, `cwe-4.20.json`,
  `csa-aicm-v1.1.json`, `owasp-aivss-v0.8.json`, `asi-2026.json`, `dsgai-v1.0.json`.
- **The 2026 order**: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Excessive
  Agency, LLM04 Supply Chain, LLM05 Data and Model Poisoning, LLM06 Unbounded Consumption, LLM07
  Misinformation, **LLM08 Hidden Context Exposure (new)**, LLM09 Vector and Embedding Weaknesses,
  LLM10 Improper Output Handling. 2025's "LLM07 System Prompt Leakage" is gone as a standalone entry.

What `2026/final/LLM01_PromptInjection.md` actually contains (read directly): a three-axis anatomy
(delivery surface / propagation behaviour / encoding); three deployment properties that worsen it
(context-window pooling, memory persistence, agentic execution); direct vs indirect with a
trust-tiering of delivery surfaces (untrusted / semi-trusted / trusted); **8 numbered "Common
Examples of Risk"** (including fine-tuning-API gradient oracles at "65% to 82% attack success on
Gemini", invisible-character smuggling, cross-session RAG poisoning); then numbered prevention
controls. Its own position, quotable: "no reliable prevention mechanism exists today, a position
consistent with NIST (2025), NCSC (2025), and Debenedetti et al. (2025)". It cites Willison's "lethal
trifecta" as a pre-deployment check.

**Important: OWASP ships prose, not test cases.** The `2026/final/` tree contains `.md` entries,
appendices, mapping JSON and report images. There is no attack corpus, no YAML, no machine-readable
example payloads.

**Tooling has not caught up.** promptfoo's OWASP page
(<https://www.promptfoo.dev/docs/red-team/owasp-llm-top-10/>, retrieved 2026-11-10) still presents
the **2025** list as "the current top 10" (it shows LLM07 System Prompt Leakage, LLM03 Supply Chain
at position 3), three months after the 2026 release. Its presets are nonetheless real and usable:
`owasp:llm`, `owasp:llm:01`…, plus NIST and EU AI Act presets, and OWASP lists promptfoo in its own
AI Security Solutions Landscape.

### 2.2 Public attack corpora and benchmarks

| Corpus / benchmark | Size | Owner | Licence | Last updated | Usage signal | Redistributable? |
|---|---|---|---|---|---|---|
| `hackaprompt/hackaprompt-dataset` | `100K<n<1M` (competition submissions, EMNLP 2023) | HackAPrompt / Learn Prompting | **MIT** | 2024-01-24 | 1,165 downloads, 119 likes | Yes (but HF `gated: "auto"` — account + click-through to fetch) |
| `verazuo/jailbreak_llms` (CCS'24) | **15,140** prompts, of which **1,405** jailbreaks; + 390 forbidden questions / 13 scenarios | academic (CISPA et al.) | **MIT** | prompt files dated 2023-12-25 | 3,884 stars, 342 forks | Yes |
| `JailbreakBench/JBB-Behaviors` | 100 harmful + 100 benign behaviours + judge-comparison set | JailbreakBench (NeurIPS 2024 D&B) | **MIT** | 2024-09-26 | **39,883 downloads**, 153 likes | Yes |
| `Lakera/gandalf_ignore_instructions` | 1,000 (777/111/112) real injections from the Gandalf game | Lakera (company) | **MIT** | 2025-02-28 | 3,116 downloads | Yes |
| `deepset/prompt-injections` | 662 (546 train / 116 test) | deepset (company) | **conflicting: tag + `cardData.license` = `apache-2.0`, `dataset_info.license` = `cc-by-4.0`** | 2024-07-30 | 16,151 downloads, 200 likes | Unclear — two licences in one card |
| Lakera **PINT** | 4,314 inputs (3,016 EN + 1,298 non-EN), 24+ languages | Lakera | harness MIT; **dataset not published** | newest score 2025-08-27 | 200 stars, 2 forks | **No** |
| `ethz-spylab/agentdojo` | **97** user tasks + **629** security cases, 4 suites (workspace, Slack, banking, travel) | ETH Zurich SPY Lab | **MIT** | pushed 2026-06-02 | 1,015 stars, 280 forks, 105 open issues | Yes |
| InjecAgent | **1,054** cases, 17 user tools, 62 attacker tools | UIUC (ACL Findings 2024) | see `uiuc-kang-lab/InjecAgent` | — | — | [INFERENCE] likely permissive; licence not retrieved |
| `centerforaisafety/HarmBench` | **510** behaviours = 400 textual + 110 multimodal, 7 categories | Center for AI Safety + UC Berkeley + Google DeepMind | **MIT** | **pushed 2024-08-16** | 1,119 stars, 173 forks, 42 open issues | Yes |
| `NVIDIA/garak` probe tree | **41** probe modules | NVIDIA | **Apache-2.0** | pushed 2026-11-06 | 9,983 stars, 1,465 forks, 565 open issues | Yes |

garak is where the attack content actually lives as code:
<https://github.com/NVIDIA/garak/tree/main/garak/probes> lists, with byte sizes,
`latentinjection.py` (37,986 B — indirect injection), `web_injection.py` (23,328 B),
`agent_breaker.py` (34,360 B), `goat.py` (37,815 B), `dan.py` (21,545 B), `encoding.py` (29,039 B),
`fitd.py` (28,452 B), `smuggling.py`, `sysprompt_extraction.py`, `promptinject.py`, `goodside.py`,
`ansiescape.py`, `badchars.py`, plus 28 more.

**Three load-bearing weaknesses of the public corpus landscape, each checkable:**

1. **The leading injection-detection benchmark withholds its data and skips indirect injection.**
   PINT's README: the dataset is "a blend of public and proprietary data", deliberately unpublished
   so detectors cannot train on it; and "Indirect detection scores are considered out of scope for
   this benchmark and have not been calculated." Indirect injection is exactly what OWASP's 2026
   LLM01 treats as the main event.
2. **The public sets are old.** jailbreak_llms' prompt files are dated 2023-12-25; HackAPrompt
   2024-01-24; deepset 2024-07-30; HarmBench's repo has not been pushed since 2024-08-16. Of the
   corpora above, only AgentDojo (2026-06-02) and garak's probe tree (2026-11-06) moved this year.
3. **Nothing maps a corpus to the risk taxonomy.** OWASP ships mappings to NIST/MITRE/CWE but not to
   any example set; the corpora ship labels in their own vocabularies (`prompt_injection`,
   `jailbreak`, `hard_negatives`, `chat`, `documents` in PINT; 13 "forbidden scenarios" in
   jailbreak_llms; 7 semantic categories in HarmBench).

**Is there a canonical set a practitioner cites?** No. There is a *canonical taxonomy* (OWASP LLM01,
CC BY-SA 4.0) and a *de facto canonical tool* (garak's 41 probe modules, Apache-2.0, plus
promptfoo's plugins). Everyone assembles their own examples; the Lakera scoreboard is the closest
thing to a shared yardstick, and its data is private.

---

## 3. Guardrails: what ships as a usable rule set, not a framework for writing rules

| Thing | What it really is | Stars / downloads | Licence | Last updated |
|---|---|---|---|---|
| `NVIDIA-NeMo/Guardrails` (moved from `NVIDIA/NeMo-Guardrails`) | **Framework** — Colang rails you author | 7,469 stars, 900 forks, 277 open issues | **Apache-2.0** (`LICENSE.md` SPDX header; the API reports `NOASSERTION`) | pushed 2026-11-10 |
| `guardrails-ai/guardrails` + Guardrails Hub | Framework + **65 validators** | 7,596 stars, 738 forks, 63 open issues | Apache-2.0 | pushed 2026-11-10 |
| `meta-llama/Llama-Guard-4-12B` | Content-safety classifier with a **fixed 13/14-category taxonomy** | 96,682 downloads, 139 likes | **Llama 4 Community Licence** (`license_name: llama4`), **`gated: "manual"`** | 2025-04-29 |
| `meta-llama/Llama-Prompt-Guard-2-86M` | The actual **injection/jailbreak classifier** (DeBERTa-v2, 8 languages) | 94,789 downloads, 373 likes | Llama 4 Community Licence, **`gated: "manual"`** | 2025-04-29 |
| `openai/gpt-oss-safeguard-20b` | **Policy-as-prompt** reasoning model: you supply the policy text | 22,868 downloads, 292 likes | **Apache-2.0, not gated** | 2026-01-14 |
| `protectai/llm-guard` | 20-plus input/output scanners | 3,218 stars, 475 forks | MIT | **`archived: true`**, last push 2026-07-08 |

Details that decide the question:

- **Llama Guard is not an injection detector.** Its taxonomy, readable in the model's own
  `chat_template`, is S1 Violent Crimes … S13 Elections for image+text and adds S14 Code Interpreter
  Abuse for text-only. There is no prompt-injection category. Meta's injection classifier is the
  separate Prompt Guard 2, which scores **78.7578%** on PINT versus Lakera Guard's 95.2200%, AWS
  Bedrock Guardrails' 89.2404% and Azure AI Prompt Shields' 89.1241% (PINT README; test dates
  2025-05-02 to 2025-08-27; note the benchmark is published by one of the vendors it ranks first).
  Google Model Armor 70.0664%, Aporia Guardrails 66.4373%, Llama Prompt Guard 1 61.8168%.
- **Guardrails Hub = 65 validators** (the page states "65 validators" and "Validators 65 / 65").
  The injection-relevant ones are `detect_jailbreak`, `detect_prompt_injection` ("using the Rebuff
  prompt library"), `prompt_injection_detector` ("scores prompts for injection attempts via a
  secondary LLM"), `detect_system_prompt_leakage`, `unusual_prompt`, plus wrappers for
  **`llamaguard_7b`** (Llama Guard **1**, long superseded by Guard 4) and `shieldgemma_2b`. Its risk
  taxonomy is Brand risk / Formatting / Etiquette / Jailbreaking / Data Leakage / Code Exploits /
  Invalid Code / Factuality — a product-quality taxonomy, **not mapped to OWASP**. Curation is loose:
  one hub entry is `sky_validator`, "Validates that the input string does not contain negative
  statements about Sky Electric."
- **The one open-source toolkit that shipped a ready scanner set is archived.** `protectai/llm-guard`
  returns `archived: true`.
- **`gpt-oss-safeguard` inverts the problem.** It is Apache-2.0 and ungated, and it classifies
  against *a policy you bring at inference time*. The weights are free; the policy text is the thing
  nobody publishes.

**Answer to "what ships as a usable rule set":** almost nothing. Rule sets that exist are either (i)
fixed harm taxonomies baked into gated model weights (Llama Guard S1–S14), (ii) jurisdiction PII
regex packs (LiteLLM's 16 templates, Kong's four Unicode regexes), or (iii) 65 single-purpose
validators you must still choose between and wire up. Nobody ships an opinionated, justified default
rule set for an enterprise LLM gateway.

---

## 4. Red teaming

**Published methodology — OWASP owns this space, and it moved three weeks ago.** From
<https://genai.owasp.org/resources/>:

- **GenAI Red Teaming Guide v1.0 — 2025-01-23**, CC BY-SA 4.0
  (<https://genai.owasp.org/resource/genai-red-teaming-guide/>; announcement 2025-01-22).
- **GenAI Red Teaming Manual v1.0 — 2026-10-20**, an eight-phase methodology ("planning,
  reconnaissance, attack surface mapping, exploitation, persistence, impact assessment, …").
- **Vendor Evaluation Criteria for AI Red Teaming Providers & Tooling v1.0 — 2026-02-04.**
- **Solutions Landscape – Red Teaming Taxonomy — 2026-06-28**; AI Security Solutions Landscape for
  AI and Agentic Red Teaming Q2 2026 — 2026-04-09.
- Adjacent and recent: **Securing Agentic Applications V2 — 2026-11-10 (today)**; GenAI Data Security
  Best Practices v2 Part 1 — 2026-11-03; LLM Exploit Generation Guide 2.0 — 2026-10-27; Agent
  Control Standard — 2026-09-01; **GenAI Security Industry Framework Crosswalk — 2026-09-01**, which
  "maps 51 GenAI vulnerabilities across four source lists to controls"; OWASP Top 10 for Agentic
  Applications 2026 — 2025-12-09.

That cadence is a competitive fact for any resource in this space: a volunteer standards body is
publishing a major CC BY-SA artifact roughly monthly, including vendor-questionnaire-shaped and
crosswalk-shaped material.

**Open tooling.**

| Tool | Owner | Stars | Licence | Last push | Note |
|---|---|---|---|---|---|
| `NVIDIA/garak` | NVIDIA (company) | 9,983 | Apache-2.0 | 2026-11-06 | 41 probe modules; 565 open issues |
| `microsoft/PyRIT` | Microsoft (company) | 4,781 | MIT | 2026-11-10 | "automated scans, adaptive multi-turn attacks, web UI" |
| `promptfoo/promptfoo` | company | 27,027 | MIT | 2026-11-09 | OWASP/NIST/EU-AI-Act presets; "Used by OpenAI and Anthropic" |

**Citation trap:** `Azure/PyRIT` is a different repository — created 2026-03-25, **`archived: true`**,
126 stars, 0 open issues, `has_issues: false`. The live project is `microsoft/PyRIT`.

**What is restricted, and by whom.**

- **Meta gates its safety classifiers behind manual approval and an identity form.** Both
  `Llama-Guard-4-12B` and `Llama-Prompt-Guard-2-86M` carry `gated: "manual"` and require First name,
  Last name, Date of birth, Country, Affiliation, Job title, IP geolocation, plus acceptance of the
  Llama 4 Community Licence and Acceptable Use Policy.
- **Lakera withholds the PINT dataset** to prevent detectors optimising against it (README).
- **HackAPrompt is `gated: "auto"`** — a logged-in click-through, not an approval queue.
- Harm corpora self-restrict by convention rather than licence: jailbreak_llms ships a "Disclaimer…
  contains examples of harmful language… intended for research purposes only"; HarmBench's 510
  behaviours include CBRN and copyright categories.
- **Not verified:** gating status of AI2's WildJailbreak/WildGuardMix and the UK AISI AgentHarm set.
  See §8.

---

## 5. Is the gateway-policy reader the same person as the prompt-injection reader?

**Evidence they are the same person (the operator):**

- Cloudflare sells DLP, Guardrails, rate limiting and spend limits as features of **one product**,
  configured by whoever owns the gateway (`developers.cloudflare.com/ai-gateway/llms.txt`).
- Kong's single AI Gateway policy index mixes `ai-rate-limiting-advanced` with `ai-prompt-guard`,
  `ai-lakera-guard`, `ai-nvidia-nemo-guardrail` and `ai-sanitizer`.
- LiteLLM's one template library holds NSFW filters, GDPR Art. 32 PII masking, **EU AI Act Article 5
  prohibited practices**, and MCP server blocking — i.e. compliance text and content filtering
  arrive through the same gateway admin UI.
- Portkey markets "integrated guardrails… 50+ AI Guardrails" as gateway features.

**Evidence they are different people (the reader):**

- OWASP addresses its Top 10 to "developers, architects, data scientists, security practitioners, and
  organizations building or operating applications that use large language models" (repo README) —
  an application-security audience, not a proxy operator.
- The gateway material addresses the proxy admin: `master_key`, `store_model_in_db`, RBAC on
  `/team/update`, `raise_max_budget` permissions, SSO/SCIM, Redis sync-rate accuracy maths.
- **Meta's own gate form has no security job title.** The `Job title` select on both Llama Guard 4 and
  Prompt Guard 2 offers exactly: Student, Research Graduate, AI researcher, AI developer/engineer,
  Reporter, Other. The people who would deploy an injection classifier in front of a gateway are not
  in the vendor's list of expected requesters.
- Guardrails Hub's taxonomy (Brand risk, Etiquette, Factuality) is a product-manager vocabulary;
  OWASP's is CWE-mapped. Neither cites the other.

**Reading:** one *operator*, two *audiences and two buying moments*. [INFERENCE] A single artifact can
serve both only if the injection examples arrive as **fixtures the config is tested against** (inputs
the gateway policy must block, with expected verdicts), not as prose to read. That framing is also
the only one that makes the examples' licences load-bearing.

---

## 6. Licensing: can a resource carry attack examples, or only link to them?

**It can carry them.** The permissive, redistribution-friendly sets are:

- **MIT** — HackAPrompt dataset; `verazuo/jailbreak_llms` (15,140 prompts); JailbreakBench
  JBB-Behaviors; `Lakera/gandalf_ignore_instructions` (1,000 real injections); HarmBench; AgentDojo;
  the PINT harness (not its data).
- **Apache-2.0** — garak's probe modules (the richest indirect-injection material available).

**Cannot or should not be redistributed:**

- **PINT's 4,314 inputs** — never published.
- **Llama Guard / Prompt Guard weights** — Llama 4 Community Licence: ship a copy of the agreement,
  display "Built with Llama", prefix derivative model names with "Llama", retain the notice file,
  comply with the AUP, and request a separate licence above 700M MAU. Gated by manual approval.
- **OWASP text — CC BY-SA 4.0 is ShareAlike.** Quoting or adapting OWASP's scenario and mitigation
  prose into a resource pushes that file toward CC BY-SA 4.0. Citing the numbered entries and linking
  is clean; lifting the text is not, if the resource wants an MIT/CC-BY posture.
- **`deepset/prompt-injections` is internally contradictory** — `apache-2.0` in the tag and
  `cardData.license`, `cc-by-4.0` in `cardData.dataset_info.license`. Treat as unresolved until the
  maintainer clarifies.

Practical note: HF `gated: "auto"` (HackAPrompt) and `gated: "manual"` (Meta) restrict *access*, not
*onward licence* — MIT content obtained through a click-through gate remains MIT.

---

## 7. What a serious practitioner still cannot get

1. **One reviewable gateway policy file** that sets rate limits, DLP, allowed models, audit-log
   retention, cost caps and per-team policy together, with a written rationale per default. All four
   major gateways document options; none publishes a defensible baseline.
2. **Version-controlled team/budget state for LiteLLM.** Budgets, keys and teams live in Postgres
   behind `POST /team/new`; there is no first-party declarative source of truth, which is why third
   parties keep rebuilding one (`cybergavin/litellm-control-plane` with OpenTofu,
   `PalenaAI/litellm-operator` with CRDs).
3. **A non-PII policy template library.** LiteLLM's 16 templates are jurisdiction PII/NSFW packs;
   nobody ships templates for allowed-model allowlists, cost caps, or audit-log retention.
4. **An indirect-injection example set with a licence and a 2026 date.** AgentDojo (MIT, 629 cases)
   is the only live candidate, and it is an agent simulation environment, not a payload corpus; PINT
   explicitly excludes indirect detection; garak's `latentinjection.py` is code, not a documented
   example list.
5. **A corpus-to-taxonomy mapping.** No published artifact maps example payloads to OWASP 2026
   LLM01's eight risk examples, let alone to the NIST/MITRE crosswalks OWASP already ships.
6. **A worked, published policy text for policy-as-prompt guardrails.** `gpt-oss-safeguard` is
   Apache-2.0 and ungated, and needs a policy nobody publishes.
7. **A maintained open scanner rule set.** The one that existed (`protectai/llm-guard`, MIT, 3,218
   stars) is archived.
8. **Evidence artifacts for security review.** Cloudflare's audit log covers configuration changes,
   not policy decisions; LiteLLM's `claims-agent-safety` template asserts "100% precision and 100%
   recall" with nothing to verify it against. What a reviewer asks for — "show me the policy ran, on
   this input, with this verdict, on this date" — is not shipped by anyone here.
9. **Currency.** promptfoo's OWASP preset page still documents the 2025 list in November 2026; the
   PINT scoreboard's newest number is 2025-08-27; four of the main corpora have not changed since
   2024. A maintained thing would stand out on freshness alone.

---

## 8. Not verified / follow-ups

- Whether Cloudflare's DLP and Guardrails are paid add-ons:
  <https://developers.cloudflare.com/ai-gateway/reference/pricing/>.
- Exact template count in `policy_templates.json` beyond the 16 ids my grep returned (the file
  continues past line 2528): fetch the file and count `"id"` keys.
- InjecAgent's licence (`uiuc-kang-lab/InjecAgent`); AI2 WildJailbreak / WildGuardMix and UK AISI
  AgentHarm gating and licences.
- Kong's OSS vs AI Gateway Enterprise split beyond the two policy pages I read; the per-page
  frontmatter (`products:`, `min_version:`) is the machine-checkable signal to enumerate.
- `reference.garak.ai/en/latest/probes.html` returned empty content, so the number of individual
  attack prompts garak ships is unverified; the 41 figure is **modules**, from the directory listing.
