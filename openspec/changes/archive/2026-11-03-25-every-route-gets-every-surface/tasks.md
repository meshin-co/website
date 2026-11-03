# Tasks

## 1. Measure before writing a gate

- [x] 1.1 Remove one surface from one route at a time on the built output, run every gate that reads
      the build, and record which removals fail a gate and which stay green
- [x] 1.2 Record the routes that sit outside `gate:jsonld` (110 of 113 carried a graph) and why

## 2. The gate

- [x] 2.1 `route-kinds.mjs` derives a kind for every built route from the collection configuration
      and the built page, with no list of paths
- [x] 2.2 `route-parity.mjs` owes each kind its surfaces and reports the route and the surface for
      each one missing
- [x] 2.3 `route-parity-gate.mjs` reads the build and the configuration, prints the derived-route
      and owed-cell counts and the declared exceptions, and exits 1 on any finding
- [x] 2.4 A build in which no route is owed a surface is a finding, not a pass
- [x] 2.5 `npm run gate:parity` is wired into `package.json` and `ci.yml` beside `gate:machine`

## 3. The exceptions

- [x] 3.1 `route-exceptions.mjs` declares `/404`, `/search` and `/styleguide` and the empty
      `case` collection, each with a reason
- [x] 3.2 `NOINDEX_STATIC_PAGES` is read from the register
- [x] 3.3 A stale exception, an indexable exception, a stale empty-collection declaration and an
      undeclared noindex route are findings

## 4. The silent skips

- [x] 4.1 `gate:machine` declares and counts the collections with no live entry and fails on an
      undeclared one
- [x] 4.2 `gate:machine` fails when no sitemap lastmod was expected

## 5. Proof

- [x] 5.1 One planted specimen per surface family: a sidecar removed, a route dropped from the
      sitemap, an OG card deleted, an entry dropped from its collection feed, an entry dropped from
      its search shard, a markdown link removed
- [x] 5.2 A `test:smoke` family for each specimen
- [x] 5.3 The finished gate run against the build of the machine-written article branch

## 6. Calibration Gate

- [x] 6.1 `npm run test:smoke` proves every guard family can still fail
- [x] 6.2 Run the Calibration Gate and commit the report it generates for this change
