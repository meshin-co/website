---
title: What is an agentic workflow?
term: Agentic workflow
description: An agentic workflow is a task where one or more AI agents plan steps, call tools and choose the next move without a person's approval.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: An agentic workflow is a task one or more AI agents complete on their own once started. The system plans steps, calls tools or APIs, checks the result, and decides what happens next without a person approving each move.
definition: |
  The distinction that matters is between a single prompt and response and a task an agent sees through to the end. A chatbot that answers one question is not agentic. A system that reads a support ticket, looks up the order, drafts a refund and issues it is agentic. Nobody scripted that exact sequence in advance.

  Engineering teams build this pattern because it automates the cross-system judgement calls that used to need a person. Security reviewers and boards ask about it separately from the model itself, because the risk changes once a system can act, not only speak.

  A wrong sentence in a chat reply is embarrassing. A wrong action against a live order or a payment has already happened by the time anyone notices, because nothing stood between the decision and the outcome.
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

It comes up the moment a pitch or a product description says "agent" instead of "assistant". A security reviewer's next question is almost always what the agent can do without asking first. The reviewer asks because that is where the real exposure sits, not the model choice. A board hears "agentic" and correctly hears "this thing takes actions on its own." That is a different risk conversation than a chatbot that only produces text.

## What to do about it

List every action an agent can take, not just what it can say, and sign off on each as a separate risk. Set a real limit on what it can do without a person confirming first, especially anything that spends money, touches a customer record, or sends something external. Log every tool call, so a bad outcome traces to a specific decision. Evals belong here: test the whole action chain, not just the model's replies.
