---
record: true
---

# 02 — MCP security: what current guidance says, 2026-10-02

Dated 2026-10-02. Research for buyer prompt 19, "MCP security best practices". It reads outside
sources, the built site in `site/dist/` and the content source under `site/src/data/` as they stood on
2026-10-02. No commit hash is recorded: two other agents were editing the tree at the time. This is a
record, not an instruction. It describes sources at a moment in time. The URLs it cites are outside
this repository and are not expected to resolve here. It contains no page copy.

The fact most likely to go stale: the current MCP specification revision is **2026-07-28**. The
project's versioning page said so when fetched at 2026-10-02 08:42 UTC, and the draft changelog was
empty then, so nothing newer was queued. Every spec claim below is about that revision unless it names
another.

How to read the tags. Each claim ends with a source tag and a date, for example
`[P4 · rev 2026-07-28]`. Section 6 gives each tag's publisher, URL and kind. `P` is a primary source:
a specification, a standard, a government text, a vendor's own documentation, a CVE record, or a
company speaking about its own finding. `S` is secondary. A company's account of its own finding is
primary for what it disclosed and weak for the numbers and the "first ever" claims it attaches. Those
sentences say so.

## 1. What the page must answer

**The prompt, verbatim:** `MCP security best practices`. It is item 19 in the prompt list at
`docs/PRD.md` line 1137.

**Where the repo puts it today.**

- `docs/SEMANTIC-CORE.md` lines 336–337: "GAP (hard): no route. The glossary has no MCP term and no
  article covers it ... Needs a glossary term first (cheap, citable), an article second. Phase 6."
- `docs/SEMANTIC-CORE.md` line 579, the register row: "No route at all", fix "new glossary term +
  article".
- `docs/SEMANTIC-CORE.md` lines 613–616, Phase 6 worklist item 5: "New `/glossary/mcp` (or
  `/glossary/model-context-protocol`): a definition sentence, why an agent's tool access needs
  least-privilege scoping, adjacent terms `guardrails` and `prompt-injection`."

**What a buyer typing it wants.** This is my reading, not a sourced finding. No source describes who
types the phrase. The buyer's company is about to connect AI agents to its own systems through MCP
servers, or has done so, and someone has asked "is that safe?" The buyer wants four things: what MCP
is in one sentence; what has actually gone wrong, with dates; which controls current guidance agrees
on; and who is responsible for each control — the protocol, the client vendor or the buyer. Section 2
is arranged to answer those four.

**Shape limit from the template.** A glossary term holds a `shortDefinition` of at most 50 words, a
`definition` of 100 to 200 words, one or more `sources` and optional `relatedTerms`
(`site/src/content.config.ts` lines 146–160). The material in this record is far larger than 200
words. Worklist item 5 names an article as the second step. This record does not say which facts go
in which.

## 2. State of practice, 2026

### 2.1 The revision, who owns it, and what MCP is

- The project's versioning page says "The current protocol version is 2026-07-28". It was fetched on
  2026-10-02 at 08:42 UTC. The draft changelog (`/specification/draft/changelog`) was empty. The
  previous revision is 2025-11-25. [P2 · read 2026-10-02]
- The spec defines MCP as "an open protocol that enables seamless integration between LLM
  applications and external data sources and tools". It names three roles: hosts (the LLM
  application), clients (connectors inside the host) and servers (services that provide context and
  capabilities). Servers offer resources, prompts and tools. [P1 · rev 2026-07-28]
- Anthropic donated MCP to the Agentic AI Foundation, a Linux Foundation directed fund, announced
  2025-12-09. Anthropic, Block and OpenAI are the co-founders. Google, Microsoft, AWS, Cloudflare and
  Bloomberg are listed as supporters. Maintainers keep technical direction through the SEP process.
  [P12 · 2025-12-09]
- Size claims are the project's own. The 2025-12-09 post reports "97 million monthly SDK downloads,
  10,000 active servers". The 2026-07-28 release post reports "close to half-a-billion downloads a
  month" across the Tier 1 SDKs (TypeScript, Python, Go, C#; Rust in beta). I found no independent
  count. [P12 · 2025-12-09] [P11 · 2026-07-28]
- The release post says "authorization is where implementers spend most of their integration time".
  [P11 · 2026-07-28]

### 2.2 What the 2026-07-28 revision changed that touches security

All items from the revision's own changelog. [P3 · rev 2026-07-28]

- Protocol-level sessions and the `Mcp-Session-Id` header are removed (SEP-2567). The core is
  stateless and the `initialize` handshake is gone (SEP-2575).
- "Multi Round-Trip Requests" replace server-initiated sampling, elicitation and roots (SEP-2322).
- Tasks moved out of the core into an extension (SEP-2663).
- New required headers `Mcp-Method` and `Mcp-Name` (SEP-2243).
- Authorization: clients MUST validate an `iss` value when one is present, as in RFC 9207 (SEP-2468).
  Credentials are bound to the authorization server that issued them (SEP-2352).
- Deprecated: Dynamic Client Registration (in favour of Client ID Metadata Documents); Roots,
  Sampling and Logging (SEP-2577); the HTTP+SSE transport.
- A new deprecation policy sets a minimum 12-month window (SEP-2596).

### 2.3 The trust model, in the project's own words

- The overview lists three principles. User consent and control. Data privacy. Tool safety: "Tools
  represent arbitrary code execution and must be treated with appropriate caution", and "descriptions
  of tool behavior such as annotations should be considered untrusted, unless obtained from a trusted
  server". "Hosts must obtain explicit user consent before invoking any tool". [P1 · rev 2026-07-28]
- The same page then says: "While MCP itself cannot enforce these security principles at the protocol
  level, implementors SHOULD" build consent and authorization flows, document security implications,
  implement access controls and follow security best practices. [P1 · rev 2026-07-28]
- The architecture page says the host "enforces security policies and consent requirements", that a
  client has a one-to-one link with a server, and that "Servers should not be able to read the whole
  conversation, nor 'see into' other servers". [P5 · rev 2026-07-28]
- The project's `SECURITY.md` is the plainest statement. "MCP clients trust MCP servers they connect
  to." "Local MCP servers are trusted like any other software you install." "Users and administrators
  are responsible for server selection." [P9 · last changed 2026-06-25]
- The same file lists behaviours it calls intended and "not ... security vulnerabilities": command
  execution for the STDIO transport; what servers can do (read and write files, run git commands,
  change databases, call networks, run system commands); resource access; and LLM-driven tool choice
  ("Reports about 'LLM invoked unexpected tool' are not MCP vulnerabilities"). It says the SDK's STDIO
  transport "is not a sandbox". [P9 · last changed 2026-06-25]
- The file also lists what it does count as a vulnerability: protocol-level flaws, authorization
  bypass, SDK implementation bugs, sandbox escapes, session hijacking, token theft and cross-tenant
  access. It assigns to operators: connect only to trusted servers, review configurations, understand
  what each server can do, set access restrictions. [P9 · last changed 2026-06-25]

### 2.4 Tool calls: approval, validation, change

- "For trust & safety and security, there SHOULD always be a human in the loop with the ability to
  deny tool invocations." [P4 · rev 2026-07-28]
- Servers MUST validate inputs, implement access controls, rate-limit and sanitise outputs. Clients
  SHOULD show tool inputs to the user before a call, validate results before passing them to the
  model, and log tool usage. [P4 · rev 2026-07-28]
- Clients MUST treat tool annotations as untrusted unless they come from trusted servers. The set of
  tools a server shows MAY vary with the authorization presented. [P4 · rev 2026-07-28]
- When the tool list changes, a server that declared `listChanged` SHOULD send
  `notifications/tools/list_changed` to clients that opened a `subscriptions/listen` stream. [P4 ·
  rev 2026-07-28]
- **Absence finding.** A word search of the Tools page on 2026-10-02 found none of: prompt injection,
  tool poisoning, rug pull, hash, checksum. The same search of the Security Best Practices page found
  none of those or of: shadowing, supply chain, typosquatting. Its one "pinning" hit is about DNS
  resolution, not tool descriptions. I found no text in either page that requires or names pinning or
  hashing of tool descriptions. [P4, P8 · rev 2026-07-28] The OWASP guide gives the reason it sees:
  "the lack of strict versioning for tool descriptions". [P20 · 2026-02]

### 2.5 Where servers run

- Streamable HTTP: servers MUST validate the `Origin` header against DNS rebinding. Local servers
  SHOULD bind to 127.0.0.1. Servers SHOULD authenticate all connections. [P7 · rev 2026-07-28]
- STDIO: the client starts the server as a local subprocess, and the server "runs with the same
  privileges as the client". [P9 · 2026-06-25] The Security Best Practices page says the "stdio
  transport itself is not inherently vulnerable". It also says a one-click local-server setup MUST
  show the exact command and ask for consent, and it advises sandboxing. [P8 · rev 2026-07-28]

### 2.6 Authorization

- "Authorization is OPTIONAL". Servers that use HTTP transports SHOULD follow the authorization
  section. Servers that use STDIO SHOULD NOT follow it and should take credentials from the
  environment. [P6 · rev 2026-07-28]
- The section is built on two IETF Internet-Drafts, not on final standards:
  `draft-ietf-oauth-v2-1-13` (OAuth 2.1) and `draft-ietf-oauth-client-id-metadata-document-00`. [P6
  · rev 2026-07-28]
- Required behaviour: servers MUST validate the token audience (RFC 8707); clients MUST send the
  `resource` parameter; PKCE with S256 is required; "The MCP server MUST NOT pass through the token it
  received from the MCP client". [P6 · rev 2026-07-28] The page says a future revision is expected to
  raise `iss` from SHOULD to MUST. [P6 · rev 2026-07-28]
- Scope: servers SHOULD put a `scope` in the `WWW-Authenticate` challenge "following the principle of
  least privilege". If the challenge has none, clients fall back to requesting all of
  `scopes_supported`. [P6 · rev 2026-07-28]
- The Security Best Practices page recommends a progressive, minimal scope model. It lists the common
  mistakes: publishing every scope, wildcard scopes, and bundling scopes. [P8 · rev 2026-07-28]
- That page also covers: the confused deputy problem (static client ID plus dynamic registration plus
  a consent cookie, which needs per-client consent); token passthrough ("explicitly forbidden");
  request forgery from OAuth discovery (block private ranges, use an egress proxy); state-handle
  hijacking (new in this revision, replacing session hijacking; bind handles to the verified user);
  local server compromise; unsafe OAuth URLs (reject `javascript:` and never open URLs through a
  shell); mix-up attacks; localhost redirect impersonation; trust policy for Client ID Metadata
  Documents. For session IDs in 2025-11-25 and earlier it points to the old revision of the page. [P8
  · rev 2026-07-28]

### 2.7 Government and standards-body guidance

**NSA, "Model Context Protocol (MCP): Security Design Considerations for AI-Driven Automation".**
[P13 · May 2026]

- A 17-page NSA Cybersecurity Information sheet. The footer reads "U/OO/6030316-26 | PP-26-1834 | May
  2026 Ver. 1.0". The file's path on `media.defense.gov` carries 2026/Jun/02. The earliest Internet
  Archive capture that returned the PDF is 2026-06-12. I read that capture, not the NSA site.
- It cites the 2025-11-25 spec pages in its reference list. It was written before the 2026-07-28
  revision. Its session and lifecycle concerns describe the older design.
- Concerns it names: access control left to the implementer; insecure serialisation; poor approval
  workflows (a trusted server can change what it does without a new approval); token and session
  security; misconfiguration; inconsistent behaviour; missing audit logs; denial of service.
- Examples it gives: tool-parameter injection; tool-name collisions; the GitHub MCP server's broad
  repository access; a WhatsApp case where a malicious server "advertised a benign instruction at the
  time of installation and switched to a malicious instruction after the MCP server's second usage";
  output poisoning in chained agents; CVE-2025-49596.
- Recommendations by heading: choose supported MCP projects (many popular servers are archived); design
  for boundaries and align tools with data-classification zones, preferring a local server for
  private data and filtering outbound traffic through a proxy or DLP; validate parameters; constrain
  and sandbox tool execution; sign and verify messages (NSA proposes adding signatures inside the JSON
  payload, which the spec does not define); treat every tool output as untrusted input to the next
  step; log every tool and model call with parameters and identities; track and patch MCP
  vulnerabilities and keep an inventory of deployed MCP agents and tools with versions; scan the
  network for open or unapproved MCP servers.
- It says "MCP-aware security proxies remain limited and are still maturing". It concludes that MCP's
  security posture "remains uneven and highly dependent on implementation discipline rather than
  protocol guarantees". It points readers to the joint agentic-AI guidance below.

**"Careful adoption of agentic AI services".** First published and last updated 2026-05-01. [P14 ·
2026-05-01]

- Co-authored by the Australian Cyber Security Centre (ASD), CISA, NSA, the Canadian Centre for Cyber
  Security, New Zealand's NCSC and the UK NCSC. I read an Internet Archive copy of the ASD page.
- It never names MCP. I searched the text for it.
- Its tool-related advice: "Restrict tool use to an approved allow list of tools and versions that are
  regularly verified as secure"; "Log agent tool usage and ensure results are captured in system logs
  in a human-readable format"; "Establish trigger-action protocols that automatically restrict agent
  permissions when unexpected behaviour emerges".
- Its privilege advice: "Limit privileges of AI agents to the minimum required for its task"; "Require
  just-in-time credentials for high-impact or privileged actions"; "Replace static, long-lived
  secrets with ephemeral credentials that expire when the job is complete".
- Its risk text warns that "Unvetted third-party components may carry excessive or unintended
  privileges", and that if permissions are checked only at start-up "a malicious actor can exploit a
  stale 'allow' decision".
- Its overall line: use agentic AI "only ... for low-risk and non-sensitive tasks" and never grant
  "broad or unrestricted access, especially to sensitive data or critical systems".

**UK NCSC, "Prompt injection is not SQL injection"** (title taken from the URL), by Dave Chismon.
[P15 · 2025-12-08]

- Prompt injection "may never be totally mitigated". Treat the model as an "inherently confusable
  deputy". Use deterministic safeguards that are not themselves models and that limit what the system
  can do. Deny-listing is weak. Monitor tool calls. The post does not name MCP.

**NIST.** [P16 · 2026-02-17] [P17 · 2026-05-18] [P18 · 2026-02]

- 2026-02-17: NIST announced an AI Agent Standards Initiative. [P16]
- 2026-05-18: NIST AI 800-5, a summary of responses to a security RFI from its Center for AI Standards
  and Innovation. Only the abstract was readable: commenters agreed agents bring new security threats,
  and that basic cybersecurity practice "remain[s] relevant" but "will require adaptation". [P17]
- February 2026: an NCCoE draft concept paper on agent identity and authorization asks about MCP and
  least privilege. It gives no guidance. Comments ran 2026-02-05 to 2026-04-02. [P18]

**OWASP.** [P19 · undated] [P20 · 2026-02]

- The MCP Top 10 project page says "Phase 3 – Beta Release and Pilot Testing — We are here right now".
  Titles, shortened: MCP01 token mismanagement; MCP02 scope creep; MCP03 tool poisoning; MCP04 supply
  chain; MCP05 command injection; MCP06 prompt injection through context; MCP07 weak authentication
  and authorization; MCP08 missing audit and telemetry; MCP09 shadow MCP servers; MCP10 context
  over-sharing. [P19]
- "A Practical Guide for Secure MCP Server Development", version 1.0, February 2026, licence CC BY-SA
  4.0. It is written for people who build servers. Its checklist, "MCP Security Minimum Bar", has five
  blocks: OAuth 2.1 or OIDC for every remote server, short-lived scoped tokens, no token passthrough,
  central policy enforcement; isolation of users and sessions; tools that are "cryptographically
  signed, version-pinned, and formally approved" with descriptions checked against runtime behaviour;
  schema-checked inputs and outputs; containers, vaulted secrets "never exposed to the LLM", CI gates,
  audit logs and monitoring. [P20]
- On prompt injection it lists structured tool calls, a human approval step for high-risk actions
  "(e.g., deleting data, sending money, system-level changes)", a second model that approves risky
  calls ("LLM-as-a-Judge"), and one task per session. [P20]

### 2.8 What large clients and servers let an administrator do

- **GitHub MCP server.** Read-only mode takes precedence over any other setting. Toolsets or `--tools`
  act as an allowlist. Since the 2025-12-10 changelog, text from issues and pull requests is sanitised
  by default (invisible characters and unsafe HTML removed), and a "Lockdown" mode limits content from
  untrusted contributors in public repositories. The server docs call lockdown "a best-effort content
  filter ... it is not an authorization boundary". [P23 · 2025-12-10]
- **Claude Code.** Administrators can publish an approved server list. With `allowedMcpServers` and
  `allowManagedMcpServersOnly: true` the list is binding; without the second flag, user settings merge
  in and can widen it. The docs warn: "A serverName entry, in either list, is not a security control".
  Matching by `serverUrl` or `serverCommand` is what enforces which server runs. [P24 · undated, read
  2026-10-02]
- **OpenAI Responses API.** "The MCP tool in the Responses API defaults to requiring approvals of each
  MCP tool call". The guide tells developers to use `allowed_tools` to import a subset, to log data
  sent to MCP servers, and to "Pick official servers hosted by the service providers themselves"
  rather than a third party's copy. It warns that "MCP servers may update tool behavior unexpectedly".
  It also says developers may skip approvals "once you gain confidence" in a server. [P25 · undated,
  read 2026-10-02]
- **Microsoft, Windows 11.** The Build 2025 post describes plans. Threats it lists: cross-prompt
  injection, authentication gaps ("OAuth is optional"), credential leakage, tool poisoning, lack of
  containment, registry supply chain, command injection. Controls it lists: proxy-mediated
  communication, per-client-and-tool approval, a central registry, least privilege. The post is 16
  months old and I did not check what shipped. [P26 · 2025-05-19]

### 2.9 Design heuristics from practitioners

- **Agents Rule of Two (Meta).** An agent should have no more than two of: (A) it processes untrusted
  input; (B) it can reach sensitive systems or private data; (C) it can change state or communicate
  outward. With all three it needs supervision. Meta calls the rule "a supplement — and not a
  substitute" for least privilege, and calls prompt injection "a fundamental, unsolved weakness in all
  LLMs". The post names MCP in its closing section. [P27 · 2025-10-31]
- **Lethal trifecta (Simon Willison).** Private data, untrusted content and a way to communicate out.
  He argues that guardrail products claiming "95%" detection are a failing grade. This is a personal
  blog and a heuristic, not a standard. [S3 · 2025-06-16]

### 2.10 Incidents and records, each dated

**CVE records.** NVD (NIST) is the primary source for every row except CVE-2026-5029, whose source
is the CERT Polska advisory [P22 · 2026-05-12]. "Published" is NVD's date. [P21]

| CVE            | Product                     | What NVD says                                                                                              | CVSS shown                                | Published  |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------- |
| CVE-2025-49596 | MCP Inspector, before 0.14.1 | Remote code execution; no authentication between the client and the proxy (CWE-306)                       | not recorded                              | 2025-06-13 |
| CVE-2025-6514  | mcp-remote                  | OS command injection from an untrusted server's `authorization_endpoint`                                   | 9.6                                       | 2025-07-09 |
| CVE-2026-33032 | nginx-ui MCP                | `/mcp_message` allows everyone when the whitelist is empty; no patch at publication                        | 9.8                                       | 2026-03-30 |
| CVE-2026-30615 | Windsurf 1.9544.26          | Prompt injection through attacker HTML changes the local MCP config and registers a malicious STDIO server | 8.0 High; status "Deferred"               | 2026-04-15 |
| CVE-2026-40933 | Flowise, before 3.1.0       | Authenticated user adds an MCP STDIO server with any command; checks bypassed                              | 9.9 (GitHub advisory score, via NVD)      | 2026-04-21 |
| CVE-2026-5029  | Code Runner MCP Server      | No authentication on `/mcp`; a `run-code` tool; unfixed in all versions (CERT Polska advisory)             | not recorded                              | 2026-05-12 |
| CVE-2026-30623 | LiteLLM 1.18.10             | Users can add an MCP server with any `command` and `args`; run on the host without checks                  | 9.8                                       | 2026-07-15 |
| CVE-2026-53957 | Contentful MCP              | Model-controlled host and proxy options plus the management token, reached by prompt injection; fixed in server 1.7.19 and tools 0.4.5 | 7.7 | 2026-09-15 |

**Narratives.** Each is a company or researcher describing its own finding.

- **Tool poisoning — Invariant Labs, 2025-04-01.** It describes hidden instructions in tool
  descriptions, "rug pulls" (a tool changes after approval) and one server shadowing another, with a
  Cursor demo. Mitigations it names: a user interface that shows full descriptions, version or hash
  pinning, and limits on data flow between servers. Invariant sells guardrail and scanning products.
  [P28 · 2025-04-01]
- **GitHub private-repository leak — Invariant Labs, 2025-05-26.** A malicious issue in a public
  repository prompt-injects the agent. The agent pulls private-repository data and leaks it in a pull
  request on the public repository. Invariant: "this is not a flaw in the GitHub MCP server code
  itself, but rather a fundamental architectural issue that must be addressed at the agent system
  level". It notes Claude Desktop asks for confirmation by default but "many users already opt for an
  'Always Allow' confirmation policy". Its fixes are least-privilege repository access and monitoring,
  and it points to its own products. [P29 · 2025-05-26]
- **`postmark-mcp` — Koi Security and Postmark, both 2025-09-25.** An npm package that impersonated
  Postmark was clean through version 1.0.15. Version 1.0.16 added a hidden BCC of outgoing mail to the
  attacker. Postmark's own statement: the attacker "built trust over 15 versions, then added a
  backdoor in version 1.0.16", Postmark "had absolutely nothing to do with" the package, and it had
  not published its MCP server on npm. Koi dates 1.0.16 to 2025-09-17. The Hacker News (2025-09-29)
  reports 1,643 downloads. "First malicious MCP server in the wild" is Koi's own claim, and Koi calls
  its exposure estimates "guestimates". [P32 · 2025-09-25] [P33 · 2025-09-25] [S4 · 2025-09-29]
- **STDIO disclosure — OX Security, 2026-04-15 (page modified 2026-07-21).** OX says command execution
  from STDIO configuration is "an architectural design decision baked into Anthropic's official MCP
  SDKs". It reports four exploit families: unauthenticated interface injection, hardening bypasses,
  zero-click prompt injection in AI editors, and malicious marketplace entries ("9 out of 11 MCP
  registries were successfully 'poisoned' with a malicious trial balloon"). It claims "150M+
  downloads, 7,000+ publicly accessible servers — and up to 200,000 vulnerable instances", more than
  30 disclosures and "10 CVEs". These are OX's numbers and OX sells security products. [P30 ·
  2026-04-15] Secondary retellings: The Hacker News, 2026-04-20 [S1]; a Cloud Security Alliance
  research note, 2026-04-20 [S2], which says on its cover that it is AI-assisted and "has not
  undergone official CSA review".
- **"Agentjacking" — Tenet Security, 2026-06-17 (modified 2026-09-03).** Someone posts a fake error
  event to a Sentry project using its public DSN. The Sentry MCP server returns it as trusted output.
  Claude Code and Cursor then run attacker packages. Tenet claims 2,388 organisations exposed, 100+
  agents hijacked in controlled tests and a "Fortune 100" victim. These figures are the vendor's and
  I could not check them. I did not capture whether Sentry responded. [P31 · 2026-06-17]

### 2.11 Where the sources agree

My grouping. Every cell can be checked against the paragraph above that carries the tag.

| Control                                                       | Sources that state it                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Treat tool descriptions and tool output as untrusted          | P1, P4, P13, P20                                                                |
| Keep a person able to deny risky calls                        | P4 (SHOULD), P20, P25 (default), P27 (when all three properties hold)           |
| Narrow permissions, short-lived credentials                   | P6, P8, P14, P20, P23                                                           |
| An approved list of servers and tools, with versions          | P14, P24, P25 (`allowed_tools`), P20 (pinning, signing), P13 (inventory)        |
| Log tool calls and review the logs                            | P4 (clients SHOULD log), P13, P14, P20, P25                                     |
| Sandbox local servers                                         | P8, P13, P20; P9 says STDIO "is not a sandbox"                                  |
| No token passthrough; check the token audience                | P6, P8, P20                                                                     |
| Prefer a server run by the service's own provider             | P25, P13 (choose supported projects), P30 (OX's remediation list)               |
| Keep an inventory; look for unapproved servers                | P13, P19 (MCP09), P14 (allow list)                                              |

## 3. What is contested or unsettled

### 3.1 Is running a command from a config file a flaw?

- OX says it is an architectural flaw in the official SDKs and that Anthropic "declined to modify the
  protocol's architecture, citing the behavior as 'expected'". It asks for manifest-only execution or
  a command allowlist in the SDKs. [P30 · 2026-04-15]
- The project's `SECURITY.md` says STDIO command execution "is an intended feature, not a
  vulnerability". Git history for that file (GitHub API, read 2026-10-02): the trust-model section was
  added 2026-01-16, and the stdio trust-boundary paragraph on 2026-06-25. [P9 · 2026-06-25]
- The spec's best-practice page sits between them: STDIO "is not inherently vulnerable", yet setup
  MUST show the exact command. [P8 · rev 2026-07-28]
- "Sanitization is the developer's responsibility" is OX's wording of Anthropic's position. I found no
  first-party Anthropic statement beyond `SECURITY.md`. [P30 · 2026-04-15]
- The CSA note says Anthropic updated `SECURITY.md` nine days after OX's first contact in January
  2026. The commit date fits a January change, but the nine-day figure comes only from a note that
  calls itself unreviewed. [S2 · 2026-04-20] [P9]
- OX's own numbers do not reconcile with the records. Its table lists CVE-2026-33224 twice (Bisheng
  and Jaaz). The Hacker News counts eleven and adds Flowise. OX calls the Windsurf CVE Critical; NVD
  shows 8.0 High with status "Deferred". The CSA note gives the Flowise score as 10.0; NVD shows 9.9.
  [P30 · 2026-04-15] [S1 · 2026-04-20] [P21] [S2 · 2026-04-20]

### 3.2 Can prompt injection be solved?

- The UK NCSC says it "may never be totally mitigated". Meta calls it "a fundamental, unsolved
  weakness in all LLMs". [P15 · 2025-12-08] [P27 · 2025-10-31]
- GitHub ships sanitisation and a lockdown mode, and says lockdown is "best-effort" and "not an
  authorization boundary". [P23 · 2025-12-10]
- Sources split on the fix. The NCSC advises deterministic safeguards that are not models. The OWASP
  guide lists a second model as an approver ("LLM-as-a-Judge"). [P15 · 2025-12-08] [P20 · 2026-02]

### 3.3 Do approval prompts protect anyone?

- The spec says there SHOULD be a human in the loop. [P4 · rev 2026-07-28]
- Invariant reports that many users choose "Always Allow". It also argues the interface must show full
  tool descriptions so a person can see what they approve. [P29 · 2025-05-26] [P28 · 2025-04-01]
- OpenAI defaults to approval and then says to skip it once a server is trusted. [P25 · undated]

### 3.4 The authorization stack is optional, draft-based and moving

- The spec calls authorization OPTIONAL. The NSA lists that as a gap; the OWASP guide says to treat
  authentication as mandatory for all remote servers. [P6 · rev 2026-07-28] [P13 · May 2026] [P20 ·
  2026-02]
- It rests on two Internet-Drafts. Dynamic Client Registration is deprecated in this revision. The
  page says `iss` is expected to move from SHOULD to MUST in a later revision. [P6, P3 · rev 2026-07-28]
- Scope defaults pull two ways: with no scope in the challenge, clients request all of
  `scopes_supported`; the best-practice page asks for progressive minimal scopes. [P6, P8 · rev
  2026-07-28]
- Secrets pull two ways: the spec points STDIO servers to the environment for credentials; the OWASP
  guide says "Do not store secrets in environment variables". They address different readers. [P6 ·
  rev 2026-07-28] [P20 · 2026-02]

### 3.5 Pinning and signing are advised but not specified

- The OWASP guide and Invariant call for signed manifests, version pinning and hash checks of tool
  descriptions. I found no signed-manifest mechanism in the spec pages I read, only an optional
  list-changed notice that an honest server sends. [P20 · 2026-02] [P28 · 2025-04-01] [P4 · rev
  2026-07-28]
- That a deceptive server would not send the notice is my inference.

### 3.6 "Use the official directory" versus how the directory describes itself

- The MCP Registry is "in preview. Breaking changes or data resets may occur". It checks who owns a
  namespace. It leaves code scanning to package registries. Its policy says "consumers should assume
  minimal-to-no moderation". [P10 · undated, read 2026-10-02]
- OX advises installing only from "verified sources (like the official GitHub MCP Registry)". The NSA
  suggests enrolling servers in the MCP Registry for internal use. OpenAI advises first-party servers.
  [P30 · 2026-04-15] [P13 · May 2026] [P25 · undated] I did not check how GitHub's registry vets
  entries.

### 3.7 Status of the OWASP material

- The MCP Top 10 page still says beta, and carries no date. The practical guide is version 1.0 and
  addresses server builders. A company that only connects to third-party servers uses its tooling and
  governance parts more than the rest (my reading). [P19] [P20 · 2026-02]

### 3.8 Churn

- The 2026-07-28 revision is breaking, and 12-month deprecation windows are now running. [P3 · rev
  2026-07-28]
- The NSA sheet, the CSA note and the incident posts predate it. Session-hijacking advice now applies
  to 2025-11-25 and earlier; the best-practice page sends readers to the old page for it. [P13] [P8]

### 3.9 Vendor interest and self-reported numbers

- Invariant, OX, Tenet and Koi sell security products. Their download, server, victim and "first ever"
  counts are their own. The project's adoption figures are also its own. None was independently
  checked. [P28, P29, P30, P31, P33] [P11, P12]

### 3.10 Gaps and date conflicts

- The NSA sheet's date: the footer says May 2026; the file path says 2026-06-02. [P13]
- The ASD joint guidance never names MCP. NIST has no MCP-specific text I could read; the CAISI report
  body was not retrievable. [P14] [P17] [P18]
- Tenet's page says 2026-06-17; a third-party summary said 12 June. The page date is used. [P31]
- I did not search for EU AI Act or ISO/IEC 42001 text on MCP. This record makes no claim there.
- I did not read the extension pages (Tasks, MCP Apps, Skills over MCP) or the lifecycle page.

## 4. What is already on meshin.co

**MCP on the site today.** Search of `site/dist/` and `site/src/` on 2026-10-02. There is no glossary
term and no article. The only mention is the case study `/case-studies/only-help-agentic-support`
(source `site/src/data/case/only-help-agentic-support.md`, `updatedDate` 2026-10-02):

- Front matter line 16 lists "Model Context Protocol" under `stack`.
- Table row, line 36: "[Model Context Protocol](https://modelcontextprotocol.io) as the tool
  boundary | Keeps what the agent may call explicit and narrow, instead of improvised inside a
  prompt."
- Copies of that text are in `dist/feed.json`, `dist/llms/case.txt`, `dist/llms-full.txt`,
  `dist/search-index-case.json`, `dist/rss.xml` and `dist/case-studies/rss.xml`.
- The spec says MCP "cannot enforce these security principles at the protocol level" [P1]. So whether
  a tool boundary is "explicit and narrow" depends on host and server settings. The case study does
  not say which tools, whether they could change anything, whose credentials they held, or whether a
  person approved calls.
- `/approach` has no MCP text. The label "Tools via MCP (least privilege)" appears only in
  `docs/PRD.md` Appendix B (lines 1177–1179). `docs/PRD.md` line 789 plans a JSON-LD `knowsAbout`
  entry "Model Context Protocol"; no built page carries it.

**Existing routes the page links to instead of redefining** (L50 and L51: one concept, one page). The
one-line definitions are as built on 2026-10-02.

| Route                       | What it already defines or says                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/glossary/prompt-injection` | "text, typed directly or hidden in a document a model reads, that gets the model to follow it as an instruction". Also says: keep the model's own permissions to the smallest set it needs; treat anything read from outside as untrusted. |
| `/glossary/guardrails`       | "code checks on what a model responds to, what it can say and what it can do, not rules typed into a prompt"                                   |
| `/glossary/human-in-the-loop` | "a person reviews or can stop an AI system's output before it takes effect"                                                                   |
| `/glossary/agentic-workflow` | Agents "call tools and choose the next move". Says to list every action an agent can take and to set a real limit on what it does without a person confirming, "especially anything that spends money, touches a customer record, or sends something externally". |
| `/glossary/llm-gateway`      | A single service every call to a language model passes through. It covers model calls, not tool calls.                                         |
| `/glossary/shadow-ai`        | AI tools used without IT or security knowing. OWASP's MCP09 (shadow MCP servers) is the same idea for servers.                                  |
| `/glossary/observability`    | Logs every step "including tool calls", for every real request.                                                                                |
| `/glossary/red-teaming`      | Trying to break the system the way an attacker would.                                                                                          |
| `/glossary/data-classification` | Labelling data by sensitivity before deciding what may reach an AI tool. The NSA sheet aligns tools with data zones.                        |
| `/glossary/ai-register`      | A company's inventory of AI systems it builds, buys or uses. The NSA sheet asks for an inventory of MCP agents and tools.                      |
| `/glossary/sub-processor`    | A vendor an AI provider uses behind the scenes to handle a company's data.                                                                     |
| `/glossary/model-provenance` | Where a model comes from. It is about models, not tool servers.                                                                                |
| `/security`                  | Updated 2026-09-23. The owner's published credential stance: "a named account in your own systems, scoped to the work, so you hold the off-switch and revoke it at handover", and a handover list of every credential held. |
| `/resources/ai-governance-starter-kit` | Holds the vendor questionnaire, register and data-classification table.                                                              |

**"Least privilege" has no home yet.** The words appear in no built route file. Worklist item 5 gives
the MCP term the job of explaining least-privilege scoping. If it does, that term becomes the concept's
one home, and `/glossary/prompt-injection` already states a nearby idea in plain words.

**In the owner's planning documents, not on the site.** `docs/sources/reference-stack.mhtml`
(Russian) lists the default stack offered to clients with "Tools: MCP-серверы (FastMCP),
least-privilege OAuth" (my translation: MCP servers built with FastMCP, least-privilege OAuth) and a
gateway "LiteLLM proxy" for audit, budgets, fallback and DLP. This is a plan. Nothing in the repo
confirms it as practice on client work.

**What the repo's own gates do to a new term** (checked read-only on 2026-10-02; nothing was run that
writes).

- Term profile: at least 1 internal and 1 external link (`site/scripts/content-rows.mjs` line 16).
  External links carry `rel` under L55.
- `site/content-facts.json` holds a `targetQuery` for each of the 30 existing terms. It equals the term
  name ("prompt injection", "llm gateway"). The rule needs every word of the query in the h1 and in the
  first 100 words. No MCP entry exists.
- The unsourced-number rule (`numberClaims`, lines 20–46) flags digits not on the allowed list in
  `content-facts.json`: "30", "300", "90", "42001", "27001", "2", "3", "1", "0.1", "14", "71", "1,000",
  "155", "12", "6", "24". Tested with the gate's own regex: `2026-07-28` is flagged twice ("07", "28");
  `28 July 2026` and `July 28, 2026` pass; `OAuth 2.1` ("2.1"), `RFC 8707` ("8707"), `CVE-2025-6514`
  ("6514"), a score such as `9.6` and `Version 1.0` ("1.0") are flagged; `NIST AI 800-5` passes.
- The entity register in `docs/SEMANTIC-CORE.md` is generated by `npm run assets:registers`. A new
  term changes it. I did not run it.
- `AGENTS.md`: an unknown owner fact becomes a `TODO(owner)` line in `docs/COPY-CHECKLIST.md`. I added
  none.

## 5. What only the owner can supply

No source can answer these. Questions 1–9 are facts the page cannot state without them.

**The sentence already live**

1. The case study `only-help-agentic-support` says MCP is "the tool boundary" that "keeps what the
   agent may call explicit and narrow". Which tools did the agent call through MCP? Could any change
   data or send anything out? Whose credentials did the servers hold? Did any call need a person's
   approval?
2. Is that sentence true as written? If not, what should it say?

**Method and thresholds**

3. For a new agent tool, what is the default permission (read-only first?), and which named actions
   always need a person's approval? Is the line set by reversibility, money, data class
   (`/glossary/data-classification`) or something else? Give two examples on each side.
4. Do you use the Rule of Two or the lethal trifecta in design reviews? If yes, where is the result
   recorded, for example a column in the AI register? If no, what do you use?
5. Where do MCP credentials live, who rotates them, and how long do tokens last (a number)? Are
   personal access tokens ever allowed?
6. What do you do before a third-party MCP server is added: source review, pinned version or hash,
   publisher check, sandbox, trial run? In what order, and who signs it off? Does the client receive
   an approved-server list?
7. Do you pin server versions and tool descriptions and review the difference on each update? How, and
   how often?
8. Do you run servers locally over STDIO or remotely over HTTP for client work, and in which sandbox
   or container? Do you want the page to take a side in the STDIO dispute?
9. Is MCP traffic routed through a gateway or proxy? What is logged (calls, arguments, results), for
   how long, and who reviews it and how often? `/glossary/llm-gateway` covers model calls only.

**Proof**

10. Is there an incident, near miss or red-team finding from your own work that can be told with names
    removed? Give the date, what happened and what changed. If there is none, say "none"; the page then
    claims none.
11. Do any client contracts limit how you may describe an MCP deployment?

**Offer and artifact**

12. Which offer carries MCP security — the Assessment, the Sprint or the retainer? What does the client
    receive: a server inventory in the register, an approved-server list, a threat model, a checklist
    resource?

**Position and upkeep**

13. Which spec revision do client deployments run, 2025-11-25 or 2026-07-28? Do you advise upgrading,
    and by when?
14. How often will you review the page, and what triggers an early review (a new spec revision, a new
    class of CVE)? Do you want a "last reviewed" date on it?
15. Are you comfortable citing vendor incidents that are partly marketing (Invariant, OX, Tenet, Koi),
    flagged as such? Or only government, standards-body and CVE sources?
16. Slug: `/glossary/mcp` or `/glossary/model-context-protocol`? Existing slugs use short forms
    (`llm-gateway`, `nist-ai-rmf`, `eu-ai-act`). Should the h1 stay the bare term, as on every other
    term page, or carry "security" so it matches the prompt?
17. Do you want the article that worklist item 5 names as the second step, and when?

## 6. Sources

All read on 2026-10-02 unless the note says otherwise. "Primary" and "secondary" are defined at the top
of this record.

### Primary

| Tag | Publisher — title                                                                  | Date                          | URL                                                                                                                          |
| --- | ---------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P1  | Model Context Protocol project — Specification overview                            | rev 2026-07-28                | https://modelcontextprotocol.io/specification/2026-07-28                                                                     |
| P2  | Model Context Protocol project — Versioning; draft changelog                       | fetched 2026-10-02 08:42 UTC  | https://modelcontextprotocol.io/specification/versioning ; https://modelcontextprotocol.io/specification/draft/changelog     |
| P3  | Model Context Protocol project — Changelog, 2026-07-28                             | rev 2026-07-28                | https://modelcontextprotocol.io/specification/2026-07-28/changelog                                                           |
| P4  | Model Context Protocol project — Tools                                             | rev 2026-07-28                | https://modelcontextprotocol.io/specification/2026-07-28/server/tools                                                        |
| P5  | Model Context Protocol project — Architecture                                      | rev 2026-07-28                | https://modelcontextprotocol.io/specification/2026-07-28/architecture                                                        |
| P6  | Model Context Protocol project — Authorization, and its security considerations    | rev 2026-07-28                | https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization ; https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations |
| P7  | Model Context Protocol project — Streamable HTTP transport                         | rev 2026-07-28                | https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http                                    |
| P8  | Model Context Protocol project — Security Best Practices                           | rev 2026-07-28                | https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices                                   |
| P9  | Model Context Protocol project — `SECURITY.md`                                     | last commit 2026-06-25        | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md (read raw; history via the GitHub API)    |
| P10 | Model Context Protocol project — MCP Registry: About; Moderation policy            | undated; registry in preview  | https://modelcontextprotocol.io/registry/about ; https://modelcontextprotocol.io/registry/moderation-policy                  |
| P11 | Model Context Protocol blog — 2026-07-28 release (D. Soria Parra, D. Delimarsky)   | 2026-07-28                    | https://blog.modelcontextprotocol.io/posts/2026-07-28/                                                                       |
| P12 | Model Context Protocol blog — MCP joins the Agentic AI Foundation                  | 2025-12-09                    | https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/                                       |
| P13 | NSA — Cybersecurity Information: MCP Security Design Considerations for AI-Driven Automation | May 2026 (footer); path 2026-06-02 | https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF — read via https://web.archive.org/web/20260612015047id_/https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF (the NSA host blocked my fetch) |
| P14 | ASD's ACSC with CISA, NSA, Canadian Cyber Centre, NCSC-NZ, NCSC-UK — Careful adoption of agentic AI services | 2026-05-01 | https://www.cyber.gov.au/business-government/secure-design/artificial-intelligence/careful-adoption-of-agentic-ai-services (read via an Internet Archive copy, captured 2026-09-17) |
| P15 | UK NCSC (Dave Chismon) — Prompt injection is not SQL injection                     | 2025-12-08                    | https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection                                                      |
| P16 | NIST — Announcing the AI Agent Standards Initiative                                | 2026-02-17                    | https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure              |
| P17 | NIST CAISI — Summary Analysis of Responses to the RFI on Security Considerations for AI Agents (NIST AI 800-5); abstract only | 2026-05-18 | https://www.nist.gov/publications/summary-analysis-responses-request-information-regarding-security-considerations-ai |
| P18 | NIST NCCoE — concept paper on software and AI agent identity and authorization (draft)  | 2026-02 (from the URL path)   | https://www.nccoe.nist.gov/sites/default/files/2026-02/accelerating-the-adoption-of-software-and-ai-agent-identity-and-authorization-concept-paper.pdf |
| P19 | OWASP — MCP Top 10 project page                                                    | undated; status beta          | https://owasp.org/www-project-mcp-top-10/                                                                                    |
| P20 | OWASP GenAI Security Project — A Practical Guide for Secure MCP Server Development, v1.0 | 2026-02 (resource page 2026-02-16) | https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/                                 |
| P21 | NIST NVD — CVE records (see list below)                                            | 2025-06-13 to 2026-09-15      | https://nvd.nist.gov/vuln/detail/<CVE-ID>                                                                                    |
| P22 | CERT Polska — CVE-2026-5029 (Code Runner MCP Server)                               | 2026-05-12                    | https://cert.pl/en/posts/2026/05/CVE-2026-5029/                                                                              |
| P23 | GitHub — GitHub MCP Server configuration docs; changelog "tool-specific configuration, and more" | 2025-12-10 (changelog) | https://raw.githubusercontent.com/github/github-mcp-server/main/docs/server-configuration.md ; https://github.blog/changelog/2025-12-10-the-github-mcp-server-adds-support-for-tool-specific-configuration-and-more/ |
| P24 | Anthropic — Claude Code docs: Managed MCP configuration                            | undated                       | https://code.claude.com/docs/en/managed-mcp.md                                                                               |
| P25 | OpenAI — API guide: MCP servers (Responses API), "Risks and safety"                | undated                       | https://developers.openai.com/api/docs/guides/tools-connectors-mcp                                                           |
| P26 | Microsoft (David Weston) — Securing the Model Context Protocol: Building a safer agentic future on Windows | 2025-05-19    | https://blogs.windows.com/windowsexperience/2025/05/19/securing-the-model-context-protocol-building-a-safer-agentic-future-on-windows/ |
| P27 | Meta AI — post introducing the Agents Rule of Two (slug `practical-ai-agent-security`) | 2025-10-31                | https://ai.meta.com/blog/practical-ai-agent-security/                                                                        |
| P28 | Invariant Labs — MCP security notification: tool poisoning attacks (vendor)        | 2025-04-01                    | https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks                                               |
| P29 | Invariant Labs — GitHub MCP Exploited: Accessing private repositories via MCP (vendor) | 2025-05-26               | https://invariantlabs.ai/blog/mcp-github-vulnerability                                                                       |
| P30 | OX Security — The Mother of All AI Supply Chains (vendor)                          | 2026-04-15; modified 2026-07-21 | https://www.ox.security/blog/the-mother-of-all-ai-supply-chains-critical-systemic-vulnerability-at-the-core-of-the-mcp/    |
| P31 | Tenet Security — Agentjacking coding agents with fake Sentry errors (vendor)       | 2026-06-17; modified 2026-09-03 | https://tenetsecurity.ai/blog/agentjacking-coding-agents-with-fake-sentry-errors/                                          |
| P32 | Postmark (ActiveCampaign) — Information regarding malicious "postmark-mcp" package | 2025-09-25                    | https://postmarkapp.com/blog/information-regarding-malicious-postmark-mcp-package                                            |
| P33 | Koi Security (Idan Dardikman) — First Malicious MCP in the Wild (vendor)           | 2025-09-25                    | https://www.koi.security/blog/postmark-mcp-npm-malicious-backdoor-email-theft (the original now redirects; read an archived copy) |

**P21 detail.** All at `https://nvd.nist.gov/vuln/detail/<CVE-ID>`. NVD last-modified dates: 2026-06-17
for CVE-2025-49596, CVE-2025-6514, CVE-2026-33032, CVE-2026-30615 and CVE-2026-40933; 2026-07-16 for
CVE-2026-30623; 2026-09-30 for CVE-2026-53957. NVD status for CVE-2026-30615 is "Deferred" and for
CVE-2026-30623 "Awaiting Analysis".

### Secondary

| Tag | Publisher — title                                                                | Date       | URL                                                                                                 |
| --- | -------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| S1  | The Hacker News — report on the OX Security disclosure                           | 2026-04-20 | https://thehackernews.com/2026/04/anthropic-mcp-design-vulnerability.html                           |
| S2  | Cloud Security Alliance AI Safety Initiative — "MCP by Design: RCE Across the AI Agent Ecosystem" (marked "Unofficial AI-assisted Research"; not reviewed by CSA) | 2026-04-20 | https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/04/CSA_research_note_mcp-by-design-rce-ox-security_20260420-csa-styled.pdf |
| S3  | Simon Willison — The lethal trifecta (personal blog)                             | 2025-06-16 | https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/                                          |
| S4  | The Hacker News — first malicious MCP server found                               | 2025-09-29 | https://thehackernews.com/2025/09/first-malicious-mcp-server-found.html                             |

Count: 33 primary, 4 secondary. Every row carries a date; where a page shows none, the row says so and
the read date applies.
