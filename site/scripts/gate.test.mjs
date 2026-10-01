import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { discoverRoutes, diffRoutes, assetsOfPage, overBudget, measureRoute, isNoindex, main } from './gate.mjs';

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
  assert.deepEqual(
    overBudget(
      { route: '/', js: 1, css: 1, page: 1, fonts: 1 },
      { js: 10240, css: 20480, page: 256000, fonts: 122880 }
    ),
    []
  );
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
  await mkdir(join(dist, '_astro/fonts'), { recursive: true });
  await writeFile(join(dist, '_astro/fonts/a.woff2'), 'a'.repeat(1000));
  const budgetPath = join(dist, 'budgets.json');
  await writeFile(budgetPath, JSON.stringify({ js: 10240, css: 20480, page: 256000, fonts: 122880 }));

  await main(dist, budgetPath);
  const written = JSON.parse(await readFile(join(dist, 'gate-routes.json'), 'utf8'));

  assert.deepEqual(written.overBudget, []);
});

test('the woff2 files under _astro/fonts are measured raw, not gzipped, because font bytes are the shipped bytes', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });
  await mkdir(join(dist, '_astro/fonts'), { recursive: true });
  await writeFile(join(dist, '_astro/fonts/a.woff2'), 'a'.repeat(29732));
  await writeFile(join(dist, '_astro/fonts/b.woff'), 'b'.repeat(39128));
  await writeFile(join(dist, '_astro/fonts/notes.txt'), 'c'.repeat(500));

  const measured = await measureRoute(dist, '/');
  assert.equal(measured.fonts, 68860);
});

test('fonts over the fonts budget fail the gate on every route, because the figure is site-wide', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>' });
  await mkdir(join(dist, '_astro/fonts'), { recursive: true });
  await writeFile(join(dist, '_astro/fonts/a.woff2'), 'a'.repeat(3000));
  const budgetPath = join(dist, 'budgets.json');
  await writeFile(budgetPath, JSON.stringify({ js: 10240, css: 20480, page: 256000, fonts: 2048 }));

  await main(dist, budgetPath);
  const exitCode = process.exitCode;
  process.exitCode = 0;
  const written = JSON.parse(await readFile(join(dist, 'gate-routes.json'), 'utf8'));

  assert.deepEqual(
    written.measured.map((row) => row.fonts),
    [3000, 3000]
  );
  assert.deepEqual(written.overBudget, ['/ fonts 3000 > 2048', '/about fonts 3000 > 2048']);
  assert.equal(exitCode, 1);
});

test('a fonts budget with no font file to measure is a finding, because 0 bytes would pass for a build that moved its fonts', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });
  const budgetPath = join(dist, 'budgets.json');
  await writeFile(budgetPath, JSON.stringify({ js: 10240, css: 20480, page: 256000, fonts: 122880 }));

  await main(dist, budgetPath);
  process.exitCode = 0;
  const written = JSON.parse(await readFile(join(dist, 'gate-routes.json'), 'utf8'));

  assert.equal(written.overBudget.length, 1);
  assert.match(written.overBudget[0], /fonts.*measured 0 bytes/);
});
