import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { routes, templates } from './routes';

const themes = ['light', 'dark'] as const;

for (const route of templates) {
  for (const theme of themes) {
    test(`${route} renders as recorded in ${theme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      const height = await page.evaluate(() => Math.floor(document.documentElement.getBoundingClientRect().height));
      const width = page.viewportSize()!.width;

      const name = `${route === '/' ? 'home' : route.slice(1).replace(/\//g, '-')}-${theme}-${testInfo.project.name}.png`;
      await expect(page).toHaveScreenshot(name, {
        fullPage: true,
        clip: { x: 0, y: 0, width, height },
        maxDiffPixelRatio: 0.002,
      });
    });
  }
}

for (const route of routes) {
  for (const theme of themes) {
    test(`${route} has no accessibility violations in ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      expect(violations.map((violation) => `${violation.id}: ${violation.nodes.length} node(s)`)).toEqual([]);
    });
  }
}

test('the skip link is the first thing keyboard focus reaches', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  await expect(page.locator(':focus')).toHaveText('Skip to content');
});
