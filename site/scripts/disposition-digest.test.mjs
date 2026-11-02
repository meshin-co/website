import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { parse } from 'yaml';

import { digestFor } from './dispositions.mjs';
import { collectionRows, mergeRows } from './editorial-inventory.mjs';
import { renderEntry } from './entry-files.mjs';
import { claimOf, DRAFTS, RUN_DATE } from './fixtures/entry-drafts.mjs';

const DIGEST_SCRIPT = join(import.meta.dirname, 'disposition-digest.mjs');
const GATE_SCRIPT = join(import.meta.dirname, 'editorial-gate.mjs');
const TARGET = 'src/data/glossary/model-registry.md';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixtureSite = () => {
  const root = mkdtempSync(join(tmpdir(), 'disposition-digest-'));
  roots.push(root);
  const site = join(root, 'site');
  mkdirSync(join(site, 'dist'), { recursive: true });
  mkdirSync(join(site, 'src/data/glossary'), { recursive: true });
  writeFileSync(join(site, 'dist/gate-routes.json'), JSON.stringify({ routes: [] }));
  const entry = renderEntry({ claim: claimOf('term'), draft: DRAFTS.term, runDate: RUN_DATE });
  writeFileSync(join(site, TARGET), entry.text);
  return { root, site };
};

const digestOf = (site, ...args) =>
  spawnSync(process.execPath, [DIGEST_SCRIPT, ...args], { cwd: site, encoding: 'utf8' });

const ledgerDigest = (site) => {
  const [, front, body] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(join(site, TARGET), 'utf8'));
  const rows = mergeRows(collectionRows([{ file: TARGET, frontmatter: parse(front), body }]));
  return digestFor(rows, TARGET);
};

const staleCount = (root, site, digest) => {
  const directory = join(root, 'audits/phase-4.7/dispositions');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'generated-model-registry.json'),
    JSON.stringify([{ target: TARGET, status: 'rewritten', digest }])
  );
  const gate = spawnSync(process.execPath, [GATE_SCRIPT, '.', 'dist', '--check'], { cwd: site, encoding: 'utf8' });
  return Number(/dispositions: 1 declared, (\d+) stale/.exec(gate.stdout)[1]);
};

test('the script prints the twelve hex digits of the target rows as the editorial ledger computes them', () => {
  const { site } = fixtureSite();
  const run = digestOf(site, '.', 'dist', TARGET);

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^[0-9a-f]{12}\n$/);
  assert.equal(run.stdout.trim(), ledgerDigest(site));
});

test('the editorial gate accepts a disposition that carries the printed digest and calls any other one stale', () => {
  const { root, site } = fixtureSite();
  const printed = digestOf(site, '.', 'dist', TARGET).stdout.trim();

  assert.equal(staleCount(root, site, printed), 0);
  assert.equal(staleCount(root, site, 'deadbeef0000'), 1);
});

test('a change to the text of the entry changes the digest', () => {
  const { site } = fixtureSite();
  const before = digestOf(site, '.', 'dist', TARGET).stdout;
  const entry = join(site, TARGET);
  writeFileSync(
    entry,
    readFileSync(entry, 'utf8').replace('Keep one row per deployed model.', 'Keep two rows per deployed model.')
  );

  assert.notEqual(digestOf(site, '.', 'dist', TARGET).stdout, before);
});

test('the target may be written with a leading ./ or site/ and names the same rows', () => {
  const { site } = fixtureSite();
  const plain = digestOf(site, '.', 'dist', TARGET).stdout;

  assert.equal(digestOf(site, '.', 'dist', `./${TARGET}`).stdout, plain);
  assert.equal(digestOf(site, '.', 'dist', `site/${TARGET}`).stdout, plain);
});

test('a target that no editorial row names prints no digest and exits 1 naming the target', () => {
  const { site } = fixtureSite();
  const run = digestOf(site, '.', 'dist', 'src/data/glossary/not-written.md');

  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /src\/data\/glossary\/not-written\.md/);
});

test('a call with missing arguments exits 2 and prints the usage', () => {
  const { site } = fixtureSite();
  const run = digestOf(site, '.', 'dist');

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /usage: node scripts\/disposition-digest\.mjs/);
});
