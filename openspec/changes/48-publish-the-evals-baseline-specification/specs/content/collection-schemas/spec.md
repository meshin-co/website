## ADDED Requirements

### Requirement: A specification address is held by one entry

The `name` and the `version` of a specification entry together address it, so a second version of one artefact is a
second file and never an edit of the first, and `npm run build` SHALL fail when two entries declare the same `name` and
the same `version`. Guard: `groupSeries` in `site/src/utils/spec-series.mjs`, proven by the family
`spec-address-duplicated` of `npm run test:smoke` and by `site/src/utils/spec-address.test.mjs`.

#### Scenario: Two entries of one artefact at one version

- **WHEN** two files declare the same `name` and the same `version`
- **THEN** `npm run build` fails, naming the duplicate address
