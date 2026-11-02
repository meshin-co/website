import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { RULES } from './repair-kinds.mjs';

const RULE_ID = '[a-z0-9]+(?:-[a-z0-9]+)*';

const PATTERNS = {
  field: new RegExp(String.raw`\brule:\s*'(${RULE_ID})'`, 'g'),
  add: new RegExp(String.raw`\badd\(\s*'(${RULE_ID})'`, 'g'),
  record: new RegExp(String.raw`\brecord\(\s*'(${RULE_ID})'`, 'g'),
};

const SOURCES = {
  'gate:content': [
    ['content-rows.mjs', ['add']],
    ['content-gate.mjs', ['field']],
    ['prose-rules.mjs', ['field']],
    ['semantic-core.mjs', ['field', 'add']],
    ['booking-cta.mjs', ['field']],
  ],
  'gate:human': [['human-gate.mjs', ['field']]],
  'gate:registers': [['registers.mjs', ['field']]],
  'gate:editorial': [['editorial-findings.mjs', ['record']]],
};

const DYNAMIC = [
  {
    file: 'content-rows.mjs',
    site: 'add(violation.rule,',
    why: 'forwards the ids that paragraphViolations declares as literals in prose-rules.mjs',
  },
  {
    file: 'content-gate.mjs',
    site: 'rule: hit.rule',
    why: 'forwards the ids that MACHINE_PATTERNS and DENSITY_RULES declare as literals in prose-rules.mjs',
  },
  {
    file: 'prose-rules.mjs',
    site: 'MACHINE_PATTERNS.flatMap(({ rule, pattern })',
    why: 'reads back the rule literals the same file declares in MACHINE_PATTERNS',
  },
  {
    file: 'prose-rules.mjs',
    site: 'DENSITY_RULES.flatMap(({ rule, pattern',
    why: 'reads back the rule literals the same file declares in DENSITY_RULES',
  },
  {
    file: 'semantic-core.mjs',
    site: 'const add = (rule, detail) =>',
    why: 'a helper whose callers pass the ids as literals, which the add pattern reads',
  },
];

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

const idsIn = (text, names) =>
  new Set(names.flatMap((name) => [...text.matchAll(PATTERNS[name])].map((match) => match[1])));

const emittedBy = (gate, source = read) =>
  new Set(SOURCES[gate].flatMap(([file, names]) => [...idsIn(source(file), names)]));

const coverageOf = ({ emitted, table }) => ({
  unknown: [...emitted].filter((id) => !Object.hasOwn(table, id)).sort(),
  dead: Object.keys(table)
    .filter((id) => !emitted.has(id))
    .sort(),
});

const planted = (changes) => (file) => `${read(file)}\n${changes[file] ?? ''}\n`;

for (const gate of Object.keys(SOURCES)) {
  test(`every rule id the ${gate} sources declare is a row, and every row is still declared`, () => {
    const emitted = emittedBy(gate);
    assert.ok(emitted.size > 0, `no rule id was found in the ${gate} sources`);
    assert.deepEqual(coverageOf({ emitted, table: RULES[gate] }), { unknown: [], dead: [] });
  });
}

test('the scan sees a rule the table does not know, and a row no source declares', () => {
  const table = RULES['gate:registers'];
  const unknown = coverageOf({ emitted: new Set([...Object.keys(table), 'planted-rule']), table });
  assert.deepEqual(unknown, { unknown: ['planted-rule'], dead: [] });
  const dead = coverageOf({ emitted: new Set(['registers-drift']), table });
  assert.deepEqual(dead, { unknown: [], dead: ['registers-markers-missing'] });
});

const PLANTS = [
  ['gate:content', 'content-rows.mjs', "add('planted-rule', excerpt, detail);"],
  ['gate:content', 'content-gate.mjs', "findings.push({ route, rule: 'planted-rule' });"],
  ['gate:content', 'prose-rules.mjs', "{ rule: 'planted-rule', pattern: /x/g },"],
  ['gate:content', 'semantic-core.mjs', "add('planted-rule', 'detail');"],
  ['gate:content', 'booking-cta.mjs', "rule: 'planted-rule',"],
  ['gate:human', 'human-gate.mjs', "findings.push({ rule: 'planted-rule', detail: 'x' });"],
  ['gate:registers', 'registers.mjs', "return [{ rule: 'planted-rule', detail: 'x' }];"],
  ['gate:editorial', 'editorial-findings.mjs', "record('planted-rule', subjects, detail);"],
];

for (const [gate, file, line] of PLANTS) {
  test(`a rule planted in ${file} is reported as unknown to the table of ${gate}`, () => {
    const emitted = emittedBy(gate, planted({ [file]: line }));
    assert.deepEqual(coverageOf({ emitted, table: RULES[gate] }).unknown, ['planted-rule']);
  });
}

test('the field pattern reads a rule property written as a literal, over one line or several', () => {
  assert.deepEqual([...idsIn("findings.push({ route, rule: 'one-rule', detail });", ['field'])], ['one-rule']);
  assert.deepEqual([...idsIn("{ rule:\n    'split-over-lines' }", ['field'])], ['split-over-lines']);
  assert.deepEqual(
    [...idsIn("a({ rule: 'first' }); b({ rule: 'second-rule' });", ['field'])],
    ['first', 'second-rule']
  );
});

test('the field pattern ignores a computed id, another property that ends in rule, and other quotes', () => {
  assert.deepEqual([...idsIn('findings.push({ rule: hit.rule });', ['field'])], []);
  assert.deepEqual([...idsIn("const x = { subrule: 'not-a-rule' };", ['field'])], []);
  assert.deepEqual([...idsIn('const x = { rule: "double-quoted" };', ['field'])], []);
  assert.deepEqual([...idsIn('const x = { rule: `template` };', ['field'])], []);
  assert.deepEqual([...idsIn("const x = { rule: 'Upper-Case' };", ['field'])], []);
});

test('the add pattern reads a call that passes the id first, and ignores a method named like it', () => {
  assert.deepEqual([...idsIn("add('one-rule', excerpt, detail)", ['add'])], ['one-rule']);
  assert.deepEqual([...idsIn("findings.add(\n  'two-rule', x)", ['add'])], ['two-rule']);
  assert.deepEqual([...idsIn('add(violation.rule, excerpt)', ['add'])], []);
  assert.deepEqual([...idsIn("padd('not-a-rule')", ['add'])], []);
  assert.deepEqual([...idsIn("add(rule, 'detail')", ['add'])], []);
});

test('the record pattern reads the id a record call names, and ignores another call', () => {
  assert.deepEqual([...idsIn("record('one-rule', subjects, detail)", ['record'])], ['one-rule']);
  assert.deepEqual([...idsIn("recordGateFindings({ gate: 'gate:content' })", ['record'])], []);
  assert.deepEqual([...idsIn('record(rule, subjects)', ['record'])], []);
});

test('each place a rule id is forwarded rather than written is named, with the reason, and still exists', () => {
  for (const { file, site, why } of DYNAMIC) {
    assert.ok(read(file).includes(site), `${file} no longer holds "${site}": ${why}`);
    assert.ok(why.length > 20);
  }
  const scanned = new Set(Object.values(SOURCES).flatMap((entries) => entries.map(([file]) => file)));
  for (const { file } of DYNAMIC) assert.ok(scanned.has(file), `${file} is not one of the scanned sources`);
});
