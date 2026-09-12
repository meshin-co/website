---
title: What are guardrails in an AI system?
term: Guardrails
description: Guardrails are checks enforced in code around what a model can be asked and what it can say or do, not rules typed into a prompt.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: Guardrails are the checks placed around what an AI model can be asked, what it can say, and what it can do. They are enforced in the surrounding code, not left to the model's training. That way an unusual input cannot simply talk the system out of a rule.
definition: |
  In practice a guardrail is one of three things: a topic restriction on what the model will engage with, or an output filter on what a user sees. The third, an action gate, controls what the system may do without a check first.

  OWASP, an independent security-standards group, publishes its own mitigation list for prompt injection, which reads like a checklist for these three. Privilege control and human approval for high-risk actions are guardrails, not model behaviour.

  This is closer to what NIST's AI Risk Management Framework calls its Manage function: turning a risk decision into something the system enforces, not something merely written down. Guardrails are how that function shows up in code, not in a policy document nobody checks against production.
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

Asking what guardrails a system has is one of the shortest, most common questions in a security review. It is a hard one to answer honestly if the only guardrail is the model's own training and good manners. A board hears it as a proxy for a bigger question: what is the actual worst thing this system could be tricked into doing? And what stands between that action and a real customer?

## What to do about it

Write guardrails as rules the code enforces, not text pasted into a prompt. Test each one against an input designed to defeat it, not a well-behaved example. Put a real check in front of any action that spends money, changes a record, or sends something external. That way a failure blocks the action instead of completing it. The [90-Day Production Sprint](/services/90-day-production-sprint) builds these checks into the workflow itself, not as a retrofit after an incident.
