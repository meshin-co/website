import { expect, test } from '@playwright/test';

interface ProbedCard {
  title: string | null;
  reached: Record<string, string | null>;
}

interface ProbedLink {
  href: string | null;
  reached: string | null;
}

const ROUTES = ['/', '/services', '/resources', '/blog', '/blog/tag/ai-governance'];

const probeCards = `(() => {
  const cards = [];
  for (const card of document.querySelectorAll('article')) {
    const title = card.querySelector('h3 a');
    if (!title) continue;
    const top = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - 100, behavior: 'instant' });
    const box = card.getBoundingClientRect();
    const points = {
      topLeftPadding: [box.x + 6, box.y + 6],
      body: [box.x + box.width / 2, box.y + box.height * 0.75],
      bottomRightPadding: [box.right - 6, box.bottom - 6],
    };
    const reached = {};
    for (const [name, [x, y]] of Object.entries(points)) {
      const element = document.elementFromPoint(x, y);
      reached[name] = element ? (element.closest('a')?.getAttribute('href') ?? null) : 'outside the viewport';
    }
    cards.push({ title: title.getAttribute('href'), reached });
  }
  return cards;
})()`;

const probeNestedLinks = `(() => {
  const links = [];
  for (const anchor of document.querySelectorAll('article a[href^="/blog/tag/"], article a[href^="/blog/category/"]')) {
    const top = anchor.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - 200, behavior: 'instant' });
    const box = anchor.getBoundingClientRect();
    const element = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    links.push({ href: anchor.getAttribute('href'), reached: element?.closest('a')?.getAttribute('href') ?? null });
  }
  return links;
})()`;

test.describe.configure({ mode: 'parallel' });

for (const route of ROUTES) {
  test(`every card on ${route} is one tap target, not just its title`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.goto(route, { waitUntil: 'load' });

    const cards = (await page.evaluate(probeCards)) as ProbedCard[];
    expect(cards.length, `${route} renders at least one card with a linked title`).toBeGreaterThan(0);

    for (const card of cards) {
      expect(Object.values(card.reached), `card ${card.title} on ${route}`).toEqual([
        card.title,
        card.title,
        card.title,
      ]);
    }
  });
}

test('a card title link never swallows the category and tag links beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto('/blog', { waitUntil: 'load' });

  const links = (await page.evaluate(probeNestedLinks)) as ProbedLink[];
  expect(links.length, '/blog renders category and tag links inside its cards').toBeGreaterThan(0);

  for (const link of links) {
    expect(link.reached, `nested link ${link.href}`).toBe(link.href);
  }
});
