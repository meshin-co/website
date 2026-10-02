---
title: What are guardrails in an AI system?
term: Guardrails
description: Guardrails are code checks on what a model responds to, what it can say and what it can do, not rules typed into a prompt.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: Guardrails are checks on what an AI model will respond to, what it can say, and what it can do. The surrounding code enforces them, not the model's training. That way an unusual input cannot just persuade the system to drop a rule.
definition: |
  In practice a guardrail is one of three things. A topic restriction limits what the model will engage with. An output filter limits what a user sees. An action gate controls what the system may do without a check first.

  OWASP, an independent security-standards group, publishes its own mitigation list for prompt injection. That list reads like a checklist for these three. Privilege control and human approval for high-risk actions are guardrails, not model behaviour.

  Guardrails are closer to what NIST's AI Risk Management Framework calls its Manage function: turning a risk decision into something the system enforces, not something merely written down. They are how that function shows up in code, not in a policy document nobody checks against production.
relatedTerms:
  - prompt-injection
  - red-teaming
  - observability
sources:
  - title: LLM01:2025 Prompt Injection
    url: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
  - title: NIST AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
---

## Why it comes up

Asking what guardrails a system has is one of the shortest, most common questions in a security review. It is a hard one to answer honestly if the only guardrail is the model's own training and good manners. A board hears it as a proxy for a bigger question. What is the actual worst thing someone could trick this system into doing, and what stands between that action and a real customer?

## What to do about it

Write guardrails as rules the code enforces, not text pasted into a prompt. Test each one against an input designed to defeat it, not a well-behaved example. Put a real check in front of any action that spends money, changes a record, or sends something external. That way a failure blocks the action instead of completing it. The [90-Day Production Sprint](/services/90-day-production-sprint) builds these checks into the workflow itself, not as a retrofit after an incident.
