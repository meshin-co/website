# Write an Entry Unattended

Change `20-write-without-a-human` has a model write the day's entries with no person in the loop. A run always writes one
post (format `article`). When measured demand names a glossary concept the glossary lacks, it also writes up to a set cap of
terms (format `term`). `pick-the-next-topic.md` chooses them; `.github/workflows/write-daily.yml` pushes the result.

## Run it

`npm run write:entry -- --decision <path>` reads the decision file that `pick:topic` wrote and drafts each entry.

- Exit 0 prints one line: `{ok, slug, route, branch, commit, entries[], skipped[], spend, notes[], gates[]}`.
- Exit 1 prints `{ok:false, kind, variables, message, spend}`. The kinds: config, credential, decision, claim, model,
  price, vendor, output, build, commit, unexpected. `variables` names the settings at fault. No secret is in `message`.
- Exit 2 is a bad flag. Nothing ran.
- A failed run leaves the tree as it found it, except the ledger `audits/autowriter/<year>/<month>/<slug>.json`: the spend so far and the
  verdict `stopped`. It is written only when a model call was made. The claims stay and expire on their own.

## Configuration

Five names, read by `scripts/writer-config.mjs`: `WRITING_PROVIDER`, `OPENAI_WRITING_MODEL`,
`OPENAI_WRITING_INPUT_USD_PER_MILLION`, `OPENAI_WRITING_OUTPUT_USD_PER_MILLION` and the secret `AUTOWRITER_OPENAI_API_KEY`.
`WRITING_TERM_ARM` and `WRITING_TERM_CAP` belong to `pick:topic`. Nothing has a default in code. A bad or unset value fails
and names the variable. The documented defaults live in `site/.env.example`. The key has its own name so that the
`OPENAI_API_KEY` of the geo probe can never spend on the writer. A missing key fails as `credential`, names it and writes
nothing. The first call reads `GET /v1/models`. An id that is not listed fails as `model`, naming the variable and the
value. An announced `shutdown_date` proceeds, and `notes` names it for the digest.

## The prompt

`scripts/writer-prompt.mjs` builds it at run time from `PROMPT_SOURCES`. Nothing is pasted. The files: `AGENTS.md` (four
rules), the skills `write-copy.md`, `write-for-humans.md`, `place-a-new-text.md` and `add-collection-entry.md`,
`site/src/content.config.ts`, `docs/CONTENT-GATE.md`, `docs/SEMANTIC-CORE.md` (the claim's buyer-prompt block),
`site/banned-phrases.json`, `site/controlled-words.json`, `site/content-facts.json`, `audits/sentence-band.json`, `audits/entry-length.json`,
`audits/routes.json`, `site/src/data/tags.mjs`, and the slugs under `site/src/data/glossary` and `site/src/data/resource`.
A vanished anchor fails naming the file (`scripts/writer-prompt.test.mjs` proves it). The record keeps each file's sha256.
A post asks for `shortAnswer`, `fullAnswer`, takeaways, a FAQ, tags and 3 sources, on the post band. A term asks for
`shortDefinition`, `definition` and 1 source, on the term band. Both add a body, claim rows, a `passage` of 40 words at most.

## The record, the claim table and the limits

`audits/autowriter/generations/<year>/<month>/<slug>.json` (schema `scripts/generation-record.schema.json`) holds the provider, the
resolved model id, the response id, the prompt digest, the demand row, the tree fingerprint, tokens, computed cost and the
claim-to-source table. It copies only schema fields, every error text is redacted, and a key found in a file or a commit
message fails the run as `config`. In `scripts/claim-sources.mjs` a sentence states a fact when it holds a digit, a month
or "per cent", or names a standard or law (ISO, NIST, GDPR, the AI Act, an article or annex). It needs a `sourced` row: one
source id and the exact span. An `own-reading` row has neither and covers no fact. A standard needs a source on nist.gov,
iso.org, eur-lex.europa.eu, europa.eu, owasp.org or iec.ch. A draft that fails gets one correction call, then fails.

`node scripts/measure-sentence-band.mjs --write` re-measures the hand-written corpus into `audits/sentence-band.json`. The
duplicate rule binds at 12 words, so an entry of eleven-word sentences must fail; the derivation refuses a band that admits one.
`audits/entry-length.json` holds each format's body floor, section floors and target range, measured from the hand-written
entries (an entry with a generation record is left out): a floor is the least any of them has, the range is their middle half.
No number is typed: the prompt prints the range, `writer-preflight.mjs` judges the draft, `gate:autowriter` each committed
generated entry. After you add or change a hand-written entry, run `cd site && node scripts/measure-entry-length.mjs --write`
and commit the record. A pipeline commit that touches either record is refused.

## How a run lands

Before it writes anything the run builds the clean tree, and `gate:editorial` must pass on it, or the run stops. All
entries then go on one tree with one build, each with its `Passage:` line, content-facts row and disposition rows.
`semantic-core`, `gate:registers` and `gate:editorial` must pass; `gate:content`, `gate:human` and `gate:machine` are
recorded in `gates`. The run never runs the seal: it writes `generated-<slug>.json` under `audits/phase-4.7/dispositions/<year>/<month>/` and restates each existing disposition
the new text made stale, with a reason that says no human has read it. One bot commit goes on the local branch `autowriter/<slug>`; the workflow pushes and opens the pull request.

The post is the anchor: the branch and the ledger carry its slug. A term that fails as `claim`, `output` or `vendor`, or
whose assembly fails, is left out and listed in `skipped[]` with its spend. A failed post fails the run. Cost is tokens
times the configured rates (`scripts/writer-cost.mjs`). Each call keeps its own tokens and cost. The ledger's `generation`
is the sum over every entry, skipped ones included, and the summary reports it per entry. The monthly ceiling is enforced
elsewhere (`guard-the-unattended-writer.md`). The site shows no machine-written line: the record is in the repo.

## Module map

| Job                    | Modules                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run and decision       | `write-entry.mjs`, `write-run.mjs`, `write-open.mjs`, `write-draft.mjs`                                                                                                                 |
| Settings and vendor    | `writer-config.mjs`, `writer-error.mjs`, `writer-redact.mjs`, `writer-adapter.mjs`, `writer-openai.mjs`, `writer-models.mjs`, `writer-cost.mjs`                                         |
| The prompt and draft   | `writer-prompt.mjs`, `writer-prompt-read.mjs`, `writer-prompt-text.mjs`, `prompt-extract.mjs`, `writer-tree.mjs`, `writer-output.mjs`, `entry-limits.mjs`, `site-brand.mjs`             |
| The writer's own check | `writer-preflight.mjs`, `writer-preflight-fields.mjs`, `writer-preflight-page.mjs`, `writer-page.mjs`, `writer-markdown.mjs`, `claim-sources.mjs`                                       |
| Limits and record      | `entry-prose.mjs`, `sentence-band.mjs`, `measure-sentence-band.mjs`, `entry-length.mjs`, `measure-entry-length.mjs`, `generation-record.mjs`                                            |
| Landing                | `entry-files.mjs`, `route-derive.mjs`, `route-assembly.mjs`, `route-transaction.mjs`, `disposition-digest.mjs`, `stale-dispositions.mjs`, `disposition-restate.mjs`, `entry-commit.mjs` |
