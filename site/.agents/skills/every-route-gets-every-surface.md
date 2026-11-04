# Every route gets every surface

`npm run gate:parity` (`scripts/route-parity-gate.mjs`) asks the question from the route's side: what is
this route owed, and does the build carry all of it. It prints `PARITY <route> is owed <surface>: <why>`
for each miss and exits 1.

## How a route's kind and its owed set are found

- `scripts/route-kinds.mjs` derives the kind from the route's shape under a collection base taken from
  the content config and from whether the built page is noindex. Nothing lists a path, so a new
  collection or a new entry is owed everything the day it exists.
- `OWED` in `scripts/route-parity.mjs` maps each kind to its surfaces. `SURFACES` holds, per surface,
  the check that fails without it. `scripts/head-tags.mjs` reads the `<link>` and `<meta>` tags those
  checks look at.
- Two surfaces are conditional: an entry's `llms.txt` line when its collection is listed inline, and
  the merged-feed item for the newest entry of a collection.
- An entry is owed a place in `/llms/<kind>.txt` or one of its shards, and none in `/llms-full.txt`,
  which lists collections and no entry. It is owed a collection-feed item only inside the newest
  `FEED_WINDOW` (15) entries of its collection; an older entry is not a finding.

## What is declared, and where

`src/utils/route-exceptions.mjs` declares the routes that carry less (`/404`, `/search`, `/styleguide`)
and the collections with no live entry (`case`), each with a reason. The gate prints their count. A
declaration that no longer matches the build, and a noindex route or empty collection nobody declared,
are findings. `NOINDEX_STATIC_PAGES` reads the same register.

## Adding a surface a generator now emits for every entry

Add it to `OWED` and `SURFACES` with the check that would fail without it, add a planted fault to
`scripts/parity-specimens.mjs` and a family row to `scripts/mutation-smoke.mjs`, and add the cell to
`scripts/fixtures/parity-world.mjs` so `scripts/route-parity.test.mjs` can remove it.
