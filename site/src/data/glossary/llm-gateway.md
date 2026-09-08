---
title: What is an LLM gateway?
term: LLM gateway
description: An LLM gateway is a single service every call to a language model passes through, for auth, logging and filtering.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: An LLM gateway is a single service that every call to a language model passes through, so a company can enforce authentication, logging, rate limits and content filtering in one place.
definition: An LLM gateway is a single service that sits between an application and the language model providers behind it, so that every call to any model passes through one place instead of going straight from application code to a vendor's API. Through that one point, a company can enforce who and what is allowed to call a model, log every prompt and response for an audit trail, redact sensitive data before it leaves the building, apply rate and cost limits, and fail over to a different provider if one goes down. Without a gateway, API keys end up scattered across a codebase, nobody has a full log of what was sent to a vendor, and a data leak through a prompt is invisible until a customer or a regulator finds it first. Engineering teams adopt a gateway to stop rebuilding the same authentication and logging code in every project that touches a model. It also gives a direct, specific answer to a vendor questionnaire's question about how model access is controlled, instead of a description of individual applications doing it individually and inconsistently.
relatedTerms:
  - shadow-ai
  - agentic-workflow
  - evals
sources:
  - title: Behavioral Consistency and Transparency Analysis on LLM API Gateways
    url: https://arxiv.org/abs/2604.21083
  - title: OWASP Top 10 for Large Language Model Applications
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
---

## Why it comes up

A security review's questionnaire almost always includes a question about how access to the model provider is controlled and logged, and "each team manages its own API key" is a poor answer in a formal review. A board or a customer asks a version of the same question after a well-publicised leak elsewhere, where a prompt carrying sensitive data reached a third-party model unlogged and unreviewed. Without a gateway, the honest answer to "show me every prompt sent to a vendor last month" is that nobody can produce it.

## What to do about it

Put one gateway in front of every model call before you add a second application that talks to a model, not after. Route all API keys through it rather than into individual codebases, log every request and response, and add a redaction step for anything that looks like a customer identifier or a secret before it leaves. A handful of solid open-source and hosted options exist already, so this is rarely worth building in house. Point a vendor questionnaire straight at this one control.
