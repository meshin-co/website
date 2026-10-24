# discovery/agent-interfaces Specification

## Purpose

What an AI agent finds when it arrives: the terms the site sets for its content, the machine
endpoints it can call, and the two documents that catalogue them. Everything here is derived from
the built output, because a hand-kept list sends an agent to a route the build no longer makes. A
document is published only when the service behind it exists; the cards this site does not publish
are refusals, not omissions.

## Requirements

### Requirement: Every response declares the site's AI content signals

The built headers file SHALL carry a `Content-Signal` response header on every route, naming all
three signals `search`, `ai-train` and `ai-input`, each with an explicit `yes` or `no` value. The
signal SHALL NOT be written as a `robots.txt` directive.

#### Scenario: The signal is written as a robots.txt directive instead

- **WHEN** `Content-Signal` lines are added to the built `robots.txt`
- **THEN** Lighthouse's `robots-txt` audit reports an unknown directive and the SEO category falls
  below the required 100 on every route

#### Scenario: The signal is missing

- **WHEN** the `Content-Signal` header is removed from the catch-all rule
- **THEN** the gate fails saying no response declares a Content-Signal

#### Scenario: The signal names only two of the three

- **WHEN** the header carries `search` and `ai-input` but not `ai-train`
- **THEN** the gate fails naming the signal that is absent

#### Scenario: Two rules declare conflicting signals

- **WHEN** the catch-all rule carries two `Content-Signal` headers
- **THEN** the gate fails naming how many it found, because an agent cannot resolve the conflict

### Requirement: The JSON endpoints the build ships are described by an OpenAPI document

The build SHALL emit `/openapi.json` describing every JSON resource it serves, derived from the
same route data the build uses. A path in the document that the build does not ship, and a shipped
JSON route the document omits, SHALL both fail the gate: a catalogue that drifts from the build
sends an agent to a 404.

#### Scenario: The document names a route that does not exist

- **WHEN** `/openapi.json` describes `/missing.json` and the build ships no such file
- **THEN** the gate fails naming the path

#### Scenario: A shipped JSON route is undescribed

- **WHEN** the build ships a JSON route absent from `/openapi.json`
- **THEN** the gate fails naming the route

### Requirement: The API catalogue is served with the linkset media type

`/.well-known/api-catalog` SHALL be served with `Content-Type: application/linkset+json` and SHALL
contain a `linkset` array whose entries carry an `anchor`, a `service-desc` link resolving to
`/openapi.json`, and a `service-doc` link resolving to a page the build ships. A static host guesses
the media type from the file extension, and this file has none, so the type SHALL come from the
headers file in the build output.

#### Scenario: The media type is left to the host

- **WHEN** the headers file carries no rule for `/.well-known/api-catalog`
- **THEN** the gate fails naming the missing rule

#### Scenario: A link target is not shipped

- **WHEN** `service-doc` points at a route absent from the build
- **THEN** the gate fails naming the target

### Requirement: The home page points at the machine layer in its first response

The home page response SHALL carry `Link` headers for `api-catalog`, `service-desc` and
`describedby`, each a URI reference in angle brackets with a quoted `rel`, and each resolving to a
route the build ships.

#### Scenario: A Link header points at a route that is not built

- **WHEN** a `Link` header names a path absent from the build
- **THEN** the gate fails naming the header and the path

### Requirement: A capability manifest is reachable from every page

The build SHALL serve `/.well-known/ai-catalog.json` listing the machine entry points the site
offers, and SHALL make it reachable from the head of every page through a `<link rel="ai-catalog">`.
The head link SHALL name a manifest the build ships, and every URL inside the manifest SHALL be a
route the build ships.

#### Scenario: The head link names a manifest that was never written

- **WHEN** the `<link rel="ai-catalog">` href names a path absent from the build
- **THEN** the gate fails naming the path, and does not crash reading it

#### Scenario: The manifest lists a route that is not built

- **WHEN** an entry URL is absent from the built output
- **THEN** the gate fails naming the entry
