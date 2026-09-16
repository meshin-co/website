# Probe the Buyer Prompts

`npm run audit:geo-probe` sends all 30 buyer prompts from `docs/SEMANTIC-CORE.md` to four live
answer engines with retrieval enabled and writes `audits/geo-probe.md` plus its JSON. This is the
measurement the PRD's §17.3 protocol asks for, and the counterpart to
`baseline-the-buyer-prompts.md`, which only measures what the site itself ships.

    npm run audit:geo-probe                      # all 30 prompts, every engine with a key
    GEO_PROBE_LIMIT=2 npm run audit:geo-probe    # a two-prompt trial first

The rules live in `scripts/geo-probe.mjs` with tests in `scripts/geo-probe.test.mjs`;
`scripts/run-geo-probe.mjs` queries the engines and writes the artifact.

## Engines, and how each one is reached

| Engine    | Model                             | Retrieval                  | Key                  |
| --------- | --------------------------------- | -------------------------- | -------------------- |
| openai    | `gpt-5`                           | `web_search` tool          | `OPENAI_API_KEY`     |
| anthropic | `claude-sonnet-4-5`               | `web_search_20250305` tool | `ANTHROPIC_API_KEY`  |
| gemini    | `gemini-flash-latest`             | `google_search` grounding  | `GEMINI_API_KEY`     |
| sonar     | `perplexity/sonar` via OpenRouter | native search              | `OPENROUTER_API_KEY` |

Keys are read from the environment at run time. An engine with no key is reported as skipped, by
variable name, never silently dropped. **The artifact records variable names only. A key value
must never reach a file, a log line or a commit.**

## The three verdicts, and the fourth column that makes them mean anything

`cited` means the engine returned a `meshin.co` URL among its sources. `mentioned` means the
answer named the site or the owner without citing it. `absent` means neither.

The retrieval column is what separates two very different absences: the engine searched and we
were not in the results, or the engine never searched and answered from training data. On the
first run, OpenAI and Gemini performed zero searches on the verbatim buyer prompt, so their
`absent` says nothing about our ranking. Do not report a total without that split.

## Traps this probe already hit

- **Gemini hides real hosts.** Its grounding chunks are `vertexaisearch.cloud.google.com`
  redirects. Without following them, a `meshin.co` citation can never match. `resolveCitationHosts`
  follows each redirect and keeps the original URL when that fails.
- **The prompts stay verbatim.** Adding "search the web and cite sources" would raise the
  retrieval rate and stop measuring what a buyer actually types.
- **Zero is a real answer.** The first run returned 120 absent out of 120, because the site was
  still `noindex` and unindexed. That is the honest pre-launch baseline; re-run after the flip and
  diff against it.
