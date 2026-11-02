import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeProblem, instantProblems, isCalendarInstant, readSchema } from './autowriter-records.mjs';

test('a problem reads as the field and what is wrong, and a whole-file problem says so', () => {
  assert.equal(
    describeProblem({ path: '$.attempts[0].judgedCommit', problem: 'must match pattern ^[0-9a-f]{40}$' }),
    'attempts[0].judgedCommit must match pattern ^[0-9a-f]{40}$'
  );
  assert.equal(describeProblem({ path: '$.note', problem: 'has an unexpected key' }), 'note has an unexpected key');
  assert.equal(describeProblem({ path: '$', problem: 'must be of type object' }), 'the file must be of type object');
});

test('an instant must exist on the calendar, with or without milliseconds', () => {
  assert.equal(isCalendarInstant('2026-11-02T07:00:00Z'), true);
  assert.equal(isCalendarInstant('2026-11-02T07:00:00.123Z'), true);
  assert.equal(isCalendarInstant('2028-02-29T23:59:59.000Z'), true);
  assert.equal(isCalendarInstant('2026-02-31T00:00:00Z'), false);
  assert.equal(isCalendarInstant('2026-02-29T00:00:00Z'), false);
  assert.equal(isCalendarInstant('2026-02-28T24:00:00Z'), false);
  assert.equal(isCalendarInstant('2026-13-40T07:00:00Z'), false);
  assert.equal(isCalendarInstant('2026-11-02'), false);
  assert.equal(isCalendarInstant('2026-11-02T07:00:00+02:00'), false);
  assert.equal(isCalendarInstant(null), false);
  assert.equal(isCalendarInstant(20261102), false);
});

test('only instants that are present and impossible are reported, each under its own path', () => {
  const entries = [
    ['$.a', '2026-11-02T07:00:00.000Z'],
    ['$.b', null],
    ['$.c', '2026-02-31T00:00:00.000Z'],
    ['$.d', '2026-11-02T25:00:00.000Z'],
  ];
  assert.deepEqual(instantProblems(entries), [
    { path: '$.c', problem: 'must be a real calendar instant, got "2026-02-31T00:00:00.000Z"' },
    { path: '$.d', problem: 'must be a real calendar instant, got "2026-11-02T25:00:00.000Z"' },
  ]);
  assert.deepEqual(instantProblems([]), []);
});

test('a schema file is read from beside the module, and a missing one is named', () => {
  const schema = readSchema('autowriter-ledger.schema.json');
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties.attempts);
  assert.throws(() => readSchema('no-such.schema.json'), /no-such\.schema\.json/);
});
