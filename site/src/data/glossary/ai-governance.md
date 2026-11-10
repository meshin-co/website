---
title: What is AI governance?
term: AI governance
description: AI governance is the decisions, roles and controls a company uses to manage the risk of the AI systems it builds or buys.
publishDate: 2026-09-08
updatedDate: 2026-11-10
shortDefinition: AI governance means deciding who may build or buy an AI system, and who answers, by name, when it fails. Policies, roles and controls set what data a system may touch and who signs off before it reaches customers.
definition: |
  AI governance sits above the technology itself. It covers who owns each AI system, what data it may touch, which use cases are off limits, and who signs off before a system reaches customers. That shows up as a register of the systems in use, a policy engineers actually follow, and a review step before anything new goes live.

  A customer's procurement team asks for it during a security review. A board asks after a pilot nears production, once someone raises who is liable for a bad call. Regulators ask for pieces of it too, through frameworks like the NIST AI RMF and standards like ISO/IEC 42001.

  In practice, it changes three things. Someone specific owns each AI system, instead of it belonging to whichever team built it. A new system needs sign-off before it touches customer data. A written answer exists the day a customer or auditor asks for one.
relatedTerms:
  - nist-ai-rmf
  - iso-iec-42001
  - ai-register
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
  - title: Regulation (EU) 2024/1689 (EU AI Act)
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
  - title: ISO/IEC 42001:2023 - AI management systems
    url: https://www.iso.org/standard/42001
  - title: Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1
    url: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
    publisher: NIST
    retrieved: '2026-11-10'
  - title: Regulation (EU) 2024/1689 (EU AI Act), consolidated text of 27 July 2026
    url: https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng
    publisher: EUR-Lex
    retrieved: '2026-11-10'
  - title: ISO/IEC 42001:2023 - Information technology - Artificial intelligence - Management system
    url: https://www.iso.org/standard/81230.html
    publisher: ISO/IEC
    retrieved: '2026-11-10'
---

## Why it comes up

An insurer asks who owns AI risk before writing a policy. A board member reads about an AI failure elsewhere and asks what would happen here. An investor's due-diligence checklist now has a line for it too. Write down who is responsible for each system, and who would notice if it started producing worse answers.

## AI governance framework: the parts and where standards ask for each

An AI governance framework is the set of roles, records and routines around your AI systems. It gives each system an owner, a risk tier, a release check and a review date. The table lists nine parts and the [NIST AI RMF](/glossary/nist-ai-rmf) and [EU AI Act](/glossary/eu-ai-act) passages that ask for them.

| Part                        | What the company has to show                                                                                                                                     | Where a framework asks for it                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accountability              | A named owner per system, and an executive who answers for AI risk decisions                                                                                     | [NIST GOVERN 2.1, 2.3](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf). AI Act [Article 17(1)(m)](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) for [providers](/glossary/provider-vs-deployer) of [high-risk systems](/glossary/high-risk-ai-system). Article 26(2), [human oversight](/glossary/human-oversight) by people with competence, training and authority, for deployers of those systems |
| Inventory                   | An [AI register](/glossary/ai-register) with each system, its owner, its data and its risk tier                                                                  | NIST GOVERN 1.6                                                                                                                                                                                                                                                                                                                                                                                                            |
| Policy                      | Written AI policies, and proof that people follow them                                                                                                           | NIST GOVERN 1.2, 1.4. AI Act Article 17(1) for providers of high-risk systems                                                                                                                                                                                                                                                                                                                                              |
| Risk assessment and tiering | A risk tier per system, and a written assessment for the riskiest, such as an [AI impact assessment](/glossary/ai-impact-assessment) or a [DPIA](/glossary/dpia) | NIST GOVERN 1.3. AI Act Article 9 for providers of high-risk systems, Article 27 for some deployers of high-risk systems                                                                                                                                                                                                                                                                                                   |
| Approval before release     | A named approver, test results and a go or no-go decision before launch                                                                                          | NIST MANAGE 1.1, GOVERN 4.3. AI Act Article 9(8) and Article 17(1)(d) for providers of high-risk systems                                                                                                                                                                                                                                                                                                                   |
| Monitoring and incidents    | What is watched after launch, who reviews it and who is called when it fails                                                                                     | NIST GOVERN 4.3, MANAGE 4.1, 4.3. AI Act Article 17(1)(h), [post-market monitoring](/glossary/post-market-monitoring), and (i), [serious incident](/glossary/serious-incident-reporting) procedures, for providers of high-risk systems. Article 26(5) for deployers of those systems                                                                                                                                      |
| Third parties               | Each AI vendor, its [sub-processors](/glossary/sub-processor) and its terms on data use                                                                          | NIST GOVERN 6.1, 6.2                                                                                                                                                                                                                                                                                                                                                                                                       |
| People and training         | Who has had AI risk training, and when                                                                                                                           | NIST GOVERN 2.2. AI Act Article 4, support for AI literacy, for providers and deployers of any AI system                                                                                                                                                                                                                                                                                                                   |
| Review and retirement       | A review date per system, and a way to switch one off or replace it                                                                                              | NIST GOVERN 1.5, 1.7, MANAGE 2.4. AI Act Article 9(2), regular review, for providers of high-risk systems                                                                                                                                                                                                                                                                                                                  |

[NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) is voluntary and says its actions are not a checklist, so the middle column is example evidence. These subcategory IDs come from that January 2023 text, which [NIST says](https://www.nist.gov/itl/ai-risk-management-framework) it is revising.

The table cites the [consolidated EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) of 27 July 2026, as amended by Regulation (EU) 2026/1744. Under Article 113, the table's duties for high-risk systems apply from 2 December 2027 for Annex III systems and from 2 August 2028 for Annex I systems. Article 4 applies from 2 February 2025.

[ISO sells the text](https://www.iso.org/standard/81230.html) of [ISO/IEC 42001](/glossary/iso-iec-42001), the standard for an [AI management system](/glossary/ai-management-system), so the table cites no clause. The [FAQ on NIST, ISO/IEC 42001 and the EU AI Act](/faq/what-do-nist-ai-rmf-iso-iec-42001-and-the-eu-ai-act-require) says what each requires of a company your size.

## AI governance policy: what goes in it and who signs it

An AI governance policy records who may approve, run and retire AI systems, and what each one must show first. Write one short section per decision:

- Scope: which systems, staff and vendors it covers, including [shadow AI](/glossary/shadow-ai)
- Roles: the policy owner, the approving executive and each system's owner
- Register: where the [AI register](/glossary/ai-register) lives and who updates it
- Risk tiers: how a system gets a tier and what that tier requires
- Approval: who approves a new system or major change, and on what evidence
- Data: which [data classification](/glossary/data-classification) tier may reach which tool
- Oversight: who watches each system and who may stop it ([human oversight](/glossary/human-oversight))
- Vendors: what a vendor discloses before purchase, including its [sub-processors](/glossary/sub-processor)
- Incidents: who is told, in what order, and who rules an incident serious
- Training: who is trained on AI risk, and where it is recorded
- Review: the review date, early-review triggers and the version history

Under the [NIST AI RMF](/glossary/nist-ai-rmf), [GOVERN 2.3](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) says executive leadership takes responsibility for decisions about AI risk. The GOVERN overview in NIST AI RMF 1.0 adds that governing authorities can determine the overarching policies.

[Article 17(1)](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng) of the [EU AI Act](/glossary/eu-ai-act) has [providers](/glossary/provider-vs-deployer) of [high-risk systems](/glossary/high-risk-ai-system) write their [quality management system](/glossary/ai-management-system) down as policies, procedures and instructions. Point (m) adds an accountability framework for the responsibilities of management and other staff.

Neither NIST GOVERN 2.3 nor Article 17(1) says who signs a policy, so this part is advice. Name one policy owner, have one executive approve the policy and set a review date.

In the [AI Governance Starter Kit](/resources/ai-governance-starter-kit), a named AI risk owner keeps the register and each employee who uses an AI tool for work signs the separate [acceptable use policy](/blog/ai-acceptable-use-policy-for-a-50-person-company). Make that AI risk owner your policy owner too.

## What to do about it

Start with a one-page register: every AI system in use, who owns it, what data it touches, and whether customer data leaves the building. Assign one named owner per system, not a team. Add a single sign-off step before a new system reaches production. Map what you already do against the NIST AI RMF or ISO/IEC 42001. Do this so you have a recognised structure to point at, not to get certified immediately.
