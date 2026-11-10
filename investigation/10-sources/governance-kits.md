---
record: true
---

# What a company director can actually download today, free, when a security review asks for the AI governance documents

Intended path `/tmp/research/governance-kits.md`; this agent's `write` tool refuses filesystem paths, so the report is published as the session artifact `local://governance-kits.md`. Copy it to the intended path if a file on disk is required.

Reconnaissance, not design. All repository metrics were read from the GitHub REST API on **2026-11-10**; web sources carry their own retrieval date. Anything I did not verify is tagged `[INFERENCE]` or stated as not found.

A note on this brief's own framing: the task sheet suggested the gap might be that "no public repository pairs each required document with the role that signs it". **That is false, and I verified it is false.** Section 8 states the real gap instead.

---

## 1. Bottom line: the four things that are genuinely free, ungated and reusable today

| What | Who | Licence / terms | Format | Source |
|---|---|---|---|---|
| NIST AI RMF Playbook — 72 subcategories with suggested actions, documentation questions and references | NIST (US federal agency) | US Government work, public domain; no click-through | **JSON**, CSV, XLSX, PDF | `https://airc.nist.gov/docs/playbook.json`, read 2026-11-10 |
| NIST AI RMF as an OSCAL catalogue (`nist.gov/AI100-1/v1.0`) | NIST OSCAL team | same | OSCAL JSON/XML/YAML | `https://github.com/usnistgov/oscal-content/tree/main/nist.gov/AI100-1`, API-verified 2026-11-10 |
| FINOS AI Governance Framework — 24 risk entries + 25 mitigation entries, each cross-referenced to ISO 42001 clauses, EU AI Act articles and NIST SP 800-53r5 controls in YAML front matter | FINOS (Fintech Open Source Foundation, Linux Foundation) | **CC-BY-4.0** | Markdown + YAML front matter | `https://github.com/finos/ai-governance-framework` |
| ICO AI and data protection risk toolkit | UK Information Commissioner's Office | **Open Government Licence v3.0** (commercial reuse allowed with attribution) | Excel | `https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/ai-and-data-protection-risk-toolkit/` |

Everything else is either (a) a 0–33 star individual repository, (b) paywalled by a standards body, (c) gated by a vendor form, or (d) free to read but licensed so you cannot adapt it.

---

## 2. Open repositories

### 2.1 The shape of the field, measured

GitHub search for `"ai governance" in:name,description`, sorted by stars (`https://api.github.com/search/repositories`, 2026-11-10): **5,641 repositories**. The top of that list is almost entirely *runtime software*, not documents:

| Repo | Stars | Last push | Licence | Open issues | What it is |
|---|---|---|---|---|---|
| `trustgraph-ai/trustgraph` | 2,906 | 2026-11-09 | Apache-2.0 | 20 | agent/knowledge platform |
| `obot-platform/obot` | 1,178 | 2026-11-09 | MIT | 335 | agent platform |
| `verifywise-ai/verifywise` | 374 | 2026-11-10 | NOASSERTION | — | AI governance + evals platform (software) |
| `hounddogai/hounddog` | 133 | 2026-11-04 | — | — | privacy code scanner |
| **`finos/ai-governance-framework`** | **118** | **2026-11-04** | **CC-BY-4.0** | — | **documents (risk/mitigation catalogue)** |
| `agentrust-io/awesome-ai-governance` | 66 | 2026-10-31 | CC0-1.0 | — | link list |
| **`Ankit-Uniyal/iso-42001-ai-governance-toolkit`** | **33** | **2026-08-02** | **MIT** | 1 | **documents (ISO 42001 implementation set)** |
| `morganrcu/awesome-eu-ai-act` | 31 | 2026-09-26 | — | — | link list |

**Verified finding:** the ceiling for an open *document* repository in this category is 118 stars (FINOS), and the highest-starred *template* repository is 33 stars. The platforms are one to two orders of magnitude more popular than any document set. There is no "the repo everyone links to" for AI governance paperwork.

### 2.2 `finos/ai-governance-framework` — the strongest thing in the category

- Owner: FINOS, a Linux Foundation project (institutional, not individual). 118 stars, 3,028 KB, last push 2026-11-04, CC-BY-4.0, `LICENSE.spdx` present, `GOVERNANCE.md` (8.9 KB) and `MAINTAINERS.md` present.
- Content: `docs/_risks/` holds **24** entries (ids `ri-1`…`ri-30`, with gaps) and `docs/_mitigations/` holds **25** (`mi-1`…`mi-25`), each 4–26 KB of real prose. Directory listings read via the contents API, 2026-11-10.
- **It is machine-readable.** `docs/_mitigations/mi-24_human-in-the-loop-action-approval-gate.md` opens with YAML front matter containing `iso-42001_references: [A-6-2-6, A-9-2]`, `eu-ai-act_references: [c3-s2-a14]`, `nist-sp-800-53r5_references: [ac-3, ac-5, ac-6, au-10, si-4]`, `mitigates: [ri-24, ri-18, ri-22]`, `related_mitigations: [mi-18, mi-11, mi-21]`. A `docs/_data/` directory and `scripts/` support generation.
- What it is **not**: a risk-and-control catalogue for financial services, not a document set. There is no AI policy you can sign, no vendor questionnaire, no register template, no incident call tree. It tells you which controls address which risk; it does not hand you the artefacts a reviewer asks to see.

### 2.3 `Ankit-Uniyal/iso-42001-ai-governance-toolkit` — the most complete free document set, and a copyright problem

- Individual maintainer, 33 stars, 4 forks, 1 open issue, MIT, created 2026-04-10, **last push 2026-08-02** (three months stale), 1,081 KB, homepage `ankituniyalprofile.com`.
- Real content, not a promise. Top level (contents API, 2026-11-10): `00-README.md` (16 KB), `01-GAP-ASSESSMENT.md` (18.9 KB), `02-IMPLEMENTATION-ROADMAP.md` (23 KB), per-clause directories `03-CLAUSE4-CONTEXT` … `09-CLAUSE10-IMPROVEMENT`, `10-ANNEX-A-CONTROLS.md` (**174,945 bytes**), `11-CONTROLS-MAPPING.md`, `12-ANNEX-B-AI-CONCEPTS.md`, `13-ANNEX-C-AI-DEVELOPERS.md`, `14-WORKED-EXAMPLE/`, `15-SCRIPTS/`.
- **It does assign signers.** `10-ANNEX-A-CONTROLS.md` carries, per control, a "Documents to Prepare" table with columns `Document | Description | Owner` — e.g. "AI Policy (AIMS-POL-001) … signed by senior management | **CEO / CTO / Board**"; "Policy Communication Records | **HR / Communications**"; "Policy Review Records | **AI Governance Lead**". The README lists `04-CLAUSE5-LEADERSHIP/RACI-MATRIX.md`, `AI-SYSTEM-OWNERSHIP-REGISTER.md` ("A named accountable owner for every AI system"), `RISK-TREATMENT-PLAN.md` ("with owner sign-off"), and per-phase lines such as "**Who owns this phase:** AI Governance Lead, with sign-off from top management."
- **Licence risk, stated carefully.** `10-ANNEX-A-CONTROLS.md` is titled "Complete Implementation, Audit & Evidence Guide — All 38 Controls" and renders a "**Control Statement:**" for each Annex A control in wording close to the standard. ISO's own licence grants "no rights of reproduction, distribution, adaptation, incorporation, digital integration, or creation of derivative works of the ISO Publication, in whole or in part" (`https://www.iso.org/terms-conditions-licence-agreement.html`). An MIT grant from a third party cannot convey rights ISO never granted. Whether these specific paraphrases infringe is a legal question I cannot resolve `[INFERENCE]`; what is verifiable is that a director reusing this file has no provenance trail and no indemnity, and the repository ships no statement of how the Annex A text was derived.

### 2.4 The README-promises-more pattern, caught in the act

`nosistech/governance-templates` (NosisTech LLC, created **2026-10-19**, pushed **2026-11-10**, 0 stars, 0 forks, 0 open issues, CC-BY-4.0). Its GitHub **description** reads: "Free AI governance templates for small and mid-size companies: AI acceptable-use policy, **risk register, vendor questionnaire, and incident playbook**."

Contents API, 2026-11-10 — the repository contains exactly: `.gitignore`, `LICENSE`, `README.md`, and **one** directory, `01-ai-acceptable-use-policy/`. The README's own table marks templates 02 (tool inventory and risk register), 03 (vendor security questionnaire) and 04 (incident-response playbook) as "**Coming soon**". Three of the four advertised artefacts do not exist.

What *does* exist is good and is the closest published analogue to the `ai-governance-starter-kit` promise: four industry variants (generic, US healthcare clinic group, B2B AI SaaS, consulting firm), Markdown **and** .docx, a one-page staff cheat sheet, a Spanish/English client notice, and an appendix mapping each section to NIST AI 100-1 / AI 600-1, ISO 42001 Annex A areas, the EU AI Act and OWASP LLM Top 10 — with deep links to exact PDF pages (`NIST.AI.100-1.pdf#page=28`) and to `eur-lex.europa.eu/eli/reg/2024/1689/oj/eng#art_5`. The policy itself names `Policy owner`, `Approved by`, `Effective date`, `Version`, `Next review`, a role table (`Policy owner` / `Tool approver` / `Tool owner` / `Managers` / `All staff`) and a `Name | Signature | Date` block.

### 2.5 The rest of the open layer, measured

| Repo | Stars | Last push | Licence | Verdict |
|---|---|---|---|---|
| `CarbeneAI/AI-Governance-Toolkit` | 1 | 2026-09-14 | CC-BY-4.0 | maturity self-assessment + framework template; 65 KB total |
| `diShine-digital-agency/ai-compliance-framework` | 3 | 2026-05-08 | **NOASSERTION** | 4.7 MB, HTML; README redirects to `compliance.dishine.it` as the "canonical" source — the repo is a marketing mirror |
| `MinBZK/Algoritmeregister` | 22 | 2025-09-03 | EUPL-1.2 | Dutch government algorithm register; 30 open issues; ships the metadata standard as JSON |
| `Principled-Evolution/gopal` | 9 | 2026-09-19 | Apache-2.0 | 85 Rego policies encoding EU AI Act / NIST AI RMF / sectoral rules as executable allow-deny checks, with per-article coverage matrices |
| `usnistgov/oscal-content` | — | — | US Gov | contains `nist.gov/AI100-1/v1.0` alongside CSF, SP800-53, SP800-171/172/218 |
| `Agent-Threat-Rule/ai-rmf-oscal-catalog` | — | — | CC0-1.0 | community OSCAL catalogue, explicitly "Not endorsed by NIST" |
| `google/saif-data` | — | **archived 2026-10-28** | Apache-2.0 | SAIF risk map YAML, now read-only |

Others surfaced by search and not individually API-verified (`eaburime/ai-governance-templates`, `fxops-ai/AI-acceptable-use-policy`, `brandonhimpfen/ai-policies`, `RajatSharma-AIGovernance/ai-governance-portfolio`, `frostdragonfyre/secure-ai-governance-toolkit`, `uk-ai-compliance-os/iso42001-uk-eu-rapid-compliance`, `EsotericShadow/nc-ai-templates`, `islamelsabahy/enterprise-ai-governance-framework`, `gustavogg99-ctrl/ethical-ai-policy`, `singhmuskan552-ux/AI-Governance-Starter-Pack` (20 stars, NOASSERTION, pushed 2026-07-06)). Taken with the measured distribution in §2.1, this is a long tail of single-author repositories at 0–20 stars, mostly created in 2026, several with no resolvable licence.

### 2.6 GitLab

Searching GitLab surfaced **no** maintained AI-governance template project. The relevant finding is GitLab's own roadmap: GitLab ships compliance-framework templates for SOC 2 and states it is "exploring **AI governance compliance templates** (Epic #16808, with planning tracked in Work item #22336) to extend the same template-driven model" (`https://about.gitlab.com/blog/quick-compliance-with-compliance-framework-templates/`, retrieved 2026-11-10). The largest plausible platform-side publisher has this as an open epic, not a shipped artefact. `[INFERENCE]` I did not open the epic and cannot report its state or target date.

---

## 3. The standards bodies

### 3.1 NIST — free, public domain, machine-readable, forkable

- AI RMF 1.0 (NIST AI 100-1) and the Generative AI Profile (AI 600-1) are free PDFs at `nvlpubs.nist.gov`. As US Government works they carry no copyright restriction; third parties reproduce AI RMF text and label it "public domain reference material".
- The Playbook is published at `airc.nist.gov` in four formats. **I read `https://airc.nist.gov/docs/playbook.json` directly on 2026-11-10**: a JSON array of objects with keys `type`, `title` (e.g. "GOVERN 1.1"), `category`, `description`, `section_about`, `section_actions`, `section_doc`, `section_ref`, `AI Actors`, `Topic`. It is a usable dependency today, not a promise.
- Also present as an official OSCAL catalogue in `usnistgov/oscal-content` under `nist.gov/AI100-1/v1.0`.
- Caveat to carry: secondary sources state NIST updates the Playbook roughly twice a year and that it will be revised after the AI RMF 1.0 revision under the White House AI Action Plan (`https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook`; `https://aicomplianceatlas.com/guides/nist-ai-rmf-playbook`). A fork inherits a moving upstream.

### 3.2 EU AI Act — the text is CC BY 4.0; the templates a deployer needs mostly do not exist yet

Reuse terms, verified: Commission content is reusable under Decision 2011/833/EU, and "content owned by the EU on this website is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence" — including on the AI Act Service Desk itself (`https://commission.europa.eu/legal-notice_en`; `https://ai-act-service-desk.ec.europa.eu/en/copyright-notice`). An "EU AI Act obligations as YAML" repository is legally clean with attribution.

What the Commission has actually published as **templates**:

| Template | Status | Source |
|---|---|---|
| Public summary of training content for GPAI models (Art. 53(1)(d)) | **Published 24 July 2025**, mandatory form | `https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/european-commission-releases-mandatory-template-for-public-disclosure-of-ai-training-data` |
| Serious-incident report for GPAI models with systemic risk (Art. 55) | **Published 04 November 2025**, DOCX + PDF downloads | `https://digital-strategy.ec.europa.eu/en/library/ai-act-commission-publishes-reporting-template-serious-incidents-involving-general-purpose-ai` (read 2026-11-10) |
| Serious-incident guidance + template for **high-risk** systems (Art. 73) | **Draft only**, issued 26 Sep 2025, consultation closed 7 Nov | same page, "Related content" |
| **Annex IV technical documentation** | **No official template.** Art. 11(2) obliges the Commission to establish a simplified form for small and micro enterprises; secondary sources report it still unpublished as of April 2026 | `https://www.dastra.eu/en/blog/ai-act-the-complete-guide-to-the-official-resources-for-compliance/59996`; `https://www.legalithm.com/en/blog/ai-act-technical-documentation-annex-iv-template` |
| **FRIA questionnaire (Art. 27(5))** | **Not published.** Secondary source: absent as of October 2026; the Digital Omnibus on AI (reported adopted 29 June 2026) moved stand-alone Annex III high-risk obligations including Art. 27 FRIA from 2 Aug 2026 to **2 Dec 2027** | `https://kla.digital/blog/fria-template-eu-ai-act` — blog, not primary; **treat the date shift as unconfirmed** |

Article 26 deployer duties exist in binding text with no official template: use per instructions, assign human oversight to competent and authorised natural persons, control input data where the deployer controls it, monitor operation, inform workers before putting into service, notify provider/distributor and market surveillance authority and suspend use on risk, **retain automatically generated logs for at least six months**, and (public bodies) register use in the Art. 71 database (`https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26`). Dates per secondary source: 2 December 2027 for Annex III, 2 August 2028 for Annex I.

**The verifiable gap at the standards layer:** the EU has published incident-reporting templates for *model providers* and nothing for the *deployer* obligations a mid-size company actually carries.

### 3.3 ISO/IEC 42001 — paywalled, and licensed against exactly the reuse a free kit would need

- Price: **CHF 225** for ISO/IEC 42001:2023, 51 pages, PDF/ePub/paper (`https://www.iso.org/standard/42001`); ANSI resells the ISO edition at **US$369** (US$295.20 members) per `https://gaicc.org/blog/iso-42001-lead-implementer-cost/` (secondary, retrieved 2026-11-10).
- ISO/IEC 42005:2025 (AI system impact assessment): **CHF 181**; bundled with 42001 as the "Responsible AI governance and impact standards package" at **CHF 365** (list CHF 406) — `https://www.iso.org/standard/42005`.
- Free: only the Online Browsing Platform preview — foreword, introduction, scope, normative references, terms and definitions — "for informational, research, or evaluation purposes only… may not be used as a substitute for ISO publications" (`https://www.iso.org/obp-terms-of-use.html`).
- Licence: single registered end-user, one named user, one computer; copying and networking prohibited; **no reproduction, distribution, adaptation, incorporation, digital integration or derivative works**; no rights to revisions or new editions (`https://www.iso.org/terms-conditions-licence-agreement.html`, `https://www.iso.org/files/live/sites/isoorg/files/store/en/PUB100206.pdf`).

So: an ISO 42001 document kit can legally *map to* clause and control identifiers, and cannot legally republish the control text. Every free repository that ships "all 38 Annex A controls" is standing on that line (§2.3).

---

## 4. The consultancy and vendor layer — what it gives away, and where the paid line starts

| Supplier | Free artefact | Gate | Price of the paid thing |
|---|---|---|---|
| **Credo AI** | "The Practical AI Governance Guide" PDF — **ungated**; the page states "No sign up or email needed" and links the PDF directly (`https://www.credo.ai/downloadsopen/thepracticalaigovernanceguide`, read 2026-11-10). Contents: an operating model (setup / intake / ongoing oversight) and ownership-by-function — **prose, no templates**; "© Copyright 2026 Credo.AI Corp. All rights reserved." | none for the guide | Policy Packs (NIST AI RMF, EU AI Act, ISO 42001, SOC 2, HITRUST) are platform components, not downloads (`https://www.credo.ai/glossary/credo-ai-policy-pack`) |
| **IBM watsonx.governance** | free trial tier only | account | Read from IBM's own pricing page 2026-11-10 (`https://www.ibm.com/products/watsonx-governance/pricing`): Model management from **$0.64**; **Risk & Compliance – Basic from $3,500/month**; **Advanced from $6,450/month**; AWS Marketplace listing **from $42,000** (1 instance, 5 use cases, 12,000 evaluations, 25 users) |
| **Holistic AI** | `holistic-ai/holisticai` open-source Python library, Apache-2.0 — bias/robustness measurement | none | platform, undisclosed |
| **Big four** | KPMG "AI Governance Principles for Boards" (five principles, with INSEAD Corporate Governance Centre); Deloitte "Trustworthy AI framework" download; PwC "Responsible AI Toolkit" as methodology | download forms / engagement; I submitted no form, so per-firm gate mechanics are unverified by me | consulting engagement |
| **Advisera** (the paid-template market a free kit would displace) | list of document titles | none | **US$897** one-off for **30 document templates** covering ISO 42001 certification, "90% pre-written", MS Word/Excel; or **US$100/month** for 3 documents/month (`https://advisera.com/toolkits/iso-42001-documentation-toolkit/`) |

**The economically interesting number:** the free open layer competes against a **US$897 / 30-document** pack at the small end and **$3,500–$6,450 per month** platform licences at the large end. US$897 is the price a free, forkable, signer-mapped document set would destroy.

Also free and ungated, and relevant because a security reviewer may already use them:
- **Microsoft Responsible AI Impact Assessment Template** and Guide — free PDFs, "FOR EXTERNAL RELEASE", marked "© 2022 Microsoft Corporation" with **no reuse licence stated** (`https://blogs.microsoft.com/wp-content/uploads/prod/sites/5/2022/06/Microsoft-RAI-Impact-Assessment-Template.pdf`). Free to read ≠ forkable.
- **Google SAIF risk self-assessment** — free web questionnaire at `saif.google`, no download; the backing repo `google/saif-data` is Apache-2.0 but was **archived 2026-10-28** and is read-only.

---

## 5. Regulators and associations — licences matter more than content here

| Body | Artefact | Licence | Reusable in a forkable kit? |
|---|---|---|---|
| **ICO (UK)** | AI and data protection risk toolkit (Excel), AI guidance | **OGL v3.0** — reuse incl. commercial, with attribution, link to licence, indicate changes, no endorsement implied | **Yes** |
| **European Commission / AI Office** | AI Act text, Service Desk content, published templates | **CC BY 4.0** under Decision 2011/833/EU | **Yes** |
| **OECD** | most written content published from 1 July 2024 | **CC BY 4.0** (`https://www.oecd.org/en/about/terms-conditions.html`); nearly 30,000 archive items opened | **Yes**, for post-2024-07-01 items |
| **CNIL (FR)** | 9 "AI how-to sheets" (7 + 2 added 19 June 2025), self-assessment guide / maturity analysis grid | **CC BY-ND 4.0 FR** on cnil.fr (`https://www.cnil.fr/en/privacy-policy`); only `linc.cnil.fr` content is CC BY 4.0 | **No — ND forbids derivatives.** Redistribute unchanged, yes; adapt into your own template, no |
| **IMDA / AI Verify Foundation (SG)** | Model AI Governance Framework + ISAGO self-assessment guide (free of charge); AI Verify toolkit | AI Verify code **Apache-2.0**; ISAGO licence not stated on pages I read | Code yes; document licence **unverified** |
| **IAPP** | — | priced: "AI Governance: From Strategy to Execution" US$65 member / US$75 non-member digital, US$85/US$95 print (`https://store.iapp.org/ai-governance-from-strategy-to-execution-digital/`) | **No** |
| **Partnership on AI** | guidance documents | **Not established.** Searched; no site-wide licence statement found | Unknown |
| **EDUCAUSE** | **HECVAT 4** (current 4.1.6, released 2025-02-10) with a community-built **AI-specific question set**; "available to colleges, universities, and their vendors at no cost and without a further license" (`https://www.educause.edu/higher-education-community-vendor-assessment-toolkit`; terms per `https://rocketdocs.com/resources/blog/hecvat-questionnaire-guide`) | free, no further licence claimed | **Yes, with care** — closest thing to a free, widely-used *inbound* AI vendor questionnaire |
| **Cloud Security Alliance** | **AI Controls Matrix v1.1** + **AI-CAIQ (320 questions)**, free download bundle with implementation/auditing guidelines and role-specific guidance across five roles | CSA's own terms; copyright CSA, described as attribution-noncommercial-no-derivatives style for the spreadsheets; draft text says "solely for personal, informational, noncommercial use" | **No / restricted** |
| **Secure Controls Framework** | free control catalogue | **CC BY-ND 4.0**; the derivative prohibition "includes utilizing Artificial Intelligence… to leverage SCF content to generate policies, standards, procedures, metrics, risks, threats or other derivative content"; commercial licence required for derivatives (`https://securecontrolsframework.com/free-content`, `https://securecontrolsframework.com/commercial-license`) | **No** |
| **UK DSIT** | **AI Management Essentials (AIME)** self-assessment tool, drawn from ISO/IEC 42001 + NIST AI RMF + EU AI Act | **Cancelled.** Government response (December 2025): "DSIT will not be publishing AIME and therefore will not be making it a requirement of the…" procurement process (`https://assets.publishing.service.gov.uk/media/6981d0758c1e89ed1e91bb55/AI_Management_Essentials_tool_government_response.pdf`); consultation ran 6 Nov 2024 – 29 Jan 2025 | n/a — **the state's attempt at a free baseline self-assessment was abandoned** |
| **OASIS / CoSAI** | **AI Incident Response Framework v1.0**, released 18 Nov 2025, playbooks written in the OASIS CACAO standard (`https://www.oasis-open.org/2025/11/18/coalition-for-secure-ai-releases-two-actionable-frameworks-for-ai-model-signing-and-incident-response/`) | OASIS Open Project; specific licence not verified by me | likely yes `[INFERENCE]` |

---

## 6. Licence map: what open governance content carries, and what blocks reuse

Measured across the repositories I API-verified: **CC-BY-4.0** (finos, nosistech, CarbeneAI), **MIT** (Ankit-Uniyal, fxops-ai per its description), **CC0-1.0** (awesome lists, the community AI RMF OSCAL catalogue), **Apache-2.0** (gopal, AI Verify, saif-data), **EUPL-1.2** (MinBZK), and a notable number of **NOASSERTION** ("Other"): `diShine`, `verifywise`, `AI-Governance-Starter-Pack`, `trace-spec`, `war851`. NOASSERTION means counsel cannot clear reuse without reading the file, and often cannot clear it at all.

**Licensed so it blocks reuse — the four to know:**
1. **ISO/IEC 42001 and 42005** — no reproduction, adaptation or derivative works; CHF 225 / CHF 181.
2. **Secure Controls Framework** — CC BY-ND 4.0, with an explicit anti-AI-derivation clause.
3. **CNIL** — CC BY-ND 4.0 FR for the main site, so the French regulator's AI sheets cannot be adapted into a template.
4. **CSA AICM / AI-CAIQ** (free to read, not to adapt) and **IAPP** (paid).

**Licensed permissively, and therefore the legitimate raw material:** NIST (public domain), EU Commission (CC BY 4.0), ICO (OGL v3.0), OECD (CC BY 4.0 post-July-2024), FINOS (CC-BY-4.0), HECVAT (no further licence claimed).

---

## 7. Machine-readable, and consumed as a dependency?

**Machine-readable: yes, in five places, none of which is a document kit.**
1. NIST AI RMF Playbook JSON/CSV/XLSX (read directly, §3.1) — the canonical machine-readable artefact in this field.
2. Official OSCAL catalogue `nist.gov/AI100-1/v1.0` in `usnistgov/oscal-content`; plus a CC0 community catalogue (`Agent-Threat-Rule/ai-rmf-oscal-catalog`, OSCAL v1.2.2, 19 categories / 72 subcategories, "Not endorsed by NIST").
3. FINOS YAML front matter cross-referencing ISO 42001, EU AI Act and SP 800-53r5 identifiers (§2.2).
4. `Principled-Evolution/gopal` — 85 Rego policies, Apache-2.0, executable against OPA with per-article coverage matrices and CI tests. Governance content compiled to code; 9 stars.
5. Adjacent precedent worth copying: the Dutch **Algoritmeregister publication standard** — a versioned JSON schema (v0.2, v0.3, v0.3.1, plus Amsterdam/FRAIA/IAMA/DPIA variants) at `standaard.algoritmeregister.org`, maintained in `MinBZK/Algoritmeregister` (EUPL-1.2) and `Algoritmeregister/standard`, with a public API and downloadable datasets. A governance *register* with a schema and an API already exists — for public bodies, in Dutch.

**Consumed as a dependency: essentially no.** npm registry search for "ai governance policy" (`https://registry.npmjs.org/-/v1/search`, 2026-11-10) returns **zero** packages shipping governance documents. The nearest hits are runtime policy engines with negligible adoption: `@losi-ai/governance` (MIT, **40 monthly downloads**, 0 dependents) and `@aegis-runtime/core` (MIT, **17 monthly downloads**, 2 dependents); the high-download results (`oci-governancerulescontrolplane`, 425k/month) are Oracle cloud SDKs unrelated to AI governance. Nobody packages AI governance *content* for `npm install` or `pip install`. `[INFERENCE]` I did not run the equivalent PyPI query; the npm result plus the absence of any packaging manifest in the document repositories I inspected (none of finos, Ankit-Uniyal, nosistech ships one) makes a different PyPI answer unlikely but unverified.

---

## 8. What is missing — precisely

1. **No crosswalk from the inbound question to the outbound document to its signer.** Both halves exist separately and are never joined. The questionnaire half is real and free: HECVAT 4.1.6 with an AI question set (EDUCAUSE, no cost, no further licence) and CSA AI-CAIQ with 320 questions across five role assignments. The document half is real: `Ankit-Uniyal` maps 38 Annex A controls → documents → owners (CEO/CTO/Board, HR, AI Governance Lead); `nosistech` gives one policy with `Approved by` and a signature block. **No public artefact maps "the question a reviewer asks" → "the document that answers it" → "the role that signs that document" → "the evidence that proves it is live".** That joint is empty.
2. **The free document sets are ISO-certification-shaped, not security-review-shaped.** `Ankit-Uniyal`'s structure is `03-CLAUSE4-CONTEXT … 09-CLAUSE10-IMPROVEMENT`: it answers a certification auditor walking clauses, not a prospective customer's CISO working a questionnaire with a deal attached. Nothing is organised by what the reviewer actually sends you.
3. **Nothing covers the deployer, which is who a mid-size company is.** NIST is framework-level; FINOS is risk/mitigation for banks; ISO is a management system; the EU's two published templates are for GPAI *providers*. Article 26's concrete deployer duties — competent named human oversight, ≥6-month log retention, notify-and-suspend on risk, inform workers before go-live — have **no** official template, and the Art. 27 FRIA questionnaire the Commission is obliged to produce does not exist. A free deployer-obligation pack has no competitor at the standards layer.
4. **The incident call order does not exist anywhere free.** CoSAI's AI Incident Response Framework v1.0 (18 Nov 2025, CACAO playbooks) covers security incident handling. The EU publishes a serious-incident template for GPAI systemic-risk models (4 Nov 2025) and a *draft* one for high-risk systems. `nosistech`'s incident playbook is "Coming soon". **I found no free artefact stating who to call, in what order, against which regulatory clock.** Searched: GitHub (`"ai governance" in:name,description`, `iso42001` topic, "AI incident response playbook"), the Commission's AI Act library, CoSAI/OASIS, ICO, CNIL, IMDA, OECD.
5. **No free vendor AI questionnaire with a stable identifier both sides can cite.** HECVAT is higher-education-scoped; AI-CAIQ is CSA-licensed against derivatives; the free "AI vendor questionnaire" pages search surfaces (`polygraf.ai`, `aona.ai`, `verifywise.ai/tools/vendor-risk-assessment`) are lead-generation forms on vendor sites, not versioned, citable, forkable documents.
6. **Freshness is nobody's job.** The strongest free template set was last pushed 2026-08-02. `google/saif-data` was archived 2026-10-28. `MinBZK/Algoritmeregister` last pushed 2025-09-03 with 30 open issues. AIME was cancelled. A maintained artefact with a visible update cadence would, by itself, be differentiating.

---

## 9. The CONTEXT assumption this frame challenges

The brief assumes **demand is the scarce thing and the artefact is the easy part** — seven resources, each justified by a Bing volume (`ai governance framework` 803, `evals` 2459, `llm gateway` 489; repo-side, `audits/keyword-demand.md:29` routes `ai governance` 2923 to `/resources/ai-governance-starter-kit`, and `audits/geo-baseline.md:34,46` points both "AI vendor assessment questionnaire template" and "AI governance starter kit open source" at the same page). The measured reality of this category inverts that. There are **5,641** repositories matching "ai governance", the open-document leader holds **118 stars**, and a 30-document commercial alternative sells for **US$897**. Supply is not scarce; *trustworthy, licence-clean, maintained, citable* supply is. A seventh prose kit added to a long tail of 0-star 2026 repositories will rank for nothing and be forked by nobody whatever the keyword volume says. The scarce asset is the crosswalk in §8.1 plus a visible maintenance cadence — neither of which any keyword in that table measures.

Second, smaller challenge: the brief treats "free and forkable" as one property. The licence map shows it is two, and the gap between them is where most of this field sits — Microsoft's impact assessment, CNIL's AI sheets, CSA's AICM and SCF's catalogue are all free and all unusable as raw material.

---

## 10. Traps — options that look attractive from other frames and fail under this one

No pattern-id registry was supplied to this agent, so each trap names its failure mode in words rather than by id; substitute ids on review.

1. **"Ship the ISO 42001 document pack — that's what the paid toolkits sell for US$897."** *Mechanism:* to be useful it must name Annex A controls; to name them usefully it must restate them; ISO's licence grants no reproduction or derivative rights, and no third party's MIT grant can cure that. `Ankit-Uniyal` already sits on this line with a 175 KB Annex A file. Failure mode: **building the artefact on material you cannot license**, with takedown and indemnity exposure — and a director's counsel is exactly the reader who notices.
2. **"Crosswalk everything — SCF, CSA AICM, CNIL."** *Mechanism:* SCF is CC BY-ND with an explicit clause against AI-assisted derivation; CSA's spreadsheets are no-derivatives; CNIL's site content is CC BY-ND 4.0 FR. Failure mode: **the most citation-rich mappings are the legally dead ones.** Only NIST, EU, ICO, OECD and FINOS material survives a licence review.
3. **"Differentiate on being machine-readable — publish it as YAML/JSON."** *Mechanism:* NIST already ships `playbook.json`, NIST already ships an OSCAL catalogue, FINOS already ships typed YAML front matter, gopal already ships executable Rego. Failure mode: **claiming novelty a one-URL check disproves**, the fastest way to lose the credibility a "reference in its category" ambition depends on. Machine-readability is table stakes; the novelty must be the document-to-signer-to-evidence schema nobody has.
4. **"Target `nist ai rmf` (6,899) and `eu ai act` (5,482) — the volume is there."** *Mechanism:* those queries are answered by the primary sources themselves, free, public domain, from a .gov and a .europa.eu. Failure mode: **competing on the one axis where you cannot win** — authority over the standard's own text. The unserved applied phrases (`nist ai rmf framework` 481, `data classification policy` 166, `dpia template` 78) and the deployer-obligation hole in §8.3 are where a third party can be the best answer.
5. **"Copy `nosistech` — it's the closest thing and it's CC BY 4.0, so fork and finish it."** *Mechanism:* CC BY 4.0 permits exactly that, and three of its four documents do not exist. But it was created 2026-10-19 and pushed **2026-11-10** — actively built right now, in the same plain-language register, with the same four-document scope and industry variants. Failure mode: **mistaking a 0-star repository for an absent competitor** and racing a live project to the same artefact instead of building the crosswalk it lacks.
6. **"Ungated PDF like Credo AI's guide proves the free-giveaway model works."** *Mechanism:* Credo AI's ungated artefact is a prose operating model marked "All rights reserved"; it generates platform demand and deliberately contains nothing forkable. Failure mode: **copying the distribution choice while missing that the artefact type is the whole point** — a prose guide is not what a security review asks for.

---

## 11. Could not verify / needs follow-up

- **Partnership on AI's content licence.** Searched; no site-wide statement found. One read of their terms page would settle it.
- **The Digital Omnibus on AI** (reported adopted 29 June 2026, moving Annex III high-risk obligations and the Art. 27 FRIA to 2 December 2027) rests on a law-firm blog, not EUR-Lex. This date drives how urgent a deployer pack is; it needs a primary citation before it is relied on.
- **Big four gate mechanics.** I submitted no download form, so "email-gated" vs "ungated" per firm is unverified by me.
- **GitLab Epic #16808** state and target date — not opened.
- **ISAGO's licence** (free of charge is verified; reuse terms are not).
- **PyPI** equivalent of the npm dependency query.
- **CoSAI AI Incident Response Framework v1.0** licence terms under the OASIS Open Project IPR policy.
