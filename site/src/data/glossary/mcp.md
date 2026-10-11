---
title: What is the Model Context Protocol (MCP)?
term: Model Context Protocol
description: The Model Context Protocol (MCP) connects AI agents to tools and data, but cannot enforce consent, data privacy or tool safety at the protocol level.
publishDate: 2026-10-02
updatedDate: 2026-10-07
shortDefinition: The Model Context Protocol (MCP) is an open protocol that lets AI applications use outside tools and data. Its specification says MCP cannot enforce consent, data privacy or tool safety at the protocol level. Whoever builds and runs the host and the servers has to do that work.
definition: |
  The AI application is called the host. It starts one client for each server it connects to. A server offers tools the model can call, such as a file write. It can also offer data and ready-made prompts.

  The 28 July 2026 revision of the specification lists three principles: user consent and control, data privacy and tool safety. It says hosts must get consent before a tool runs, and the same overview page says that MCP "cannot enforce these security principles at the protocol level". Its separate Tools page says servers must check inputs and access. So each "must" depends on whoever builds the host or the server. Authorization is optional.

  The MCP project's own security policy adds that clients trust the servers they connect to, and that users and administrators are responsible for choosing them. So "we use MCP" says how an agent reaches a tool. What the agent may do there depends on the host's settings and on each server's checks.
relatedTerms:
  - guardrails
  - prompt-injection
  - agentic-workflow
sources:
  - title: Model Context Protocol specification, revision 28 July 2026
    url: https://modelcontextprotocol.io/specification/2026-07-28
  - title: Model Context Protocol specification, Tools, revision 28 July 2026
    url: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
  - title: Model Context Protocol specification, Authorization, revision 28 July 2026
    url: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
  - title: Model Context Protocol project security policy (SECURITY.md)
    url: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md
  - title: 'NSA Cybersecurity Information, Model Context Protocol (MCP): Security Design Considerations for AI-Driven Automation, May 2026, version 1.0 (Internet Archive copy)'
    url: https://web.archive.org/web/20260612015047id_/https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF
---

## Why it comes up

In this site's reading, it comes up when a team connects an [agentic workflow](/glossary/agentic-workflow) to its own systems and a security reviewer asks what the agent can touch. "Open protocol" can sound like a safety claim. It is not one.

A 2026 sheet from the US National Security Agency (NSA) says MCP's security posture "remains uneven and highly dependent on implementation discipline rather than protocol guarantees". The sheet cites the November 2025 revision of the specification.

## What to do about it

The model picks which tool to call, and text it reads can steer that choice. That is [prompt injection](/glossary/prompt-injection). The MCP project's security policy says a report that an LLM invoked an unexpected tool is not an MCP vulnerability. So the limits go in the host and the servers, as [guardrails](/glossary/guardrails) in code.

Give each server only the access its task needs. That is least privilege. The NSA sheet recommends that tool execution be constrained and sandboxed.

I start every new tool read-only. Any action that writes, spends money or touches personal data needs approval from a named person. Credentials live with the [gateway](/glossary/llm-gateway) or the server, never in the prompt, and they rotate every quarter.

## Before a third-party server connects

I pin the exact version of a third-party server and review its source before it connects. The approved-server list lives in the client's [AI register](/glossary/ai-register).

## Where the specification stops

The specification, in its 28 July 2026 revision, names who should do the first three jobs. The protocol does not check that anyone does.

- Approval before a tool runs: the host. There should always be a [human in the loop](/glossary/human-in-the-loop) who can deny a call.
- Checks on inputs and access: each server. Servers must validate all tool inputs and implement proper access controls.
- Logs: the host's clients. They should log tool usage, which feeds [observability](/glossary/observability). MCP traffic goes through the gateway. The call and the result are logged, never the full arguments, and the log is kept for 90 days. The log is reviewed in the weekly ops check.
- Local servers: a local server the client starts runs with the client's privileges. The policy says the SDK's STDIO transport, which does the starting, "is not a sandbox". Local STDIO servers run inside a container by default. Remote HTTP is used only through the gateway, with authentication.

## What the client receives

The server inventory and the approved-server list land in the client's AI register. This work is part of the two-week [AI readiness and risk assessment](/services/ai-readiness-and-risk-assessment).

## When I review this entry

Last reviewed: 7 October 2026.

I review this entry again on every new revision of the specification and on any new class of CVE.
