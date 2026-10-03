---
record: true
---

# 03 — AI operating model for a mid-size company: what current sources say, 2026-10-02

Dated 2026-10-02. Research for buyer prompt 14, "AI operating model for mid-size company"
(`docs/SEMANTIC-CORE.md`, prompt 14 and Phase 6 worklist item 7). This is a record, not an
instruction: it says what named sources said on that date, it cites pages outside this tree, and the
figures and URLs in it are not expected to stay true. It holds no page copy. A separate writer drafts
the article from it. Every claim below was read in the source named next to it. Where I read only a
search snippet, a publisher preview, a web-archive copy or a secondary summary, the sentence says so.
Tags like [S12] point to the numbered list in section 6.

Labels used for the strength of a claim:

- REQUIRED: a law or binding instrument says it, for the party named.
- STANDARD: a voluntary standard or framework says it.
- OBSERVED: a regulator, survey or case reports what organisations do. The sample is named.
- RECOMMENDED: a research centre, consultancy or vendor says organisations should.
- POPULAR: repeated by vendors and consultancies, and I found no primary data behind it.

In brief:

1. No law or standard I read requires a private company to have a committee, a centre of excellence,
   a hub-and-spoke model or a Chief AI Officer. The one binding instrument that requires such
   structures covers US federal agencies only [S10].
2. What law and standards do require is narrower: documented roles, executive responsibility for AI
   risk decisions, an inventory, literacy measures, and for high-risk systems an accountability
   framework (providers) and trained, authorised human overseers (deployers).
3. Every pattern (centralised, hub-and-spoke, decentralised, embedded) is observed or recommended.
   None is proven. The outcome links come from self-reported surveys, mostly of large companies.
4. "AI operating model" has no standard definition. The three definitions I read differ in size.
5. The EU AI Act timeline moved in July 2026. The high-risk duties that touch decision rights now
   start 2 December 2027 (Annex III systems) and 2 August 2028 (Annex I systems). AI literacy and
   transparency duties are not deferred.
6. Section 5 lists 28 questions only the owner can answer. Questions marked (B) block the draft.

## 1. What the page must answer

Buyer prompt, verbatim: **AI operating model for mid-size company**

The route plan names `/approach` and `/blog/category/operating-model` as the pages that must win this
prompt. It records the gap in these words: "no dedicated 'AI operating model' anchor article — the
hub lists related articles but none owns the phrase" (`docs/SEMANTIC-CORE.md`, prompt 14). The planned
page is a `/blog/...` article, cross-linked from both routes.

What a buyer typing it wants. [INFERENCE: the prompt is a noun phrase, not a question, and I had no
query data. Check against Search Console once the page is live.] Three readers fit it:

- An executive at a company of roughly 30 to 300 people whose AI pilots are stuck or multiplying. They
  want a structure they can copy: who decides, who reviews, who runs it.
- Someone told by a CEO or board to "build us an AI operating model". They need to know what it
  contains, and how it differs from the strategy deck and the policy they already have.
- A buyer comparing patterns (central team, hub-and-spoke, embedded people) who wants to know which
  one fits a company this size, and what each costs when it goes wrong.

Questions the page has to answer, taken from the research brief:

1. What does "AI operating model" mean now, and how does it differ from AI governance, an AI strategy
   and a centre of excellence?
2. Which patterns are in use, what do published sources say about their cost and failure points, and
   which are evidenced versus only popular?
3. Who usually approves a system, owns its evaluation and signs risk acceptance, and what do NIST AI
   RMF GOVERN and ISO/IEC 42001 say about it?
4. What did 2025 and 2026 change, and what does the EU AI Act timeline force an operating model to
   carry, by when?
5. What do the sources say about a company of this size, and what does meshin.co already say?

## 2. State of practice, 2026

### 2.1 What the term means, and what it is not

Read: NIST AI 100-1 (Jan 2023) [S6]; ISO/IEC 42001:2023 front matter, contents and clauses 1 to 3, in
publisher previews [S8]; McKinsey, Sep 2024 [S22]; UTS HTI Snapshot 6, May 2026 [S18]; the meshin.co
category page as built on 2026-10-02.

No standard defines it. I searched the full text of NIST AI 100-1 for "operating model", "centre of
excellence", "centralized", "committee", "hub" and "federated". There were no hits [S6]. The ISO/IEC
42001 preview text I read does not use the phrase either [S8]. I could read clause text only up to
clause 3, because the full standard costs CHF 225 [S8].

Three definitions in use disagree on size:

- McKinsey, Sep 2024: an operating model is "a plan that outlines how people, processes, and
  technology will be deployed". For gen AI it "includes every decision—from staffing and
  organizational structures to technology development and compliance—that guides how gen AI is used
  and measured" [S22]. That is the widest version.
- UTS Human Technology Institute, May 2026, names an "AI governance operating model" with four
  components: strategy, AI governance structure, AI governance practices and AI governance enablers
  [S18]. Here the model contains strategy and governance.
- meshin.co's category page today: "the decision structure that moves AI work from a pilot nobody
  owns to a process a team runs". It answers three questions: who chooses which processes get
  automated, who reviews a system before it reaches a customer, who runs it afterwards.
- A web search also returned vendor pages with competing definitions (ServiceNow community, Atlan,
  AvePoint, Roover, Agility at Scale, Alice Labs, IBM Think). I read the search summary only, did not
  open the pages, and draw nothing from them.

The nearest thing in a standard is the ISO term "management system". ISO/IEC 42001 clause 3.4 defines
it as a "set of interrelated or interacting elements of an organization to establish policies and
objectives, as well as processes to achieve those objectives". Note 2 adds that the elements "include
the organization's structure, roles and responsibilities, planning and operation" [S8]. The
introduction says the AI management system "should be integrated with the organization's processes
and overall management structure" and that the document "avoids specific guidance on management
processes" [S8]. So the standard covers structure and roles inside a governance frame. It says nothing
about how AI work moves from idea to production.

How the neighbouring terms differ. This table is the record's proposal, built from the sources. It is
not a sourced definition. The writer should treat it as a draft to test with the owner (section 5).

| Term | The question it answers | What the sources say |
|---|---|---|
| AI strategy | Which AI work, and why | HTI says a board "does not need to develop a standalone AI strategy document" [S18]. ASIC lists "a clearly articulated AI strategy" among traits of its more mature licensees [S12]. OMB requires each CFO Act agency to develop an AI strategy within 180 days of its memo of 3 April 2025 [S10]. |
| AI governance | Who may approve, and who answers when it fails | NIST: GOVERN is "a cross-cutting function that is infused throughout AI risk management and enables the other functions of the process" [S6]. |
| AI management system | The recurring cycle of policy, roles, processes and checks | ISO/IEC 42001 [S8]. |
| Centre of excellence | A team. One way to staff part of the model | McKinsey places a "center of excellence" inside its centralised and federated archetypes [S22]. It is a component, not a synonym. |
| AI operating model | How AI work moves from idea to production to an owner, and where the people sit | The three definitions above. |

### 2.2 What is required, and what is only recommended

Read: [S1] [S2] [S3] [S6] [S8] [S9] [S10] [S11] [S14].

Law and binding instruments (REQUIRED):

| Binds | What it requires | Applies from |
|---|---|---|
| Providers of high-risk AI systems | Art 17(1): a documented quality management system. It includes a compliance strategy (a), risk management (g), post-market monitoring (h), serious-incident procedures (i), record-keeping (k), resource management (l) and (m) "an accountability framework setting out the responsibilities of the management and other staff with regard to all the aspects listed in this paragraph". Art 17(2), as replaced: implementation "proportionate to the size of the provider's organisation" [S2] [S1]. | 2 Dec 2027 (Annex III systems), 2 Aug 2028 (Annex I systems) [S1] |
| Deployers of high-risk AI systems | Art 26(2): "assign human oversight to natural persons who have the necessary competence, training and authority, as well as the necessary support". Art 26(3) leaves "the deployer's freedom to organise its own resources and activities" for doing so [S2]. | Same dates [S1] |
| Providers and deployers of AI systems | Art 4, as rewritten: "take measures to support the development of AI literacy" of staff and others acting on their behalf. It "does not require providers or deployers to guarantee any specific level of AI literacy of any individual" [S1]. | In application since 2 Feb 2025. National authorities enforce from 2 Aug 2026 [S3] |
| Providers and deployers of chatbots, generative systems, deepfake content | Art 50 transparency duties [S2]. | 2 Aug 2026, with a grace date for marking (section 2.6) [S1] |
| US federal agencies only | OMB M-25-21: each agency head must retain or designate a Chief AI Officer within 60 days, and each CFO Act agency must convene an AI Governance Board within 90 days. The board needs a chair "at the Deputy Secretary level or equivalent" and a vice-chair who is the CAIO, and agencies "are permitted to rely on existing governance bodies". The CAIO duties include "establishing a process for an independent review of high-impact use cases before risk acceptance". For high-impact AI, a CAIO "may waive one or more of the requirements" for a specific application "after making a written determination", may revoke a waiver at any time, and that responsibility "shall not be delegated down to other officials" [S10]. | Memo dated 3 Apr 2025 [S10] |

What the Commission says about structure. Its AI-literacy Q&A asks: "Is an AI officer necessary
similarly as for the GDPR? ... Shall an organisation set up an AI governance board?" The answer is: "No,
no specific governance structure is mandated to comply with article 4 of the AI Act" [S3]. That
answer is scoped to Article 4. For organisations that deploy high-risk systems, the Q&A says the duty
to train staff for human oversight "remains in place" [S3]. On evidence of literacy: "There is no need
for a certificate. Organisations can keep an internal record of trainings" [S3].

Voluntary standards and guidance (STANDARD):

| Source | What it says about structure |
|---|---|
| NIST AI RMF 1.0, Jan 2023 [S6] | Voluntary, and "non-sector-specific, and use-case agnostic, providing flexibility to organizations of all sizes". GOVERN 2.1: roles, responsibilities and lines of communication "are documented and are clear to individuals and teams throughout the organization". GOVERN 2.3: "Executive leadership of the organization takes responsibility for decisions about risks associated with AI system development and deployment." GOVERN 1.6: "Mechanisms are in place to inventory AI systems and are resourced according to organizational risk priorities." GOVERN 1.5: periodic review planned, "organizational roles and responsibilities clearly defined". GOVERN 3.2: policies "define and differentiate roles and responsibilities for human-AI configurations and oversight". It names who governs: "organizational management, senior leadership, and the Board of Directors". It prescribes no committee or team shape. NIST's own page says a revision is in progress [S7]. |
| ISO/IEC 42001:2023, Dec 2023 [S8] | A certifiable management-system standard that applies to "any organization, regardless of size". Clause titles in the contents: 5.1 Leadership and commitment, 5.2 AI policy, 5.3 Roles, responsibilities and authorities, 6.1.4 and 8.4 AI system impact assessment, 7.2 Competence, 9.3 Management review. I read the titles, not the clause text. It says the organisation's "size and structure" shape the system and that a "risk-based approach" is allowed. |
| ISO/IEC 42006:2025 (Jul 2025), 42005:2025 (May 2025), 38507:2022 [S9] | 42006 sets requirements for bodies that audit and certify against 42001. 42005 gives guidance on AI system impact assessment. 38507 gives guidance "for members of the governing body" on enabling and governing AI. I read catalogue descriptions only. |
| Australia, National AI Centre, Guidance for AI adoption: foundations [S14] | "Assign a senior leader as the overall AI governance owner." "Make a specific person accountable for every AI system your organisation uses." "Clarify supply chain accountabilities." "Create and maintain an AI register." "Adapt each practice to fit your organisation's size". The page I read shows no date. A search snippet from White & Case calls it non-binding [S32]. |
| US bank supervisors, SR 26-2, 17 Apr 2026 [S11] | "This guidance does not set forth enforceable standards or prescriptive requirements." Footnote 3: "Generative AI and agentic AI models are novel and rapidly evolving. As such, they are not within the scope of this guidance." |

Answer to "what do standards actually require about structure": documented and clear roles, executive
responsibility for AI risk decisions, an inventory, and independence between builders and assessors
(section 2.3). Everything about committees, hubs, spokes, centres of excellence and Chief AI Officers
is observed practice or recommendation.

### 2.3 Decision rights: approve, evaluate, accept risk

Read: [S2] [S6] [S10] [S11] [S12] [S13] [S14] [S17] [S19] [S20] [S27].

| Decision | What law and standards say | What sources observe or recommend |
|---|---|---|
| Approve a system for production | NIST GOVERN 2.3 puts risk decisions with executive leadership. GOVERN 1.3 sets "the needed level of risk management activities based on the organization's risk tolerance". No NIST subcategory names an approver [S6]. ISO/IEC 42001 has a clause 5.3, "Roles, responsibilities and authorities" (text not read) [S8]. AI Act Art 26(1): deployers use high-risk systems "in accordance with the instructions for use" [S2]. | BoE and FCA, 118 firms, Nov 2024: 72% give accountability for AI use cases and outputs to executive leadership, 64% to developers and data science teams, 57% to business-area users. "Most firms" name three or more accountable persons or bodies [S13]. ASIC: better practice was "cross-functional, executive-level committees with clear responsibility and decision-making authority". Seven of 23 licensees had or were setting one up [S12]. HTI: a central body sets minimum standards and approves high-risk systems. Business units approve low and medium risk inside those limits [S17]. |
| Own the evaluation | NIST MEASURE 1.3: "Internal experts who did not serve as front-line developers for the system and/or independent assessors are involved in regular assessments and updates." MEASURE 2.1: "Test sets, metrics, and details about the tools used during TEVV are documented." [S6] | SR 26-2 asks for "effective challenge" by "objective experts" with "sufficient independence" and "the organizational standing and influence to effect any change". It excludes gen AI and agentic AI [S11]. OMB wants independent review of high-impact use cases before risk acceptance [S10]. Australia suggests considering independent testing for uses that need extra governance [S14]. I found no source that says who should own an eval set after handover at a company of 30 to 300 people. |
| Sign risk acceptance | NIST MANAGE 1.3: "Risk response options can include mitigating, transferring, avoiding, or accepting." MANAGE 1.4: "Negative residual risks ... are documented." No signer is named [S6]. The AI Act articles I read (4, 17, 25, 26, 50) name no risk-acceptance signatory. | OMB: a waiver needs a written determination by the CAIO, who cannot delegate that duty down [S10] (federal agencies only). McKinsey, survey July 2024: 28% say the CEO oversees AI governance, 17% say the board, and on average two leaders are in charge [S20]. Deloitte, 2026 report page: "Enterprises where senior leadership actively shapes AI governance achieve significantly greater business value than those delegating the work to technical teams alone" [S27]. That is a consultancy claim on its own survey. |
| Keep the inventory | NIST GOVERN 1.6, above [S6]. | ASIC: some licensees lacked an AI inventory or kept "several dispersed model registers", and one licensee's register was missing models [S12]. Australia: "Create and maintain an AI register" [S14]. |
| Run it after launch | AI Act Art 26(5): deployers monitor on the basis of the instructions, and where a risk arises "inform the provider or distributor and the relevant market surveillance authority, and ... suspend the use of that system". Art 26(6): keep logs at least six months [S2]. NIST GOVERN 4.3 asks for practices that "enable AI testing, identification of incidents, and information sharing" [S6]. | Gradient Flow and Pacific AI, 2025: 48% of organisations monitor production AI systems. The same page gives 9% for small companies in its key findings and 29% in its closing paragraph, so I do not use a small-company figure [S28]. |

Who usually holds these decisions. IAPP and Credo AI (16 Apr 2025, more than 670 respondents in 45
countries) list the functions with primary AI governance responsibility: privacy 22%, legal and
compliance 22%, IT 17%, data governance 10%, ethics and compliance 6%, security 5%. They also say:
"There is no clear best practice for how to build and organize an AI governance team" [S19].

### 2.4 Patterns: cost, failure points, and the strength of the evidence

Read: [S12] [S13] [S15] [S17] [S20] [S22] [S23] [S24] [S25] [S26] [S29] [S31].

| Pattern | Evidence, and where it fails | Grade |
|---|---|---|
| Centralised: one team or centre of excellence decides, and often builds | McKinsey, survey July 2024, 1,229 organisations using AI: fully centralised for risk and compliance 57%, data governance 46%, AI strategy 36%, road map for AI products 35%, tech talent 29%, adoption of AI solutions 23% [S20]. Gartner, Q4 2024, 432 respondents: "almost 60%" of high-maturity organisations centralised AI strategy, governance, data and infrastructure [S26]. IBM, Q1 2025, more than 600 CAIOs: centralised model, 17% pilot in one function and 30% scaled across functions [S23]. Failure point named by McKinsey: the domain can be "siloed from key decision making because of distance from other domains" [S22]. ASIC lists as a poorer practice "committees that met infrequently and had a poorly defined mandate" [S12]. | OBSERVED. Outcome links are self-reported |
| Hub-and-spoke or federated: a central group sets standards, units run the work | IBM: hub and spoke, 27% pilot in one function and 40% scaled. CAIOs leading hub-and-spoke or centralised models "move twice as many AI pilots into production—and see 36% higher ROI on AI investments". The report's overview words the comparison group as CAIOs "managing decentralized operating models". IBM adds that organisations "generally move from decentralized operating models to centralized or hub-and-spoke models" as they scale [S23]. McKinsey, Sep 2024: the federated model gives "higher integration between CoE and domains", with "potential slowed execution in center of excellence, especially for cross-function use cases" [S22]. McKinsey, survey July 2024: hybrid is the most common answer for adoption of AI solutions (54%), tech talent (49%), AI strategy (48%) and road map (44%) [S20]. HTI describes a hybrid in which a central body sets policy and minimum standards and approves high-risk systems, and business units approve low and medium risk inside those limits. HTI recommends that most organisations set up a dedicated governance body, at least for a transition [S17]. Microsoft says its governance "borrows the hub-and-spoke model that has worked successfully to integrate privacy, security and accessibility". The hub holds the Aether Committee, the Office of Responsible AI and the RAISE group. The spokes are Responsible AI Champs "appointed by company leadership" [S15]. | OBSERVED and RECOMMENDED. The only long-running named case is a very large company describing itself. No cost or failure data |
| Decentralised: each unit owns its AI work | IBM: 40% pilot in one function, 10% scaled [S23]. McKinsey, Sep 2024: "potential lack of consistency, knowledge, and best practices; higher cost and risk of duplicating efforts", and it needs "very high domain maturity and sufficient scale" [S22]. ASIC: the "leveraged, decentralised" licensees sat in the middle of its maturity scale. Their weak points included relying on business lines to propose one-off use cases, and ownership at model or business-unit level without a senior executive accountable overall [S12]. Against this, MIT NANDA (July 2025, preliminary): "companies succeed when they decentralize implementation authority but retain accountability", and the practices of organisations that crossed its "divide" included "Sourced AI initiatives from frontline managers, not central labs" [S25]. | OBSERVED, and the sources conflict |
| Embedded: AI people sit inside business units | One case vignette: Italgas "embedded business translators ... in each unit" and added a group AI office [S24]. I found no source that measures an embedded model against the others or separates it from "decentralised". Vendor pages use the term (search snippets only) [S31]. | POPULAR, with one vignette |
| Champions network: named people in teams who spot issues | Microsoft's Responsible AI Champs [S15]. The Commission lists an "AI Champions network" among its own staff literacy measures [S3]. Neither reports an effect. | Described, not evaluated |

Cost. No source I read gives a cost for any pattern in headcount, budget or time. The closest signals
are small: McKinsey, survey July 2024, found 13% had hired AI compliance specialists and 6% AI ethics
specialists [S20]. In the IAPP survey, 10 of 671 respondents said no more staff were needed [S19].
Assembly Inc. states "12 to 18 months of rework" and a switch point at "15–20 active initiatives
across three or more business units", with no data behind either number [S29]. Two other vendor pages
give different switch points: "~15 concurrent use cases" and "beyond 2-3 AI use cases"
(search snippets only) [S31]. Treat all of these as POPULAR.

Failure points that are evidenced:

- Governance lags adoption. Of 23 ASIC licensees, 14 planned to increase AI use. Of those 14, 13 were
  planning or starting a governance uplift, and "only one appeared to have uplifted their governance
  before their anticipated uptick in AI use" [S12].
- Registers are incomplete. See the inventory row in section 2.3 [S12].
- Accountability is split. BoE and FCA: most firms name three or more accountable persons or bodies
  [S13]. McKinsey: on average two leaders in charge of AI governance [S20].
- Third parties hide risk. BoE and FCA: a third of AI use cases were third-party implementations, and
  46% of firms said they had only partial understanding of the AI technologies they use [S13].

Published case material, by name: Microsoft (its own blog, 19 Jan 2021) [S15]; Guardian Life and
Italgas (MIT CISR, 21 Aug 2025) [S24]; the European Commission describing its own staff measures [S3].
The ASIC licensees and McKinsey's "leading global telco" style examples are anonymous. None of them
publishes the cost of a structure or an adverse outcome caused by one. Microsoft's 2025 transparency
report appeared only in a search summary and I did not open it.

### 2.5 What the sources say about a company of this size

Read: [S2] [S8] [S14] [S17] [S18] [S19] [S20] [S21] [S28] [S30].

- None of the large studies reports results for companies of 30 to 300 people. McKinsey, survey July
  2024, had 42% of respondents at companies with over USD 500 million revenue. Organisations under
  that line were "more likely than others to report fully centralizing" [S20]. McKinsey, survey June
  to July 2025: nearly half of respondents at companies with more than USD 5 billion revenue had
  reached the scaling phase, against 29% at companies under USD 100 million [S21].
- The only size-split governance survey I found: Gradient Flow, sponsored by Pacific AI, published 15 Dec
  2025. Fieldwork ran 14 Feb to 29 May 2025. It drew 351 respondents recruited through two newsletters,
  industry partners and online advertising: 26% from large companies (over 5,000 staff), 41% medium (501
  to 5,000) and 32% small (500 or fewer). A role or office for AI governance existed at 59% of all
  respondents, at 36% of small companies and at 62 to 64% of larger ones [S28]. "Small" there is 500
  staff or fewer, so it also covers companies under 30 people.
- HTI's lean design: "a single accountable executive supported by a small cross-functional working
  group". In smaller organisations "the CEO may take on this role". HTI also says "There is not a
  single correct answer to these questions" [S17] [S18]. HTI is a university research centre. Its
  partners include KPMG, Gilbert + Tobin and Atlassian, and its documents cite vendor blogs for some
  centre-of-excellence claims. It shows consensus among advisers, not outcomes.
- ISO/IEC 42001 applies to "any organization, regardless of size" and allows a risk-based approach.
  AI Act Art 17(2) scales the quality management system to the provider's size [S8] [S2]. Australia
  says to adapt each practice "to fit your organisation's size" [S14].
- The Gradient Flow page (S28) has a section headed "The Ownership Problem in SMEs". It says: "Many SMEs
  initially framed AI adoption as a procurement or IT decision rather than a governance choice.
  Questions of responsibility, oversight, and risk ownership were often deferred or assumed to be
  handled by vendors." It names no study in the text I read. A web search surfaced a Business Horizons
  paper of May 2026 (Chen, Jimenez-Aranda, Islam, Gaber) whose snippet I took to be the source of this
  wording. I could not open that paper (HTTP 403 and a bot challenge), so treat the link and the study
  design as unconfirmed [S28] [S30].
- MIT CISR says "there is no proven playbook for how to mature a company's use of AI". Its survey
  (N=152 in 2025) found firms in stages 3 and 4 above their industry average on growth and profit and
  firms in stages 1 and 2 below it. That is correlation in a small sample [S24].

### 2.6 What 2025 and 2026 changed

Read: [S1] [S2] [S3] [S4] [S5] [S7] [S9] [S10] [S11] [S14] [S16] [S21] [S27].

The EU Digital Omnibus on AI. Regulation (EU) 2026/1744 was signed at Strasbourg on 8 July 2026. It
says it "shall enter into force on the third day following that of its publication in the Official
Journal" [S1]. Cooley says it was published on 24 July 2026 and entered into force on 27 July 2026 [S16]. The
consolidated EU AI Act on EUR-Lex carries the date 2026-07-27 [S2]. The Commission's Q&A says "mid-July
2026", which is looser [S3]. The page should check the publication day on the EUR-Lex landing page
before it prints one. The reason the Regulation gives for moving the high-risk dates is "the delayed
availability of standards, common specifications, and alternative guidance and the delayed
establishment of national competent authorities" [S1, recital 40].

| Date | What applies | What the operating model must carry |
|---|---|---|
| 2025-02-02, live | Art 4 AI literacy and the Art 5 prohibitions [S1] [S3] | A named person runs literacy measures for staff and contractors who use AI and keeps an internal record. A screen for prohibited practices at intake. |
| 2026-07-27 | The omnibus is in force. It rewrites Art 4, Art 17(2) and Art 99, and moves the high-risk dates [S1] | Re-date any plan written before this. |
| 2026-08-02 | General date of application. National authorities supervise and enforce, Art 4 included [S1] [S3]. Art 50 transparency applies [S2] | An intake question for every system: does it talk to people, generate content, or make deepfakes? Disclosure wording needs an owner. |
| 2026-12-02 | Art 50(2) machine-readable marking for generative systems placed on the market before 2 Aug 2026 (new Art 111(4)). New Art 5 prohibitions [S1] | An owner for marking if the company provides a generative system. |
| 2027-12-02 | Chapter III Sections 1 to 3 for Annex III high-risk systems: classification, requirements, provider duties including Art 17, deployer duties in Art 26, and Art 27 impact assessment for some deployers [S1] | Provider: a quality management system with an accountability framework. Deployer: named overseers with "competence, training and authority", monitoring, six-month logs, notice to workers and to affected people, cooperation with authorities [S2]. |
| 2028-08-02 | The same Sections for Annex I high-risk systems [S1] | The same, for product-safety systems. |
| 2030-08-02 | High-risk systems intended for public authorities that were already on the market (Art 111(2)) [S1] | Public-sector clients only. |

The Commission's Q&A gives the enforcement start as "3 August 2026" once and as "2 August 2026"
elsewhere on the same page [S3]. I use 2 August, which matches the general date of application in the
Regulation.

Provider or deployer is a per-system decision and can change. Art 25(1) makes a deployer or other
third party a provider of a high-risk system if it puts its own name or trademark on the system,
substantially modifies it, or changes the intended purpose so that a non-high-risk system becomes
high-risk [S2]. The omnibus replaces Art 25(4) with a duty for a written agreement between the
provider of a high-risk system and suppliers of models, tools or components (free and open-source
tools excepted) [S1]. A change-control step in an operating model decides when that happens. The
meshin.co glossary already has `provider-vs-deployer` (section 4).

Fines (Art 99): up to EUR 15,000,000 or 3% of worldwide annual turnover, whichever is higher, for
deployer duties under Art 26, transparency duties under Art 50 and provider duties under Art 16. Up to
EUR 35,000,000 or 7% for prohibited practices. For SMEs each fine is "whichever thereof is lower". The
omnibus extends the lower-of-two rule to small mid-cap companies (SMCs) for the 15 million and 7.5
million tiers [S2] [S1]. Art 4 is not in the Art 99(4) list. Member States set penalties under Art
99(1), and the Commission says national authorities can sanction Art 4 breaches under national law
[S3]. An SMC is an enterprise that is not an SME, employs fewer than 750 people and has turnover up to
EUR 150 million or a balance sheet up to EUR 129 million [S5]. The SME limits are in Recommendation
2003/361/EC, which I did not read.

Standards and guidance published or changed:

- EN 18286:2026, "Quality management system for EU AI Act regulatory purposes". CEN-CENELEC posted
  the news item on 2026-07-31 and calls it "the first harmonized European standard for the AI Act
  regulatory purposes". It is for organisations that provide AI systems [S4].
- ISO/IEC 42005:2025 (impact assessment guidance) and ISO/IEC 42006:2025 (certification bodies) were
  published in May and July 2025 [S9].
- NIST says the AI RMF 1.0 "is being updated" [S7]. The White House AI Action Plan of 2025-07-23
  reportedly tasked NIST with revising it. I read that in secondary summaries only, and I found no
  primary confirmation that a version 1.1 exists.
- OMB M-25-21 replaced M-24-10 on 3 Apr 2025. SR 26-2 replaced SR 11-7 on 17 Apr 2026 and put gen AI and
  agentic AI out of scope [S10] [S11].
- Australia's Guidance for AI adoption, two parts (foundations and implementation), reported as
  released 21 Oct 2025 in secondary snippets [S14] [S32].

Agentic AI. McKinsey, survey June to July 2025 (published Nov 2025): 62% of respondents say their
organisations are at least experimenting with AI agents, and 23% are scaling an agentic system
somewhere in the enterprise [S21]. Deloitte, survey Aug to Sep 2025 of 3,235 leaders (press release 21
Jan 2026): close to three-quarters plan to deploy agentic AI within two years, and "only 21% of those
companies report having a mature model for agent governance" [S27]. SR 26-2 excludes agentic AI [S11].
The omnibus text mentions agentic AI in its new Annex XIV, which lists the scope of notified-body
designation. I found no standard or regulator text that says how to assign decision rights to an AI
agent. The Australian guidance says to name a specific person accountable for every AI system [S14].

## 3. What is contested or unsettled

1. The definition. No standard defines the term. McKinsey's version covers every decision about
   people, process, technology and compliance. HTI's folds in strategy and governance. meshin.co's
   category page uses three questions. A page that states one definition as the definition is making a
   choice, and should say so.
2. Where authority should sit. IBM (centralised or hub-and-spoke scaled more), Gartner (high-maturity
   firms centralise) and McKinsey 2024 (centralise risk and compliance) lean central [S23] [S26] [S20].
   MIT NANDA leans the other way for implementation: decentralise authority, keep accountability [S25].
   The sources may be about different layers: central for policy and risk, local for finding use cases.
   No source tests that reading.
3. How strong the outcome evidence is.
   - IBM surveyed "more than 600 CAIOs" in Q1 2025 (its methodology note counts 624 professionals), so
     every respondent already has a central AI leader. IBM says that of more than 2,300 organisations it
     contacted, only 26% had a CAIO. ROI is self-reported. I did not find IBM's definition of ROI [S23].
   - McKinsey's CEO-oversight finding is the attribute most correlated with self-reported EBIT impact
     (R² 0.20 across 25 attributes). Low R², self-reported, not causal [S20].
   - Gartner scores maturity with a seven-question survey. The release does not list the questions, so I
     cannot say whether centralisation or a dedicated AI leader feeds the score [S26].
   - MIT CISR is correlational, with a small 2025 sample (N=152) [S24].
   - MIT NANDA labels itself preliminary, covers 52 interviews and 153 survey responses, uses a
     six-month observation window, and lists selection bias among its limits [S25].
   - McKinsey, IBM, Gartner and Deloitte sell consulting or technology. HTI and MIT CISR are
     member- or partner-funded.
4. Age and size of the data. McKinsey's pattern exhibit is from fieldwork in July 2024, about 26 months
   before this record. ASIC's data is as at December 2023. BoE and FCA ran their survey in 2024. None
   isolates companies of 30 to 300 people, and the main surveys skew to large firms.
5. The EU AI Act is moving.
   - The omnibus is under three months old. I read the Official Journal text, and one law-firm summary
     for the publication date [S1] [S16].
   - Commission guidelines on Arts 8 to 15 and Art 25, the SME and SMC quality-management guidelines
     and the AI Board's Art 4 recommendations are pending [S3] [S1].
   - The Commission's Q&A has no date on the page, and it contains the two enforcement dates noted
     in section 2.6 [S3].
   - EN 18286 and presumption of conformity. Art 40(1) says systems that meet harmonised standards
     "the references of which have been published in the Official Journal" are presumed to conform with
     "the requirements set out in Section 2" of Chapter III, plus certain general-purpose-model duties
     [S2]. The quality management system is Art 17, which sits in Section 3. The CEN-CENELEC item says
     the standard helps "especially Article 17" but does not say whether its reference is published in
     the Official Journal [S4]. I found no source that settles whether the presumption reaches Art 17.
     The page must not claim it without a lawyer's check.
6. NIST AI RMF is under revision [S7]. Any GOVERN subcategory cited must be dated to version 1.0.
7. ISO clause text. I confirmed clause titles only. Vendor and consultancy pages put AI roles and
   responsibilities at Annex A control A.3.2 and describe 38 controls in nine objectives. I did not read
   Annex A and do not rely on that.
8. Claims I could not verify, and the page should not print:
   - "More than 50% of businesses have adopted a centrally-led organization for gen AI" is attributed to
     McKinsey's Sep 2024 guide by a vendor blog. The guide I read does not contain it [S22].
   - "Distributed, domain-embedded teams reported higher production deployment but more governance
     incidents" was attributed to McKinsey by an AI search summary. I could not find it in the McKinsey
     documents I read.
   - IAPP reporting-line percentages (general counsel 23%, CEO 17%, CIO 14%, committees 39%) came only
     from a secondary summary, not from the IAPP page I read [S19].
   - Assembly Inc.'s thresholds and the vendor centre-of-excellence thresholds (section 2.4) [S29] [S31].
   - A "version 1.1" of the NIST framework.
9. Agentic systems. No regulator text or standard I read assigns decision rights to agents. SR 26-2
   excludes them. Deloitte says 21% have a mature governance model [S11] [S27].
10. Where governance ends and the operating model starts. HTI puts strategy inside the governance
    operating model [S18]. meshin.co's glossary defines governance narrowly as who may build or buy
    and who answers by name. That is a position the owner has to take (section 5, questions 1 to 3).

## 4. What is already on meshin.co

Checked in `site/dist/`, `site/src/data/` and `docs/SEMANTIC-CORE.md` on 2026-10-02. Nothing was edited.

Where the phrase lives now. "AI operating model" is defined in the title, description and body of
`/blog/category/operating-model` (`site/src/data/categories.mjs`). The same description sits in
`llms.txt` (line 103 of the built file). `docs/SEMANTIC-CORE.md` lists the route. In the built HTML the
phrase otherwise appears only as the site-wide navigation link to that category (one hit each in the
three pages I sampled: `/approach`, `/glossary/ai-register` and one FAQ). No `.md` sidecar for `/approach`,
the FAQs, the services or the glossary contains it. Only `site/dist/blog.md` does. There is no glossary term and no
entry in the concept register (30 concepts). So the anchor article would be the second page to define
the phrase, which collides with L51 ("one concept is defined on exactly one page"). **Flag for Main:**
decide whether the article takes the definition and the category description links to it, or the
article links to the category page and defines only patterns and decision rights. That is a placement
decision (L53) and a `gate:registers` question. I have not touched either.

What the category page already owns, so the article links and does not repeat it:

- The three questions (who chooses, who reviews, who runs).
- The choice filter: volume, a measurable outcome, a tolerable failure mode.
- Review as "a short checklist attached to the register entry, not a governance ceremony".
- Handover as a deliverable that "only counts once someone is actually watching the dashboard".
- "An engagement that does not end has usually replaced an operating model rather than built one."
- From `/blog/category/executive`: "A company of 30 to 300 people needs one named owner, one page of
  decisions, and the discipline to update both when something changes."

Existing routes to link to (all present in `site/dist/`):

| Kind | Route | What it already owns |
|---|---|---|
| Must-win pages | `/approach` | Six measures (data readiness, process fit, governance, engineering capability, adoption, handover), six steps (read what exists, name the owner, classify the data, pick one process, ship it with evals, hand it over), and the outcome "One named person owns AI risk and reports on it to the board". Updated 2026-09-23. |
| | `/blog/category/operating-model` | The definition and three questions above. |
| Categories | `/blog/category/governance`, `/blog/category/executive`, `/blog/category/agentic-architecture` | Neighbouring pillars. |
| Glossary | `/glossary/ai-governance` | Named owner per system, a sign-off step before production, map to NIST or ISO "so you have a recognised structure to point at". |
| | `/glossary/ai-register` | Inventory of every AI system with what it does, data touched, owner and risk. |
| | `/glossary/ai-management-system` | Says the Act does not require the broader system. Art 17 requires a narrower quality management system, and its depth scales with provider size. |
| | `/glossary/iso-iec-42001`, `/glossary/nist-ai-rmf`, `/glossary/eu-ai-act` | The standards and the Act (`eu-ai-act` says "in force since August 2024"). |
| | `/glossary/provider-vs-deployer`, `/glossary/human-oversight`, `/glossary/high-risk-ai-system`, `/glossary/ai-impact-assessment`, `/glossary/post-market-monitoring`, `/glossary/serious-incident-reporting`, `/glossary/technical-documentation`, `/glossary/shadow-ai` | The Act's role split and duties. Link, do not redefine. |
| | `/glossary/evals`, `/glossary/human-in-the-loop`, `/glossary/agentic-workflow`, `/glossary/data-classification` | Delivery terms. |
| Blog | `/blog/why-your-ai-pilot-never-reached-production`, `/blog/how-to-build-an-ai-system-register-in-a-week`, `/blog/ai-acceptable-use-policy-for-a-50-person-company`, `/blog/evals-in-ci-for-llm-agents` | The register post says one named person owns it after week one, with a fixed review date. |
| Services | `/services/fractional-caio-retainer`, `/services/ai-readiness-and-risk-assessment`, `/services/90-day-production-sprint` | The commercial routes. No prices on the site (L8). |
| Resources | `/resources/ai-governance-starter-kit`, `/resources/ai-readiness-scorecard`, `/resources/build-vs-buy-ai-kit`, `/resources/llm-gateway-governance-config`, `/resources/agent-evals-ci-starter` | Templates the article can point to. |
| Case study | `/case-studies/only-help-agentic-support` | The one anonymised case (L11). |
| FAQ | `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off`, `/faq/how-does-the-retainer-end`, `/faq/what-does-a-fractional-chief-ai-officer-actually-do`, `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`, `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead`, `/faq/what-size-of-company-do-you-actually-work-with`, `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`, `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`, `/faq/who-answers-customer-security-questionnaires` | Sign-off, handover, size band (30 to 300), certification. Not re-read in full for this record. |

Gaps the article can fill without colliding:

- Pattern names. A case-insensitive search of `site/src/data` for "centre of excellence", "center of
  excellence", "hub-and-spoke", "hub and spoke", "federated", "steering committee", "AI committee",
  "governance board" and "champion" returned no hits outside the operating-model category lines. No
  page defines the patterns or compares them.
- EU AI Act application dates. My search of `site/src` for the 2026, 2027 and 2028 dates, "omnibus",
  "Article 4" and "AI literacy" found none printed. The article would be the first page to print them,
  so it owns them under L51. PRD section 15 requires a primary-source recheck of any dated regulatory
  claim (article family rules, `docs/SEMANTIC-CORE.md`).
- The required-versus-recommended comparison and the decision-rights table (section 2.2 and 2.3).

## 5. What only the owner can supply

Each question stands alone. Answer in a sentence or a number. (B) means the draft cannot be written
honestly without it. (S) means the answer sharpens the draft. Where a question needs a number, give
your own number. Do not use Assembly's "15 to 20 initiatives" or any other vendor figure.

Definition and position

1. (B) Is "AI operating model" on meshin.co the same as, wider than, or narrower than "AI governance"
   as the glossary defines it? Give one sentence the page can print as the definition.
2. (B) Which page owns the definition: the new article or the category page? If the article, may the
   category description change to link to it?
3. (B) Should "AI operating model" become a glossary term and concept-register entry, or stay article
   prose only?
4. (S) Do you offer an AI strategy as a separate deliverable, fold it into the retainer, or not offer
   it? HTI says a board needs no standalone strategy document.

Decision rights in your engagements

5. (B) At a client of 30 to 300 people, who approves an AI system for production? Name the role
   (CEO, COO, CTO, business-unit head, legal, you). One person or two?
6. (B) Who signs risk acceptance, and where does the signature live (register entry, ticket, signed
   document)? Does the signer change with risk level?
7. (B) What are your risk levels, and what puts a system in each one?
8. (B) Who owns an eval set after handover? Who may change its pass threshold? Who may ship over a
   failing eval, and what must they write down?
9. (S) Does the person who builds a system ever review it? What is your rule at a client with three
   engineers?
10. (S) What are your tests for "volume", "measurable outcome" and "tolerable failure mode" in the
    category page's filter? Numbers or yes-or-no tests?
11. (S) What stops a launch? List the stop conditions on your review checklist.
12. (S) Who decides which processes get automated: a named client role, or you? What happens when two
    units want the same budget?
13. (B) At this size, do you use a standing committee, a single named executive, or neither? If a
    committee: cadence, attendees, what it decides. The glossary mentions a quarterly register review.
    Is that your cadence?
14. (S) At what client size or number of AI systems do you change the structure? Your threshold, in
    people or systems.

Patterns you actually run

15. (B) Which pattern did each past engagement use (central, hub-and-spoke, embedded, none)? Which
    can be described without naming a client, with an outcome you can show? Keep to L11: one anonymised
    case, no invented metrics.
16. (S) What do you call each pattern? Which of McKinsey's three (centralised, federated,
    decentralised) does your practice map to, if any?
17. (S) Do you place an embedded engineer or champion in client teams? Who manages and who pays?
18. (S) For a client with a data-science team or internal AI lead, how is the work split between that
    team and you?
19. (S) Name one failure you have seen that is publishable without a client name: which pattern, what
    broke, how it was found.
20. (S) May the article cite `/case-studies/only-help-agentic-support` as operating-model evidence?
    Which of its facts about ownership after handover are publishable?

Handover and the retainer boundary

21. (B) In what order do the register, policies, eval suites and runbooks transfer at handover, and who
    signs each one?
22. (S) What test shows "someone is actually watching the dashboard"? How many weeks, and what
    evidence?
23. (B) How does accountability split between you as the named officer and the client's internal owner?
    Who answers a regulator, an insurer or a security questionnaire?
24. (S) When the retainer ends, who inherits sign-off authority? Is that written down?

Regulation commitments

25. (B) Which EU AI Act dates do you plan clients against: 2 August 2026, 2 December 2026, 2 December
    2027, 2 August 2028? Do you state any of them in contracts or on the site?
26. (S) Do you assess provider versus deployer per system, and where is it recorded? Who decides when
    a client change turns a deployer into a provider (Art 25)?
27. (S) Do you run AI-literacy work (Art 4) for clients? What is your minimum, and who signs the
    internal record?

Evidence and permissions

28. (B) May the article speak from practice ("in my engagements...")? If so, how many engagements and
    over which years? Which contested points will you take a position on: central versus decentralised,
    and whether a centre of excellence makes sense below some company size?

## 6. Sources

Grades: primary means law, a standard, a regulator, an official body, or an organisation describing
itself. Secondary means a law firm, consultancy, vendor, research centre or survey summary. "How read"
says how much of the source I had in hand.

| ID | Publisher, title, date, URL | Grade, how read |
|---|---|---|
| S1 | European Parliament and Council, Regulation (EU) 2026/1744 (Digital Omnibus on AI), signed 8 Jul 2026. https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng | Primary. Full text via a reader proxy. Publication day not on the page |
| S2 | EUR-Lex, Regulation (EU) 2024/1689, consolidated version of 2026-07-27. https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng | Primary. Full text via a reader proxy (direct fetch hit a bot challenge) |
| S3 | European Commission, "AI Literacy - Questions & Answers", digital-strategy.ec.europa.eu, read 2026-10-02, page undated. https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers | Primary. Full page. Not binding guidance |
| S4 | CEN-CENELEC, "EN 18286 in the Spotlight", posted 2026-07-31. https://www.cencenelec.eu/news-events/news/2026/en-in-the-spotlight/2026-07-30-ai-quality-management/ | Primary. Full news item |
| S5 | European Commission, Recommendation (EU) 2025/1099 on small mid-cap enterprises, 21 May 2025 (OJ 28.5.2025). https://eur-lex.europa.eu/eli/reco/2025/1099/oj/eng | Primary. Full text via a reader proxy |
| S6 | NIST, AI 100-1, Artificial Intelligence Risk Management Framework 1.0, Jan 2023. https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf | Primary. Full text |
| S7 | NIST AI Resource Center, "AI RMF 1.0" page, updated 2026-06-18. https://airc.nist.gov/airmf-resources/airmf/0-ai-rmf-1-0/ | Primary. Notice that a revision is in progress |
| S8 | ISO/IEC 42001:2023, Edition 1, Dec 2023. Catalogue page https://www.iso.org/standard/42001 and publisher previews https://cdn.standards.iteh.ai/samples/81230/4c1911ebc9a641fcb6ee21aa09c28ad3/ISO-IEC-42001-2023.pdf and https://webstore.ansi.org/preview-pages/ISO/preview_ISO+IEC+42001-2023.pdf | Primary. Previews only: front matter, contents, clauses 1 to 3. Clause text beyond 3 not read |
| S9 | ISO/IEC, 42006:2025 (Jul 2025) https://www.iso.org/standard/42006 ; 42005:2025 (May 2025) https://www.iso.org/standard/42005 ; 38507:2022 (Apr 2022) https://www.iso.org/standard/56641.html | Primary. Catalogue pages only |
| S10 | US Office of Management and Budget, memorandum M-25-21, 3 Apr 2025. https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf | Primary. Full text by OCR. Binds US federal agencies only |
| S11 | Federal Reserve, OCC and FDIC, "Revised Guidance on Model Risk Management", SR 26-2, 17 Apr 2026. https://www.federalreserve.gov/supervisionreg/srletters/SR2602.pdf | Primary. Full text. Not enforceable standards |
| S12 | ASIC, Report 798, "Beware the gap: Governance arrangements in the face of AI innovation", 29 Oct 2024. https://download.asic.gov.au/media/mtllqjo0/rep-798-published-29-october-2024.pdf | Primary. Full text. 23 licensees, 624 use cases, data as at Dec 2023, "not representative" |
| S13 | Bank of England and FCA, "Artificial intelligence in UK financial services - 2024", 21 Nov 2024. https://www.bankofengland.co.uk/report/2024/artificial-intelligence-in-uk-financial-services-2024 | Primary. Full page. 118 responses |
| S14 | Australian Government National AI Centre, "Guidance for AI adoption: foundations", ai.gov.au, read 2026-10-02, page undated. https://www.ai.gov.au/staying-safe-and-responsible/essential-ai-practices/guidance-ai-adoption-foundations | Primary. Full page via a reader proxy. Implementation guidance not read |
| S15 | Microsoft, "The building blocks of Microsoft's responsible AI program", Natasha Crampton, 19 Jan 2021. https://blogs.microsoft.com/on-the-issues/2021/01/19/microsoft-responsible-ai-program/ | Primary for what Microsoft says about itself. Company blog. 2025 report not opened |
| S16 | Cooley LLP, "Digital AI Omnibus Delays Key Deadlines, Introduces New Rules", 2026-08-03. https://cdp.cooley.com/digital-ai-omnibus-delays-key-deadlines-introduces-new-rules/ | Secondary. Full article. Source of the 24 Jul 2026 publication date |
| S17 | UTS Human Technology Institute, AI Governance Snapshot 5, "Designing AI Governance Structures", Oct 2025. https://www.uts.edu.au/research/centres/human-technology-institute/projects/ai-corporate-governance-program/ai-governance-snapshot-series/contentassets/designing-ai-governance-structures.pdf | Secondary. Full text. Recommendations, not outcome data |
| S18 | UTS Human Technology Institute, AI Governance Snapshot 6, "AI Governance Operating Model", May 2026. https://www.uts.edu.au/research/centres/human-technology-institute/projects/ai-corporate-governance-program/contentassets/uts_hti-snapshot-6_ai-governance-operating-model_web-002.pdf | Secondary. Full text |
| S19 | IAPP and Credo AI, "AI Governance Profession Report 2025", 16 Apr 2025. https://iapp.org/resources/article/ai-governance-profession-report | Secondary. Summary page read. Full report is member-gated |
| S20 | McKinsey, "The state of AI: How organizations are rewiring to capture value", 12 Mar 2025 (survey 16 to 31 Jul 2024, 1,491 participants). Read as web-archive copy https://web.archive.org/web/20251229181420/https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-how-organizations-are-rewiring-to-capture-value ; original URL https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-how-organizations-are-rewiring-to-capture-value | Secondary. Archive copy, because the live page timed out. Exhibit 1 numbers read from the exhibit image |
| S21 | McKinsey, "The state of AI in 2025: Agents, innovation, and transformation", Nov 2025 (survey 25 Jun to 29 Jul 2025, 1,993 participants). Archive copy https://web.archive.org/web/20260825153100/https://www.mckinsey.com/~/media/mckinsey/business%20functions/quantumblack/our%20insights/the%20state%20of%20ai/the-state-of-ai-in-2025-vf.pdf | Secondary. Archive copy |
| S22 | McKinsey, "A data leader's operating guide to scaling gen AI", Sep 2024. Read as a third-party copy https://www.hkdca.com/wp-content/uploads/2024/09/data-leaders-operating-guide-scaling-ai-mckinsey.pdf ; original https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/a-data-leaders-operating-guide-to-scaling-gen-ai | Secondary. Consultancy. Exhibit 2 read from the page image. Examples are anonymous |
| S23 | IBM Institute for Business Value, with Dubai Future Foundation and Oxford Economics. PDF cover title "Solving the AI ROI puzzle: How Chief AI Officers cut through complexity to create new paths to value"; landing page titled "How Chief AI Officers deliver AI ROI". July 2025 (PDF copyright page). Survey in Q1 2025 of more than 600 CAIOs across 22 geographies and 21 industries (methodology note: 624 professionals). https://www.ibm.com/thought-leadership/institute-business-value/en-us/report/chief-ai-officer | Secondary. Vendor research, self-reported. Full PDF read. Figure 5 read from the page image |
| S24 | MIT Center for Information Systems Research, Research Briefing XXV-8, "Grow Enterprise AI Maturity for Bottom-Line Impact", 21 Aug 2025. https://cisr.mit.edu/publication/2025_0801_EnterpriseAIMaturityUpdate_WoernerSebastianWeillKaganer | Secondary. Academic centre, member-funded. N=152 |
| S25 | MIT NANDA, "The GenAI Divide: State of AI in Business 2025", Jul 2025, v0.1 preliminary findings. Read as a third-party copy https://cloudelligent.com/wp-content/uploads/2026/02/v0.1_State_of_AI_in_Business_2025_Report.pdf | Secondary. I did not confirm the publisher's own URL |
| S26 | Gartner, press release "Gartner Survey Finds 45% of Organizations With High Artificial Intelligence Maturity Keep Artificial Intelligence Projects Operational for at Least Three Years", 30 Jun 2025. https://www.gartner.com/en/newsroom/press-releases/2025-06-30-gartner-survey-finds-forty-five-percent-of-organizations-with-high-artificial-intelligence-maturity-keep-artificial-intelligence-projects-operational-for-at-least-three-years | Secondary. Press release. Full report is for Gartner clients |
| S27 | Deloitte AI Institute, "The State of AI in the Enterprise - 2026 AI report" (survey of 3,235 leaders in 24 countries, Aug to Sep 2025). Press release dated 21 Jan 2026 (Davos): https://www.deloitte.com/us/en/about/press-room/state-of-ai-report-2026.html . Report page: https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html | Secondary. Consultancy. Web pages read, PDF not |
| S28 | Gradient Flow (Ben Lorica), "2025 AI Governance Survey", published 15 Dec 2025, sponsored by Pacific AI, fieldwork 14 Feb to 29 May 2025. https://gradientflow.com/2025-ai-governance-survey/ | Secondary. Vendor-sponsored survey of 351 respondents recruited through two newsletters, partners and online ads. Internal inconsistency noted in section 2.3 |
| S29 | Assembly Inc., "Enterprise AI Operating Model: Hub-and-Spoke, Federated, or Centralized?", 6 Apr 2026. https://aiassemblylines.com/resources/ai-initiatives-operating-model | Secondary. Weak vendor blog. Cites no primary data for its thresholds |
| S30 | Chen, Jimenez-Aranda, Islam and Gaber, "Bridging the AI-Cybersecurity gap for SMEs: Actionable lessons from a rapid and inclusive intervention", Business Horizons, May 2026, DOI 10.1016/j.bushor.2026.05.001. https://www.sciencedirect.com/science/article/pii/S0007681326000650 | Secondary. Not opened (HTTP 403). Bibliographic data confirmed through Crossref. Its link to the Gradient Flow passage is my inference from a search snippet |
| S31 | Vendor centre-of-excellence pages: https://alicelabs.ai/en/insights/ai-center-of-excellence ; https://agility-at-scale.com/ai/people-change/ai-center-of-excellence/ ; https://resources.rework.com/libraries/ai-transformation-strategy/ai-coe-vs-embedded-model | Secondary, weak. Search snippets only. Dates not seen |
| S32 | White & Case, "Australia launches new AI guidance" (https://www.whitecase.com/insight-alert/australia-launches-new-ai-guidance) and BABL AI (https://babl.ai/australia-releases-updated-guidance-for-responsible-ai-adoption-across-all-sectors/) | Secondary. Search snippets only. Source of the 21 Oct 2025 release date and the "non-binding" description |

Not read, named so nobody assumes otherwise: the ISO/IEC 42001 clause text and Annex A; Recommendation
2003/361/EC; AI Act Articles 9, 47 and Annex III text; the Commission's pending guidelines; Microsoft's
2025 Responsible AI Transparency Report (search summary only); the Australian implementation
guidance; the full IAPP and Gartner reports.
