import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MAY } from './repair-guard.mjs';
import { allowancesOf, classifyRule, knownRule, listRows, REASONS, RULES } from './repair-kinds.mjs';

const GATES = ['gate:content', 'gate:editorial', 'gate:human', 'gate:machine', 'gate:registers'];
const SCRIPTS = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const NOT_CLASSIFIED = { repairable: false, how: null, may: [], why: 'not classified' };

const countBy = (how) => listRows().filter((row) => row.how === how).length;

test('the table covers the five gates that upload findings, and each one is an npm script', () => {
  assert.deepEqual(Object.keys(RULES).sort(), GATES);
  for (const gate of GATES) assert.ok(SCRIPTS[gate], `package.json has no script ${gate}`);
});

test('the table holds 83 kinds: 36 rewrites, 2 restates and 45 refusals', () => {
  assert.equal(listRows().length, 83);
  assert.equal(countBy('rewrite'), 36);
  assert.equal(countBy('restate'), 2);
  assert.equal(countBy(null), 45);
});

test('each gate holds the number of kinds its gate can emit', () => {
  const sizes = Object.fromEntries(GATES.map((gate) => [gate, Object.keys(RULES[gate]).length]));
  assert.deepEqual(sizes, {
    'gate:content': 34,
    'gate:editorial': 6,
    'gate:human': 17,
    'gate:machine': 24,
    'gate:registers': 2,
  });
});

test('no rule name belongs to two gates, so a finding filed under the wrong gate is never classified', () => {
  const names = listRows().map((row) => row.rule);
  assert.equal(new Set(names).size, names.length);
});

test('every allowance a row grants is one the removal guard knows', () => {
  for (const row of listRows()) for (const name of row.may) assert.ok(MAY.includes(name), `${row.rule} grants ${name}`);
});

test('seven kinds grant an allowance, and the other 77 grant none', () => {
  const granting = listRows()
    .filter((row) => row.may.length > 0)
    .map((row) => `${row.gate} ${row.rule}: ${row.may.join(',')}`);
  assert.deepEqual(granting.sort(), [
    'gate:content median-sentence: words-down',
    'gate:content takeaways: takeaways',
    'gate:human long-sentences: words-down',
    'gate:human long-word-share: words-down',
    'gate:human reading-ease: words-down',
    'gate:human reading-grade: words-down',
    'gate:human sentence-average: words-down',
  ]);
});

test('an allowance never rides on a refusal or a restate', () => {
  for (const row of listRows()) if (row.how !== 'rewrite') assert.deepEqual([...row.may], [], row.rule);
});

test('listRows lists each kind once with its gate and rule', () => {
  const rows = listRows();
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).slice(0, 2), ['gate', 'rule']);
    assert.equal(typeof row.repairable, 'boolean');
    assert.equal(typeof row.why, 'string');
  }
  assert.equal(new Set(rows.map((row) => `${row.gate} ${row.rule}`)).size, rows.length);
});

test('classifyRule answers with the row of a known kind', () => {
  assert.deepEqual(classifyRule({ gate: 'gate:human', rule: 'reading-grade' }), RULES['gate:human']['reading-grade']);
  assert.equal(classifyRule({ gate: 'gate:content', rule: 'h1-count' }).how, 'rewrite');
  assert.equal(classifyRule({ gate: 'gate:editorial', rule: 'stale-disposition' }).how, 'restate');
  assert.equal(classifyRule({ gate: 'gate:machine', rule: 'llms-size' }).repairable, false);
});

test('every kind in the table is known', () => {
  for (const { gate, rule } of listRows()) assert.equal(knownRule({ gate, rule }), true, `${gate} ${rule}`);
});

const UNKNOWN = [
  ['an unknown gate', { gate: 'gate:nothing', rule: 'h1-count' }],
  ['an unknown rule', { gate: 'gate:content', rule: 'h1-colour' }],
  ['a rule filed under the wrong gate', { gate: 'gate:human', rule: 'h1-count' }],
  ['a gate name without its prefix', { gate: 'content', rule: 'h1-count' }],
  ['a rule in capitals', { gate: 'gate:content', rule: 'H1-COUNT' }],
  ['a rule with trailing space', { gate: 'gate:content', rule: 'h1-count ' }],
  ['an empty rule', { gate: 'gate:content', rule: '' }],
  ['a missing rule', { gate: 'gate:content' }],
  ['a missing gate', { rule: 'h1-count' }],
  ['a numeric rule', { gate: 'gate:content', rule: 7 }],
  ['a null rule', { gate: 'gate:content', rule: null }],
  ['a list as rule', { gate: 'gate:content', rule: ['h1-count'] }],
  ['the constructor', { gate: 'gate:content', rule: 'constructor' }],
  ['__proto__', { gate: 'gate:content', rule: '__proto__' }],
  ['toString', { gate: 'gate:content', rule: 'toString' }],
  ['hasOwnProperty', { gate: 'gate:content', rule: 'hasOwnProperty' }],
  ['a gate named constructor', { gate: 'constructor', rule: 'h1-count' }],
  ['a gate named __proto__', { gate: '__proto__', rule: 'h1-count' }],
  ['nothing at all', undefined],
  ['null', null],
  ['a string', 'gate:content h1-count'],
];

for (const [name, kind] of UNKNOWN) {
  test(`${name} is not classified, never repairable, and known to nobody`, () => {
    assert.deepEqual(classifyRule(kind), NOT_CLASSIFIED);
    assert.equal(knownRule(kind), false);
  });
}

test('the answer for an unknown kind cannot be changed by its caller', () => {
  const answer = classifyRule({ gate: 'gate:nothing', rule: 'nothing' });
  assert.throws(() => {
    answer.repairable = true;
  }, TypeError);
  assert.throws(() => {
    answer.may.push('claims');
  }, TypeError);
  assert.equal(classifyRule(undefined).repairable, false);
});

test('the four refusal reasons are fixed and in the order they are checked', () => {
  assert.deepEqual([...REASONS], ['unclassified-rule', 'not-prose', 'unattributed', 'outside-entry']);
});

const rewriteOf = (...rules) => rules.map(([gate, rule]) => ({ gate, rule }));

test('allowancesOf is empty for no findings', () => {
  assert.deepEqual(allowancesOf({ rewrite: [] }), []);
});

test('allowancesOf names what a whole-entry rule grants', () => {
  assert.deepEqual(allowancesOf({ rewrite: rewriteOf(['gate:human', 'reading-grade']) }), ['words-down']);
});

test('allowancesOf joins the allowances of several rules once each, in the guard order', () => {
  const rewrite = rewriteOf(
    ['gate:human', 'reading-ease'],
    ['gate:content', 'takeaways'],
    ['gate:human', 'reading-grade'],
    ['gate:content', 'takeaways']
  );
  assert.deepEqual(allowancesOf({ rewrite }), ['takeaways', 'words-down']);
  assert.deepEqual(
    allowancesOf({ rewrite }),
    MAY.filter((name) => ['takeaways', 'words-down'].includes(name))
  );
});

test('allowancesOf grants nothing for a rule that grants nothing', () => {
  assert.deepEqual(
    allowancesOf({ rewrite: rewriteOf(['gate:content', 'banned-phrase'], ['gate:human', 'passive-voice']) }),
    []
  );
});

test('allowancesOf grants nothing for a refusal, a restate or an unknown kind', () => {
  const rewrite = rewriteOf(
    ['gate:content', 'doc-drift'],
    ['gate:editorial', 'stale-disposition'],
    ['gate:nothing', 'reading-grade'],
    ['gate:content', 'reading-grade'],
    ['gate:content', 'constructor']
  );
  assert.deepEqual(allowancesOf({ rewrite }), []);
});

test('allowancesOf ignores an item that is not a kind', () => {
  assert.deepEqual(allowancesOf({ rewrite: [null, 'x', {}, { gate: 'gate:human' }, { rule: 'reading-grade' }] }), []);
});

test('allowancesOf returns a list its caller may keep, and every name in it is one the guard knows', () => {
  const rewrite = rewriteOf(['gate:content', 'takeaways'], ['gate:human', 'reading-grade']);
  const first = allowancesOf({ rewrite });
  first.push('claims');
  assert.deepEqual(allowancesOf({ rewrite }), ['takeaways', 'words-down']);
  for (const name of allowancesOf({ rewrite })) assert.ok(MAY.includes(name));
});

test('allowancesOf refuses input that is not a list of findings', () => {
  for (const bad of [undefined, null, {}, { rewrite: 'x' }, { rewrite: {} }])
    assert.throws(() => allowancesOf(bad), TypeError);
});
