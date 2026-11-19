---
record: true
---

# Agent evaluations in CI: what exists, what you still build yourself

**Question:** an engineer wants agent evaluations running in their CI by the end of the day. What exists today, and what do they still have to build?

**All facts retrieved 2026-11-10** unless a different date is stated. Repository counts come from the GitHub REST API (`api.github.com/repos/...`), download counts from `api.npmjs.org` and `pypistats.org`. Claims I could not verify from a primary source are marked `[INFERENCE]`.

**Short answer:** the frameworks are mature, well-funded and genuinely free to run locally. The CI wiring is not. An engineer can have a *threshold* gate running in an afternoon. A *baseline regression* gate — the thing that answers "did this PR make the agent worse?" — does not exist as a forkable artefact from any vendor, and that is the single largest gap.

---

## 1. The evaluation frameworks

### 1.1 Primary table

| Project | Stars | Forks | Open issues | Lang | Licence | Last commit | Maintained by |
|---|---|---|---|---|---|---|---|
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | 37,261 | 4,196 | 1,173 | TypeScript | `NOASSERTION` (see §1.4) | pushed 2026-11-10 | Langfuse (company) |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | 27,026 | 2,705 | 962 | TypeScript | MIT | 2026-11-09 | **OpenAI** (acquired; see §1.3) |
| [comet-ml/opik](https://github.com/comet-ml/opik) | 23,306 | 1,939 | 200 | Python | Apache-2.0 | pushed 2026-11-10 | Comet ML (company) |
| [openai/evals](https://github.com/openai/evals) | 19,724 | 3,127 | 350 | Python | `Other` | **2026-04-14** | OpenAI (dormant; see §1.5) |
| [confident-ai/deepeval](https://github.com/confident-ai/deepeval) | 19,411 | 2,189 | 823 | Python | Apache-2.0 | 2026-11-10 | Confident AI (company) |
| [vibrantlabsai/ragas](https://github.com/vibrantlabsai/ragas) | 16,281 | 1,806 | 661 | Python | Apache-2.0 | **2026-02-24** | Vibrant Labs (see §1.6) |
| [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix) | 12,233 | 1,284 | 1,243 | Python | **Elastic License 2.0** | pushed 2026-11-10 | Arize AI (company) |
| [UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai) | 3,219 | 920 | 524 | Python | MIT | 2026-11-10 | **UK AI Security Institute** (+ Meridian Labs; see §1.7) |
| [wandb/weave](https://github.com/wandb/weave) | 1,146 | 185 | 157 | Python | Apache-2.0 | 2026-11-09 | Weights & Biases (company) |
| [braintrustdata/autoevals](https://github.com/braintrustdata/autoevals) | 1,077 | 100 | 60 | Python | MIT | pushed 2026-10-30 | Braintrust (company) |
| LangSmith | — | — | — | — | **closed source** | — | LangChain (company) |
| Braintrust (platform) | — | — | — | — | **closed source** | — | Braintrust (company) |

### 1.2 Stars are the wrong metric — downloads invert the ranking

| Package | Registry | Downloads, last month | Stars |
|---|---|---|---|
| `promptfoo` | npm | **4,137,504** (window 2026-10-11 → 2026-11-09) | 27,026 |
| `inspect-ai` | PyPI | **2,896,739** | 3,219 |
| `deepeval` | PyPI | **2,584,198** | 19,411 |
| `ragas` | PyPI | 1,052,531 | 16,281 |
| `weave` | PyPI | 817,064 | 1,146 |
| `evals` (OpenAI Evals) | PyPI | **457** | 19,724 |

Sources: `https://api.npmjs.org/downloads/point/last-month/promptfoo`; `https://pypistats.org/api/packages/{inspect-ai,deepeval,ragas,weave,evals}/recent`.

Two numbers reframe the whole landscape:

- **`inspect-ai` out-downloads `deepeval`** (2.90M vs 2.58M/month) on **one sixth the stars**. Inspect is the most-installed Python eval framework I measured, and it is the least-starred serious one. Star counts are measuring marketing reach, not adoption.
- **OpenAI Evals gets 457 PyPI downloads a month against 19,724 stars.** That is roughly 1 download per 43 stars per month. It is an abandoned landmark, and any guide still recommending it is stale.

### 1.3 promptfoo is now part of OpenAI

Verified from the repository README: *"Promptfoo is now part of OpenAI. Promptfoo remains open source and MIT licensed."* (<https://github.com/promptfoo/promptfoo>, retrieved 2026-11-10.) Corroborated by commit authorship — the most recent commit `b3603fa` (2026-11-09T21:42:24Z) is authored by `Michael D'Angelo <mdangelo@openai.com>`, and the account `mldangelo-oai` now appears where `mldangelo` previously did (`https://api.github.com/repos/promptfoo/promptfoo/commits?per_page=1`).

This is the most consequential governance fact in the category. The most-downloaded eval tool, whose main selling point was multi-provider neutrality ("Compare performance of GPT, Claude, Gemini, DeepSeek"), is now owned by one of the providers it compares. The licence is still MIT and the code is still there — but anyone picking a "vendor-neutral" default needs to know this.

### 1.4 Licences are not all what they look like

- **MIT:** promptfoo, Inspect, autoevals, promptfoo-action.
- **Apache-2.0:** DeepEval, Ragas, Opik, Weave.
- **Elastic License 2.0:** Arize Phoenix. Verified by reading `https://raw.githubusercontent.com/Arize-ai/phoenix/main/LICENSE`, which opens `Elastic License 2.0 (ELv2)` and states: *"You may not provide the software to third parties as a hosted or managed service"* and *"You may not move, change, disable, or circumvent the license key functionality."* **This is not an OSI open-source licence.** Phoenix is commonly listed alongside the others as "open source"; for CI use that is harmless, but it constrains redistribution.
- **`NOASSERTION`:** Langfuse and Phoenix both report `spdx_id: NOASSERTION` through the GitHub API, meaning the licence file is not a clean single-licence match. For Langfuse this is `[INFERENCE]` consistent with a permissive core plus a commercially-licensed enterprise directory — I did not read Langfuse's licence file, so treat the specific split as unverified.
- **`Other`:** OpenAI Evals reports `License: Other`. Its README disclaimer says contributions are made *"under the same MIT license as this repository"* and adds *"OpenAI reserves the right to use this data in future service improvements."*

### 1.5 OpenAI Evals is dormant

Last commit `8eac7a7`, dated **2026-04-14T15:29:57Z** — about seven months stale — and its content is housekeeping: *"Pin pre-commit hook revisions to immutable commits (#1644)."* The README now opens by redirecting users elsewhere: *"You can now configure and run Evals directly in the OpenAI Dashboard."* It also states *"we are currently not accepting evals with custom code."* Combined with 457 downloads/month, this is a historical artefact, not a candidate.

### 1.6 Ragas has not shipped in over eight months, and has quietly changed owner

Two verified facts that no summary article mentions:

1. **The repository moved.** `github.com/explodinggradients/ragas` now resolves to **`vibrantlabsai/ragas`**. The PyPI metadata confirms the new home: `project_urls.Code = "https://github.com/vibrantlabsai/ragas"`, and the Apache licence text reads `Copyright [2023] [Vibrant Labs]` (<https://pypi.org/pypi/ragas/json>).
2. **The last commit is 2026-02-24** (`298b6827`, *"fix: allow fork contributors in check-docs CI workflow (#2606)"*). That is ~8.5 months of no commits on the default branch, against 661 open issues and 1,052,531 downloads a month.

And the specific thing an agent-eval engineer wants is explicitly unfinished. The Ragas README lists its quickstart templates:

```
Available templates:
- rag_eval - Evaluate RAG systems

Coming Soon:
- agent_evals - Evaluate AI agents
- ...
```

`agent_evals` has been "Coming Soon" since before the last commit landed. **Ragas is a RAG metrics library that is not currently maintained and whose agent-eval story was never shipped.** It should not be anyone's agent-eval choice today. (Latest PyPI version is `0.4.3`; I was unable to isolate its upload timestamp from the PyPI JSON response, so the release date is unverified — the GitHub commit date is the solid number.)

### 1.7 Inspect is the only one with a non-commercial owner — with a caveat

Inspect is published by the **UK AI Security Institute** (`https://aisi.gov.uk/`), a government body, under MIT. No funnel, no account, no hosted tier, and *"over 200 pre-built evaluations ready to run on any model"* per the README.

The caveat is that day-to-day maintenance appears to be contracted out. The most recent commit (2026-11-10T14:08:12Z) is authored by `Ransom Richardson <ransom@meridianlabs.ai>`; the README points the web-UI submodule at `github.com/meridianlabs-ai/ts-mono` and the SWE-agent package at `meridianlabs-ai.github.io/inspect_swe`. So "maintained by a standards body" is true of ownership and licence, and partly true of engineering. For an engineer choosing a dependency this is still the strongest governance story on the table — a government institute has no incentive to funnel you to a paid tier.

### 1.8 Free tier: genuinely free, or a funnel?

| Tool | Runs in CI with **no account**? | Evidence |
|---|---|---|
| **promptfoo** | **Yes** | README: *"LLM evals run 100% locally - your prompts never leave your machine."* The action's only required secrets are `github-token` and a provider key. `--no-share` suppresses upload. |
| **Inspect** | **Yes** | No account concept exists. Logs are local `.eval` files. |
| **DeepEval** | **Yes** | Docs: *"Everything in this quickstart runs locally."* `deepeval login` is presented in an optional info callout. Metrics *"run locally on your machine"* (README). |
| **autoevals** | **Yes** `[INFERENCE]` | MIT scorer library, standalone by design; I did not execute it keyless. |
| **Ragas** | Yes, but unmaintained | Needs only `OPENAI_API_KEY`. |
| **W&B Weave** | **No** | README *Prerequisites*: *"A Weights & Biases account… A W&B API key from https://wandb.ai/authorize. Set `WANDB_API_KEY`."* `weave.init("<team>/<project>")` targets a server. |
| **LangSmith** | **No** | Closed source, hosted. Free "Developer" tier = **5,000 base traces/month**, 14-day retention, 1 seat, 1 workspace. Personal orgs *"stop ingesting at 5,000 traces a month until a credit card is on file"* ([inference.net summary](https://inference.net/content/langsmith-pricing/), [truefoundry](https://www.truefoundry.com/blog/langgraph-pricing)). |
| **Braintrust** | **No** | Closed source, hosted. Free "Starter" = $10 credits, 1 GB processed data, 10,000 scores, 14-day retention; unlimited users/projects ([voiceflow](https://www.voiceflow.com/blog/what-is-braintrust)). A prior 1M-span/month cap was removed around 2026-03-16 ([flexprice](https://flexprice.io/pricing-index/braintrust)). |

Pricing figures for LangSmith and Braintrust come from secondary trackers, not vendor pricing pages — treat the exact numbers as approximate and re-check before relying on them. The *structural* point is primary-source-solid: both are hosted products with no self-hostable OSS core, so "runs in CI without an account" is false for both by construction.

**Funnel pressure, measured by README behaviour:** DeepEval's README carries an `[!IMPORTANT]` block promoting Confident AI (*"surfaces failing traces before anyone has written an eval for them"*) with a demo GIF, and its docs route datasets through "Pull from Confident AI" as a first-class tab. Ragas' README offers *"Book a slot"* consulting and lists `founders@vibrantlabs.com`. Neither blocks local CI use. Inspect's README contains no commercial call-to-action at all.

One new dependency worth flagging: DeepEval's `JevEval` metric requires `TYPESAFE_API_KEY` ("Set your `TYPESAFE_API_KEY` as an env variable… No LLM key is needed"). That is a proprietary judge model substituting for your own provider key — free of LLM cost, but a new vendor in your CI secrets.

---

## 2. The CI half — the wiring, not the framework

This is where the category is thin.

### 2.1 Only one first-party GitHub Action exists, and it is tiny

[`promptfoo/promptfoo-action`](https://github.com/promptfoo/promptfoo-action) — **81 stars, 36 forks, 21 open issues, MIT**, created 2023-06-21, last push 2026-11-10. Published on the Marketplace as ["Test LLM outputs"](https://github.com/marketplace/actions/test-llm-outputs). Runs on `node24`.

**81 stars.** The framework has 27,026 and 4.1M monthly downloads; its official CI wiring has 81 stars. That ratio is the clearest single measurement of the gap: people adopt the eval runner and then wire CI themselves.

Sibling: [`promptfoo/code-scan-action`](https://github.com/promptfoo/code-scan-action) — 3 stars, 5 forks, **no licence file**, created 2025-10-24.

What the action genuinely does, from `action.yml` and README (primary sources):

- **`fail-on-threshold`** — *"Fail the action if the evaluation success rate is below this percentage (0-100)."* A real, declarative gate.
- **`repeat` + `repeat-min-pass`** — *"Number of times to run each test (must be >= 2). Useful for non-deterministic LLM evals where a single run is noisy"*, and *"with repeat=3 and repeat-min-pass=2, each test must pass at least 2 of its 3 runs."* This is the only built-in best-of-N flake control I found in any first-party CI integration, anywhere.
- 13 named provider key inputs (`openai-api-key`, `anthropic-api-key`, `azure-api-key`, `aws-*`, `vertex-api-key`, `cohere`, `mistral`, `groq`, `replicate`, `huggingface`, `palm`), each falling back to the conventional env var.
- Change detection: evaluates only prompt files that changed in the PR, with dependency-aware checks on custom providers and assertion files.
- `cache-path` for the promptfoo disk cache, plus `cache-size-mb` / `cache-file-count` outputs.

**The critical limitation, stated in its own README:** *"The action evaluates only the current checkout; **it does not run separate base and head evaluations**."* So the gate is **absolute** ("≥ 85% must pass"), never **relative** ("don't score lower than `main`"). There is no baseline. Section 3.5 is about what that costs you.

### 2.2 DeepEval: no action, a documented workflow, and a "regression" guide that does not compare anything

DeepEval ships no GitHub Action. Its approach is `deepeval test run`, which *"plugs into Pytest"* (Python) or Vitest (TypeScript), so pass/fail comes free from the test runner's exit code.

Its own guide — [Regression Testing LLM Systems in CI/CD](https://deepeval.com/guides/guides-regression-testing-in-cicd) — is worth quoting because of what it *doesn't* contain. The complete workflow it offers is checkout → setup-python → install Poetry → `poetry run deepeval test run test_file.py`, and the assertion logic is:

```python
def test_example(test_case: LLMTestCase):
    metric = AnswerRelevancyMetric(threshold=0.5)
    assert_test(test_case, [metric])
```

It then declares: *"You've now setup an automated regression testing suite in under 30 lines of code."*

**There is no baseline in it.** No stored previous score, no comparison, no diff. A hardcoded `threshold=0.5` is a floor, not a regression test — an agent that silently degrades from 0.95 to 0.55 passes this gate on every PR. The canonical "regression testing in CI/CD" guide of the second-most-downloaded framework does not detect regressions. (The CI/CD doc does link to this guide as the place *"that compares runs against a baseline"*, and the sibling quickstart says *"If you run more than one test run, you will be able to catch regressions by comparing test cases side-by-side"* — but side-by-side comparison is a dashboard affordance on Confident AI, not a CI exit code.)

### 2.3 Inspect: no action at all, and the only public baseline gate is a 0-star lab

Inspect has no GitHub Action and no first-party CI integration. Its `.github/workflows/` tree (build, test, pr-gate, publish, suppressions…) tests *Inspect itself*; none of it is reusable as an eval gate.

Inspect does have the right primitives — `inspect eval-set` / `eval_set()` runs many tasks with retries into a log directory, and logs are machine-readable from Python. But assembling "read the log, compare to a committed baseline, exit non-zero" is left entirely to the user.

I searched for a forkable implementation. The best public example is [`BrickerP/inspect-eval-gate-lab`](https://github.com/BrickerP/inspect-eval-gate-lab), whose own description is *"Lab: stdlib eval regression gate (Inspect-style) — score vs committed baseline, fail CI on drop. **Not production.**"* Its verified stats: **0 stars, 0 forks, 0 open issues**, created 2026-10-11, last push 2026-10-12, MIT, 21 KB. One person, one weekend, self-disclaimed.

Its semantics are nonetheless the clearest public statement of what a real gate must decide — *"a current value greater than or equal to the baseline passes (absolute tolerance 1e-9); a lower value fails; a different sample count (n) fails, including when accuracy stays 1.0; metrics present only on the current run are ignored; a metric the baseline names and the current run lacks fails."* Those five rules are exactly the design work no vendor has shipped.

### 2.4 Does a working starter exist that someone can fork?

**For a threshold gate: yes.** `promptfoo/promptfoo-action@v1` with `fail-on-threshold` plus `repeat`/`repeat-min-pass`, or ~30 lines of `deepeval test run` in a Python job. Either is an afternoon's work.

**For an agent-trajectory baseline-regression gate: no.** Having searched the GitHub repository-search API (`agent evals CI starter template github actions llm` → **`total_count: 0`**), the GitHub Marketplace, and the first-party docs of promptfoo, DeepEval, Inspect, Ragas and Weave, I found **no maintained, forkable repository that runs agent-trajectory evaluations in CI and fails a pull request against a stored baseline.** The closest candidates are an 81-star action that explicitly does not compare against a base ref, and a 0-star self-declared non-production lab. Absence stated as a finding, with the searches named.

Two third-party scraps for completeness: [`allagentsdev/oh-my-promptfoo-action`](https://github.com/allagentsdev/oh-my-promptfoo-action) (created **2026-11-06**, four days old at time of writing) and `Mitesh411/promptfoo-demo`. Neither has adoption worth counting.

### 2.5 Vendor-neutral CI integrations do exist at the runner level

promptfoo documents **GitHub Actions, GitLab CI and Jenkins** from one CLI invocation (`npx promptfoo@latest eval -c promptfooconfig.yaml`), and emits **JUnit XML** (`-o results.junit.xml`) alongside JSON and HTML — which means any CI system with a JUnit reporter can display results without bespoke parsing. DeepEval's docs note the same `deepeval test run` command *"works in GitLab CI, CircleCI, Jenkins, and others."* Worth knowing: promptfoo's **SonarQube integration is Enterprise-only** (*"SonarQube integration is available in Promptfoo Enterprise"*); the documented free path is to parse the JSON yourself.

---

## 3. The hard parts, and how each tool actually handles them

### 3.1 Non-determinism and flaky thresholds

**What exists:**
- **promptfoo-action**: `repeat` + `repeat-min-pass` (best-of-N, declarative). The input documentation names the problem directly: *"Useful for non-deterministic LLM evals where a single run is noisy."* Best in class.
- **promptfoo**: `assert-set` with a `threshold` (*"50% of assertions must pass"*) and per-set `weight`, so a test can tolerate partial failure rather than flipping on one assertion.
- **DeepEval**: a `flaky` flag on metrics and test cases, merged 2026-07-27 in [PR #2951](https://github.com/confident-ai/deepeval/pull/2951) (*"feat: add flaky flag to metrics and test cases"*, authored by maintainer `penguine-ip`). There is also open work on retry accounting — [PR #2728](https://github.com/confident-ai/deepeval/pull/2728), *"fix: dedupe flaky retry test runs"*, open since 2026-06-08 and still a draft as of 2026-08-29, which notes that flaky pytest retries **double-count dashboard cost** unless the replaced attempt's cost is backed out.
- **Inspect**: every default scorer reports `stderr` next to `accuracy`/`mean`, and the docs cover clustered standard errors. This is the only framework that treats score uncertainty as a first-class reported quantity rather than something you bolt on.

**Where practitioners say it falls down.** The recurring diagnosis in the practitioner literature is conceptual, not tooling: *"A common mistake is treating variance as flakiness — a test scores 0.85 on one run and 0.82 on the next, and the team retries until it passes"* ([futureagi.com](https://futureagi.com/blog/llm-eval-vs-traditional-qa-2026/)). And on threshold design: *"If you skip threshold setting or set thresholds too loose, your tests become useless — they'll pass bad outputs. If thresholds are too tight, your tests will flake constantly, burning developer trust"* ([theneuralbase.com](https://theneuralbase.com/llm-testing/learn/intermediate/contains-required-info/)). The suggested shape — *"a threshold table keyed by route, calibrated against current production baseline minus a small margin (typically two percentage points)"* — is supported by **no** tool's config schema that I found. These are secondary sources; I cite them as evidence of what practitioners report, not as measurements.

A grounded illustration from inside the toolchain itself: a DeepEval contributor reported in [PR #3603](https://github.com/confident-ai/deepeval/pull/3603) (opened 2026-11-07, still open) that `test_storage_failure_is_a_warning_not_an_error` *"fails on every PR in 'Py Core Tests' right now (e.g. a docs-only typo PR fails the same way)"* because `rich.print` wraps at the CI console width of 80 columns and the line break lands inside the matched substring — *"It passes locally only when the tmp path has a different length."* Environment-dependent flakiness is not hypothetical even for the people building these tools.

### 3.2 Cost per run

**What exists:**
- **promptfoo**: a disk cache (`cache-path`, wired to `actions/cache@v4` in the documented workflow — *"you'll save money and time by setting it up"*), `--max-concurrency` (default 4 in the action), and a **`cost` assertion** that fails a test when provider-reported cost exceeds a threshold. Notably you can also record cost without gating: *"To record the provider's cost in USD without a pass/fail limit, omit `threshold` and set a named `metric` with `weight: 0`."* Caveats are documented honestly — the cost assertion *"requires the provider to return cost information; an unknown cost cannot be checked"*, and `--no-cache` is needed when comparing fresh inference costs.
- **DeepEval**: per-run cost accounting with a `💰 API cost` readout, plus local non-LLM metrics (statistical/NLP scorers that *"run locally on your machine"*) and `JevEval` to avoid judge tokens entirely.
- **Inspect**: token, message and time **limits** for agent execution (`Agent Limits`), which bound a runaway agent loop rather than pricing it.

**Where it falls down — from DeepEval's own open PRs.** Its cost accounting has had correctness bugs:
- [PR #3498](https://github.com/confident-ai/deepeval/pull/3498) (open, 2026-10-21): four `if self.synthesis_cost:` guards are falsy *"exactly when the first accumulation is due"* for native models, so *"the reported `💰 API cost` understated the real spend by the whole context-construction component."*
- [PR #3503](https://github.com/confident-ai/deepeval/pull/3503) (open, 2026-10-21): when a token count is known but its price is not, `_split_cost` raised `TypeError: unsupported operand type(s) for *: 'NoneType' and 'float'`, *"marking **every metric in the batch** as errored over a missing price."*

If you intend to gate on cost, the number your framework prints may be wrong in your favour. Verify it against your provider's billing.

Practitioner-reported magnitudes (secondary sources, cited as reports): LLM-as-judge *"doubles that (you pay for the generation and the judgment)"* and *"three runs triple your token spend"* ([qaskills.sh](https://qaskills.sh/blog/llm-evaluation-ci-cd-quality-gates)); a case where *"evaluation cost was 10 times as expensive as the baseline agent workload"* ([montecarlo.ai](https://montecarlo.ai/blog-llm-as-judge)); and *"$0.10–$2.00 per PR"* for a judge-on-PR-only design ([blog.appxlab.io](https://blog.appxlab.io/2026/04/07/test-ai-agents-cicd-pipeline/)). Note that `repeat: 3` — the recommended flake mitigation from §3.1 — directly triples the cost from §3.2. **No tool resolves that tension for you; the two knobs are in different sections of the same docs.**

### 3.3 Secrets in CI

**What exists:** the conventional pattern, well documented. promptfoo-action takes 13 named provider-key inputs or inherits env vars, and supports `env-files` for `.env` loading. DeepEval needs `OPENAI_API_KEY` (or another judge) and optionally `CONFIDENT_API_KEY`; its docs flag that *"CI/CD pipelines cannot run interactive login - you must set `CONFIDENT_AI_API_KEY` as an environment variable instead"*, and that ordering matters — authenticate **before** `deepeval test run` or results silently fail to sync.

**The real hazard is the fork-PR problem, and only promptfoo documents it.** The action supports `pull_request_target` and warns: *"For `pull_request_target`, use extra care with checkout configuration and credentials. **Do not execute untrusted pull request code with a privileged token.**"* This matters because an eval gate on a public repo wants provider secrets *and* wants to run contributor code — a combination that leaks keys if wired naively. A real instance of the adjacent permission trap is visible in Ragas' last commit (`298b6827`, 2026-02-24): their doc-check workflow failed every fork PR with *"Actor does not have write permissions to the repository"*, and the fix was `allowed_non_write_users: "*"` on a `pull_request_target` workflow, justified at length as safe because the action was read-only.

Also under-documented: DeepEval was reported to **hijack the global OpenTelemetry TracerProvider**, *"exfiltrating host application trace data to third-party endpoints"* ([issue #2497](https://github.com/confident-ai/deepeval/issues/2497)). I have the issue title and number from search results but did **not** open the issue to confirm its current status or the maintainers' response — `[INFERENCE]` that it is resolved; verify before trusting the tracer in a CI job that handles sensitive payloads.

### 3.4 How a regression is judged

Three distinct mechanisms exist, and they are not equivalent:

| Mechanism | Who has it | What it catches | What it misses |
|---|---|---|---|
| Absolute threshold on suite pass rate | promptfoo (`fail-on-threshold`) | suite falling below a fixed floor | gradual decay above the floor |
| Per-metric threshold in a unit test | DeepEval (`threshold=0.5` + pytest) | a metric below its floor | **any regression that stays above the floor** |
| Current-vs-committed-baseline comparison | **nobody, first-party** | actual regressions | — |

The third row is the gap. The only articulation of its semantics I found in public code is the 0-star lab in §2.3.

### 3.5 How a baseline is stored and versioned

**Nothing first-party stores a baseline in your repository.** What is offered instead:

- promptfoo: `--share` uploads to the Promptfoo web viewer; the action posts a PR comment with pass/fail counts. Comparison is **visual, in a hosted UI**.
- DeepEval: "compare test cases side-by-side" across runs — on **Confident AI**, the commercial dashboard.
- Weave / LangSmith / Braintrust / Langfuse / Phoenix / Opik: baselines live in **their** datastore, reachable with **their** API key.

So the honest statement of the landscape is: **every tool that can tell you "this PR is worse than main" requires you to store your baseline in a vendor's database.** The free, in-repo, git-versioned baseline — a committed JSON file, diffed in CI, reviewable in the PR that changes it — is the thing nobody ships. promptfoo emits exactly the artefact you would need (`-o results.json`, with `jq`-readable `.results.stats.successes` / `.failures`, and the docs even show the `jq` one-liner), and then stops short of comparing two of them.

---

## 4. Agent evaluation specifically, not prompt evaluation

This is where the picture changed most against my expectations, and where the two leaders are strong in **opposite** halves of the problem.

### 4.1 promptfoo: genuinely trajectory-aware (verified)

From `https://www.promptfoo.dev/docs/configuration/expected-outputs/` and `.../deterministic/`, promptfoo ships these agent-specific assertions:

| Assertion | What it checks |
|---|---|
| `trajectory:tool-used` | *"Ensure a traced agent trajectory used specific tools"* |
| `trajectory:tool-sequence` | *"Ensure traced tool usage happened in the expected order"* — *"useful when an agent must gather information before taking a follow-up action"* |
| `trajectory:tool-args-match` | *"Ensure traced tool calls used the expected arguments"* |
| `trajectory:step-count` | counts steps filtered by type (`tool`, `command`, `search`, `reasoning`, `message`, `span`) and glob name pattern |
| `trajectory:goal-success` | *"Use an LLM judge to decide whether the traced agent run achieved its goal"* |
| `tool-call-f1` | **F1 over called-vs-expected tool sets — real partial credit** |
| `trace-span-count` / `trace-span-duration` / `trace-error-spans` | span counts, durations with percentiles, error rates |
| `skill-used` | normalised provider skill metadata |

**Partial credit is real and tunable:** for `tool-call-f1`, *"The `threshold` defaults to `1.0` (exact match required). Lower thresholds allow partial matches."* Provider coverage is broad and explicitly multi-vendor: *"supports OpenAI Chat Completions tool calls, OpenAI Responses `function_call` items, Anthropic tool-use blocks, and Google/Vertex function calls."* `trajectory:step-count` even recognises OpenAI Agents SDK `exec_command` / `local_shell` / `shell` spans.

**The cost nobody advertises:** the `trajectory:*` and `trace-*` assertions read OpenTelemetry trace data. The docs state plainly: *"This assertion requires trace data to be available. **If tracing is not enabled or trace data is missing, the assertion will throw an error.**"* So trajectory evaluation in promptfoo presupposes that you have instrumented your agent with OTLP and plumbed spans into the eval run. That is a day or more of integration work *before* the first trajectory assertion runs — and it is the real reason "agent evals by end of day" usually degrades into "final-output evals by end of day."

### 4.2 DeepEval: the richest trajectory *metric* catalogue

From the README (verified), DeepEval advertises evaluating *"Complete AI agent trajectories across every decision and action"* and *"Individual AI agent steps such as LLM calls, tool use, retrieval, and sub-agent handoffs."* Its agent metric set:

`TaskCompletion`, `ToolCorrectness` (*"check if the right tools were called with the right arguments"*), `GoalAccuracy`, `StepEfficiency` (*"evaluate whether the agent took unnecessary steps"*), `PlanAdherence`, `PlanQuality`, `ToolUse`, `ArgumentCorrectness` — plus MCP-specific metrics (`MCPTaskCompletion`, `MCPUse`, `MultiTurnMCPUse`) and five multi-turn conversational metrics (`KnowledgeRetention`, `ConversationCompleteness`, `TurnRelevancy`, `TurnFaithfulness`, `RoleAdherence`).

It reaches trajectories via `@observe()` instrumentation plus `update_current_trace()`, with first-party callback integrations for **LangChain, LangGraph, OpenAI, OpenAI Agents, Pydantic AI, AgentCore, Strands, Anthropic, LlamaIndex, Google ADK and CrewAI** (the tab list in its CI/CD doc). `StepEfficiency` and `PlanAdherence` have no equivalent anywhere else I looked.

### 4.3 Inspect: the best agent *execution* harness, the thinnest built-in trajectory scoring

Inspect's agent support is the deepest of any framework: a built-in `react()` agent, a `Deep Agent` for *"long-horizon tasks with subagent delegation, memory, and planning"*, multi-agent composition via `handoff()` (forwards full conversation history) and `as_tool()` (string-in/string-out), an **Agent Bridge** for *"OpenAI Agents SDK, LangChain, and Pydantic AI"*, a `Human Agent` for human baselining, `Checkpointing` to *"recover from failures"*, `Intervention` for human-in-the-loop, and token/message/time `Limits`. Plus SWE agents (Claude Code, Codex CLI) via `inspect_swe`.

But its **built-in scorer list** — `includes`, `match`, `pattern`, `answer`, `model_graded_qa`, `model_graded_fact`, `exact`, `f1`, `choice`, `math`, `perplexity`, `target_perplexity` — contains **no trajectory, tool-call or step-efficiency scorer.** Every one of them grades the final `output` against a `target`. Partial credit exists in two narrow forms: `f1()` (*"F1 score… over token overlap, for short free-text answers such as extractive QA"*) and `model_graded_qa(partial_credit=True)` — *"prompt the model to assign partial credit to answers that are not entirely right but come close (metrics by default convert this to a value of 0.5)"*, i.e. a three-valued 0/0.5/1 scale, and *"only valid when using the default `instructions`."*

Inspect is architecturally able to score trajectories — custom scorers can read the full `AgentState` message history — but you write that scorer yourself.

### 4.4 Who only scores single responses

- **Ragas**: RAG and single-response metrics; `agent_evals` is "Coming Soon" and unmaintained (§1.6).
- **OpenAI Evals**: has `Completion Function Protocol` for *"prompt chains or tool-using agents"*, but dormant since 2026-04-14 and 457 downloads/month. Not viable.
- **autoevals**: a scorer library for outputs; no trajectory concept `[INFERENCE]` — judged from its description (*"evaluating AI model outputs"*) and scope, not from reading its source.

### 4.5 Summary verdict

| | Agent execution | Trajectory scoring | CI gate | Baseline |
|---|---|---|---|---|
| **promptfoo** | runs your target | **strong** (6 trajectory assertions + `tool-call-f1`) — needs OTLP | **strong** (`fail-on-threshold`, `repeat`) | **none** |
| **DeepEval** | instruments your agent | **strongest** (11+ agent metrics) | good (pytest exit code) | **none** (hosted only) |
| **Inspect** | **strongest** (react/deep/multi-agent/bridge/limits) | weak built-ins (final-output scorers + `stderr`) | **none** | **none** |

No single tool holds all four columns. That is the finding.

---

## 5. Has anything become the default, the way pytest or eslint has?

**No. Nothing is the default, and the evidence is the disagreement between the metrics.**

Three plausible "winners", each by a different measure:

1. **By downloads (TS/JS):** `promptfoo` at 4,137,504/month.
2. **By downloads (Python):** `inspect-ai` at 2,896,739/month — ahead of `deepeval` at 2,584,198.
3. **By stars:** `langfuse` at 37,261 — a tool that is primarily observability, not a CI eval runner.

Compare with a real default: pytest and eslint have one obvious answer, one canonical config file everyone recognises, and an ecosystem of plugins that assume it. Here, the top three by download are three different languages' tools with three different file formats (`promptfooconfig.yaml`, `test_*.py` via pytest, Python `Task` objects), and the most-starred project is in a different category.

**The strongest single piece of counter-evidence to any "promptfoo is the default" claim is its own CI action at 81 stars.** A tool becomes a default when its CI integration is boring and ubiquitous — the way `actions/setup-node` is. 81 stars on the official action of a 4.1M-download/month tool means the CI step is still bespoke almost everywhere.

Supporting evidence I could verify for promptfoo's reach specifically: its repository description claims *"Used by OpenAI and Anthropic"*; it is distributed through npm, Homebrew (`brew install promptfoo`) **and** pip; and it ships agent-tooling integration surfaces (`.claude-plugin/marketplace.json`, `.agents/skills/`, a `CITATION.cff`). I did **not** verify the OpenAI/Anthropic usage claim independently — it is a vendor self-description, now from a vendor owned by one of the two named companies.

---

## 6. Is anything vendor-neutral?

**Partly — and the neutrality is strongest at the layer with the least tooling.**

**Genuinely multi-provider at the runner level:**
- **promptfoo** — 13 provider key inputs in one action; README lists *"OpenAI, Anthropic, Azure, Bedrock, Ollama"*; `tool-call-f1` parses OpenAI, Anthropic and Google/Vertex tool-call shapes. The most provider-neutral *implementation* in the category — now owned by OpenAI.
- **Inspect** — MIT, government-owned, *"over 200 pre-built evaluations ready to run on any model"*, with vLLM/SGLang local-model support documented. The most provider-neutral *governance*.
- **DeepEval** — metrics *"powered by **ANY** LLM of your choice"*, 11+ framework callback integrations, and local NLP metrics. Caveat: `JevEval` introduces a `TYPESAFE_API_KEY` dependency.

**Where neutrality quietly breaks, in every starter I read:** the example always assumes OpenAI.
- promptfoo README quickstart: `export OPENAI_API_KEY=sk-abc123`. Its documented GH Actions workflow sets only `OPENAI_API_KEY`.
- DeepEval quickstart: *"Set your `OPENAI_API_KEY` as an env variable (or configure any other LLM)"*; its LangChain/LangGraph examples hardcode `openai:gpt-4o-mini`.
- Ragas quickstart: `llm_factory("gpt-4o")`, *"Make sure your `OPENAI_API_KEY` environment variable is set."*
- Weave quickstart: requires both `WANDB_API_KEY` **and** `OPENAI_API_KEY`.

So: the *frameworks* are vendor-neutral; the *starters* are uniformly OpenAI-shaped. An engineer on Bedrock or Vertex can get there, but will be translating examples, and — more importantly — the **judge** model in every documented example is an OpenAI model, which means your pass/fail verdict depends on an OpenAI API call even when your system under test does not.

Two structural notes on neutrality worth recording:
- **Inspect is the only framework here with no commercial entity that profits from your adoption.** Every other actively-maintained option is either a company's OSS funnel (DeepEval→Confident AI, Weave→W&B, Opik→Comet, Langfuse, Phoenix→Arize, autoevals→Braintrust) or now owned by a model provider (promptfoo→OpenAI).
- **JUnit XML output** (promptfoo `-o results.junit.xml`) is the one genuinely CI-system-neutral artefact in the category.

---

## 7. What is missing, and what closing it costs

Ordered by how much it hurts. Effort figures are my estimates, marked `[INFERENCE]`.

### 7.1 An in-repo, git-versioned baseline regression gate — **the central gap**

Nothing first-party compares this run against an accepted previous run. Every tool that can is a hosted product holding your baseline behind its API key (§3.5).

What you must build: a committed `baseline.json`; a CI step that reads `results.json` and compares per-metric; a decision table for the non-obvious cases the 0-star lab already enumerated (sample count `n` changed; a metric present in baseline but absent now; new metrics; float tolerance); a sanctioned way to *update* the baseline in a reviewable PR; and a guard against the trivial failure mode of letting a flaky run rewrite the baseline downward.

**Cost: 2–4 engineer-days to build, and it is permanent maintenance surface.** `[INFERENCE]` The hard part is not the diff, it is the policy — and the policy is exactly what a reference implementation would save everyone.

### 7.2 Reconciling flake mitigation with cost

`repeat: 3` triples spend (§3.1 vs §3.2). No tool offers the obvious resolution: repeat **only** tests that landed near the threshold, or sequential testing that stops early once the verdict is statistically settled. Inspect reports `stderr` and so has the raw material; nothing acts on it.

**Cost: 1–2 days** `[INFERENCE]` to implement threshold-adjacent conditional retry on top of promptfoo's JSON output. Saves real money on every subsequent run.

### 7.3 Per-route threshold tables

Practitioners describe needing *"a threshold table keyed by route_name"* ([futureagi.com](https://futureagi.com/blog/llm-eval-vs-traditional-qa-2026/)). promptfoo offers one global `fail-on-threshold` percentage plus per-assertion thresholds; DeepEval offers per-metric thresholds in test code. Neither has a first-class notion of *"this route is regulated and gets a stricter floor."*

**Cost: 0.5–1 day** `[INFERENCE]` as a config layer plus a results-grouping step. Low effort, and absent everywhere.

### 7.4 A trustworthy cost gate

DeepEval's own cost number has two open under-reporting bugs ([#3498](https://github.com/confident-ai/deepeval/pull/3498), [#3503](https://github.com/confident-ai/deepeval/pull/3503)). promptfoo's `cost` assertion depends on the provider returning cost and is cache-sensitive. Nobody offers a per-PR spend ceiling that aborts a run mid-flight.

**Cost: 1–2 days** `[INFERENCE]` to build a token-counting wrapper with a hard abort, plus reconciliation against provider billing.

### 7.5 Trajectory evaluation without standing up OTLP first

promptfoo's trajectory assertions error out without trace data; DeepEval requires `@observe()` instrumentation. Neither offers "point me at a recorded trajectory JSON and score it." For an engineer with existing agent logs, there is no zero-instrumentation path.

**Cost: 1–3 days** `[INFERENCE]` to wire OTLP export from an existing agent into a promptfoo eval run — and this is the step most likely to consume the "by end of day" budget entirely.

### 7.6 A reference CI starter for Inspect

The most-downloaded Python eval framework (2.90M/month), owned by a standards body, under MIT, has **no** CI integration and **no** forkable gate above 0 stars. Given its download numbers, this is the widest gap between adoption and CI support in the category.

**Cost: 1–2 days** `[INFERENCE]` to write `eval_set()` → read logs → compare baseline → exit non-zero, as a reusable workflow.

### 7.7 Smaller, named gaps

- **No partial-credit standard.** promptfoo has `tool-call-f1` (F1 over tool names, threshold-tunable); Inspect has `f1()` over token overlap and a 0/0.5/1 `partial_credit`; DeepEval has `StepEfficiency`. Three incomparable notions of "nearly right." A trajectory that calls the right tools in the wrong order with the right arguments has no agreed score.
- **No fork-PR-safe pattern.** Only promptfoo warns about `pull_request_target` + privileged tokens (§3.3); nobody ships the safe recipe. Public-repo maintainers are on their own.
- **No judge pinning guidance.** Every documented judge is a floating model name (`gpt-4o`, `gpt-4o-mini`). When the provider silently updates that endpoint, every stored baseline becomes incomparable — and no tool records the judge's identity as part of the baseline. **This is the quiet failure mode that will invalidate the baseline from §7.1 if you build it without recording judge model and version alongside the scores.**

---

## 8. Answer to the framing question

**By end of day, an engineer can have:** promptfoo running in GitHub Actions via `promptfoo/promptfoo-action@v1`, with `fail-on-threshold` blocking the PR below a chosen pass rate, `repeat: 3` + `repeat-min-pass: 2` damping judge noise, `actions/cache@v4` on the promptfoo cache, a PR comment showing pass/fail counts, and — if the agent already emits OpenTelemetry — `trajectory:tool-sequence` and `tool-call-f1` assertions checking actual tool use with partial credit. Alternatively, ~30 lines of `deepeval test run` in a pytest job with `ToolCorrectness` and `TaskCompletion` metrics. Both genuinely free, both account-free, both MIT or Apache-2.0.

**They will still have to build:** the baseline (§7.1), the judge-version pinning that makes the baseline meaningful (§7.7), the threshold policy per route (§7.3), the cost ceiling they can trust (§7.4), and — if their agent is not already instrumented — the OTLP plumbing that trajectory assertions presuppose (§7.5).

The frameworks are solved. **The gate is not.** The measurement that captures it: 4,137,504 monthly downloads of the eval runner, 81 stars on its CI action, and zero maintained forkable repositories that fail a pull request against a stored agent-trajectory baseline.

---

## Appendix: verification notes

**Verified from primary sources** (GitHub API, raw repository files, vendor docs read directly): all star/fork/issue counts; all last-commit dates and SHAs; all download counts; Phoenix's Elastic License 2.0 text; promptfoo-action's complete input contract; promptfoo's assertion catalogue; DeepEval's metric catalogue and CI/CD + regression guides; Inspect's scorer and agent docs; Ragas' org move and template list; the `total_count: 0` GitHub search result.

**Secondary sources, flagged as such in text:** LangSmith and Braintrust free-tier figures (vendor pricing pages not read); practitioner quotes on cost magnitude, variance-vs-flakiness, and threshold tables.

**Explicitly not verified:** Ragas 0.4.3 upload date (PyPI JSON filter did not isolate it); Langfuse's licence split; DeepEval issue #2497's current status; autoevals' trajectory support; promptfoo's "Used by OpenAI and Anthropic" claim; all engineer-day estimates in §7.
