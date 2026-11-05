import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { newClaim } from './autowriter-claim-store.mjs';
import { validateClaim } from './autowriter-claims.mjs';
import { categoryInput } from './fixtures/generation-input.mjs';
import { buildRecord, validateRecord } from './generation-record.mjs';
import { run as measure } from './measure-origins.mjs';
import { recordPath } from './record-layout.mjs';
import { buildRun } from './topic-entries.mjs';

const NOW = new Date('2026-11-05T05:17:04.000Z');
const CATCH_UP = { slot: '03:17', lateMinutes: 120 };

const claimInput = (extra = {}) => ({
  slug: 'a-slug',
  title: 'A title',
  format: 'article',
  query: 'a query',
  demand: { impressions: 0, position: null },
  origin: 'category',
  category: 'governance',
  runId: '1-1',
  now: NOW,
  ...extra,
});

test('a claim made for a late slot carries the slot and how late the run was, apart from its origin', () => {
  const claim = newClaim(claimInput({ catchUp: CATCH_UP }));
  assert.deepEqual(claim.catchUp, CATCH_UP);
  assert.equal(claim.origin, 'category');
  assert.deepEqual(validateClaim(claim), []);
});

test('a claim made on time has no catchUp key at all, so a claim written before the field existed stays valid', () => {
  const claim = newClaim(claimInput());
  assert.equal(Object.hasOwn(claim, 'catchUp'), false);
  assert.deepEqual(validateClaim(claim), []);
});

for (const [label, catchUp] of [
  ['a slot that is not a time of day', { slot: '3:17', lateMinutes: 120 }],
  ['a negative lateness', { slot: '03:17', lateMinutes: -1 }],
  ['a fractional lateness', { slot: '03:17', lateMinutes: 1.5 }],
  ['no lateness', { slot: '03:17' }],
  ['no slot', { lateMinutes: 120 }],
  ['an unknown key', { slot: '03:17', lateMinutes: 120, by: 'hand' }],
  ['a boolean in place of the object', true],
]) {
  test(`a claim whose catchUp is ${label} is refused`, () => {
    const claim = { ...newClaim(claimInput()), catchUp };
    assert.notDeepEqual(validateClaim(claim), []);
  });
}

const entry = {
  format: 'article',
  topic: { format: 'article', subject: null, title: 'A title', slug: 'a-slug', query: 'a query' },
  demand: { impressions: 0, position: null },
  table: null,
  row: null,
  choice: 'Choice: category governance, no article yet',
  origin: 'category',
  category: 'governance',
};
const term = {
  ...entry,
  format: 'term',
  topic: { ...entry.topic, format: 'term', slug: 'a-term', title: 'A term' },
  origin: 'demand',
  category: undefined,
  demand: { impressions: 3, position: 9 },
  prompt: { number: 1, text: 'what is a term' },
};
const decision = (entries) => ({
  decision: 'write',
  choice: entries[0].choice,
  reason: null,
  entries,
  strengthen: null,
  advisories: [],
  concepts: { named: [] },
  fallback: null,
  refusals: [],
  proposals: [],
  trail: [],
});
const report = {
  measured: '2026-11-04',
  windowStart: '2026-08-01',
  windowEnd: '2026-11-02',
  property: 'sc-domain:meshin.co',
  generatedFrom: 'b5d0639',
};
const built = (extra) =>
  buildRun({
    decision: decision([entry, term]),
    report,
    runId: '1-1',
    now: NOW,
    reportPath: 'audits/search-demand.md',
    ...extra,
  });

test('a run for a late slot stamps every claim it files, the article and its glossary term alike', () => {
  const { claims } = built({ catchUp: CATCH_UP });
  assert.equal(claims.length, 2);
  for (const { claim } of claims) {
    assert.deepEqual(claim.catchUp, CATCH_UP);
    assert.deepEqual(validateClaim(claim), []);
  }
});

test('a run that was not late stamps nothing, whether the field is null or absent', () => {
  for (const extra of [{}, { catchUp: null }]) {
    for (const { claim } of built(extra).claims) assert.equal(Object.hasOwn(claim, 'catchUp'), false);
  }
});

test('the generation record keeps the catch-up of its claim, and refuses one that is malformed', () => {
  const input = categoryInput();
  const record = buildRecord({ ...input, claim: { ...input.claim, catchUp: CATCH_UP } });
  assert.deepEqual(record.claim.catchUp, CATCH_UP);
  assert.deepEqual(validateRecord(record), []);
  const broken = { ...record, claim: { ...record.claim, catchUp: { slot: '3:17', lateMinutes: 120 } } };
  assert.notDeepEqual(validateRecord(broken), []);
});

test('a record made on time has no catchUp key in its claim', () => {
  const input = categoryInput();
  assert.equal(Object.hasOwn(buildRecord(input).claim, 'catchUp'), false);
});

function plant(root, slug, at, extra) {
  const input = categoryInput();
  const entryPath = `site/src/data/post/${slug}.md`;
  const record = buildRecord({
    ...input,
    claim: { ...input.claim, slug, ...extra },
    route: `/blog/${slug}`,
    entryPath,
    generatedAt: at,
    files: [entryPath, recordPath('generation', slug, at)],
  });
  const path = join(root, recordPath('generation', slug, at));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
}

const printed = (root) => {
  const out = [];
  const err = [];
  const code = measure({ repoRoot: root, out: (line) => out.push(line), err: (line) => err.push(line) });
  return { code, out, err };
};

test('measure:origins counts entries by arrival and lists each catch-up with its slot and lateness, so a dropped slot is countable', () => {
  const root = mkdtempSync(join(tmpdir(), 'catch-up-measure-'));
  try {
    plant(root, 'on-time-one', '2026-11-04T03:20:00.000Z');
    plant(root, 'on-time-two', '2026-11-04T15:20:00.000Z');
    plant(root, 'caught-up', '2026-11-05T05:17:04.000Z', { catchUp: CATCH_UP });
    const { code, out, err } = printed(root);
    assert.deepEqual(err, []);
    assert.equal(code, 0);
    const text = out.join('\n');
    assert.match(text, /^arrival$/m);
    assert.match(text, /^on time\s+2$/m);
    assert.match(text, /^catch-up\s+1$/m);
    assert.match(text, /^caught-up\s+03:17\s+120\s+2026-11-05$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('with no catch-up the arrival section says so in one line and lists nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'catch-up-measure-'));
  try {
    plant(root, 'on-time-one', '2026-11-04T03:20:00.000Z');
    const text = printed(root).out.join('\n');
    assert.match(text, /^on time\s+1$/m);
    assert.match(text, /^catch-up\s+0$/m);
    assert.match(text, /^caught up late, oldest first\nnone$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
