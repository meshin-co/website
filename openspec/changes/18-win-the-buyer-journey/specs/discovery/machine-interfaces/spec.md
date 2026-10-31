# discovery/machine-interfaces Specification

## MODIFIED Requirements

### Requirement: Every dated live route carries a lastmod in the sitemap

Every live route that `siteLastmods` in `site/src/utils/sitemap-lastmod.mjs` dates SHALL appear in `/sitemap-0.xml` with a `<lastmod>`: each live content entry, each collection hub dated by its newest live entry, each category and tag archive of a live post, `/blog/tags` and each public static page, dated by its row in `site/src/utils/machine-text.mjs`, never by git history or the build clock. `npm run gate:machine` enforces this and asks that same helper which routes to expect.

#### Scenario: A route loses its lastmod

- **WHEN** the `/about` entry of `/sitemap-0.xml` loses its `<lastmod>`
- **THEN** `npm run gate:machine` prints `MACHINE sitemap has no lastmod for /about` and exits 1

#### Scenario: A public static page has no editorial date

- **WHEN** a public static page is added to `STATIC_PAGE_CATALOG` with no `updatedDate`
- **THEN** `npm run build` stops with `static page /<path> carries no updatedDate` instead of dating it by the commit the build ran in, and `npm run test` fails the test `siteLastmods refuses a static page that neither a collection nor the catalog dates` if that refusal is removed
