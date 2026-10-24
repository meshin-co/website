# Tasks

## 1. Measure with the engine that knows the directive

- [x] 1.1 Pin Lighthouse 13.5.0 through an `overrides` entry, because `@lhci/cli@0.15.1` is the
      newest release and still depends on 12.6.1
- [x] 1.2 Prove the directive is accepted now: the shard that failed before passes, and the full
      run is 8 shards, 0 failures

## 2. State the signal in both places

- [x] 2.1 Emit `Content-Signal` in every `robots.txt` group, reading the one constant the headers
      generator exports, so the two cannot be typed apart
- [x] 2.2 Keep the response header, which outranks `robots.txt` where they disagree

## 3. Refuse disagreement

- [x] 3.1 `robotsSignalGaps()` fails on a group with no directive, with more than one, with a
      signal unsaid, or with a value that differs from the header, naming both values
- [x] 3.2 Specimen families prove it: `agents` strips a signal from the headers file, and the
      tests cover a group whose value drifts from the header

## 4. Close the row

- [x] 4.1 Mark G45 closed with what changed and the evidence
- [x] 4.2 Correct every document that states the directive is forbidden: the capability spec, the
      agent-interfaces skill, and the scan artefact

## 5. Calibration Gate

- [x] 5.1 `npm run test:smoke` proves every guard family can still fail
- [x] 5.2 Run the Calibration Gate on 13.5.0 and commit the report it generates for this change
