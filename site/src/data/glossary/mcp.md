---
# TODO(owner) [mcp-scoping] section "What to do about it": the default permission for a new agent tool (read-only first?), which named actions always need a person's approval, whether the line is set by reversibility, money or data class (two examples on each side), whether design reviews use the Rule of Two or the lethal trifecta and where the result is recorded, and where credentials live, who rotates them and how long a token lasts. Until answered, the section gives sourced advice only and states no method of the owner's.
# TODO(owner) [mcp-vetting] no section yet: what happens before a third-party server is added (source review, pinned version or hash, publisher check, sandbox, trial run), in what order, who signs it off, whether the client gets an approved-server list, and whether server versions and tool descriptions are pinned and compared on each update.
# TODO(owner) [mcp-transport] section "Where the specification stops", isolation bullet: local STDIO or remote HTTP for client work, which sandbox or container, and whether this entry should take a side in the dispute over running commands from a config file.
# TODO(owner) [mcp-logging] section "Where the specification stops", logs bullet: whether MCP traffic goes through a gateway or proxy, what is logged (calls, arguments, results), for how long, and who reviews it. The LLM gateway entry covers model calls only.
# TODO(owner) [mcp-offer] end of the entry: which offer carries MCP security (Assessment, Sprint or retainer) and what the client receives (server inventory in the AI register, approved-server list, threat model, checklist). Until answered, the entry links to no service.
# TODO(owner) [mcp-review] whole entry: how often the entry is reviewed, what triggers an early review (a new specification revision, a new class of CVE), and whether to show a "last reviewed" date.
# TODO(owner) [mcp-slug] route and heading: confirm /glossary/mcp (short form, like llm-gateway) with the bare-term heading, or choose /glossary/model-context-protocol or a heading that carries "security".
title: What is the Model Context Protocol (MCP)?
term: Model Context Protocol
description: The Model Context Protocol (MCP) connects AI agents to tools and data, but cannot enforce consent, data privacy or tool safety at the protocol level.
publishDate: 2026-10-02
updatedDate: 2026-10-02
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

## Where the specification stops

The specification, in its 28 July 2026 revision, names who should do the first three jobs. The protocol does not check that anyone does.

- Approval before a tool runs: the host. There should always be a [human in the loop](/glossary/human-in-the-loop) who can deny a call.
- Checks on inputs and access: each server. Servers must validate all tool inputs and implement proper access controls.
- Logs: the host's clients. They should log tool usage, which feeds [observability](/glossary/observability).
- Local servers: a local server the client starts runs with the client's privileges. The policy says the SDK's STDIO transport, which does the starting, "is not a sandbox".
