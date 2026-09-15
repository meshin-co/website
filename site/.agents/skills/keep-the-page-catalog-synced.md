# Keep the Page Catalog Synced

`src/utils/machine-text.mjs` carries `STATIC_PAGE_CATALOG` and `HUB_PAGES`: a hand-written copy of
each static and hub page's title and description, used to build `llms.txt` and the `.md` sidecars.
It duplicates text that lives in the page, so it drifts silently — six entries had drifted by
2026-09-15.

`gate:machine` now compares every catalog description against the `<meta name="description">` the
page actually ships and fails on a mismatch or on a catalog route that no longer builds
(`scripts/catalog-drift.mjs`). Proven by planting a stale description: RED with
`catalog-description-drift`, GREEN once restored.

Change a static page's description and you change the catalog in the same commit.
