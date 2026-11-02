# governance/engine-portability Specification

## ADDED Requirements

### Requirement: Every tracked file has one class, derived from a property it has

The engine SHALL give every tracked file exactly one of three classes, engine, site or evidence,
using an ordered list of rules that each read a property of the file: where it lives, whether a
script reads it, whether it names a collection entry, whether a generator writes it, whether the
engine ships a seed for it. The rules SHALL NOT read a list of paths. A file that fits no rule
SHALL be reported as a finding and SHALL NOT receive a default class.

#### Scenario: A file fits no rule

- **WHEN** a tracked file matches no rule
- **THEN** `node scripts/run-partition-gate.mjs` prints `PARTITION unclassified <path>`, names what to
  decide, and exits 1

#### Scenario: A collection entry is added

- **WHEN** a markdown file is added under a directory that `site/src/content.config.ts` exports as a
  collection
- **THEN** the partition classes it as site without any change to a rule

#### Scenario: A seed claims a file

- **WHEN** the engine holds `seed/<path>.seed`
- **THEN** `<path>` is classed as site, and the seed itself is classed as engine

### Requirement: An engine file names no site

An engine file, except a test or a file of fixture data, SHALL NOT contain the site name, the host
or the author name that the site configuration holds. A term shorter than four letters SHALL NOT
count.

#### Scenario: A skill names the host

- **WHEN** an engine skill contains the host from `site/src/config.yaml`
- **THEN** the run prints `PARTITION site-bound <path>` with the term, and exits 1

#### Scenario: A test names the site

- **WHEN** a test file contains the same host
- **THEN** the run reports no finding for it, because a test pins behaviour against an invented site

### Requirement: Every file the engine expects is served

Each file or directory that `scripts/engine-anchors.mjs` expects SHALL be shipped as engine, provided
by a seed, written by a generator, or produced by a measure script. Otherwise the partition SHALL
report it.

#### Scenario: An anchor has no server

- **WHEN** an anchor file is a site file and no seed holds a starter for it
- **THEN** the run prints `PARTITION anchor-unserved <path>` and exits 1

#### Scenario: A record has a measure script

- **WHEN** an anchor is an audit record and `scripts/measure-<record>.mjs` is tracked
- **THEN** the record counts as produced, and the run reports no finding for it
