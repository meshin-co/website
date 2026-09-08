---
title: What is shadow AI?
term: Shadow AI
description: Shadow AI is any AI tool staff use for company work without IT or security's knowledge, from an app to a browser extension.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Shadow AI is any AI tool an employee uses for company work without the knowledge or approval of IT or security, from a personal chatbot account to a browser extension or a locally run model.
definition: Shadow AI is any AI tool, model or service an employee uses for company work without it going through IT or security approval, the AI-specific version of the older idea of shadow IT. It covers a personal account on a public chatbot used to draft a client email, a browser extension that summarises pages by sending their content to a third party, a developer calling a model's API directly from a side project, and a model downloaded and run locally on a laptop, which can be the hardest form to spot because it never crosses the network as a request to a known AI vendor. It is almost always found rather than reported, through an expense claim, a browser extension audit, or a developer mentioning it in passing, because employees adopt these tools to get work done faster and do not think of it as a governance question. It matters because none of it is covered by a contract governing how that vendor handles company or customer data, and none of it appears in an AI register, which means a security review or an incident response starts from a blind spot rather than a known list.
relatedTerms:
  - llm-gateway
  - ai-register
  - ai-governance
sources:
  - title: From Frontier to Shadow AI - A Simmering Threat to Assurance and Security in Critical Infrastructure
    url: https://arxiv.org/abs/2606.00088
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

It is usually the first uncomfortable finding of a readiness assessment, not because anyone did anything malicious, but because the register a company thought was complete turns out to have gaps the moment you check browser extensions, expense reports and API billing rather than asking teams to self-report. A customer's security team asks about it directly, in those words, because they have been burned by a vendor's shadow AI before. A board hears it as a specific, checkable question: could an employee be pasting our customer data into a public tool right now.

## What to do about it

Look rather than ask: check browser extension inventories, expense reports for AI subscriptions, and API billing for model providers nobody remembers approving. Publish a short list of approved tools and a route to request a new one that takes days, not months, because the main driver of shadow AI is an approval process slower than the problem it is meant to solve. Fold anything you find straight into the AI register rather than treating discovery and governance as separate steps.
