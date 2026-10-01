import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { resolveRequest } from './gate-server.mjs';
import {
  SEO_AUDITS_EXCEPT_CRAWLABLE,
  auditableRoutes,
  discoverBuiltRoutes,
  isNoindexByDesign,
  readTouchedRoutes,
  resolveAuditPlan,
  resolveOnlyRoutesPath,
  urlPathOf,
} from './lh-routes.cjs';

const require = createRequire(import.meta.url);

async function fixtureDist(pages) {
  const dir = await mkdtemp(join(tmpdir(), 'lh-routes-'));
  for (const [route, html] of Object.entries(pages)) {
    const file = route === '/' ? 'index.html' : route === '/404' ? '404.html' : `${route.slice(1)}/index.html`;
    await mkdir(join(dir, file, '..'), { recursive: true });
    await writeFile(join(dir, file), html);
  }
  return dir;
}

const weigh = (bytes) => `<html>${'x'.repeat(bytes)}</html>`;

async function touchedFile(content) {
  const dir = await mkdtemp(join(tmpdir(), 'lh-routes-touched-'));
  const path = join(dir, 'touched-routes.json');
  await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}

test('discoverBuiltRoutes reads routes straight from the built html, sorted and deduped, the flat 404 page included', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/404': '<html></html>',
    '/about': '<html></html>',
    '/blog/a-post': '<html></html>',
  });

  assert.deepEqual(discoverBuiltRoutes(dist), ['/', '/404', '/about', '/blog/a-post']);
});

test('discoverBuiltRoutes on a directory that does not exist yields no routes, not a crash', () => {
  assert.deepEqual(discoverBuiltRoutes(join(tmpdir(), 'lh-routes-never-created')), []);
});

test('the styleguide route is excluded from the auditable set by name', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>', '/styleguide': '<html></html>' });

  assert.deepEqual(auditableRoutes(dist), ['/', '/about']);
});

test('every unique page is kept, one per template', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>', '/faq': '<html></html>' });

  assert.deepEqual(auditableRoutes(dist), ['/', '/about', '/faq']);
});

test('a repeated template family keeps only its heaviest leaf, the rest are dropped', async () => {
  const dist = await fixtureDist({
    '/blog': '<html></html>',
    '/blog/a-post': weigh(10),
    '/blog/b-post': weigh(500),
    '/blog/c-post': weigh(50),
  });

  assert.deepEqual(auditableRoutes(dist), ['/blog', '/blog/b-post']);
});

test('a family of exactly one member is audited on its own, not dropped as if it were a repeat', async () => {
  const dist = await fixtureDist({ '/services': '<html></html>', '/services/fractional-caio': '<html></html>' });

  assert.deepEqual(auditableRoutes(dist), ['/services', '/services/fractional-caio']);
});

test('nested families collapse separately, each directory of leaves being its own family', async () => {
  const dist = await fixtureDist({
    '/blog': weigh(12),
    '/blog/category/governance': weigh(20),
    '/blog/category/executive': weigh(25),
    '/case-studies/solo': weigh(15),
  });

  assert.deepEqual(auditableRoutes(dist), ['/blog', '/blog/category/executive', '/case-studies/solo']);
});

test('the derived set ignores dist/gate-routes.json, so a stale or lying file can neither shrink nor widen it', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>' });
  await writeFile(
    join(dist, 'gate-routes.json'),
    JSON.stringify({ routes: ['/ghost'], lighthouseRoutes: ['/ghost'], measured: [{ route: '/about', noindex: true }] })
  );

  assert.deepEqual(auditableRoutes(dist), ['/', '/about']);
});

test('every audited url is answered 200 by the gate server itself, so the url requested is the url Lighthouse reports', async () => {
  const dist = await fixtureDist({
    '/': '<html></html>',
    '/404': '<html></html>',
    '/about': '<html></html>',
    '/blog/a-post': '<html></html>',
  });
  const isFile = (candidate) => existsSync(join(dist, candidate)) && statSync(join(dist, candidate)).isFile();

  for (const route of auditableRoutes(dist)) {
    assert.equal(resolveRequest(urlPathOf(route), isFile).status, 200, route);
  }
});

test('a route named noindex by design is recognised exactly, trailing slash or not, and the pagination families by shape', () => {
  for (const route of [
    '/404',
    '/search',
    '/search/',
    '/blog/category/executive',
    '/blog/category/executive/',
    '/blog/page/2',
    '/blog/page/2/',
    '/blog/category/governance/page/2',
    '/blog/category/governance/page/12/',
  ]) {
    assert.equal(isNoindexByDesign(route), true, route);
  }
});

test('a route that merely resembles a named one is not waived: indexable pages stay graded on is-crawlable', () => {
  for (const route of [
    '/',
    '/about',
    '/blog',
    '/blog/page',
    '/blog/page/',
    '/blog/pages/2',
    '/blog/page/2/extra',
    '/blog/tags',
    '/blog/tag/ai-governance',
    '/blog/category/governance',
    '/blog/category/governance/page',
    '/blog/category/page/2',
    '/search/results',
    '/searching',
    '/404x',
    '/styleguide',
  ]) {
    assert.equal(isNoindexByDesign(route), false, route);
  }
});

test('the per-audit list covers every weighted SEO audit the installed Lighthouse scores, so an upgrade cannot add an unasserted one', async () => {
  const lighthouseConfig = (await import(require.resolve('lighthouse/core/config/default-config.js'))).default;
  const weighted = lighthouseConfig.categories.seo.auditRefs
    .filter((ref) => ref.weight > 0 && ref.id !== 'is-crawlable')
    .map((ref) => ref.id)
    .sort();

  assert.deepEqual([...SEO_AUDITS_EXCEPT_CRAWLABLE].sort(), weighted);
});

test('an unset LH_ONLY_ROUTES is full mode', () => {
  assert.equal(resolveOnlyRoutesPath({}), null);
});

test('an empty-string LH_ONLY_ROUTES is full mode too, the way a CI expression with no value emits it', () => {
  assert.equal(resolveOnlyRoutesPath({ LH_ONLY_ROUTES: '' }), null);
});

test('a set LH_ONLY_ROUTES returns its path unchanged', () => {
  assert.equal(resolveOnlyRoutesPath({ LH_ONLY_ROUTES: '../touched-routes.json' }), '../touched-routes.json');
});

test('readTouchedRoutes refuses a missing file rather than treating it as an empty list', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lh-routes-touched-'));
  assert.throws(() => readTouchedRoutes(join(dir, 'touched-routes.json')), /does not exist/);
});

test('readTouchedRoutes refuses a file that is not valid JSON', async () => {
  const path = await touchedFile('not json');

  assert.throws(() => readTouchedRoutes(path), /not valid JSON/);
});

test('readTouchedRoutes refuses a JSON value that is not an array of route strings', async () => {
  const notAnArray = await touchedFile({ routes: ['/a'] });
  const notAllStrings = await touchedFile(['/a', 7]);

  assert.throws(() => readTouchedRoutes(notAnArray), /array of route strings/);
  assert.throws(() => readTouchedRoutes(notAllStrings), /array of route strings/);
});

test('readTouchedRoutes returns a valid array of routes as-is', async () => {
  const path = await touchedFile(['/blog/a-post', '/about']);

  assert.deepEqual(readTouchedRoutes(path), ['/blog/a-post', '/about']);
});

test('resolveAuditPlan in full mode returns every derived route and records no touched count', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>', '/styleguide': '<html></html>' });

  assert.deepEqual(resolveAuditPlan({ distDir: dist, env: {} }), {
    mode: 'full',
    expected: ['/', '/about'],
    touchedCount: null,
  });
});

test('resolveAuditPlan ignores an empty-string LH_ONLY_ROUTES', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });

  assert.deepEqual(resolveAuditPlan({ distDir: dist, env: { LH_ONLY_ROUTES: '' } }), {
    mode: 'full',
    expected: ['/'],
    touchedCount: null,
  });
});

test('resolveAuditPlan in content mode intersects the touched routes with the built routes', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>', '/faq': '<html></html>' });
  const touched = await touchedFile(['/about', '/does-not-exist']);

  assert.deepEqual(resolveAuditPlan({ distDir: dist, env: { LH_ONLY_ROUTES: touched } }), {
    mode: 'content',
    expected: ['/about'],
    touchedCount: 2,
  });
});

test('resolveAuditPlan in content mode audits a touched leaf that is not its family representative', async () => {
  const dist = await fixtureDist({ '/blog/a-post': weigh(10), '/blog/b-post': weigh(500) });
  const touched = await touchedFile(['/blog/a-post']);

  assert.deepEqual(resolveAuditPlan({ distDir: dist, env: { LH_ONLY_ROUTES: touched } }).expected, ['/blog/a-post']);
});

test('resolveAuditPlan in content mode keeps styleguide excluded even when the touched file names it', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/styleguide': '<html></html>' });
  const touched = await touchedFile(['/styleguide', '/']);

  assert.deepEqual(resolveAuditPlan({ distDir: dist, env: { LH_ONLY_ROUTES: touched } }).expected, ['/']);
});

test('resolveAuditPlan in content mode yields a legitimately empty set when nothing touched is auditable', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });
  const touched = await touchedFile(['/styleguide']);

  assert.deepEqual(resolveAuditPlan({ distDir: dist, env: { LH_ONLY_ROUTES: touched } }), {
    mode: 'content',
    expected: [],
    touchedCount: 1,
  });
});

test('resolveAuditPlan fails loudly when LH_ONLY_ROUTES names a missing file, never silently empty', async () => {
  const dist = await fixtureDist({ '/': '<html></html>' });
  const dir = await mkdtemp(join(tmpdir(), 'lh-routes-touched-'));

  assert.throws(
    () => resolveAuditPlan({ distDir: dist, env: { LH_ONLY_ROUTES: join(dir, 'missing.json') } }),
    /does not exist/
  );
});

test('the count command prints 0 when nothing touched is auditable, so a run can skip lhci instead of crashing it', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/styleguide': '<html></html>' });
  const touched = await touchedFile(['/styleguide']);
  const count = (env) =>
    execFileSync('node', [fileURLToPath(new URL('./lh-routes.cjs', import.meta.url)), '--count', dist], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    }).trim();

  assert.equal(count({ LH_ONLY_ROUTES: touched }), '0');
  assert.equal(count({ LH_ONLY_ROUTES: '' }), '1');
});

test('the count command reads LH_DIST_DIR when no directory is passed, so it counts what lighthouserc will audit', async () => {
  const dist = await fixtureDist({ '/': '<html></html>', '/about': '<html></html>' });
  const count = execFileSync('node', [fileURLToPath(new URL('./lh-routes.cjs', import.meta.url)), '--count'], {
    cwd: tmpdir(),
    env: { ...process.env, LH_DIST_DIR: dist, LH_ONLY_ROUTES: '' },
    encoding: 'utf8',
  }).trim();

  assert.equal(count, '2');
});
