---
title: What is retrieval augmented generation?
term: Retrieval augmented generation
description: Retrieval augmented generation, or RAG, has a model look up relevant passages at answer time instead of relying only on its training.
publishDate: 2026-09-08
updatedDate: 2026-10-02
shortDefinition: Retrieval augmented generation, shortened to RAG, is an architecture where a model looks up relevant passages from a document store at answer time. It reads them alongside the question. This means an answer can cite a current document, rather than relying only on training data.
definition: |
  The document store is usually a vector index. The system converts passages into embeddings, numerical representations of meaning, and matches a query against them by similarity, not exact keyword. Matching on meaning lets the system find a relevant passage even when the question shares none of the same words as the document.

  OWASP, the group that publishes widely used security-risk lists, tracks this as its own risk category. In a shared vector database, one customer's data can leak into another customer's results. Embeddings carry a second risk: someone can sometimes invert them to recover the source text they came from. Both risks sit inside the retrieval layer, invisible to anyone reviewing only the model or the prompts it receives.
relatedTerms:
  - model-provenance
  - prompt-injection
  - hallucination-rate
sources:
  - title: LLM08:2025 Vector and Embedding Weaknesses
    url: https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/
---

## Why it comes up

Procurement asks "is this RAG, or did you train on our data," because the two have different data-handling implications. RAG typically sends only retrieved snippets to the model at query time, rather than baking a customer's content into the model's own weights. It also comes up once someone questions accuracy. A wrong answer usually traces to a retrieval problem, not a flaw in the model itself.

## What to do about it

Control access at the document-store level, not only at the chat interface. RAG will surface anything in the index to anyone who can ask the right question, regardless of who is meant to see it. Treat the document store itself as a data-classification boundary. Check what happens when a document containing hidden instructions ends up inside it. That exact scenario is one of the checks in the [90-Day Production Sprint](/services/90-day-production-sprint).
