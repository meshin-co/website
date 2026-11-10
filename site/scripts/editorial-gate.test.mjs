import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { digestFor } from './dispositions.mjs';
import { ledgerFindings, mergeLedger, readDispositions } from './editorial-gate.mjs';

test('a fresh ledger keeps every row unreviewed, so the gate fails until the pass is done', () => {
  const findings = ledgerFindings({ rows: [{ text: 'a', status: 'unreviewed', usedIn: ['x'] }] });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /unreviewed/);
});

test('shipped text that traces to no source row is its own finding', () => {
  const findings = ledgerFindings({ rows: [], untraceable: [{ route: '/x', text: 'ships untraceable' }] });
  assert.equal(findings.length, 1);
  assert.match(findings[0], /\/x/);
});

test('a dispositioned ledger with nothing unrowed passes', () => {
  assert.deepEqual(ledgerFindings({ rows: [{ text: 'a', status: 'verified', usedIn: ['x'] }] }), []);
});

test('re-running the extractors keeps the disposition already recorded for a text that has not changed', () => {
  const merged = mergeLedger(
    [{ text: 'unchanged', status: 'unreviewed', usedIn: ['a.astro'] }],
    [{ text: 'unchanged', status: 'rewritten', reason: 'tightened', usedIn: ['a.astro'] }]
  );
  assert.equal(merged[0].status, 'rewritten');
  assert.equal(merged[0].reason, 'tightened');
});

test('a text that changed since it was dispositioned comes back as unreviewed, because the disposition was about the old words', () => {
  const merged = mergeLedger(
    [{ text: 'new words', status: 'unreviewed', usedIn: ['a.astro'] }],
    [{ text: 'old words', status: 'verified', usedIn: ['a.astro'] }]
  );
  assert.deepEqual(
    merged.map((entry) => [entry.text, entry.status]),
    [['new words', 'unreviewed']]
  );
});

const SCRIPT = join(import.meta.dirname, 'editorial-gate.mjs');

function fixtureRoot(dispositions, others = {}) {
  const root = mkdtempSync(join(tmpdir(), 'editorial-gate-'));
  const site = join(root, 'site');
  const dist = join(site, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'gate-routes.json'), JSON.stringify({ routes: [] }));

  const dispositionsDir = join(root, 'audits/phase-4.7/dispositions');
  for (const [name, entries] of Object.entries({ 'a.json': dispositions, ...others })) {
    mkdirSync(dirname(join(dispositionsDir, name)), { recursive: true });
    writeFileSync(join(dispositionsDir, name), JSON.stringify(entries));
  }

  return { root, site };
}

test('a site that was never built is refused with the build command, not with a stack trace', () => {
  const { root, site } = fixtureRoot([]);

  try {
    rmSync(join(site, 'dist'), { recursive: true, force: true });
    const result = spawnSync('node', [SCRIPT, site, 'dist', '--check'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^EDITORIAL no-build .*dist: .*npm run build/m);
    assert.equal(result.stderr, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--check is read-only: it reports without writing the ledger or findings files CI would then have to commit', () => {
  const { root, site } = fixtureRoot([{ target: '/some-route-with-no-rows', status: 'verified' }]);

  try {
    execFileSync('node', [SCRIPT, site, 'dist', '--check'], { encoding: 'utf8' });
    assert.equal(existsSync(join(root, 'audits/phase-4.7/inventory.json')), false);
    assert.equal(existsSync(join(root, 'audits/phase-4.7/findings.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the generating run (without --check) still writes the ledger and findings, unlike the CI path', () => {
  const { root, site } = fixtureRoot([{ target: '/some-route-with-no-rows', status: 'verified' }]);

  try {
    execFileSync('node', [SCRIPT, site, 'dist'], { encoding: 'utf8' });
    assert.equal(existsSync(join(root, 'audits/phase-4.7/inventory.json')), true);
    assert.equal(existsSync(join(root, 'audits/phase-4.7/findings.json')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a disposition naming a target with no matching rows is reported by name, not just a bare count, and does not fail the build', () => {
  const { root, site } = fixtureRoot([{ target: '/some-route-with-no-rows', status: 'verified' }]);

  try {
    let exitCode = 0;
    try {
      execFileSync('node', [SCRIPT, site, 'dist'], { encoding: 'utf8' });
    } catch (err) {
      exitCode = err.status;
    }
    assert.equal(exitCode, 0);

    const inventory = JSON.parse(readFileSync(join(root, 'audits/phase-4.7/inventory.json'), 'utf8'));
    assert.equal(inventory.counts.noRows, 1);

    const findings = JSON.parse(readFileSync(join(root, 'audits/phase-4.7/findings.json'), 'utf8'));
    assert.deepEqual(findings.noRows, [{ target: '/some-route-with-no-rows', status: 'verified' }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const MONTH_FILE = '2026/11/generated-month.json';
const DEEPER_FILE = '2026/11/extra/deeper.json';
const row = (target) => ({ target, status: 'verified', reason: 'Read by the owner.', digest: 'aaaaaaaaaaaa' });
const atAnyDepth = () =>
  fixtureRoot([row('/flat-route')], {
    [MONTH_FILE]: [row('/month-route')],
    [DEEPER_FILE]: [row('/deeper-route')],
  });

const withoutMarker = () => {
  const env = { ...process.env };
  delete env.AUTOWRITER_UNATTENDED;
  return env;
};

test('a state-conditional declaration whose text the build now ships is reported, not gated, because the string ships in some states by definition', () => {
  const { root, site } = fixtureRoot([{ target: '/some-route-with-no-rows', status: 'verified' }], {
    '../conditional-copy.json': [{ text: 'Next page', reason: 'only ships once the corpus paginates' }],
  });

  try {
    let exitCode = 0;
    let output = '';
    try {
      output = execFileSync('node', [SCRIPT, site, 'dist'], { encoding: 'utf8' });
    } catch (err) {
      exitCode = err.status;
      output = err.stdout ?? '';
    }
    assert.equal(exitCode, 0, output);
    assert.match(output, /1 that the build now ships: reported, not gated/);

    const inventory = JSON.parse(readFileSync(join(root, 'audits/phase-4.7/inventory.json'), 'utf8'));
    assert.equal(inventory.counts.shipping, 1);
    assert.equal(inventory.counts.stale, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the dispositions are read from a flat file, from a file under its month and from one deeper, and all three are counted', () => {
  const { root } = atAnyDepth();

  try {
    const rows = readDispositions(root);

    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(({ target }) => target).sort(), ['/deeper-route', '/flat-route', '/month-route']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a repository with no disposition directory has no dispositions', () => {
  const root = mkdtempSync(join(tmpdir(), 'editorial-gate-'));

  try {
    assert.deepEqual(readDispositions(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the summary of the gate counts the dispositions of all three places', () => {
  const { root, site } = atAnyDepth();

  try {
    const output = execFileSync('node', [SCRIPT, site, 'dist', '--check'], { encoding: 'utf8' });

    assert.match(output, /dispositions: 3 declared, 0 stale, 0 naming a missing file, 3 on files with no copy rows/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the seal re-seals a flat file, a file under its month and one deeper in place, and counts all three', () => {
  const { root, site } = atAnyDepth();
  const directory = join(root, 'audits/phase-4.7/dispositions');
  const tree = () => readdirSync(directory, { recursive: true }).sort();
  const sealed = digestFor([], '/anything');
  const before = tree();

  try {
    const output = execFileSync('node', [SCRIPT, '.', 'dist', '--seal'], {
      cwd: site,
      env: withoutMarker(),
      encoding: 'utf8',
    });

    assert.match(output, /sealed 3 dispositions against the current text/);
    assert.deepEqual(tree(), before);
    for (const [name, target] of [
      ['a.json', '/flat-route'],
      [MONTH_FILE, '/month-route'],
      [DEEPER_FILE, '/deeper-route'],
    ]) {
      const text = readFileSync(join(directory, name), 'utf8');

      assert.deepEqual(JSON.parse(text), [{ ...row(target), digest: sealed }], name);
      assert.equal(text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`, name);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const FIRST_PAGE = '/blog/tag/ai-governance';
const SECOND_PAGE = `${FIRST_PAGE}/page/2`;
const WORDING_FILE = 'src/utils/paginate.mjs';
const wordingSource = (format) => `export const PAGE_HEADING_FORMAT = '${format}';\n`;
const archivePage = (heading, extra = '') =>
  `<html><head><title>${heading}</title><meta name="description" content="All posts tagged AI governance, newest first."></head><body><main><h1>${heading}</h1>${extra}</main></body></html>`;

function placePage(site, route, html) {
  const file = join(site, 'dist', `${route.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  const routesFile = join(site, 'dist/gate-routes.json');
  const { routes } = JSON.parse(readFileSync(routesFile, 'utf8'));
  writeFileSync(routesFile, JSON.stringify({ routes: [...new Set([...routes, route])] }));
}

function sealedArchive() {
  const { root, site } = fixtureRoot(
    [
      { target: FIRST_PAGE, status: 'rewritten', reason: 'Read by the owner.', digest: '' },
      { target: WORDING_FILE, status: 'verified', reason: 'The wording of every numbered page.', digest: '' },
    ],
    { '../conditional-copy.json': [{ text: '{heading}, page {number}', reason: 'a format, shipped as its headings' }] }
  );
  mkdirSync(join(site, 'src/utils'), { recursive: true });
  writeFileSync(join(site, WORDING_FILE), wordingSource('{heading}, page {number}'));
  placePage(site, FIRST_PAGE, archivePage('AI governance posts'));
  execFileSync('node', [SCRIPT, site, 'dist', '--seal'], { encoding: 'utf8', env: withoutMarker() });
  return { root, site, dispositions: join(root, 'audits/phase-4.7/dispositions/a.json') };
}

const check = (site) => {
  const result = spawnSync('node', [SCRIPT, site, 'dist', '--check'], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

test('a numbered archive route appearing is not a finding, and the seal needs no new row and changes no digest', () => {
  const { root, site, dispositions } = sealedArchive();

  try {
    assert.equal(check(site).status, 0);
    const sealed = readFileSync(dispositions, 'utf8');

    placePage(site, SECOND_PAGE, archivePage('AI governance posts, page 2'));
    const afterGrowth = check(site);
    assert.equal(afterGrowth.status, 0, afterGrowth.output);
    assert.doesNotMatch(afterGrowth.output, /findings:/);

    execFileSync('node', [SCRIPT, site, 'dist', '--seal'], { encoding: 'utf8', env: withoutMarker() });
    assert.equal(readFileSync(dispositions, 'utf8'), sealed);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a sentence a person wrote on a numbered archive route is still reported unreviewed, and only that sentence is', () => {
  const { root, site } = sealedArchive();

  try {
    placePage(
      site,
      SECOND_PAGE,
      archivePage('AI governance posts, page 2', '<p>Our editors added this sentence by hand on page two.</p>')
    );
    const { status, output } = check(site);
    assert.equal(status, 1, output);
    assert.match(output, /unreviewed copy \(1\):/);
    assert.match(
      output,
      /\/blog\/tag\/ai-governance\/page\/2 \| Our editors added this sentence by hand on page two\./
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('editing the pagination wording stops the gate on the wording and on every numbered route until a person reads it again', () => {
  const { root, site } = sealedArchive();

  try {
    placePage(site, SECOND_PAGE, archivePage('AI governance posts, page 2'));
    assert.equal(check(site).status, 0);

    writeFileSync(join(site, WORDING_FILE), wordingSource('{heading} — page {number}'));
    placePage(site, SECOND_PAGE, archivePage('AI governance posts — page 2'));
    const { status, output } = check(site);
    assert.equal(status, 1, output);
    assert.match(output, /dispositions: \d+ declared, 1 stale/);
    assert.match(output, /\/blog\/tag\/ai-governance\/page\/2 \| AI governance posts — page 2/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
