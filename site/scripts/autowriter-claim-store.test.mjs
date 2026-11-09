import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { isHolding, validateClaim } from './autowriter-claims.mjs';
import { CLAIM_LIFETIME_DAYS, newClaim, readClaim, readClaims, writeClaim } from './autowriter-claim-store.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

const NOW = new Date('2026-11-02T07:00:00.000Z');
const CLAIMED = '2026-11-01T07:00:00.000Z';
const LIVE = '2026-11-15T07:00:00.000Z';

const claim = (extra = {}) => ({
  schema: 1,
  slug: 'what-is-a-model-card',
  title: 'What is a model card?',
  format: 'term',
  query: 'model card',
  demand: { impressions: 14, position: 11.2 },
  prompt: { number: 7, text: 'How do I document a model for a security review?' },
  runId: '9001',
  status: 'claimed',
  claimedAt: CLAIMED,
  expiresAt: LIVE,
  ...extra,
});
const filedAt = (slug) => recordPath('claim', slug, CLAIMED);

function inTemp(check) {
  const root = mkdtempSync(join(tmpdir(), 'claims-'));
  try {
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a written claim reads back equal, ends in a newline and leaves no temporary file behind', () => {
  inTemp((root) => {
    const path = join(root, filedAt('what-is-a-model-card'));
    writeClaim(path, claim());
    assert.deepEqual(readClaim(path), claim());
    assert.equal(readFileSync(path, 'utf8').endsWith('}\n'), true);
    assert.deepEqual(readdirSync(dirname(path)), ['what-is-a-model-card.json']);
  });
});

test('a claim that breaks its schema, its expiry rule or its file name is refused before a byte is written', () => {
  inTemp((root) => {
    const path = join(root, 'what-is-a-model-card.json');
    assert.throws(
      () => writeClaim(path, claim({ format: 'video' })),
      /does not match the claim schema: format must be one of/
    );
    assert.throws(
      () => writeClaim(path, claim({ expiresAt: CLAIMED })),
      /does not match the claim schema: expiresAt must be later than claimedAt/
    );
    assert.throws(() => writeClaim(join(root, 'other.json'), claim()), /does not match the file name other\.json/);
    assert.equal(existsSync(path), false);
    assert.equal(existsSync(join(root, 'other.json')), false);
  });
});

test('a claim that is not JSON, or does not match, is refused by name when it is read', () => {
  inTemp((root) => {
    const path = join(root, 'what-is-a-model-card.json');
    writeFileSync(path, '{ not json');
    assert.throws(() => readClaim(path), /what-is-a-model-card\.json is not readable JSON/);
    writeFileSync(path, JSON.stringify(claim({ title: ' ' })));
    assert.throws(
      () => readClaim(path),
      /what-is-a-model-card\.json does not match the claim schema: title must match pattern \\S/
    );
    writeFileSync(path, JSON.stringify(claim({ slug: 'other' })));
    assert.throws(() => readClaim(path), /slug other does not match the file name what-is-a-model-card\.json/);
  });
});

test('every claim in the directory is read in file name order, and a broken one stops the read by name', () => {
  inTemp((root) => {
    const dir = join(root, dirname(filedAt('a-claim')));
    writeClaim(join(root, filedAt('b-claim')), claim({ slug: 'b-claim' }));
    writeClaim(join(root, filedAt('a-claim')), claim({ slug: 'a-claim' }));
    writeFileSync(join(dir, 'notes.txt'), 'not a claim');
    assert.deepEqual(
      readClaims(root).map(({ path, claim: read }) => [path, read.slug]),
      [
        [filedAt('a-claim'), 'a-claim'],
        [filedAt('b-claim'), 'b-claim'],
      ]
    );
    writeFileSync(join(dir, 'broken.json'), '[');
    assert.throws(() => readClaims(root), /broken\.json is not readable JSON/);
  });
  inTemp((root) => assert.deepEqual(readClaims(root), []));
});

test('readClaims finds a claim filed flat, in its month and deeper, and reads all three', () => {
  inTemp((root) => {
    const flat = `${recordDirectory('claim')}/flat-claim.json`;
    const month = filedAt('month-claim');
    const deeper = `${dirname(month)}/extra/deep-claim.json`;
    writeClaim(join(root, flat), claim({ slug: 'flat-claim' }));
    writeClaim(join(root, month), claim({ slug: 'month-claim' }));
    writeClaim(join(root, deeper), claim({ slug: 'deep-claim' }));
    const found = readClaims(root);
    assert.equal(found.length, 3);
    assert.deepEqual(Object.fromEntries(found.map(({ path, claim: read }) => [path, read.slug])), {
      [flat]: 'flat-claim',
      [month]: 'month-claim',
      [deeper]: 'deep-claim',
    });
  });
});

test('a broken claim filed deeper than its month stops the read by name, never skipped', () => {
  inTemp((root) => {
    writeClaim(join(root, filedAt('what-is-a-model-card')), claim());
    const deeper = join(root, dirname(filedAt('x')), 'extra');
    mkdirSync(deeper, { recursive: true });
    writeFileSync(join(deeper, 'broken.json'), '[');
    assert.throws(() => readClaims(root), /claims\/2026\/11\/extra\/broken\.json is not readable JSON/);
  });
});

const made = (now) =>
  newClaim({
    slug: 'what-is-a-model-card',
    title: 'What is a model card?',
    format: 'term',
    query: 'model card',
    demand: { impressions: 0, position: null },
    prompt: { number: 7, text: 'what is a model card' },
    runId: '9001',
    now,
  });

test('a new claim is open, lasts 14 days from the instant it was made and matches its own schema', () => {
  const fresh = made(NOW);
  assert.equal(CLAIM_LIFETIME_DAYS, 14);
  assert.deepEqual(validateClaim(fresh), []);
  assert.equal(fresh.status, 'claimed');
  assert.equal(fresh.claimedAt, '2026-11-02T07:00:00.000Z');
  assert.equal(fresh.expiresAt, '2026-11-16T07:00:00.000Z');
});

test('a claim lapses at the instant its fourteen days end, across a month and a year boundary too', () => {
  const fresh = made(NOW);
  assert.equal(isHolding(fresh, new Date('2026-11-16T06:59:59.999Z')), true);
  assert.equal(isHolding(fresh, new Date('2026-11-16T07:00:00.000Z')), false);
  assert.equal(made(new Date('2026-12-25T10:00:00.000Z')).expiresAt, '2027-01-08T10:00:00.000Z');
});

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..');
const PROMPT = { number: 7, text: 'what is a model card' };
const BASIS = {
  slug: 'what-is-a-model-card',
  title: 'What is a model card?',
  format: 'article',
  query: 'model card',
  runId: '9001',
  now: NOW,
};
const asDemand = () =>
  newClaim({ ...BASIS, demand: { impressions: 14, position: 11.2 }, prompt: PROMPT, origin: 'demand' });
const asWeak = () =>
  newClaim({
    ...BASIS,
    slug: 'a-weak-claim',
    demand: { impressions: 9, position: 91.8 },
    origin: 'weak-demand',
    weakness: ['no-buyer-prompt', 'impressions-at-floor'],
  });
const asKeyword = () =>
  newClaim({
    ...BASIS,
    slug: 'a-keyword-claim',
    query: 'ai governance framework',
    demand: { impressions: 803, position: null },
    origin: 'keyword',
  });
const asCategory = () =>
  newClaim({
    ...BASIS,
    slug: 'a-category-claim',
    demand: { impressions: 0, position: null },
    origin: 'category',
    category: 'governance',
  });
const asOrderedByPrompt = () =>
  newClaim({
    ...BASIS,
    slug: 'an-ordered-prompt-claim',
    demand: { impressions: 0, position: null },
    prompt: PROMPT,
    origin: 'ordered',
  });
const asOrderedByTitle = () =>
  newClaim({
    ...BASIS,
    slug: 'an-ordered-title-claim',
    demand: { impressions: 0, position: null },
    origin: 'ordered',
  });
const KEYS = ['schema', 'slug', 'title', 'format', 'query', 'demand'];
const TAIL = ['runId', 'status', 'claimedAt', 'expiresAt'];

test('a new claim keeps the origin fields it is given, after the demand, and invents no other key', () => {
  assert.deepEqual(Object.keys(asDemand()), [...KEYS, 'prompt', 'origin', ...TAIL]);
  assert.deepEqual(Object.keys(asWeak()), [...KEYS, 'origin', 'weakness', ...TAIL]);
  assert.deepEqual(Object.keys(asKeyword()), [...KEYS, 'origin', ...TAIL]);
  assert.deepEqual(Object.keys(asCategory()), [...KEYS, 'origin', 'category', ...TAIL]);
  assert.deepEqual(Object.keys(asOrderedByPrompt()), [...KEYS, 'prompt', 'origin', ...TAIL]);
  assert.deepEqual(Object.keys(asOrderedByTitle()), [...KEYS, 'origin', ...TAIL]);
  for (const made of [asDemand(), asWeak(), asKeyword(), asCategory(), asOrderedByPrompt(), asOrderedByTitle()])
    assert.deepEqual(validateClaim(made), []);
});

test('a new claim leaves out a key that is undefined or null, so no claim file ever holds a null prompt', () => {
  const made = newClaim({
    ...BASIS,
    demand: { impressions: 0, position: null },
    prompt: undefined,
    origin: 'category',
    category: 'governance',
    weakness: null,
  });
  assert.deepEqual(Object.keys(made), [...KEYS, 'origin', 'category', ...TAIL]);
  assert.deepEqual(validateClaim(made), []);
});

test('a claim made with no origin has none, so it is still the demand claim it always was', () => {
  assert.equal(Object.hasOwn(made(NOW), 'origin'), false);
  assert.deepEqual(validateClaim(made(NOW)), []);
});

test('a claim of each origin is written and read back equal, and a claim with no prompt holds no prompt key', () => {
  inTemp((root) => {
    for (const [claimed, holdsPrompt] of [
      [asDemand(), true],
      [asWeak(), false],
      [asKeyword(), false],
      [asCategory(), false],
      [asOrderedByPrompt(), true],
      [asOrderedByTitle(), false],
    ]) {
      const path = join(root, filedAt(claimed.slug));
      writeClaim(path, claimed);
      assert.deepEqual(readClaim(path), claimed);
      assert.equal(Object.hasOwn(JSON.parse(readFileSync(path, 'utf8')), 'prompt'), holdsPrompt, claimed.slug);
    }
  });
});

test('a claim that breaks an origin rule is refused before a byte is written, naming the rule', () => {
  inTemp((root) => {
    const path = join(root, filedAt('a-category-claim'));
    assert.throws(
      () => writeClaim(path, { ...asCategory(), prompt: PROMPT }),
      /does not match the claim schema: prompt must be absent when origin is category/
    );
    assert.equal(existsSync(path), false);
  });
});

test('an ordered claim that names a weakness or a category is refused before a byte is written, naming the rule', () => {
  inTemp((root) => {
    const path = join(root, filedAt('an-ordered-title-claim'));
    for (const [field, value] of [
      ['weakness', ['no-buyer-prompt']],
      ['category', 'governance'],
    ])
      assert.throws(
        () => writeClaim(path, { ...asOrderedByTitle(), [field]: value }),
        new RegExp(`does not match the claim schema: ${field} must be absent when origin is ordered`)
      );
    assert.equal(existsSync(path), false);
  });
});

test('every claim committed under audits stays valid, so the origin can stay optional', () => {
  const found = readClaims(REPOSITORY_ROOT);
  assert.ok(found.length >= 1, 'the scan found no claim to read');
  for (const { path, claim: read } of found) assert.deepEqual(validateClaim(read), [], path);
});
