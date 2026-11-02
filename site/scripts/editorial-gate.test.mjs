import { execFileSync } from 'node:child_process';
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
