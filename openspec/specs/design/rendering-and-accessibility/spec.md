# design/rendering-and-accessibility Specification

## Purpose

This capability governs how the built pages look and behave in a real browser: recorded screenshots, zero axe violations in both color schemes, a skip link that takes the first keyboard focus, clean rendering in WebKit and Firefox, and cards that work as one tap target each. The browser checks run in npm run gate:visual, a Playwright suite that `site/playwright.config.ts` points at the built site, served locally on port 4322 by `site/scripts/gate-server.mjs`; npm run gate:plan checks that CI installs the browsers they need.

## Requirements

### Requirement: Each template's representative page matches its recorded screenshot

`site/tests/visual.spec.ts` SHALL take a full-page screenshot of one route per template, the first in sort order as `site/scripts/templates.mjs` picks it, in light and in dark, on the desktop (1440x900) and mobile (375x812) Chromium projects. It SHALL fail when the screenshot differs from the baseline for the running platform by more than 0.2% of its pixels, or by any width or height. Other routes of the same template get no screenshot. Guard: npm run gate:visual.

#### Scenario: A rendering change beyond the pixel ratio fails

- **WHEN** a representative page renders more than 0.2% of its pixels differently from its baseline
- **THEN** npm run gate:visual fails the test `<route> renders as recorded in <theme>` with `expect(page).toHaveScreenshot(expected) failed` and `<n> pixels (ratio <r> of all image pixels) are different.`

#### Scenario: A page that changes size fails whatever its pixels

- **WHEN** the screenshot's width or height differs from the baseline's
- **THEN** the same test fails with `Expected an image <w>px by <h>px, received <w2>px by <h2>px.`

#### Scenario: A representative route with no baseline fails

- **WHEN** a new template, or a route that now sorts first in its template, has no baseline in the running platform's folder under `site/tests/__screenshots__/`
- **THEN** the test fails with `A snapshot doesn't exist at <path>, writing actual.` and is not retried

### Requirement: Every built route has zero axe violations in both color schemes

For every route built as an `.html` file in the site's dist folder, `site/tests/visual.spec.ts` SHALL run axe-core with the tags wcag2a, wcag2aa, wcag21a, wcag21aa and best-practice, in light and in dark, on the desktop and mobile Chromium projects, and SHALL fail on any violation. Guard: npm run gate:visual. The specimen visualAxe in `site/scripts/mutation-specimens.mjs` proves the check can fail.

#### Scenario: An image without alt text fails

- **WHEN** a built page holds an `img` with no `alt` attribute
- **THEN** npm run gate:visual fails the test `<route> has no accessibility violations in <theme>`, and the received list holds `image-alt: 1 node(s)`

#### Scenario: The planted specimen proves the check

- **WHEN** npm run test:smoke adds a page with an unlabelled image to a disposable copy and runs the light axe test on the desktop project
- **THEN** the gate must be green without the page and red with it, naming `image-alt: 1 node(s)`, or the family `axe-violation-in-a-real-browser` prints FAIL

### Requirement: The skip link takes the first keyboard focus on the home page

On `/`, `site/tests/visual.spec.ts` SHALL press Tab once and SHALL require the focused element's text to be `Skip to content`, on the desktop and mobile Chromium projects. Guard: npm run gate:visual.

#### Scenario: Something else takes the first focus

- **WHEN** the skip link is removed or renamed, or another focusable element comes before it
- **THEN** npm run gate:visual fails the test `the skip link is the first thing keyboard focus reaches` on its `toHaveText` check

### Requirement: Every built route renders in WebKit and Firefox without sideways scroll or local errors

`site/tests/cross-browser.spec.ts` SHALL load every built route in Desktop Safari (WebKit) and Desktop Firefox, require the first `h1` or `h2` to be visible, allow at most 2 px of sideways scroll at 375 and at 1280 px wide, and fail on any uncaught page error, any failed request to the local server, and any console error not raised by another origin. A load that times out is retried once on DOMContentLoaded. Guard: npm run gate:visual.

#### Scenario: A page overflows the viewport

- **WHEN** a page's scroll width exceeds its client width by more than 2 px at either width
- **THEN** the test `<route> renders in this engine with no console error and no sideways scroll` fails with `<route> at <width>px: scrollWidth <n> vs clientWidth <m>, widest <element>`

#### Scenario: A page logs an error

- **WHEN** a page script throws, a local script logs a console error, or a request to the local server fails
- **THEN** the same test fails with `<route> logged console errors`

### Requirement: Every card on a card listing is one tap target

On `/`, `/services`, `/resources`, `/blog` and `/blog/tag/ai-governance` at 1280x1600, `site/tests/cards.spec.ts` SHALL find at least one `article` with a link in its `h3`, and SHALL require three points of each such card to reach that same link: 6 px inside its top-left corner, its center three quarters of the way down, and 6 px inside its bottom-right corner. Guard: npm run gate:visual.

#### Scenario: Part of a card does not reach its link

- **WHEN** a probed point in a card's padding or body reaches no link, or a different link
- **THEN** the test `every card on <route> is one tap target, not just its title` fails with `card <href> on <route>` and the link each point reached

#### Scenario: A listing renders no linked card

- **WHEN** one of the five routes renders no `article` with a linked `h3`
- **THEN** the test fails with `<route> renders at least one card with a linked title`

### Requirement: A card's link never covers the tag and category links inside it

On `/blog` at 1280x1600, `site/tests/cards.spec.ts` SHALL require each link to a `/blog/tag/` or `/blog/category/` route inside an `article` to be the link reached at its own center, and SHALL require at least one such link to exist. Guard: npm run gate:visual.

#### Scenario: A stretched card link swallows a tag link

- **WHEN** a card's title link is layered over a tag or category link inside the card
- **THEN** the test `a card title link never swallows the category and tag links beside it` fails with `nested link <href>`

#### Scenario: The blog listing shows no tag or category link

- **WHEN** no card on `/blog` holds a tag or category link
- **THEN** the same test fails with `/blog renders category and tag links inside its cards`

### Requirement: CI installs every browser engine the Playwright projects need

`site/scripts/plan-gate.mjs` SHALL read which of the words Chrome, Safari and Firefox, and which `browserName` values, appear in `site/playwright.config.ts`, map them to chromium, webkit and firefox, and SHALL fail when any `npx playwright install` line in `.github/workflows/ci.yml` leaves one out, or when the workflow has no such line. Guard: npm run gate:plan.

#### Scenario: An install line drops an engine

- **WHEN** the config still runs a Desktop Firefox project and an install line in the workflow no longer names firefox
- **THEN** npm run gate:plan exits 1 and prints `PLAN browser-not-installed playwright.config.ts runs a firefox project, and at least one npx playwright install line in ci.yml does not include it`

### Requirement: A focused test cannot pass the rendering gate in CI

When the `CI` variable is set, `site/playwright.config.ts` SHALL turn on `forbidOnly`, so a `test.only` or `test.describe.only` left in a spec fails the whole run instead of quietly skipping every other test. Guard: npm run gate:visual.

#### Scenario: A focused test is committed

- **WHEN** a spec under `site/tests/` contains `test.only` and the run has `CI` set
- **THEN** npm run gate:visual fails with `Error: item focused with '.only' is not allowed due to the 'forbidOnly' option in '<config>': "<title>"`
