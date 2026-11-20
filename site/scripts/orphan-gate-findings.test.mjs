import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  SCORECARD,
  builtSiteWithAStrandedPost,
  withABodyLinkTo,
  withALonelyPage,
  writeTree,
} from './fixtures/orphan-scene.mjs';
import { parseGateFindings } from './gate-findings.mjs';
import * as gateRecords from './gate-records.mjs';
import { knownRule, listRows } from './repair-kinds.mjs';

const GATE = 'gate:orphans';
const FILE = 'gate-orphans.json';
const SITE = resolve(import.meta.dirname, '..');
const ROUTE = `/blog/${SCORECARD}`;

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const findingsDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), 'orphan-findings-'));
  roots.push(directory);
  return directory;
};

function runGate(files, { findingsDir } = {}) {
  const tree = writeTree(files);
  roots.push(tree.root);
  const env = { ...process.env };
  delete env.GATE_FINDINGS_DIR;
  if (findingsDir !== undefined) env.GATE_FINDINGS_DIR = findingsDir;
  return spawnSync(process.execPath, ['scripts/orphan-gate.mjs', tree.root], { cwd: SITE, env, encoding: 'utf8' });
}

const writtenIn = (directory) => parseGateFindings(readFileSync(join(directory, FILE), 'utf8'));

test('a post linked only from listings and navigation is recorded against its route, with how it is linked', () => {
  const findingsDir = findingsDirectory();

  const run = runGate(builtSiteWithAStrandedPost(), { findingsDir });

  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, new RegExp(`${ROUTE} is linked only from hub listing`));
  assert.deepEqual(readdirSync(findingsDir), [FILE]);
  const { gate, findings } = writtenIn(findingsDir);
  assert.equal(gate, GATE);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'chrome-only');
  assert.deepEqual(findings[0].subjects, [ROUTE]);
  assert.match(findings[0].detail, /^linked only from hub listing \/blog, /);
  assert.match(findings[0].detail, /the header, footer or breadcrumb of 2 pages$/);
});

test('a page nothing links to is recorded as an orphan, beside the chrome-only post', () => {
  const findingsDir = findingsDirectory();

  const run = runGate(withALonelyPage(builtSiteWithAStrandedPost()), { findingsDir });

  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.deepEqual(
    writtenIn(findingsDir).findings.map(({ rule, subjects }) => [rule, subjects]),
    [
      ['orphans', ['/lonely']],
      ['chrome-only', [ROUTE]],
    ]
  );
});

test('a tree whose posts all earn a body link exits 0 and removes the file an earlier run left', () => {
  const findingsDir = findingsDirectory();
  writeFileSync(join(findingsDir, FILE), 'the findings of an earlier run');

  const run = runGate(withABodyLinkTo(builtSiteWithAStrandedPost(), ROUTE), { findingsDir });

  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(existsSync(join(findingsDir, FILE)), false);
});

test('a local run, with the variable unset, prints and fails as it always did', () => {
  const run = runGate(builtSiteWithAStrandedPost());

  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stdout, /chrome-only: 1 of 3 routes that must earn a body link/);
});

test('a findings directory that is not absolute stops the gate rather than writing somewhere unexpected', () => {
  const run = runGate(builtSiteWithAStrandedPost(), { findingsDir: 'relative/findings' });

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /GATE_FINDINGS_DIR must be an absolute path/);
});

test('the records of a run are one per route, orphans first, and carry nothing the schema does not name', () => {
  const records = gateRecords.orphanRecords({
    orphans: ['/lonely', '/also-lonely'],
    chromeOnly: [{ route: '/a', via: 'hub listing /blog' }],
  });

  assert.deepEqual(records, [
    { rule: 'orphans', subjects: ['/lonely'], detail: 'no other page links to it', excerpt: '' },
    { rule: 'orphans', subjects: ['/also-lonely'], detail: 'no other page links to it', excerpt: '' },
    { rule: 'chrome-only', subjects: ['/a'], detail: 'linked only from hub listing /blog', excerpt: '' },
  ]);
});

test('a run that found nothing has no records, so the recorder removes a stale file', () => {
  assert.deepEqual(gateRecords.orphanRecords({ orphans: [], chromeOnly: [] }), []);
});

test('the gate records exactly the two rules the repair table holds a row for', () => {
  const emitted = new Set(
    gateRecords.orphanRecords({ orphans: ['/x'], chromeOnly: [{ route: '/y', via: 'z' }] }).map(({ rule }) => rule)
  );
  const rows = listRows()
    .filter((row) => row.gate === GATE)
    .map((row) => row.rule);

  assert.deepEqual([...emitted].sort(), ['chrome-only', 'orphans']);
  assert.deepEqual(rows.sort(), [...emitted].sort());
  for (const rule of emitted) assert.equal(knownRule({ gate: GATE, rule }), true);
});
