---
title: What is an agentic workflow?
term: Agentic workflow
description: An agentic workflow is a task run by one or more LLM agents that plan steps, call tools and decide what happens next.
publishDate: 2026-09-08
updatedDate: 2026-09-08
shortDefinition: An agentic workflow is a task carried out by one or more LLM-based agents that plan steps, call tools or APIs, and decide what to do next, with little or no human input at each step.
definition: An agentic workflow is a task carried out by one or more large language model based agents that plan a sequence of steps, call tools or external APIs, observe the result, and decide what to do next, largely on their own once started. This is different from a single prompt and response. A chatbot that answers a question is not agentic. A system that reads a support ticket, looks up the customer's order in an internal API, drafts a refund, and issues it, is. Engineering teams reach for this pattern because it automates work that used to need a person to move between systems and make small judgment calls along the way. Security reviewers and boards ask about it separately from asking about the model, because the risk profile changes once a system can act rather than only speak. A wrong sentence in a chat reply is embarrassing. A wrong action taken by an agent with access to a live system, an order, a payment, a support ticket, has already happened by the time anyone notices.
relatedTerms:
  - human-in-the-loop
  - llm-gateway
  - evals
sources:
  - title: A Survey on Agent Workflow - Status and Future
    url: https://arxiv.org/abs/2508.01186
  - title: OWASP Top 10 for Large Language Model Applications
    url: https://owasp.org/www-project-top-10-for-large-language-model-applications/
---

## Why it comes up

It comes up the moment a pitch or a product description uses the word "agent" rather than "assistant". A security reviewer's next question is almost always what the agent is allowed to do without asking first, because that is where the actual exposure sits, not in the model choice. A board hears "agentic" and, correctly, hears "this thing takes actions on its own", which is a different risk conversation than a chatbot that only produces text a person then reads and decides on.

## What to do about it

List every action an agent can take, not just what it can say, and treat each one as a separate risk to sign off rather than a detail of implementation. Put a real limit on what it can do without a person confirming first, especially anything that spends money, changes a customer record, or sends something external. Log every tool call it makes so a bad outcome is traceable to a specific decision. Evals belong here too: test the whole chain of actions, not only the model's replies in isolation.
