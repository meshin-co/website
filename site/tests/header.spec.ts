import { expect, test } from '@playwright/test';

import { BOOKING_URL } from '../src/utils/booking.mjs';

const ROUTES = ['/', '/glossary/ai-register', '/imprint'];
const WIDTHS = [320, 375, 768, 1023, 1024, 1440];
const HEADER_BUTTON = 'header#header a[href^="https://cal.com/"]';

test.describe.configure({ mode: 'parallel' });

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`${route} shows the header booking button at ${width}px without opening the menu`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route, { waitUntil: 'load' });

      const button = page.locator(HEADER_BUTTON);
      await expect(button).toBeVisible();

      const box = await button.boundingBox();
      expect(box!.x, 'starts inside the viewport').toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, 'ends inside the viewport').toBeLessThanOrEqual(width);

      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(sideways, 'the header adds no sideways scroll').toBeLessThanOrEqual(0);
    });
  }
}

test('the header button books the 30-minute event and carries the external rel', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  const button = page.locator(HEADER_BUTTON);
  await expect(button).toHaveAttribute('href', BOOKING_URL);
  await expect(button).toHaveAttribute('rel', 'nofollow noopener noreferrer');
});

test('the button is the next tab stop after the menu toggle while the menu is closed', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  await page.locator('[data-aw-toggle-menu]').focus();
  await page.keyboard.press('Tab');

  await expect(page.locator(':focus')).toHaveAttribute('href', BOOKING_URL);
});

test('opening the menu adds the theme toggle and keeps the booking button in the header row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  const extras = page.locator('[data-aw-menu-extra]');
  const button = page.locator(HEADER_BUTTON);
  const toggle = page.locator('[data-aw-toggle-menu]');

  await expect(extras).toBeHidden();
  const closedTop = (await button.boundingBox())!.y;

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(extras).toBeVisible();
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.y, 'the button does not move when the menu opens').toBe(closedTop);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(extras).toBeHidden();
  await expect(button).toBeVisible();
});
