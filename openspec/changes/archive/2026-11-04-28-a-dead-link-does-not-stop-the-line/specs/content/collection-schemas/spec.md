# content/collection-schemas Specification

## MODIFIED Requirements

### Requirement: A source's original is the address its url stands in for

A source MAY carry `original`, the address that was first cited, and `url` SHALL then stand in for it: an Internet Archive snapshot of exactly that address, or the search built from the source's own title and publisher. `site/src/content.config.ts` refuses any other `original`, one equal to `url` included, so a citation that goes back to its address carries none. The page prints a note beside a stand-in, and the JSON-LD citation of an entry leaves a search stand-in out.

#### Scenario: An original beside an archive snapshot

- **WHEN** a source has `url: https://web.archive.org/web/20251025031200/https://www.nist.gov/itl/ai-risk-management-framework` and `original: https://www.nist.gov/itl/ai-risk-management-framework`
- **THEN** `npm run build` passes, the source list prints `Internet Archive copy, captured 2025-10-25`, and the JSON-LD citation names the snapshot

#### Scenario: An original beside a search for the source

- **WHEN** a source titled "AI RMF 1.0" from NIST has `original: https://example.com/standard` and `url: https://www.google.com/search?q=%22AI+RMF+1.0%22+NIST`
- **THEN** `npm run build` passes, the source list prints `the original page has gone; this link is a search for it`, and the JSON-LD citation leaves the source out

#### Scenario: An original that url does not stand in for

- **WHEN** a source's `original` is a different page from the one its snapshot `url` captured
- **THEN** `npm run build` fails, naming `sources.0.original: must be the address that url stands in for: its Internet Archive snapshot, or the search for this source's title and publisher`; `npm run test:smoke` plants this violation from `site/tests/guard-mutations/fixtures/source-original-mismatch.md`

#### Scenario: An original beside its own address

- **WHEN** a citation went back to its address and its source row keeps `original` equal to `url`
- **THEN** `npm run build` fails, naming `sources.0.original: must be the address that url stands in for: its Internet Archive snapshot, or the search for this source's title and publisher`; `npm run test` fails the test `a url that stands in for nothing the row names is no stand-in` if a row that names its own address is taken for a stand-in
