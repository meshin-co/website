import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REFUSAL_REASONS, newLedger, validateLedger } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';

const HASH = 'a'.repeat(40);
const T0 = '2026-11-02T07:00:00.000Z';

const attempt = (number) => ({
  number,
  judgedCommit: HASH,
  recordedAt: T0,
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/x.md',
  tokens: { input: 100, output: 50 },
  costUsd: 0.25,
});
const generation = { tokens: { input: 1000, output: 500 }, costUsd: 0.4 };
const refusal = (extra = {}) => ({
  title: 'What is an AI register?',
  reason: 'title-collision',
  against: 'What is an AI register? — meshin.co',
  detail: 'title "What is an AI register?" is already the title of /glossary/ai-register',
  ...extra,
});
const open = () => newLedger({ slug: 'what-is-aims', runId: '1234', pullRequest: null });
const generated = (extra = {}) => ({
  ...open(),
  generation,
  attempts: [attempt(1), attempt(2)],
  spend: { tokens: { input: 1200, output: 600 }, costUsd: 0.9 },
  ...extra,
});
const problemsText = (ledger) => validateLedger(ledger).map(describeProblem);

test('a ledger needs no generation and no refusals, which is what a new one carries', () => {
  assert.deepEqual(validateLedger(open()), []);
  assert.equal('generation' in open(), false);
  assert.equal('refusals' in open(), false);
});

test('spend is the generation plus every attempt, so a run that only generated is a ledger with no attempts', () => {
  assert.deepEqual(validateLedger(generated()), []);
  assert.deepEqual(validateLedger({ ...open(), generation, spend: generation }), []);
});

test('spend that leaves the generation out, or counts it twice, is refused naming both parts', () => {
  const missing = generated({ spend: { tokens: { input: 200, output: 100 }, costUsd: 0.5 } });
  assert.deepEqual(problemsText(missing), [
    'spend.tokens.input is 200 but its generation and attempts add up to 1200',
    'spend.tokens.output is 100 but its generation and attempts add up to 600',
    'spend.costUsd is 0.5 but its generation and attempts add up to 0.9',
  ]);
  const twice = generated({ spend: { tokens: { input: 2200, output: 1100 }, costUsd: 1.3 } });
  assert.equal(problemsText(twice).length, 3);
});

test('without a generation the message still names the attempts alone', () => {
  const wrong = { ...open(), attempts: [attempt(1)], spend: { tokens: { input: 1, output: 1 }, costUsd: 0 } };
  assert.ok(
    problemsText(wrong).includes('spend.costUsd is 0 but its attempts add up to 0.25'),
    problemsText(wrong).join(' | ')
  );
});

test('a generation is a spend object, so a missing part or a negative cost is refused naming the field', () => {
  const noTokens = { ...generated(), generation: { costUsd: 0.4 } };
  assert.deepEqual(problemsText(noTokens), ['generation.tokens is required']);
  const negative = { ...generated(), generation: { ...generation, costUsd: -1 } };
  assert.deepEqual(problemsText(negative), ['generation.costUsd must be >= 0']);
});

test('the refusals a run made on the way to its topic are an ordered list of reasoned records', () => {
  assert.deepEqual(REFUSAL_REASONS, [
    'title-collision',
    'slug-held',
    'route-exists',
    'register-owner',
    'family-served',
    'same-subject',
  ]);
  assert.deepEqual(validateLedger({ ...open(), refusals: [] }), []);
  const found = { ...open(), refusals: REFUSAL_REASONS.map((reason) => refusal({ reason })) };
  assert.deepEqual(validateLedger(found), []);
});

const DEFECTS = [
  [
    'an unknown reason',
    refusal({ reason: 'dislike' }),
    'refusals[0].reason must be one of "title-collision", "slug-held", "route-exists", "register-owner", "family-served", "same-subject"',
  ],
  ['no title', refusal({ title: ' ' }), 'refusals[0].title must match pattern \\S'],
  ['nothing it was refused against', refusal({ against: '' }), 'refusals[0].against must match pattern \\S'],
  ['no detail', refusal({ detail: '' }), 'refusals[0].detail must match pattern \\S'],
  ['an unknown field', refusal({ note: 'x' }), 'refusals[0].note has an unexpected key'],
];

for (const [name, entry, expected] of DEFECTS) {
  test('a refusal with ' + name + ' is refused naming the field', () => {
    assert.deepEqual(problemsText({ ...open(), refusals: [entry] }), [expected]);
  });
}

test('refusals must be a list', () => {
  assert.deepEqual(problemsText({ ...open(), refusals: refusal() }), ['refusals must be of type array']);
});
