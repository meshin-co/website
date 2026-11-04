import { gzipSync } from 'node:zlib';

import { expect, test } from '@playwright/test';
import type { Page, Response as ServedResponse } from '@playwright/test';

import { FIRST_QUERY_BUDGET_BYTES } from '../scripts/search-budget.mjs';

const indexPath = /\/search-index\/.+\.json$/;
const manifestPath = '/search-index/manifest.json';

interface IndexManifest {
  version: string;
  documents: number;
  pageSize: number;
  lastKeys: string[];
}

const pathOf = (response: ServedResponse) => new URL(response.url()).pathname;

test('search returns real hits and the first query downloads less than the first-query budget', async ({ page }) => {
  const served: ServedResponse[] = [];
  page.on('response', (response) => {
    if (indexPath.test(pathOf(response))) served.push(response);
  });

  await page.goto('/search');
  expect(served).toHaveLength(0);

  await page.fill('#search-query', 'governance');
  await page.click('form[data-search] button[type="submit"]');

  await expect(page.locator('[data-search-summary]')).toContainText(/match/);
  const hits = page.locator('[data-search-results] li');
  expect(await hits.count()).toBeGreaterThan(0);
  await expect(hits.first().locator('a')).toHaveAttribute('href', /^\//);

  const fetched = served.map(pathOf);
  expect(fetched).toContain(manifestPath);

  const manifestResponse = served.find((response) => pathOf(response) === manifestPath)!;
  const manifest: IndexManifest = JSON.parse((await manifestResponse.body()).toString('utf8'));
  const pageCount = Math.ceil(manifest.documents / manifest.pageSize);
  const named = new Set([
    manifestPath,
    ...manifest.lastKeys.map((_, chunk) => `/search-index/${manifest.version}/t/${chunk}.json`),
    ...Array.from({ length: pageCount }, (_, index) => `/search-index/${manifest.version}/d/${index}.json`),
  ]);
  const unnamed = fetched.filter((path) => !named.has(path));
  expect(unnamed, 'fetched files the manifest does not name').toEqual([]);

  const bodies = await Promise.all(served.map((response) => response.body()));
  const gzipped = bodies.reduce((sum, body) => sum + gzipSync(body).byteLength, 0);
  expect(gzipped, 'gzip bytes the first query downloaded').toBeLessThanOrEqual(FIRST_QUERY_BUDGET_BYTES);
});

test('a query in the url is answered on load, and a nonsense query says so', async ({ page }) => {
  await page.goto('/search?q=retainer');

  await expect(page.locator('[data-search-summary]')).toContainText(/match/);
  expect(await page.locator('[data-search-results] li').count()).toBeGreaterThan(0);

  await page.fill('#search-query', 'kubernetes');
  await page.click('form[data-search] button[type="submit"]');

  await expect(page.locator('[data-search-summary]')).toContainText('No pages match');
  expect(await page.locator('[data-search-results] li').count()).toBe(0);
});

async function resultHrefs(page: Page) {
  return page
    .locator('[data-search-results] li a')
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
}

async function searchFor(page: Page, query: string) {
  await page.goto('/search');
  await page.fill('#search-query', query);
  await page.click('form[data-search] button[type="submit"]');
  await expect(page.locator('[data-search-summary]')).toContainText(/match/);
}

test('a phrase from deep inside a long article is found by its own words, not just its title', async ({ page }) => {
  await searchFor(page, 'watched the rollback rehearsal');
  expect(await resultHrefs(page)).toContain('/blog/why-your-ai-pilot-never-reached-production');
});

test("a phrase from a post's own faq block is found", async ({ page }) => {
  await searchFor(page, 'verbal guidance stops being enough');
  expect(await resultHrefs(page)).toContain('/blog/ai-acceptable-use-policy-for-a-50-person-company');
});

test('a tag page is found by its name', async ({ page }) => {
  await searchFor(page, 'Shadow AI');
  expect(await resultHrefs(page)).toContain('/blog/tag/shadow-ai');
});

test('a hub page is found by its name', async ({ page }) => {
  await searchFor(page, 'AI governance glossary');
  expect(await resultHrefs(page)).toContain('/glossary');
});

test('a hub with nothing in it is not offered, because the result would lead to an empty page', async ({ page }) => {
  await searchFor(page, 'Case studies');
  expect(await resultHrefs(page)).not.toContain('/case-studies');
});

test('a glossary term is found', async ({ page }) => {
  await searchFor(page, 'prompt injection');
  expect(await resultHrefs(page)).toContain('/glossary/prompt-injection');
});

test('a hand-authored static page is found by a phrase from its own body copy, not its title or description', async ({
  page,
}) => {
  await searchFor(page, 'Full-disk encryption on the machine I work from');
  expect(await resultHrefs(page)).toContain('/security');
});

test("a collection hub is found by a phrase from its own body copy, proving the search text is the page's real rendered prose", async ({
  page,
}) => {
  await searchFor(page, 'Copy one into your own wiki');
  expect(await resultHrefs(page)).toContain('/resources');
});

test('a failed shard fetch shows the fallback message, and the next search retries instead of staying broken', async ({
  page,
}) => {
  await page.route(indexPath, (route) => route.abort('failed'));
  await page.goto('/search');

  await page.fill('#search-query', 'governance');
  await page.click('form[data-search] button[type="submit"]');
  await expect(page.locator('[data-search-summary]')).toHaveText(
    'Search is unavailable right now. The FAQ, writing and glossary pages list everything.'
  );
  expect(await page.locator('[data-search-results] li').count()).toBe(0);

  await page.unroute(indexPath);

  await page.fill('#search-query', 'retainer');
  await page.click('form[data-search] button[type="submit"]');
  await expect(page.locator('[data-search-summary]')).toContainText(/match/);
  expect(await page.locator('[data-search-results] li').count()).toBeGreaterThan(0);
});
