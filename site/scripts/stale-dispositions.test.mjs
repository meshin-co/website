import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { parse } from 'yaml';

import { collectionRows, mergeRows } from './editorial-inventory.mjs';
import { renderEntry } from './entry-files.mjs';
import { claimOf, DRAFTS, RUN_DATE } from './fixtures/entry-drafts.mjs';
import { snapshotOf } from './fixtures/route-repo.mjs';

const STALE_SCRIPT = join(import.meta.dirname, 'stale-dispositions.mjs');
const DIGEST_SCRIPT = join(import.meta.dirname, 'disposition-digest.mjs');
const GATE_SCRIPT = join(import.meta.dirname, 'editorial-gate.mjs');
const FIRST = 'src/data/glossary/model-registry.md';
const SECOND = 'src/data/glossary/data-lineage.md';
const GHOST = 'src/data/glossary/ghost.md';
const WRONG = '000000000000';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const otherTerm = () => ({
  ...DRAFTS.term,
  fields: {
    ...DRAFTS.term.fields,
    description: 'Where a record came from and where it went.',
    shortDefinition: 'Data lineage is the recorded path of a record.',
    definition: 'Data lineage follows a record from its source through each change to the place it is used.',
  },
});

const world = () => {
  const root = mkdtempSync(join(tmpdir(), 'stale-dispositions-'));
  roots.push(root);
  const site = join(root, 'site');
  mkdirSync(join(site, 'dist'), { recursive: true });
  mkdirSync(join(site, 'src/data/glossary'), { recursive: true });
  writeFileSync(join(site, 'dist/gate-routes.json'), JSON.stringify({ routes: [] }));
  const first = renderEntry({ claim: claimOf('term'), draft: DRAFTS.term, runDate: RUN_DATE });
  const claim = { ...claimOf('term'), slug: 'data-lineage', title: 'What is data lineage?' };
  writeFileSync(join(site, FIRST), first.text);
  writeFileSync(join(site, SECOND), renderEntry({ claim, draft: otherTerm(), runDate: RUN_DATE }).text);
  return { root, site };
};

const digestOf = (site, target) =>
  spawnSync(process.execPath, [DIGEST_SCRIPT, '.', 'dist', target], { cwd: site, encoding: 'utf8' }).stdout.trim();

const locationOf = (site, target) => {
  const [, front, body] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(join(site, target), 'utf8'));
  return mergeRows(collectionRows([{ file: target, frontmatter: parse(front), body }]))[0].location;
};

const listStale = (site, ...args) =>
  spawnSync(process.execPath, [STALE_SCRIPT, ...(args.length > 0 ? args : ['.', 'dist'])], {
    cwd: site,
    encoding: 'utf8',
  });

const writeDispositions = (root, name, entries) => {
  const directory = join(root, 'audits/phase-4.7/dispositions');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), `${JSON.stringify(entries, null, 2)}\n`);
};

const entry = (target, digest, extra = {}) => ({
  target,
  status: 'rewritten',
  reason: 'Read again.',
  digest,
  ...extra,
});

function mixed({ root, site }) {
  const first = digestOf(site, FIRST);
  const second = digestOf(site, SECOND);
  const location = locationOf(site, FIRST);
  writeDispositions(root, 'a-terms.json', [
    entry(FIRST, first),
    entry(SECOND, WRONG),
    entry(FIRST, WRONG, { location }),
    entry(GHOST, WRONG),
  ]);
  writeDispositions(root, 'b-more.json', [entry(SECOND, WRONG), entry(SECOND, second)]);
  return { first, second };
}

test('it lists the entries whose digest differs from the built text of their target, by file and position', () => {
  const made = world();
  const { first, second } = mixed(made);
  const run = listStale(made.site);

  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), [
    { file: 'a-terms.json', index: 1, target: SECOND, digest: second },
    { file: 'a-terms.json', index: 2, target: FIRST, digest: first },
    { file: 'b-more.json', index: 0, target: SECOND, digest: second },
  ]);
});

test('the editorial gate calls exactly as many dispositions stale as the script lists', () => {
  const made = world();
  mixed(made);
  const listed = JSON.parse(listStale(made.site).stdout);
  const gate = spawnSync(process.execPath, [GATE_SCRIPT, '.', 'dist', '--check'], { cwd: made.site, encoding: 'utf8' });

  assert.equal(Number(/dispositions: \d+ declared, (\d+) stale/.exec(gate.stdout)[1]), listed.length);
  assert.equal(listed.length, 3);
});

test('an entry whose target has no rows is not listed, and neither is an entry the gate would not call changed', () => {
  const made = world();
  const first = digestOf(made.site, FIRST);
  writeDispositions(made.root, 'a.json', [entry(GHOST, WRONG), entry(FIRST, first, { status: 'unsorted' })]);

  assert.deepEqual(JSON.parse(listStale(made.site).stdout), []);
});

test('it prints an empty list when nothing is stale and when there is no disposition directory', () => {
  const made = world();
  assert.equal(listStale(made.site).stdout.trim(), '[]');

  writeDispositions(made.root, 'a.json', [entry(FIRST, digestOf(made.site, FIRST))]);
  const run = listStale(made.site);
  assert.equal(run.status, 0);
  assert.equal(run.stdout.trim(), '[]');
});

test('it reads only .json files', () => {
  const made = world();
  mixed(made);
  writeFileSync(join(made.root, 'audits/phase-4.7/dispositions/notes.txt'), 'not json at all');

  assert.equal(listStale(made.site).status, 0);
});

test('it writes nothing', () => {
  const made = world();
  mixed(made);
  const before = snapshotOf(made.root);
  listStale(made.site);

  assert.deepEqual(snapshotOf(made.root), before);
});

test('without both directories it prints the usage and exits 2', () => {
  const made = world();
  for (const args of [[], ['.']]) {
    const run = spawnSync(process.execPath, [STALE_SCRIPT, ...args], { cwd: made.site, encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /usage: node scripts\/stale-dispositions\.mjs/);
    assert.equal(run.stdout, '');
  }
});
