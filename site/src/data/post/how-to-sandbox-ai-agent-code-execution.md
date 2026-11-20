---
title: How to sandbox AI agent code execution
description: Learn how to sandbox AI agent code execution with isolated runtimes, restricted access, output checks, and tests.
publishDate: 2026-11-13
updatedDate: 2026-11-13
shortAnswer: To decide how to sandbox AI agent code execution, run each task in a disposable, isolated environment with no default network access or production credentials. Limit compute and storage, pass in only the files the task needs, and inspect output before it reaches other systems. Test escape paths and cleanup before allowing real workloads.
fullAnswer: Run agent-generated code in a disposable environment that has no production credentials and no default network access. Give each task only the files and tools it needs, then enforce limits on time, compute, processes, and storage. Treat anything the code returns as untrusted until a separate service checks it. The right isolation boundary depends on the harm a failed boundary could cause. A container can reduce exposure, but code that shares a host kernel still depends on that kernel's security. For hostile workloads or sensitive hosts, consider a stronger boundary such as a sandboxed runtime or a virtual machine. Keep external actions behind a separate service that checks each request against policy. Before release, test denied network calls, file access, resource exhaustion, cleanup, and attempts to carry state into another task. Record who owns the boundary and who responds when a test fails.
keyTakeaways:
  - Run each task in a fresh environment with only its approved inputs.
  - Deny network access and keep production credentials outside the execution environment.
  - Choose the isolation boundary according to the harm an escape could cause.
  - Check artifacts and test cleanup before results reach another system.
faq:
  - q: Is a container enough to run agent-generated code?
    a: A hardened container can reduce exposure, but it shares the host kernel. For code that may be hostile or can reach sensitive assets, assess a sandboxed runtime or virtual machine and test the whole setup.
  - q: Should sandboxed code have internet access?
    a: Deny network access by default. If a task needs an external service, route the request through a separate broker that checks the destination, action, and data being sent.
  - q: What should happen when a sandbox reaches its time limit?
    a: The controller should stop the workload, remove its execution environment, and report a timeout. It should also check whether any external action occurred before deciding if a retry is safe.
category: agentic-architecture
tags:
  - agentic-architecture
  - security-review
  - production-readiness
sources:
  - title: Docker Engine security
    url: https://docs.docker.com/engine/security/
    publisher: Docker
    retrieved: '2026-11-13'
  - title: Linux kernel security constraints
    url: https://kubernetes.io/docs/concepts/security/linux-kernel-security-constraints/
    publisher: Kubernetes
    retrieved: '2026-11-13'
  - title: Architecture Guide
    url: https://gvisor.dev/docs/architecture_guide/intro/
    publisher: gVisor
    retrieved: '2026-11-13'
author: dmitri
relatedResources:
  - agent-evals-ci-starter
---

## Where should agent code run?

The risk of an escape determines how to sandbox AI agent code execution for a given task. Start by listing what the code can read, write, and call. Include the host, nearby workloads, customer data, and any service that accepts its output. Decide what damage would matter if the code ignored every instruction in its prompt.

Run each task away from the agent's own process. A fresh environment should receive a narrow task input and return a bounded result. It should not share a writable workspace with other tasks or inherit the agent's secrets. Destroy the environment after the run, including temporary files and any writable layer.

Choose the boundary for the worst credible workload, not just the expected one. A container can restrict a process, but containers still depend on the host kernel. The [container security documentation](https://docs.docker.com/engine/security/) describes that shared-kernel boundary and other risks around the container engine. For more hostile code, assess a sandboxed runtime or a virtual machine on a dedicated host. Neither choice removes the need for patching, access controls, and tests.

## What should go into the execution environment?

Give the code a small base image with the runtime and tools required for its task. Build that image outside the task, from reviewed sources, and track its version. Avoid fetching dependencies while untrusted code runs. A task that can install arbitrary packages can also pull in code the team has not reviewed.

Copy in only the files needed for the requested work. Make inputs read-only where possible and give the task a separate writable output directory. Do not mount the host filesystem, a container management socket, cloud credentials, or service account tokens. Check inherited environment variables as well as mounted files. A secret can reach a task through either path.

Run the workload as an unprivileged user and remove permissions it does not need. Restrict system calls and filesystem access with controls supported by the host and runtime. The [kernel security guide](https://kubernetes.io/docs/concepts/security/linux-kernel-security-constraints/) explains controls available for workloads on Linux. Apply them through a tested policy rather than relying on a base image's defaults.

## How should network access and external actions work?

Deny inbound and outbound network access unless the task has a documented need. Check that the rule covers name lookups, alternate network paths, and access to host or cloud metadata services. Test the rule from inside the running environment. A policy declared in a deployment file is useful only if the runtime actually enforces it.

When code needs outside data, put a separate broker between the sandbox and the service. The broker should check the destination, operation, caller, and data before making a request. Give it a narrow identity that the sandbox cannot reuse as a general credential. Prefer a specific operation such as fetching an approved report over a general network proxy.

Keep writes and other consequential actions outside the execution environment. The agent can propose an action, but a policy check should decide whether it may proceed. Where an action needs human approval, bind that approval to the exact request. See the [agent tool-call tracing guide](/blog/how-to-trace-ai-agent-tool-calls-in-production) for a way to record those requests without placing secrets in the log.

## Which limits should stop a runaway task?

Set limits before execution for runtime, processor use, memory, process count, and writable storage. Choose values from the needs of the task and the capacity of the host. A timeout alone does not prevent a task from filling storage or starting many processes before it expires. Enforce limits outside the code being run.

The controller should stop the whole workload when a limit is reached. It should then remove the environment and report which limit caused the stop. Check that child processes cannot survive after the parent exits. Also bound the size of captured output, since an endless stream can exhaust the service collecting it.

Treat retries as new requests, not proof that the previous attempt did nothing. A task may have sent a request before it timed out, even if no result came back. Record the state of any brokered action before retrying it. The [guide to duplicate agent actions](/blog/how-to-prevent-duplicate-ai-agent-actions-on-retries) covers how to handle that uncertainty when an action changes an external system.

## How do results leave the sandbox safely?

Treat files, text, and exit status from the sandbox as untrusted input. A successful exit tells the controller that the process ended, not that its output is safe or correct. Check the expected format, size, and destination before another service reads the result. Reject artifacts that do not match the task's allowed output types.

Copy accepted files through a controlled export step rather than sharing a writable directory with production. Check file paths and links during export so a crafted artifact cannot point outside the intended directory. Apply the same care when unpacking archives. Store exported artifacts under an identity chosen by the controller, not a path supplied by the code.

A result can contain sensitive input even when the task makes no network call. Apply the task's data rules to logs, error messages, and artifacts as well as to the input files. For work involving sensitive material, review the site's [data classification guidance](/glossary/data-classification) before choosing where results may go. Delete rejected artifacts and temporary copies according to the applicable retention policy.

## How can the team test the boundary?

Build tests that try the access the task must not have. Attempt to read a host file, reach a blocked address, access metadata, and use a credential that should be absent. Run the tests from inside the same environment and deployment path used for real tasks. A test that runs only on a developer's machine cannot establish what the production host enforces.

| Test                            | Expected result                                          |
| ------------------------------- | -------------------------------------------------------- |
| Read a host file                | Access is denied.                                        |
| Reach a blocked address         | The connection is denied.                                |
| Exhaust a task limit            | The controller stops the workload and reports the limit. |
| Read files from a previous task | The fresh environment cannot access them.                |

Test resource limits with code that keeps running, starts child processes, writes files, and produces excessive output. After each stopped task, check that its processes and writable data are gone. Start a fresh task and try to read the previous task's files. Include a failure case where the controller loses contact with the host, then check how cleanup is recovered.

Keep the expected result explicit for each test. A blocked request should leave evidence of denial without exposing a secret in the record. Use the [agent evaluation starter](/resources/agent-evals-ci-starter) to organize checks alongside other release tests. Repeat the boundary tests when the runtime, host image, network policy, or broker changes.

## Who owns a failed run or suspected escape?

Assign an owner for the runtime, host patching, network policy, and broker before accepting workloads. Name a responder who can pause new tasks and isolate a host. The response path should also cover a task that reaches an unexpected service or returns data it should not have seen. Keep the person who approves access distinct from the task that requests it.

Record the task identity, image version, policy version, start and stop events, and limit failures. Link broker requests to the task that made them. Avoid recording raw secrets or full customer inputs when a smaller record will support an investigation. Set access and retention rules for these records before the first production run.

If a boundary test fails, stop affected workloads and preserve the evidence needed to investigate. Remove exposed credentials from service and assess what the workload could have reached. Rebuild affected environments from trusted images before resuming work. Use the [rollback guide](/blog/how-to-roll-back-an-ai-agent-deployment) to plan the service changes that may be needed around that response.

## When is a stronger boundary worth the cost?

Use the possible impact of an escape to compare isolation choices. Sensitive data, code from unknown sources, and access to valuable internal systems all raise the stakes. So does a host shared with unrelated customers. A stronger boundary may add startup time and operational work, but it can reduce what a compromised task can reach.

A sandboxed runtime can provide a different boundary from an ordinary container. Its [architecture guide](https://gvisor.dev/docs/architecture_guide/intro/) describes how it handles application system calls. A virtual machine provides another option, with its own image, host, and management risks. Check the chosen product's security model and maintain its host as carefully as the guest.

Compare options by running the actual workload and the same denial tests against each setup. Include startup, cleanup, artifact export, and incident response in that trial. If a task cannot work without broad host access or unrestricted credentials, change the task design before putting it into production. Give the owner a record of the remaining risks and the authority to reject the deployment.
