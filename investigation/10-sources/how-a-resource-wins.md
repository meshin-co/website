---
record: true
---

# How a free, open resource becomes *the* one everybody references

**Question answered:** not how an artefact gets stars for a week, but how it ends up cited in strangers' documentation years later.

**Intended path note.** My brief named `/tmp/research/how-a-resource-wins.md`. The write tool available in this session accepts only `xd://` device paths and `local://` session scratch files ("Filesystem writes are not available elsewhere"), and no mounted device offers a filesystem write. This file is therefore at `local://how-a-resource-wins.md`; copy it to the intended path if that path is required.

**All facts retrieved 2026-11-10** unless a different date is stated. Repository metrics come from the GitHub REST API (`api.github.com/repos/<owner>/<name>`), download counts from `api.npmjs.org`, academic citation counts from OpenAlex. Marks used: **[verified]** = cited, checkable primary or near-primary source; **[inferred]** = my reasoning from verified facts, with the confirming test named; **[unverified]** = a claim I found but could not trace to a primary source; **[disputed]** = sources disagree and I name the disagreement rather than averaging it.

**Note on pattern ids.** My brief requires every risk and trap to name "the declared failure pattern it instantiates or dodges, using one of the pattern ids given below." No pattern-id list reached me in CONTEXT. Rather than invent silence, I declare a local set below and label it as local. If the wave has a canonical id set, these need remapping — see §10.3.

| Local id | Failure pattern |
|---|---|
| **L1 Distribution-by-hope** | Published, discoverable, and never incorporated into anyone's workflow. |
| **L2 Human-read only** | Requires a person to read and retype it; no tool consumes it. |
| **L3 Permission friction** | Reuse requires asking, paying, registering, or legal guesswork. |
| **L4 Unstable referent** | The citable string moves, versions silently, or 404s. |
| **L5 Category collision** | A better-funded or earlier-embedded artefact already occupies the slot. |
| **L6 Breadth dilution** | Effort split across many artefacts, none reaching escape velocity. |
| **L7 Measured-proxy substitution** | Optimising a metric (stars, search volume, adoption counts) that does not cause citation. |
| **L8 Governance capture or freeze** | Changes become impossible, or so possible that downstream citers stop trusting the referent. |

---

## 1. What "winning" actually means — the measurable definition

Before the case studies, the unit of success has to be nailed down, because the winners and the also-rans differ far more on this axis than on quality.

The winners are not the artefacts with the most readers. They are the artefacts whose **citation string is physically embedded in other people's build artefacts**. Three measurements make this concrete:

- `semver` (the npm parser implementing semver.org) was downloaded **1,172,512,764 times in the week 2026-11-03 → 2026-11-09** (`https://api.npmjs.org/downloads/point/last-week/semver`). The spec repository itself has only **7,874 stars** (`https://api.github.com/repos/semver/semver`). The ratio between those two numbers is the whole thesis: **the spec won by being parsed, not by being read.** [verified]
- `caniuse-lite`, the packaged form of Alexis Deveria's one-person browser-support database, was downloaded **283,476,974 times** in the same week; `browserslist`, which consumes it, **260,282,252 times**. Licence on the package: **CC-BY-4.0** (`https://registry.npmjs.org/caniuse-lite/latest`). Every one of those installs carries an attribution requirement for a single unaffiliated author's dataset into a `node_modules` directory. [verified]
- Keep a Changelog ships, inside its own `CHANGELOG.md`, the exact two-sentence block that downstream projects paste: *"The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)."* (`https://keepachangelog.com/en/1.1.0/`). The artefact **ships its own citation**, pre-formatted, versioned, and linking a second canonical artefact. [verified]

That last mechanism is the single most transferable finding in this document, and it costs nothing to implement.

---

## 2. Case studies (ten, across kinds)

### 2.1 Semantic Versioning — the specification that won by having a parser

| Field | Value |
|---|---|
| Started | Spec repo initial commit **2010-12-14** by Tom Preston-Werner (`https://en.wikipedia.org/wiki/Timeline_of_GitHub`); `semver/semver` repo created **2011-05-29** |
| Behind it | Tom Preston-Werner, co-founder of GitHub — **not an unknown**; later an org account (`semver`, type `Organization`) |
| Physical artefact | One HTML page of numbered clauses at a versioned URL (`semver.org/spec/v2.0.0.html`) |
| Stars / forks / open issues | **7,874 / 790 / 125** |
| Licence | **None in the repository** — `license: null` from the API, and open issue [semver/semver#433](https://github.com/semver/semver/issues/433) exists precisely to say "There doesn't seem to be a license in the repository, which doesn't let the users know what they can and cannot do." The v2.0.0-rc.1 page states CC BY 3.0 (`https://semver.org/spec/v2.0.0-rc.1.html`) |
| Last push | **2025-11-05** (over a year dormant) |
| Maintenance type | Organisation with a named founder behind it |

**How adoption actually spread:** not by persuasion. npm and Cargo built SemVer's concepts in from day one; Preston-Werner's own retrospective notes "npm alone has more than 1.8 million packages" versioned this way (`https://tom.preston-werner.com/2022/05/23/major-version-numbers-are-not-sacred`). [verified]

**The decisive moment:** when a package manager's dependency resolver became an *executable implementation* of the spec. From then on, obeying the spec was not a style choice — it was the condition for your release being installable under a caret range. [inferred] Confirming test: find the first npm release that enforced range semantics against the spec text; the 1.17 billion weekly downloads of the parser is the surviving trace.

**What it proves and disproves:** SemVer is the clean counterexample to "you need a clear licence." It has the least clear licensing of any winner here and won anyway — because the obligation to comply arrived through tooling, not through copying its text. Anyone citing "permissive licence" as a *cause* rather than a *lubricant* is over-reading. [verified on the licence fact; inferred on the causal claim]

---

### 2.2 Keep a Changelog — the single-author document that shipped its own citation

| Field | Value |
|---|---|
| Started | First commit / `v0.0.1` **2014-05-31** |
| Behind it | **Olivier Lacan**, one individual, then at Code School. User-owned repo to this day (`owner.type: "User"`) |
| Physical artefact | A website plus a Markdown convention; six fixed change types, ISO-8601 dates, newest-first |
| Stars / forks / open issues | **6,753 / 3,534 / 48** |
| Licence | **MIT** |
| Last push | **2026-11-10** (same day as retrieval — actively maintained) |
| Versions | 0.0.1 (2014-05-31) → 0.1.0 "Start following SemVer properly" (2015-10-06) → 1.0.0 (2017-06-20) → 1.1.0 (2019-02-15) → 1.1.2 (2024-09-27) → **2.0.0 (2026-06-07)** |
| Translations | First three (RU, pt-BR, es-ES) **2015-12-03**; "Display count of available translations (26 to date!)" in 1.1.1 (2023-03-05); fifteen more v1.1 translations in 1.1.2 (2024-09-27) |

All version and translation dates above are from the project's own `CHANGELOG.md` as rendered at `https://keepachangelog.com/en/1.1.0/` — the artefact is its own audit trail. [verified]

**How adoption spread — the channel, named and dated:** version `0.0.3` (2014-08-09) adds a *"Why should I care?" section mentioning The Changelog podcast*. The Changelog episode #127 with Olivier Lacan was **recorded and published 2014-08-08** (`https://21.changelog.com/podcast/127`). The cold start was one 66-minute podcast appearance, ten weeks after launch. [verified]

**The decisive moment — tooling adoption:** `git-cliff` ships a built-in template invoked as `git cliff --init keepachangelog`, plus a `gitlab-keepachangelog.toml` variant (`https://git-cliff.org/docs/usage/initializing/`); Google's `release-please` writes `CHANGELOG.md` by default. [verified] At that point the format propagates without anyone reading the site.

**Governance, as evidence:** 2.0.0 (2026-06-07) is the first major revision in nine years and it **deliberately refuses** the most-requested changes — the page states "No new change types: six are enough" and "No machine format, schema, or strict layout: this is the format," closing a long-running request for a separate Breaking Changes type ([issue #200](https://github.com/olivierlacan/keep-a-changelog/issues/200), opened 2016). [verified] Refusal of scope is itself a governance mechanism: it keeps the referent stable enough to cite.

**The counter-signal:** after 2.0.0 shipped, `keepachangelog.com` still defaulted to the 1.1.0 spec, prompting [issue #745](https://github.com/olivierlacan/keep-a-changelog/issues/745) ("Version 2.0.0 isn't discoverable on website", 2026-10-08). The *old* version remains the one the internet links to. This is **L4 dodged**: because the citation string embeds the version (`/en/1.1.0/`), the millions of existing citations did not break when the spec moved. A versionless URL would have silently changed meaning under every one of them. [verified facts; inferred mechanism]

---

### 2.3 The Twelve-Factor App — canonical through thirteen years of total dormancy

| Field | Value |
|---|---|
| Started | Original repo `adamwiggins/12factor` created **2011-06-03**; first published as a book-form artefact **2012-01-01**; 39 pages |
| Behind it | **Adam Wiggins**, Heroku co-founder — a company-backed individual |
| Physical artefact | A numbered list of twelve factors on a single domain, `12factor.net` |
| Stars / forks / open issues | `heroku/12factor` (a **fork**): **3,778 / 652 / 75**. Original `adamwiggins/12factor`: **408 stars, archived** |
| Licence | **MIT** |
| Last push | `heroku/12factor` **2026-07-04**; original last pushed 2023-12-26, then archived |
| Governance change | **Open-sourced 2024-11-12** — "Twelve-Factor App Methodology is now Open Source" by Yehuda Katz (`https://12factor.net/blog/open-source-announcement`), moving to `github.com/twelve-factor/twelve-factor`; a new factor (**Identity**) proposed as [issue #9](https://github.com/twelve-factor/twelve-factor/issues/9) |

**Cold start, named:** Hacker News, twice. *"Twelve Factors of Web Application Development"*, November 2011, **37 comments**; *"12factor: Methodology for Building Software-as-a-Service Apps"*, May 2012, **1 comment** (both indexed in `https://news.ycombinator.com/item?id=37857544`). The second, better-titled launch essentially died. [verified]

**What it proves:** the artefact received effectively no substantive revision from 2012 to 2024 and remained *the* reference for cloud-native application structure across that entire window — Docker (2013), Kubernetes, and CNCF (2015) all arrived and passed, and the twelve-factor list was still the thing their documentation reached for (`https://12factor.net/blog/evolving-twelve-factor`, 2025-02-10). **Active maintenance is not a precondition for canonicity.** [verified] It *is* a precondition for continued accuracy, which is why the 2024 open-sourcing happened at all.

---

### 2.4 Contributor Covenant — the policy template that won through gatekeepers

| Field | Value |
|---|---|
| Started | Repo created **2014-01-30** |
| Behind it | **Coraline Ada Ehmke**, an individual in the Ruby community; stewardship transferred to the **Organization for Ethical Source** in **May 2021** (`https://techcrunch.com/2021/05/27/the-open-source-contributor-covenant-is-now-managed-by-the-organization-for-ethical-source/`) |
| Physical artefact | One Markdown document, dropped in as `CODE_OF_CONDUCT.md`, versioned 1.0 → 1.4 → 2.0 → 2.1 → 3.0 in progress |
| Stars / forks / open issues | **2,283 / 1,445 / 199** |
| Licence | API reports **`NOASSERTION`** (GitHub could not classify it). The project's own site states CC BY 4.0. **[disputed]** — the machine-readable signal and the human-readable claim do not agree, which matters for automated reuse |
| Last push | **2026-10-29** |
| Translations | **"over 40 languages"**, by volunteer native speakers (`https://www.contributor-covenant.org/translations/`; the page's og:description says "45+") |

**How adoption actually spread — gatekeeper events, in order:**

1. **Ruby ecosystem embrace, 2014–2015.** Ehmke: *"I come from the Ruby community, and the Ruby community really embraced the concept and also really embraced the document itself. And then it spread from there"* (TechCrunch, 2021-05-27). [verified]
2. **Scaffolding, 2015.** *"The bundler team made code of conduct integration an option in the gem creation workflow, putting it on par with license selection"* (`https://metaruby.com/t/ruby-code-of-conduct/422`). The document became a prompt in `bundle gem`. [verified] Same mechanic as `github/gitignore` in §2.6.
3. **Funding condition, 2015-07-15.** Ruby Together announced *"a new policy regarding open source Ruby projects that we will support: to be eligible, a project must have a clear and enforceable code of conduct"* (`https://rubytogether.org/news/2015-07-15-project-codes-of-conduct`). Money made it mandatory. [verified]
4. **Platform default, 2017-06-14.** GitHub shipped the community-profile checklist and a `CODE_OF_CONDUCT.md` template picker — *"you'll see a short list of common templates to choose from, then can create a pull request"* (`https://github.blog/2017-06-14-new-community-tools/`). [verified]
5. **Flagship ratification, 2018.** The Linux kernel adopted Contributor Covenant v1.4. [verified]

**Adoption numbers are [disputed] and I will not average them:** "over 40,000 open source projects" (GitHub's own `https://opensource.guide/code-of-conduct/`); "over 100,000" (creator's claim, reported via `https://www.wikiwand.com/en/Contributor_Covenant`); "over 200,000" (an archived 2020-09-30 snapshot of contributor-covenant.org at `https://ia800800.us.archive.org/14/items/20200930_20200930_0730/cc/index.html`); and the live site today says only *"thousands of communities, including 9 of the 10 largest open source projects in the world."* A 2020 snapshot claiming 200,000 and a 2026 site claiming "thousands" cannot be the same metric. Treat all four as self-reported, not measured. [disputed]

**And winning is not total:** Ruby *core* rejected it. Matz declined the Contributor Covenant and the project wrote its own ([bugs.ruby-lang.org #12004](https://bugs.ruby-lang.org/issues/12004)). [verified] The most-adopted template in its category was refused by the community that launched it.

---

### 2.5 OWASP Top 10 — the list that won by being written into a payment regulation

| Field | Value |
|---|---|
| Started | First list **2003**; second edition 2004 (`https://www.cs.columbia.edu/~junfeng/12fa-e6121/papers/owasp-top-10.pdf`: "The OWASP Top 10 was first released in 2003, minor updates were made in 2004 and 2007") |
| Behind it | **The OWASP Foundation** — a non-profit, i.e. an institution, not a person |
| Physical artefact | A ranked list of ten risk categories, published as a PDF plus a web edition; `OWASP/Top10` repo created 2016-08-30 |
| Stars / forks / open issues | **6,502 / 1,173 / 63** |
| Licence | **CC BY-SA 4.0** — explicitly "Share — copy and redistribute the material in any medium or format for any purpose, even commercially"; "No additional restrictions" |
| Current version | **Top 10:2025**, announced November 2025 at OWASP Global AppSec in Washington DC, finalised January 2026 — the first update since 2021 |
| Revision cadence | Roughly every four years: 2003, 2004, 2007, 2010, 2013, 2017, 2021, 2025 |

**The decisive moment:** regulatory incorporation. PCI DSS Requirement 6.2.4 obliges that bespoke software "cannot be exploited via common attacks," and the enumerated attack categories *"read almost exactly like the OWASP Top 10"*; 6.2.4 and 6.3.2 require developer training on secure development practices (`https://www.securecodinghub.com/blog/pci-dss-4-0-1-secure-coding-training-6-2-2`, `https://www.the-algo.com/insights/pci-dss-4-64-new-requirements-engineering`). [verified]

**Important correction to the folk story, and it cuts against the resource's own myth:** PCI DSS does **not** name the Top Ten normatively. *"While OWASP is referenced in the standard multiple times, the Top Ten specifically is not – just the 'OWASP Guide'"* (`https://www.glasspaper.no/en/artikkel/utvikling/pci-dss-requirement-6--training-developers-on-security-techniques/`), and *"PCI DSS does not name a specific secure coding standard"* (`https://www.appsecmaster.net/blog/secure-coding-standards/`). [verified] So the mechanism is subtler and more instructive: the regulation created an obligation **shaped like** the artefact, and auditors reached for the only free, citable, versioned list that fit. **Being the default answer to a compliance question you did not write is stronger than being named in it** — it survives the regulation's next revision. [inferred] Confirming test: count OWASP Top 10 references in QSA audit templates versus in the PCI DSS text itself.

---

### 2.6 `github/gitignore` and `choosealicense.com` — platform-embedded templates

| | `github/gitignore` | `github/choosealicense.com` |
|---|---|---|
| Created | **2010-11-08** | **2013-07-15** |
| Behind it | GitHub (Organization) | GitHub (Organization) |
| Stars | **176,442** | **4,236** |
| Forks | **82,021** | **1,660** |
| Open issues | **26** | **71** |
| Licence | **CC0-1.0** (public domain dedication — zero permission friction) | **MIT** |
| Last push | 2026-11-09 | 2026-11-07 |

`github/gitignore` has **42× the stars and 49× the forks of `choosealicense.com`**, with the same owner, comparable quality, and comparable embedding in the repository-creation flow. The difference is what the artefact *is*: `gitignore` is a directory of machine-consumable files a developer **selects and copies on every new repository**; `choosealicense` is prose answering a question a developer asks **once per career**. [verified numbers; inferred explanation]

The lesson is uncomfortable and direct: **frequency of need, not depth of need, drives citation count.** A brilliant one-time decision aid will always lose on raw adoption metrics to a mediocre recurring template. Which to be is a strategy decision, not an accident.

The deeper win in this pair is invisible: the SPDX licence list (`spdx/license-list-data`, created 2016-04-15, **715 stars, 213 forks, 1 open issue**) is almost unstarred, yet its identifiers (`MIT`, `CC0-1.0`, `Apache-2.0`, `NOASSERTION`) are the field values in the GitHub API responses quoted throughout this document. **715 stars; it is the vocabulary that every other licence measurement in this report is expressed in.** [verified] That is what maximal canonicity looks like — invisible, and in the schema.

---

### 2.7 Conventional Commits — the convention that was already running before the spec existed

| Field | Value |
|---|---|
| Started | Formalises the **AngularJS commit guidelines published in 2014**; spec authored by **Benjamin E. Coe in 2017**; `conventionalcommits.org` repo created 2016-04-05 |
| Behind it | An individual (Coe, of npm/yargs) writing up an existing practice, *"in collaboration with some of the folks contributing to conventional-changelog"* (`https://www.conventionalcommits.org/en/about/`); now a GitHub Organization |
| Physical artefact | One page; v1.0.0; "deliberately small — the whole official specification fits on a single page" |
| Stars / forks / open issues | **9,358 / 698 / 166** |
| Licence | **MIT** |
| Last push | 2026-03-11 |
| Tooling trace | `conventional-changelog` npm: **3,537,913 downloads/week** |

**What makes it a distinct case:** the convention had a working toolchain and a flagship user (Angular) for **three years before the specification existed**. The spec did not create behaviour; it gave already-existing behaviour a citable name and URL. [verified]

This inverts the normal publishing instinct. The artefact that wins is often a **write-up of something already happening**, not a proposal for something that should start. The open-issue ratio (166 against 9,358 stars — the worst of any winner here) is the price: once a convention is load-bearing for other people's release automation, every clarification is a potential breaking change, so none get resolved. **L8** in its "freeze" form, and apparently survivable.

---

### 2.8 `sindresorhus/awesome` — the curated list that won a crowded race

| Field | Value |
|---|---|
| Started | **2014-07-11** |
| Behind it | **Sindre Sorhus**, an individual (*"In 2014, I quit my office job to backpack around Southeast Asia and work on open source"*, `https://sindresorhus.com/about`) |
| Physical artefact | A README of links, plus `awesome.md` (the manifesto), plus a badge, plus a linter |
| Stars / forks / open issues | **534,691 / 38,278 / 103** |
| Licence | **CC0-1.0** |
| Last push | 2026-09-02; pull requests currently disabled by the maintainer |

**It was not first, and not by a long way.** `awesome-php` launched **2012-01-25** (Jamie York / @ziadoz); `awesome-python` **2014-06-28**; `awesome-go` **2014-07-06**; `bayandin/awesome-awesomeness` — a direct competitor, the same "list of lists" idea — **2014-07-08**, three days *earlier* than Sorhus's repo, sitting at roughly **25,706 stars** in an archived snapshot (`https://repo.telematika.org/project/bayandin_awesome-awesomeness/`; stale snapshot, treat as order-of-magnitude). [verified dates; stale count flagged]

**What the winner had that the three-days-earlier competitor did not:**
- **A manifesto** defining what qualifies (`awesome.md`) — i.e. a spec, not just a list.
- **A badge** to put at the top of *your* list — a visual conformance claim that propagates to other repositories.
- **A linter**, `awesome-lint`, runnable as `npx awesome-lint <url>` — machine-checkable conformance.

The list did not win as a list. It won by becoming **the certifying authority for a genre**, with a conformance test. [inferred from verified artefacts] Confirming test: compare the share of `awesome-*` repos carrying the badge against those linked from `awesome-awesomeness`.

---

### 2.9 Model Cards — the AI-era governance artefact that won, with the loser measurable beside it

Three documentation proposals, same category, same era, measured by OpenAlex citation counts on 2026-11-10:

| Artefact | OpenAlex id | Year | **Citations** | Origin |
|---|---|---|---|---|
| **Datasheets for Datasets** | `W2795038878` | 2021 (CACM; arXiv 2018) | **3,897** | Gebru et al., academic |
| **Model Cards for Model Reporting** | `W2897042519` | 2019 (FAT*) | **3,710** | Mitchell et al., Google |
| IBM **FactSheets** (Supplier's Declarations of Conformity) | `W2911599914` | 2019 (IBM J. Res. Dev.) | **527** | IBM Research, corporate |

**A 7.0× citation gap inside one category, one year, comparable institutional weight.** [verified]

Structural differences that track the gap:

- **Scope discipline.** FactSheets is *"significantly more comprehensive because [it focuses] on whole AI services… live AI services may comprise several trained models that interact"* (`https://edwinwenink.github.io/ai-ethics-tool-landscape/tools/factsheets/`). The more complete artefact lost. Completeness raised the cost of the first use. [verified description; inferred causality]
- **A host that renders it.** On Hugging Face, *"A model repo will render its README.md as a model card… a Markdown file, with a YAML section at the top that contains metadata"*, and *"Properties will be validated by the Hub when git pushing changes to your README.md"* (`https://huggingface.co/docs/hub/model-cards`, `https://github.com/huggingface/hub-docs/blob/main/modelcard.md`). Recognised keys: `license, language, library_name, pipeline_tag, base_model, datasets, tags, metrics, model-index`. Model cards became **the file path and the YAML schema of the dominant model registry.** [verified]
- **Still not mandated by law, and it did not matter.** *"No jurisdiction mandates the model card format. California SB 53 mentions model cards and system cards only as acceptable containers…"*; *"The Act itself never uses the term"* (`https://casrai.org/guides/model-cards-and-system-cards`, `https://deeploy.ai/eu-ai-act-hub/articles/eu-ai-act-model-cards-transparency-documentation/`). [verified]

**This is the closest analogue in the corpus to an AI-governance starter kit**, and its lesson is specific: the artefact that won was *narrower* than its rivals and became a **file in a registry** rather than a document in a library.

---

### 2.10 Can I Use — an unaffiliated individual who became infrastructure

| Field | Value |
|---|---|
| Started | *"Caniuse.com has hosted browser support tables for web technologies since 2008"* |
| Behind it | **Alexis Deveria**, alone: *"a personal project created, owned and regularly maintained by me in my spare time"* (`https://www.patreon.com/caniuse/about`) |
| Physical artefact | A queryable support database, plus the raw data repo `Fyrd/caniuse` |
| Machine distribution | `caniuse-lite` — **283,476,974 npm downloads/week**, licence **CC-BY-4.0**, now hosted under the `browserslist` organisation and published by a third party (Andrey Sitnik), not by Deveria |
| Downstream | *"BCD is used in web apps and software such as MDN Web Docs, CanIUse, Visual Studio Code, WebStorm"*; MDN integrated its compat data into caniuse in 2019, expanding table count *"from roughly 500 to 10,500"* (`https://hacks.mozilla.org/2019/09/caniuse-and-mdn-compat-data-collaboration/`) |

**The decisive moment:** the data was packaged for machines by someone else, and a build tool (`browserslist`, 260 M downloads/week) made it a transitive dependency of the JavaScript ecosystem. Mozilla then *merged its own data in* rather than competing. [verified]

**Yes: a single unaffiliated individual can win a category outright, and the proof is a quarter of a billion weekly installs of their dataset.** See §8.

---

## 3. The failures — the more useful half

Each entry: why it was good, and the precise thing the winner had that it did not.

### 3.1 Citizen Code of Conduct (2011) — earlier, respectable, lost

- Written by the **Stumptown Syndicate for Open Source Bridge in early 2011** (`https://authenticengine.com/2016/adopting-a-code-of-conduct-is-an-adaptive-challenge-not-a-technical-one/`) — **three years before** Contributor Covenant. Still listed by GitHub as a "good code of conduct example" alongside the Django CoC (`https://opensource.guide/code-of-conduct/`). [verified]
- Fate: *"the document has been largely ignored, most visibly when GitHub's prominent Atom text editor project abandoned it in favor of the Contributor Covenant"* (`https://shujisado.org/2025/09/30/why-heavy-codes-of-conduct-are-unnecessary-for-most-open-source-projects/`). [verified]
- **What the winner had:** project-neutral framing (the Citizen CoC was written for a *conference*, not for projects), a version number, an enforcement-guidelines appendix, 40+ volunteer translations, and four gatekeeper integrations (§2.4). The Citizen CoC had the idea first and none of the distribution.
- Pattern: **L1** plus **L5** — the slot was taken by the artefact that got into `bundle gem` and GitHub's picker.

### 3.2 Common Changelog and towncrier — technically better, strategically irrelevant to canonicity

- Common Changelog (`common-changelog.org`) is *"the stricter fork: it adds commit/PR references, authors, and a **Breaking:** prefix, but drops the Deprecated and Security categories and removes the Unreleased section entirely, calling it 'an unproductive workflow'"* (`https://www.releasepad.io/blog/keep-a-changelog/`). [verified]
- Every one of those criticisms is correct — the Unreleased section genuinely is a merge-conflict site, which is exactly why `towncrier` builds changelogs from per-change fragment files. [verified]
- **What the winner had:** the pre-written citation string, nine years of inbound links to `/en/1.1.0/`, and decisively — Keep a Changelog 2.0.0 (2026-06-07) **absorbed the good idea**, adding the `Breaking:` marker while refusing the structural change. The incumbent annexed the improvement without ceding the referent.
- Pattern: **L5**. Being right about the format does not relocate ten years of links.

### 3.3 Beyond the Twelve-Factor App (2016) — the sequel that could not replace the original

- **Kevin Hoffman, published 2016-04-26**, ~70 pages, O'Reilly, *"Compliments of Pivotal"*; Hoffman was *"an Advisory Solutions Architect for Pivotal Cloud Foundry."* [verified]
- Substantively it is the better document for the container era, and argues *"twelve-factor applications are an excellent start… but to build cloud-native applications that truly thrive in the cloud, you need to look beyond the 12 factors."* [verified]
- **What the original had that it did not:** a free, stable URL (`12factor.net`) with per-factor paths anyone can hyperlink from a README; MIT licensing; no publisher, no ISBN, no download form, no vendor logo. The sequel is a **branded PDF** — you cannot cite factor 7 of it with a URL that lands a reader on the clause.
- Pattern: **L3** plus **L4**.

### 3.4 CalVer (2016) — a correct alternative that remains "a guide"

- *"CalVer itself was first publicly released in 2016, by Mahmoud Hashemi"*; the **26.0 revision in 2026** *"followed a survey of a decade of adoption, from Ubuntu and Twisted through to Apple's OS 26 family and NVIDIA's infrastructure stack"* (`https://calver.org/about.html`). [verified]
- It has real, large adopters. It is not the thing people cite when they explain their versioning.
- **What SemVer had:** a parser in every package manager (§2.1). CalVer, by its nature, has **nothing to compute** — a date cannot be range-resolved — so no dependency resolver needed to implement it, so no tool ever made compliance obligatory.
- Pattern: **L2**. An artefact that tools cannot *consume* can only ever be read.

### 3.5 WASC Threat Classification — the direct competitor that froze

- A cooperative taxonomy of web application security threats; **v2.0 last updated 2010-01-01** (`http://projects.webappsec.org/f/WASC-TC-v2_0.pdf`). *"The WASC project is no longer actively maintained"* (`https://docs.detectify.com/security-and-compliance/compliance-frameworks/wasc`). MITRE's CAPEC now carries its mappings prefixed **`DEPRECATED:`** (e.g. `https://capec.mitre.org/data/definitions/355.html`). [verified]
- **What OWASP had:** a four-year revision cadence, institutional continuity, CC BY-SA licensing, and an audit market that needed an answer (§2.5).
- Pattern: **L8** (freeze) into **L5**. Note the asymmetry with §2.3: the Twelve-Factor App was dormant thirteen years and survived; WASC was dormant and died. The difference is whether the subject matter changes. **Dormancy is fatal only for artefacts that enumerate a moving world** — a threat list rots; an architectural principle does not. Directly load-bearing for any governance kit that enumerates current regulations. [inferred]

### 3.6 `bayandin/awesome-awesomeness` — three days earlier, ~5% of the outcome

Covered in §2.8. ~25,706 stars (stale snapshot) against **534,691**. No manifesto, no badge, no linter. Pattern: **L2** — no conformance mechanism, therefore no genre to certify.

### 3.7 TLDRLegal — the better-designed version of `choosealicense.com`

- A plain-English licence explainer, widely liked. Current state: *"maintenance is inactive based on released npm versions cadence, the repository activity, and other data points"*; *"no commits over the last 6 months"*; npm package last published years ago (`https://security.snyk.io/package/npm/tldrlegal`). [verified for the package; the website remains up]
- **What `choosealicense.com` had:** GitHub's repository-creation flow, and the `licensee` detection path that produces the `license.spdx_id` field in the API. One of these two artefacts is *inside the platform's data model*; the other is a website you have to remember.
- Pattern: **L1**.

### 3.8 IBM FactSheets (2019) — 527 citations against 3,710

Covered in §2.9. More complete, corporate-authored, no registry rendered it. Pattern: **L2** plus scope overreach.

### 3.9 EU ALTAI (2020) — the institution-backed checklist nobody chose

- The *Assessment List for Trustworthy Artificial Intelligence*, published by the European Commission's High-Level Expert Group, *"translates AI principles into an accessible and dynamic checklist"* (`https://digital-strategy.ec.europa.eu/en/library/assessment-list-trustworthy-artificial-intelligence-altai-self-assessment`). Maximum institutional authority; free. [verified]
- Empirical outcome, from a developer study: *"FactSheets has usage examples, while ALTAI does not… ALTAI presents 'yes'/'no' questions, which makes it challenging to present a clear final documentation of the model"*, and *"ALTAI and FactSheets… were considered the most complicated to use… **No developer chose ALTAI final documentation as an option**"* (`https://arxiv.org/pdf/2512.15791`). [verified]
- **The single most relevant failure in this document for an AI-governance kit.** The artefact is free, authoritative, pan-European, in the right category — and it produces no output anyone wants to hand to anyone. A yes/no self-assessment yields a filled-in questionnaire; a model card yields **a document you can publish**. The deliverable the user is left holding is the product. [verified evidence; inferred rule]
- Pattern: **L2** — not machine-readable *and* not human-publishable; only fillable.

### 3.10 `llms.txt` — a failure in progress, and the cleanest one in the corpus

It belongs in failures even though its adoption curve looks like success, because adoption is not consumption.

| Field | Value |
|---|---|
| Proposed | **2024-09-01** (repo creation), by **Jeremy Howard** (Answer.AI / fast.ai), `llmstxt.org` |
| Repo | `AnswerDotAI/llms-txt` — **2,684 stars, 179 forks, 119 open issues**, **Apache-2.0**, last push 2026-09-24 |

Measured outcome, from Ahrefs' log study of **137,210 domains** that received traffic in May 2026 (`https://ahrefs.com/blog/llmstxt-study/`, published 2026-06-15, authors Louise Linehan and Xibeijia Guan):

- **28%** (≈38,360 domains) publish a valid `llms.txt` — explicitly flagged by the authors as an **upper bound**, since their customers skew SEO-aware.
- **97%** of those files received **zero requests** in May 2026 — "No bots. No humans. Nothing."
- Of requests to the 3% that were fetched: **96% from bots**; largest categories **SEO audit tools 21.7%**, unidentified **14.9%**, general crawlers **13.1%**, tech profilers **11.6%**.
- Combined AI bots: **19.5%**. **AI retrieval bots** (`OAI-SearchBot`, `PerplexityBot`) — the pitched use case — **1.1%, i.e. 233 requests**. Chrome's Lighthouse audit: **22 requests**, ~1 in 1,000.
- **Zero** requests from AI bots for `llms.txt` files that do not exist: "They never go looking."
- *"Slackbot alone fetched llms.txt files more often than PerplexityBot did."*

First-party statements against it: Google's own guide, under a heading literally called *"Mythbusting generative AI search: what you don't need to do"*, states *"You don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search (including its generative AI capabilities), as Google Search itself doesn't use them"* (`https://developers.google.com/search/docs/fundamentals/ai-optimization-guide`). John Mueller, on Bluesky: *"FWIW no AI system currently uses llms.txt"* (`https://www.seroundtable.com/google-ai-llms-txt-39607.html`), separately comparing it to the keywords meta tag. Gary Illyes confirmed in July 2025 that Google does not support it and does not plan to. [verified]

One nuance that cuts the other way, and the only part a developer-tools publisher should care about: in the Ahrefs breakdown, **`GPTBot` is the top AI fetcher and `Claude-Code` is second, ahead of every AI search and assistant bot**, and Mueller's own framing is that `llms.txt` is a *"temporary crutch, perhaps to save some tokens" for AI coding tools parsing developer documentation.* [verified] For a repository of developer-facing governance templates there is a small, real, non-search audience — coding agents — and essentially no search-visibility value.

Pattern: **L7** in its purest form. 38,360 sites optimised a proxy (file exists) with no causal path to the outcome (being cited). A November 2025 study across ~300,000 domains reportedly ran correlation plus a gradient-boosted model and found that *removing* the `llms.txt` feature **improved** model accuracy (`https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026`) — [unverified] as to the primary study, which I could not reach.

---

## 4. Mechanics that recur — scored against the evidence

| Mechanic | Present in winners? | Verdict |
|---|---|---|
| **A stable, citable URL** | 10/10 | **Necessary.** Every winner has a host-level canonical: `semver.org`, `12factor.net`, `keepachangelog.com`, `contributor-covenant.org`, `conventionalcommits.org`, `caniuse.com`. **Not one is cited by its GitHub repo URL.** |
| **Version in the citation path** | Keep a Changelog (`/en/1.1.0/`), SemVer (`/spec/v2.0.0.html`), Conventional Commits (`/en/v1.0.0/`), OWASP (`Top 10:2025`), Contributor Covenant (2.1) | **Necessary at scale.** It is what let Keep a Changelog ship 2.0.0 in 2026 without invalidating a decade of citations. Artefacts without it cannot revise safely. |
| **Depended on by tooling rather than read by humans** | SemVer (1.17 B/wk), caniuse (283 M/wk), Keep a Changelog (`git-cliff --init keepachangelog`), Contributor Covenant (`bundle gem`, GitHub picker), gitignore (repo-creation UI), Model Cards (HF `README.md` + YAML), awesome (`awesome-lint` + badge), SPDX (API field values) | **The strongest single predictor in this corpus.** Every winner has at least one tool that consumes it; the clearest losers (CalVer, ALTAI, Citizen CoC, TLDRLegal) have none. |
| **Ships its own citation string** | Keep a Changelog, explicitly; SemVer by being referenced inside Keep a Changelog's block | **Underrated, zero-cost, highest leverage per unit of effort.** |
| **A licence permitting reuse without asking** | gitignore CC0, awesome CC0, OWASP CC BY-SA 4.0, KAC/12factor/ConvCommits MIT, caniuse-lite CC BY 4.0 | **Lubricant, not cause.** Falsified as a necessity by **SemVer, which has no licence file at all** (`license: null`; issue #433) and by Contributor Covenant, whose licence GitHub classifies **`NOASSERTION`** — the two most-copied policy/spec texts here have the two muddiest licences. |
| **Machine-readability of the artefact itself** | SPDX yes; Model Cards yes (YAML front matter); **Keep a Changelog explicitly refuses** — 2.0.0 states "No machine format, schema, or strict layout: this is the format" | **Overrated as usually stated.** What matters is that *a tool can act on it*, achievable by a tool implementing a prose convention. The convention must be mechanically checkable, not mechanically formatted. |
| **Translation** | Contributor Covenant 40–45+ languages; Keep a Changelog 26+ (first three Dec 2015, fifteen more Sept 2024) | **A consequence, not a cause.** In both cases volunteer translations arrived **18+ months after launch** — evidence canonicity already existed. Commissioning translations early optimises an output. [inferred] |
| **Named maintainer vs. organisation** | Won as individuals: Keep a Changelog, awesome, caniuse, git-flow (26,766 stars), HIBP. Won as orgs: OWASP, SPDX, gitignore. **Transferred mid-life:** Contributor Covenant → OES (2021), 12-Factor → open governance (2024), caniuse-lite → `browserslist` org | **Neither is required.** Recurring pattern: a person for launch, an institution for durability — handover happens *after* canonicity, around years 7–13. |
| **Governance of changes** | Keep a Changelog 2.0.0 publishes a refusal list; OWASP has a ~4-year cadence; Conventional Commits has 166 open issues and no cadence | **Matters mainly as refusal capacity.** The useful artefact is a published "what this will never become" list; it protects downstream citers. |
| **Being first** | **Falsified.** Citizen CoC predates Contributor Covenant by 3 years; `awesome-php` predates `awesome` by 2.5 years; `awesome-awesomeness` by 3 days; WASC overlapped OWASP | Not a factor. |
| **Stars** | **Falsified as a measure.** SPDX: 715 stars, maximal canonicity. `awesome`: 534,691 stars, near-zero citation in other people's docs. `gitignore` has 42× `choosealicense`'s stars and both ship in the same UI | A popularity proxy with no demonstrated causal link to citation. **L7** risk if treated as a target. |
| **Active maintenance** | **Falsified as a precondition.** 12-Factor: no substantive change 2012→2024, canonical throughout. SemVer: last push 2025-11-05, still the referent. Qualifier from §3.5: fatal only when the artefact enumerates a changing world | Required for *accuracy*, not for *canonicity*. |

---

## 5. AI-era distribution — what is known versus what is marketed

### 5.1 Retrieval: four different systems, four different gates

| System | Mechanism | Evidence quality |
|---|---|---|
| **Google AI Overviews / AI Mode** | RAG grounded in the **core Search index**, plus "query fan-out." Eligibility: the page must be **indexed and snippet-eligible**, and the site must be **"included in Search generative AI features in Search Console."** | **Strong — Google's own documentation** (`developers.google.com/search/docs/fundamentals/ai-optimization-guide`) |
| **ChatGPT search** | A dedicated crawler, **`OAI-SearchBot`**, documented separately from the training crawler `GPTBot` | Medium; OpenAI documents the agents. Third-party coverage figure ~55.67% (Hostinger via `almcorp.com`) is **[unverified]** |
| **Perplexity** | **Its own crawler and index**, ranked since **September 2026** by an in-house engine ("Photon"), with Bing as a supplementary source | Medium — multiple secondary sources, no single primary |
| **Claude web search** | **Brave Search API.** Anthropic added Brave to its subprocessor list in **March 2025** | Medium on the integration; *"about 79% of Claude's citations come from Brave's top 10"* is **[unverified]**, single-source |

**Consequence for an artefact author:** there is no "AI channel." There are four indices, and the practical route into at least three is ordinary search ranking plus being crawlable. Google says so in as many words.

### 5.2 Which sources these systems actually cite

- Reddit, Wikipedia, YouTube, LinkedIn and Forbes plus ten more domains account for roughly **68%** of citations across ChatGPT, Claude, Gemini, Perplexity and AI Overviews; the top five alone ≈ **38%** (`https://trydecoding.com/blog/top-cited-domains-in-ai/`, 10 M+ citations). [vendor study]
- Platform-specific: ChatGPT — Wikipedia **7.8% of total citations, 47.9% of top-10 source share**; Perplexity — Reddit **46.7%**; AI Overviews — Reddit **21%** (`https://www.averi.ai/how-to/chatgpt-vs.-perplexity-vs.-google-ai-mode-the-b2b-saas-citation-benchmarks-report-(2026)`, 680 M citations, Profound). [vendor study]
- **Only 11% of domains are cited by both ChatGPT and Perplexity.** [vendor study] There is no single corpus to win.
- Organic-overlap figures are **[disputed], and the disagreement is methodological, not noise**: Ahrefs July 2025 reported **76.1%** of AIO citations rank top-10 (1.9 M citations across 1 M AI Overviews); Ahrefs March 2026 reported **38%**; Semrush reports **20–26%** overlap with top-10 but ~**97%** of citations from top-20 across 10 M+ keywords; seoClarity (Oct 2025, 362,000 keywords) found **94%** of *keywords* had at least one top-20 overlap while **44% of individual citations came from outside the top 20**. The spread is driven by counting keywords vs. citations and top-3 vs. all citations. Anyone quoting a single number is quoting a methodology. [verified that the sources disagree]

### 5.3 Training data: where a document must be to be *known* rather than retrieved

- **C4** (behind T5 and LLaMA-era models), as analysed by The Washington Post with the Allen Institute (April 2023, `https://www.washingtonpost.com/technology/interactive/2023/ai-chatbot-learning/`): **15.7 million domains**; the **top 1,000 domains are only 8% of tokens**; largest single domains **patents.google.com 0.46%**, **wikipedia.org 0.19%** (290 M tokens), **scribd.com 0.07%**, **nytimes.com 0.06%**. Personal blogs: over half a million, **3.8% of categorised tokens**. [verified]
- **The Stack** (BigCode, code-pretraining corpus): **>6 TB**, **358 languages**, built from **220.92 M GitHub repository names** (GHArchive, 2015-01-01 → 2022-03-31) and **51.76 B files** downloaded Nov 2021 → Jun 2022, **sourced exclusively from repositories whose licences permit redistribution**, with a documented opt-out ("Am I in The Stack") (`https://huggingface.co/datasets/bigcode/the-stack`). [verified]

**Two conclusions follow, and they are the only defensible AI-era claims here.**

1. **Being on GitHub matters for training, mechanically, and specifically via the licence.** The Stack included only redistribution-permitting repositories. A governance template on GitHub under MIT/CC0/CC BY has a documented path into code-model pretraining; the same template under "all rights reserved", NC, or no licence does not. This is the one place where licence choice is **causal rather than lubricating** — and it is the opposite of the usual argument for permissive licensing. [verified premises; inferred conclusion] Confirming test: query "Am I in The Stack" for the repository once it exists with a licence file.
2. **Nothing in the retrieval path reads a special file.** Google: llms.txt ignored; *"Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add"*; *"There's no requirement to break your content into tiny pieces"*; *"You don't need to write in a specific way just for generative AI search."* Google still recommends schema.org **for rich results in classic Search**. [verified]

### 5.4 Verdict table for AI-era tactics

| Tactic | Evidence | Verdict |
|---|---|---|
| Ordinary indexability + snippet eligibility + Search Console opt-in | Google's own guide | **Required.** The only documented gate. |
| Permissive licence on a public GitHub repo | The Stack's inclusion rule | **Real, for training-corpus inclusion.** Underrated. |
| Being referenced by other sites' documentation | Citation concentration in a handful of domains | **Real but indirect:** the path into an answer runs through being named on pages that already rank. |
| `llms.txt` | 97% never fetched; retrieval bots 1.1% (233 requests); Google explicitly ignores it | **Marketed, not known.** Narrow exception: AI *coding* agents (`Claude-Code` second-highest fetcher). |
| schema.org / JSON-LD for AI visibility | Google: "not required… no special markup" | **Marketed.** Keep for rich results; expect no AI lift. |
| "Chunking" / writing specifically for LLMs | Google: explicitly unnecessary | **Marketed.** |
| Licensing signals as a citation incentive | No evidence found that any retrieval system weights CC licensing when choosing what to cite | **Unsupported.** Searched: Google's AI optimisation guide, Ahrefs' bot-log study, the vendor citation studies above. If such weighting exists it is undocumented. |

---

## 6. The cold-start problem — channel and moment, named

| Artefact | First-thousand channel | Date | Evidence |
|---|---|---|---|
| **Keep a Changelog** | One podcast episode: The Changelog #127 with Olivier Lacan | **2014-08-08**, ten weeks after launch | Podcast page; the project's own `v0.0.3` entry adds a section *about* the podcast |
| **The Twelve-Factor App** | Hacker News, twice: "Twelve Factors of Web Application Development" (**Nov 2011, 37 comments**); the better-titled relaunch (**May 2012, 1 comment**) flopped | 2011–2012 | HN item 37857544 |
| **Contributor Covenant** | One language community (Ruby) by personal credibility → `bundle gem` scaffolding → a funding condition (Ruby Together, **2015-07-15**) → GitHub's picker (**2017-06-14**) | 2014–2017 | TechCrunch interview; rubytogether.org; github.blog |
| **Have I Been Pwned** | Author's own blog post, with **5 breaches indexed**; then mainstream (not tech) press; *"Morning news shows would blast out its web address"*; Ashley Madison produced a **+57,000% traffic** spike | **2013-12-04** | troyhunt.com/about; Wikipedia; TechCrunch 2020-07-03 |
| **`sindresorhus/awesome`** | An existing personal following, then a genre to certify (manifesto + badge + linter) in a field where four rival lists launched within three weeks | **2014-07-11** | dev.to history; `awesome.md` |
| **`github/gitignore`, `choosealicense.com`** | Owned the surface. No cold start existed — the publisher *was* the platform | 2010 / 2013 | Repo creation dates |
| **OWASP Top 10** | A foundation's chapter network, then the audit market | 2003 → PCI DSS era | OWASP 2010 PDF; PCI DSS material |
| **Model Cards** | A peer-reviewed venue (FAT* 2019) with a permanent DOI, then a registry that renders the file | 2018–2019 | OpenAlex W2897042519; HF docs |
| **Can I Use** | Developer word of mouth (e.g. CSS-Tricks, 2012-10-03), then packaging into `caniuse-lite` | 2008 → 2012 | css-tricks.com/caniuse-on-github |

**The pattern across all nine:** every cold start was **one channel, one moment, and an existing audience that was not the author's own.** Not a launch campaign. Not seven simultaneous publications. The two artefacts that skipped cold start entirely (`gitignore`, `choosealicense`) did so by owning the distribution surface — which is the asset most publishers lack, and therefore the thing that has to be borrowed from someone who has it.

---

## 7. How long, from publication to citation by strangers

| Artefact | Published | First evidence of strangers investing effort | Span |
|---|---|---|---|
| **Keep a Changelog** | 2014-05-31 | Podcast feature 2014-08-08 (**10 weeks**); first volunteer translations 2015-12-03 (**18 months**); `1.0.0` with 17 translations 2017-06-20 (**3 years**) | **10 weeks → 3 years** |
| **Contributor Covenant** | 2014-01-30 | Atom/AngularJS/Eclipse/Rails adoption during 2015 (**~1–2 years**); funding condition 2015-07-15 (**18 months**); GitHub picker 2017-06-14 (**3.4 years**); Linux kernel 2018 (**4.5 years**) | **1 year → 4.5 years** |
| **Twelve-Factor App** | 2011/2012 | The cloud-native baseline through the container era; open-sourced with corporate custodians 2024-11-12 | **~2 years → 13 years to institutionalisation** |
| **OWASP Top 10** | 2003 | PCI DSS v1.1 era (2006) establishes the compliance context (**~3 years**); auditor-default status accumulates over 2006–2010 | **~3 years → ~7 years** |
| **SemVer** | 2010-12-14 | Package-manager implementation in npm/Cargo "from day one" of those ecosystems (**1–2 years**) | **~1–2 years** |
| **Model Cards** | 2018 (arXiv) / 2019 (FAT*) | 3,710 citations accumulated by 2026 | **~2 years to field default** |
| **Have I Been Pwned** | 2013-12-04 | *"Within a few months it had millions of users"* — the outlier | **months** |

**Calibrated expectation: three months to the first stranger linking; eighteen months to the first stranger doing unpaid work on your behalf (a translation, a port, a tool integration); three to five years to appear in other organisations' documentation as the default; seven to thirteen years before an institution asks to take custody.** [inferred from the verified dates above] The HIBP exception is informative precisely because it is one: it had a consumer-press hook, which a governance template does not.

---

## 8. Has a single-author resource from an unknown person ever won? Yes — and here are six

| Artefact | Author | Status at launch | Outcome, numerically |
|---|---|---|---|
| **Can I Use** | Alexis Deveria | Unknown individual, spare-time project, 2008 | `caniuse-lite` **283 M npm downloads/week**; MDN merged *its* data in |
| **Keep a Changelog** | Olivier Lacan | Mid-career developer, no platform | **6,753 stars**, 26+ translations, built into `git-cliff` |
| **git-flow** | Vincent Driessen | Unknown, blog post 2010-01-05 | **26,766 stars** on the (now archived) tool; the blog post was cited as a standard for a decade — he added a *"Note of reflection"* on **2020-03-05** warning against dogmatic use |
| **Have I Been Pwned** | Troy Hunt | Software architect at Pfizer, built v1 in about a week | **1,000+ breaches, 6 B+ addresses, 400,000+ domains monitored, more than half the Fortune 500** |
| **`sindresorhus/awesome`** | Sindre Sorhus | Prolific but not famous; quit his job in 2014 | **534,691 stars** |
| **CalVer** (partial win) | Mahmoud Hashemi | Individual | Real adopters (Ubuntu, Twisted, Apple OS 26, NVIDIA); never became the referent |

**What the clear winners share — five properties, all five present in every one of the five full wins:**

1. **The author was a practitioner with the problem**, not a vendor with a thesis. (Lacan maintained changelogs; Hunt analysed the Adobe breach; Deveria shipped browser-compatible CSS.)
2. **The artefact is one page or one file** — not a kit, not a suite, not a curriculum.
3. **Somebody else's tool consumed it**, usually within three years, and usually built by a third party rather than the author. (`caniuse-lite` is published under the `browserslist` org by Andrey Sitnik, not by Deveria.)
4. **The author did not require permission to be asked.** MIT, CC0, CC BY.
5. **The cold start was a single borrowed audience** — a podcast, a blog, a community — never a multi-artefact launch.

Properties **not** shared, and therefore not required: institutional backing, funding, a team, an organisation account, prior fame, or an active maintenance cadence.

---

## 9. What a serious practitioner still cannot get

Stated as what is missing from the world, not as a proposal:

1. **No artefact in any category examined couples a prose convention to a conformance checker for governance documents.** `awesome-lint` exists for link lists; `commitlint` for commit messages. Nothing takes a repository or document set and answers "does this satisfy the documents a security review asks for." The two AI-governance artefacts that got closest — ALTAI and FactSheets — are a questionnaire and a PDF, and the empirical study found **no developer chose ALTAI's output**. [verified]
2. **No free artefact occupies the gap between NIST AI RMF (free, uncertifiable, framework-level) and ISO/IEC 42001 (CHF 225 for 51 pages, certifiable at US$15,000 → several hundred thousand all-in).** NIST's material is *"voluntary, free of charge"* and NIST *"does not certify, accredit, or audit conformance"*; ISO's text cannot be redistributed. Missing: **the fillable, publishable, redistributable middle** — the role model cards play for models. [verified on both prices/terms; gap claim inferred]
3. **No stable machine identifier exists for AI-governance documents.** SPDX gave licences `MIT` and `CC0-1.0`; Hugging Face gave model documentation `README.md` plus a nine-key YAML schema. Nothing names "the DPIA", "the vendor questionnaire", or "the incident call order" such that a tool can check for presence. **715 stars is what that job looks like when it is done.** [verified]
4. **A reliable, non-vendor measurement of whether an artefact is cited by AI systems does not exist.** Every citation-share figure in §5.2 comes from an SEO vendor measuring its own panel; the organic-overlap figures disagree by a factor of 2–4 by counting method; and Google itself warns *"No third-party tool has access to our internal ranking or AI systems."* [verified]

---

## 10. Assumption challenged, traps, and limits

### 10.1 The CONTEXT assumption my frame rejects

**CONTEXT treats measured Bing search demand as the map of where reference-hood is available** (`ai governance framework` 803, `evals` 2459, `nist ai rmf` 6899, …), and treats `github.com/meshin-co/<slug>` as the artefact's address. Both are wrong under this frame:

- **Search volume measures lookup, not citation.** No winner in this corpus was won through search demand. SemVer was won by a dependency resolver; Contributor Covenant by `bundle gem` and a funding condition; Model Cards by a registry's file-rendering rule; OWASP by an audit market; `gitignore` by a repo-creation dropdown. Optimising for 6,899 monthly searches on `nist ai rmf` is **L7** — a measured proxy with no demonstrated causal link to being cited in someone's documentation three years later.
- **No winner is cited by its repository URL.** Every one is cited at a project domain, and the durable ones embed a version in the path (`keepachangelog.com/en/1.1.0/`, `semver.org/spec/v2.0.0.html`). A plan whose citable address is a GitHub repo path inherits **L4**: the default branch mutates silently under every inbound link. The 404s described in CONTEXT are that same failure already in evidence.
- **Seven resources is the shape of the risk.** Every win here is one artefact, one page, one file, one channel, one moment. The corpus contains no example of a category won by a seven-part kit. Publishing seven is **L6** by construction, even sequentially, if the launch channel is divided.

### 10.2 Traps — attractive from other frames, fatal under this one

| Trap | Why it attracts | Mechanism of failure | Pattern |
|---|---|---|---|
| **Publish `llms.txt`, schema.org, Markdown mirrors for AI visibility** | The GEO frame says machine-readability is the new SEO | 97% of `llms.txt` files were never fetched; AI retrieval bots accounted for **233 requests** in the whole Ahrefs population; Google's documentation says it ignores them, calls special markup unnecessary, and warns against third-party GEO advice | **L7** |
| **Optimise for the measured search terms** | Demand data is right there and quantified | None of ten winners came through search; the demand terms (`nist ai rmf`, `eu ai act`) are already owned by the standards bodies themselves | **L7** |
| **Ship all seven, or ship whichever is "most ready"** | The resources already exist as promises; sequencing feels like delay | Winners have a single borrowed launch channel; splitting the one podcast/community moment across seven artefacts spends the only non-renewable asset | **L6** |
| **Make the artefact comprehensive — cover the whole governance surface** | Completeness reads as authority; it is what a consultancy sells | FactSheets was *more comprehensive* than Model Cards: **527 citations against 3,710**. Comprehensiveness raises the cost of the first use | **L2** |
| **Publish as a polished PDF or gated download** | Looks professional, captures leads, matches the audience's own document habits | *Beyond the Twelve-Factor App* (70 pages, O'Reilly, "Compliments of Pivotal") never displaced a 39-page free web page; you cannot hyperlink a reader to clause 7 of a PDF | **L3 + L4** |
| **Choose CC BY-NC, or ship with no licence "for now"** | Protects commercial consulting; licensing feels deferrable | The Stack admitted **only** redistribution-permitting repositories — an NC or unlicensed artefact forfeits the one documented, mechanical path into model pretraining. (SemVer survived without a licence in 2011; that door has since partly closed) | **L3** |
| **Build an interactive scorecard/tool instead of a document** | Demos better; feels more valuable than a Markdown file | ALTAI is exactly this, from the European Commission, and **no developer in the study chose its output**. Tools produce sessions; documents produce artefacts people publish and link | **L2** |
| **Wait for v1.0 polish before publishing** | Reputation risk feels asymmetric | Keep a Changelog launched at `v0.0.1` and did not adopt SemVer for itself until **16 months later**; its canonical citation path is still the 1.1.0 page seven years on. Early, versioned and imperfect beats late and complete | **L1** |
| **Promise active maintenance as the differentiator** | Freshness is the obvious objection to a static document | 12-Factor received no substantive revision for 13 years and stayed canonical. But see §3.5: WASC froze and died because it **enumerated a moving world**. A kit listing current regulations inherits WASC's risk, not 12-Factor's safety | **L8** |
| **Court an institution early for credibility** | Standards-body backing looks like instant authority | ALTAI had the European Commission and lost; custody transfers in this corpus happen at years **7 (Contributor Covenant) to 13 (12-Factor)** — after canonicity, never before it | **L5** |

### 10.3 What I could not verify — needs follow-up

- **No pattern-id list reached me in CONTEXT.** The L1–L8 ids are mine and labelled as local. If the wave has canonical ids, every risk and trap needs remapping; mechanisms are stated explicitly so the remap is mechanical. **This is the one `needs_followup` item.**
- **Cross-repository citation counts.** The measurement that would directly answer "cited in other people's documentation years later" is a code-search count of `keepachangelog.com`, `semver.org`, `contributor-covenant.org`, `conventionalcommits.org`, `12factor.net` across public repositories. GitHub's code-search API needs authentication I do not have, and **grep.app returned HTTP 429 on four separate attempts** (`https://grep.app/api/search?q=keepachangelog.com`). The npm download counts in §1 are my substitute; they measure tool dependence rather than textual citation. **Exact fact needed: occurrences of each canonical URL in `CHANGELOG.md` / `CODE_OF_CONDUCT.md` / `README.md` across public GitHub, by year.**
- **Contributor Covenant's real adoption count** — the four figures (40,000 / 100,000 / 200,000 / "thousands") are irreconcilable and all self-reported. Needed: a code-search count, same instrument as above.
- **Contributor Covenant's actual licence.** GitHub classifies it `NOASSERTION`; the site claims CC BY 4.0. Needed: the `LICENSE` blob on the `release` branch.
- **The ~300,000-domain `llms.txt` correlation study** (Nov 2025) is reported second-hand only; I did not reach the primary.
- **"79% of Claude's citations come from Brave's top 10"** and **"OAI-SearchBot 55.67% coverage"** are each single-source and vendor-adjacent.
- **PCI DSS primary text.** Verified through multiple secondary sources, including one that *corrects* the common claim; I did not read the PCI DSS v4.0.1 PDF's requirement 6.2.4 text directly.
- **`bayandin/awesome-awesomeness` star count** (~25,706) comes from an archived third-party snapshot, not a live API read; order-of-magnitude only.
