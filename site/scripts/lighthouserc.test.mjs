import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const CONFIG_PATH = require.resolve('../lighthouserc.cjs');
const { SEO_AUDITS_EXCEPT_CRAWLABLE } = require('./lh-routes.cjs');

const CONFIG_KEYS = [
  'LHCI_FORM_FACTOR',
  'GATE_SERVER_PORT',
  'LH_DIST_DIR',
  'LH_ONLY_ROUTES',
  'LH_SHARD_INDEX',
  'LH_SHARD_TOTAL',
];
const ORIGIN = 'http://127.0.0.1:4330';
const MEDIAN = ['error', { minScore: 1, aggregationMethod: 'median' }];

async function fixtureDist(pages) {
  const dir = await mkdtemp(join(tmpdir(), 'lighthouserc-'));
  for (const [route, html] of Object.entries(pages)) {
    const file = route === '/' ? 'index.html' : route === '/404' ? '404.html' : `${route.slice(1)}.html`;
    await mkdir(join(dir, file, '..'), { recursive: true });
    await writeFile(join(dir, file), html);
  }
  return dir;
}

function loadConfig(env) {
  const saved = Object.fromEntries(CONFIG_KEYS.map((key) => [key, process.env[key]]));
  for (const key of CONFIG_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  delete require.cache[CONFIG_PATH];
  try {
    return require(CONFIG_PATH);
  } finally {
    for (const key of CONFIG_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    delete require.cache[CONFIG_PATH];
  }
}

const groupsFor = (config, url) =>
  config.ci.assert.assertMatrix.filter((group) => new RegExp(group.matchingUrlPattern).test(url));

test('a noindex page that is not named keeps the whole SEO category, so a page cannot waive itself by declaring noindex', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/about': '<html><head><meta name="robots" content="noindex, follow"></head></html>',
  });
  await writeFile(
    join(dist, 'gate-routes.json'),
    JSON.stringify({ routes: ['/', '/about'], measured: [{ route: '/about', noindex: true }] })
  );
  const config = loadConfig({ LH_DIST_DIR: dist });

  const [group, ...others] = groupsFor(config, `${ORIGIN}/about`);
  assert.deepEqual(others, []);
  assert.deepEqual(group.assertions['categories:seo'], MEDIAN);
});

test('every route named noindex by design asserts each SEO audit except is-crawlable, and never the category', async () => {
  const config = loadConfig({ LH_DIST_DIR: await fixtureDist({ '/': '<html></html>' }) });

  for (const path of [
    '/404',
    '/search',
    '/blog/category/executive',
    '/blog/page/2',
    '/blog/category/governance/page/2',
  ]) {
    const [group, ...others] = groupsFor(config, `${ORIGIN}${path}`);
    assert.deepEqual(others, [], path);
    assert.equal(group.assertions['categories:seo'], undefined, path);
    assert.equal(group.assertions['is-crawlable'], undefined, path);
    for (const audit of SEO_AUDITS_EXCEPT_CRAWLABLE)
      assert.deepEqual(group.assertions[audit], MEDIAN, `${path} ${audit}`);
    assert.deepEqual(group.assertions['categories:accessibility'], MEDIAN, path);
  }
});

test('every indexable url falls in exactly one group and is graded on the whole SEO category', async () => {
  const config = loadConfig({ LH_DIST_DIR: await fixtureDist({ '/': '<html></html>' }) });

  for (const path of ['/', '/about', '/blog', '/blog/tag/ai-governance', '/blog/category/governance', '/searching']) {
    const [group, ...others] = groupsFor(config, `${ORIGIN}${path}`);
    assert.deepEqual(others, [], path);
    assert.deepEqual(group.assertions['categories:seo'], MEDIAN, path);
  }
});

test('every assertion aggregates by median, because Lighthouse CI defaults to the best run and one lucky run would pass a route', async () => {
  const config = loadConfig({ LH_DIST_DIR: await fixtureDist({ '/': '<html></html>' }) });

  for (const group of config.ci.assert.assertMatrix) {
    for (const [audit, rule] of Object.entries(group.assertions)) {
      assert.equal(rule[1].aggregationMethod, 'median', audit);
    }
  }
});

test('the three metric budgets and the three categories are asserted on every group, noindex by design or not', async () => {
  const config = loadConfig({ LH_DIST_DIR: await fixtureDist({ '/': '<html></html>' }) });

  for (const group of config.ci.assert.assertMatrix) {
    assert.equal(group.assertions['largest-contentful-paint'][1].maxNumericValue, 1850);
    assert.equal(group.assertions['cumulative-layout-shift'][1].maxNumericValue, 0.02);
    assert.equal(group.assertions['total-blocking-time'][1].maxNumericValue, 50);
    for (const category of ['performance', 'accessibility', 'best-practices']) {
      assert.deepEqual(group.assertions[`categories:${category}`], MEDIAN, category);
    }
  }
});

test('the url list derives from the built html, never from gate-routes.json, and leaves styleguide out', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/404': '<html></html>',
    '/about': '<html></html>',
    '/styleguide': '<html></html>',
  });
  await writeFile(join(dist, 'gate-routes.json'), JSON.stringify({ lighthouseRoutes: ['/ghost'], measured: [] }));

  const config = loadConfig({ LH_DIST_DIR: dist });

  assert.deepEqual(config.ci.collect.url.sort(), [`${ORIGIN}/`, `${ORIGIN}/404`, `${ORIGIN}/about`]);
});

test('the gate server serves the same directory the url list was derived from', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });

  const config = loadConfig({ LH_DIST_DIR: dist, GATE_SERVER_PORT: '4330' });

  assert.equal(config.ci.collect.startServerCommand, `GATE_SERVER_PORT=4330 node scripts/gate-server.mjs ${dist}`);
});

test('sharding applies on top of the derived url list, each shard on its own port, and no route is lost', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/about': '<html></html>',
    '/faq': '<html></html>',
    '/pricing': '<html></html>',
  });

  const shards = [1, 2].map((index) =>
    loadConfig({ LH_DIST_DIR: dist, GATE_SERVER_PORT: '4330', LH_SHARD_INDEX: String(index), LH_SHARD_TOTAL: '2' })
  );

  const paths = shards.flatMap((config) => config.ci.collect.url.map((url) => new URL(url).pathname));
  assert.deepEqual(paths.sort(), ['/', '/about', '/faq', '/pricing']);
  assert.deepEqual(
    shards.map((config) =>
      config.ci.collect.url.every((url) => url.startsWith(`http://127.0.0.1:${4330 + shards.indexOf(config)}/`))
    ),
    [true, true]
  );
});

async function touchedFile(routes) {
  const dir = await mkdtemp(join(tmpdir(), 'lighthouserc-touched-'));
  const path = join(dir, 'touched.json');
  await writeFile(path, JSON.stringify(routes));
  return path;
}

test('LH_ONLY_ROUTES narrows the urls to the listed built routes instead of falling back to everything', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>', '/faq': '<html></html>' });

  const config = loadConfig({ LH_DIST_DIR: dist, LH_ONLY_ROUTES: await touchedFile(['/about']) });

  assert.deepEqual(config.ci.collect.url, [`${ORIGIN}/about`]);
});

test('an empty-string LH_ONLY_ROUTES audits everything, exactly like unset', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>' });

  const config = loadConfig({ LH_DIST_DIR: dist, LH_ONLY_ROUTES: '' });

  assert.equal(config.ci.collect.url.length, 2);
});

test('a planted page that declares its own noindex is graded on the whole SEO category when LH_ONLY_ROUTES names it', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/zz-specimen': '<html><head><meta name="robots" content="noindex, follow"></head></html>',
  });

  const config = loadConfig({ LH_DIST_DIR: dist, LH_ONLY_ROUTES: await touchedFile(['/zz-specimen']) });

  assert.deepEqual(config.ci.collect.url, [`${ORIGIN}/zz-specimen`]);
  const [group, ...others] = groupsFor(config, config.ci.collect.url[0]);
  assert.deepEqual(others, []);
  assert.deepEqual(group.assertions['categories:seo'], MEDIAN);
});

test('an allow-list that names nothing auditable resolves to an empty url list rather than throwing', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/styleguide': '<html></html>' });

  const config = loadConfig({ LH_DIST_DIR: dist, LH_ONLY_ROUTES: await touchedFile(['/styleguide']) });

  assert.deepEqual(config.ci.collect.url, []);
});

test('an LH_ONLY_ROUTES file that does not exist fails loudly instead of silently auditing zero routes', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });
  const dir = await mkdtemp(join(tmpdir(), 'lighthouserc-touched-'));

  assert.throws(() => loadConfig({ LH_DIST_DIR: dist, LH_ONLY_ROUTES: join(dir, 'missing.json') }), /does not exist/);
});
