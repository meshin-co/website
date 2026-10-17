# Tasks

## 1. Stop publishing an absence

- [x] 1.1 Serve `/case-studies` `noindex` and drop it from the Markdown mirrors, the search index,
      the feeds and the `llms` outputs while it has no entries
- [x] 1.2 Add a guard that fails when a collection page with zero entries is indexable, with a
      planted specimen proving it fails

## 2. Make the machine corpus reachable and consistent

- [x] 2.1 Reference `/llms.txt` from the built pages so it is reachable without guessing
- [x] 2.2 Give every file under `/llms/` the same `noindex` rule its siblings carry
- [x] 2.3 Extend the machine-interface guard to fail when a shipped machine file is unreferenced or
      carries a different rule from its siblings

## 3. Announce content changes, not just new routes

- [x] 3.1 Make `site/scripts/indexnow-ping.mjs` detect a changed page on an existing route
- [x] 3.2 Write the failing test first: an edited page on an unchanged route is announced

## 4. Let a reader see the order

- [x] 4.1 Default `site/src/components/site/StepList.astro` to unordered, so a list claims a
      sequence only where one exists
- [x] 4.2 Show list markers on the three real sequences: the order of work, what is measured, and
      the service process
- [x] 4.3 Record that list markers are not the numbered section labels L9a removed

## 5. Footer links stop shouting

- [x] 5.1 Muted text at rest; underline and colour on hover, focus-visible and active
- [x] 5.2 Confirm the focus indicator still passes the accessibility suite

## 6. The heading

- [x] 6.1 Replace "In my words" with "The detail" on every page that carries it
- [x] 6.2 Record each changed string in the editorial ledger with its disposition

## 7. Calibration Gate

- [ ] 7.1 Run the Calibration Gate and commit the report it generates for this change
