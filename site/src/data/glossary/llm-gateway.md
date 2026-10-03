---
title: What is an LLM gateway?
term: LLM gateway
description: An LLM gateway is a single service every call to a language model passes through, for authentication, logging, rate limits and content filtering.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: An LLM (large language model) gateway is a single service that every model call passes through. A company can then enforce authentication, logging, rate limits and content filtering in one place.
definition: |
  Every call to any model passes through one place, instead of going straight from application code to a vendor's API. A company can then control who may call a model, and log every prompt and response for an audit trail. It can also redact sensitive data before it leaves the building. It can apply rate and cost limits, and fail over to a different provider if one goes down.

  Without a gateway, API keys end up scattered across a codebase, and nobody holds a full log of what the company sent to a vendor. A data leak through a prompt stays invisible until a customer or regulator finds it first.

  Engineering teams adopt one to stop rebuilding the same authentication and logging code in every project that touches a model. It also gives a direct, specific answer to a vendor questionnaire's question about how the company controls model access. That beats a description of several applications each doing it inconsistently.
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

A security questionnaire almost always asks how the company controls and logs access to the model provider. "Each team manages its own API key" is a poor answer. A board or customer asks a version of the same question after a well-publicised leak elsewhere. In that leak, a prompt carrying sensitive data reached a third-party model unlogged. Without a gateway, nobody can produce every prompt sent to a vendor last month.

## What to do about it

Put one gateway in front of every model call before adding a second application that talks to a model, not after. Route all API keys through it rather than into individual codebases, and log every request and response. Redact anything that looks like a customer identifier or a secret before it leaves. Solid open-source and hosted options already exist, so this is rarely worth building in house.

## The gateway as a governance control

A written policy says what staff may do with a model. A gateway is the control that enforces it, because every model call passes through one place where the policy runs. It decides who may call which model, strips sensitive data before it leaves, applies rate limits, and logs each request and response.

That log is the evidence a security questionnaire asks for: it shows the policy ran, not only that it exists. The limit is coverage: a gateway controls only the calls that go through it, so an application that calls a vendor directly sits outside the control. The [LLM Gateway Governance Config](/resources/llm-gateway-governance-config) gives a policy file format for one.
