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

test('keyboard focus walks the closed mobile bar in the order it reads: logo, booking button, menu toggle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  await page.locator('header#header a[href="/"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', BOOKING_URL);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-aw-toggle-menu', '');
});

test('focus moves from the open menu toggle straight into the menu links', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  const toggle = page.locator('[data-aw-toggle-menu]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');

  await expect(page.locator(':focus')).toHaveAttribute('href', '/services');
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

const PHONE_WIDTHS = [320, 375, 430, 768, 1023];
const BAR = 'header#header > div.relative';

const barGeometry = (page: import('@playwright/test').Page) =>
  page.evaluate(
    ([barSelector, buttonSelector]) => {
      const rect = (element: Element | null) => {
        const box = element!.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        };
      };
      const bar = document.querySelector(barSelector)!;
      const style = getComputedStyle(bar);
      const barBox = rect(bar);
      return {
        bar: barBox,
        contentLeft: barBox.left + parseFloat(style.paddingLeft),
        contentRight: barBox.right - parseFloat(style.paddingRight),
        logo: rect(bar.querySelector('a[href="/"]')),
        button: rect(document.querySelector(buttonSelector)),
        toggle: rect(document.querySelector('[data-aw-toggle-menu]')),
        icon: document.querySelector(`${buttonSelector} svg`)
          ? rect(document.querySelector(`${buttonSelector} svg`))
          : null,
      };
    },
    [BAR, HEADER_BUTTON]
  );

for (const width of PHONE_WIDTHS) {
  test(`at ${width}px the hamburger sits on the right edge of the bar and the booking button on its centre`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/', { waitUntil: 'load' });

    const g = await barGeometry(page);
    expect(g.toggle.right, 'hamburger touches the right padding edge').toBeCloseTo(g.contentRight, 0);
    expect(g.toggle.left, 'hamburger is right of the button').toBeGreaterThanOrEqual(g.button.right);
    const buttonCentre = (g.button.left + g.button.right) / 2;
    const barCentre = (g.bar.left + g.bar.right) / 2;
    expect(Math.abs(buttonCentre - barCentre), 'button centre is the bar centre').toBeLessThanOrEqual(0.5);
    expect(g.logo.right, 'logo stays left of the button').toBeLessThanOrEqual(g.button.left);
    expect(g.logo.left, 'logo sits on the left padding edge').toBeCloseTo(g.contentLeft, 0);
  });
}

for (const width of PHONE_WIDTHS) {
  test(`at ${width}px the booking button carries a visible calendar icon before its label`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/', { waitUntil: 'load' });

    const g = await barGeometry(page);
    expect(g.icon, 'the icon is rendered inside the button').not.toBeNull();
    expect(g.icon!.width).toBeGreaterThanOrEqual(16);
    expect(g.icon!.left, 'icon is inside the button').toBeGreaterThanOrEqual(g.button.left);
    expect(g.icon!.right, 'icon is inside the button').toBeLessThanOrEqual(g.button.right);
    const label = await page.locator(HEADER_BUTTON).evaluate((anchor) => {
      const range = document.createRange();
      range.selectNodeContents(Array.from(anchor.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)!);
      return range.getBoundingClientRect().left;
    });
    expect(g.icon!.right, 'icon precedes the label').toBeLessThanOrEqual(label + 0.5);
  });
}

test('the desktop bar keeps its button without the icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'load' });

  await expect(page.locator(HEADER_BUTTON)).toBeVisible();
  await expect(page.locator(`${HEADER_BUTTON} svg`)).toBeHidden();
});

test('both mobile bar controls stay large enough to hit', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  const g = await barGeometry(page);
  expect(g.toggle.width).toBeGreaterThanOrEqual(44);
  expect(g.toggle.height).toBeGreaterThanOrEqual(44);
  expect(g.button.height).toBeGreaterThanOrEqual(40);
});

test('the open menu keeps the button on the centre and fits the theme toggle without overlap', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/', { waitUntil: 'load' });

  const closed = await barGeometry(page);
  await page.locator('[data-aw-toggle-menu]').click();
  const theme = page.locator('[data-aw-toggle-color-scheme]');
  await expect(theme).toBeVisible();

  const open = await barGeometry(page);
  expect(open.button.left, 'the button does not move sideways when the menu opens').toBeCloseTo(closed.button.left, 0);
  expect(open.toggle.right).toBeCloseTo(closed.toggle.right, 0);

  const box = (await theme.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(40);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  const overlapsBarRow = box.y < open.bar.bottom;
  expect(overlapsBarRow, 'the theme toggle leaves the bar row to the three bar controls').toBe(false);
});
