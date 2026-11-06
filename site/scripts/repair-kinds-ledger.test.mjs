import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { EDITORIAL_KINDS, REGISTER_KINDS } from './repair-kinds-ledger.mjs';

const DECIDED = {
  editorial: {
    'unreviewed-copy': ['restate', 'stale-disposition'],
    'untraceable-copy': ['refuse'],
    'dead-copy': ['refuse'],
    'stale-disposition': ['restate'],
    'invalid-conditional-declaration': ['refuse'],
    'disposition-target-missing': ['refuse'],
  },
  registers: {
    'registers-drift': ['refuse'],
    'registers-markers-missing': ['refuse'],
  },
};

const TABLES = { editorial: EDITORIAL_KINDS, registers: REGISTER_KINDS };

const oneSentence = (why) => {
  assert.equal(typeof why, 'string');
  assert.match(why, /^[A-Z0-9][^\n]*[.]$/);
  assert.ok(why.length <= 240, `${why.length} characters`);
  assert.doesNotMatch(why, /[.!?]\s+[A-Z]/);
};

for (const [name, decided] of Object.entries(DECIDED)) {
  for (const [rule, [kind, needs]] of Object.entries(decided)) {
    test(`gate:${name} ${rule} is ${kind}${needs ? ` beside a ${needs}` : ''}`, () => {
      const row = TABLES[name][rule];
      assert.ok(row, `the ${name} table has no row for ${rule}`);
      assert.equal(row.repairable, kind !== 'refuse');
      assert.equal(row.how, kind === 'refuse' ? null : kind);
      assert.deepEqual([...row.may], []);
      assert.equal(row.shared, undefined);
      assert.equal(row.needs, needs);
      oneSentence(row.why);
    });
  }
}

test('the editorial table holds exactly the 6 rules of the editorial gate', () => {
  assert.deepEqual(Object.keys(EDITORIAL_KINDS).sort(), Object.keys(DECIDED.editorial).sort());
});

test('the registers table holds exactly the 2 rules of the registers gate', () => {
  assert.deepEqual(Object.keys(REGISTER_KINDS).sort(), Object.keys(DECIDED.registers).sort());
});

test('a restate row never grants an allowance, because a restate writes no prose', () => {
  for (const [rule, row] of Object.entries(EDITORIAL_KINDS)) {
    if (row.how === 'restate') assert.deepEqual([...row.may], [], rule);
  }
});

test('a row that needs a partner names a restate rule of the same gate', () => {
  for (const [rule, row] of Object.entries(EDITORIAL_KINDS)) {
    if (row.needs === undefined) continue;
    assert.equal(row.how, 'restate', rule);
    assert.equal(EDITORIAL_KINDS[row.needs]?.how, 'restate', `${rule} needs ${row.needs}`);
    assert.equal(EDITORIAL_KINDS[row.needs].needs, undefined, `${row.needs} must not wait on a partner`);
  }
});
