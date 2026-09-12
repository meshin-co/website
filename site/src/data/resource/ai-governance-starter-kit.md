---
title: AI Governance Starter Kit
name: AI Governance Starter Kit
type: kit
description: 'AI governance starter kit: the paperwork a security review asks for — register, policy, data classification and a vendor questionnaire.'
publishDate: 2026-09-08
updatedDate: 2026-09-08
version: '0.1'
license: MIT
status: Written out in full on this page. A repository copy is not published yet.
whatInside:
  - AI register template, with the fields procurement asks about.
  - Acceptable-use policy your engineers can follow without a lawyer.
  - Data classification table, mapped to what may reach a vendor.
  - Vendor questionnaire you can fill in once and reuse.
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
| Data classification table | Which vendors are allowed to see which tier of data.       | The AI risk owner, together with whoever owns the data. |
| Vendor questionnaire      | One answer set procurement can reuse for every new vendor. | Procurement, before a vendor contract is signed.        |

It maps loosely to what ISO/IEC 42001 and the NIST AI Risk Management Framework both expect a company to have on file, without requiring either.
