import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  discoverRoutes,
  diffRoutes,
  assetsOfPage,
  overBudget,
  measureRoute,
  isNoindex,
  lighthouseSet,
  main,
} from './gate.mjs';

async function fixtureDist(pages) {
  const dir = await mkdtemp(join(tmpdir(), 'gate-'));
  for (const [route, html] of Object.entries(pages)) {
    const file = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
    await mkdir(join(dir, file, '..'), { recursive: true });
    await writeFile(join(dir, file), html);
  }
  return dir;
}

test('routes come from the built html, not a hand-written list', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/pricing': '<html></html>',
    '/blog/a-post': '<html></html>',
  });

  assert.deepEqual(await discoverRoutes(dist), ['/', '/blog/a-post', '/pricing']);
});

test('a flat 404.html is measurable, not just discoverable', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'gate-'));
  await writeFile(join(dist, '404.html'), '<html><link rel="stylesheet" href="/_astro/a.css"></html>');
  await mkdir(join(dist, '_astro'), { recursive: true });
  await writeFile(join(dist, '_astro/a.css'), 'body{color:red}');

  assert.deepEqual(await discoverRoutes(dist), ['/404']);

  test('lighthouse audits every unique page and only the heaviest leaf of each repeated family', () => {
    const measured = [
      { route: '/', page: 10 },
      { route: '/blog', page: 12 },
      { route: '/blog/short-post', page: 10 },
      { route: '/blog/long-post', page: 30 },
      { route: '/blog/third-post', page: 20 },
      { route: '/glossary/one', page: 5 },
      { route: '/pricing', page: 9 },
    ];

    assert.deepEqual(lighthouseSet(measured).sort(), ['/', '/blog', '/blog/long-post', '/glossary/one', '/pricing']);
  });

  test('a family with a single leaf is audited as itself, and nested families collapse separately', () => {
    const measured = [
      { route: '/blog', page: 12 },
      { route: '/blog/category/governance', page: 20 },
      { route: '/blog/category/executive', page: 25 },
      { route: '/case-studies/solo', page: 15 },
    ];

    assert.deepEqual(lighthouseSet(measured).sort(), ['/blog', '/blog/category/executive', '/case-studies/solo']);
  });
  const measured = await measureRoute(dist, '/404');
  assert.ok(measured.css > 0, 'stylesheet bytes charged to the route');
  assert.ok(measured.page > measured.css, 'page total includes the html itself');
});

test('a route disappearing between phases is a gate failure', () => {
  const diff = diffRoutes(['/', '/pricing'], ['/']);

  assert.deepEqual(diff.removed, ['/pricing']);
  assert.equal(diff.ok, false);
});

test('new routes are allowed and reported', () => {
  const diff = diffRoutes(['/'], ['/', '/pricing']);

  assert.deepEqual(diff.added, ['/pricing']);
  assert.equal(diff.ok, true);
});

test('assets of a page include stylesheets, scripts and modulepreloads', () => {
  const html = `<link rel="stylesheet" href="/_astro/a.css"><script src="/_astro/b.js"></script><link rel="modulepreload" href="/_astro/c.js">`;

  assert.deepEqual(assetsOfPage(html), ['/_astro/a.css', '/_astro/b.js', '/_astro/c.js']);
});

test('external assets are not charged to the page budget', () => {
  const html = `<script src="https://plausible.io/js/script.js"></script>`;

  assert.deepEqual(assetsOfPage(html), []);
});

test('a route over any budget is reported with the measured bytes', () => {
  const findings = overBudget(
    { route: '/', js: 11000, css: 1000, page: 1000 },
    { js: 10240, css: 20480, page: 256000 }
  );

  assert.equal(findings.length, 1);
  assert.match(findings[0], /^\/ js 11000 > 10240$/);
});

test('a route inside every budget reports nothing', () => {
  assert.deepEqual(overBudget({ route: '/', js: 1, css: 1, page: 1 }, { js: 10240, css: 20480, page: 256000 }), []);
});

test('a page carrying meta robots noindex is detected', () => {
  const html = '<html><head><meta name="robots" content="noindex, follow"></head></html>';

  assert.equal(isNoindex(html), true);
});

test('an indexable page is not reported as noindex', () => {
  assert.equal(isNoindex('<html><head><meta name="robots" content="index, follow"></head></html>'), false);
  assert.equal(isNoindex('<html><head></head></html>'), false);
});

test('a route with its own declared budget is judged against that budget', () => {
  const budgets = { js: 10240, css: 20480, page: 256000, routes: { '/search': { js: 61440 } } };

  assert.deepEqual(overBudget({ route: '/search', js: 40000, css: 1000, page: 60000 }, budgets), []);
  assert.deepEqual(overBudget({ route: '/', js: 40000, css: 1000, page: 60000 }, budgets), ['/ js 40000 > 10240']);
});

test('an override raises only the keys it names', () => {
  const budgets = { js: 10240, css: 20480, page: 256000, routes: { '/search': { js: 61440 } } };

  assert.deepEqual(overBudget({ route: '/search', js: 40000, css: 30000, page: 60000 }, budgets), [
    '/search css 30000 > 20480',
  ]);
});

test('the development-only styleguide is not audited, because nothing there competes for a query', () => {
  const measured = [
    { route: '/', page: 100, noindex: false },
    { route: '/styleguide', page: 300, noindex: true },
    { route: '/about', page: 120, noindex: false },
  ];
  assert.deepEqual(lighthouseSet(measured).sort(), ['/', '/about']);
});

test('every other noindex route stays audited, so the exclusion cannot widen', () => {
  const measured = [
    { route: '/404', page: 90, noindex: true },
    { route: '/search', page: 95, noindex: true },
  ];
  assert.deepEqual(lighthouseSet(measured).sort(), ['/404', '/search']);
});

test('gate-routes.json carries the over-budget findings the gate already computed', async () => {
  const dist = await fixtureDist({ '/': `<html><body>${'x'.repeat(50)}</body></html>` });
  const budgetPath = join(dist, 'budgets.json');
  await writeFile(budgetPath, JSON.stringify({ js: 10240, css: 20480, page: 10 }));

  await main(dist, budgetPath);
  process.exitCode = 0;
  const written = JSON.parse(await readFile(join(dist, 'gate-routes.json'), 'utf8'));

  assert.equal(written.overBudget.length, 1);
  assert.match(written.overBudget[0], /^\/ page \d+ > 10$/);
});

test('gate-routes.json reports no over-budget findings when every route is inside its budget', async () => {
  const dist = await fixtureDist({ '/': '<html><body>ok</body></html>' });
  const budgetPath = join(dist, 'budgets.json');
  await writeFile(budgetPath, JSON.stringify({ js: 10240, css: 20480, page: 256000 }));

  await main(dist, budgetPath);
  const written = JSON.parse(await readFile(join(dist, 'gate-routes.json'), 'utf8'));

  assert.deepEqual(written.overBudget, []);
});
