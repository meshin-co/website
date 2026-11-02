import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ledgerWithAttempt, newLedger, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';

const HASH = 'a'.repeat(40);
const T0 = '2026-11-02T07:00:00.000Z';
const CLEAR = 'cd site && GATE_PHASE=<bucket> npm run gate:lh && GATE_PHASE=<bucket> npm run lh:record';

const attempt = (number, extra = {}) => ({
  number,
  judgedCommit: HASH,
  recordedAt: T0,
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/x.md',
  tokens: { input: 100, output: 50 },
  costUsd: 0.25,
  ...extra,
});
const failure = (rule, path) => ({ rule, path });
const open = () => newLedger({ slug: 'what-is-aims', runId: '1234', pullRequest: 42 });
const withAttempts = (...attempts) => ({
  ...open(),
  attempts,
  spend: { tokens: { input: 100 * attempts.length, output: 50 * attempts.length }, costUsd: 0.25 * attempts.length },
});
const DEBT = { mergedCommit: 'b'.repeat(40), fingerprint: 'c'.repeat(64), recordedAt: T0, clear: CLEAR };
const merged = (extra = {}) => ({
  ...withAttempts(attempt(1)),
  verdict: { state: 'merged', reason: null, decidedAt: T0 },
  measurementDebt: DEBT,
  ...extra,
});
const without = (ledger, key) => Object.fromEntries(Object.entries(ledger).filter(([name]) => name !== key));
const problemsText = (ledger) => validateLedger(ledger).map(describeProblem);

test('a merged ledger that names the tree it left unmeasured and the command that clears it has no problems', () => {
  assert.deepEqual(validateLedger(merged()), []);
});

test('an attempt may list every rule and path of the failure it answered, headed by its failing rule and path', () => {
  const listed = attempt(1, {
    failures: [failure('banned-phrase', 'site/src/data/post/x.md'), failure('unsourced-number', '/blog/x')],
  });
  assert.deepEqual(validateLedger(withAttempts(listed)), []);
});

test('an attempt that lists no failures, as every attempt did before the list existed, is still valid', () => {
  assert.deepEqual(validateLedger(withAttempts(attempt(1))), []);
  assert.deepEqual(validateLedger(withAttempts(attempt(1, { failingRule: null, failingPath: null }))), []);
});

test('ledgerWithAttempt carries the listed failures into the ledger it returns', () => {
  const failures = [failure('banned-phrase', 'site/src/data/post/x.md')];
  const next = ledgerWithAttempt(open(), { ...without(attempt(1), 'number'), failures });
  assert.deepEqual(next.attempts[0].failures, failures);
  assert.deepEqual(validateLedger(next), []);
});

const DEFECTS = [
  [
    'a merged verdict with no measurement debt',
    without(merged(), 'measurementDebt'),
    'measurementDebt is required once the verdict is merged, so the tree no Lighthouse run measured is on record',
  ],
  [
    'a measurement debt on a ledger that is not merged',
    { ...open(), measurementDebt: DEBT },
    'measurementDebt belongs to a merged verdict only, and this verdict is open',
  ],
  [
    'a measurement debt on an escalated ledger',
    {
      ...withAttempts(attempt(1)),
      verdict: { state: 'stopped', reason: 'held', decidedAt: T0 },
      measurementDebt: DEBT,
    },
    'measurementDebt belongs to a merged verdict only, and this verdict is stopped',
  ],
  [
    'a debt with a short commit',
    merged({ measurementDebt: { ...DEBT, mergedCommit: 'abc1234' } }),
    'measurementDebt.mergedCommit must match pattern ^[0-9a-f]{40}$',
  ],
  [
    'a debt with a short fingerprint',
    merged({ measurementDebt: { ...DEBT, fingerprint: 'abc' } }),
    'measurementDebt.fingerprint must match pattern ^[0-9a-f]{64}$',
  ],
  [
    'a debt with no command to clear it',
    merged({ measurementDebt: { ...DEBT, clear: ' ' } }),
    'measurementDebt.clear must match pattern \\S',
  ],
  [
    'a debt recorded at an instant that is not on the calendar',
    merged({ measurementDebt: { ...DEBT, recordedAt: '2026-02-31T00:00:00.000Z' } }),
    'measurementDebt.recordedAt must be a real calendar instant, got "2026-02-31T00:00:00.000Z"',
  ],
  [
    'a debt with an unknown key',
    merged({ measurementDebt: { ...DEBT, note: 'hi' } }),
    'measurementDebt.note has an unexpected key',
  ],
  [
    'a debt with a missing key',
    merged({ measurementDebt: without(DEBT, 'fingerprint') }),
    'measurementDebt.fingerprint is required',
  ],
  [
    'an empty list of failures',
    withAttempts(attempt(1, { failures: [] })),
    'attempts[0].failures must have at least 1 items',
  ],
  [
    'a failure with no path',
    withAttempts(attempt(1, { failures: [{ rule: 'banned-phrase' }] })),
    'attempts[0].failures[0].path is required',
  ],
  [
    'a failure with an unknown key',
    withAttempts(attempt(1, { failures: [{ ...failure('banned-phrase', 'site/src/data/post/x.md'), line: 3 }] })),
    'attempts[0].failures[0].line has an unexpected key',
  ],
  [
    'a failing rule that is not the rule of the first listed failure',
    withAttempts(attempt(1, { failures: [failure('unsourced-number', 'site/src/data/post/x.md')] })),
    'attempts[0].failingRule is "banned-phrase" but attempts[0].failures[0].rule is "unsourced-number"',
  ],
  [
    'a failing path that is not the path of the first listed failure',
    withAttempts(attempt(1, { failures: [failure('banned-phrase', '/blog/x')] })),
    'attempts[0].failingPath is "site/src/data/post/x.md" but attempts[0].failures[0].path is "/blog/x"',
  ],
];

for (const [name, ledger, expected] of DEFECTS) {
  test('a ledger with ' + name + ' is refused naming the field', () => {
    assert.ok(problemsText(ledger).includes(expected), problemsText(ledger).join(' | '));
  });
}
