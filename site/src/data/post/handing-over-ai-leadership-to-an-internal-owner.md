---
# TODO(owner) [handover-checks] section "How do you know the handover worked?": the full list of checks the receiving owner must pass before the role moves, who judges each one, and what counts as a pass. The page names only the two checks already published on /blog/why-your-ai-pilot-never-reached-production and /approach.
# TODO(owner) [handover-successor] section "Who should take the role?": who the usual internal owner is (engineering lead, COO, security lead, head of data or a new hire), whether one person or two hold the role, and what the Retainer does when nobody inside can take it yet. The page names the two jobs and leaves the choice open.
# TODO(owner) [handover-length] section "How long does a handover take?": the stages from month one to the last day with the length of each, any overlap where both people are active, and whether the end date is fixed in the statement of work, set in the month-one plan or set later. The page gives no length of its own.
# TODO(owner) [handover-after] section "How long does a handover take?", last paragraph: what the outside lead offers after the last day (calls, questions, reviews), for how long and in what fee shape (no numbers), and whether any check-in at 30, 60 or 90 days exists. The page promises none.
# TODO(owner) [handover-signoff] section "Who signs what after the handover date?": which of the listed decisions the owner signs today as named officer, the date the named-officer role passes to the internal owner, and who tells the customers whose questionnaires carry the owner's name.
# TODO(owner) [handover-precedent] whole page: whether any engagement has ended in a handover, and which facts about it may be published with consent. The page states no result and cites no client.
# TODO(owner) [handover-term] title and body: "internal owner" (live site) or "internal CAIO" (master plan). The page says "owner" and "outside lead" and never "CAIO".
title: How to hand over AI leadership to an internal team
description: 'How to hand over AI leadership in steps that end in a test: what moves, who takes the role and how to tell it worked.'
publishDate: 2026-10-02
updatedDate: 2026-10-03
shortAnswer: 'Hand AI leadership to an internal team in steps that end in a test. Name one owner early, let them run the system while the outside lead watches, and record the decisions and why. Check that the team can change the system and undo a bad change alone. Searches in October 2026 found no standard or study on AI-leadership handovers.'
fullAnswer: 'To hand over AI leadership to an internal team, move the role in steps and finish with a test. Name the receiving owner early. Let that person run the system while the outside lead watches. Write down the decisions and the reasons for them, not only the facts. Agree who signs what from the handover date. One vendor advises ending access for the outside lead in a single coordinated step on or before the last day. A good test is behaviour: the team can change the system and undo a bad change without the outside lead. Searches in October 2026 found no standard, law or published study on how to hand over AI leadership. Most checklists come from firms that sell interim or fractional staff. The sources that say how long a handover takes disagree, and none is about AI. Treat the advice as practice that others found sensible, plus some points that have no outside source. Write your own checks before the handover starts.'
keyTakeaways:
  - 'Plan a handover as a sequence of small transfers that ends in a test, not as one meeting on the last day.'
  - 'No standard, law or published study that turned up in October 2026 says how to hand over AI leadership. What does exist comes from neighbouring fields, and most checklists come from firms that sell interim or fractional staff.'
  - 'The new owner should be able to change the system and undo a bad change without the outside lead. They should also have practised the response to a failure.'
  - 'A UK financial regulator tells its own firms that handover material should include judgement and opinion, not just facts. The Google SRE book says the development team must stay available to advise the receiving team while it settles. One vendor advises ending access in a single coordinated step. None of the sources compared here lists who may sign what, so the advice on signers has no outside source.'
  - 'The EU AI Act articles checked do not ask anyone to appoint an AI officer. For high-risk systems they ask deployers to give oversight to people with the competence, training and authority for it. That duty starts in December 2027 or August 2028, depending on the system. Systems already on the market follow a separate rule.'
faq:
  - q: 'How long should a handover of AI leadership take?'
    a: 'The sources that say how long a handover takes disagree, and none is about AI. Lengths run from a few weeks to a few quarters, depending on the setting. Agree a date and a test together, and write down who may move the date.'
  - q: 'Does the EU AI Act require a chief AI officer?'
    a: 'No article checked requires one. For high-risk systems the Act asks deployers to give oversight to people with the competence, training and authority for it. That starts on 2 December 2027 for Annex III systems and on 2 August 2028 for Annex I systems. Systems already on the market before those dates follow a separate rule, so ask counsel how it applies to yours.'
  - q: 'Who should take over AI leadership from an outside lead?'
    a: 'One named person with the authority to pause the system, who has also seen it built. Where answering for risk and running the system fall to different people, name both. A search in October 2026 found no competence framework for a chief AI officer or head of AI from a standards body or regulator.'
  - q: 'What should an AI handover include?'
    a: 'It should hold the decisions and the reasons for them, work in progress and the list of AI systems. It should also say who may sign what, how to run and roll back the system, and who to ask afterwards. Documents alone can fall short: one vendor says a folder of documents can be complete while the handover is not.'
  - q: 'How do you know an AI handover worked?'
    a: 'Check that the receiving team can change the system and undo a bad change without the outside lead, and has practised the response to a failure. One vendor suggests asking the successor, a month later, what they wish they had known on day one.'
category: executive
tags:
  - ai-governance
  - production-readiness
  - eu-ai-act
sources:
  - title: 'AI RMF Core: Govern and Manage functions'
    url: 'https://airc.nist.gov/airmf-resources/airmf/5-sec-core/'
    publisher: NIST
    retrieved: '2026-10-02'
  - title: 'AI RMF Playbook: Govern'
    url: 'https://airc.nist.gov/airmf-resources/playbook/govern/'
    publisher: NIST
    retrieved: '2026-10-02'
  - title: 'AI Risk Management Framework'
    url: 'https://www.nist.gov/itl/ai-risk-management-framework'
    publisher: NIST
    retrieved: '2026-10-02'
  - title: 'Regulation (EU) 2024/1689, Article 3: Definitions'
    url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-3'
    publisher: European Commission, AI Act Service Desk
    retrieved: '2026-10-02'
  - title: 'Regulation (EU) 2024/1689, Article 14: Human oversight'
    url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14'
    publisher: European Commission, AI Act Service Desk
    retrieved: '2026-10-02'
  - title: 'Regulation (EU) 2024/1689, Article 26: Obligations of deployers of high-risk AI systems'
    url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26'
    publisher: European Commission, AI Act Service Desk
    retrieved: '2026-10-02'
  - title: 'Regulation (EU) 2026/1744 (Digital Omnibus on AI)'
    url: 'https://eur-lex.europa.eu/eli/reg/2026/1744/oj'
    publisher: EUR-Lex
    retrieved: '2026-10-02'
  - title: 'AI Literacy: Questions and Answers'
    url: 'https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers'
    publisher: European Commission
    retrieved: '2026-10-02'
  - title: 'ISO/IEC 42001:2023: catalogue page'
    url: 'https://www.iso.org/standard/42001'
    publisher: ISO
    retrieved: '2026-10-02'
  - title: 'ISO/IEC 42001:2023: free sample, contents and clauses 1 to 4.4'
    url: 'https://cdn.standards.iteh.ai/samples/81230/4c1911ebc9a641fcb6ee21aa09c28ad3/ISO-IEC-42001-2023.pdf'
    publisher: ISO, as hosted by iTeh
    retrieved: '2026-10-02'
  - title: 'FCA Handbook SYSC 25.9: Handover procedures and material'
    url: 'https://handbook.fca.org.uk/handbook/sysc25/sysc25s9'
    publisher: UK Financial Conduct Authority
    retrieved: '2026-10-02'
  - title: 'Code of Conduct'
    url: 'https://iim.org.uk/resources/code-of-conduct/'
    publisher: Institute of Interim Management
    retrieved: '2026-10-02'
  - title: 'Memorandum M-25-21: Accelerating Federal Use of AI through Innovation, Governance, and Public Trust'
    url: 'https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf'
    publisher: US Office of Management and Budget
    retrieved: '2026-10-02'
  - title: 'Site Reliability Engineering, chapter 32: The Evolving SRE Engagement Model'
    url: 'https://sre.google/sre-book/evolving-sre-engagement-model/'
    publisher: Google
    retrieved: '2026-10-02'
  - title: 'Effective interim leadership and management: development of a cyclical model of interim assignments'
    url: 'https://doi.org/10.1108/JOEPP-10-2019-0094'
    publisher: 'Journal of Organizational Effectiveness: People and Performance'
    retrieved: '2026-10-02'
  - title: 'Evals, runbook and handover: what must ship with an AI workflow'
    url: 'https://esya.studio/notes/ai-evals-runbook-handover'
    publisher: Esya
    retrieved: '2026-10-02'
  - title: 'How to Offboard a Fractional Executive and Keep the Knowledge'
    url: 'https://fractionus.com/blog/fractional-executive-offboarding'
    publisher: Fractionus
    retrieved: '2026-10-02'
  - title: 'Interim Manager Exit Strategy and Handover Explained'
    url: 'https://ceinterim.com/interim-manager-exit-strategy-and-handover-explained/'
    publisher: CE Interim
    retrieved: '2026-10-02'
  - title: 'Interim Executive Directors: The Power in the Middle'
    url: 'https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf'
    publisher: CompassPoint Nonprofit Services
    retrieved: '2026-10-02'
author: dmitri
relatedResources:
  - handover-playbook
---

An outside AI lead sets up governance or ships a first system. Sooner or later the role has to sit with someone on the payroll. Four questions run through a handover: what moves, who takes the role, who signs what, and how the company knows it worked.

## Is there a standard way to hand over AI leadership?

None turned up. In October 2026, searches of standards bodies, regulators and journals found no standard, law or study on this exact move.

What exists sits next door. Interim and fractional executives have exit practices. Engineering teams have ways to transfer ownership of a service. A UK financial regulator has rules for handing over a senior role. The [NIST AI RMF](/glossary/nist-ai-rmf) and the [EU AI Act](/glossary/eu-ai-act) texts checked in October 2026 never mention a change of person.

The evidence is thin. [One academic model of interim assignments](https://doi.org/10.1108/JOEPP-10-2019-0094) says the evidence base on interim effectiveness lacks empirical studies. A company linked to two of its authors funded its literature search. Most checklists come from firms that sell interim or fractional staff. Read what follows as practice that others found sensible, plus some points that have no outside source. None of it is proven.

## What has to move in a handover?

Documents alone can fall short. [Esya](https://esya.studio/notes/ai-evals-runbook-handover), a UK studio that builds AI inside client companies, writes that a folder of documents can be complete while the handover is not. It says the receiving team also needs the route to deploy and controlled access to systems. It needs monitoring data, the [evals](/glossary/evals) and the runbook. It needs authority over incidents and practised knowledge. Esya sells related work, so read that as a peer's view.

The table shows what each source asks for, and how much weight it can bear. Six rows come from sources about handovers, exits or onboarding. The three NIST rows are marked. The NIST text checked in October 2026 never mentions a change of person, so applying it to a handover is this page's reading.

| What moves                        | What a source asks for                                                                                                                                                         | The source and its weight                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions and reasons.            | Handover material should include judgement and opinion, not just facts and figures.                                                                                            | [UK Financial Conduct Authority handbook](https://handbook.fca.org.uk/handbook/sysc25/sysc25s9). Regulator guidance for UK financial firms, so an analogy only.                               |
| Work in progress.                 | A status report on the goals set at the start: what got done, what remains and what new issues emerged.                                                                        | [CompassPoint](https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf). A practitioner's guide to interim directors of US nonprofits.                       |
| The list of AI systems.           | Mechanisms to inventory AI systems.                                                                                                                                            | [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), Govern 1.6. A voluntary framework that NIST says it is revising. Not about handovers: this row is the page's reading. |
| Roles and authority.              | Roles, responsibilities and lines of communication for mapping, measuring and managing AI risks are documented and clear to individuals and teams throughout the organisation. | NIST AI RMF, Govern 2.1. Voluntary. Not about handovers: this row is the page's reading.                                                                                                      |
| How to run and change the system. | The route to deploy, monitoring data, the evals, a runbook and authority over incidents.                                                                                       | Esya. A studio that sells related work.                                                                                                                                                       |
| Access.                           | Revoke access in one coordinated step on or before the last day, and confirm it in writing.                                                                                    | [Fractionus](https://fractionus.com/blog/fractional-executive-offboarding). A marketplace that sells fractional executives, so one vendor's opinion.                                          |
| Monitoring and incident duty.     | Monitoring plans that cover incident response, recovery and change management.                                                                                                 | NIST AI RMF, Manage 4.1. Voluntary. Not about handovers: this row is the page's reading.                                                                                                      |
| Someone to ask.                   | The development team must be available to back up and advise the receiving team while it settles.                                                                              | [Google's SRE book](https://sre.google/sre-book/evolving-sre-engagement-model/). The operator's own account of its engineering teams.                                                         |
| A report on how it went.          | An exit review that names the issues the client needs to address.                                                                                                              | [Institute of Interim Management code](https://iim.org.uk/resources/code-of-conduct/). A professional body's code for UK interim managers.                                                    |

Nine rows are a lot to move on one day. Google's book describes a progressive transfer of responsibilities and ownership, including parts of operations, the change management process and access rights. This page reads that as support for moving a handover in steps.

## Who should take the role?

The company side needs one named person with the authority to pause the system. The [pilot article](/blog/why-your-ai-pilot-never-reached-production) says the same. It adds that the person should have written at least one eval case and watched a rollback rehearsal. Someone who was not part of the build inherits a document, not an understanding.

This site's own pages point to two jobs inside the role. One is answering for risk, including the authority to stop a launch. The other is keeping the system working, including the eval case and the rollback rehearsal. One person can hold both. Where the jobs split, name both people and write down who decides what.

[NIST's playbook](https://airc.nist.gov/airmf-resources/playbook/govern/) suggests managing development apart from testing, so that someone can correct a system independently of its builders. That is about testing, not owners, but it shows why a company might split the jobs.

A US federal memo from April 2025 makes a different choice. The [memo from the Office of Management and Budget](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf) lets an agency head name an existing officer as chief AI officer. The chief information officer is one example, if that person has significant expertise in AI.

The memo binds US federal agencies only, so for a private company it is an analogy. It also requires agencies to tell the Office of Management and Budget within thirty days when the officer changes or the post is vacant. Later revisions were not checked.

Sometimes nobody inside can take the role yet. The academic paper cited earlier notes that recruiting a senior executive can take six months or more. That figure is not specific to AI roles. No competence framework for a chief AI officer or head of AI from a standards body or regulator turned up in the search. The test the new owner must pass has to be written locally.

## How do you know the handover worked?

Test behaviour, not paperwork. [Google's SRE book](https://sre.google/sre-book/evolving-sre-engagement-model/) says a production readiness review is considered a prerequisite for a site reliability team to accept responsibility for the production side of a service. So the receiving side sets a bar before it takes ownership. That is a reading of the text.

A specialist team can refuse a service that fails the review. A single internal owner may lack that power, so agree the check with the outside lead in advance.

Esya's test is short: the receiving team has practised the response and can make the next change without waiting for the builders to return.

Some checks already appear on this site. The pilot article says the new owner should have written at least one eval case and watched a rollback rehearsal. The [approach page](/approach) lists a related measure under engineering capability. It tests whether your engineers can already roll back a bad model without waiting on the outside lead.

Write the full list of checks with the outside lead before the handover starts. For each check, name who judges it and what counts as a pass.

[CE Interim](https://ceinterim.com/interim-manager-exit-strategy-and-handover-explained/), which supplies interim managers, lists three causes of failed handovers. The first is making changes without enough involvement of the internal team. The second is treating knowledge transfer as a final step. The third is relying too heavily on the interim as the central decision maker.

It adds that a handover is a confirmation, not a critical moment, when the organisation already runs on its own before the interim leaves. Read it as a provider's marketing page.

Esya also lists promises that are not enough on their own, such as "contact the builder", "documentation has been shared" and "support remains available".

One more check comes later. [Fractionus](https://fractionus.com/blog/fractional-executive-offboarding) suggests asking the successor at the thirty-day mark what they wish they had known on day one. It is one vendor's suggestion.

## Who signs what after the handover date?

Every decision that carries a signature needs a name on the handover date. Examples are risk acceptances, policy exceptions, vendor approvals, changes to eval thresholds, rollback calls and answers to customer security questionnaires. Write the old signer and the new signer next to each one, with the date the change takes effect. Customer paperwork that names the outside lead needs a new name, and someone has to tell the customer.

None of the sources in the table above lists who may sign what, so this part is the page's own advice.

The [FAQ on how AI risk is recorded and signed off](/faq/how-does-ai-risk-get-recorded-and-who-signs-it-off) explains how AI risk is recorded and how the Retainer signs each entry while it is running.

Accountability stays with the company. The NIST AI RMF says executive leadership takes responsibility for decisions about AI risk. The EU AI Act puts the duties of a deployer on the body that uses an AI system under its authority.

On that reading, an adviser's departure moves no deployer duty, because the duty never sat with the adviser. It is a reading of the text and not legal advice, so ask counsel before relying on it.

## Do the AI rules say who must take over?

None of the AI rules checked names a successor. The Commission was asked whether an AI officer is necessary. For the AI literacy duty, its [guidance](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers) says no specific governance structure is mandated and no certificate is needed. That guidance is not binding law.

[Article 26](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26) covers [high-risk systems](/glossary/high-risk-ai-system). It asks deployers to give [human oversight](/glossary/human-oversight) to people who have the competence, training and authority for it, and the support they need. None of the articles checked asks for an AI officer.

The duties in Article 26 start on 2 December 2027 for systems that are high-risk under Annex III and on 2 August 2028 for those under Annex I. [Regulation (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) set those dates in July 2026.

Most high-risk systems already on the market before those dates come under the duties only if their design changes significantly. Those intended for use by public authorities must comply by 2 August 2030 in any case. Whether a system counts as high-risk is a question for counsel.

The NIST AI RMF is voluntary. Its Govern function asks for clear, documented roles and for training for the people in them. It also says executive leadership takes responsibility for risk decisions. NIST says it is revising the framework, so check the current text.

The contents of [ISO/IEC 42001](/glossary/iso-iec-42001) list roles, responsibilities and authorities, and competence. Its full text is paid, so nothing from it is quoted here.

None of the NIST or EU texts checked says what to do when the person changes, and the ISO text was not read in full. A handover is where role clauses like these get tested. That is a reading, not a rule.

## How long does a handover take?

The sources that say how long a handover takes disagree, and none is about AI. Lengths run from a few weeks to a few quarters, depending on the setting. CompassPoint's guide for nonprofits describes a short overlap, then a few weeks of drop-in help. Fractionus suggests starting weeks before the last day. Google describes quarters for engineering teams taking over a service.

A fixed date and a ready receiver can pull against each other. Write down both, and agree who may move the date. The [Institute of Interim Management](https://iim.org.uk/resources/code-of-conduct/) code of conduct asks members to agree formal termination terms with the client. These include a handover period and a period of notice.

Sources agree that some reachable help after the last day is useful, and differ on how much. Google's book says the development team must stay available to advise the receiving team while it settles. CompassPoint's guide suggests drop-in days, then availability by phone as needed. Fractionus suggests optional advisory time after the exit, though its own page gives two different windows. Whatever is agreed, write down the length, the scope and who may call.

## What this does not solve

The sources are neighbouring fields, vendor advice and voluntary frameworks. No outcome study of AI-leadership handovers turned up, so nothing here shows that a practice leads to better results later.

It is not legal advice. The readings of the EU AI Act here are plain-language summaries and need counsel before anyone relies on them.

It does not cover the case where nobody inside can take the role. That calls for a hiring or reassignment decision, and no handover method replaces it.

It does not say how any particular engagement ends. The [Fractional CAIO Retainer](/services/fractional-caio-retainer) is built to end with a named internal owner and written decisions. [The FAQ on how the Retainer ends](/faq/how-does-the-retainer-end) and the [approach page](/approach) say more. The [Handover Playbook](/resources/handover-playbook) turns these questions into six tables to fill in.
