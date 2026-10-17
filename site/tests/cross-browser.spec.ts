import { expect, test } from '@playwright/test';

import { answerTheAnalyticsBeacon } from './analytics-endpoint';
import { routes } from './routes';

const WIDTHS = [375, 1280];

test.describe.configure({ mode: 'parallel' });

for (const route of routes) {
  test(`${route} renders in this engine with no console error and no sideways scroll`, async ({ page }, testInfo) => {
    await answerTheAnalyticsBeacon(page);

    const errors: string[] = [];
    const ownOrigin = (url: string) => url === '' || url.startsWith('http://127.0.0.1');
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (!ownOrigin(message.location().url)) return;
      errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => {
      if (ownOrigin(request.url())) errors.push(`${request.url()} failed: ${request.failure()?.errorText}`);
    });

    const visit = async () => {
      try {
        await page.goto(route, { waitUntil: 'load' });
      } catch (error) {
        if (!/timeout/i.test(String(error))) throw error;
        testInfo.annotations.push({
          type: 'slow-navigation',
          description: `${route} did not reach load; retried on domcontentloaded`,
        });
        await page.goto(route, { waitUntil: 'domcontentloaded' });
      }
    };
    await visit();
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      const measured = await page.evaluate(() => {
        const doc = document.documentElement;
        const widest = [...document.querySelectorAll('body *')]
          .map((el) => ({
            tag: el.tagName,
            cls: String(el.className).slice(0, 40),
            right: el.getBoundingClientRect().right,
          }))
          .filter((box) => box.right > doc.clientWidth + 2)
          .sort((a, b) => b.right - a.right)[0];
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, widest };
      });
      expect(
        measured.scrollWidth - measured.clientWidth,
        `${route} at ${width}px: scrollWidth ${measured.scrollWidth} vs clientWidth ${measured.clientWidth}, widest ${JSON.stringify(measured.widest)}`
      ).toBeLessThanOrEqual(2);
    }

    expect(errors, `${route} logged console errors`).toEqual([]);
  });
}
