## ADDED Requirements

### Requirement: A specification entry names its artefact and its version

A specification entry SHALL carry a `name`, a two-number `version`, a `license`, a `citeAs` template and the
`citeKey` that template fills, in addition to the title, description, `publishDate` and `updatedDate` every
collection entry carries. The `name` and the `version` together address the entry, so a second version of one
artefact is a second file and never an edit of the first.

#### Scenario: A version that is not two numbers

- **WHEN** a specification entry's version is "1.0.0"
- **THEN** `npm run build` fails, naming the version field

#### Scenario: A specification that declares no licence

- **WHEN** a specification entry omits `license`
- **THEN** `npm run build` fails, naming `license: Required`

#### Scenario: A citation template that never names the specification

- **WHEN** a specification entry's `citeAs` holds no occurrence of its `citeKey`
- **THEN** `npm run build` fails, naming `citeAs`

#### Scenario: Two entries of one artefact at one version

- **WHEN** two files declare the same `name` and the same `version`
- **THEN** `npm run build` fails, naming the duplicate address
