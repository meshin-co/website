import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { readReports, renderReport } from './report.mjs';

const row = (route, scores, runs = 3) => ({ route, runs, scores });
const perfect = { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };
const gate = { routes: ['/'], measured: [{ route: '/', js: 1108, css: 18921, page: 26195 }], overBudget: [] };

test('a clean run reports PASS', () => {
  const { markdown, failures } = renderReport({
    phase: '1',
    gate,
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
    mobile: [row('/', perfect, 1)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile /: 1 runs, gate requires 3']);
});

test('an over-budget route fails the report', () => {
  const { failures } = renderReport({
    phase: '1',
    gate: { ...gate, overBudget: ['/ css 21000 > 20480'] },
    mobile: [row('/', perfect)],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['budget: / css 21000 > 20480']);
});

test('the report carries no waiver or deferral vocabulary', () => {
  const { markdown } = renderReport({ phase: '1', gate, mobile: [row('/', perfect)], desktop: [row('/', perfect)] });

  assert.doesNotMatch(markdown, /waiver|waived|known issue|next phase|accepted/i);
});

test('a form factor missing a derived route is a failure, not an empty table', () => {
  const { failures } = renderReport({
    phase: '1',
    gate: { routes: ['/', '/404'], measured: [{ route: '/', js: 1, css: 1, page: 1 }], overBudget: [] },
    mobile: [],
    desktop: [row('/', perfect), row('/404', perfect)],
  });

  assert.deepEqual(failures, ['mobile: no Lighthouse run for /', 'mobile: no Lighthouse run for /404']);
});

test('SEO is not graded on a noindex route, but everything else still is', () => {
  const noindexGate = {
    routes: ['/styleguide'],
    measured: [{ route: '/styleguide', js: 1, css: 1, page: 1, noindex: true }],
    overBudget: [],
  };

  const clean = renderReport({
    phase: '2',
    gate: noindexGate,
    mobile: [row('/styleguide', { ...perfect, seo: 66 })],
    desktop: [row('/styleguide', { ...perfect, seo: 66 })],
  });

  assert.deepEqual(clean.failures, []);
  assert.match(clean.markdown, /n\/a \(noindex\)/);

  const broken = renderReport({
    phase: '2',
    gate: noindexGate,
    mobile: [row('/styleguide', { ...perfect, seo: 66, accessibility: 98 })],
    desktop: [row('/styleguide', { ...perfect, seo: 66 })],
  });

  assert.deepEqual(broken.failures, ['mobile /styleguide accessibility: 98']);
});

test('SEO is still graded on an indexable route', () => {
  const { failures } = renderReport({
    phase: '2',
    gate,
    mobile: [row('/', { ...perfect, seo: 66 })],
    desktop: [row('/', perfect)],
  });

  assert.deepEqual(failures, ['mobile / seo: 66']);
});

test('a trailing slash on a Lighthouse route still matches the gate route it came from', () => {
  const { markdown } = renderReport({
    phase: '2',
    gate: { routes: ['/', '/styleguide'], measured: [{ route: '/styleguide', js: 1, css: 1, page: 1, noindex: true }] },
    mobile: [
      { route: '/', runs: 3, scores: { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 } },
      {
        route: '/styleguide/',
        runs: 3,
        scores: { performance: 100, accessibility: 100, 'best-practices': 100, seo: 66 },
      },
    ],
    desktop: [
      { route: '/', runs: 3, scores: { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 } },
      {
        route: '/styleguide/',
        runs: 3,
        scores: { performance: 100, accessibility: 100, 'best-practices': 100, seo: 66 },
      },
    ],
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
