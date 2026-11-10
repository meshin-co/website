---
title: What is prompt injection?
term: Prompt injection
description: Prompt injection is text, typed directly or hidden in a document a model reads, that gets the model to follow it as an instruction.
publishDate: 2026-09-08
updatedDate: 2026-11-10
shortDefinition: Prompt injection is text that gets a model to treat it as an instruction rather than content. It can be typed by a user, or hidden inside a document, webpage or email the model reads. OWASP, a security-standards group, ranks it as the top risk for large language model applications.
definition: |
  Direct injection comes from whoever is typing into the box, phrased to override the model's own hidden starting instructions, its system prompt. Indirect injection is the more dangerous form. It arrives inside content the model retrieves on its own: a webpage it is summarising, a resume it is screening. No attacker ever touches the model directly. Multimodal systems add a further variant, since an instruction can hide inside an image processed alongside ordinary text.

  It has kept that position through every edition of the list, most recently the 2026 revision. The reason is structural: the model reads instructions and untrusted data through the same channel. A filter tuned on known patterns still misses a novel phrasing. Every mitigation available today reduces the odds of a successful attack; none removes them.
relatedTerms:
  - guardrails
  - red-teaming
  - retrieval-augmented-generation
sources:
  - title: LLM01:2025 Prompt Injection
    url: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
  - title: OWASP Top 10 for LLM Applications
    url: https://genai.owasp.org/llm-top-10/
  - title: OWASP Top 10 for LLM Applications 2026
    url: https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/
    publisher: OWASP GenAI Security Project
    retrieved: '2026-11-10'
  - title: 'Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations, NIST AI 100-2 E2025'
    url: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-2e2025.pdf
    publisher: NIST
    retrieved: '2026-11-10'
  - title: "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection"
    url: https://arxiv.org/abs/2302.12173
    publisher: arXiv
    retrieved: '2026-11-10'
  - title: NVD record for CVE-2024-5184 (EmailGPT)
    url: https://nvd.nist.gov/vuln/detail/CVE-2024-5184
    publisher: NIST National Vulnerability Database
    retrieved: '2026-11-10'
  - title: 'CyRC Vulnerability Advisory: prompt injection in EmailGPT service (CVE-2024-5184)'
    url: https://www.blackduck.com/blog/cyrc-advisory-prompt-injection-emailgpt.html
    publisher: Black Duck Cybersecurity Research Center
    retrieved: '2026-11-10'
  - title: NVD record for CVE-2025-32711 (M365 Copilot)
    url: https://nvd.nist.gov/vuln/detail/CVE-2025-32711
    publisher: NIST National Vulnerability Database
    retrieved: '2026-11-10'
  - title: 'EchoLeak: The First Real-World Zero-Click Prompt Injection Exploit in a Production LLM System'
    url: https://arxiv.org/abs/2509.10540
    publisher: arXiv
    retrieved: '2026-11-10'
  - title: 'GitHub MCP Exploited: Accessing private repositories via MCP'
    url: https://invariantlabs.ai/blog/mcp-github-vulnerability
    publisher: Invariant Labs
    retrieved: '2026-11-10'
---

## Why it comes up

It is the first thing a security reviewer probes on any AI feature that reads outside content. That means a webpage, an uploaded file, an email, or a customer's own message history. The concern is not academic. A model that can also send an email, issue a refund or query a database turns a successful injection into something already done. It is no longer just an embarrassing reply.

## Prompt injection examples: ten cases and what each one does

Prompt injection examples fall into two groups: direct cases, where the attacker is the system's primary user, and indirect cases, where a third party plants the text in content the system reads. That is the split [NIST AI 100-2 E2025](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-2e2025.pdf) uses. [Greshake et al.](https://arxiv.org/abs/2302.12173) demonstrated the indirect kind in 2023 against real systems, including Bing's GPT-4 powered Chat.

| Example and source                                                                                                                                                | How the text reaches the model                                                      | What it does                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Support chatbot told to ignore its guidelines ([OWASP 2026](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/), scenario 1)                           | Direct: the attacker's own message                                                  | Queries private data stores and sends emails, giving unauthorised access and privilege escalation             |
| EmailGPT, [CVE-2024-5184](https://nvd.nist.gov/vuln/detail/CVE-2024-5184) ([OWASP 2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), scenario 5)     | Direct: a malicious prompt from anyone with access to the service                   | Takes over the service logic, leaking hard-coded system prompts or running unwanted prompts                   |
| Web page summary (OWASP 2026, scenario 2)                                                                                                                         | Indirect: hidden instructions in a page the user asks the model to summarise        | Inserts a markdown image whose URL carries the private conversation to the attacker                           |
| Job-description PDF (OWASP 2026, scenario 3)                                                                                                                      | Indirect: an AI-detection instruction embedded in the PDF                           | The applicant's model surfaces it and the recruiting system flags them, with neither party acting maliciously |
| Poisoned document in a [RAG](/glossary/retrieval-augmented-generation) corpus (OWASP 2026, scenario 4)                                                            | Indirect: a document the attacker added to the store the application retrieves from | A matching query returns it, and its instructions alter the output                                            |
| Instructions split across resume fields (OWASP 2026, scenario 5)                                                                                                  | Indirect: fragments in a resume's header, body and attachment                       | Evades a per-field classifier, and the recombined parts manipulate the model's recommendation                 |
| Instruction hidden in an image (OWASP 2026, scenario 6)                                                                                                           | Indirect: an image a multimodal model processes                                     | The vision encoder extracts it, and the model gives harmful output or makes an unauthorised tool call         |
| [EchoLeak](https://arxiv.org/abs/2509.10540) in Microsoft 365 Copilot, [CVE-2025-32711](https://nvd.nist.gov/vuln/detail/CVE-2025-32711) (OWASP 2026, scenario 7) | Indirect: one crafted email the assistant reads                                     | Leaks organisational data with no user interaction, past a prompt-injection classifier                        |
| Poisoned GitHub issue, from [Invariant Labs](https://invariantlabs.ai/blog/mcp-github-vulnerability) (OWASP 2026, scenario 9)                                     | Indirect: the user's agent reads it through the GitHub [MCP](/glossary/mcp) server  | Pulls private repository data into context and leaks it in a pull request on the public repository            |
| Encoded or low-resource-language payload (OWASP 2026, common example 8)                                                                                           | Either route, with the payload in Base64, ROT13, emoji or a low-resource language   | Evades classifiers and filters that never saw the encoding                                                    |

OWASP's 2026 edition files EmailGPT under indirect injection, though the National Vulnerability Database record and its [Black Duck advisory](https://www.blackduck.com/blog/cyrc-advisory-prompt-injection-emailgpt.html) describe a direct prompt. It labels the resume case direct input, though the applicant is the person screened, not the system's user. The table follows NIST's definitions in both.

The same edition calls prompt injection intrinsic to current generative AI, since models make no architectural distinction between instructions and data. It says no reliable prevention mechanism exists today and no single control is sufficient. Here is one example mapping of its controls to the cases, using the 2026 numbering:

- Direct cases: constrain the model's role in the system prompt (control 1), though an attacker who infers the prompt can bypass it
- Cases that end in an action: keep credentials and state changes in code under least privilege as [guardrails](/glossary/guardrails) (control 4), check response formats there (control 2), and require [human-in-the-loop](/glossary/human-in-the-loop) confirmation before privileged or irreversible steps (control 7)
- Indirect cases: pass external content through a separate, labelled channel (control 6), which OWASP says reduces attack success in non-adaptive tests only
- Cases built to evade filters: filter at every modality boundary, for example in an [LLM gateway](/glossary/llm-gateway) (control 3), though rephrasing or encoding evades semantic filters
- Every case: baseline with attack cases in [evals](/glossary/evals), then run [red teaming](/glossary/red-teaming) with the defence disclosed to the testers (control 11)

## What to do about it

Never let a model's output directly trigger a sensitive action without a check enforced in code. Keep the model's own permissions to the smallest set it needs. Treat anything the model reads from outside the conversation as untrusted input, the way a web application treats a user-supplied string. Evals for exactly this kind of attack belong in the same pipeline that gates every other change. That is how I structure the [90-Day Production Sprint](/services/90-day-production-sprint).
