# evals-baseline: the specification and its reference implementation, as designed

Written 2026-11-11 for the owner's review. **Nothing described here is built.** The repository does not exist:
`https://github.com/meshin-co/evals-baseline` answered 404 and the organisation page answered 200 when probed on
2026-11-11 (L76 records the same for the seven slugs). `@meshin/evals-baseline` is not registered on npm (404 at
17:11 UTC the same day), and neither is the unscoped `evals-baseline` (404). The versioned specification page does not
exist either: `https://meshin.co/specs/evals-baseline/1.0.0/` and `https://meshin.co/resources/evals-baseline/` both
answered 404, while `https://meshin.co/resources/agent-evals-ci-starter/` answered 200.

This file is the design the first repository is built from and the text the versioned page is written from. It
decides what `docs/plan/reference/resource-publication-sequence.md` left open: what the baseline file holds, what the
four rules say exactly, what the commands print, how the two tools are read, how three surfaces stay one source, what
the specification half contains, how the guards are proven, and what the repository will never do.

## How to read this document

- **Settled** means the owner decided it on 2026-11-11, and this document does not reopen it (section 1).
- **Decided here** means this document chose it. Every such decision carries its reason and the alternative it beat.
- **Settled** means the owner decided it on 2026-11-11 (section 12), and the decision with its cost is recorded there.
- `[INFERENCE]` marks a claim nobody verified, with what would confirm it. "I could not find X, having looked at A, B
  and C" is reported as a finding. Section 13 collects every `[INFERENCE]`.
- Every number carries its source in the sentence that uses it, or in the evidence log in appendix A.
- Where a clause says MUST, MUST NOT or SHOULD (sections 2 to 8), it carries its RFC 2119 meaning, and those clauses
  are what the versioned page will publish. Everywhere else the words are plain English.
- Output blocks are real. A throwaway prototype, written outside this repository and not part of any repository,
  ran against real files written by promptfoo 0.125.1 and DeepEval 4.3.3 on 2026-11-11. The prototype is not the
  reference implementation, and the blocks are recorded evidence, not something this repository can re-run
  (section 13 says what would confirm them).

## 1. What is settled, and what the evidence supports

| Settled item                                                                                                                                                                             | Source                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Name `evals-baseline`, chosen over `eval-regression-gate` and over keeping `agent-evals-ci-starter`. The site entry keeps its own slug; the repository and the package do not inherit it | `docs/plan/reference/resource-publication-sequence.md` |
| Three surfaces, one source: an npm package under the scope `@meshin` (the owner's own npm username, not `@meshin-co`), a GitHub Action, a dependency-free copyable file                  | the same file                                          |
| The package is the source. The Action and the file are generated from it. The Action ships with its own commit pinned and its README says to pin a SHA                                   | the same file                                          |
| Two input formats at launch, promptfoo and DeepEval. No neutral format of our own yet                                                                                                    | the same file                                          |
| A specification and an implementation. A versioned document at a meshin.co address defines what a regression in an agent evaluation is; the repository is its reference implementation   | the same file                                          |
| The four comparison rules (section 2)                                                                                                                                                    | the same file                                          |
| Warn by default, strict stop opt-in; nothing exits non-zero on a clock                                                                                                                   | L71                                                    |
| Every check binds to a referent inside the consumer's repository; the pattern is `digestFor` in `site/scripts/dispositions.mjs`                                                          | L72                                                    |
| A published repository ships a refusal list in its contributing file and an artefact count that will not grow                                                                            | L73                                                    |
| Nothing is announced; code is MIT and text is CC BY 4.0; no page promises a repository that does not exist                                                                               | L74, L75, L76                                          |
| The red-build fixture is two committed JSON files; a key is needed only to regenerate a baseline, never to watch the gate refuse                                                         | `docs/plan/reference/resource-publication-sequence.md` |

What the evidence supports, and how far. All figures are from `investigation/10-what-exists-for-the-seven-resources.md`,
section 2, read from the GitHub API and the npm and PyPI download APIs on 2026-11-10:

- promptfoo takes 4,137,504 npm downloads a month and DeepEval 2,584,198 PyPI downloads a month, 6,721,702 together,
  which is the "about 6.7 million" the sequence file quotes.
- The only first-party GitHub Action in the category, `promptfoo/promptfoo-action`, has 81 stars and 36 forks. Its
  README says it evaluates only the current checkout and does not run separate base and head evaluations.
- A GitHub repository search for agent-eval CI starters returned `total_count: 0`. The one public gate comparing a run
  against a committed score, `BrickerP/inspect-eval-gate-lab`, has 0 stars and 0 forks and calls itself "not
  production". DeepEval's own regression-testing guide sets `threshold=0.5` in pytest and holds no baseline.
- "Every tool that can detect a regression stores the baseline in its own database." That sentence is the record's.
  It is the gap this artefact fills, and it is the only claim about the category this document relies on.

**What the check behind that gap did not establish.** It enumerated all 1,035 issue and pull-request titles of
`promptfoo/promptfoo-action` and matched them against base, compar, regress, diff and threshold. Four matched and none
is a comparator: numbers 870 and 865 add absolute-threshold inputs, number 122 is a report about unstaged files, and
number 102 is a logging flag. The word `baseline` returned seven hits, all dependency bumps. It read titles, not
bodies, and eight pull requests opened on 2026-07-08 are still open in the adjacent subject of change detection
(number 988 detects removed monitored prompts). So the claim this document may make is the record's narrower one:
**no comparator appears in any title, and adjacent change-detection work is open.** This document never says that no
one does this, or that no one is working nearby.

## 2. What a regression is

This section is the part of the specification that is cited. It defines terms, then the four rules, then the check
that is not a rule, then the findings that are not regressions.

### 2.1 Terms

- A **run file** is the file an evaluation tool writes for one execution of a suite.
- A **sample** is one scored observation of one metric. A **sample count** is how many a run holds for a metric.
- A **metric key** names a metric inside one run: the key (section 6) is the provider label, the string `::` and the
  metric name for promptfoo, and the metric name for DeepEval.
- A **value** is the mean of a metric's samples, on the tool's own scale. This specification assumes higher is better.
- A **baseline** is a reduced record of one run, committed in the repository that owns the suite (section 3).
- A **tolerance** is a number of at least 0, in the metric's own units, stored per metric in the baseline.
- A **finding** is one line that counts toward the summary. A **note** is a line that never counts.

A regression is a difference between a baseline and a later run of the same suite, in the direction and of the size
stated by rules 1, 2 and 4. Rule 3 states what is not a regression.

### 2.2 The four rules

| #   | Rule                                                | Compares                                                   | Finding id       | Message text (the key is printed through the escaping in 5.4)                                       |
| --- | --------------------------------------------------- | ---------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| 1   | A metric the baseline names and the run lacks fails | the set of keys in the baseline against the run            | `missing-metric` | `the baseline names it (<value> over <n> samples) and this run has no such metric`                  |
| 2   | A value below the baseline, beyond tolerance, fails | baseline value against run value, per key                  | `below-baseline` | `<run value> is below the baseline <baseline value> by <drop>, more than the tolerance <tolerance>` |
| 3   | Metrics present only on the run are ignored         | nothing; the keys are listed in one note                   | none             | note: `<n> metric(s) only in this run, not compared (rule 3): <keys>`                               |
| 4   | Unequal sample counts fail                          | baseline `samples` against the run's sample count, per key | `sample-count`   | `the baseline holds <b> samples and this run holds <r>`                                             |

Each finding line is `<id> <key>: <text>`.

1. For every key in the baseline, a run that holds no sample-bearing metric under that key MUST produce
   `missing-metric` for it. If the run holds a metric of that key that the reader refuses to read (section 6.4) the
   finding is `unreadable-metric` instead, with the reader's reason as text. Rules 2 and 4 are not evaluated for a key
   rule 1 reported.
2. For every key present in both, let the drop be the baseline value minus the run value, and let `q(x)` be
   `round(x * 1,000,000)`. The check MUST report `below-baseline` when `q(baseline) - q(run) > q(tolerance)`, and MUST
   NOT otherwise. A value above the baseline is never a finding. The message prints the drop to six decimals with
   trailing zeros removed.
3. A key present in the run and absent from the baseline MUST NOT produce a finding. The check lists at most ten such
   keys in one note, in sorted order, then `, and <n> more`. The rule needs no code of its own: the comparison walks
   the baseline's side only, which is the shape of `site/scripts/catalog-drift.mjs`.
4. For every key present in both, a sample count different from the baseline's `samples` MUST produce `sample-count`,
   whichever direction it differs in. Rules 2 and 4 are independent: one key can produce both.

**Why quantise (decided here).** Plain subtraction in 64-bit floats makes a run sitting exactly on its tolerance
fail. Measured on 2026-11-11: `0.92 - 0.9` is `0.020000000000000018` in JavaScript, so `0.92 - 0.9 > 0.02` is true.
Against a baseline of 0.92 with tolerance 0.02 the prototype gave:

```text
run value   naive subtraction   quantised comparison
0.95        no finding          no finding
0.92        no finding          no finding
0.9         FINDING (wrong)     no finding
0.900001    no finding          no finding
0.899999    FINDING             FINDING
0.6         FINDING             FINDING
```

`q(0.92) - q(0.9)` is 20000 and `q(0.02)` is 20000, so a run exactly at the tolerance passes and one millionth beyond it
fails. The alternative, comparing with an epsilon, hides a real drop of the same size as the epsilon and has no
principled value; the alternative, decimal arithmetic, needs a dependency, and the copyable file has none.

### 2.3 The tolerance

**Decided: absolute, per metric, stored in the baseline file next to the value it relaxes.** The default is 0, so a
baseline with no hand editing fails on any drop. `record` writes 0, or the number given to `--tolerance`, for a metric
it has not seen before, and keeps the existing number for a metric it has (section 3.4). `check` has no tolerance
flag.

| Alternative                     | Why it lost                                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relative (a percentage)         | A 5% tolerance on a value of 0.2 permits a drop to 0.19 and on 0.95 permits a drop to 0.9025, so one number means different things per metric and hides drops on low-value metrics                                      |
| One global number at check time | Metrics differ in noise, so a number loose enough for the noisiest metric is silent on the rest. It would also sit in a workflow line, and the Action, the package and the copied file could be given different numbers |
| A separate config file          | A second file to keep beside the baseline, and a second place for the surfaces to disagree. L72 wants the check bound to something already in the tree; the baseline already is                                         |
| A statistical test              | Refused permanently (section 11). It needs per-case scores the reduced baseline does not keep, and it turns a number a reviewer can read into a p-value nobody can                                                      |

The cost is that a tolerance is edited by hand in a data file, so a typo is possible. The baseline reader therefore
rejects any unknown or missing key (section 3.2) instead of treating a misspelt `tolerence` as the default.

### 2.4 The binding check, which is not a fifth rule

The four rules compare numbers. Nothing in them says the numbers were measured on the same cases, and a suite in which
a hard case is swapped for an easy one keeps its sample counts and only improves. L72 requires every check to bind to
a referent in the consumer's tree, with `digestFor` as the pattern. `digestFor` hashes the target's own text so a row
goes stale when the text moves (`site/scripts/dispositions.mjs`, lines 16 to 21 and 40 to 41).

**Decided: the baseline records a digest of the case inputs, and `check` reports `cases-changed` when the run's digest
differs.** It is a finding, so it warns by default and fails under `--strict`. It is not a regression: it says the
baseline no longer describes this suite, so the rule findings beside it may be meaningless. The page keeps the two
classes apart.

- The digest is the first 12 hexadecimal characters of the SHA-256 of the case identities, each in canonical form
  (object keys sorted at every depth, arrays in order, scalars as `JSON.stringify` writes them, no whitespace), sorted,
  and joined with U+0001. Sorting, joining and truncating are copied from `digestFor`.
- A case identity is, for promptfoo, the `vars` object of the test (one per distinct `testIdx`), and for DeepEval the
  pair `input` and `expectedOutput` of each test case. Prompts, agent output, scorer definitions, thresholds and
  metric names are not in it, for two reasons. The agent and its prompt are what is being tested, so a change to them
  must show as rule 2, not as staleness. Rule 3 needs a new metric to be free, and a new promptfoo assertion changes the
  test's `assert` list.
- Measured on real files, 2026-11-11 (promptfoo 0.125.1, four cases): two separate runs of one suite, a run with a
  worse agent, a run with one assertion removed, a run with a metric added and a run with a provider error all gave
  digest `e6c6ecf167ab`. A run with one case removed gave `b4826cd2872c`, and a run with one case swapped for another
  gave `8090f0ab85ad`. DeepEval 4.3.3 gave `c8663ee8bc8a` for every run of its four cases, `6800e77b28c7` with one case
  removed and `6189a6f3c54e` with one swapped.

| Alternative                                   | Why it lost                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| No digest; rely on rule 4                     | A same-count swap passes every rule. It is the cheapest way to get a green after a regression, and L72 exists to make that expensive              |
| Include scorer definitions                    | Breaks rule 3 for promptfoo, and DeepEval's output does not carry its scorers' definitions at all, so the two readers would bind different things |
| Hash the suite's configuration file           | Needs the user to name it, and misses cases loaded from other files. The run file already holds the resolved cases                                |
| Seal the baseline's own numbers with a digest | Tolerance is meant to be hand-edited and anyone can recompute a public digest. The diff of a committed file is the control                        |

**What the binding does not catch** (stated so nobody reads more into a green): a scorer weakened in place, for
example a promptfoo `contains` value changed so it always passes; two offsetting case-level changes inside an
unchanged aggregate; and a fabricated but complete run file. `[INFERENCE]` that these are acceptable for 1.0. What
would confirm it is a year of use in which none of them is reported as the way a regression slipped through.

### 2.5 Findings that are not regressions

| Id                  | When                                                                                                              | Counts as a finding |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- |
| `no-baseline`       | the baseline path does not exist; nothing was compared                                                            | yes                 |
| `bad-baseline`      | the baseline cannot be read: not JSON, an unknown or missing key, a bad value, a specification it does not read   | yes                 |
| `bad-run`           | the run file cannot be read, or is from a different tool than the baseline                                        | yes                 |
| `unreadable-metric` | the baseline names a metric the reader refuses (section 6.4)                                                      | yes                 |
| `cases-changed`     | section 2.4                                                                                                       | yes                 |
| `internal-error`    | the reader or the comparison threw something that is not a refusal; the text is the error's message (section 5.2) | yes                 |

A check that compared nothing MUST NOT print `no findings`. These ids make that impossible: a missing or unreadable
input is itself a finding, and under the default it warns and exits 0 (section 5).

A **note** is printed as `note: <text>` and never counts. Notes exist for: metrics only in the run (rule 3), samples
the tool itself counted as errors, a metric the reader refuses that the baseline does not name, and a tool version that
differs from the baseline's.

## 3. The baseline file

### 3.1 Decided: a reduced JSON record, committed in the consumer's repository

**Name and place.** The default name is `evals-baseline.json`, at the root of the directory the command runs in. The
`--baseline <path>` argument overrides it, so a repository with two suites keeps two baselines. One baseline holds one
run of one suite from one tool. It is committed like `audits/lighthouse-green.json` in this repository: a small file,
one clock field, written by one command and read by one check. That file holds a `fingerprint` (a SHA-256 over the
build-affecting files of the tree), `recordedAt` and `phase`, and is read by `site/scripts/lh-evidence.mjs`, which
reports a stale stamp with its recorded date. This repository's hard rule (AGENTS.md) is the same idea in prose:
evidence in git is the generated report, never the raw run.

**Contents.** Measured on a real promptfoo 0.125.1 run of four cases, and committed as:

```json
{
  "spec": "1.0.0",
  "source": {
    "tool": "promptfoo",
    "toolVersion": "0.125.1",
    "shape": "promptfoo-results-3"
  },
  "recordedAt": "2026-09-02T09:00:00.000Z",
  "cases": {
    "count": 4,
    "digest": "e6c6ecf167ab"
  },
  "metrics": {
    "agent :: accuracy": {
      "value": 1,
      "samples": 4,
      "tolerance": 0
    },
    "agent :: format": {
      "value": 1,
      "samples": 4,
      "tolerance": 0
    }
  }
}
```

(`recordedAt` was set by the injected clock used for every dated example in this document.)

| Field                         | Meaning                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `spec`                        | the specification version the file follows, as `MAJOR.MINOR.PATCH`; the machine-readable form of a citation         |
| `source.tool`                 | `promptfoo` or `deepeval`                                                                                           |
| `source.toolVersion`          | the version string the tool wrote into its own output, or `null` when the output carries none (DeepEval's does not) |
| `source.shape`                | the output shape the reader recognised: `promptfoo-results-3` or `deepeval-test-run`                                |
| `recordedAt`                  | ISO 8601 UTC, to the millisecond. The only clock in the file                                                        |
| `cases.count`, `cases.digest` | section 2.4                                                                                                         |
| `metrics.<key>.value`         | the mean of the metric's samples, rounded to 6 decimals                                                             |
| `metrics.<key>.samples`       | the sample count, a positive integer                                                                                |
| `metrics.<key>.tolerance`     | a number of at least 0                                                                                              |

The file is JSON with two-space indentation, a final newline, and the metric keys in sorted order, so a re-record that
changes nothing produces no diff.

### 3.2 Reading a baseline

The reader MUST refuse, as `bad-baseline`, a file that is not a JSON object, that has any key beyond those above or
lacks one of them (at every level), whose `spec` is not `MAJOR.MINOR.PATCH`, whose major differs from the
implementation's, or whose minor is newer. A baseline that names no metric is refused, because it guards nothing. The
refusal text names the first problem it found. It reads a baseline of the same major and an older or equal minor.
Run files, by contrast, are read leniently: the tools add fields freely, so an unknown key in a run is ignored and a
missing key the reader needs is `bad-run`.

### 3.3 Decided: reduced, not the tool's own output

| Alternative beaten                                  | Why it lost, with what was measured                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit the raw run file as the baseline             | Two runs of the same suite and the same agent differ in 16 of 386 leaf values (4 result ids, 4 latencies, the eval id, 3 duration totals, 3 timestamps and 1 array element I did not identify), and the files are 17,571 and 17,577 bytes. Every re-record is a noisy diff. The comparison still needs a reader that extracts metrics, so the raw file removes no work |
| A neutral format that the tools write               | Settled against by the owner: a format nobody writes has a corpus of zero files                                                                                                                                                                                                                                                                                        |
| A baseline kept in the tool's own database or cloud | It is the gap (section 1), and it is outside the consumer's tree, which L72 forbids for a check                                                                                                                                                                                                                                                                        |

Measured size of the reduced form against the raw run of the same four cases: 441 bytes against 17,571 for promptfoo,
and 415 bytes against 2,202 for DeepEval (2026-11-11).

**What the reduction costs, stated plainly.**

- One reader per tool and per output shape, and a reader can go stale against its tool. Section 6.5 says how that is
  detected rather than silently mis-read.
- The baseline compares aggregates. It cannot say which case regressed, and two offsetting case-level changes inside an
  unchanged mean are invisible (section 2.4).
- The tool keeps nothing but the reduction. The person who wants to know why a number moved needs the suite's own
  output from that day, which this tool neither keeps nor asks for.

### 3.4 Recording

`record <run-file>` writes the baseline. It MUST:

1. read the run with the reader `check` uses;
2. refuse, exit 1 and write nothing when the run cannot be read, holds samples the tool counted as errors, or holds no
   metric;
3. leave out any metric the reader refuses and say so in a note;
4. keep the tolerance already in the baseline for a key of the same tool, and give a new key the number from
   `--tolerance`, default 0;
5. write nothing, and say `unchanged`, when everything but `recordedAt` equals what the file already holds, so
   `recordedAt` means the date the numbers last changed;
6. when the baseline it is replacing would have reported findings against this run, print them under `replaced:`
   before it writes. Re-recording over a regression is allowed and is never silent.

Real output of items 2, 5 and 6 appears in section 5.3.

## 4. Values, sample counts and keys, per tool

Rules 2 and 4 compare two numbers, and which number is the whole question. This section fixes them for each shape.
Sections 6.2 and 6.3 give the fields.

| Shape                 | Metric key                          | Value                                                                                    | Sample count                                                                                         | A sample the tool counted as an error                  |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `promptfoo-results-3` | `<provider label> :: <metric name>` | the sum of the metric's scores divided by its weight total if present, else by its count | `namedScoresCount` of that metric: the assertions carrying `metric: <name>` that contributed a score | not counted, so the count falls (observed: 4 to 3)     |
| `deepeval-test-run`   | `<metric name>`                     | the arithmetic mean of the metric's `scores`                                             | the length of the metric's `scores`: the samples that have both a score and a verdict                | not in `scores`, so the count falls (observed: 4 to 3) |

**Decided: the sample count is the metric's own count, never the number of cases.**

- For promptfoo it is `namedScoresCount[m]`, the number the value was averaged over. A test with two assertions on one
  metric contributes two, and a test with none contributes nothing. So deleting an assertion changes the count even
  when the number of tests does not.
- For DeepEval it is the length of the metric's `scores` array, which DeepEval itself builds from samples that have a
  score and a verdict (6.3).

| Alternative beaten                                                                                     | Why it lost                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The number of test cases (promptfoo's pass plus fail plus error counts, DeepEval's `testCases` length) | One number for every metric. It still counts a sample that errored, so a provider failure leaves the count unchanged and rule 4 never sees a lost sample. Observed: it would have shown 4 where the metric's own count showed 3 |
| A fixed expected count typed into the baseline                                                         | A typed number, which L72 rules out, and it duplicates a number the run already carries                                                                                                                                         |

Errors are handled twice, on purpose. They lower the sample count, so a check reports them as rule 4 findings. And
`record` refuses a run that holds them, so a baseline can never be recorded from a degraded run and then quietly make
the degraded count the norm.

The value is on the tool's own scale and the tool does not assume a range. A metric whose scores the tool reports as
weighted (promptfoo's `namedScoreWeights`) is a weighted mean, and a weight total that is not a positive number makes
the reader refuse the metric (`unreadable-metric` for a baseline that names it).

## 5. The command surface

### 5.1 Verbs

**Decided: three verbs, one run file each, and the strict flag is named `--strict`.**

| Command                                                                  | Reads                              | Writes            | Prints                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `evals-baseline check <run-file> [--baseline <path>] [--strict]`         | the run file and the baseline      | nothing           | the header, the `date:` line, findings, notes and a summary line                                |
| `evals-baseline record <run-file> [--baseline <path>] [--tolerance <n>]` | the run file, an existing baseline | the baseline only | one line saying what it wrote, left out, or refused, and a `replaced:` block when it applies    |
| `evals-baseline show <run-file>`                                         | the run file                       | nothing           | what the reader extracted: tool, version, shape, cases, and each key with its value and samples |
| `evals-baseline --version`                                               | nothing                            | nothing           | `evals-baseline <package version> (specification <spec version>)`                               |

There is no other verb and no other flag (section 11). `show` exists so a person can see what the reader made of a run
before recording it, and so a reader's output is a thing a specimen can assert on. The tool reads no environment
variable and no configuration file, prints no colour, and opens no network connection.

### 5.2 Exit codes

| Code | When                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | The command ran and the arguments parsed. `check` exits 0 whatever it found, unless `--strict` is given                                          |
| 1    | `check --strict` printed at least one finding, or `record` or `show` was asked to do something it refused (an unreadable run, errored samples)   |
| 2    | A usage error: an unknown verb or flag, not exactly one run file, or a `--tolerance` that is not a number of at least 0. The text goes to stderr |

`check` MUST NOT throw. An exception inside reading or comparing is reported as the finding `internal-error`, with its
message, so the default still exits 0 and strict still exits 1. A build must not go red because of a bug in this tool
on a day nothing in the repository changed (L71). `[INFERENCE]` this has not been exercised: the prototype lets
unexpected exceptions through. Section 9 holds its specimen.

### 5.3 What is printed

A `check` prints, in this order: one header line, one `date:` line when a baseline was read, `cases-changed` if it
applies, the finding lines sorted by key (for one key: rule 1, then rule 2, then rule 4), the note lines, and one
summary line. Real output follows, from promptfoo 0.125.1 files and a baseline recorded on 2026-09-02, with the clock
injected so the dated lines are the same every time. First a clean run, then the default on a worse agent, then
`--strict` on the same run:

```text
$ evals-baseline check run-good.json
evals-baseline 1.0.0 (specification 1.0.0) check evals-baseline.json: promptfoo 0.125.1, 2 metrics, 4 cases
date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11
evals-baseline: no findings
(exit 0)

$ evals-baseline check run-worse.json
evals-baseline 1.0.0 (specification 1.0.0) check evals-baseline.json: promptfoo 0.125.1, 2 metrics, 4 cases
date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11
below-baseline agent :: accuracy: 0.75 is below the baseline 1 by 0.25, more than the tolerance 0
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)
(exit 0)

$ evals-baseline check run-worse.json --strict
evals-baseline 1.0.0 (specification 1.0.0) check evals-baseline.json: promptfoo 0.125.1, 2 metrics, 4 cases
date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11
below-baseline agent :: accuracy: 0.75 is below the baseline 1 by 0.25, more than the tolerance 0
evals-baseline: 1 finding; exit 1 (--strict)
(exit 1)
```

Rules 1, 3 and 4 and the binding check, from the same baseline. A metric dropped from the suite, a metric added, a
suite shrunk to three cases, one case swapped for another with the count unchanged, and a run in which a provider
error removed one sample:

```text
$ evals-baseline check run-nometric.json
missing-metric agent :: format: the baseline names it (1 over 4 samples) and this run has no such metric
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-extra.json
note: 1 metric(s) only in this run, not compared (rule 3): agent :: extra
evals-baseline: no findings

$ evals-baseline check run-3tests.json
cases-changed: the baseline was recorded from 4 cases (digest e6c6ecf167ab); this run holds 3 cases (digest b4826cd2872c); re-record if the change is intended
sample-count agent :: accuracy: the baseline holds 4 samples and this run holds 3
sample-count agent :: format: the baseline holds 4 samples and this run holds 3
evals-baseline: 3 findings; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-swapped.json
cases-changed: the baseline was recorded from 4 cases (digest e6c6ecf167ab); this run holds 4 cases (digest 8090f0ab85ad); re-record if the change is intended
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-error-one.json
sample-count agent :: accuracy: the baseline holds 4 samples and this run holds 3
sample-count agent :: format: the baseline holds 4 samples and this run holds 3
note: agent: 1 errored test(s) in this run (promptfoo testErrorCount)
evals-baseline: 2 findings; warning only, exit 0 (pass --strict to exit 1)
```

(The header and `date:` lines, identical to the blocks above, are left out of this second block; every real `check`
prints them.) Inputs that are not a run or a baseline, and a usage error:

```text
$ evals-baseline check run-good.json --baseline does-not-exist.json
evals-baseline 1.0.0 (specification 1.0.0) check does-not-exist.json
no-baseline: no baseline at does-not-exist.json; nothing was compared; record one with: evals-baseline record <run-file>
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)
(exit 0)

$ evals-baseline check /tmp/hand.json
bad-run: /tmp/hand.json: neither a promptfoo results file nor a DeepEval test run; top-level keys: accuracy
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check
usage: evals-baseline <check|record|show> <run-file> [--baseline <path>] [--strict] [--tolerance <n>]
(exit 2, stderr)
```

And `record`: unchanged, refused twice, and replacing a baseline the new run regresses against:

```text
$ evals-baseline record run-good-again.json
evals-baseline 1.0.0 (specification 1.0.0) record: unchanged: evals-baseline.json already holds these values; not rewritten (recorded 2026-09-02)
(exit 0)

$ evals-baseline record run-error-one.json
evals-baseline 1.0.0 (specification 1.0.0) record: refused: the run has errored samples (agent: 1 errored test(s) in this run (promptfoo testErrorCount)); fix them and run the suite again; nothing written
(exit 1)

$ evals-baseline record run-unnamed.json
evals-baseline 1.0.0 (specification 1.0.0) record: refused: no named metric in this run; add "metric: <name>" to the assertions you want guarded; nothing written
(exit 1)

$ evals-baseline record run-worse.json --baseline rr.json
evals-baseline 1.0.0 (specification 1.0.0) record: wrote rr.json (2 metrics, 4 cases, promptfoo 0.125.1)
replaced: the previous baseline would have reported 1 finding against this run:
  below-baseline agent :: accuracy: 0.75 is below the baseline 1 by 0.25, more than the tolerance 0
(exit 0)
```

**Dated, and never on a clock.** L71 says a clock fact is printed as a dated line instead of failing. The only clock
fact the tool knows is the age of the baseline, so it prints `date:` on every `check` that read one. The line is
display. The exit code, the findings and the summary are functions of the baseline and the run alone, and the date
reaches the output through one argument of the rendering function, never through the comparison. There is no expiry,
no "baseline older than N days" finding and no staleness limit: the first would be the red build with no diff that L71
names.

### 5.4 Rules for every printed line

1. Everything that came from a file (a metric key, a tool name, a path, a reader's reason) MUST be printed through one
   function that replaces each character from U+0000 to U+001F and U+007F with `\u` and four lowercase hexadecimal
   digits. A newline in data therefore cannot start a line, so data cannot begin a GitHub workflow command or forge a
   finding. The tool prints no escape sequence of its own.
2. Every finding line starts with its id, and every note line with `note: `, so `grep` selects either class.
3. The summary line is the last line, and is one of three: `evals-baseline: no findings`, `evals-baseline: <n>
finding(s); warning only, exit 0 (pass --strict to exit 1)` or `evals-baseline: <n> finding(s); exit 1 (--strict)`.

## 6. Reading promptfoo and DeepEval

### 6.1 Decided: the reader is chosen by inspecting the file's content

A run file is recognised as promptfoo when it holds an object `results` with a numeric `version`, and as DeepEval when
it holds the arrays `testCases` and `metricsScores`. A file that matches both, or neither, is `bad-run`, and the text
names the top-level keys it saw. A DeepEval file whose only key of interest is `testRunData` gets its own refusal that
names the file to use instead (observed: the rolling file named `.latest_test_run.json` wraps its run in that key).
A run file of a different tool than the baseline's is `bad-run` too.

| Alternative beaten              | Why it lost                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A `--format` flag               | The file already says what it is, and a flag lets the two disagree. Where they do, the result is a mis-read run that looks like a pass         |
| The file name                   | promptfoo's `--output` takes any name, and DeepEval writes two different names (`.latest_run_full.json` and `test_run_<YYYYMMDD_HHMMSS>.json`) |
| Reading both and trying in turn | Hides which reader failed and why                                                                                                              |

### 6.2 promptfoo

Documentation and source read (all on 2026-11-11; links in 6.6). `promptfoo eval --output <file>` writes a file whose
format its extension picks. The JSON form is an `OutputFile`: `evalId`, `results`, `config`, `shareableUrl` and
optional `metadata`, with `results` an evaluate summary of version 3 or 2. npm's latest version was 0.125.1.

| Need                | Field read                                                                                                | Note                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape               | `results.version`                                                                                         | Must be 3. Any other number is `bad-run`                                                                                                                  |
| Columns             | `results.prompts[i].provider`                                                                             | The provider label. A label that repeats is `bad-run`, so 1.0 reads one prompt per provider (6.5)                                                         |
| Value of metric `m` | `metrics.namedScores[m]` divided by `metrics.namedScoreWeights[m]` when present, else by the sample count | `namedScores` is the sum of the scores of the assertions that carry `metric: m`                                                                           |
| Sample count of `m` | `metrics.namedScoresCount[m]`                                                                             | The number of assertions that contributed. Observed: a provider error removed that test's assertions from the count (4 to 3), which is how rule 4 sees it |
| Errors              | `metrics.testErrorCount`                                                                                  | A value above 0 is a note, and makes `record` refuse                                                                                                      |
| Case identity       | `results.results[j].testIdx` and `.testCase.vars`                                                         | The digest of section 2.4                                                                                                                                 |
| Tool version        | `metadata.promptfooVersion`                                                                               | Stored as `source.toolVersion`; `null` when absent                                                                                                        |

Metric key: `<provider label> :: <metric name>`, for example `agent :: accuracy`. Only assertions that carry a `metric`
produce a named score, so a suite with none has nothing to guard: `record` refuses it and `show` says what to add
(output in 5.3). A metric name that appears in `namedScores` with no entry in `namedScoresCount` is a derived metric,
has no sample count, and is skipped; I observed one in a scratch run. Source for the accumulation of named scores is
the file src/util/namedMetrics.ts in the promptfoo repository.

**The consumer's side.** promptfoo exits with code 100 when tests fail, unless `PROMPTFOO_FAILED_TEST_EXIT_CODE=0`
(command-line documentation), so a following `check` step does not run after a failing evaluation unless the
workflow lets it. The README says so, and says to set that variable on the evaluation step or give the check step
`if: always()`. That is the consumer's choice and is not this tool's to make.

### 6.3 DeepEval

Source read at the tag `python-v4.3.3` (PyPI's latest on 2026-11-11 was 4.3.3).

| Need                | Field read                                                                                                                                             | Note                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which file          | the rolling file `.latest_run_full.json` inside `.deepeval`, or a `test_run_<YYYYMMDD_HHMMSS>.json` file in the folder `DEEPEVAL_RESULTS_FOLDER` names | `local_store.py` documents both, and says the second is written only when a results folder is set. The file is identical in content (observed)                                                                                         |
| Shape               | `testCases` and `metricsScores`, both arrays                                                                                                           | There is no schema-version field in the file (I looked for `schema_version` and `version` and found neither)                                                                                                                           |
| Value of metric `m` | the mean of `metricsScores[i].scores` for the entry whose `metric` is `m`                                                                              |                                                                                                                                                                                                                                        |
| Sample count of `m` | the length of that `scores` array                                                                                                                      | `test_run.py` lines 288 to 298 count a sample into `scores` only when it has both a score and a verdict (`success`); otherwise it adds to `errors`. A score-only metric, one with no threshold, therefore has 0 samples and all errors |
| Errors              | `metricsScores[i].errors`                                                                                                                              | A value above 0 is a note and makes `record` refuse. The text says the metric raised an error or returned no verdict                                                                                                                   |
| Case identity       | each `testCases[j]`'s `input` and `expectedOutput`                                                                                                     | The digest of section 2.4                                                                                                                                                                                                              |
| Polarity witness    | each `testCases[j].metricsData[k]`'s `name`, `score`, `threshold` and `success`                                                                        | Section 6.4                                                                                                                                                                                                                            |
| Tool version        | none                                                                                                                                                   | `source.toolVersion` is `null`, and the header prints `version unknown`                                                                                                                                                                |

Metric key: the metric name, for example `Accuracy`. Built-in metrics read the same way: a run with `ExactMatchMetric`
and `PatternMatchMetric` gave the keys `Exact Match` and `Pattern Match` with four samples each. A run in which
`conversationalTestCases` is not empty is `bad-run`: I observed no multi-turn run, so 1.0 does not read one.
DeepEval can store runs in SQLite instead (`DEEPEVAL_LOCAL_STORE=sqlite`); JSON is the default, and the blog post that
introduced the option, dated 2026-09-14, says so. A SQLite file is not JSON and is `bad-run`.

### 6.4 Decided: DeepEval metrics are read as higher-is-better only, and a contradicting metric is refused

Rule 2 treats a lower value as worse. DeepEval metrics are not uniformly that way: at the tag `v4.1.8` the Toxicity
metric's `is_successful` sets `success = score <= threshold` (`toxicity.py` lines 287 to 297, the comparison on 294),
which is lower-is-better. `[INFERENCE]` for the current tag: the same method is not at those lines in
`python-v4.3.3`, and I did not trace where the rule lives now. What would confirm it is reading the Toxicity success
rule at that tag.

The reader therefore checks DeepEval's own verdicts as a witness. For each sample with a numeric `score`, a numeric
`threshold` and a boolean `success`, `success` MUST equal `score >= threshold`. A metric with one sample that does not
is refused: it is absent from the reader's output and a baseline that names it gets `unreadable-metric`, with the
text `DeepEval's own verdicts contradict higher-is-better in <n> sample(s) (success=<s>, score=<x>, threshold=<t>);
this implementation reads higher-is-better metrics only`. `show` and `record` print it as a note.

| Alternative beaten                      | Why it lost                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Read every metric as higher-is-better   | A lower-is-better metric that gets worse rises, and rule 2 reports nothing. A green with no information, which L72 forbids  |
| A per-metric polarity setting           | It is a typed string the consumer controls, so a wrong value passes silently. The witness is bound to the tool's own output |
| A list of known lower-is-better metrics | It goes stale the day DeepEval changes one, which the Toxicity difference between tags shows it does                        |

The cost: a lower-is-better metric cannot be guarded in 1.x at all. A metric whose verdicts never contradict the
reading, because every sample passed whichever way, is read as higher-is-better and could be wrong. The witness
proves a contradiction, never a polarity. `[INFERENCE]` that this is rare enough to accept; what would confirm it is
reading the success rule of every built-in DeepEval metric and counting the lower-is-better ones.

### 6.5 How a tool's version change is detected instead of silently mis-read

| What changes                                                           | Detected by                                              | What the check does                                                                                                                                                    |
| ---------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| promptfoo's results version is not 3                                   | `results.version`                                        | `bad-run`, naming the version                                                                                                                                          |
| A promptfoo field the reader needs is renamed, removed or changes type | a presence and type test on every field in 6.2           | `bad-run`, naming the field path                                                                                                                                       |
| promptfoo's version differs from the baseline's                        | `metadata.promptfooVersion` against `source.toolVersion` | a note: `the baseline was recorded by <tool> <version>; this run was written by <version>`                                                                             |
| Two prompts share one provider label                                   | the repeated `provider`                                  | `bad-run`. This is a known limit of 1.0 and costs the multi-prompt matrix                                                                                              |
| A DeepEval field is renamed or removed                                 | the same presence and type tests on 6.3                  | `bad-run`, naming the field path                                                                                                                                       |
| DeepEval changes a metric's polarity                                   | the witness of 6.4                                       | `unreadable-metric`                                                                                                                                                    |
| DeepEval writes a different format                                     | the file is not JSON, or matches no shape                | `bad-run`                                                                                                                                                              |
| A tool keeps its output shape and changes what a number means          | nothing                                                  | nothing. This is the limit. `[INFERENCE]`: the first sign would be a rule 2 finding after an upgrade, and the `date:` and version note are what a reader would look at |

The mismatch between tools in the table is deliberate. promptfoo writes its own version into the file and DeepEval does
not, so only promptfoo can print a version note. The specification does not pretend otherwise.

### 6.6 What was read

| What                                                          | Where                                                                                                                                                      | Pinned to        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| promptfoo output formats                                      | [promptfoo documentation, outputs](https://www.promptfoo.dev/docs/configuration/outputs/)                                                                  | read 2026-11-11  |
| promptfoo exit code 100 and `PROMPTFOO_FAILED_TEST_EXIT_CODE` | [promptfoo documentation, command line](https://github.com/promptfoo/promptfoo/blob/main/site/docs/usage/command-line.md)                                  | main, 2026-11-11 |
| promptfoo `OutputFile` type                                   | [types file](https://github.com/promptfoo/promptfoo/blob/main/src/types/index.ts)                                                                          | main, 2026-11-11 |
| promptfoo named score accumulation                            | [namedMetrics source](https://github.com/promptfoo/promptfoo/blob/main/src/util/namedMetrics.ts)                                                           | main, 2026-11-11 |
| promptfoo real output                                         | a scratch run of `promptfoo@0.125.1` with a file provider, no key, telemetry and sharing off                                                               | 0.125.1          |
| DeepEval local storage                                        | [local store source](https://github.com/confident-ai/deepeval/blob/python-v4.3.3/deepeval/evaluate/local_store.py)                                         | python-v4.3.3    |
| DeepEval metric aggregation                                   | [test run source](https://github.com/confident-ai/deepeval/blob/python-v4.3.3/deepeval/test_run/test_run.py), lines 268 to 298 and 380 to 390              | python-v4.3.3    |
| DeepEval Toxicity success rule                                | [toxicity source at v4.1.8](https://github.com/confident-ai/deepeval/blob/v4.1.8/deepeval/metrics/toxicity/toxicity.py), lines 287 to 297                  | v4.1.8           |
| DeepEval SQLite option and JSON default                       | [the 2026-09-14 post](https://github.com/confident-ai/deepeval/blob/python-v4.3.3/docs/content/blog/2026_sep/introducing-sqlite-local-storage/article.mdx) | python-v4.3.3    |
| DeepEval real output                                          | a scratch run of `deepeval` 4.3.3, local metrics only, no key                                                                                              | 4.3.3            |

## 7. Three surfaces, one source

### 7.1 The package

**Decided: the package is `@meshin/evals-baseline`, it has no runtime dependency, and its source imports only built-in
`node:` modules.** The second half is what makes the copyable file a concatenation instead of a bundle with a resolver
inside it.

| Export         | Does                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `readRun`      | text of a run file to a run (tool, version, shape, keys with value and samples, cases, notes), or throws `Unreadable` |
| `readBaseline` | text of a baseline to a baseline under the strictness of 3.2, or throws `Unreadable`                                  |
| `record`       | a run, a clock value, a tolerance and an optional previous baseline to a baseline                                     |
| `compare`      | a baseline and a run to findings and notes. A pure function: no clock, no environment, no file                        |
| `render`       | a result, a strict flag and today's date to the lines and the exit code of section 5                                  |

The `evals-baseline` command is the only `bin`. The package declares no install script, and a test asserts it. Its
version is its own SemVer number, separate from the specification's (8.2). The licence is MIT (L75).

### 7.2 The Action

**Decided: a JavaScript Action whose single bundled file is committed, with three inputs and one output.**

| Input      | Default               | Meaning                                                                                    |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `run-file` | none, required        | the run file, relative to the workspace                                                    |
| `baseline` | `evals-baseline.json` | the baseline, relative to the workspace                                                    |
| `strict`   | `false`               | the one value that makes the step fail when there is a finding. Anything but `true` is off |

| Output     | Meaning                             |
| ---------- | ----------------------------------- |
| `findings` | the number of findings, as a string |

The Action prints the same lines as the command. In addition it writes one workflow annotation per finding, a warning
by default and an error under strict, so a finding is visible on the run page without opening the log: L71 wants the
visibility. Annotation text goes through the escaping GitHub's toolkit uses for workflow commands (`%`, carriage return
and newline in a message, plus `:` and `,` in a property; `escapeData` and `escapeProperty` in the toolkit's
`command.ts`), after the printing rule of 5.4. It takes no token, uses no network, and the README tells the reader to
grant it `contents: read` and nothing else.

| Alternative beaten                   | Why it lost                                                                                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A composite Action that runs `npx`   | It fetches code from the registry at run time, so pinning the Action's SHA no longer pins the code that runs. The owner's condition is that the Action ships with its own commit pinned                                    |
| A composite Action with a shell step | GitHub's secure-use guidance recommends a JavaScript action that receives context values as arguments, because it cannot be used for script injection through a shell line                                                 |
| A Docker Action                      | Slower to start, needs a registry, and adds an image to pin                                                                                                                                                                |
| Moving tags (a major tag)            | The sequence file names it: a mutable major tag from a one-person organisation is code execution inside a buyer's CI. GitHub's page says a full-length commit SHA is the only way to use an action as an immutable release |

The repository MUST NOT create a moving tag. Releases carry a version tag for people, and the README example uses the
full-length SHA of the commit that holds the generated files. Writing that SHA into the README is the last step of a
release and changes no generated file. `[INFERENCE]` for the runtime value in `action.yml`: the Node runtime that
GitHub's metadata syntax page lists as current on the release day is used. I fetched that page on 2026-11-11 and did
not keep the list, so no version is asserted here.

### 7.3 The copyable file

**Decided: one file named `evals-baseline.mjs`, run with `node evals-baseline.mjs check <run-file>`.** It has no
import except built-in `node:` modules and no dependency, it is not minified, and its first lines say which
specification and package version it was generated from. A consumer whose policy forbids the package and the Action
copies it and compares its SHA-256 with the one the release lists. The Node version it needs is the package's.
`[INFERENCE]`: not asserted here, for the reason in 7.2.

### 7.4 Generation, and the check that proves the three agree

One build script reads the package's source modules in a fixed order and writes two files, with no timestamp and no
environment in them so a rebuild is byte-identical: the Action's bundled file (the modules plus an entry that reads the
three inputs and writes the output and the annotations) and the copyable file (the modules plus the command entry).
A manifest lists the SHA-256 of each generated file and of the source set. All three are committed, because an Action
runs from a commit and a copy is taken from one.

What proves the surfaces cannot disagree, in the order it runs:

1. **Rebuild and compare.** On every push and pull request, CI rebuilds into a scratch folder and fails if any
   generated file or the manifest differs, byte for byte, from the committed one. A hand edit to a generated file fails
   here whether or not the manifest was edited with it.
2. **Parity.** Every specimen of section 9.1 is run through the package, the copied file as a process and the Action's
   entry in process, and the report lines and exit codes MUST be equal. Only the annotation lines are excluded, and a
   separate test covers them.
3. **Static guards on the generated files.** Every import is `node:`-prefixed; none contains a network API name; none
   uses `eval` or `Function`. Each guard has a planted violating specimen (9.3).

What this does not prove: that a consumer's copy is the repository's copy (the manifest lets them check), and that a
fork kept the check on. `[INFERENCE]` that a unified source this small stays that way; what would confirm it is the
second release, when the first real change has to pass through all three.

## 8. The specification half

### 8.1 What the versioned document contains that the README does not

The README says how to use the tool. The specification says what the words mean, so that a second implementation, in
another language, or a person reading a pull request, can tell whether a result is right. If they disagree the
specification wins, and the README states no rule that the specification does not.

The specification holds: the terms of 2.1; rules 1 to 4 as the numbered clauses of 2.2 and the binding check of 2.4;
the finding and note vocabulary of 2.5 and the exit-code semantics of 5.2; the baseline schema of 3.1 and 3.2 as a
format; the definitions of value, sample count and metric key for each tool shape (6.2 and 6.3), because those are what
make two implementations produce the same number; the three non-negotiable properties as conformance requirements; the
permanent refusals; the versioning policy; a changelog; and the conformance vectors. The vectors are the committed
fixtures, each a baseline and a run file with the exact expected report. An implementation conforms to a version when
it reproduces the expected findings, notes and exit codes on that version's vectors, and a vector pair exists for each
of rules 1 to 4, the binding check and each refusal. Conformance is the thing the README cannot give.

The README holds: the three one-line ways to install or copy it, the pin-a-SHA warning, how to produce a run file with
each tool and to record, a pointer to the specification, and the citation block.

### 8.2 Decided: versioned in the shape SemVer has, and no published version is edited

| Number              | Changes when                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specification MAJOR | A rule, the baseline schema, a finding id, an exit code or the metric key of a shape changes so that an older baseline or an older reading gives a different answer |
| Specification MINOR | An output shape is added (a newer promptfoo results version, say), so older baselines are still read and nothing already readable changes meaning                   |
| Specification PATCH | Wording, examples and vectors added, with no behaviour change                                                                                                       |
| Package version     | Its own SemVer number. A package release implements exactly one specification version, and a new specification MAJOR needs a new package MAJOR                      |

`--version` prints both numbers. A baseline carries `spec`, and an implementation reads a baseline of its own major
and an older or equal minor (3.2). Once published a version's page is never edited: a correction is a new PATCH, as
SemVer's own text says of a released package (https://semver.org/spec/v2.0.0.html, clause 3, which I recalled and did not
re-read for this document, so that is `[INFERENCE]`).

**Why the version is in the address.** From `investigation/10-sources/how-a-resource-wins.md`: SemVer is cited at a
versioned page of numbered clauses, the Keep a Changelog 1.1.0 path let version 2.0.0 ship in 2026 without invalidating
nine years of citations, and the corpus table names the version in the citation path as necessary at scale. No winner in
the corpus is cited by its repository URL. The counter-signal is also there: after 2.0.0 shipped,
`keepachangelog.com` still defaulted to 1.1.0 and issue 745 (2026-10-08) says 2.0.0 was not discoverable. So there is
an unversioned page for the artefact that lists every version, names the current one and holds no normative text, and
the versioned pages are the only ones cited.

### 8.3 The address (settled, section 12)

The requirements, from the evidence and from L53 and L76: the address is on meshin.co and never a repository path; it
holds the full version; each published version has one page; the artefact has one unversioned page that lists the
versions; it carries the final name `evals-baseline` and not the site entry's slug; and it joins one of the fixed route
families, because `site/.agents/skills/place-a-new-text.md` says the families are fixed and that a text which fits none
means the idea is wrong for this site. The route set is frozen outside a phase that says otherwise (L53). I probed two
candidate addresses on 2026-11-11 and both answer 404; neither is promised anywhere. Section 12 gives the options.

### 8.4 What a citation looks like

Three forms, all naming the version and none naming a repository (L76):

- **Prose:** `evals-baseline specification 1.0, https://meshin.co/spec/evals-baseline/1.0/`.
- **Paste-ready, shipped in the README and at the head of the page:** "This project guards its agent evaluations
  against regression as defined by the [evals-baseline specification 1.0](https://meshin.co/spec/evals-baseline/1.0/)."
  Keep a Changelog ships its own pre-formatted, versioned citation block, and the research calls that the most
  transferable finding and one that costs nothing.
- **In a file:** `"spec": "1.0.0"` in the baseline (3.1). A baseline states which version of the definition it
  follows.

The address is `https://meshin.co/spec/evals-baseline/1.0/`, settled in section 12. The version in the path is two numbers rather than three: a patch to a specification is either editorial, which changes no citation, or normative, which is a new minor.

## 9. How the guards are proven

This repository's hard rule is that every guard has a planted violating specimen and is proven to fail before it is
trusted (AGENTS.md). `site/scripts/mutation-specimens.mjs` holds the pattern in `proveWithSpecimen`, lines 674 to 701.
It runs the guard on a pristine copy, which must be green and must not print the specimen's token. It plants the
violation and runs again. The guard must then go red and print the token, or, for a guard that may only warn, exit 0
and print the token. A guard that stays green, or goes red for another reason, fails the proof.

### 9.1 One specimen per guard

The fixtures are real files. The promptfoo suite is four capital-city questions answered by a file provider, with two
named metrics, `accuracy` (the answer contains the capital) and `format` (a single capitalised word). The DeepEval
suite is the same four questions with local metrics. Neither needs a provider key, which is the owner's condition for
the red-build fixture. Everything below was run on 2026-11-11 against promptfoo 0.125.1 and DeepEval 4.3.3 except what is
marked `not run`.

| #   | Guard                 | Planted violation                                                                                                                                                                                                                                                                                                                             | Expected, default and under `--strict`                                                                                                                                                                                                             | The mutation that must flip it                                                            |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| S1  | Rule 1                | the `format` assertions removed from the suite (promptfoo); only `Accuracy` measured (DeepEval)                                                                                                                                                                                                                                               | `missing-metric` for that key; exit 0 and 1. Twin: the unchanged suite run twice gives no finding                                                                                                                                                  | delete the loop over the baseline's keys                                                  |
| S2  | Rule 2                | the agent answers one case wrongly, accuracy 1 to 0.75 (both tools)                                                                                                                                                                                                                                                                           | `below-baseline`; exit 0 and 1                                                                                                                                                                                                                     | compare with `>=`, or with plain subtraction                                              |
| S2b | Rule 2, the boundary  | baseline 0.92, tolerance 0.02, runs 0.9, 0.900001, 0.899999, and one above the baseline                                                                                                                                                                                                                                                       | only 0.899999 is a finding (table in 2.2)                                                                                                                                                                                                          | plain subtraction turns 0.9 into a finding; `>=` does too                                 |
| S3  | Rule 3                | a metric the baseline does not name, added (both tools)                                                                                                                                                                                                                                                                                       | no finding and one note; exit 0 and 0                                                                                                                                                                                                              | make the comparison walk the union of the keys                                            |
| S4  | Rule 4                | the suite cut to three cases (both tools), and a provider error on one case (promptfoo) or a metric error (DeepEval)                                                                                                                                                                                                                          | `sample-count` for each metric, and `cases-changed` for the cut; exit 0 and 1                                                                                                                                                                      | delete the count comparison                                                               |
| S5  | The binding check     | one case swapped for another, count unchanged (both tools)                                                                                                                                                                                                                                                                                    | `cases-changed` and nothing else; exit 0 and 1. Twin: the same suite twice gives the same digest (measured)                                                                                                                                        | delete the digest comparison                                                              |
| S6  | Warn by default       | every violation above                                                                                                                                                                                                                                                                                                                         | exit 0 without `--strict`, and 1 with it                                                                                                                                                                                                           | make the default exit 1                                                                   |
| S7  | No clock              | the same baseline and run rendered with dates a year apart (2026-11-11 and 2027-11-11)                                                                                                                                                                                                                                                        | the same exit code and identical lines except `date:` (70 days against 435), which ran. The source of the comparison function names no `Date`, `Math.random`, `process` or `performance`, checked on the prototype                                 | add a clock read to `compare` or to the exit code, and the source guard fails (`not run`) |
| S8  | Input problems        | no baseline; a hand-written run; promptfoo results version 4; a file matching both shapes; a file that is not JSON; a missing run file; the DeepEval wrapper file; a run of the other tool; a baseline with a misspelt key; a baseline missing `cases`; a baseline of a newer minor; a baseline of another major; a baseline naming no metric | exactly one finding of the right id (`no-baseline`, `bad-baseline` or `bad-run`) and never `no findings`; exit 0 without strict. All ran on the prototype; the strict exit is S6's                                                                 | make an unreadable input print `no findings` (`not run`)                                  |
| S9  | Polarity and refusals | a lower-is-better DeepEval metric; a score-only DeepEval metric; a non-empty `conversationalTestCases`; a SQLite-like file                                                                                                                                                                                                                    | the first is refused and printed as a note by `show` and `record`; as `unreadable-metric` for a baseline that names it it was not run. The second is counted as errors and makes `record` refuse. The third and fourth are `bad-run`. The rest ran | drop the witness (`not run`)                                                              |
| S10 | Output injection      | a metric named with a newline, the text `::error::` and an escape character                                                                                                                                                                                                                                                                   | printed as `agent :: bad\u000a::error::pwned\u001b[31m` in a note, with no raw newline, no raw escape and no line starting with `::`. It ran                                                                                                       | print the key without the replacement of 5.4 (`not run`)                                  |
| S11 | `internal-error`      | a reader or comparison made to throw something that is not `Unreadable`                                                                                                                                                                                                                                                                       | one `internal-error` finding; exit 0 and 1. `not run`                                                                                                                                                                                              | let the exception escape                                                                  |
| S12 | The surfaces agree    | one byte changed in a generated file; the Action entry's reading of `strict` changed; a `fetch` added to a generated file; an import added without `node:`                                                                                                                                                                                    | the rebuild check, the parity run, the network guard and the import guard each fail. `not run`                                                                                                                                                     | remove the corresponding step                                                             |
| S13 | `record`              | a run with an errored sample; a re-record of identical numbers; a re-record over a regression; a re-record of identical numbers over a hand-set tolerance of 0.02                                                                                                                                                                             | refused with exit 1; `unchanged` and no write; `replaced:` with the old findings; `unchanged` again, so the tolerance was carried into the new record. All four ran (section 5.3 shows the first three)                                            | drop each rule of 3.4 in turn (`not run`)                                                 |

S1 to S10 and S13 ran on the prototype in the form described. S11 did not, because the prototype has no `internal-error`, and S12 did not, because the surfaces do not exist. No mutation proof of 9.3 has run. A `not run` mark is the specification of a test, not a result.

### 9.2 The first test

**Decided: the first test is the red-build fixture, written before any comparator code exists.** The fixture is a
baseline and a regressed run of the promptfoo suite, both committed JSON. The test runs `check` on them and asserts
the exact report (with the date masked) and exit 0; runs it again with `--strict` and asserts the same finding line and
exit 1. It fails first because nothing exists.

Why this one first. It is the thing the sequence file promises: two committed JSON files, so a stranger reproduces the
refusal in a fork within the hour and needs no provider key. One test pins the warn default, the strict flag, the
output grammar and rule 2. And every other specimen is a variation of it, so the grammar it fixes is the grammar the
rest assert against.

| Alternative beaten                  | Why it lost                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A unit test of the comparison alone | It would pass on a comparator that prints nothing a person can read, and the printed finding is the product (L71) |
| Rule 1 first, the simplest rule     | It asserts presence only, and a comparator that finds every metric missing would pass it                          |

### 9.3 Proving a guard can fail

After S1 to S13 pass, the proof of 9.1 runs: for each check a mutated copy of the source is generated in a scratch
folder with that check removed (the last column of the table), and the specimen MUST then give the wrong answer. A
specimen that still gives the right answer on its mutation means the guard is vacuous, and the build fails. The proof
runs in CI as well as locally, because it is milliseconds of work on files of a few hundred bytes, unlike this
repository's, which needs a build and three browsers.

## 10. How the three non-negotiable properties are met

| Property (resource-publication-sequence file, L71, L72)                                             | Mechanism                                                                                                                                                                                                                                                                                                                       | Proof               | The limit                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The strict stop is opt-in and the default is a printed, dated finding                               | Exit 0 whatever `check` finds; `--strict` is the only way to exit 1 (5.2); the Action's `strict` defaults to `false`; the `date:` line and an annotation per finding make an ignored finding visible                                                                                                                            | S6                  | A consumer can delete the step. The tool cannot stop that and does not pretend to: the visibility is the point                                                                                                                                                                                                                                                   |
| Nothing exits non-zero on a clock                                                                   | The comparison is a pure function of the baseline and the run. The date is display. No expiry, no age limit (5.3)                                                                                                                                                                                                               | S7                  | `recordedAt` is written by the tool, not verified against git. Binding it to the commit that changed the file would need history in CI, and a shallow checkout lacks it, so the date is printed as recorded and labelled `date:`. `[INFERENCE]` that a default checkout lacks that history; reading the checkout action's `fetch-depth` default would confirm it |
| A green must be expensive to fake. Every check binds to a referent inside the consumer's repository | The baseline is a committed file in the consumer's tree and nothing is read from outside it (no network, no database). The `cases` digest binds the numbers to the cases that produced them, in the manner of `digestFor`. `record` refuses a degraded run and prints what it replaces. Readers refuse a shape they do not know | S2, S4, S5, S8, S13 | See the table below                                                                                                                                                                                                                                                                                                                                              |

The routes to a false green, and what each costs:

| Route                                            | What it costs and leaves behind                                                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete or rename the baseline                    | `no-baseline` is a finding, so the result is not green. Under strict it is red                                                                                                                |
| Edit the baseline's numbers or tolerance by hand | A visible diff in a committed data file, beside the number it relaxes                                                                                                                         |
| Re-record from the regressed run                 | One command, and it prints the findings it erases (`replaced:`) into the log. The baseline diff shows the new numbers                                                                         |
| Remove a metric from the suite                   | Rule 1 fires. Removing it from the baseline too is the previous row                                                                                                                           |
| Remove or swap cases in the suite                | Rule 4 fires on a count change and the binding check on a swap                                                                                                                                |
| Weaken a scorer in place                         | **Not caught.** Stated in 2.4. A reviewer sees it in the suite's diff, not in this tool's                                                                                                     |
| Hand-write or edit the run file                  | The reader needs a complete native shape, and the baseline's `source` must match. **A fabricated but complete file is not caught**                                                            |
| Turn the step off                                | One line, says nothing to anyone. This is what L71 is about: the default is made visible so that turning it off is the only silent option, and the tool leaves no sanctioned bypass to remove |

## 11. What the repository refuses, permanently

L73 requires a refusal list in the published repository's contributing file, with a count that will not grow. A
one-person artefact does not die of one big mistake. It dies of reasonable-looking requests, each cheap alone, that
turn it into a service the owner is on call for. So the specification fixes these, and an entry leaves the list only
by a new major version of the specification, never by a pull request.

**Counts that will not grow within 1.x:** three surfaces, two readers, three verbs and one version flag, four rules,
one binding check, and the finding ids of sections 2.2 to 2.5.

| Refused                                                                                      | Why                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A hosted service, dashboard, account, database, or any network access                        | It is the thing this replaces (section 1), and a hosted part is how a one-person artefact acquires an operational duty. `check`, `record` and `show` open no connection                   |
| A neutral run format, or a third reader                                                      | Settled by the owner for launch. Proposed for later: a third reader is considered only after each of the two has survived one real tool version change, and then as a specification MINOR |
| A request to read another tool's output (Inspect, Ragas, LangSmith, Braintrust and the rest) | The same as the row above. Each reader is a part that goes stale against someone else's release schedule                                                                                  |
| Statistical significance, confidence intervals, retries, flaky-test handling                 | The baseline keeps no per-case data, and a reviewer can read a number in a diff but not a p-value                                                                                         |
| Relative, global or auto-adjusting tolerance, or a tolerance given at check time             | 2.3                                                                                                                                                                                       |
| Updating the baseline automatically, on a pass or on a fail                                  | A ratchet makes the baseline whatever the last run was, and the check meaningless. The baseline changes when a person runs `record` and commits                                           |
| Calling a model, a judge or any paid API                                                     | The gate must run with no key, which is the owner's condition for the red-build fixture                                                                                                   |
| Telemetry, an update check, any outbound request                                             | A request is a failure that depends on a network and a day, and the artefact is found, not announced (L74)                                                                                |
| Pull-request comments, bots, chat messages, badges, status APIs                              | Each needs a token and a service. The annotation per finding is the only write the Action makes                                                                                           |
| Failing on a date, on baseline age, or on expiry                                             | L71                                                                                                                                                                                       |
| Lower-is-better metrics, or a per-metric polarity setting, in 1.x                            | 6.4                                                                                                                                                                                       |
| A configuration file or environment variables                                                | The baseline is the only configuration, and a second place is a second place for the surfaces to disagree                                                                                 |
| JSON, SARIF or JUnit output of the report                                                    | Each format is another contract to keep. The report is line-oriented so `grep` and the exit code are the interface, and the baseline is JSON for anyone who needs structure               |
| More than one run or suite in a baseline, merging baselines, per-branch baselines            | One baseline holds one run of one suite, so each has one `source` and one `cases` digest                                                                                                  |
| Saying which case regressed                                                                  | It needs per-case data the reduced baseline does not keep (3.3)                                                                                                                           |
| A moving tag for the Action, or any alias that follows the latest release                    | 7.2                                                                                                                                                                                       |
| A `--ci`, `--fail`, `--exit-code` or similar flag that makes failure the default             | L71. The strict flag is the only one                                                                                                                                                      |

The answer to any of these, as one line for the contributing file: this is on the refusal list, which the specification
fixes; changing it is a new major version of the specification, not a pull request.

Per L73 the fixtures and the specification carry nothing upstream: the cases are our own questions, and the run files
are tool outputs of those, so the repository holds no text it has no right to republish. Licences are per L75: code MIT,
specification text CC BY 4.0. L75 names three defects on the site that block licensing today and says they are fixed
in parallel with the first repository. I did not check whether they are fixed. `[INFERENCE]`: what would confirm it is
reading `site/LICENSE.md`, the terms page and `licenseHasText` after the work L75 describes.

## 12. Settled by the owner on 2026-11-11

The four questions this document opened are answered. Each answer carries what it costs, because an answer
with its price recorded is the only kind a later reader can re-open honestly.

**A. The address is `https://meshin.co/spec/evals-baseline/1.0/`.** A new top-level family, chosen over
nesting the page under the resource entry. The citation is short enough to be quoted whole, which matters
because a long address gets shortened to a repository link, and that is the one form no artefact in the
research is cited at. It also has room for the second specification, since the governance artefact follows.
The cost is real: the route families were fixed, so this needs a locked row amending L53, a template, and
the per-route obligations every family carries — a markdown sidecar, a sitemap entry, a search entry, a
social card and a place in the collection's machine files. The version sits in the path so a later revision
publishes beside the first rather than rewriting what people already cited.

**B. The binding check of 2.4 ships in 1.0, as a warning only.** It prints that the baseline was recorded
against a different set of cases, and it never fails the run, not even under `--strict`. That is the middle
path: the signal exists and the penalty does not. It catches the cheapest false green the four rules leave —
ten hard cases swapped for ten easy ones keeps the count equal and raises the score — and it does not punish
the person who legitimately added a case and has not re-recorded yet. It does not catch a scorer weakened in
place, and the page says so rather than implying the binding makes a green trustworthy.

**C. The npm username `meshin` is the owner's own account**, confirmed by him on 2026-11-11. The registry's
scope search returned zero packages for `scope:meshin`, which shows no public package and says nothing about
the account.

**D. The repository is `meshin-co` and the package is `@meshin`.** Two names for one artefact, chosen
knowingly. The Action publishes an immutable commit and a moving `v1` tag, and the README names the commit
first. The research is against the moving tag — a mutable major tag from a one-person publisher is code
execution inside the consumer's CI under a name its author can rewrite, and a company that runs a
SHA-pinning policy refuses it — and the owner accepted that in exchange for the lower entry cost. What he
takes on with it is a standing promise never to break `v1`.

## 13. What was not verified

Each item is `[INFERENCE]` with what would confirm it.

1. That every output block in this document is what the reference implementation will print. They are the prototype's.
   Confirmed by building the implementation and running the specimens of 9.1.
2. S11 and S12, and every mutation proof of 9.3, were not run (9.1).
3. Only promptfoo 0.125.1 and DeepEval 4.3.3 were run. Older tags were read for one fact (6.4). A run from any other
   version is unread. Confirmed by the first real tool upgrade (6.5).
4. The pytest path, `deepeval test run`, was read in source and not run; `evaluate()` was run. Both are documented as
   writing the same rolling file.
5. How common multi-prompt promptfoo matrices are among real suites, and so how much the one-prompt-per-provider limit
   costs (6.5). Confirmed by counting provider and prompt counts in a sample of public promptfoo configurations.
6. How many built-in DeepEval metrics are lower-is-better (6.4), and where the Toxicity rule lives at the current tag.
7. That the binding's limits (2.4) are acceptable. Confirmed by a year of use.
8. The Node runtime for the Action and the minimum Node for the package and the file (7.2).
9. SemVer's clause 3 wording, recalled (8.2).
10. That the figures of section 1 still hold. They are the record's, from 2026-11-10, and were not re-measured.
11. That a new top-level `/spec/` family can carry the per-route obligations every family carries, which is a build question nobody has answered yet (12A).
12. How the specification text is copied between the new repository and the site without drift, and how a published
    page is held frozen. Not designed here; a content digest in the site's own checks is the obvious shape.
13. The prototype and its fixtures are in a temporary directory, not a repository.

## Appendix A. Evidence log

| Item                                                                                                                                                        | Value                                                                                                                               | Source and time                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `https://registry.npmjs.org/@meshin%2Fevals-baseline`                                                                                                       | 404                                                                                                                                 | probed 2026-11-11 17:11 UTC                                                                                  |
| `https://registry.npmjs.org/evals-baseline`                                                                                                                 | 404, body `{"error":"Not found"}`                                                                                                   | same                                                                                                         |
| npm search `scope:meshin`                                                                                                                                   | `total` 0                                                                                                                           | same                                                                                                         |
| `https://github.com/meshin-co/evals-baseline`                                                                                                               | 404                                                                                                                                 | same                                                                                                         |
| `https://github.com/meshin-co`                                                                                                                              | 200                                                                                                                                 | same                                                                                                         |
| `https://meshin.co/specs/evals-baseline/1.0.0/`                                                                                                             | 404                                                                                                                                 | same                                                                                                         |
| `https://meshin.co/resources/evals-baseline/`                                                                                                               | 404                                                                                                                                 | same                                                                                                         |
| `https://meshin.co/resources/agent-evals-ci-starter/`                                                                                                       | 200                                                                                                                                 | same                                                                                                         |
| promptfoo downloads, DeepEval downloads                                                                                                                     | 4,137,504 npm a month, 2,584,198 PyPI a month                                                                                       | `investigation/10-what-exists-for-the-seven-resources.md`, section 2, 2026-11-10                             |
| Two real promptfoo runs of one suite                                                                                                                        | 386 leaf values each, 16 differ; 17,571 and 17,577 bytes                                                                            | scratch runs of 0.125.1, 2026-11-11                                                                          |
| Reduced baseline against raw run                                                                                                                            | 441 against 17,571 bytes (promptfoo); 415 against 2,202 (DeepEval)                                                                  | same                                                                                                         |
| Case digest, promptfoo                                                                                                                                      | `e6c6ecf167ab` for six variants of one suite; `b4826cd2872c` for three cases; `8090f0ab85ad` for one case swapped                   | same                                                                                                         |
| Case digest, DeepEval                                                                                                                                       | `c8663ee8bc8a` for every run of four cases, including a run with built-in metrics; `6800e77b28c7` for three; `6189a6f3c54e` swapped | same, DeepEval 4.3.3                                                                                         |
| Float trap                                                                                                                                                  | `0.92 - 0.9` is `0.020000000000000018`; the quantised values are 20000 and 20000                                                    | evaluated in JavaScript, 2026-11-11                                                                          |
| DeepEval counts a metric with no verdict as an error                                                                                                        | `scores` empty and `errors` 4 for a metric with no threshold; source lines 288 to 298                                               | scratch run and the test run source at python-v4.3.3                                                         |
| GitHub: a full-length commit SHA is the only immutable way to use an action; a JavaScript action receiving a context value as an argument is not injectable | secure-use page                                                                                                                     | [GitHub documentation](https://docs.github.com/en/actions/reference/security/secure-use), read 2026-11-11    |
| GitHub: workflow command escaping                                                                                                                           | `escapeData` and `escapeProperty`                                                                                                   | [toolkit source](https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts), read 2026-11-11 |
| Versioned citation evidence                                                                                                                                 | SemVer, Keep a Changelog 1.1.0, Conventional Commits 1.0.0 paths; issue 745                                                         | `investigation/10-sources/how-a-resource-wins.md`, lines 36, 50, 85, 339, 472                                |
| Locked rows read                                                                                                                                            | L19, L53, L70, L71, L72, L73, L74, L75, L76                                                                                         | `docs/plan/reference/locked-decisions.md`                                                                    |

## Appendix B. DeepEval output, real

DeepEval 4.3.3, baseline recorded 2026-09-02 from a run of four cases and two metrics, checked on 2026-11-11. Header
and `date:` lines, as in section 5.3, are left out of the `check` blocks.

```text
$ evals-baseline check run-worse.json
below-baseline Accuracy: 0.75 is below the baseline 1 by 0.25, more than the tolerance 0
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-nometric.json
missing-metric Format: the baseline names it (1 over 4 samples) and this run has no such metric
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-drop-one.json
cases-changed: the baseline was recorded from 4 cases (digest c8663ee8bc8a); this run holds 3 cases (digest 6800e77b28c7); re-record if the change is intended
sample-count Accuracy: the baseline holds 4 samples and this run holds 3
sample-count Format: the baseline holds 4 samples and this run holds 3
evals-baseline: 3 findings; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-swap.json
cases-changed: the baseline was recorded from 4 cases (digest c8663ee8bc8a); this run holds 4 cases (digest 6189a6f3c54e); re-record if the change is intended
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check run-error-one.json
sample-count Accuracy: the baseline holds 4 samples and this run holds 3
sample-count Format: the baseline holds 4 samples and this run holds 3
note: Accuracy: 1 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)
note: Format: 1 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)
evals-baseline: 2 findings; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check wrapped.json
bad-run: wrapped.json: this is DeepEval .latest_test_run.json, which wraps the run in testRunData; read .latest_run_full.json or a test_run_*.json file
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline check ../pf/run-good.json
bad-run: ../pf/run-good.json: the baseline was recorded from deepeval (deepeval-test-run) and this file is promptfoo (promptfoo-results-3)
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)

$ evals-baseline record run-score-only.json --baseline sc.json
evals-baseline 1.0.0 (specification 1.0.0) record: refused: the run has errored samples (Brevity: 4 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)); fix them and run the suite again; nothing written
(exit 1)
```

A lower-is-better metric, as `show` reads it (6.4). The baseline here does not name it, so `check` ignores it under
rule 3:

```text
$ evals-baseline show run-inverted.json
evals-baseline 1.0.0 (specification 1.0.0) show run-inverted.json: deepeval version unknown (deepeval-test-run), 2 metrics, 4 cases (digest c8663ee8bc8a)
Accuracy  1  4 samples
Format  1  4 samples
note: Failure rate cannot be read: DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only
```
