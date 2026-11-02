import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATTEMPT_CAP, ledgerWithAttempt, newLedger, validateLedger } from './autowriter-ledger.mjs';

const JUDGED = 'a'.repeat(40);
const attemptOf = (patch = {}) => ({
  judgedCommit: JUDGED,
  recordedAt: '2026-11-02T09:00:00.000Z',
  failingRule: 'banned-phrase',
  failingPath: '/blog/an-entry',
  tokens: { input: 1200, output: 800 },
  costUsd: 0.5,
  ...patch,
});
const fresh = () => newLedger({ slug: 'an-entry', runId: '9001', pullRequest: 7 });

test('the first attempt is numbered one and becomes the whole of the spend', () => {
  const next = ledgerWithAttempt(fresh(), attemptOf());
  assert.equal(next.attempts.length, 1);
  assert.equal(next.attempts[0].number, 1);
  assert.deepEqual(next.spend, { tokens: { input: 1200, output: 800 }, costUsd: 0.5 });
  assert.deepEqual(validateLedger(next), []);
});

test('the spend of the writing itself stays in the total beside the attempts', () => {
  const written = { ...fresh(), generation: { tokens: { input: 3000, output: 2000 }, costUsd: 1.25 } };
  const next = ledgerWithAttempt({ ...written, spend: written.generation }, attemptOf());
  assert.deepEqual(next.spend, { tokens: { input: 4200, output: 2800 }, costUsd: 1.75 });
  assert.deepEqual(validateLedger(next), []);
});

test('costs are added in micro-dollars, so 0.1 and 0.2 make exactly 0.3', () => {
  const once = ledgerWithAttempt(fresh(), attemptOf({ costUsd: 0.1 }));
  const twice = ledgerWithAttempt(once, attemptOf({ costUsd: 0.2 }));
  assert.equal(twice.spend.costUsd, 0.3);
  assert.deepEqual(validateLedger(twice), []);
});

test('the input ledger is left as it was', () => {
  const before = fresh();
  const snapshot = structuredClone(before);
  ledgerWithAttempt(before, attemptOf());
  assert.deepEqual(before, snapshot);
});

test('the attempt cap holds: the third attempt is recorded and the fourth is refused', () => {
  let ledger = fresh();
  for (let count = 1; count <= ATTEMPT_CAP; count += 1) ledger = ledgerWithAttempt(ledger, attemptOf());
  assert.deepEqual(
    ledger.attempts.map(({ number }) => number),
    [1, 2, 3]
  );
  assert.throws(() => ledgerWithAttempt(ledger, attemptOf()), /the cap is 3/);
});

test('a failure that names no rule or path is recorded as null, as the schema allows', () => {
  const next = ledgerWithAttempt(fresh(), attemptOf({ failingRule: null, failingPath: null }));
  assert.equal(next.attempts[0].failingRule, null);
  assert.deepEqual(validateLedger(next), []);
});
