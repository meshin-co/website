# discovery/agent-interfaces Specification

## ADDED Requirements

### Requirement: The search index is one entry of the agent catalogue, its manifest

`site/scripts/gen-agent-catalog.mjs` SHALL list the search index as the single entry `manifest` of the `search` namespace for `/search-index/manifest.json`, and SHALL NOT list a term chunk or a document page, so the catalogue does not grow with the corpus. Guarded by `site/scripts/gen-agent-catalog.test.mjs` under `npm run test`.

#### Scenario: Chunks and pages reach the catalogue

- **WHEN** the catalogue lists a term chunk or a document page of the search index
- **THEN** `npm run test` fails the test `the term chunks and document pages of the search index never reach the catalog, so it does not grow with the corpus`

#### Scenario: The index becomes several entries

- **WHEN** the catalogue lists more than the manifest for the search index
- **THEN** `npm run test` fails the test `the search index is one entry, its manifest, whatever number of files stands behind it`

## MODIFIED Requirements

### Requirement: The JSON endpoints the build ships are described by an OpenAPI document

The build SHALL emit `/openapi.json` describing every JSON resource it serves, derived from the same route data the build uses, except the implementation files under `/search-index/<version>/` that `/search-index/manifest.json` leads to. A path in the document that the build does not ship, and a shipped JSON route the document omits, SHALL both fail the gate: a catalogue that drifts from the build sends an agent to a 404.

#### Scenario: The document names a route that does not exist

- **WHEN** `/openapi.json` describes `/missing.json` and the build ships no such file
- **THEN** the gate fails naming the path

#### Scenario: A shipped JSON route is undescribed

- **WHEN** the build ships a JSON route absent from `/openapi.json`
- **THEN** the gate fails naming the route

#### Scenario: The files behind the search manifest are not described

- **WHEN** the build ships 500 term chunks and 500 document pages under `/search-index/0123456789/`
- **THEN** `/openapi.json` describes `/search-index/manifest.json` and none of them, and `npm run test` passes the test `the files behind the search index manifest are implementation files, so 500 chunks and 500 pages leave a described tree clean`

#### Scenario: A JSON file outside a version folder is undescribed

- **WHEN** the build ships `/search-index/stray.json` and `/openapi.json` does not describe it
- **THEN** the gate fails naming the route, as the test `a JSON file the search index keeps outside a version directory is a finding too` pins under `npm run test`
