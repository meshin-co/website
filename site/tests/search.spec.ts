import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { expect, test } from '@playwright/test';

const INDEX_BUDGET_BYTES = 64 * 1024;

test('search returns real hits and the lazily fetched index stays inside its budget', async ({ page }) => {
  const lazyBytes: number[] = [];
  page.on('response', async (response) => {
    if (!response.url().includes('/search-index.json')) return;
    lazyBytes.push((await response.body().catch(() => Buffer.alloc(0))).byteLength);
  });

  await page.goto('/search');
  expect(lazyBytes).toHaveLength(0);

  await page.fill('#search-query', 'governance');
  await page.click('form[data-search] button[type="submit"]');

  await expect(page.locator('[data-search-summary]')).toContainText(/pages match/);
  const hits = page.locator('[data-search-results] li');
  expect(await hits.count()).toBeGreaterThan(0);
  await expect(hits.first().locator('a')).toHaveAttribute('href', /^\//);

  const total = lazyBytes.reduce((sum, bytes) => sum + bytes, 0);
  expect(total).toBeGreaterThan(0);

  const wireBytes = gzipSync(readFileSync(new URL('../dist/search-index.json', import.meta.url))).byteLength;
  expect(wireBytes).toBeLessThan(INDEX_BUDGET_BYTES);
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
