# Tasks

## 1. The measurement and the record

- [x] 1.1 `site/scripts/entry-length.mjs` counts the prose words of an entry body by the rule of
      `site/scripts/entry-prose.mjs`, the `##` sections and the words of the thinnest section; a `##`
      line inside a fenced block is code, and a `###` heading stays inside its section
- [x] 1.2 The floor of a format is the smallest value any hand-written entry holds in words, in
      sections and in the words of its thinnest section, and the target is the 25th to the 75th
      percentile of the word counts; a format with no hand-written entry, or a corpus whose floor
      would admit an empty body or one unbroken block, is refused instead of given a default
- [x] 1.3 `node scripts/measure-entry-length.mjs` prints the distribution of each format and the
      entries it left out, writes `audits/entry-length.json` with `--write`, and without it fails
      when the record differs from a fresh measurement
- [x] 1.4 The measurement leaves out every entry that has a generation record, by the exclusion the
      sentence band already uses; `generatedSlugs` is exported from
      `site/scripts/measure-sentence-band.mjs`, and `FORMATS`, `byFormat`, `formatOf` and `quantile`
      from `site/scripts/sentence-band.mjs`
- [x] 1.5 `audits/entry-length.json` is committed, measured over 8 articles and 32 terms with 0
      entries left out: article floor 885 words, 4 sections and 112 words in the thinnest section,
      target 1234 to 2904 words; term floor 98 words, 2 sections and 21 words, target 137 to 151
      words
- [x] 1.6 A test asserts that every hand-written entry clears the committed limits of its format,
      that the committed word floor is the length of the shortest of them, and that the committed
      limits are the ones the committed distribution derives

## 2. Refusal before the write

- [x] 2.1 `site/scripts/writer-preflight.mjs` judges a draft with the same length rules as the gate,
      so `body-too-short`, `too-few-sections` and `section-too-thin` reach the writer's one
      correction round
- [x] 2.2 The correction message answers a length problem with more sections that rest on sources the
      model already cites, never by cutting text or repeating a field, and says nothing about
      sections when no length rule failed
- [x] 2.3 A tree with no length record fails as a configuration error that names the file and the
      command that writes it, and a record that is not JSON fails as a configuration error that
      names the file

## 3. Refusal after the write

- [x] 3.1 `npm run gate:autowriter` re-measures the entries a person wrote and refuses a committed
      record that differs, with `length-record-missing`, `length-record-schema-stale`,
      `length-record-corpus-stale`, `length-record-distribution-stale` and
      `length-record-limits-stale`, each naming the command that re-measures; the date of the
      measurement is not compared
- [x] 3.2 The gate judges every entry that has a generation record against the limits of its format
      and names the entry's path with each rule it breaks; a record that is not JSON
      (`length-record-unreadable`), a corpus that cannot be measured (`length-record-unmeasurable`)
      and a format the record holds no limits for (`length-unjudged`) are findings, never a pass

## 4. Who may move the record

- [x] 4.1 `audits/entry-length.json` is the row `entry-length` of
      `site/scripts/autowriter-refusals.mjs`, so the entry commit, the repair scope, the commit to
      the default branch and the history rule of `npm run gate:autowriter` refuse it, including a
      spelling with a dot segment or other capitals
- [x] 4.2 A record re-measured with a generated entry counted in it fails the gate, and a short
      generated entry leaves the record fresh and the floor where it was
- [x] 4.3 `site/scripts/autowriter-refusals.mjs` lists the refusal `generation-record-removed` in
      `REMOVAL_REFUSALS`, beside `REFUSED_PATHS`, with `removalRefusalFor(path)` and
      `isGenerationRecord(path)`; it matches a `.json` file directly under `audits/autowriter/generations`
      after separators are normalised and case is folded, and it is judged on the old path of a change
- [x] 4.4 `site/scripts/commit-to-main.mjs` refuses a staged removal of a generation record before it
      commits, and the history rule of `npm run gate:autowriter`
      (`site/scripts/autowriter-refusal-rules.mjs`) finds a pipeline commit that removed one as
      `generation-record-removed-committed`, naming the removed record and the first 12 hex
      characters of the commit; both git reads use `--no-renames`, so a rename or a move is a removal
      of the old path, and a move into the directory is an addition and is allowed
- [x] 4.5 `site/scripts/entry-commit.mjs` and `site/scripts/repair-scope.mjs` cannot express a
      removal, because every file they list carries text and is written, and adding or changing a
      record and a person removing one by hand stay allowed
- [x] 4.6 The planted specimen `autowriterCommitRemovesAGenerationRecord` in
      `site/scripts/autowriter-history-specimens.mjs` is the mutation smoke family
      `autowriter-commit-removes-a-generation-record`, and `npm run gate:autowriter` must print the
      finding `generation-record-removed-committed` for it

## 5. The prompt

- [x] 5.1 One bullet follows the `body` bullet of the output contract in
      `site/scripts/writer-prompt-text.mjs`; every number in it is read from the record, which is a
      source in `PROMPT_SOURCES` of `site/scripts/writer-prompt.mjs`
- [x] 5.2 The bullet is stated once, names the buyer prompt by number and text, states the three
      floors and says the length is reached with more sections; for a term it renders the numbers
      of the term
- [x] 5.3 A test edits a number in the record and finds the edited number in the prompt, and a record
      with no limits for the format fails naming the record and the format
- [x] 5.4 The 38 repairable kinds of `site/scripts/repair-kinds.mjs` are checked against the rendered
      prompt: 34 of the 36 content and human kinds are stated in the gate's own words in the
      article prompt and 31 in the term prompt; nothing is removed, and the system prompt for the
      specimen's claim is 4741 words before and 4919 after
- [x] 5.5 A second bullet follows the length bullet and names the three shapes of prose that the
      rendered article prompt does not state in any copied block: a paragraph that closes by saying
      again what it said, three paragraphs in a row opening on the same word, and a section added
      only for balance. The other five shapes the owner named, and the registered name of a concept,
      are already stated in `write-copy.md`, `write-for-humans.md` or `docs/CONTENT-GATE.md` and are
      not stated again; a test holds that each of those phrases is still in its file and that the
      bullet repeats none of them

## 6. Guards

- [x] 6.1 A planted specimen proves each failure mode, each `plant` returning its restore, with six
      rows in the mutation smoke manifest: `autowriter-commit-moves-the-entry-length`,
      `autowriter-generated-entry-under-the-length-floor`, `autowriter-entry-length-record-stale`,
      `autowriter-entry-length-corpus-drifted`,
      `autowriter-entry-length-record-fed-by-the-entry` and
      `autowriter-commit-removes-a-generation-record`
- [x] 6.2 `site/scripts/README.md` carries a row for each new script
- [x] 6.3 `site/scripts/engine-anchors.mjs` lists the record, so `npm run gate:engine` names it for a
      second site; the skills for the writer, its guard and the engine name the record and the
      command that re-measures it, and the skill for the repair loop lists it among the paths
      automation may never write

## 7. Verification

- [x] 7.1 `openspec validate 23-write-at-the-length-of-the-corpus --strict` passes
- [x] 7.2 `npm test` passes and its count is recorded: 4961 tests with 0 failures on `main` before this
      change and 5061 tests with 0 failures after it. One earlier run of the 5061 failed a single
      test, `the record specimen removes the green record and restores it exactly` in
      `site/scripts/unattended-specimens.test.mjs`, a Lighthouse record specimen that this change does
      not touch; it passed three times alone and in the next full run
- [x] 7.3 `npm run check` passes: 0 errors and 0 warnings, 3 hints in test files this change does not
      touch, and eslint and prettier clean
- [x] 7.4 `npm run gate:autowriter`, `npm run gate:docs`, `npm run gate:skills`, `npm run gate:plan`,
      `npm run gate:engine` and `npm run gate:spec` each print 0 findings
- [x] 7.5 The files of pull request #78 copied unchanged onto a checkout of this branch:
      `npm run gate:autowriter` fails the 522-word article with `body-too-short` (465 words against 885) and `section-too-thin` (71 words against 112), and on the article branch without the rule
      the same gate finds nothing; both outputs are in the proposal

Task 7.5 proves the gate on the real article. Whether to close pull request #78 or to write the
article again under the new floor is the owner's decision and not a task of this change.

## 8. Calibration Gate

- [ ] 8.1 `npm run test:smoke` proves every guard family can still fail, the six new ones among
      them, and its family count is recorded; the manifest holds 126 families on this branch and the
      run itself needs a full build and three browsers, so the integrator runs it once
- [ ] 8.2 Run the Calibration Gate and commit the report it generates for this change
