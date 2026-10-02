---
title: AI Governance Starter Kit
name: AI Governance Starter Kit
type: kit
description: 'AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire.'
publishDate: 2026-09-08
updatedDate: 2026-10-02
version: '0.1'
license: MIT
status: Available as a page on this site. A repository copy is not published yet.
whatInside:
  - 'A list of the documents a security review asks for: AI register, acceptable-use policy, data classification table and vendor questionnaire.'
  - What each document is for.
  - Who signs each document.
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
---

## What this is

The four documents that answer most of a corporate security review. They are deliberately short: a register nobody updates is worse than no register.

## What it is not

It is not a compliance certificate, and it is not legal advice. It is the paperwork a reviewer expects to see before they look at your architecture.

## Who signs what

| Document                  | What it's for                                              | Who signs it                                            |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| AI register               | Every AI system in use, who owns it, what data reaches it. | The named AI risk owner keeps it current.               |
| Acceptable-use policy     | What you may paste into a tool, and what you may not.      | Every employee who uses an AI tool for work.            |
| Data classification table | Which vendors may see which tier of data.                  | The AI risk owner, together with whoever owns the data. |
| Vendor questionnaire      | One answer set procurement can reuse for every new vendor. | Procurement, before anyone signs a vendor contract.     |

It maps loosely to what ISO/IEC 42001 and the NIST AI Risk Management Framework (AI RMF) both expect a company to have on file. It does not require either.
