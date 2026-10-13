## 1. External audit rounds

- [x] 1.1 Round 1: five reproduced findings fixed, each with a machine check (`685d40c`)
- [x] 1.2 Round 2: the second audit's findings fixed (`6a0c9c2`)
- [x] 1.3 Round 3: the third audit's findings fixed

## 2. Move the plan into OpenSpec

- [x] 2.1 Pin the CLI, add the spec tree, narrow the archive exemption (PR #19)
- [x] 2.2 Write ten capability specs and the gate that proves them (PR #20)
- [x] 2.3 Close the two ways `gate:spec` could pass vacuously
- [x] 2.4 Retarget every reader of `docs/plan/` and import the closed phases verbatim (PR #21)
- [x] 2.5 Land the `.ignore` entry last, with a rehearsed revert (PR #21)
- [x] 2.6 Report an unresolvable push range instead of reading it as an empty one (PR #23)
- [x] 2.7 Replace the frozen route baseline with a named ledger (PR #24)

## 3. Calibration Gate

- [x] 3.1 Run the Calibration Gate and commit its report under `audits/phase-10-harness-integrity/` — Result PASS, 26 routes, 52 rows at 100/100/100/100, 954 visual and cross-browser tests, 62 of 62 mutation families
