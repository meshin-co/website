import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ledgerFindings, mergeLedger } from './editorial-gate.mjs';

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

function fixtureRoot(dispositions) {
  const root = mkdtempSync(join(tmpdir(), 'editorial-gate-'));
  const site = join(root, 'site');
  const dist = join(site, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'gate-routes.json'), JSON.stringify({ routes: [] }));

  const dispositionsDir = join(root, 'audits/phase-4.7/dispositions');
  mkdirSync(dispositionsDir, { recursive: true });
  writeFileSync(join(dispositionsDir, 'a.json'), JSON.stringify(dispositions));

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
