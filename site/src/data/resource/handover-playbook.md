---
title: Handover Playbook
description: 'The Handover Playbook is six fill-in tables for moving AI leadership from an outside lead to a named owner, from the test to a later check.'
publishDate: 2026-10-02
updatedDate: 2026-10-07
name: Handover Playbook
type: template
version: '0.1'
license: MIT
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - 'Six tables to fill in: the owner and the test, what moves, who signs what, access, help after the last day and a check after handover'
  - A reason for each item in the table of what moves, and a source for each item that has one, so you can drop a row you disagree with
  - Blank columns for names, places and dates, because those answers belong to your company
  - 'My own terms where I have set them: three phases over three months, six access categories and thirty days of help after the last day'
howToUse: Copy the tables into a spreadsheet or your own wiki. Fill them in with the outside lead and the person taking over, starting with table one. A blank cell is a decision nobody has made yet. Where I have set my own terms, they show how I run a handover. Change them where your company differs. Do not mark the handover done until the new owner has passed the test written in table one.
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

The Handover Playbook is a plan to fill in, not a finished one. It moves AI leadership from an outside lead to a named person inside your company. Most rows ask for a name, a place or a date; the rest ask for a decision. Only your company knows those. The reasons for each table, and how much weight each source carries, are in [How to hand over AI leadership to an internal owner](/blog/handing-over-ai-leadership-to-an-internal-owner).

## Stage 1. The owner and the test

Fill this in first. This playbook asks for a written test so that the handover can end on a result, not only on a date. The [pilot article](/blog/why-your-ai-pilot-never-reached-production) says the new owner should have written at least one eval case and watched the rollback rehearsal. The [approach page](/approach) has a related test of whether your engineers can roll back a bad model without waiting on the outside lead.

My test has three checks, and I judge each one. The new owner writes an eval case and runs a rollback rehearsal. The new owner also handles one incident without me in the room.

| Question                                                                   | Your answer |
| -------------------------------------------------------------------------- | ----------- |
| Who takes the role? Write one name.                                        |             |
| Who decides whether to stop a launch, if that is a different person?       |             |
| What must the new owner do without the outside lead before the role moves? |             |
| Who judges each check?                                                     |             |
| What counts as a pass? Write it so a third person could judge it.          |             |
| What happens if the new owner is not ready on the planned date?            |             |

## Stage 2. What moves

My handover takes three months, in three phases. The month-one plan sets the end date, not the contract.

| Phase | Months             | What happens                                          |
| ----- | ------------------ | ----------------------------------------------------- |
| 1     | Months one and two | The new owner and the outside lead work side by side. |
| 2     | Month three        | The new owner leads. The outside lead reviews.        |
| 3     | End of month three | The final test and the signatures.                    |

One row per item. Fill in who holds it today, who holds it after, where it lives and the date it moved. The reason for each row comes first, and its source where it has one, so you can drop a row you disagree with.

| Item                              | Why it is here                                                                                                                                                                                                                                                                                                                                                                                   | Held today by | Held after by | Where it lives | Done on |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------- | -------------- | ------- |
| Decisions and their reasons       | A UK regulator says handover material should include judgement and opinion, not just facts and figures. [FCA handbook](https://handbook.fca.org.uk/handbook/sysc25/sysc25s9), an analogy from financial firms.                                                                                                                                                                                   |               |               |                |         |
| Work in progress                  | Status, owner and next action for each open item. [Fractionus](https://fractionus.com/blog/fractional-executive-offboarding), one vendor's advice.                                                                                                                                                                                                                                               |               |               |                |         |
| Open risks and concerns           | The same regulator says the material should include unresolved or possible breaches and unresolved concerns raised by regulators. FCA handbook, an analogy.                                                                                                                                                                                                                                      |               |               |                |         |
| The list of AI systems            | NIST asks for mechanisms to inventory AI systems. [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), Govern 1.6, voluntary.                                                                                                                                                                                                                                                 |               |               |                |         |
| Roles and authority               | NIST asks that roles, responsibilities and lines of communication are documented and clear. NIST AI RMF, Govern 2.1, voluntary.                                                                                                                                                                                                                                                                  |               |               |                |         |
| Runbook, evals and rollback       | Google says training for a receiving team can include hands-on exercises in operations. [Google SRE book](https://sre.google/sre-book/evolving-sre-engagement-model/), the operator's own account.                                                                                                                                                                                               |               |               |                |         |
| Monitoring and logs               | NIST asks for monitoring plans that cover incident response and change management (Manage 4.1). For high-risk systems, deployers will have to keep the logs they control for at least six months. That duty starts on 2 December 2027 for Annex III systems and 2 August 2028 for Annex I systems. [Article 26](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26) of the EU AI Act. |               |               |                |         |
| Outside parties                   | An interim director helps announce the new leader to funders and peers. [CompassPoint](https://www.compasspoint.org/sites/default/files/documents/Interim%20EDs%20-%20final.pdf), a practitioner's guide for US nonprofits.                                                                                                                                                                      |               |               |                |         |
| Vendor and sub-processor contacts | Vendor and [sub-processor](/glossary/sub-processor) contacts are not personal. They are a row in the [AI register](/glossary/ai-register), and the renewal calendar moves with it.                                                                                                                                                                                                               |               |               |                |         |

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

The table lists six categories of account. The client's internal owner or IT lead revokes each one, and the revocation is confirmed in writing the same day. A revoke-all line sits on the last-day checklist.

| Account or system                        | Granted by | Revoked by                             | Confirmed in writing on |
| ---------------------------------------- | ---------- | -------------------------------------- | ----------------------- |
| The AI register                          |            | The client's internal owner or IT lead |                         |
| The [LLM gateway](/glossary/llm-gateway) |            | The client's internal owner or IT lead |                         |
| CI/CD                                    |            | The client's internal owner or IT lead |                         |
| The cloud consoles                       |            | The client's internal owner or IT lead |                         |
| The vendor panels                        |            | The client's internal owner or IT lead |                         |
| The SSO admin                            |            | The client's internal owner or IT lead |                         |

## Stage 5. After the last day

Sources agree that some reachable help is useful and differ on how much. Agree it in writing, with its length, scope and who may call. The middle column holds my terms where I have set them.

| Question                                                       | My terms                                                                       | Your answer |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| Will the outside lead stay reachable, and for which questions? | Yes. Questions by email, answered within one working day.                      |             |
| For how long, and in what fee shape?                           | Thirty days after the last day, with one review call on day 30.                |             |
| Who may call?                                                  |                                                                                |             |
| What is out of scope after the last day?                       | Anything beyond the email answers and the day-30 call is a separate agreement. |             |

## Stage 6. The check after handover

Pick the date and the person who asks. The first question comes from one vendor's advice to ask the successor about a month after the exit. The other rows are prompts. Add your own.

| Question                                                             | Date | Who asks | Answer |
| -------------------------------------------------------------------- | ---- | -------- | ------ |
| What do you wish you had known on day one?                           |      |          |        |
| Which decision since the handover was made without the outside lead? |      |          |        |
| Which item in the What moves table turned out to be missing?         |      |          |        |
| Do customer paperwork and the AI register show the new name?         |      |          |        |

## What it is not

It is not a standard. A search in October 2026 found no standard, law or study that sets out how to hand over AI leadership, and no outcome study of AI-leadership handovers. Nothing shows that these tables lead to better results. It is not legal advice, and it is not a compliance certificate. The [FAQ on how the Retainer ends](/faq/how-does-the-retainer-end) covers how the [Fractional CAIO Retainer](/services/fractional-caio-retainer) ends.

No engagement has yet ended in a full handover by the method in these tables.
