---
# TODO(owner) [handover-playbook-format] whole entry: the format the owner wants to publish (page only, Markdown file, PDF or repository), the licence and the version. The entry copies the open assumptions of the sibling resources (MIT, version 0.1, no repository, page-only status line). See docs/COPY-CHECKLIST.md rows 6.2 to 6.4.
# TODO(owner) [handover-playbook-stages] section "What moves": the order and length of the owner's own stages from month one to the last day, and any overlap where the owner and the internal owner are both active. The tables carry no stage order and no length, so the playbook claims no practice of the owner's.
# TODO(owner) [handover-playbook-vendors] section "What moves": whether the owner holds any vendor or sub-processor contact personally, and what review cadence and renewal calendar passes to the internal owner. The table has no vendor row because no outside source asks for one.
# TODO(owner) [handover-playbook-after] section "After the last day": what the owner offers after the last day, for how long and in what fee shape (no numbers), and whether the owner checks in at 30, 60 or 90 days. The tables leave these cells for the company and the outside lead to agree.
# TODO(owner) [handover-playbook-access] section "Access": the owner's own credential list beyond the sentence on /security, who revokes each account, and how revocation is confirmed in writing. The table lists places to look, not the owner's accounts.
title: Handover Playbook
description: 'The Handover Playbook is six fill-in tables for moving AI leadership from an outside lead to a named owner, from the test to a later check.'
publishDate: 2026-10-02
updatedDate: 2026-10-02
name: Handover Playbook
type: template
version: '0.1'
license: MIT
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - 'Six tables to fill in: the owner and the test, what moves, who signs what, access, help after the last day and a check after handover'
  - A reason and a source for each item in the table of what moves, so you can drop a row you disagree with
  - Blank columns for names, places and dates, because those answers belong to your company
howToUse: Copy the tables into a spreadsheet or your own wiki. Fill them in with the outside lead and the person taking over, starting with table one. A blank cell is a decision nobody has made yet. Do not mark the handover done until the new owner has passed the test written in table one.
sources:
  - title: 'AI RMF Core: Govern and Manage functions'
    url: 'https://airc.nist.gov/airmf-resources/airmf/5-sec-core/'
    publisher: NIST
    retrieved: '2026-10-02'
  - title: 'AI RMF Playbook: Govern'
    url: 'https://airc.nist.gov/airmf-resources/playbook/govern/'
    publisher: NIST
    retrieved: '2026-10-02'
  - title: 'Regulation (EU) 2024/1689, Article 26: Obligations of deployers of high-risk AI systems'
    url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26'
    publisher: European Commission, AI Act Service Desk
    retrieved: '2026-10-02'
  - title: 'FCA Handbook SYSC 25.9: Handover procedures and material'
    url: 'https://handbook.fca.org.uk/handbook/sysc25/sysc25s9'
    publisher: UK Financial Conduct Authority
    retrieved: '2026-10-02'
  - title: 'Site Reliability Engineering, chapter 32: The Evolving SRE Engagement Model'
    url: 'https://sre.google/sre-book/evolving-sre-engagement-model/'
    publisher: Google
    retrieved: '2026-10-02'
  - title: 'Interim Executive Directors: The Power in the Middle'
    url: 'https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf'
    publisher: CompassPoint Nonprofit Services
    retrieved: '2026-10-02'
  - title: 'How to Offboard a Fractional Executive and Keep the Knowledge'
    url: 'https://fractionus.com/blog/fractional-executive-offboarding'
    publisher: Fractionus
    retrieved: '2026-10-02'
relatedPosts:
  - handing-over-ai-leadership-to-an-internal-owner
---

## What this is

The Handover Playbook is a plan to fill in, not a finished one. It moves AI leadership from an outside lead to a named person inside your company. Most rows ask for a name, a place or a date; the rest ask for a decision. Only your company knows those. The reasons for each table, and how much weight each source carries, are in [How to hand over AI leadership to an internal team](/blog/handing-over-ai-leadership-to-an-internal-owner).

## Stage 1. The owner and the test

Fill this in first. This playbook asks for a written test so that the handover can end on a result, not only on a date. The [pilot article](/blog/why-your-ai-pilot-never-reached-production) says the new owner should have written at least one eval case and watched the rollback rehearsal. The [approach page](/approach) has a related test of whether your engineers can roll back a bad model without waiting on the outside lead.

| Question                                                                   | Your answer |
| -------------------------------------------------------------------------- | ----------- |
| Who takes the role? Write one name.                                        |             |
| Who decides whether to stop a launch, if that is a different person?       |             |
| What must the new owner do without the outside lead before the role moves? |             |
| Who judges each check?                                                     |             |
| What counts as a pass? Write it so a third person could judge it.          |             |
| What happens if the new owner is not ready on the planned date?            |             |

## Stage 2. What moves

One row per item. Fill in who holds it today, who holds it after, where it lives and the date it moved. The reason and the source for each row come first, so you can drop a row you disagree with.

| Item                        | Why it is here                                                                                                                                                                                                                                                                                                                                                                                   | Held today by | Held after by | Where it lives | Done on |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------- | -------------- | ------- |
| Decisions and their reasons | A UK regulator says handover material should include judgement and opinion, not just facts and figures. [FCA handbook](https://handbook.fca.org.uk/handbook/sysc25/sysc25s9), an analogy from financial firms.                                                                                                                                                                                   |               |               |                |         |
| Work in progress            | Status, owner and next action for each open item. [Fractionus](https://fractionus.com/blog/fractional-executive-offboarding), one vendor's advice.                                                                                                                                                                                                                                               |               |               |                |         |
| Open risks and concerns     | The same regulator says the material should include unresolved or possible breaches and unresolved concerns raised by regulators. FCA handbook, an analogy.                                                                                                                                                                                                                                      |               |               |                |         |
| The list of AI systems      | NIST asks for mechanisms to inventory AI systems. [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), Govern 1.6, voluntary.                                                                                                                                                                                                                                                 |               |               |                |         |
| Roles and authority         | NIST asks that roles, responsibilities and lines of communication are documented and clear. NIST AI RMF, Govern 2.1, voluntary.                                                                                                                                                                                                                                                                  |               |               |                |         |
| Runbook, evals and rollback | Google says training for a receiving team can include hands-on exercises in operations. [Google SRE book](https://sre.google/sre-book/evolving-sre-engagement-model/), the operator's own account.                                                                                                                                                                                               |               |               |                |         |
| Monitoring and logs         | NIST asks for monitoring plans that cover incident response and change management (Manage 4.1). For high-risk systems, deployers will have to keep the logs they control for at least six months. That duty starts on 2 December 2027 for Annex III systems and 2 August 2028 for Annex I systems. [Article 26](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26) of the EU AI Act. |               |               |                |         |
| Outside parties             | An interim director helps announce the new leader to funders and peers. [CompassPoint](https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf), a practitioner's guide for US nonprofits.                                                                                                                                                                      |               |               |                |         |

## Stage 3. Who signs what

NIST AI RMF Govern 2.1 asks that roles, responsibilities and lines of communication are documented and clear. Its voluntary Playbook also suggests documenting delegated authorities. Write that down here for the handover. The rows are examples of decisions that carry a signature; no source lists them. Delete any that do not apply and add your own. For a high-risk system under the [EU AI Act](/glossary/eu-ai-act), ask counsel who must hold [human oversight](/glossary/human-oversight).

| Decision                                    | Signs today | Signs after the handover date | Change takes effect on |
| ------------------------------------------- | ----------- | ----------------------------- | ---------------------- |
| Entries in the AI register                  |             |                               |                        |
| Risk acceptances                            |             |                               |                        |
| Policy exceptions                           |             |                               |                        |
| Vendor and model approvals                  |             |                               |                        |
| Changes to eval thresholds                  |             |                               |                        |
| Rollback calls                              |             |                               |                        |
| Answers to customer security questionnaires |             |                               |                        |
| Serious incident calls                      |             |                               |                        |

## Stage 4. Access

List every account the outside lead holds. Revoke them in one coordinated step on or before the last day, and do not leave removal to the outside lead. A marketplace that sells fractional executives gives this advice and asks for written confirmation. It is one vendor's opinion.

Places to look include code repositories, CI and eval tools, model provider consoles, cloud and monitoring tools, shared drives, password manager entries and vendor admin consoles. This list is the page's own.

| Account or system | Granted by | Revoked by | Confirmed in writing on |
| ----------------- | ---------- | ---------- | ----------------------- |
|                   |            |            |                         |
|                   |            |            |                         |
|                   |            |            |                         |

## Stage 5. After the last day

Sources agree that some reachable help is useful and differ on how much. Agree it in writing, with its length, scope and who may call.

| Question                                                       | Your answer |
| -------------------------------------------------------------- | ----------- |
| Will the outside lead stay reachable, and for which questions? |             |
| For how long, and in what fee shape?                           |             |
| Who may call?                                                  |             |
| What is out of scope after the last day?                       |             |

## Stage 6. The check after handover

Pick the date and the person who asks. The first question comes from one vendor's advice to ask the successor about a month after the exit. The other rows are prompts. Add your own.

| Question                                                             | Date | Who asks | Answer |
| -------------------------------------------------------------------- | ---- | -------- | ------ |
| What do you wish you had known on day one?                           |      |          |        |
| Which decision since the handover was made without the outside lead? |      |          |        |
| Which item in table two turned out to be missing?                    |      |          |        |
| Do customer paperwork and the AI register show the new name?         |      |          |        |

## What it is not

It is not a standard. A search in October 2026 found no standard, law or study that sets out how to hand over AI leadership, and no outcome study of AI-leadership handovers. Nothing shows that these tables lead to better results. It is not legal advice, and it is not a compliance certificate. It does not say how any engagement ends. The [FAQ on how the Retainer ends](/faq/how-does-the-retainer-end) covers that for the [Fractional CAIO Retainer](/services/fractional-caio-retainer).
