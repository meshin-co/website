import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import test from 'node:test';

import { refuse, restate, rewrite, sharedRewrite, tableOf } from './repair-rows.mjs';

const WHY = 'A sentence of the entry is split.';

test('rewrite names the rewrite, the allowances it grants and why', () => {
  assert.deepEqual(rewrite(WHY, 'takeaways', 'words-down'), {
    repairable: true,
    how: 'rewrite',
    may: ['takeaways', 'words-down'],
    why: WHY,
  });
});

test('rewrite grants nothing unless it is asked to', () => {
  assert.deepEqual(rewrite(WHY).may, []);
});

test('sharedRewrite is a rewrite that marks the finding as shared with other routes', () => {
  assert.deepEqual(sharedRewrite(WHY), { repairable: true, how: 'rewrite', may: [], why: WHY, shared: true });
});

test('restate is a repair that grants nothing and needs no partner by default', () => {
  assert.deepEqual(restate(WHY), { repairable: true, how: 'restate', may: [], why: WHY });
});

test('restate can name the finding that must stand beside it', () => {
  assert.deepEqual(restate(WHY, 'stale-disposition'), {
    repairable: true,
    how: 'restate',
    may: [],
    why: WHY,
    needs: 'stale-disposition',
  });
});

test('refuse is a row no rewrite can satisfy', () => {
  assert.deepEqual(refuse(WHY), { repairable: false, how: null, may: [], why: WHY });
});

test('every row is frozen, allowances included', () => {
  const row = rewrite(WHY, 'takeaways');
  assert.ok(Object.isFrozen(row));
  assert.ok(Object.isFrozen(row.may));
  assert.throws(() => {
    row.may.push('faq');
  }, TypeError);
  assert.throws(() => {
    row.repairable = false;
  }, TypeError);
});

test('a builder refuses a reason that is empty or not text', () => {
  for (const build of [rewrite, sharedRewrite, restate, refuse]) {
    for (const why of ['', '   ', undefined, null, 7, ['x']]) {
      assert.throws(() => build(why), TypeError, `${build.name}(${JSON.stringify(why)})`);
    }
  }
});

test('an allowance must be a name', () => {
  assert.throws(() => rewrite(WHY, ''), TypeError);
  assert.throws(() => rewrite(WHY, 7), TypeError);
});

test('tableOf copies the rows it is given and freezes the table', () => {
  const rows = { 'one-rule': refuse(WHY) };
  const table = tableOf(rows);
  rows['another-rule'] = refuse(WHY);
  assert.deepEqual(Object.keys(table), ['one-rule']);
  assert.ok(Object.isFrozen(table));
  assert.throws(() => {
    table['third-rule'] = refuse(WHY);
  }, TypeError);
});

test('tableOf refuses a rule name that is not lowercase and hyphenated', () => {
  for (const name of ['', 'Upper', 'with space', 'under_score', 'trailing-', '-leading', 'double--dash', '__proto__']) {
    assert.throws(() => tableOf({ [name]: refuse(WHY) }), TypeError, name);
  }
});

test('tableOf refuses a value that is not a row built by a builder', () => {
  assert.throws(() => tableOf({ 'a-rule': { repairable: true } }), TypeError);
  assert.throws(() => tableOf({ 'a-rule': null }), TypeError);
});
