---
title: What is shadow AI?
term: Shadow AI
description: Shadow AI is any AI tool staff use for company work without IT or security's knowledge, from an app to a browser extension.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Shadow AI is any AI tool an employee uses for company work without IT or security's knowledge. Examples range from a personal chatbot account to a browser extension or a locally run model.
definition: |
  The hardest form to spot is a model downloaded and run locally on a laptop. It never crosses the network as a request to a known AI vendor. The same problem shows up wherever an employee reaches for a tool without asking. A developer might call a model's API directly from a side project. A browser extension might quietly send page content to a third party to generate its summary.

  None of it sits inside a contract governing how that vendor handles company or customer data, because no one negotiated one. None of it appears in the AI register either. A security review or an incident response then starts from a blind spot, not a known list. The tool itself is rarely the real risk. The missing record of its use is.
relatedTerms:
  - llm-gateway
  - ai-register
  - ai-governance
sources:
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

It is usually the first uncomfortable finding of a readiness assessment, and nobody did anything malicious. The register a company thought was complete turns out to have gaps. That happens the moment someone checks browser extensions and expense reports, instead of asking teams to self-report. A customer's security team asks about it, having been burned before. A board hears one checkable question: could an employee be pasting customer data into a public tool right now?

## What to do about it

Look rather than ask: check browser extension inventories, expense reports for AI subscriptions, and API billing for model providers nobody remembers approving. Publish a short list of approved tools, and a fast route to request a new one. The main driver of shadow AI is an approval process slower than the problem it solves. Fold anything found straight into the AI register, rather than treating discovery and governance as separate steps.
