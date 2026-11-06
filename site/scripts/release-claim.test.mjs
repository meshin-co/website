import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { newClaim, readClaim, writeClaim } from './autowriter-claim-store.mjs';
import { recordPath } from './record-layout.mjs';
import { runCli } from './release-claim.mjs';

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const CLAIMED_AT = '2026-11-06T03:20:00Z';

function claimFor({ slug, format, status }) {
  const now = new Date(CLAIMED_AT);
  const fromCategory = format === 'article';
  const claim = newClaim({
    slug,
    title: slug.replaceAll('-', ' '),
    format,
    query: slug.replaceAll('-', ' '),
    demand: { impressions: fromCategory ? 0 : 4, position: fromCategory ? null : 12 },
    origin: fromCategory ? 'category' : 'demand',
    ...(fromCategory ? { category: 'governance' } : { prompt: { number: 3, text: slug.replaceAll('-', ' ') } }),
    runId: 'run-1',
    now,
  });
  return { path: recordPath('claim', slug, now), claim: { ...claim, status } };
}

function repoWith(entries) {
  const root = mkdtempSync(join(tmpdir(), 'release-claim-'));
  roots.push(root);
  const written = entries.map(claimFor);
  for (const { path, claim } of written) writeClaim(join(root, path), claim);
  const decision = join(root, 'decision.json');
  writeFileSync(
    decision,
    JSON.stringify({
      decision: 'write',
      ledgerPath: 'audits/autowriter/2026/11/first-topic.json',
      entries: written.map(({ path }) => ({ claimPath: path })),
    })
  );
  return { root, decision, paths: written.map(({ path }) => path) };
}

function run(root, argv) {
  const lines = [];
  const errors = [];
  const code = runCli(argv, {
    repoRoot: root,
    stdout: (line) => lines.push(line),
    stderr: (line) => errors.push(line),
  });
  return { code, lines, errors };
}

test('the article claim of a stopped run becomes abandoned, so the slot it held is owed again', () => {
  const { root, decision, paths } = repoWith([{ slug: 'first-topic', format: 'article', status: 'claimed' }]);
  const { code, lines } = run(root, ['--decision', decision]);
  assert.equal(code, 0);
  assert.equal(readClaim(join(root, paths[0])).status, 'abandoned');
  assert.ok(lines.includes(`path=${paths[0]}`));
});

test('every claim of the decision is released, terms included, because none of them was written', () => {
  const { root, decision, paths } = repoWith([
    { slug: 'first-topic', format: 'article', status: 'claimed' },
    { slug: 'a-term', format: 'term', status: 'claimed' },
  ]);
  assert.equal(run(root, ['--decision', decision]).code, 0);
  assert.deepEqual(
    paths.map((path) => readClaim(join(root, path)).status),
    ['abandoned', 'abandoned']
  );
});

test('a claim the run already wrote is left alone, so a half-failed run never loses its entry', () => {
  const { root, decision, paths } = repoWith([{ slug: 'first-topic', format: 'article', status: 'written' }]);
  const { code, lines } = run(root, ['--decision', decision]);
  assert.equal(code, 0);
  assert.equal(readClaim(join(root, paths[0])).status, 'written');
  assert.match(lines.join('\n'), /already written, left alone/);
  assert.ok(!lines.some((line) => line.startsWith('path=')));
});

test('releasing twice leaves one abandoned claim and prints no second path, so a rerun commits nothing', () => {
  const { root, decision, paths } = repoWith([{ slug: 'first-topic', format: 'article', status: 'claimed' }]);
  run(root, ['--decision', decision]);
  const { code, lines } = run(root, ['--decision', decision]);
  assert.equal(code, 0);
  assert.equal(readClaim(join(root, paths[0])).status, 'abandoned');
  assert.ok(!lines.some((line) => line.startsWith('path=')));
});

test('a decision file that is not readable JSON stops with exit 1 and releases nothing', () => {
  const { root, decision, paths } = repoWith([{ slug: 'first-topic', format: 'article', status: 'claimed' }]);
  writeFileSync(decision, 'not json');
  const { code, errors } = run(root, ['--decision', decision]);
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /is not readable JSON/);
  assert.equal(readClaim(join(root, paths[0])).status, 'claimed');
});

test('a missing --decision is a usage error, because guessing which claims to release is never safe', () => {
  const { root } = repoWith([]);
  const { code, errors } = run(root, []);
  assert.equal(code, 2);
  assert.match(errors.join('\n'), /--decision is required/);
});

test('a decision that named no claim releases nothing and still succeeds', () => {
  const { root, decision } = repoWith([]);
  const { code, lines } = run(root, ['--decision', decision]);
  assert.equal(code, 0);
  assert.deepEqual(lines, []);
});

test('the decision file is read for its claim paths, and a path outside the claim tree is refused by the store', () => {
  const { root, decision } = repoWith([]);
  writeFileSync(decision, JSON.stringify({ entries: [{ claimPath: 'audits/autowriter/claims/2026/11/absent.json' }] }));
  const { code, errors } = run(root, ['--decision', decision]);
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /absent\.json/);
});

test('the claim file keeps every other field, so the record of what was spent on survives', () => {
  const { root, decision, paths } = repoWith([{ slug: 'first-topic', format: 'article', status: 'claimed' }]);
  const before = JSON.parse(readFileSync(join(root, paths[0]), 'utf8'));
  run(root, ['--decision', decision]);
  const after = JSON.parse(readFileSync(join(root, paths[0]), 'utf8'));
  assert.deepEqual({ ...after, status: 'claimed' }, before);
});
