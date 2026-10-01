import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  assertedFamilies,
  byteBudgetSentence,
  byteBudgets,
  categoryScore,
  metricBudgets,
  metricFailures,
  readReports,
  renderReport,
} from './report.mjs';
import { overBudget } from './gate.mjs';
import { NOINDEX_BY_DESIGN } from './lh-routes.cjs';

const row = (route, scores, runs = 3) => ({ route, runs, scores });
const perfect = { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };
const gate = { routes: ['/'], measured: [{ route: '/', js: 1108, css: 18921, page: 26195 }], overBudget: [] };

test('a clean run reports PASS', () => {
  const { markdown, failures } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, []);
  assert.match(markdown, /Result: PASS/);
});

test('a 99 anywhere is a failure, not a footnote', () => {
  const { markdown, failures } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', { ...perfect, performance: 99 })],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile / performance: 99']);
  assert.match(markdown, /Result: FAIL/);
});

test('fewer than three runs is a failure even when every score is 100', () => {
  const { failures } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', perfect, 1)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile /: 1 runs, gate requires 3']);
});

test('an over-budget route fails the report', () => {
  const { failures } = renderReport({
    phase: '1',
    gate: { ...gate, overBudget: ['/ css 21000 > 20480'] },
    expectedRoutes: ['/'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['budget: / css 21000 > 20480']);
});

test('the report carries no waiver or deferral vocabulary', () => {
  const { markdown } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.doesNotMatch(markdown, /waiver|waived|known issue|next phase|accepted/i);
});

test('a form factor missing a derived route is a failure, not an empty table', () => {
  const { failures } = renderReport({
    phase: '1',
    gate: { routes: ['/', '/404'], measured: [{ route: '/', js: 1, css: 1, page: 1 }], overBudget: [] },
    expectedRoutes: ['/', '/404'],
    mobile: [],
    desktop: [row('/', perfect), row('/404', perfect)],
  });

  assert.deepEqual(failures, ['mobile: no Lighthouse run for /', 'mobile: no Lighthouse run for /404']);
});

test('renderReport refuses to run without an explicit expectedRoutes list, so nothing can fall back to gate-routes.json', () => {
  assert.throws(
    () => renderReport({ phase: '1', gate, mobile: [row('/', perfect)], desktop: [row('/', perfect)] }),
    /expectedRoutes is required/
  );
});

test('the expected route list drives the floor, never gate.routes or gate.lighthouseRoutes, so a stale gate-routes.json cannot hide a gap', () => {
  const staleGate = { routes: ['/totally-unrelated'], lighthouseRoutes: [], measured: [], overBudget: [] };

  const { failures } = renderReport({
    phase: '1',
    gate: staleGate,
    expectedRoutes: ['/', '/about'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile: no Lighthouse run for /about', 'desktop: no Lighthouse run for /about']);
});

test('an empty expected set is a failure, because a gate that audited nothing has proved nothing', () => {
  const { failures } = renderReport({ phase: '1', gate, expectedRoutes: [], mobile: [], desktop: [] });

  assert.deepEqual(failures, ['no routes to audit: the built html yielded an empty Lighthouse set']);
});

test('the markdown names how many routes it expected, so a shrunken scope is visible', () => {
  const { markdown } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.match(markdown, /Lighthouse scope: 1 route\(s\) expected/);
});

test('the markdown names every route scored without is-crawlable, taken from the list the assertions use', () => {
  const { markdown } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  for (const entry of NOINDEX_BY_DESIGN) assert.ok(markdown.includes(`\`${entry}\``), entry);
});

test('a noindex flag in gate-routes.json waives nothing: categories:seo is graded on that route like any other', () => {
  const { markdown, failures } = renderReport({
    phase: '2',
    gate: {
      routes: ['/about'],
      measured: [{ route: '/about', js: 1, css: 1, page: 1, noindex: true }],
      overBudget: [],
    },
    expectedRoutes: ['/about'],
    mobile: [row('/about', { ...perfect, seo: 66 })],
    desktop: [row('/about', { ...perfect, seo: 66 })],
  });

  assert.deepEqual(failures, ['mobile /about seo: 66', 'desktop /about seo: 66']);
  assert.doesNotMatch(markdown, /n\/a \(noindex\)/);
  assert.match(markdown, /\| mobile \| `\/about` \| 100 \| 100 \| 100 \| 66 \|/);
});

const seoRun = (failing = []) => ({
  categories: {
    performance: { score: 0.97 },
    seo: {
      score: 0.33,
      auditRefs: [
        { id: 'is-crawlable', weight: 4.04 },
        { id: 'meta-description', weight: 1 },
        { id: 'document-title', weight: 1 },
        { id: 'hreflang', weight: 1 },
        { id: 'structured-data', weight: 0 },
      ],
    },
  },
  audits: {
    'is-crawlable': { score: 0, scoreDisplayMode: 'binary' },
    'meta-description': { score: failing.includes('meta-description') ? 0 : 1, scoreDisplayMode: 'binary' },
    'document-title': { score: 1, scoreDisplayMode: 'binary' },
    hreflang: { score: null, scoreDisplayMode: 'notApplicable' },
    'structured-data': { score: null, scoreDisplayMode: 'manual' },
  },
});

test('a route named noindex by design scores SEO without is-crawlable, and only that audit', () => {
  assert.equal(categoryScore(seoRun(), 'seo', '/404'), 100);
  assert.equal(categoryScore(seoRun(), 'seo', '/search/'), 100);
  assert.equal(categoryScore(seoRun(), 'seo', '/blog/category/executive/'), 100);
  assert.equal(categoryScore(seoRun(), 'seo', '/blog/page/2/'), 100);
});

test('a route named noindex by design still fails SEO on any other audit', () => {
  assert.equal(categoryScore(seoRun(['meta-description']), 'seo', '/search'), 50);
});

test('any route not named keeps the whole SEO category as Lighthouse scored it, noindex or not', () => {
  assert.equal(categoryScore(seoRun(), 'seo', '/about'), 33);
  assert.equal(categoryScore(seoRun(), 'seo', '/blog/tag/ai-governance/'), 33);
});

test('a named route changes only the SEO category: every other category is exactly as Lighthouse scored it', () => {
  assert.equal(categoryScore(seoRun(), 'performance', '/search'), 97);
});

test('SEO is still graded on an indexable route', () => {
  const { failures } = renderReport({
    phase: '2',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', { ...perfect, seo: 66 })],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile / seo: 66']);
});

test('a trailing slash on a Lighthouse route still matches the expected route it came from', () => {
  const { markdown } = renderReport({
    phase: '2',
    gate: { routes: ['/', '/about'], measured: [], overBudget: [] },
    expectedRoutes: ['/', '/about'],
    mobile: [row('/', perfect), row('/about/', perfect)],
    desktop: [row('/', perfect), row('/about/', perfect)],
  });

  assert.match(markdown, /Result: PASS/);
});

const lighthouseRun = (path) => ({
  finalUrl: `http://127.0.0.1:4330${path}`,
  categories: {
    performance: { score: 1 },
    accessibility: { score: 1 },
    'best-practices': { score: 1 },
    seo: { score: 1 },
  },
});

test('reports collected into per-shard subdirectories are all read', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'report-shards-')), 'lh-mobile');
  await mkdir(join(dir, 'shard-1'), { recursive: true });
  await mkdir(join(dir, 'shard-2'), { recursive: true });
  await writeFile(join(dir, 'shard-1', 'lhr-1.json'), JSON.stringify(lighthouseRun('/')));
  await writeFile(join(dir, 'shard-2', 'lhr-2.json'), JSON.stringify(lighthouseRun('/about/')));

  const reports = await readReports(dir);
  assert.deepEqual(reports.map((report) => new URL(report.finalUrl).pathname).sort(), ['/', '/about/']);
});

test('a flat directory of reports still reads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'report-flat-'));
  await writeFile(join(dir, 'lhr-1.json'), JSON.stringify(lighthouseRun('/')));
  assert.equal((await readReports(dir)).length, 1);
});

test('a metric over its budget is a failure even when every category scores 100', () => {
  const failures = metricFailures(
    [
      {
        formFactor: 'mobile',
        route: '/',
        metrics: { 'largest-contentful-paint': [1804, 1805, 1806] },
      },
    ],
    { 'largest-contentful-paint': 1800 }
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /largest-contentful-paint/);
  assert.match(failures[0], /1805/);
});

test('a metric inside its budget passes, and the median decides', () => {
  assert.deepEqual(
    metricFailures(
      [{ formFactor: 'mobile', route: '/', metrics: { 'largest-contentful-paint': [1650, 1656, 1900] } }],
      { 'largest-contentful-paint': 1800 }
    ),
    []
  );
});

test('a metric over its budget fails the report while every category reads 100, and the median run decides', async () => {
  const budgets = await metricBudgets();
  const withLcp = (values) => ({ ...row('/', perfect), metrics: { 'largest-contentful-paint': values } });
  const render = (values) =>
    renderReport({
      phase: '1',
      gate,
      expectedRoutes: ['/'],
      budgets,
      mobile: [withLcp(values)],
      desktop: [row('/', perfect)],
    }).failures;

  assert.deepEqual(render([1000, 2400, 2500]), ['metric: mobile / largest-contentful-paint: 2400 over budget 1850']);
  assert.deepEqual(render([1000, 1100, 2400]), []);
});

test('the budgets come from the lighthouse config, not from a copy in the report generator', async () => {
  const budgets = await metricBudgets();
  assert.equal(budgets['largest-contentful-paint'], 1850);
  assert.equal(budgets['cumulative-layout-shift'], 0.02);
  assert.equal(budgets['total-blocking-time'], 50);
});

test('byteBudgetSentence renders whatever limits it is given, not a fixed string', () => {
  assert.equal(byteBudgetSentence({ js: 1, css: 2, page: 3 }), 'Budgets: JS ≤1 · CSS ≤2 · page ≤3 bytes gzip.');
});

test('byteBudgetSentence names the fonts limit in raw bytes, because woff2 is already compressed', () => {
  assert.equal(
    byteBudgetSentence({ js: 1, css: 2, page: 3, fonts: 4 }),
    'Budgets: JS ≤1 · CSS ≤2 · page ≤3 bytes gzip · fonts ≤4 bytes raw.'
  );
});

test('the printed byte-budget sentence comes from budgets.json, not a hardcoded copy', async () => {
  const limits = byteBudgets();
  assert.deepEqual(limits, { js: 10240, css: 20480, page: 256000, fonts: 122880 });

  const { markdown } = renderReport({
    phase: '1',
    gate,
    expectedRoutes: ['/'],
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
    byteBudgets: limits,
  });
  assert.match(markdown, /Budgets: JS ≤10240 · CSS ≤20480 · page ≤256000 bytes gzip · fonts ≤122880 bytes raw\./);
});

test('a measured row that exceeds a real budgets.json limit fails the report end to end', async () => {
  const limits = byteBudgets();
  const measured = { route: '/heavy', js: limits.js + 1, css: 100, page: 200 };
  const findings = overBudget(measured, limits);

  const { failures } = renderReport({
    phase: '1',
    gate: { routes: ['/heavy'], measured: [measured], overBudget: findings },
    expectedRoutes: ['/heavy'],
    mobile: [row('/heavy', perfect)],
    desktop: [row('/heavy', perfect)],
  });

  assert.deepEqual(failures, [`budget: /heavy js ${limits.js + 1} > ${limits.js}`]);
});

test('a measured row whose fonts exceed the real fonts limit fails the report end to end', async () => {
  const limits = byteBudgets();
  const measured = { route: '/heavy', js: 1, css: 1, page: 1, fonts: limits.fonts + 1 };
  const findings = overBudget(measured, limits);

  const { failures } = renderReport({
    phase: '1',
    gate: { routes: ['/heavy'], measured: [measured], overBudget: findings },
    expectedRoutes: ['/heavy'],
    mobile: [row('/heavy', perfect)],
    desktop: [row('/heavy', perfect)],
  });

  assert.deepEqual(failures, [`budget: /heavy fonts ${limits.fonts + 1} > ${limits.fonts}`]);
});

test('the measured byte table prints the font bytes the gate measured, not a typed figure', () => {
  const render = (fonts) => {
    const measured = [{ route: '/', js: 1108, css: 18921, page: 26195, fonts }];
    const { markdown } = renderReport({
      phase: '1',
      gate: { routes: ['/'], measured, overBudget: [] },
      expectedRoutes: ['/'],
      mobile: [row('/', perfect)],
      desktop: [row('/', perfect)],
      byteBudgets: byteBudgets(),
    });
    return markdown;
  };

  assert.match(render(64868), /^\| `\/` \| 1108 \| 18921 \| 26195 \| 64868 \|$/m);
  assert.match(render(70001), /^\| `\/` \| 1108 \| 18921 \| 26195 \| 70001 \|$/m);
});

test('a measured row inside every real budgets.json limit produces no budget failure', async () => {
  const limits = byteBudgets();
  const measured = { route: '/light', js: 1, css: 1, page: 1, fonts: 1 };
  const findings = overBudget(measured, limits);

  const { failures } = renderReport({
    phase: '1',
    gate: { routes: ['/light'], measured: [measured], overBudget: findings },
    expectedRoutes: ['/light'],
    mobile: [row('/light', perfect)],
    desktop: [row('/light', perfect)],
  });

  assert.deepEqual(
    failures.filter((failure) => failure.startsWith('budget:')),
    []
  );
});

test('a report names the assertion families it actually ran, so a dead assertion cannot read as a pass', () => {
  const withBytes = assertedFamilies({ overBudget: [] });
  const withoutBytes = assertedFamilies({});
  assert.ok(withBytes.includes('byte budgets'));
  assert.ok(!withoutBytes.includes('byte budgets'));
});

test('the rendered report carries the revision it was generated from', () => {
  const { markdown } = renderReport({
    phase: '9',
    gate: { routes: [], measured: [], overBudget: [] },
    expectedRoutes: [],
    mobile: [],
    desktop: [],
    generator: 'abc1234',
  });
  assert.match(markdown, /Generated-from: abc1234/);
  assert.match(markdown, /Asserted: .*byte budgets/);
});
