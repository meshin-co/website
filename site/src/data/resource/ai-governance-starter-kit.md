---
title: AI Governance Starter Kit
name: AI Governance Starter Kit
type: kit
description: 'AI governance starter kit: a table of who signs each document a security review asks for, six vendor questionnaire topics and an incident call order.'
publishDate: 2026-09-08
updatedDate: 2026-10-25
version: '0.1'
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - 'A list of the documents a security review asks for: AI register, acceptable use policy, data classification table and vendor questionnaire.'
  - What each document is for.
  - Who signs each document.
  - The topics a vendor questionnaire covers, set out as its own section.
  - 'An incident response plan: who to tell when an AI system fails, in what order, tied to the duty to report serious incidents.'
howToUse: The table on this page sets out what the register and the policy need to cover, so draft both yourself. Add the data classification for the systems you already run, and keep the vendor questionnaire beside your procurement process. Nothing here needs a tool or a subscription.
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: NIST
    retrieved: '2026-09-08'
  - title: 'ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system'
    url: https://www.iso.org/standard/42001
    publisher: ISO/IEC
    retrieved: '2026-09-08'
  - title: Article 26 - Obligations of Deployers of High-Risk AI Systems
    url: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689
    publisher: EUR-Lex
---

## What this is

The four documents that answer most of a corporate security review. They are deliberately short: a register nobody updates is worse than no register. The kit also sets out the order in which to call people when an AI system fails.

## What it is not

It is not a compliance certificate, and it is not legal advice. It is the paperwork a reviewer expects to see before they look at your architecture.

## Who signs what

| Document                  | What it's for                                              | Who signs it                                            |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| AI register               | Every AI system in use, who owns it, what data reaches it. | The named AI risk owner keeps it current.               |
| Acceptable use policy     | What you may paste into a tool, and what you may not.      | Every employee who uses an AI tool for work.            |
| Data classification table | Which vendors may see which tier of data.                  | The AI risk owner, together with whoever owns the data. |
| Vendor questionnaire      | One answer set procurement can reuse for every new vendor. | Procurement, before anyone signs a vendor contract.     |

It maps loosely to what ISO/IEC 42001 and the NIST AI Risk Management Framework (AI RMF) both expect a company to have on file. It does not require either.

## Vendor questionnaire

The other three documents describe how you handle AI. This one asks each vendor how it handles your data. Send the same questions to every AI vendor, and file the answers with the contract. The questions cover these topics:

- Whether the vendor trains models on your data, and how you opt out.
- Where your data is processed and stored, who at the vendor can read it, and which [sub-processors](/glossary/sub-processor) touch it.
- How the vendor announces a model change, and whether you can stay on a fixed version.
- How the vendor tells you about an incident, and who answers when you call.
- Whether the system counts as high-risk under the [EU AI Act](/glossary/eu-ai-act), and which duties the contract leaves with you.
- What happens to your data and prompts when the contract ends.

## Incident response plan

When an AI system fails, its owner should not have to work out who to call. Write this call order down beside the register, with a name and a backup against each role.

Inside the company, in this order:

1. The system owner named in the register, who limits or stops the system and keeps its logs and model version as they were.
2. The AI risk owner, who decides whether the incident is serious.
3. An executive who can approve a report and a message to customers.
4. Legal counsel, and whoever handles data breaches if personal data is involved.

Outside the company, in this order:

5. The provider of the system, which is often the vendor.
6. The importer or distributor, if the system has one.
7. The market surveillance authority.
8. Affected customers, as your contracts require.

For a high-risk system you deploy, Article 26 of the EU AI Act asks the deployer to give notice at once when it identifies a serious incident. The order is the provider first, then the importer or distributor and the market surveillance authority.

Log the time each person learned of the incident. The page on [serious incident reporting](/glossary/serious-incident-reporting) says which moment starts the clock for a report and sets out the deadlines, so this plan does not repeat them.
