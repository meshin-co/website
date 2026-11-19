import { expect, test, type Page } from '@playwright/test';

import { CHANGELOG } from '../src/utils/spec-changelog.mjs';
import { CITATION_HEADING, LICENCE_LABEL } from '../src/utils/spec-series.mjs';
import { routes } from './routes';

const VERSION_ROUTE = /^\/spec\/[^/]+\/\d+\.\d+$/;
const TEXT_FENCE = /^```text\n([\s\S]*?)\n```$/gm;
const TABLE_ROW = /^\|.*\|$/gm;

const versionRoutes = routes.filter((route) => VERSION_ROUTE.test(route));

const sidecarOf = async (page: Page, route: string) => (await page.request.get(`${route}.md`)).text();

function sectionOf(sidecar: string, heading: string) {
  const start = sidecar.indexOf(`## ${heading}`);
  const next = sidecar.indexOf('\n## ', start + 1);
  return start === -1 ? '' : sidecar.slice(start, next === -1 ? undefined : next);
}

const citationSection = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: CITATION_HEADING }) });

test.describe.configure({ mode: 'parallel' });

test('the build holds a specification version page to check', () => {
  expect(versionRoutes.length, 'no specification version page in dist, so nothing below was checked').toBeGreaterThan(
    0
  );
});

for (const route of versionRoutes) {
  test(`${route} copies each citation block as exactly the citation`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'load' });

    const copied = await citationSection(page)
      .locator('pre')
      .evaluateAll((blocks) =>
        blocks.map((block) => {
          const selection = window.getSelection()!;
          selection.selectAllChildren(block);
          return selection.toString();
        })
      );

    const citations = [...sectionOf(await sidecarOf(page, route), CITATION_HEADING).matchAll(TEXT_FENCE)].map(
      ([, text]) => text
    );
    expect(citations.length, `${route}.md holds the citations the page shows`).toBeGreaterThan(0);
    expect(copied).toEqual(citations);
  });

  test(`${route} states its licence beside the citation, links the text, and says the same in the sidecar`, async ({
    page,
  }) => {
    await page.goto(route, { waitUntil: 'load' });

    const statement = citationSection(page).locator('p', { hasText: LICENCE_LABEL });
    await expect(statement).toHaveCount(1);
    const link = statement.locator('a');
    const href = (await link.getAttribute('href'))!;
    const origin = new URL((await page.locator('link[rel="canonical"]').getAttribute('href'))!).origin;

    const line = sectionOf(await sidecarOf(page, route), CITATION_HEADING).match(
      /^Licence: \[([^\]]+)\]\(([^)]+)\)(.*)$/m
    );
    expect(line, `${route}.md states no licence`).not.toBeNull();
    const [, id, address, rest] = line!;
    expect((await statement.textContent())!.trim()).toBe(`${LICENCE_LABEL}: ${id}${rest}`);
    expect(await link.textContent()).toBe(id);
    expect(new URL(href, origin).href).toBe(address);

    const text = await page.request.get(href);
    expect(text.status(), `${href} answers`).toBe(200);
  });

  test(`${route} dates itself by its changelog, in the page and in the sidecar`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'load' });

    const rows = await page
      .locator(`h2#${CHANGELOG.id} + .table-scroll tbody tr`)
      .evaluateAll((trs) =>
        trs.map((tr) => [...(tr as HTMLTableRowElement).cells].map((cell) => cell.textContent!.trim()))
      );
    expect(rows.length, 'the page lists no changelog row').toBeGreaterThan(0);

    const days = await page
      .locator('p[data-gate-ignore] time')
      .evaluateAll((times) => times.map((time) => time.getAttribute('datetime')));
    const [published, updated] = days;
    expect(rows[0][1], 'the first row is the first publication').toBe(published);
    expect(updated ?? published, 'the last row is the last update').toBe(rows.at(-1)![1]);
    expect(updated !== undefined, 'an update date shows only once a correction is recorded').toBe(rows.length > 1);

    const inSidecar = [...sectionOf(await sidecarOf(page, route), CHANGELOG.heading).matchAll(TABLE_ROW)]
      .map(([row]) =>
        row
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim())
      )
      .filter((cells) => cells[0] !== CHANGELOG.columns[0] && !/^-+$/.test(cells[0]));
    expect(inSidecar).toEqual(rows);
  });
}
