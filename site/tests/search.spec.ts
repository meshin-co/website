import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { PER_SHARD_BUDGET_BYTES, SUM_BUDGET_BYTES, discoverShards, shardBudgets } from '../scripts/search-budget.mjs';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const indexPath = /\/search-index(-[a-z]+)?\.json$/;

test('search returns real hits and every fetched shard stays inside the per-shard and sum budgets', async ({
  page,
}) => {
  const fetched = new Set<string>();
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (indexPath.test(pathname)) fetched.add(pathname);
  });

  await page.goto('/search');
  expect([...fetched]).toHaveLength(0);

  await page.fill('#search-query', 'governance');
  await page.click('form[data-search] button[type="submit"]');

  await expect(page.locator('[data-search-summary]')).toContainText(/match/);
  const hits = page.locator('[data-search-results] li');
  expect(await hits.count()).toBeGreaterThan(0);
  await expect(hits.first().locator('a')).toHaveAttribute('href', /^\//);

  const budgets = shardBudgets(distDir);
  expect(budgets.shards.length).toBeGreaterThan(0);
  for (const shard of budgets.shards) {
    expect(shard.bytes, `${shard.file} exceeds the per-shard budget`).toBeLessThan(PER_SHARD_BUDGET_BYTES);
  }
  expect(budgets.sum, 'the sum of all shards exceeds the sum-of-shards budget').toBeLessThan(SUM_BUDGET_BYTES);
  expect(budgets.withinBudget).toBe(true);

  const expected = new Set(discoverShards(distDir).map((file) => `/${file.split('/').pop()}`));
  expect(fetched).toEqual(expected);
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
  await searchFor(page, 'Case studies');
  expect(await resultHrefs(page)).toContain('/case-studies');
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
