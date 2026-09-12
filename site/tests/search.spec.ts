import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

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
