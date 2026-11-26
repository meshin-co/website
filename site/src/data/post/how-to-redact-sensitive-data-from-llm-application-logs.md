---
title: How to redact sensitive data from LLM application logs
description: How to redact sensitive data from LLM application logs before records reach log sinks, with safe fields and tests.
publishDate: 2026-11-26
updatedDate: 2026-11-26
shortAnswer: Redact sensitive data from LLM application logs before records leave the application, and allow only fields needed for diagnosis. Omit prompts, responses, credentials, and personal data by default. Test application logs, traces, queues, and vendor tools, then restrict access and retention for the records that remain.
fullAnswer: LLM application logs need an allowlist of safe fields and a redaction step before any record leaves the application. Start by mapping where request data can appear, including model calls, tool results, errors, and traces. Record useful facts such as request status and duration without storing the prompt or response by default. Treat credentials as secrets to omit, not values to mask for later recovery. For fields that must contain free text, apply a tested redaction policy and treat its output as potentially sensitive. A missed value can still reach a log store, an alert, or a vendor dashboard. Set access and retention rules for those destinations, and check what happens when the redactor fails. Use synthetic data to test normal requests, errors, retries, and exported traces. Give someone authority to stop logging and handle any record that escapes the filter.
keyTakeaways:
  - Choose safe structured fields before deciding how to filter free text.
  - Apply the same policy to errors, traces, queues, and vendor exports.
  - Keep credentials out of logs and treat redacted text as potentially sensitive.
  - Test failure paths and give an owner authority to stop unsafe logging.
faq:
  - q: Can we log prompts if we remove names?
    a: Removing names alone is not a safe default. Prompts can contain credentials, contact details, private facts, and details that identify someone in context. Keep prompts out of routine logs unless an owner has approved a specific need and the controls for it.
  - q: Should redaction happen in the application or the log platform?
    a: Apply the main control before the record leaves the application. A log platform can add another filter, but it cannot prevent raw data from entering an upstream queue or collector.
  - q: What should happen if the redactor fails?
    a: Drop or replace the unsafe log record with a safe error event. Decide separately whether the user request can continue without that log, and alert the owner to the failure.
category: agentic-architecture
tags:
  - agentic-architecture
  - security-review
  - production-readiness
sources:
  - title: Logging Cheat Sheet
    url: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
    publisher: OWASP
    retrieved: '2026-11-26'
  - title: Guide to Protecting the Confidentiality of Personally Identifiable Information (PII)
    url: https://csrc.nist.gov/pubs/sp/800/122/final
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-26'
  - title: Guide to Computer Security Log Management
    url: https://csrc.nist.gov/pubs/sp/800/92/final
    publisher: National Institute of Standards and Technology
    retrieved: '2026-11-26'
author: dmitri
relatedResources:
  - llm-gateway-governance-config
  - agent-evals-ci-starter
---

## Where should redaction happen?

To decide how to redact sensitive data from LLM application logs, map every place that records a request. Start at the application boundary and follow the path through model calls, tool calls, error handlers, queues, and exports. Include local debugging and support tools in that map. A filter at the final log store cannot protect an earlier copy.

Put the main control in the code that constructs each log event. Pass that event through the control before it reaches a logger, trace collector, or queue. Disable automatic capture of request and response bodies where the library allows it. Check whether error reporting and tracing use separate settings.

Treat a log sink as any destination that receives a record, including a file or hosted service. Each sink needs a named owner and a way to stop unsafe writes. A central [LLM gateway](/glossary/llm-gateway) can provide a shared control point, but calls that bypass it still need protection. Review each path rather than assuming the gateway sees every event.

## Which fields should an LLM log keep?

Start with a small set of structured fields that supports a known operational task. A request identifier, outcome, duration, and model identifier can help a team investigate a failure without retaining conversation text. Use a random request identifier rather than an email address or customer name. Check that identifiers created by other systems do not contain personal data.

| Field or content                      | Default treatment        | Reason                                           |
| ------------------------------------- | ------------------------ | ------------------------------------------------ |
| Request status and duration           | Keep                     | Supports diagnosis without prompt text           |
| Prompt and model response             | Omit                     | Protect user data and secrets                    |
| Authorization headers and credentials | Omit                     | Do not expose access material                    |
| Tool arguments and results            | Omit unless approved     | Protect retrieved records                        |
| Error type                            | Keep if from a safe list | Supports grouping without copying raw exceptions |

Use the table as a starting policy, then check each field against the actual application. An error message can embed the request body even when the prompt field is absent. A tool name can also reveal a sensitive workflow. The site's [data classification](/glossary/data-classification) page can help the owner decide which records need stricter treatment. For logging controls, consult the [application logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## How should free text be filtered?

Avoid free text in routine logs where a fixed event code will do the job. If a team needs a text sample for a defined purpose, set an approval path before enabling capture. Record who can read it, where it goes, and when it will be removed. Apply the filter before the sample enters the logging pipeline.

Use field rules for known sensitive values and pattern checks for text that may contain them. Check for credentials, contact details, and identifiers relevant to the application. Normalize text before matching so encoding or formatting changes do not bypass a rule. Apply size limits before processing, and decide how the filter handles text it cannot parse.

Replace a detected value with a clear marker that preserves enough context to understand the event. Do not put the original value in a second field for troubleshooting. Pattern checks will miss some sensitive material and can remove harmless text, so review their results with synthetic examples. The [guidance on protecting personal information](https://csrc.nist.gov/pubs/sp/800/122/final) provides context for choosing safeguards.

## How can teams trace a request without storing its contents?

Trace the path with identifiers and event types rather than copies of each message. For example, record that a tool call started and ended, its safe tool name, and its outcome. Link those events with a random request identifier. Keep the link between that identifier and a customer record outside the log unless there is an approved need.

Review tracing libraries as carefully as the application logger. Automatic instrumentation may capture arguments, response bodies, headers, or exception messages. Inspect actual exported traces from a test environment, not just the settings in a dashboard. The article on [tracing AI agent tool calls](/blog/how-to-trace-ai-agent-tool-calls-in-production) covers the wider trace path.

If a team needs to group events for the same account, consider a keyed digest of an approved identifier. Store and control the key separately, and treat the resulting value as linkable data. Do not use this technique to keep a trace of credentials. A stable digest can still reveal relationships across events, so limit who can query it and where it travels.

## What happens when the filter cannot process a record?

Fail safely at the logging boundary. If the filter rejects a record or cannot parse it, drop the unsafe content and emit a fixed event code if that code is safe. Never fall back to writing the original object. Track dropped records with a counter that contains no copied input.

Decide separately whether the application request may continue. Some workflows may need to stop if a required audit event cannot be recorded. Others can continue while the logging owner investigates. Document that decision with the service owner, and avoid returning raw filter errors to the user.

Test the path where the logger itself fails, including full queues and unavailable collectors. Check that retry code does not retain the original event for a later unsafe write. Alerts should identify the service and failure type without attaching the rejected payload. An on-call owner needs a way to disable the affected capture setting while preserving safe operational signals.

## How do you test that redaction works?

Build a test set with invented names, contact details, tokens, and records that resemble the application's real inputs. Include nested objects, tool results, long messages, encoded text, and malformed payloads. Use synthetic secrets made for the test, not copied production credentials. Keep expected outputs beside each case so a reviewer can see what the filter should remove.

Run the cases through the actual logging and tracing path. Inspect the event before export and the record received by each test sink. Exercise normal requests, exceptions, retries, and any debug mode used by support staff. Check that a rejected record cannot appear in an alert or a dead-letter queue, a holding area for records that could not be delivered.

Add a release check when the application changes its model client, logging library, or event schema. The [agent evals starter](/resources/agent-evals-ci-starter) can support a test workflow, but the team still needs assertions for its own log sinks. A passing set shows the cases tested; it does not prove that every sensitive value will be caught.

## Where else can a redacted record travel?

Follow the record after it leaves the service. Collectors may forward it to search tools, alerts, support systems, archives, and vendor dashboards. Inventory those destinations and confirm which fields each one receives. Review vendor settings for request capture as well as the application's own export settings.

Restrict access to the people who need the records for a defined task. Set retention for each destination and check whether deletion reaches exports and backups. Redaction reduces exposure but does not make a record safe for unrestricted access. Other fields can still identify a person or reveal a private event when combined.

Ask the owner of each destination how to stop ingestion and remove a leaked record. The [log management guidance](https://csrc.nist.gov/pubs/sp/800/92/final) is a useful reference for planning the rest of the log lifecycle. For conversation records kept outside operational logs, coordinate with the separate [AI chat retention rules](/blog/how-to-set-ai-chat-retention-rules).

## What should the team do when sensitive data escapes?

Stop the affected capture path or block its export without copying the suspect record into a ticket. Tell the security owner which service, destination, and time range need review. Preserve the minimum evidence needed to investigate under restricted access. If a credential is exposed, revoke or rotate it through the normal credential process rather than relying on deletion alone.

Find every known copy, including queued events and vendor exports, and request removal where the team cannot delete it directly. Record what was removed and what remains subject to backup or vendor processes. Let the incident owner decide whether the event needs further reporting or customer contact.

After containment, add a synthetic case that reproduces the failure without retaining the exposed value. Review why the original control missed it and whether other services use the same logger. Assign an owner to verify the fix at each sink before capture resumes. Keep the safe failure signal in place so the team can see if the control breaks again.
