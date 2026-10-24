# discovery/agent-interfaces Specification

## ADDED Requirements

### Requirement: robots.txt declares the site's AI content signals

The built `robots.txt` SHALL carry a `Content-Signal` directive inside a user-agent group,
naming all three signals `search`, `ai-train` and `ai-input`, each with an explicit `yes` or `no`
value. A site that publishes no signal has declared nothing, and each agent applies its own
default instead. `npm run gate:machine` enforces this against the built file.

#### Scenario: The signal is missing

- **WHEN** the `Content-Signal` line is removed from the built `robots.txt`
- **THEN** the gate fails naming the file and the missing directive

#### Scenario: The signal names only two of the three

- **WHEN** the directive carries `search` and `ai-train` but not `ai-input`
- **THEN** the gate fails naming the signal that is absent

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

### Requirement: A capability manifest is reachable by more than one route

The build SHALL serve `/.well-known/ai-catalog.json` listing the machine entry points the site
offers, and SHALL make it reachable two further ways: a `<link rel="ai-catalog">` in the head of
every page and an `Agentmap:` line in `robots.txt`. All three SHALL name the same manifest URL, and
every URL inside the manifest SHALL be a route the build ships.

#### Scenario: The head link and the manifest disagree

- **WHEN** the `<link rel="ai-catalog">` href names a different path from the `Agentmap:` line
- **THEN** the gate fails naming both values

#### Scenario: The manifest lists a route that is not built

- **WHEN** an entry URL is absent from the built output
- **THEN** the gate fails naming the entry
