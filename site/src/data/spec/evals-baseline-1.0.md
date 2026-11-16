---
title: evals-baseline specification 1.0
description: The evals-baseline specification 1.0 says what a regression in an agent evaluation is, and defines the baseline file, the findings and the exit codes.
publishDate: 2026-11-16
updatedDate: 2026-11-16
name: evals-baseline
version: '1.0'
license: CC-BY-4.0
citeAs: This project guards its agent evaluations against regression as defined by the {spec}.
citeKey: spec
---

In the evals-baseline specification 1.0, a regression is a difference between a baseline and a later run of the same suite. It takes one of three forms: a metric has gone missing, a value has dropped beyond its tolerance, or a sample count has fallen.

A baseline is a reduced record of one run. A check compares it with a later run, and prints a finding for each regression and for each input it cannot read. By default a finding only warns, and the check still passes. Strict mode is the only way for a finding to make the check fail.

An implementation in any language, or a person who reads a pull request, can use the specification to tell whether a result is right. Where an implementation or its documentation disagrees with this specification, the specification wins. This version reads the run files of two tools, promptfoo and DeepEval.

## How to read this specification

The words MUST, MUST NOT and SHOULD in a clause carry the meaning that [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) gives them. Everywhere else the words are plain English. In a message text, a word in angle brackets stands for a value that the implementation fills in.

The clauses on this page are the specification, and they decide what is right. An implementation conforms to a version when it does what every clause of that version requires. The conformance vectors of that version are tests of the clauses and not a second definition.

An implementation that fails a vector that is not marked reference-only does not conform, unless the vector contradicts a clause. An implementation that passes every vector and breaks a clause does not conform.

The published vectors are the annex for exact text: every line a command prints and every file `record` writes. Where this page gives only the form of a message, the vector gives its words, and an implementation prints those words. A vector marked reference-only is not part of the annex. The vectors were made by running one implementation, so a vector can carry a mistake of that implementation.

When this page and a vector disagree, follow this page. The vector is the mistake, so do not copy it. Say, beside your claim to conform, which vector you fail and why, and [report the disagreement](/contact). When a clause can be read two ways and the vectors do not choose, passing every vector does not show that you read it right. Say which reading you took, and report the clause as a gap.

## Terms

- A **run file** is the file an evaluation tool writes for one execution of a suite.
- A **sample** is one scored observation of one metric. A **sample count** is how many samples a run holds for a metric.
- A **metric key** names a metric inside one run. For promptfoo it is `<provider label> :: <metric name>`, and for DeepEval it is the metric name.
- A **value** is the mean of a metric's samples, on the tool's own scale. This specification assumes that higher is better.
- A **baseline** is a reduced record of one run, committed in the repository that owns the suite.
- A **tolerance** is a number that is 0 or more, in the metric's own units, stored per metric in the baseline.
- A **finding** is one line that begins with a finding id. A **note** is a line that begins with `note:` and never counts as a finding.
- A **regression** is a difference between a baseline and a later run of the same suite, as rules 1, 2 and 4 define it. Rule 3 states what is not a regression.
- A **reader** turns a run file or a baseline into the data a check compares, or refuses it.
- The three **verbs** are `check`, `record` and `show`. The verb `check` compares a run with a baseline. The verb `record` writes a baseline from a run, and `show` prints what the reader extracted from a run.
- A `check` runs in **strict mode** when it is given `--strict`, and in **default mode** otherwise.
- Strings are **sorted** in UTF-16 code-unit order, the order in which a JavaScript string comparison puts strings. A character above U+FFFF is a surrogate pair, so it comes before the characters from U+E000 to U+FFFF, where code-point order puts it after. Every sort on this page uses this order. That covers metric keys, finding lines, the keys of the rule 3 note, the object keys of a canonical form and the canonical forms themselves.

## Four comparison rules

A finding of a rule is one line of the form `<id> "<key>": <text>`. The quotes belong to the line, and the key is written as Printed lines, below, requires. The table gives the finding id and the form of the message text of each rule. A rule that fails produces a finding, and the exit codes say whether a finding stops the run. The clauses that follow state the rules exactly.

| #   | Rule                                                | Compares                                                   | Finding id       | Message text                                                                                                                          |
| --- | --------------------------------------------------- | ---------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A metric the baseline names and the run lacks fails | the set of keys in the baseline against the run            | `missing-metric` | `the baseline names it (<value> over <n> samples) and this run has no such metric`                                                    |
| 2   | A value under the baseline, beyond tolerance, fails | baseline value against run value, per key                  | `below-baseline` | `<run value> over <r> samples is below the baseline <baseline value> over <b> samples by <drop>, more than the tolerance <tolerance>` |
| 3   | Metrics present only on the run are ignored         | nothing; the keys are listed in one note                   | none             | `note: <n> metric(s) only in this run, not compared (rule 3): <keys>`                                                                 |
| 4   | A smaller sample count fails                        | baseline `samples` against the run's sample count, per key | `sample-count`   | `the baseline holds <b> samples and this run holds <r>`                                                                               |

1. For every key in the baseline, a run that holds no samples for that key MUST produce `missing-metric`. If the run holds that metric but the reader refuses it, the finding is `unreadable-metric` instead, and the reader's reason is its text. Rules 2 and 4 are not evaluated for a key that rule 1 reported.
2. For every key present in both, let the drop be the baseline value minus the run value. Let `q(x)` be `floor(x * 1,000,000 + 0.5)`, in IEEE 754 double-precision arithmetic. The check MUST report `below-baseline` when `q(baseline) - q(run) > q(tolerance)`, and MUST NOT otherwise. A value higher than the baseline is never a finding. The message prints the drop to six decimals with trailing zeros removed. It gives the sample count of the run and of the baseline beside their values. It does not say how many cases the drop is, because a value is a mean on the tool's own scale. Whole numbers are compared because plain subtraction of 64-bit floats can fail a run that sits exactly on its tolerance. For example, 0.92 - 0.9 is 0.020000000000000018, which is more than 0.02.
3. A key present in the run and absent from the baseline MUST NOT produce a finding. The check lists at most ten such keys in one note, in sorted order. Each key is quoted, and a comma and a space separate the keys. When more keys are left out, `, and <n> more` follows the tenth, with `<n>` the number left out.
4. For every key present in both, a sample count smaller than the baseline's `samples` MUST produce `sample-count`. A larger count MUST NOT produce a finding, and the check prints a note for it. Rules 2 and 4 are independent, so one key can produce both.

A run exactly at its tolerance passes, and a run one millionth beyond it fails. The table gives a worked example.

| Run value, for a baseline value of 0.92 and a tolerance of 0.02 | Result under rule 2                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0.95                                                            | no finding                                                          |
| 0.92                                                            | no finding                                                          |
| 0.9                                                             | no finding, because `q(0.92) - q(0.9)` and `q(0.02)` are both 20000 |
| 0.900001                                                        | no finding                                                          |
| 0.899999                                                        | `below-baseline`                                                    |
| 0.6                                                             | `below-baseline`                                                    |

## Binding check

The four rules compare numbers. Nothing in them says the numbers were measured on the same cases. A suite in which a hard case is swapped for an easy one keeps its sample counts and only improves. The binding check covers that gap.

The baseline records a digest of the case inputs. When the digest of a run differs from the digest in the baseline, `check` MUST report `cases-changed`. The finding says that the baseline no longer describes this suite, so the findings beside it may be meaningless. It is not a regression.

In this version the binding check is a warning only. `check` prints `cases-changed` in default mode and in strict mode, and the finding never changes the exit code. The binding check reports a swap of cases that keeps the count equal. It does not punish a person who added a case and has not recorded a new baseline yet.

- The digest is the first 12 hexadecimal characters of the SHA-256 of the UTF-8 encoding of one string. That string holds the canonical forms of the case identities, sorted and joined with U+0001.
- Canonical form sorts object keys at every depth, keeps arrays in order, writes scalars as `JSON.stringify` writes them and holds no whitespace. So `1.0` is written `1`, `-0` is written `0`, `1e-7` stays `1e-7` and `1e21` is written `1e+21`.
- A case identity is, for promptfoo, the `vars` object of the first result for each distinct `testIdx`. For DeepEval it is an object with the keys `input` and `expectedOutput` of each test case, and an absent `expectedOutput` counts as `null`.
- Prompts, agent output, scorer definitions, thresholds and metric names are not part of an identity. A change to the agent or its prompt leaves the digest alone and shows only in the values, where rule 2 judges it. Adding a metric leaves the digest alone as well, so rule 3 can ignore the new metric.

A check with no findings does not prove that a suite is sound. The binding check does not catch three things:

- a scorer weakened in place, for example a promptfoo `contains` value changed so that it always passes
- two offsetting changes to single cases that leave the mean unchanged
- a fabricated but complete run file

## Findings and notes

The three findings of the rules report regressions. The six findings in this table are not regressions, and each one counts as a finding.

| Id                  | When                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-baseline`       | the baseline path does not exist, and nothing was compared                                                                                                   |
| `bad-baseline`      | the baseline cannot be read: it is not JSON, it has an unknown, missing or repeated key or a bad value, or it names a specification the reader does not read |
| `bad-run`           | the run file cannot be read, or it is from a different tool than the baseline                                                                                |
| `unreadable-metric` | the baseline names a metric that the reader refuses to read                                                                                                  |
| `cases-changed`     | the digest of the run differs from the digest in the baseline                                                                                                |
| `internal-error`    | the reader or the comparison threw something that is not a refusal, and the text is the error's message                                                      |

A check that compared nothing MUST NOT print `no findings`. These ids make that impossible: a missing or unreadable input is itself a finding, and by default it warns without failing the run.

A note is printed as `note: <text>` and never counts as a finding. Notes exist for these cases:

- a metric that appears only in the run, as given in the table of rules
- a metric whose sample count is larger in the run than in the baseline, one note for each, sorted by key, as `"<key>": the baseline holds <b> samples and this run holds <r>; more samples than the baseline are never a finding`
- samples the tool itself counted as errors
- a metric that the reader refuses and the baseline does not name, as `"<key>" cannot be read: <reason>`
- a tool version that differs from the baseline's, as `the baseline was recorded by <tool> "<version>"; this run was written by "<version>"`

Only promptfoo writes its version into its output, so only a promptfoo run can raise the version note.

### Printed lines

1. Text that came from a file or from the command line MUST be printed between double quotes, and some of its characters MUST be replaced.
   - Inside the quotes, a backslash is written as two backslashes, and a double quote is written as `\u0022`.
   - A character is printed as it is only if it is in the printed set, and every other character is replaced. The printed set holds each code point to which Unicode 15.1 gives the General_Category L, M, N, P or S, and U+0020. It holds no code point to which Unicode 15.1 gives the Default_Ignorable_Code_Point property, and none of the seven code points named below. So the replaced characters include controls, format characters, variation selectors, the Tags block, surrogates and private-use code points. They also include every separator except the space, the seven, and every code point that Unicode 15.1 has not assigned.
   - A `[` that directly follows `##` is replaced too.
   - A code point up to U+FFFF becomes `\u` and four lowercase hexadecimal digits, so a newline becomes `\u000a`. A code point above U+FFFF becomes `\u{`, five or six lowercase hexadecimal digits and `}`, so U+E0069 becomes `\u{e0069}`. A surrogate with no partner is one character.
   - The printed set is fixed to Unicode 15.1, and it does not grow with a later edition. A code point that a later edition assigns is replaced, as an unassigned code point is. An implementation MUST print exactly this set, whatever edition of Unicode its language or library carries. A runtime that carries another edition gives another set, so an implementation cannot read the set from it. It carries the set itself, built from the files `UnicodeData.txt` and `DerivedCoreProperties.txt` of Unicode 15.1.0. As a check, the set holds 149,351 code points, in 721 runs of consecutive code points. The vectors hold no code point that Unicode 15.1 leaves unassigned and none of the seven. So a vector cannot show that an implementation follows this bullet.
   - The seven code points are:
     - U+2800 BRAILLE PATTERN BLANK
     - U+FFFC OBJECT REPLACEMENT CHARACTER
     - U+13441 EGYPTIAN HIEROGLYPH FULL BLANK
     - U+13442 EGYPTIAN HIEROGLYPH HALF BLANK
     - U+16FE4 KHITAN SMALL SCRIPT FILLER
     - U+11D45 MASARAM GONDI VIRAMA
     - U+11D97 GUNJALA GONDI VIRAMA
   - Each is a letter, a mark or a symbol that Unicode 15.1 does not call default ignorable, so the rule above would print it. Each is replaced anyway, because it can draw no ink, and a name made of such characters would look empty to a reader.
   - This covers a metric key, a tool version, a path, a flag and an exception message. It also covers the parts of a reader's reason that came from a file. A tool name is one of the two words `promptfoo` and `deepeval`, so it is printed as it is. Data therefore cannot start a line or begin a CI workflow command. It cannot send a control sequence to a terminal, forge a finding or hide a sentence in invisible characters. An implementation prints no escape sequence of its own.
   - Escaping and quoting do not make text safe to obey. A metric name that holds an instruction in plain letters is printed as it is, between the quotes.
2. Every finding line starts with its id, apart from the two spaces that indent a finding under `replaced:`. Every note line starts with `note:` and a space, and every metric line of `show` starts with `metric` and a space. So `grep` selects each class, and no line starts with text from a file.
3. The `date:` line comes before every finding line, and `cases-changed` comes before the other findings. Finding lines are sorted by key, and for one key they follow the order of rules 1, 2 and 4. The note lines come after the finding lines.
4. The last line of a `check` is its summary, and it is one of four. In the three that count findings, `<findings>` is `1 finding` for one and `<n> findings` for two or more.
   - `evals-baseline: no findings` when there is none.
   - `evals-baseline: <findings>; warning only, exit 0 (pass --strict to exit <code>)` in default mode, when at least one finding is not `cases-changed`.
   - `evals-baseline: <findings>; exit <code> (--strict)` in strict mode, under the same condition.
   - `evals-baseline: <findings>; warning only, exit 0 (cases-changed never fails --strict)` in either mode, when every finding is `cases-changed`. That finding never changes the exit code, so the second form would invite a reader to pass `--strict` and get exit 0 again.
   - In the second and third forms, `<code>` is the exit code that strict mode gives for the findings. It is 1 when at least one finding is a regression, and 3 when none is, as Exit codes defines it.
5. The first line of a report is the banner, `evals-baseline <package version> (specification <MAJOR.MINOR>)`, followed by the verb and a description that the vectors show. `--version` prints the banner alone. An implementation prints its own package version where the vectors show `<package version>`.
6. A count takes the plural of its noun unless it is 1, as in `1 finding`, `2 findings`, `1 sample` and `4 samples`. Four texts print `(s)` as written, whatever the count:
   - the note of rule 3, `<n> metric(s) only in this run`
   - the note for errored promptfoo tests, `<n> errored test(s)`
   - the note for errored DeepEval samples, `<n> sample(s)`
   - the reason for a metric whose verdicts contradict higher-is-better, `<n> sample(s)`
7. A number in a message is written to six decimals with the trailing zeros removed, and without a decimal point when nothing follows it. The numbers printed for a value, a drop and a tolerance are rounded with `q`.

## The baseline file

A baseline holds one run of one suite from one tool. It is a JSON file with two-space indentation and a final newline. The metric keys are in sorted order, so recording a run that changes nothing produces no diff. A number is written as `JSON.stringify` writes it, so a whole value is `1` and never `1.0`.

A string in the file is written as `JSON.stringify` writes it. A character that the printed lines replace and that `JSON.stringify` leaves as it is needs one more step. It is then written as `\u` and four lowercase hexadecimal digits for each of its UTF-16 code units. The file does not replace a `[` that follows `##`.

A JSON Schema for this file is published at [/spec/evals-baseline/1.0/baseline.schema.json](/spec/evals-baseline/1.0/baseline.schema.json). It checks the shape of the file only; the rules on this page decide the rest.

A baseline recorded from a promptfoo run with two metrics and four cases looks like this:

    {
      "spec": "1.0",
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

| Field                         | Meaning                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `spec`                        | the specification version the file follows, as `MAJOR.MINOR`; the machine-readable form of a citation               |
| `source.tool`                 | `promptfoo` or `deepeval`                                                                                           |
| `source.toolVersion`          | the version string the tool wrote into its own output, or `null` when the output carries none (DeepEval's does not) |
| `source.shape`                | the output shape the reader recognised: `promptfoo-results-3` or `deepeval-test-run`                                |
| `recordedAt`                  | ISO 8601 UTC, to the millisecond; the only clock in the file                                                        |
| `cases.count`, `cases.digest` | the number of cases and their digest, as defined for the binding check                                              |
| `metrics.<key>.value`         | the mean of the metric's samples, rounded to 6 decimals, from -4000000000 to 4000000000                             |
| `metrics.<key>.samples`       | the sample count, a positive integer                                                                                |
| `metrics.<key>.tolerance`     | a number from 0 to 4000000000                                                                                       |

### Reading a baseline

A reader MUST refuse a file as `bad-baseline` when any of these holds:

- it is not a JSON object
- it has a key beyond those in the table, or lacks one of them, at any level
- it has a key that appears twice in one object
- it holds a value that does not fit its field
- its `spec` is not two whole numbers joined by a dot, with no third number and no leading zero, so `1.0.0`, `1.0.7`, `01.00` and `1.00` are refused
- the major number of its `spec` differs from the major number the reader implements, or its minor number is newer
- it names no metric, because it guards nothing

The refusal text names the first problem the reader found. A reader reads a baseline of the same major and an older or equal minor.

Run files are read leniently, because the tools add fields freely. An unknown key in a run is ignored. A missing key that the reader needs makes the run `bad-run`. So does a key that appears twice in one object. So does a metric value outside the range set under Values, sample counts and metric keys.

### Recording a baseline

The verb `record` MUST do the following:

- read the run with the reader that `check` uses
- refuse a run that it cannot read, a run that holds errored samples, a run that holds no case and a run that holds no metric, and write nothing when it refuses
- refuse to record over a baseline that exists and that it cannot read, because the tolerances in it cannot be kept, and write nothing
- leave out a metric that the reader refuses, and say so in a note
- keep the tolerance that the previous baseline holds for a key of the same tool, and give any other key the tolerance from `--tolerance`
- refuse and write nothing when a key has no held tolerance and no `--tolerance` is given, because a tolerance of 0 must be asked for as `--tolerance 0`, and say how many metrics lack a tolerance
- refuse and write nothing when the number given to `--tolerance` and a tolerance held for a key of the same tool differ under `q`, and say so in a note for each such key, in sorted order, as `"<key>": the baseline holds the tolerance <tolerance>`
- write nothing when everything except `recordedAt` and `source.toolVersion` equals what the file already holds, so that `recordedAt` stays the date on which the numbers last changed. This is not a refusal, and it needs no `--replace`
- refuse and write nothing to record over a baseline that exists and that the run would change, unless `--replace` is given. The refusal says what the baseline holds, what the run would put in its place and that `--replace` replaces it, and a note follows for each difference
- print under `replaced:`, before it writes, the findings that the baseline it replaces would have reported against the new run

Recording over a regression is allowed with `--replace`, and it is never silent.

The refusal over a baseline prints the first line below, and its notes follow it. Both lines come from a vector.

    evals-baseline <package version> (specification 1.0) record: refused: "evals-baseline.json" already holds a baseline of 2 metrics and 4 cases, recorded 2026-09-02; this run would replace it with a baseline of 2 metrics and 4 cases; pass --replace to replace it; nothing written
    note: "agent :: accuracy": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples

The date is the day of the `recordedAt` that the baseline holds. The note for the tool and the note for the cases come first, in that order, when they apply. The notes of metrics follow, one for each metric that would move, in sorted order of the key. A metric that would not move has no note.

Every number is written as Printed lines requires. `<drop>` is the size of the difference of the two values, rounded with `q`.

| Difference                                                        | Note                                                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| the tool of the run is not the tool of the baseline               | `the tool would change from <baseline tool> to <run tool>, so no tolerance would be carried over`        |
| the digest of the cases is not the same                           | `the cases would change from <b> cases (digest <baseline digest>) to <r> cases (digest <run digest>)`    |
| a metric of both has values that differ under `q`                 | `"<key>": would fall by <drop>, from <baseline value> over <b> samples to <run value> over <r> samples`  |
| a metric of both has the same value and sample counts that differ | `"<key>": would keep the value <value> and go from <b> samples to <r> samples`                           |
| a metric is in the baseline and not in the run                    | `"<key>": would be removed; the baseline holds <value> over <b> samples, with the tolerance <tolerance>` |
| a metric is in the run and not in the baseline                    | `"<key>": would be added, at <value> over <r> samples`                                                   |

The note of a metric whose value goes up reads `would rise by` in place of `would fall by`.

## Values, sample counts and metric keys

The comparison of values and the comparison of sample counts each take one number per metric from the run. The specification fixes which numbers those are, because two implementations agree only if they read the same numbers from a run file. The table fixes them for each output shape.

| Shape                 | Metric key                          | Value                                                                                    | Sample count                                                                                         | A sample the tool counted as an error |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `promptfoo-results-3` | `<provider label> :: <metric name>` | the sum of the metric's scores divided by its weight total if present, else by its count | `namedScoresCount` of that metric: the assertions carrying `metric: <name>` that contributed a score | not counted, so the count falls       |
| `deepeval-test-run`   | `<metric name>`                     | the arithmetic mean of the metric's `scores`                                             | the length of the metric's `scores`: the samples that have both a score and a verdict                | not in `scores`, so the count falls   |

The sample count is the metric's own count, never the number of cases. Counting cases would hide a sample lost to an error.

- For promptfoo it is `namedScoresCount[m]`, the number of assertions that contributed a score. The weight total never replaces it. A test with two assertions on one metric contributes two, and a test with none contributes nothing. So deleting an assertion changes the count even when the number of tests does not.
- For DeepEval it is the length of the metric's `scores` array, which DeepEval builds from samples that have both a score and a verdict.

Errors are handled twice. They lower the sample count, so a check reports them as `sample-count` findings. They also make `record` refuse the run, so a run that lost samples can never become the baseline.

The value is on the tool's own scale, and it is from -4000000000 to 4000000000. A run's mean is rounded to six decimals before it is held to that range. Inside the range, every value scaled by one million, and the difference of two of them, is a whole number that a double holds exactly. A run with a value outside it is `bad-run`, and a baseline with one is `bad-baseline`.

A promptfoo metric is weighted when `namedScoreWeights` holds an entry with the metric's name. Its value is `namedScores` divided by that entry, which is the weight total of its assertions, and not by the sample count. A metric with no such entry is divided by its sample count, whether the run has no `namedScoreWeights` or the object lacks the name.

The two divisors are equal only when the weights of the metric add up to its number of assertions. The table gives four cases. The sample count stays `namedScoresCount` in every case.

| `namedScores` | `namedScoresCount` | Entry in `namedScoreWeights` | Value                 | Sample count |
| ------------- | ------------------ | ---------------------------- | --------------------- | ------------ |
| 4             | 4                  | 6                            | 0.666667              | 4            |
| 3             | 4                  | 3                            | 1                     | 4            |
| 3             | 4                  | none                         | 0.75                  | 4            |
| 4             | 4                  | 0                            | the metric is refused | none         |

A weight total that is not a finite number above zero makes the reader refuse the metric, and a baseline that names it gets `unreadable-metric`. Zero is refused and never falls back to the sample count. A `namedScoreWeights` that is present and not an object makes the run `bad-run`.

A value is computed in double-precision arithmetic, in this order:

- A DeepEval metric sums its scores one at a time from the first to the last, starting from 0. A sum that compensates for rounding error, or adds in another order, can differ in the last place, and the vectors detect that. A promptfoo metric takes the sum that the tool wrote.
- The mean is that sum divided by the number of scores, or by the weight total of a weighted promptfoo metric.
- The value is `q(mean) / 1,000,000`, and `-0` is written as `0`.

The table gives means at or near a tie, with the value that the vectors print for each. A tie rounds toward positive infinity. In the last two rows the double nearest the mean lies beside the tie, not on it, and the value follows the product.

| Mean of the scores | Product with 1,000,000 | Value     |
| ------------------ | ---------------------- | --------- |
| 0.0078125          | 7812.5                 | 0.007813  |
| -0.8984375         | -898437.5              | -0.898437 |
| 5e-7               | 0.5                    | 0.000001  |
| -5e-7              | -0.5                   | 0         |
| 0.0001245          | 124.49999999999999     | 0.000124  |
| 0.0001265          | 126.50000000000001     | 0.000127  |

The reader is chosen by the content of the run file, never by its name or by a flag. A run file is promptfoo output when it holds an object `results` with a numeric `version`. It is DeepEval output when it holds the arrays `testCases` and `metricsScores`.

A file that matches both or neither is `bad-run`, and the text names the top-level keys the reader saw. A run file from a different tool than the baseline's is `bad-run` too.

### promptfoo run files

In these rows, `metrics` means `results.prompts[i].metrics` for the same `i`.

| Need                | Field read                                                                                                   | Note                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Shape               | `results.version`                                                                                            | must be 3, and any other number is `bad-run`                                                         |
| Columns             | `results.prompts[i].provider`                                                                                | the provider label; a label that repeats is `bad-run`, so this version reads one prompt per provider |
| Value of metric `m` | `metrics.namedScores[m]` divided by `metrics.namedScoreWeights[m]` when present, else by the sample count    | `namedScores` is the sum of the scores of the assertions that carry `metric: m`                      |
| Sample count of `m` | `metrics.namedScoresCount[m]`                                                                                | the number of assertions that contributed                                                            |
| Errors              | `metrics.testErrorCount`                                                                                     | a value greater than 0 is a note, and makes `record` refuse                                          |
| Case identity       | `results.results[j].testIdx` and `.testCase.vars`                                                            | the digest of the binding check                                                                      |
| Tool version        | `metadata.promptfooVersion`                                                                                  | stored as `source.toolVersion`, and `null` when absent                                               |
| Direction           | `results.results[j].gradingResult.componentResults[k].assertion`: `metric`, `type`, `threshold` and `assert` | read by the polarity rules of promptfoo metrics                                                      |

The metric key is `<provider label> :: <metric name>`, for example `agent :: accuracy`. Only assertions that carry a `metric` produce a named score, so a suite with none has nothing to guard, and `record` refuses it. A metric name that appears in `namedScores` with no entry in `namedScoresCount` is a derived metric. It has no sample count, and the reader skips it.

### DeepEval run files

| Need                | Field read                                                                                    | Note                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape               | `testCases` and `metricsScores`, both arrays                                                  | the file carries no schema-version field                                                                                                    |
| Value of metric `m` | the mean of `metricsScores[i].scores` for the entry whose `metric` is `m`                     |                                                                                                                                             |
| Sample count of `m` | the length of that `scores` array                                                             | DeepEval counts a sample into `scores` only when it has both a score and a verdict (`success`), and otherwise adds it to `errors`           |
| Errors              | `metricsScores[i].errors`                                                                     | a value greater than 0 is a note and makes `record` refuse; a metric with no threshold has no verdicts, so it has no samples and all errors |
| Case identity       | each `testCases[j]`'s `input` and `expectedOutput`                                            | the digest of the binding check                                                                                                             |
| Polarity witness    | each `testCases[j].metricsData[k]`'s `name`, `score`, `threshold`, `success` and `strictMode` | read by the polarity rules                                                                                                                  |
| Tool version        | none                                                                                          | `source.toolVersion` is `null`                                                                                                              |

The metric key is the metric name, for example `Accuracy`. A run in which `conversationalTestCases` is not empty is `bad-run`, because this version reads no multi-turn run. A SQLite file is not JSON and is `bad-run` too.

### Polarity of DeepEval metrics

The comparison treats a lower value as worse. But DeepEval metrics are not all higher-is-better, and a DeepEval file does not say which way its scores run. The reader therefore uses DeepEval's own verdicts as a witness.

A verdict is an entry of `metricsData` that has a string `name`, a numeric `score`, a numeric `threshold` and a boolean `success`. It speaks for the metric whose key is its `name`. For each verdict, `success` MUST equal `score >= threshold`.

A metric with at least one verdict that breaks this rule is refused. The reader leaves it out. A baseline that names it gets `unreadable-metric`. Its text is `DeepEval's own verdicts contradict higher-is-better in <n> sample(s) (success=<s>, score=<x>, threshold=<t>); this implementation reads higher-is-better metrics only`.

The verbs `show` and `record` print the same text as a note. So a lower-is-better metric cannot be guarded in this major version. This rule proves a contradiction, never a polarity. A metric whose verdicts never contradict the reading, because every sample passed whichever way, is read as higher-is-better and could be wrong. The next rule closes that gap for the four metrics that DeepEval is known to have reversed.

DeepEval 4.2.0 reversed the direction of `Bias`, `Hallucination`, `Misuse` and `Toxicity`. Before 4.2.0 each of them passed when its score was at or below its threshold, and its strict mode set the threshold to zero. From 4.2.0 a higher score is better for each of them, as for the other DeepEval metrics. From the same version, each of them sets the threshold to one in strict mode.

A DeepEval file carries no version, so a file that holds one of the four can come from either side of the change.

A verdict shows higher-is-better when its `score` is not its `threshold` and `success` is true exactly when `score > threshold`.

A verdict whose `score` equals its `threshold` shows it only when `strictMode` is `true`, `threshold` is 1 and `success` is `true`. Only DeepEval 4.2.0 or later sets the threshold of one of the four to 1 in strict mode. At any other equal pair a pass is the same for a higher-is-better metric and for a lower-is-better one, so it shows nothing.

The four are matched by their exact names. The reader reads one of the four only when at least one verdict shows higher-is-better for it.

The reader refuses each of the four that has no such verdict. Its text is:

    DeepEval 4.2.0 reversed this metric's score, and no verdict in this file shows which way it runs; run it again on DeepEval 4.2.0 or later with strict mode off and the default threshold

A metric with a contradicting verdict gets the text of the rule above, because the reader judges contradiction first. The verbs `show` and `record` print this text as a note too.

### Polarity of promptfoo metrics

promptfoo does not say which way an assertion scores, and it has assertions whose score runs against a pass, such as a raw measurement. It also adds assertion types. So this specification gives a rule and no list of types. The reader reads a promptfoo metric only when it knows, for every assertion that feeds the metric, that a higher score goes with a pass.

The assertions that feed a metric are found in this order. Take `results.results`. In each of its entries, take `gradingResult`. In that, take `componentResults`. In each of its entries, take `assertion`. An assertion with a string `metric` feeds the metric of that name.

When its `type` is `assert-set` and its `assert` is an array, it stands for the objects in that array. It also stands for the objects in any `assert-set` among them, to any depth. A `metric` inside an `assert-set` is not read. An assertion with no string `type` feeds nothing.

The kind of an assertion is its `type`. The one exception is a `cost` assertion, with `not-` before it or without, that has no numeric `threshold`. Its score is the cost itself and not a pass or a fail, so its kind is `cost with no threshold`.

An implementation sorts every kind into one of three classes: its score runs with pass, its score runs against pass, or it is not checked.

It MUST put a kind in the first class only after it has checked what promptfoo does for that kind. A kind that is new to the implementation is not checked until it has been. This specification lists no kind in any class, because promptfoo changes its types, and a list here would be wrong the day it did.

The reader refuses a metric for the first of these reasons that holds, and a baseline that names it gets `unreadable-metric` with its text. `<kinds>` is each kind, quoted as rule 1 of Printed lines requires, in sorted order, separated by a comma and a space.

| Reason                                                                | Text                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the file holds a result, and no assertion in it has a string `metric` | `the file lists no assertion for any metric, so which way its scores run cannot be established; this implementation reads higher-is-better metrics only`                                                                                                          |
| a kind that is not checked feeds it                                   | `promptfoo assertion type "<kind>" feeds it, and this implementation has not checked which way that score runs; update evals-baseline, or use an assertion type it knows`, with the first such kind in sorted order                                               |
| kinds of both of the other classes feed it                            | `promptfoo feeds it from assertions that disagree on which way a score runs (<kinds>); give each kind its own metric name`, with every kind that feeds it                                                                                                         |
| only kinds that run against pass feed it                              | `promptfoo scores it as lower-is-better (<kinds>); this implementation reads higher-is-better metrics only`, followed by `. To compare cost, give the cost assertion a threshold so that it scores pass or fail` when `cost with no threshold` is among the kinds |

A metric that no assertion feeds is read when an assertion feeds another metric of the file. The reader checks the weight total before it checks direction, so a bad weight total gives its own text. The verbs `show` and `record` print these texts as notes.

## The command line

A command is a verb, one run file and the flags of that verb. The verbs are `check`, `record` and `show`, in lower case. The one command with no verb is `--version`, and it takes no other argument.

| Verb     | Flags it takes                                      |
| -------- | --------------------------------------------------- |
| `check`  | `--baseline <path>`, `--strict`                     |
| `record` | `--baseline <path>`, `--tolerance <n>`, `--replace` |
| `show`   | none                                                |

- An argument that starts with `-` is a flag. A lone `-` and a lone `--` are flags, and `--baseline=<path>` is one flag with a name that no verb takes.
- A flag that the table shows with a value takes the next argument as its value, and that argument does not start with `-`. The other flags take no value.
- Every argument that is neither a flag nor the value of a flag is a run file. It may come before, between or after the flags.
- `--baseline` names the baseline that `check` compares with and that `record` writes. When it is not given, the baseline is `evals-baseline.json`. A path is relative to the working directory.
- `--replace` lets `record` write over a baseline that exists and that the run would change. It takes no value.

### Usage errors

A command line is a usage error when any one of these holds:

1. The first argument is not `check`, `record` or `show`, and the arguments are not exactly `--version`. That covers no argument, a verb in capital letters, `--help`, and `--version` beside another argument.
2. A flag has a name that is in no row of the table. That covers `-`, `--`, `--baseline=<path>`, `--Strict` and a flag of another tool. Flag names are case-sensitive.
3. A flag appears that the verb does not take, as its row of the table gives. The verb `show` takes none.
4. A flag appears twice, whether or not its two values are the same.
5. A flag that takes a value is the last argument, or the next argument starts with `-`.
6. There is no run file, or more than one. The value of a flag is never a run file.
7. The value of `--tolerance` is not written as ASCII digits with at most one decimal point and at least one digit. Or the number it gives is not from 0 to 4000000000. The number is the double that the text gives. So `0`, `007`, `.5`, `5.` and `4000000000` are accepted. An empty value, `.`, `+5`, `1e3` and `1.2.3` are not, and neither is a value above 4000000000.

An implementation finds a usage error before it reads or writes any file, so a usage error outranks an unreadable run file. It exits with code 2 and writes no file. The last line of its standard error is the usage line, in the words that the vectors show. A line before it may say which condition held, and this specification does not fix the words of that line.

## Exit codes

A command ends with one of four exit codes.

| Code | When                                                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | The command ran and the arguments parsed. `check` exits 0 whatever it found, unless `--strict` is given. Under `--strict` it also exits 0 when every finding is `cases-changed`                                                                                 |
| 1    | A regression: `check --strict` printed at least one of the findings `missing-metric`, `below-baseline` and `sample-count`                                                                                                                                       |
| 2    | A usage error, as The command line defines it. The text goes to stderr                                                                                                                                                                                          |
| 3    | The command could not evaluate its input: `check --strict` printed a finding that is `unreadable-metric`, `no-baseline`, `bad-baseline`, `bad-run` or `internal-error`, and no regression, `record` refused and wrote nothing, or `show` could not read its run |

When a strict check holds a regression and a finding that could not be evaluated, the code is 1. A regression is a result about the suite, and an input that could not be read does not take it back. The finding `cases-changed` is in neither kind and never changes the exit code. The summary line of a check names the code that strict mode gives.

Every line of a report goes to standard output, whatever the exit code. A command that exits 1 or 3 prints its report or its refusal there and leaves standard error empty. Only a usage error writes to standard error, and it writes nothing to standard output.

`check` MUST NOT throw. An exception inside reading or comparing is reported as the finding `internal-error`, with its message. The exit code then follows the rules for any other finding. A bug in an implementation must not turn a build red on a day nothing in the repository changed. This specification defines no input that must raise an internal error, so its vectors are reference-only.

## Three properties every implementation keeps

An implementation MUST keep all three properties. Each has a limit, and the limit is stated with it.

### The strict stop is opt-in

The default is a printed, dated finding.

- Unless it is given `--strict`, `check` MUST exit 0 whatever it finds. Strict mode is the only way for `check` to exit 1 or 3.
- A check that read a baseline MUST print a line that starts with `date:`. The line states when the baseline was recorded and how old it is, so an ignored finding stays visible.

The owner of a suite can delete the step that runs the check. An implementation cannot stop that and does not pretend to, because the visibility is the point.

### Nothing exits non-zero on a clock

- The findings and the exit code MUST be functions of the baseline and the run alone. The date is display, and it MUST NOT enter the comparison.
- An implementation MUST NOT define an expiry, an age limit or a finding for an old baseline.

The field `recordedAt` is written by the implementation. It is not checked against the history of the repository, so the date is printed as recorded and labelled `date:`.

### A passing check must be expensive to fake

Every check binds to a referent, something that already sits inside the repository that owns the suite.

- The baseline MUST be a committed file in that repository, and a check MUST read nothing from outside it: no network and no database. A hand edit to a number or a tolerance then shows as a diff in that file, beside the number it relaxes.
- A baseline that does not exist is the finding `no-baseline`, which warns by default and fails under strict mode.
- The `cases` digest binds the numbers to the cases that produced them.
- `record` MUST refuse a run that holds errored samples, and MUST print what it replaces, as the clauses on recording a baseline require.
- A reader MUST refuse a shape it does not know.

The limits of the binding check stay in force. A scorer weakened in place is not caught, and a reviewer sees it in the diff of the suite, not in the report. A fabricated but complete run file is not caught either. The reader needs a complete file in the tool's own shape, and the baseline's `source` must match.

## Permanent refusals

These refusals are permanent. An entry leaves the list only through a new major version of this specification.

| Refused                                                                                                                          | Why                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A hosted service, dashboard, account, database, or any network access                                                            | A hosted part brings an operational duty, and `check`, `record` and `show` open no connection                                                                                      |
| A neutral run format, a third reader, or a reader for another tool's output (Inspect, Ragas, LangSmith, Braintrust and the rest) | A format that no tool writes has no files to read, and each reader is a part that goes stale against someone else's release schedule                                               |
| Statistical significance, confidence intervals, retries, flaky-test handling                                                     | The baseline keeps no per-case data, and a reviewer can read a number in a diff but not a p-value                                                                                  |
| Relative, global or auto-adjusting tolerance, or a tolerance given at check time                                                 | A tolerance is absolute and stored per metric in the baseline, beside the value it relaxes                                                                                         |
| Updating the baseline automatically, on a pass or on a fail                                                                      | An automatic update makes the baseline whatever the last run was, and so makes the check meaningless. The baseline changes only when a person runs `record` and commits the result |
| Calling a model, a judge or any paid API                                                                                         | The check must run with no key                                                                                                                                                     |
| Telemetry, an update check, any outbound request                                                                                 | A request is a failure that depends on a network and a day                                                                                                                         |
| Pull-request comments, bots, chat messages, badges, status APIs                                                                  | Each needs a token and a service                                                                                                                                                   |
| Failing on a date, on baseline age, or on expiry                                                                                 | Nothing exits non-zero on a clock                                                                                                                                                  |
| Lower-is-better metrics, or a per-metric polarity setting, in major version 1                                                    | The reader reads higher-is-better only, and it refuses a metric that it cannot show to be higher-is-better                                                                         |
| A configuration file or environment variables                                                                                    | The baseline is the only configuration, and a second place is a second place for implementations to disagree                                                                       |
| JSON, SARIF or JUnit output of the report                                                                                        | Each format is another contract to keep. The report is line-oriented so that `grep` and the exit code are the interface, and the baseline is JSON for anyone who needs structure   |
| More than one run or suite in a baseline, merging baselines, per-branch baselines                                                | One baseline holds one run of one suite, so each has one `source` and one `cases` digest                                                                                           |
| Saying which case regressed                                                                                                      | It needs per-case data that the reduced baseline does not keep                                                                                                                     |
| A `--ci`, `--fail`, `--exit-code` or similar flag that makes failure the default                                                 | The strict flag is the only one                                                                                                                                                    |

## Versioning

A version of this specification has two numbers, MAJOR and MINOR, written MAJOR.MINOR, each a whole number with no leading zero. There is no third number, because a patch to a specification is either editorial, which changes no citation, or normative, which is a new minor.

| Number | Changes when                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR  | a rule, the baseline schema, a finding id, an exit code or the metric key of a shape changes so that an older baseline or an older reading gives a different answer |
| MINOR  | an output shape is added (a newer promptfoo results version, say), so older baselines are still read and nothing already readable changes meaning                   |

A published version never changes its behaviour. Its page changes only by an editorial correction, which covers wording, examples, and vectors that are added or corrected to agree with a clause. An editorial correction changes no behaviour and no citation, it leaves the version number alone, and the changelog records it with its date. Any change of behaviour is a new version, published at its own address beside the old one.

A version counts as published from the day its page is first served at its address. Before that day its page may change in any way, and the changelog starts with that day.

A baseline names the version it follows in its `spec` field. An implementation reads a baseline of its own major and an older or equal minor.

Each version has one page, at an address that holds both numbers, such as `https://meshin.co/spec/evals-baseline/1.0`.

That address carries no trailing slash. This site answers the slash form with a redirect, and an address that redirects is one step from being rewritten by whoever quotes it.

Only versioned pages are cited. The [evals-baseline series page](/spec/evals-baseline) lists every published version, names the current one and holds no normative text. The version sits in the address so that a later version publishes beside the first and never rewrites what people already cited.

## Conformance vectors

A conformance vector is one run of the command. It names the arguments, a pinned instant, and the baseline file and the run file that the command reads. It holds the exact lines the command prints, its exit code and the text of any file `record` writes. A vector tests a clause, and How to read this specification says what to do when the two disagree.

The vectors are published as one file, [/spec/evals-baseline/1.0/vectors.json](/spec/evals-baseline/1.0/vectors.json). Under the key `files` it carries the exact text of every baseline file and run file that a vector names and that exists. A path that is not a key of `files` names a file that does not exist. The file alone is enough to run every vector.

The [baseline schema](/spec/evals-baseline/1.0/baseline.schema.json) at `/spec/evals-baseline/1.0/baseline.schema.json` describes the shape of a baseline file. Published files, below, gives the digest of both files.

Version 1.0 has 192 vectors. 125 run `check`, 36 run `record`, 25 run `show`, 1 asks for the version, and 5 are usage errors that exit 2. The 125 check vectors are drawn from 62 distinct pairs of a baseline and a run.

| Covered                                     | Vectors | Distinct pairs | To reproduce |
| ------------------------------------------- | ------- | -------------- | ------------ |
| Rule 1, `missing-metric`                    | 8       | 4              | 8            |
| Rule 2, `below-baseline`                    | 14      | 6              | 14           |
| Rule 3, the note for a metric only in a run | 9       | 5              | 9            |
| Rule 4, `sample-count`                      | 12      | 6              | 12           |
| The binding check, `cases-changed`          | 8       | 4              | 8            |
| `no-baseline`                               | 2       | 1              | 2            |
| `bad-baseline`                              | 26      | 13             | 26           |
| `bad-run`                                   | 28      | 14             | 28           |
| `unreadable-metric`                         | 2       | 1              | 2            |
| `internal-error`                            | 2       | 1              | 0            |

A vector appears in a row for each finding its report names, so the rows do not partition the 192.

Vectors that name two findings stand in two rows, and there are 8 of them. Of the 192, 89 name no finding and stand in no row.

Of those 89, 22 are `check` runs that must stay silent. The other 67 run `record` or `show`, ask for the version, or are usage errors, and none of them reports a finding. The silent checks include these:

- the same suite recorded and checked twice
- a value exactly at its tolerance
- a run with more samples than the baseline, which prints a note and no finding

The rows therefore total 111. A row counts the vectors that prove it, not the vectors it exhausts. The last column counts the vectors of a row that an implementation must reproduce. The row for `internal-error` has none, because this specification defines no input that must raise an internal error.

No implementation is asked to reproduce the reference-only vectors, which number 4 of the 192. Of those 4, 2 print the message a runtime raised, which is not this specification's text. The other 2 print the reason line before a usage error, which this specification does not fix.

The vectors leave three clauses untested. No vector holds a code point that Unicode 15.1 leaves unassigned, or one of the seven code points.

No vector holds a DeepEval metric named `Bias`, `Hallucination`, `Misuse` or `Toxicity`, and none refuses a promptfoo metric because of the kind of its assertions. No vector holds a regression and a finding that could not be evaluated in one strict check.

Passing every vector does not show that an implementation follows those clauses.

Three things an implementation sets for itself. Its own package version, which the banner line carries and which this specification never fixes. The clock, which each vector pins, so an implementation that cannot set its clock compares every line except the one beginning `date:`. The order in which it reads files, which changes nothing a vector records.
