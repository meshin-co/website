# governance/engine-portability Specification

## ADDED Requirements

### Requirement: One file holds what the engine knows about its site

Every site-specific value the pipeline reads — path prefixes, route families, format rules,
collection names, thresholds, the property it measures and the window it uses — SHALL live in one
configuration file, be read by one loader and be validated against a schema at load.

#### Scenario: A value is missing or malformed

- **WHEN** the configuration lacks a required field or holds one of the wrong shape
- **THEN** the loader fails naming the field and the file, rather than deriving a default from
  another field

#### Scenario: A second site adapts the engine

- **WHEN** the engine directory is copied into another repository
- **THEN** a self-check command names every value that must be set and every anchor file the engine
  expects, and exits non-zero until they exist

### Requirement: The diff classifier has one implementation

The rule deciding whether a commit changes what the gates measure SHALL have one implementation,
read from the configuration, and CI SHALL call it rather than re-expressing it. A path the rule
cannot classify SHALL draw the full job graph.

#### Scenario: The repository is laid out differently

- **WHEN** the content directory does not match the prefixes the engine was copied with
- **THEN** the classifier either resolves the path from the configuration or treats it as
  build-affecting and runs every gate, and it never silently reports that nothing changed

#### Scenario: The two implementations drift

- **WHEN** the workflow and the module disagree about any path
- **THEN** a test fails naming the path, because a classifier that is wrong in one place is a gate
  that does not run
