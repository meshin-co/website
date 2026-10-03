---
record: true
---

# 05 — Handover playbook: research for buyer prompt 15, 2026-10-02

Dated 2026-10-02. This is the research behind one planned page pair: an article and a "Handover
Playbook" resource that answer buyer prompt 15. It is a record, not an instruction. It describes
outside sources as they stood on 2026-10-02 and lists the facts only the owner can give. It holds
no page copy.

How to read it. In sections 2 and 3 every claim sits under a named source, with the publisher and a
date. Section 6 lists every source with its URL. "Primary" means a standard, a law, a regulator's
text, an official memo, a professional body's code or a published paper. Everything else is
"secondary". A line marked `[INFERENCE]` is my own reading, and no source says it. Where I could
not read a source in full, the text says so.

## 1. What the page must answer

The buyer prompt, verbatim: `how to hand over AI leadership to internal team`. It is prompt 15 of
the 30 in `docs/SEMANTIC-CORE.md` (line 314).

Where it stands today. The page that wins the prompt is the FAQ `/faq/how-does-the-retainer-end`.
Its passage is "The handover plan exists from the first month, not the last." The gap register
reads "FAQ covers it; no playbook" (`docs/SEMANTIC-CORE.md` lines 318 and 580). The planned fix is
one article plus one resource, named "Handover Playbook", cross-linked from that FAQ
(`docs/SEMANTIC-CORE.md` lines 636-638). PRD §15 row 13 (`docs/PRD.md` lines 1100-1103) gives the
category `executive`, the slug `handing-over-ai-leadership-to-an-internal-owner` and the artifact
name. The owner's master plan (`docs/sources/master-plan.mhtml`, in Russian) describes the
playbook, in my translation, as how the owner leaves and leaves a working system behind. It says
clients fear dependence and that the document removes the fear and sells the retainer.

What a buyer typing it wants `[INFERENCE]`. I found no search-intent data for this prompt. The repo
has a probe that records whether four engines cite the site (`npm run audit:geo-probe`), but it
does not record intent. From the words alone, the buyer has an outside or temporary AI lead and
must move the role to staff. Seven questions follow from that:

1. Who should take the role?
2. What must that person have before the outside lead steps back: authority, knowledge, access?
3. What exactly moves: documents, decisions, system access, vendor contacts, the right to sign?
4. In what order, and over how long?
5. How does the company know the handover worked?
6. What does the outside lead still owe afterwards, if anything?
7. What do the rules (EU AI Act, NIST AI RMF, ISO/IEC 42001) require of the people involved?

Sources give outside comparisons for all seven. They cannot give meshin.co's own answer to 1, 4,
5 and 6. Those need the owner (section 5).

## 2. State of practice, 2026

I found no standard, law or published study that sets out how to hand AI leadership to an internal
team. I looked in standards bodies, regulators, journals and practitioner writing. What exists is
four neighbouring bodies of practice: exits of interim and fractional executives, transfer of
operational ownership in engineering and in regulated finance, AI frameworks that name roles and
records, and the EU AI Act's rules on people. Only the last two are about AI. In the NIST, ISO and
AI Act text I read, none mentions a change of person. The one AI-related rule I found that does is
a US federal memo (S18). That a handover is the moment those clauses apply is my reading
`[INFERENCE]`.

### 2.1 Interim and fractional executives: how their field handles an exit

**S1. Institute of Interim Management (UK), Code of Conduct.** Page published 2022-11-08, last
modified 2026-07-21. https://iim.org.uk/resources/code-of-conduct/ A professional body's code for
its members.

- Section 4 is "Conduct on and following termination of an assignment". Members must "Agree
  formally with the Client terms for termination of the assignment". The list includes a "handover
  period to new or existing employees" and a "period of notice of termination".
- The same list names "provision of such documents to ensure business continuity and congruity"
  and "leaving sufficient contact details to enable ease of future contact".
- Members must "Conduct an exit review highlighting issues the Client needs to address and
  analysing the assignment's objectives relative to the results delivered by the Member."
- Developments from the assignment belong to the client "unless specifically stated in writing and
  agreed to by the Client prior to commencement". A confidentiality period after termination is to
  be agreed.
- The code sets no length for the handover period.

**S2. Woods, Diprose, Murphy-Diprose and Thomas, "Effective interim leadership and management:
development of a cyclical model of interim assignments".** Journal of Organizational Effectiveness:
People and Performance 7(2):173-190, June 2020. https://doi.org/10.1108/JOEPP-10-2019-0094 A
journal paper. I read the author manuscript at https://livrepository.liverpool.ac.uk/3095138/
(repository record dated 2020-07-09).

- The model has four stages: preparation, entry, delivery and exit. Delivery has three parts:
  post-entry, main delivery and pre-exit. Pre-exit is "legacy building".
- The exit stage "comprises the transferring of knowledge, competence and understanding to
  stakeholders or replacement permanent leaders in order to facilitate effectively leaving the
  organization". The paper adds: "Handover to senior management is also a key step of this stage."
- "An effective interim makes certain that their departure is well-managed and timed to ensure
  durability and sustainability of their work."
- The paper reports the client view of success as "creation of a sustainable and effective business
  state, where further interim intervention is not needed in the short- and medium-term."
- The review notes, citing Berns and Klarner (2017), that recruiting a senior executive can take
  six months or more.
- Limits, in the authors' words: "The first and most problematic gap in the evidence base on
  interim effectiveness is a lack of empirical studies." The acknowledgements say the literature
  search "was funded by the company to which the second and third authors are affiliated". The
  byline gives that company as Holdsway. I did not check what Holdsway sells.

**S3. Tim Wolfred, "Interim Executive Directors: The Power in the Middle".** Executive Transitions
Monograph Series, Volume 2, CompassPoint Nonprofit Services, copyright 2005 The Evelyn and Walter
Haas, Jr. Fund. https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf
A practitioner monograph on US nonprofits. The author served 16 times as an interim executive director.

- "A one-week overlap in the job is usually sufficient to show the administrative ropes to the new
  hire." For "the following two or three weeks" the organisation "may retain the interim to drop in
  one or two days a week to answer questions". After that the interim "might then be available by
  phone on an as-needed basis."
- "One useful practice is for the departing interim ED to draft a report on the status of the
  performance goals that had been established at the beginning of his or her tenure." It covers
  what got done, what remains and what new issues emerged. It goes to the new executive and the
  board's executive committee.
- The interim starts from "an agreement with the board that outlines a specific set of objectives".
- The interim helps announce the new leader to outside parties and suggests who on the list should
  get the first calls.
- In one case the interim saw that her improvements "would not 'stick'" unless the returning
  director supported them.

**S4. Skowron-Mielnik and Sobiecki, "Knowledge transfer in interim management projects".**
Engineering Management in Production and Services 16(1):48-64, March 2024.
https://doi.org/10.2478/emj-2024-0004 A journal paper, open access. The study ran in Poland from
2019 to 2021 across ten enterprises that used an interim manager.

- Clients and project teams scored trust, power and knowledge. Median answers on a seven-step
  agree/disagree scale, shown as percentages: trust 88% (clients) and 80% (teams), power 77% and
  68%, knowledge 69% and 72%.
- The authors write that "the score for (Knowledge) Storage proved to be the lowest" among the
  knowledge components. I could not read the per-group chart labels reliably, so I give no
  component figures.
- The authors report that the link between knowledge and trust was "more than three times higher
  for teams compared to clients". They write that the interim "must gain Power over the team at a
  level higher than that provided to them in the client's opinion".
- Limit: ten projects, one country.

**S5. Gabriel Szulanski, "Exploring internal stickiness: impediments to the transfer of best
practice within the firm".** Strategic Management Journal 17(S2):27-43, December 1996.
https://doi.org/10.1002/smj.4250171105 A journal paper. I read the abstract as indexed by
OpenAlex; the publisher page failed to load.

- It covers 271 observations of 122 best-practice transfers in eight companies. "Contrary to
  conventional wisdom that blames primarily motivational factors, the study findings show the major
  barriers to internal knowledge transfer to be knowledge-related factors such as the recipient's
  lack of absorptive capacity, causal ambiguity, and an arduous relationship between the source
  and the recipient."
- The paper is not about interims or AI, and it is 30 years old.

**S6. CE Interim, "Interim Manager Exit Strategy and Handover Explained".** No date on the page.
https://ceinterim.com/interim-manager-exit-strategy-and-handover-explained/ Secondary: an interim
provider's marketing page.

- It names three causes of failed handovers: changes made without enough involvement of the internal
  team, knowledge transfer treated as a final step, and over-reliance on the interim as the central
  decision maker, which creates dependency.
- It separates handover from transition. Transition "focuses on ensuring that the organisation is
  already operating independently before the interim manager leaves." Done well, "the final
  handover becomes a confirmation rather than a critical moment."

**S7. Fractionus, "How to Offboard a Fractional Executive and Keep the Knowledge".** Published
2026-05-26 as shown on the page (its data reads 2026-05-25T22:00Z).
https://fractionus.com/blog/fractional-executive-offboarding
Secondary: a marketplace that sells fractional executives. The numbers are one vendor's opinion.

- Four layers of knowledge to capture: deliverables, decisions and reasoning, in-progress work
  (status, owner, next action) and institutional context.
- Offboarding should begin "at least four weeks before the final day", and six to eight weeks for
  longer or complex work.
- Access should be revoked "in a single, coordinated process on or before the final day". "Do not
  rely on the executive to remove their own access." Completion is confirmed in writing.
- Optional advice after exit: "two to four hours of advisory time for 30 days after exit" in the
  checklist, and "two to four hours per month for 30 to 60 days" in the FAQ. The page disagrees
  with itself.
- It suggests asking the successor at the 30-day mark what they wish they had known on day one.

**S8. Esya, "Evals, runbook and handover: what must ship with an AI workflow".** Published
2026-08-29, modified 2026-08-30. https://esya.studio/notes/ai-evals-runbook-handover Secondary: a UK
studio whose site says "We build AI inside your business, until it ships", so it sells related
work. Read it as a peer's view.

- "Repository access is necessary and incomplete. The receiving team needs the route to deploy,
  controlled access to required systems, telemetry, the eval harness, the runbook, incident
  authority and practised knowledge."
- Its acceptance test: the receiving team "have practised the response and can make the next change
  without waiting for the delivery team to return." "A folder of documents can be complete while the
  handover is not."
- Its checklist pairs each area with a promise that is not enough. For operation: "Contact the
  builder." For capability: "Documentation has been shared." For continuity: "Support remains
  available."
- Its own limit: the bundle "is Esya's operating contract". None of the sources it cites "defines
  this exact three-part pack".

### 2.2 Ownership transfer in engineering and regulated finance

**S9. Google, "Site Reliability Engineering", chapter 32, "The Evolving SRE Engagement Model".**
Copyright 2017 Google, Inc., published by O'Reilly Media, CC BY-NC-ND 4.0.
https://sre.google/sre-book/evolving-sre-engagement-model/ Primary: the operator's own account.

- A production readiness review "is considered a prerequisite for an SRE team to accept
  responsibility for managing the production aspects of a service." So the receiving team sets a
  bar before it takes ownership `[INFERENCE]`.
- The phases are engagement, analysis, improvements and refactoring, training, onboarding and
  continuous improvement.
- Training is led by the reviewers who ran the review. It can include "Design overviews", "Deep
  dives on various request flows", "A description of the production setup" and "Hands-on exercises
  for various aspects of system operations."
- Onboarding "involves a progressive transfer of responsibilities and ownership of various
  production aspects of the service, including parts of operations, the change management process,
  access rights, and so forth." The development team "must be available to back up and advise the
  SRE team for a period of time as it settles".
- At Google's scale, onboarding "required two or three SREs and typically lasted two or three
  quarters". For services built on its later frameworks it was "usually accomplished by a single
  SRE during one quarter".

**S10. UK Financial Conduct Authority, Handbook SYSC 25.9, "Handover procedures and material".**
Last updated 2021-01-01; the rules took effect 2018-12-10. https://handbook.fca.org.uk/handbook/sysc25/sysc25s9
Primary: regulator text. It binds UK firms under the Senior Managers regime. For meshin.co's
clients it is an analogy only.

- 25.9.4R: a firm must take "all reasonable steps" so a manager taking over a role has, when they
  start, "all information and material that a person ... could reasonably expect to have to perform
  those responsibilities ... effectively".
- 25.9.5R: the firm must have a policy and "make and maintain adequate records of the steps taken".
- 25.9.6G: the material should include "unresolved or possible breaches" and unresolved concerns
  raised by regulators.
- 25.9.7G: it "should be practical and helpful and not just a record", should "include an assessment
  of what issues should be prioritised" and should "include judgement and opinion, not just facts
  and figures".
- 25.9.8G: the firm "should have arrangements for an orderly transition" and ensure the predecessor
  contributes their opinions. A "handover certificate" is one way; the FCA accepts it is sometimes
  impractical.

**S11. Starmer et al., "Changes in medical errors after implementation of a handoff program".** New
England Journal of Medicine 371(19):1803-1812, 2014-11-06.
https://pubmed.ncbi.nlm.nih.gov/25372088/ A journal paper; I read the abstract.

- A prospective study in nine hospitals of a resident handoff program: a mnemonic for oral and
  written handoffs, training, a faculty development and observation program and a sustainability
  campaign.
- Across 10,740 admissions the medical-error rate fell 23% (24.5 to 18.8 per 100 admissions) and
  preventable adverse events fell 30% (4.7 to 3.3). The duration of oral handoffs did not change
  significantly (2.4 and 2.5 minutes per patient). Error reductions were significant at six of nine
  sites.
- The authors write that the program "was associated with" these reductions.

### 2.3 AI frameworks: what they say about roles, records and continuity

**S12. NIST, "Artificial Intelligence Risk Management Framework (AI RMF 1.0)", NIST AI 100-1.**
Released 2023-01-26. https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf Core text read at
https://airc.nist.gov/airmf-resources/airmf/5-sec-core/ Primary. Voluntary.

- GOVERN 2: "Accountability structures are in place so that the appropriate teams and individuals
  are empowered, responsible, and trained for mapping, measuring, and managing AI risks."
- GOVERN 2.1: "Roles and responsibilities and lines of communication related to mapping,
  measuring, and managing AI risks are documented and are clear to individuals and teams
  throughout the organization."
- GOVERN 2.2: personnel and partners receive AI risk training "to enable them to perform their
  duties and responsibilities".
- GOVERN 2.3: "Executive leadership of the organization takes responsibility for decisions about
  risks associated with AI system development and deployment."
- GOVERN 1.6: "Mechanisms are in place to inventory AI systems". GOVERN 1.7: "Processes and
  procedures are in place for decommissioning and phasing out AI systems safely".
- MANAGE 4.1: post-deployment monitoring plans are implemented, including "incident response,
  recovery, and change management".

**S13. NIST, AI Risk Management Framework page.** Page last modified 2026-08-13.
https://www.nist.gov/itl/ai-risk-management-framework Primary.

- "The AI RMF 1.0 is being revised as part of the White House AI Action Plan." The page links no
  revised text. On 2026-04-07 NIST released a concept note for a critical-infrastructure profile.

**S14. NIST AI Resource Center, AI RMF Playbook, GOVERN section.** Page updated 2026-06-18.
https://airc.nist.gov/airmf-resources/playbook/govern/ and
https://airc.nist.gov/airmf-resources/playbook/ Primary.

- The Playbook "is neither a checklist nor set of steps to be followed in its entirety", and its
  suggestions "are voluntary". It says it will be updated after the RMF revision.
- For GOVERN 2.1 it suggests documenting: "To what extent has the entity clarified the roles,
  responsibilities, and delegated authorities to relevant stakeholders?" and "Who is ultimately
  responsible for the decisions of the AI and is this person aware of the intended uses and
  limitations of the analytic?"
- It suggests policies that "separate management of AI system development functions from AI system
  testing functions, to enable independent course-correction of AI systems."
- For GOVERN 1.7 it lists "usernames and passwords" among the artifacts to preserve for a
  decommissioned system. It also asks who receives concerns and whether they "have authority to
  modify, limit, or stop the use of the AI".

**S15 to S17. ISO/IEC 42001:2023 and the shared management-system text.**

- S15, ISO catalogue page, read 2026-10-02, https://www.iso.org/standard/42001 Primary. Edition 1,
  published 2023-12-18, 51 pages, CHF 225. It is for "Organizations of any size". The page shows no
  amendment, review or revision stage.
- S16, ISO's free sample as hosted by iTeh, https://cdn.standards.iteh.ai/samples/81230/4c1911ebc9a641fcb6ee21aa09c28ad3/ISO-IEC-42001-2023.pdf
  Primary. I could read only the contents and clauses 1 to 4.4. The contents list 5.3 "Roles,
  responsibilities and authorities", 6.3 "Planning of changes", 7.2 "Competence" and 7.5
  "Documented information". Annexes A and B are marked normative. The management system belongs to
  "the organization" (definition 3.1), so the duties seem to fall on the organisation and top
  management, not on a named person `[INFERENCE from the definitions]`. I could not read the full
  text, which is paid, so I cannot quote 42001's own wording of those clauses.
- S17, ISO/IEC harmonized structure for management system standards, document approved 2025-07-30.
  https://www.iso.org/home.isoDocumentsDownload.do?t=2EVmNRpfMEK8NcTL_uoAJceDlxYmmqpQWNk3r1MeLNWCXk6i10vZ-R5FEjIK-UOe
  Primary. This is the 2025 text; I did not diff it against 42001:2023. 5.3: "Top management shall
  ensure that the responsibilities and authorities for relevant roles are assigned and
  communicated within the organization." 6.3: "the changes shall be carried out in a planned
  manner." 7.2: "Appropriate documented information shall be available as evidence of
  competence". Its note says applicable actions can include training, mentoring, re-assignment and
  "hiring or contracting of competent persons".

**S18. US Office of Management and Budget, memorandum M-25-21, "Accelerating Federal Use of AI
through Innovation, Governance, and Public Trust".** Dated 2025-04-03.
https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf
Primary. It binds US federal agencies only, so it is an analogy. I read the text I extracted from
the PDF, and I did not check for later revisions.

- It is the only official text I found that requires an organisation to have a "Chief AI Officer".
  Within 60 days of the memo, the head of each agency "must retain or designate a Chief AI Officer
  (CAIO)".
- Agency heads "may choose to designate an existing official, such as a Chief Information Officer,
  Chief Data Officer, Chief Technology Officer, or similar official ... provided that individual has
  significant expertise in AI."
- CAIOs "must have the necessary authority to perform the responsibilities in this section and must
  be positioned highly enough to engage regularly with other agency leadership".
- "Agencies must notify OMB within 30 days when the designated CAIO changes or the position is
  vacant." This is the one rule I found that treats a change of AI officer as a reportable event.
- An agency CAIO "may waive one or more of the requirements" for a specific high-impact AI
  application after a written determination. The CAIO "must certify the ongoing validity of each
  waiver on an annual basis", and "The CAIO's responsibility under this paragraph shall not be
  delegated down to other officials."

### 2.4 The EU AI Act: what it asks of people and records

**S19. Regulation (EU) 2024/1689 (AI Act), of 2024-06-13, article pages of the Commission's AI Act
Service Desk, read 2026-10-02.** https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26 and
the same address for articles 3, 14, 17, 18, 19 and 72. Primary. Every page carries a banner: "This
provision has been amended by the Digital Omnibus on AI. The text displayed on this page has not yet
been updated to reflect those amendments." It appeared on all 13 pages I fetched, so it is a general
banner, not proof that a given article changed. S20 says what changed.

- Article 3(4): a deployer is "a natural or legal person, public authority, agency or other body
  using an AI system under its authority". The role attaches to the body that uses the system, not
  to an officer or adviser. So an adviser's departure does not move the legal duty `[INFERENCE]`.
- Article 26(2): "Deployers shall assign human oversight to natural persons who have the necessary
  competence, training and authority, as well as the necessary support." This is for high-risk
  systems only.
- Article 14(4): the system must let those persons "decide, in any particular situation, not to use
  the high-risk AI system or to otherwise disregard, override or reverse the output", and
  "intervene in the operation of the high-risk AI system or interrupt the system through a 'stop'
  button or a similar procedure".
- Article 26(5): deployers monitor operation. Where they have reason to think the system presents a
  risk, they inform the provider or distributor and the market surveillance authority "without
  undue delay" and "shall suspend the use of that system". For a serious incident they
  "immediately inform first the provider", then the importer or distributor and the authorities.
- Article 26(6): deployers keep the logs the system generates, "to the extent such logs are under
  their control", for "at least six months". Who holds the logs after an adviser leaves is a
  handover question `[INFERENCE]`.
- Provider-only duties: Article 17(1)(m) puts "an accountability framework setting out the
  responsibilities of the management and other staff" in the provider's quality system. Article
  18(1) keeps provider documentation for "10 years". Article 19(1) keeps provider logs for "at
  least six months". Article 72 sets provider post-market monitoring. These matter only if the
  client is a provider.

**S20. Regulation (EU) 2026/1744, "Digital Omnibus on AI".** Done at Strasbourg 2026-07-08;
published OJ L 2026-07-24; it enters into force "on the third day following that of its
publication", which I compute as 2026-07-27. http://data.europa.eu/eli/reg/2026/1744/oj I read the
text at https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202601744 through a
web-to-text converter. Primary.

- Article 4 is replaced. Providers and deployers "shall take measures to support the development of
  AI literacy of their staff and other persons dealing with the operation and use of AI systems on
  their behalf". "This obligation does not require providers or deployers to guarantee any specific
  level of AI literacy of any individual." The Board "shall adopt recommendations" (Article 4(3)).
- Article 113 as amended: Chapter III, Sections 1 to 3, which contain Article 26, apply from
  2027-12-02 for systems high-risk under Annex III and from 2028-08-02 for those under Annex I.
  Article 111(2) as replaced: most high-risk systems already on the market before Chapter III
  applies are covered only if their design changes significantly, but those intended for use by
  public authorities must comply by 2030-08-02 in any case.
- Article 17(2) is replaced: implementing the quality-system aspects "shall be proportionate to the
  size of the provider's organisation". Article 72(3) is replaced: the post-market monitoring plan
  is "part of the technical documentation referred to in Annex IV", and the Commission "shall adopt
  guidance, including a template, on the post-market monitoring plan by 2 September 2027".
- In the enacting terms I read, I found no amendment to Articles 14, 18, 19, 26 or 73. The converter
  may have dropped text, so check the Official Journal before you state that they are unchanged.

**S21. European Commission, "AI Literacy - Questions & Answers".** Page shows "Last update 27 July
2026". https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers Primary: the
Commission's own guidance, not binding law.

- "Persons dealing with the operation and use of AI systems on behalf of providers/deployers"
  means "not employees, but persons broadly under the organisational remit. It could be, for
  example, a contractor, a service provider, a client."
- Article 4 "does not entail an obligation to measure the knowledge of AI of employees". "There is
  no need for a certificate. Organisations can keep an internal record of trainings".
- On whether an AI officer is needed: "No, no specific governance structure is mandated to comply
  with article 4 of the AI Act."
- "for those who deploy high-risk AI systems, the obligation to ensure that their staff is trained
  to ensure human oversight remains in place."
- It says "simply relying on the AI systems' instructions for use or asking the staff to read them
  might be ineffective". That is about literacy training, not handover documents.
- National market surveillance authorities enforce Article 4. Fines "might ... be more likely if
  there is proof of an incident due to lack of appropriate training and guidance".

### 2.5 Competence for the role: nothing found

I found no competence framework for "chief AI officer" or "head of AI" from a standards body or a
regulator. OMB (S18) is the closest, and it sets seniority, authority and expertise, not skills.

**S22. IAPP, AIGP certification page.** Undated. https://iapp.org/certify/aigp Primary for what the
credential claims. It "demonstrates competency in AI development, the ability to conduct ethical AI
deployment, and the ability to utilize best practices in AI management". It is an exam on
knowledge, not a test of readiness for a role. I could not read the body-of-knowledge PDF (HTTP 403).

**S23. Bock and von der Oelsnitz, "Leadership-competences in the era of artificial intelligence -
a structured review".** Strategy & Leadership 53(3):235-255, 2025-02-28.
https://doi.org/10.1108/SL-09-2024-0100 Abstract only. A review of 730 articles found 24
competencies: 12 personality traits and 12 skills. It is about managers who use AI, not about AI
governance owners.

**S24. Hossain, Fernando and Akter, "Digital Leadership: Towards a Dynamic Managerial Capability
Perspective of Artificial Intelligence-Driven Leader Capabilities".** Journal of Leadership &
Organizational Studies 32(2):189-208, 2025-02-16. https://doi.org/10.1177/15480518251319624
Abstract only. 20 interviews were used to build a capability framework. The abstract reports no
test of it as a readiness check.

### 2.6 What the sources ask a handover to contain

| Item                                                  | Who asks for it                                                                      | Source        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------- |
| Status of work in progress and open issues            | FCA; CompassPoint; Fractionus                                                        | S10, S3, S7   |
| Decisions and the reasoning, not just facts           | FCA ("judgement and opinion"); Fractionus                                            | S10, S7       |
| Inventory of AI systems                               | NIST GOVERN 1.6                                                                      | S12           |
| Roles and authority documented and clear              | NIST GOVERN 2.1; shared ISO text 5.3                                                 | S12, S17      |
| Training or competence, with evidence                 | NIST GOVERN 2.2; ISO 7.2; AI Act Art 26(2)                                           | S12, S17, S19 |
| Access and credentials moved in one controlled step   | Google SRE; Fractionus; NIST Playbook 1.7                                            | S9, S7, S14   |
| Runbook, evals and rollback practised by the receiver | Esya; Google SRE training                                                            | S8, S9        |
| Monitoring, logs and incident duty carried on         | AI Act Art 26(5)-(6); NIST MANAGE 4.1                                                | S19, S12      |
| Exit review or goals-status report                    | IIM; CompassPoint                                                                    | S1, S3        |
| Adviser reachable for a period afterwards             | Google SRE; CompassPoint; Fractionus                                                 | S9, S3, S7    |
| Check with the successor after 30 days                | Fractionus                                                                           | S7            |
| Tell outside parties about the change                 | CompassPoint (letter to funders and peers); OMB (agencies notify OMB within 30 days) | S3, S18       |

Items with no outside source behind them are meshin.co's own, and the owner must supply them.

## 3. What is contested or unsettled

1. **No standard for the role.** No competence framework exists for the person who takes over (see
   2.5). The only credential I read is a knowledge exam (S22). The two academic frameworks are
   about managers in general or built from 20 interviews (S23, S24). A page cannot say the
   successor "passes" an external test. The readiness test has to be the owner's own.
2. **The evidence is thin and mostly written by sellers.** The authors of the main interim model
   say the evidence base lacks empirical studies (S2). The one study of knowledge transfer has ten
   projects in Poland (S4). Most checklists come from firms that sell interim or fractional staff
   (S6, S7, S8). I found no study that links any handover practice to later success with AI.
3. **Durations disagree, and none is about AI.**

   | Source | What it says                                                                                 | Setting               |
   | ------ | -------------------------------------------------------------------------------------------- | --------------------- |
   | S3     | One week of overlap, then two or three weeks of drop-ins                                     | US nonprofit director |
   | S7     | Start at least four weeks out, six to eight if complex; notice "typically two to four weeks" | Fractional executives |
   | S9     | Two or three quarters with two or three people; one person for one quarter later             | Google services       |
   | S2     | Hiring a senior successor can take six months or more                                        | Interim managers      |

   S7 also gives two different post-exit advice windows (30 days; 30 to 60 days). The page should
   state no duration until the owner gives one.

4. **Who the successor should be.** Signals conflict. S18 lets an agency name an existing
   CIO, CDO or CTO if they have significant AI expertise. S14 suggests separating development from
   testing. On meshin.co, the FAQ says a company lacks "someone accountable for AI outside the team
   itself", while the blog says the owner should have written an eval case and watched a rollback
   rehearsal (section 4). Those point to a risk owner and a technical owner. Whether that is one
   person or two is the owner's call.
5. **The AI Act does not require an AI owner or officer.** It requires deployers of high-risk
   systems to assign oversight to persons with competence, training, authority and support (S19).
   Those duties start on 2027-12-02 for Annex III systems and 2028-08-02 for Annex I (S20). The
   Commission says no governance structure is mandated for Article 4 (S21). Article 4 was replaced
   in July 2026 (S20). The page must not say the Act requires a named AI owner.
6. **The Commission's own dates are loose.** Its Q&A says enforcement of Article 4 starts "2 August
   2026" in one answer and "3 August 2026" in another. It says the omnibus entered into force in
   "mid-July 2026", while the Official Journal text implies 2026-07-27 (S21, S20). I found no
   adopted Board recommendation under Article 4(3); the Q&A still says the Board "will adopt" them.
7. **The frameworks are moving or paywalled.** NIST says the RMF is being revised and the Playbook
   will follow (S13, S14). ISO shows one edition, 2023, and no revision stage (S15), but I could not
   read the full text, and the shared-text wording I quote is the 2025 version (S17). Do not quote
   42001's clause wording. Other web sources call all of Annexes A to D informative; the standard's
   own contents mark A and B normative (S16). Do not repeat that claim.
8. **Every analogy has a limit.**
   - SECI (Nonaka, S25) describes how knowledge is created by turning tacit into explicit
     knowledge. Gourlay (S26) argues that "none are supported by evidence that cannot be explained
     more simply" and that the framework "omits inherently tacit knowledge". SECI is not a study of
     handovers. If used, treat it as vocabulary, not as proof that a handover works.
   - I-PASS (S11) is a bundle of changes to hospital shift handoffs. The result is an association,
     and only six of nine sites showed a significant drop. It does not show that a structured
     handover works for AI leadership.
   - FCA SYSC 25.9 (S10) binds UK regulated firms. Google SRE (S9) is a specialist team that can
     refuse a service, which one internal owner cannot. CompassPoint (S3) is US nonprofits.
     Szulanski (S5) is not about interims. Say "analogy" wherever these appear.
9. **Fresh guidance may not hold.** Less than a year old: the omnibus (2026-07), the Commission Q&A
   (2026-07-27), the NIST revision notice (2026-08-13), the Playbook page (2026-06-18), Fractionus
   (2026-05) and Esya (2026-08). OMB M-25-21 is 18 months old and I did not check for revisions.
10. **Not found.** An outcome study of AI-leadership handovers. A private-sector rule on changing an
    AI officer (only OMB for US agencies). An adopted Board recommendation under Article 4(3).

## 4. What is already on meshin.co

Search covered the built site (`site/dist`, one `.md` sidecar per route), the content collections
under `site/src/data/` and the planning docs. Nine built pages use the word "handover": home,
`/about`, `/approach`, `/pricing`, `/privacy`, `/security`, the retainer page, the retainer FAQ and
the pilot blog (ten if "hand it over" and similar phrases count). None gives a typical retainer
length, an overlap, support after the last day, a handover fee or a completed handover. The FAQ and
`/approach` use "two years" as the line past which the design failed.

### 4.1 Routes the page must link to, and what each already owns

| Route (date shown)                                                            | What it already says                                                                                                                                                                                                                                                                                                                                                                                                 | The new page                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `/faq/how-does-the-retainer-end` (2026-09-15)                                 | "With a named internal owner in place, not a fading call. The decisions that got made are written down, not quietly dropped. The handover plan exists from the first month, not the last. A retainer running past two years would mean the design was wrong; the plan is written to end well before that."                                                                                                           | Link both ways. Do not rephrase the promise.            |
| `/services/fractional-caio-retainer` (2026-10-02)                             | "How it ends: With an internal owner and written decisions." Process step 4: "a date when the retainer ends". Schedule: "A named owner and a closing date". FAQ: "If you still need me once that handover is done, I did it wrong." Not for: "You already have a full-time AI leader in place".                                                                                                                      | Link.                                                   |
| `/approach` (2026-09-23)                                                      | Sixth signal: "I close every engagement by naming an internal owner and writing down the decisions. Needing me two years later means I failed at this one." "The sixth, handover, is the hardest one, because nothing forces it once a system is live." Step 2 "Name the owner". Step 6 "Hand it over". Engineering signal: "I test whether your engineers can already roll back a bad model without waiting on me." | Link. Owns the six-step order.                          |
| `/` (home)                                                                    | Handover signal: "A named owner and a fixed end date."                                                                                                                                                                                                                                                                                                                                                               | Do not repeat "fixed end date" until question 1.        |
| `/pricing` (2026-09-23)                                                       | "The retainer is monthly, cancellable with thirty days of notice, and ends in a handover." Fee shape only (L8).                                                                                                                                                                                                                                                                                                      | Link. Publish no price.                                 |
| `/security` (2026-09-23), `/privacy` (2026-09-23)                             | "I ask for a named account in your own systems ... so you hold the off-switch and revoke it at handover." "My own working notes are deleted at handover, and the handover lists every credential I held so revoking them is a checklist rather than a memory."                                                                                                                                                       | Link. Owns credential revocation.                       |
| `/resources/ai-governance-starter-kit` (2026-10-02)                           | Four documents. "Who signs what": register, "The named AI risk owner keeps it current"; policy, every employee; classification, the owner with the data owner; vendor questionnaire, procurement. "It is not a compliance certificate, and it is not legal advice."                                                                                                                                                  | Link. Do not rebuild the table.                         |
| `/blog/why-your-ai-pilot-never-reached-production` (2026-10-02)               | Owner: "one name attached to the outcome, with the budget and the authority to pause the system if it misbehaves." "The internal owner should have written at least one eval case and watched the rollback rehearsal ... A handover document given to someone who was not part of the build is a liability with a due date, not a transfer of knowledge."                                                            | Link. Owns the readiness idea.                          |
| `/resources/ai-readiness-scorecard` (2026-10-02)                              | People axis: 0 "Only the original builder understands any AI system in use"; 1 "One other person has read the code"; 2 "A second person has changed it and shipped"; 3 "Ownership is written down and handed over on a schedule".                                                                                                                                                                                    | Use as the existing ladder. Do not invent a second one. |
| `/blog/how-to-build-an-ai-system-register-in-a-week`                          | "a person who can answer for the system, not a distribution list nobody reads"; "one named owner and a fixed date to recheck every row".                                                                                                                                                                                                                                                                             | Link.                                                   |
| `/services/90-day-production-sprint`                                          | "an engineer on your team who has built it with me and can change it without me."                                                                                                                                                                                                                                                                                                                                    | Link.                                                   |
| `/blog/category/operating-model` (hub text in `site/src/data/categories.mjs`) | "Handover is a deliverable, and it only counts once someone is actually watching the dashboard." "You need the decisions made properly once, written down, and handed to someone inside the company." "An engagement that does not end has usually replaced an operating model rather than built one."                                                                                                               | Link. Match this bar; do not restate it.                |

### 4.2 Other pages to link, not repeat

- `/faq/who-owns-the-frameworks-templates-and-playbooks-built-during-the-engagement`: "Everything
  written for your business belongs to you ... What stays mine is the method".
- `/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off`: "Under the Retainer, I review every
  entry and sign it as the named officer. Your organisation still holds final accountability".
- `/faq/who-answers-customer-security-questionnaires`: "I do, as the named officer on record."
- `/faq/what-if-we-already-have-a-data-science-team-or-an-internal-ai-lead`: "what it lacks is
  someone accountable for AI outside the team itself."
- `/faq/why-hire-a-fractional-officer-instead-of-a-full-time-head-of-ai`
- `/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require`: "None of the three sets a
  headcount threshold."
- `/faq/can-you-get-us-iso-iec-42001-certified-or-just-a-working-system`: "I build a working
  system, not the certification itself." `/now` says the ISO/IEC 42001 study is "not certified".
- Glossary terms to link rather than define (each checked to exist in `site/dist/glossary`): `ai-register`,
  `human-oversight`, `serious-incident-reporting`, `post-market-monitoring`,
  `technical-documentation`, `provider-vs-deployer`, `high-risk-ai-system`,
  `ai-management-system`, `iso-iec-42001`, `nist-ai-rmf`, `eu-ai-act`, `evals`, `observability`,
  `llm-gateway`, `sub-processor`, `model-card`, `model-provenance`, `shadow-ai`,
  `data-classification`, `ai-impact-assessment`, `dpia`, `human-in-the-loop`.

### 4.3 Definitions the page must not duplicate (L51)

- No registered concept is "handover", "owner" or "AI officer" (`docs/SEMANTIC-CORE.md`, entity and
  concept registers; no glossary term exists).
- "Owner" is already described in four places in different words. `/approach` step 2: "One person
  with the authority to say no, accountable for AI risk, on the org chart." The pilot blog: "one
  name attached to the outcome, with the budget and the authority to pause the system". The
  governance category hub (`site/src/data/categories.mjs`): "one person whose job description says
  they own AI risk and who has the authority to stop a launch." The executive hub: "A company of 30
  to 300 people needs one named owner, one page of decisions". The page must pick one and link to
  it, or the owner must choose which page owns the concept. It must not add a fifth wording.
- The handover promise lives in the FAQ and `/approach`. Credential revocation lives in `/security`.

### 4.4 Placement and gaps

- Blog categories are `governance`, `agentic-architecture`, `operating-model` and `executive`
  (`/blog/category/<name>`). PRD §15 row 13 assigns this article to `executive`, titled "AI for
  boards" in `site/src/data/categories.mjs`. The `operating-model` hub is described as "the decision
  structure that moves AI work from a pilot nobody owns to a process a team runs" and already holds
  the handover lines in 4.1. L53 says a new text joins an existing route family, so the placement
  belongs to Main and the owner.
- `/resources` holds five artifacts. The new resource is a sixth. `docs/COPY-CHECKLIST.md` row 6.2
  records that all five `github.com/meshin-co/<slug>` URLs returned HTTP 404 on 2026-10-02. Row 6.3
  (licence) reads "MIT assumed" and row 6.4 (version) reads "v0.1"; both Answer cells are empty.
- The only case study, `/case-studies/only-help-agentic-support`, is the owner's own product
  (`docs/COPY-CHECKLIST.md` row 2.1, confirmed 2026-09-12). No client handover is evidenced.
- SECI appears in the PRD's `/approach` spec (`docs/PRD.md` line 618), where the handover section
  lists "SECI" and "who becomes owner when I leave" (my translation from Russian). The master plan
  (`docs/sources/master-plan.mhtml`, Russian) cites "SECI (Nonaka & Takeuchi)" for transferring
  knowledge into the client. No built page mentions SECI, Nonaka or Takeuchi. I checked only
  Nonaka's 1994 paper, which has one author.

### 4.5 Live wording that needs the owner before the page repeats or sharpens it

| Wording                                                               | Where               | Open question |
| --------------------------------------------------------------------- | ------------------- | ------------- |
| "a fixed end date", "a closing date", "a date when the retainer ends" | home; retainer page | Question 1    |
| "two years" as the failure line                                       | FAQ; `/approach`    | Question 2    |
| "thirty days of notice"                                               | `/pricing`          | Question 3    |
| "a named internal owner" or "internal CAIO"                           | site; master plan   | Question 26   |

`docs/COPY-CHECKLIST.md` rows 3.5 (notice) and 3.7 (typical length) have an empty Answer column
today. Row 3.7 records that stated durations were removed on 2026-09-15 as an unconfirmed claim.

## 5. What only the owner can supply

Each item is a question the owner can answer directly. "None" is a valid answer to any of them.

**A. Promises already live**

1. The home page says "a fixed end date". The retainer page says "a date when the retainer ends".
   `/pricing` says "monthly, cancellable with thirty days of notice". Is the end date written into
   the statement of work at the start, set in the month-one plan, or set later? Who can move it?
2. The FAQ and `/approach` use two years as the failure line. Do you stand behind it? What is the
   typical retainer length in months? Row 3.7 is empty.
3. What is delivered inside the thirty-day notice window? Is thirty days confirmed (row 3.5)?
4. "The handover plan exists from the first month." What exists in month one: an outline, a named
   candidate, a dated checklist? Where is it kept, and who sees it?

**B. Sequence and timing** 5. List your stages from month one to the last day, in order, with the length of each. 6. Is there an overlap when you and the internal owner are both active? How many days a week, for
how many weeks? 7. Do you offer anything after the last day: calls, questions, reviews? If yes, state hours,
duration and fee shape (no numbers, L8). 8. Do you check in after handover at 30, 60 or 90 days? The site promises none. 9. Does the handover include an exit review or a goals-status report (S1, S3)? Who receives it:
the CEO, the board?

**C. The successor and the readiness test** 10. Who is the usual internal owner: engineering lead, COO, security lead, head of data, a new
hire? What do you do when the person does not exist yet? 11. Is the owner one person or two: a risk owner outside the technical team, and a technical owner
who writes evals (section 3, item 4)? 12. What must the successor show before you step back? The blog gives two items: wrote one eval
case, watched a rollback rehearsal. `/approach` tests whether engineers "can already roll back a
bad model without waiting on me". List every item, who judges, and what counts as a pass. Is it
the scorecard People axis at level 3? 13. If the successor is not ready on the planned date, do you extend (at what fee shape), hand over
anyway, or decline to close? 14. Who trains the successor, with what, and how many retainer days does that take? 15. What will you refuse to do: recruit or interview the successor, act as legal adviser, stay the
named officer past the date?

**D. Sign-off and accountability** 16. After handover, who signs each of these: register entries, security questionnaire answers,
risk acceptances, policy exceptions, vendor approvals, eval-threshold changes, rollback calls,
serious-incident calls? Today you sign as "the named officer". 17. On what date does "named officer on record" pass to the internal owner, and who tells the
customers whose questionnaires carry your name? 18. How do you record a risk acceptance today: fields, template, who may accept, review date? 19. For a client that is an EU deployer of a high-risk system, do you name the oversight person
(Article 26(2)) in the handover, or leave it to the client's counsel? What may the page say,
given "not legal advice"?

**E. Access, vendors and records** 20. What is on your credential list beyond the `/security` sentence? Who revokes, and how is
revocation confirmed in writing? 21. Do you hold any vendor or sub-processor contact personally? What review cadence and renewal
calendar passes to the owner? 22. Where do evals, runbooks, decisions and the register live: client repository, wiki, drive? How
is the successor added to the repository and CI? 23. Which model inventory fields do you use, and what do you add at handover (model version, eval
suite reference, rollback reference, last review date)? 24. Who keeps logs and traces after handover, and for how long?

**F. Evidence and wording** 25. Has any engagement ended in a handover? If yes: which facts (dates, durations, the successor's
role) may be published, with what consent? If no, the page must say nothing about results. 26. Which term does the page use: "internal owner" (site) or "internal CAIO" (master plan)? 27. Do you want to cite SECI (Nonaka and Takeuchi), as the PRD and master plan ask? Section 3,
item 8, gives the limits. 28. For the Handover Playbook resource: format (Markdown, PDF or repository), licence, version, and
the slug under `github.com/meshin-co`. 29. Which rules may the page cite: the EU AI Act only, or also NIST and ISO? Which framing is safe,
given the Starter Kit says "not legal advice"?

## 6. Sources

Primary means a standard, a law, a regulator's text, an official memo, a professional body's code
or a published paper. Dates are publication or last-update dates as I found them. "Read" notes what
I could access.

| Source                                                                          | Date and kind                                         | URL                                                                                                                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| S1. Institute of Interim Management, Code of Conduct                            | 2022-11-08, modified 2026-07-21; primary              | https://iim.org.uk/resources/code-of-conduct/                                                                                                   |
| S2. Woods et al., cyclical model of interim assignments, JOEPP 7(2)             | 2020-06; primary (author manuscript read)             | https://doi.org/10.1108/JOEPP-10-2019-0094                                                                                                      |
| S3. Wolfred, Interim Executive Directors, CompassPoint                          | 2005; secondary (practitioner monograph)              | https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf                                                        |
| S4. Skowron-Mielnik and Sobiecki, knowledge transfer in interim projects        | 2024-03; primary                                      | https://doi.org/10.2478/emj-2024-0004                                                                                                           |
| S5. Szulanski, Exploring internal stickiness, SMJ 17(S2)                        | 1996-12; primary (abstract read)                      | https://doi.org/10.1002/smj.4250171105                                                                                                          |
| S6. CE Interim, exit strategy and handover                                      | undated; secondary                                    | https://ceinterim.com/interim-manager-exit-strategy-and-handover-explained/                                                                     |
| S7. Fractionus, offboarding a fractional executive                              | 2026-05-26 (page data 2026-05-25T22:00Z); secondary   | https://fractionus.com/blog/fractional-executive-offboarding                                                                                    |
| S8. Esya, evals, runbook and handover                                           | 2026-08-29; secondary                                 | https://esya.studio/notes/ai-evals-runbook-handover                                                                                             |
| S9. Google, SRE book ch. 32, evolving SRE engagement model                      | 2017; primary                                         | https://sre.google/sre-book/evolving-sre-engagement-model/                                                                                      |
| S10. FCA Handbook SYSC 25.9                                                     | updated 2021-01-01; primary                           | https://handbook.fca.org.uk/handbook/sysc25/sysc25s9                                                                                            |
| S11. Starmer et al., handoff program, NEJM 371(19)                              | 2014-11-06; primary (abstract read)                   | https://pubmed.ncbi.nlm.nih.gov/25372088/                                                                                                       |
| S12. NIST AI RMF 1.0, NIST AI 100-1                                             | 2023-01-26; primary                                   | https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf                                                                                          |
| S13. NIST, AI Risk Management Framework page                                    | modified 2026-08-13; primary                          | https://www.nist.gov/itl/ai-risk-management-framework                                                                                           |
| S14. NIST AIRC, AI RMF Playbook                                                 | updated 2026-06-18; primary                           | https://airc.nist.gov/airmf-resources/playbook/govern/                                                                                          |
| S15. ISO, ISO/IEC 42001:2023 catalogue page                                     | published 2023-12-18; primary (full text not read)    | https://www.iso.org/standard/42001                                                                                                              |
| S16. ISO/IEC 42001:2023 free sample, hosted by iTeh                             | 2023-12; primary (contents and clauses 1 to 4.4 only) | https://cdn.standards.iteh.ai/samples/81230/4c1911ebc9a641fcb6ee21aa09c28ad3/ISO-IEC-42001-2023.pdf                                             |
| S17. ISO/IEC harmonized structure for management system standards               | approved 2025-07-30; primary                          | https://www.iso.org/home.isoDocumentsDownload.do?t=2EVmNRpfMEK8NcTL_uoAJceDlxYmmqpQWNk3r1MeLNWCXk6i10vZ-R5FEjIK-UOe                             |
| S18. US OMB, memorandum M-25-21                                                 | 2025-04-03; primary                                   | https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf |
| S19. Regulation (EU) 2024/1689, via the Commission's AI Act Service Desk        | 2024-06-13; primary                                   | https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26                                                                                   |
| S20. Regulation (EU) 2026/1744, Digital Omnibus on AI                           | 2026-07-08, OJ 2026-07-24; primary                    | http://data.europa.eu/eli/reg/2026/1744/oj                                                                                                      |
| S21. European Commission, AI Literacy Q&A                                       | last update 2026-07-27; primary (guidance)            | https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers                                                                     |
| S22. IAPP, AIGP certification page                                              | undated; primary for its own claims                   | https://iapp.org/certify/aigp                                                                                                                   |
| S23. Bock and von der Oelsnitz, leadership competences in the AI era            | 2025-02-28; primary (abstract only)                   | https://doi.org/10.1108/SL-09-2024-0100                                                                                                         |
| S24. Hossain, Fernando and Akter, AI-driven leader capabilities                 | 2025-02-16; primary (abstract only)                   | https://doi.org/10.1177/15480518251319624                                                                                                       |
| S25. Nonaka, A Dynamic Theory of Organizational Knowledge Creation              | 1994-02; primary (abstract only)                      | https://doi.org/10.1287/orsc.5.1.14                                                                                                             |
| S26. Gourlay, Conceptualizing Knowledge Creation: a critique of Nonaka's theory | 2006-08-22; primary (abstract only)                   | https://doi.org/10.1111/j.1467-6486.2006.00637.x                                                                                                |

Could not read, so not relied on: the full text of ISO/IEC 42001, the IAPP body-of-knowledge PDF
(HTTP 403), the Council press release of 2026-05-07 (HTTP 403), a 2026 MDPI review of AI
leadership competence (HTTP 403) and the SSRN page for Nonaka (HTTP 403). The EUR-Lex text was read
through a converter. Published repository facts and the site claims in section 4 come from
`site/dist` and `site/src/data/` as built on 2026-10-02.
