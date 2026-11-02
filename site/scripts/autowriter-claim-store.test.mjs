import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { CLAIM_DIR, claimFile, isHolding, validateClaim } from './autowriter-claims.mjs';
import { CLAIM_LIFETIME_DAYS, newClaim, readClaim, readClaims, writeClaim } from './autowriter-claim-store.mjs';

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
    const path = join(root, CLAIM_DIR, 'what-is-a-model-card.json');
    writeClaim(path, claim());
    assert.deepEqual(readClaim(path), claim());
    assert.equal(readFileSync(path, 'utf8').endsWith('}\n'), true);
    assert.deepEqual(readdirSync(join(root, CLAIM_DIR)), ['what-is-a-model-card.json']);
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
    const dir = join(root, CLAIM_DIR);
    writeClaim(join(dir, 'b-claim.json'), claim({ slug: 'b-claim' }));
    writeClaim(join(dir, 'a-claim.json'), claim({ slug: 'a-claim' }));
    writeFileSync(join(dir, 'notes.txt'), 'not a claim');
    assert.deepEqual(
      readClaims(root).map(({ path, claim: read }) => [path, read.slug]),
      [
        [claimFile('a-claim'), 'a-claim'],
        [claimFile('b-claim'), 'b-claim'],
      ]
    );
    writeFileSync(join(dir, 'broken.json'), '[');
    assert.throws(() => readClaims(root), /broken\.json is not readable JSON/);
  });
  inTemp((root) => assert.deepEqual(readClaims(root), []));
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
