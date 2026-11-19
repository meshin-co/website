import { expect, test } from '@playwright/test';

import { routes } from './routes';

const VERSION_ROUTE = /^\/spec\/[^/]+\/\d+\.\d+$/;
const SCHEMES = ['light', 'dark'] as const;

const versionRoutes = routes.filter((route) => VERSION_ROUTE.test(route));

test.describe.configure({ mode: 'parallel' });

test('the build holds a specification version page to check', () => {
  expect(versionRoutes.length, 'no specification version page in dist, so nothing below was checked').toBeGreaterThan(
    0
  );
});

for (const route of versionRoutes) {
  for (const scheme of SCHEMES) {
    test(`${route} shows every block that holds JSON in colour, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(route, { waitUntil: 'load' });
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(scheme === 'dark');

      const blocks = await page.locator('pre').evaluateAll((pres) => {
        const parsesAsObject = (source: string) => {
          try {
            const value: unknown = JSON.parse(source);
            return typeof value === 'object' && value !== null;
          } catch {
            return false;
          }
        };
        return pres
          .map((pre) => {
            const text = pre.textContent ?? '';
            const base = getComputedStyle(pre).color;
            const tokens = [...pre.querySelectorAll('span')].filter((span) =>
              [...span.classList].some((name) => name.startsWith('pl-'))
            );
            return {
              text: text.slice(0, 60),
              holdsJson: parsesAsObject(text) || parsesAsObject(`{${text}}`),
              coloured: tokens.some((token) => getComputedStyle(token).color !== base),
            };
          })
          .filter((block) => block.holdsJson);
      });

      expect(blocks.length, `${route} shows no block that holds JSON, so no colour was checked`).toBeGreaterThan(0);
      expect(blocks.filter((block) => !block.coloured).map((block) => block.text)).toEqual([]);
    });
  }
}
