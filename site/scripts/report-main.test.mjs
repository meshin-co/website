import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { main } from './report.mjs';

const REPORT = fileURLToPath(new URL('./report.mjs', import.meta.url));

const lighthouseRun = (path, { lcp = 1000, crawlable = 1, seo = 1 } = {}) => ({
  finalUrl: `http://127.0.0.1:4330${path}`,
  categories: {
    performance: { score: 1 },
    accessibility: { score: 1 },
    'best-practices': { score: 1 },
    seo: {
      score: seo,
      auditRefs: [
        { id: 'is-crawlable', weight: 4 },
        { id: 'meta-description', weight: 1 },
      ],
    },
  },
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'is-crawlable': { score: crawlable, scoreDisplayMode: 'binary' },
    'meta-description': { score: 1, scoreDisplayMode: 'binary' },
  },
});

async function fixtureRoot(routes, gateRoutes = routes) {
  const root = await mkdtemp(join(tmpdir(), 'report-main-'));
  for (const route of routes) {
    const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
    await mkdir(dirname(join(root, 'dist', file)), { recursive: true });
    await writeFile(join(root, 'dist', file), '<html></html>');
  }
  await writeFile(
    join(root, 'dist', 'gate-routes.json'),
    JSON.stringify({ routes: gateRoutes, measured: [], overBudget: [] })
  );
  return root;
}

async function writeRuns(dir, path, perRun = [{}, {}, {}]) {
  await mkdir(dir, { recursive: true });
  for (const [index, options] of perRun.entries()) {
    const name = `lhr-${index}-${path.replaceAll('/', '_')}.json`;
    await writeFile(join(dir, name), JSON.stringify(lighthouseRun(path, options)));
  }
}

async function runMain(root, auditDir) {
  const previous = process.env.LH_DIST_DIR;
  process.env.LH_DIST_DIR = join(root, 'dist');
  const log = mock.method(console, 'log', () => {});
  try {
    await main('9', auditDir);
  } finally {
    log.mock.restore();
    if (previous === undefined) delete process.env.LH_DIST_DIR;
    else process.env.LH_DIST_DIR = previous;
  }
  const failed = process.exitCode === 1;
  process.exitCode = 0;
  return { failed, report: await readFile(join(auditDir, 'REPORT.md'), 'utf8') };
}

const FORMS = ['lh-mobile', 'lh-desktop'];

test('a full, clean run over the built routes passes and says how many routes it expected', async () => {
  const root = await fixtureRoot(['/', '/about']);
  const auditDir = join(root, 'audits');
  for (const form of FORMS) {
    await writeRuns(join(auditDir, form), '/');
    await writeRuns(join(auditDir, form), '/about/');
  }

  const { failed, report } = await runMain(root, auditDir);

  assert.equal(failed, false);
  assert.match(report, /Result: PASS/);
  assert.match(report, /Lighthouse scope: 2 route\(s\) expected/);
});

test('a route whose runs never arrived fails on both form factors even when gate-routes.json never listed it', async () => {
  const root = await fixtureRoot(['/', '/about'], ['/']);
  const auditDir = join(root, 'audits');
  for (const form of FORMS) await writeRuns(join(auditDir, form, 'shard-1'), '/');

  const { failed, report } = await runMain(root, auditDir);

  assert.equal(failed, true);
  assert.match(report, /Result: FAIL/);
  assert.match(report, /^- mobile: no Lighthouse run for \/about$/m);
  assert.match(report, /^- desktop: no Lighthouse run for \/about$/m);
});

test('a route that arrived with fewer than three runs fails, so a shard that stopped early cannot shrink the median', async () => {
  const root = await fixtureRoot(['/']);
  const auditDir = join(root, 'audits');
  await writeRuns(join(auditDir, 'lh-mobile'), '/', [{}, {}]);
  await writeRuns(join(auditDir, 'lh-desktop'), '/');

  const { failed, report } = await runMain(root, auditDir);

  assert.equal(failed, true);
  assert.match(report, /^- mobile \/: 2 runs, gate requires 3$/m);
});

test('a route whose median LCP is over the lighthouserc budget fails though every category reads 100', async () => {
  const root = await fixtureRoot(['/']);
  const auditDir = join(root, 'audits');
  await writeRuns(join(auditDir, 'lh-mobile'), '/', [{ lcp: 1000 }, { lcp: 2400 }, { lcp: 2500 }]);
  await writeRuns(join(auditDir, 'lh-desktop'), '/');

  const { failed, report } = await runMain(root, auditDir);

  assert.equal(failed, true);
  assert.match(report, /^- metric: mobile \/ largest-contentful-paint: 2400 over budget 1850$/m);
});

test('one slow outlier run does not fail a route, because the median run decides, as it does in lighthouserc', async () => {
  const root = await fixtureRoot(['/']);
  const auditDir = join(root, 'audits');
  await writeRuns(join(auditDir, 'lh-mobile'), '/', [{ lcp: 1000 }, { lcp: 1100 }, { lcp: 2400 }]);
  await writeRuns(join(auditDir, 'lh-desktop'), '/');

  const { failed } = await runMain(root, auditDir);

  assert.equal(failed, false);
});

test('a route named noindex by design may fail is-crawlable and still pass, since its other SEO audits all passed', async () => {
  const root = await fixtureRoot(['/', '/search']);
  const auditDir = join(root, 'audits');
  for (const form of FORMS) {
    await writeRuns(join(auditDir, form), '/');
    await writeRuns(join(auditDir, form), '/search/', [
      { crawlable: 0, seo: 0.2 },
      { crawlable: 0, seo: 0.2 },
      { crawlable: 0, seo: 0.2 },
    ]);
  }

  const { failed, report } = await runMain(root, auditDir);

  assert.equal(failed, false);
  assert.match(report, /\| mobile \| `\/search\/` \| 100 \| 100 \| 100 \| 100 \|/);
});

test('a route that is not named fails on is-crawlable, whatever its own html declares', async () => {
  const root = await fixtureRoot(['/', '/about']);
  const auditDir = join(root, 'audits');
  for (const form of FORMS) {
    await writeRuns(join(auditDir, form), '/');
    await writeRuns(join(auditDir, form), '/about/', [
      { crawlable: 0, seo: 0.2 },
      { crawlable: 0, seo: 0.2 },
      { crawlable: 0, seo: 0.2 },
    ]);
  }

  const { failed, report } = await runMain(root, auditDir);

  assert.equal(failed, true);
  assert.match(report, /^- mobile \/about\/ seo: 20$/m);
});

test('an LH_ONLY_ROUTES allow-list never shrinks the floor the report demands, so the variable cannot hide an unaudited route', async () => {
  const root = await fixtureRoot(['/', '/about']);
  const auditDir = join(root, 'audits');
  const allowList = join(root, 'only.json');
  await writeFile(allowList, JSON.stringify(['/']));
  for (const form of FORMS) await writeRuns(join(auditDir, form), '/');
  const previous = process.env.LH_ONLY_ROUTES;
  process.env.LH_ONLY_ROUTES = allowList;

  let outcome;
  try {
    outcome = await runMain(root, auditDir);
  } finally {
    if (previous === undefined) delete process.env.LH_ONLY_ROUTES;
    else process.env.LH_ONLY_ROUTES = previous;
  }

  assert.equal(outcome.failed, true);
  assert.match(outcome.report, /^- mobile: no Lighthouse run for \/about$/m);
});

test('a missing dist/gate-routes.json is refused rather than reported over, since the byte budgets would go unchecked', async () => {
  const root = await mkdtemp(join(tmpdir(), 'report-main-'));
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist', 'index.html'), '<html></html>');

  await assert.rejects(() => runMain(root, join(root, 'audits')));
});

test('a run that names no bucket is refused and rewrites nothing, since a bare run once rewrote the frozen phase-1 report', async () => {
  const root = await fixtureRoot(['/']);
  const frozen = join(root, 'audits', 'phase-1');
  for (const form of FORMS) await writeRuns(join(frozen, form), '/');
  await writeFile(join(frozen, 'REPORT.md'), '# Phase 1, frozen\n');
  const site = join(root, 'site');
  await mkdir(site);

  const bare = spawnSync(process.execPath, [REPORT], {
    cwd: site,
    env: { ...process.env, LH_DIST_DIR: join(root, 'dist') },
    encoding: 'utf8',
  });

  assert.notEqual(bare.status, 0);
  assert.match(bare.stderr, /node scripts\/report\.mjs <phase> <audit-dir>/);
  assert.equal(await readFile(join(frozen, 'REPORT.md'), 'utf8'), '# Phase 1, frozen\n');
  await assert.rejects(() => main('9'), /<phase> <audit-dir>/);
});

test('a report whose revision git cannot name is refused, naming the file it was stamping, never stamped unknown', async () => {
  const root = await fixtureRoot(['/']);
  const auditDir = join(root, 'audits');
  for (const form of FORMS) await writeRuns(join(auditDir, form), '/');
  const path = process.env.PATH;
  process.env.PATH = root;
  let refusal;
  try {
    await runMain(root, auditDir).catch((error) => (refusal = error));
  } finally {
    process.env.PATH = path;
  }

  assert.ok(refusal, 'main stamped a report although git could not name the revision');
  assert.ok(refusal.message.includes(join(auditDir, 'REPORT.md')), refusal.message);
  assert.match(refusal.message, /git is not on PATH/);
  assert.match(refusal.message, /inside a git checkout/);
  await assert.rejects(() => readFile(join(auditDir, 'REPORT.md')), { code: 'ENOENT' });
});
