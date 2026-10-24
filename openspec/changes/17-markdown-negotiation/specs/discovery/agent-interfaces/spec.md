# discovery/agent-interfaces Specification

## ADDED Requirements

### Requirement: The same URL answers markdown when an agent asks for it

A `GET` or `HEAD` whose `Accept` header names `text/markdown` SHALL be answered with the markdown sidecar the
build wrote for that route, carrying `content-type: text/markdown; charset=utf-8`, a
`content-location` naming the sidecar, and `Accept` among the values of `Vary`. Every other request
SHALL be served unchanged. The build SHALL ship the edge handler that does this, and the gate SHALL
fail without it.

#### Scenario: An agent asks the home page for markdown

- **WHEN** `GET /` carries `accept: text/markdown`
- **THEN** the response is the content of `/index.md` with `text/markdown; charset=utf-8`

#### Scenario: A browser asks the same URL

- **WHEN** `GET /about` carries a browser's `Accept`, which names `text/html` and `*/*`
- **THEN** the response is the HTML page, unchanged

#### Scenario: The route has no sidecar

- **WHEN** an agent asks for markdown on a route the build writes no `.md` for
- **THEN** the HTML page is served, because a missing sidecar must not turn a page into a 404

#### Scenario: A client asks what the URL would send

- **WHEN** `HEAD /` carries `accept: text/markdown`
- **THEN** the headers are the ones `GET` would send, with no body, because a `HEAD` that
  disagrees with its own `GET` misinforms the client that asked

#### Scenario: A method that is not a read

- **WHEN** a `POST` carries `accept: text/markdown`
- **THEN** it is passed through untouched

#### Scenario: The handler fails

- **WHEN** the asset lookup inside the handler throws
- **THEN** the request is served from the assets anyway, so an edge failure costs the markdown and
  never the response

#### Scenario: The build ships no handler

- **WHEN** `dist/_worker.js` is absent
- **THEN** `npm run gate:agents` fails saying the build ships no edge handler

#### Scenario: The handler has nothing to serve

- **WHEN** the handler is shipped but `dist/index.md` is not
- **THEN** the gate fails naming the missing sidecar, because the negotiation would be dead on the
  one route agents probe

### Requirement: The live origin proves the negotiation

The negotiation is invisible to a static file server, so the production smoke SHALL request the
live home page with `Accept: text/markdown` and SHALL fail when the answer is not markdown.

#### Scenario: The live origin answers HTML

- **WHEN** the live home page answers `text/html` to a request for markdown
- **THEN** `npm run smoke:prod` reports a failure naming the media type it got and the one it
  expected
