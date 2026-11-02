import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { findingsFileName, parseGateFindings, recordGateFindings } from './gate-findings.mjs';
import { contentRecords, humanRecords, registerRecords } from './gate-records.mjs';

const DOC = 'docs/SEMANTIC-CORE.md';
const DRIFT_DETAIL = 'generated table differs from docs/SEMANTIC-CORE.md';

const content = (overrides) => ({
  route: '/blog/x',
  rule: 'h1-count',
  excerpt: 'Title',
  detail: '2 h1 elements',
  ...overrides,
});
const drift = (route) => ({ route, rule: 'doc-drift', detail: DRIFT_DETAIL, excerpt: '' });
const shared = (route) => ({ route, rule: 'duplicate-sentence', excerpt: 'an ai register is the list', detail: 'x' });
const human = (overrides) => ({ route: '/about', rule: 'reading-grade', detail: '14.2 > 12.5', ...overrides });
const subjectsOf = (records) => records.map((record) => record.subjects);

test('a content finding naming a built route is recorded against it, with detail and excerpt untouched', () => {
  const records = contentRecords([content()]);

  assert.deepEqual(records, [{ rule: 'h1-count', subjects: ['/blog/x'], detail: '2 h1 elements', excerpt: 'Title' }]);
  assert.deepEqual(
    records.flatMap((record) => Object.keys(record).sort()),
    ['detail', 'excerpt', 'rule', 'subjects']
  );
});

test('the home route is a subject like any other', () => {
  assert.deepEqual(subjectsOf(contentRecords([content({ route: '/' })])), [['/']]);
});

test('doc drift is the fault of the document, and the drifted route moves into the excerpt', () => {
  assert.deepEqual(contentRecords([drift('/pricing')]), [
    { rule: 'doc-drift', subjects: [DOC], detail: DRIFT_DETAIL, excerpt: '/pricing' },
  ]);
});

test('five drifted routes give five different records, not five copies of one', () => {
  const routes = ['/', '/about', '/pricing', '/blog/a', '/glossary/b'];

  const records = contentRecords(routes.map(drift));

  assert.equal(new Set(records.map((record) => JSON.stringify(record))).size, 5);
  assert.deepEqual(
    records.map((record) => record.excerpt),
    routes
  );
  assert.deepEqual(subjectsOf(records), [[DOC], [DOC], [DOC], [DOC], [DOC]]);
});

test('a structural drift has no route and is still the fault of the document', () => {
  const detail = 'generated headings or grammar lines differ from docs/SEMANTIC-CORE.md';

  assert.deepEqual(contentRecords([{ route: null, rule: 'doc-drift-structure', detail, excerpt: '' }]), [
    { rule: 'doc-drift-structure', subjects: [DOC], detail, excerpt: '' },
  ]);
});

test('a sentence shared by several routes is recorded against every one of them', () => {
  assert.deepEqual(contentRecords([shared('/pricing + /about + /contact')]), [
    {
      rule: 'duplicate-sentence',
      subjects: ['/pricing', '/about', '/contact'],
      detail: 'x',
      excerpt: 'an ai register is the list',
    },
  ]);
  assert.deepEqual(subjectsOf(contentRecords([shared('/pricing')])), [['/pricing']]);
});

test('only a duplicate sentence is split on the plus sign: any other rule keeps its route whole', () => {
  assert.deepEqual(subjectsOf(contentRecords([content({ route: '/a + /b' })])), [['/a + /b']]);
});

test('a finding with no route, or one that is not a route, names no subject', () => {
  for (const route of [null, undefined, '', 'dist', 'blog/x']) {
    assert.deepEqual(subjectsOf(contentRecords([content({ route })])), [[]], String(route));
  }
  assert.deepEqual(subjectsOf(contentRecords([shared(null)])), [[]]);
});

test('a human finding is recorded against the route it names, and a missing excerpt is an empty one', () => {
  assert.deepEqual(humanRecords([human()]), [
    { rule: 'reading-grade', subjects: ['/about'], detail: '14.2 > 12.5', excerpt: '' },
  ]);
  assert.deepEqual(humanRecords([human({ excerpt: 'the longest sentence' })]), [
    { rule: 'reading-grade', subjects: ['/about'], detail: '14.2 > 12.5', excerpt: 'the longest sentence' },
  ]);
});

test('the two findings about the whole tree name no subject, though their route is a directory', () => {
  for (const route of ['/var/build/site/dist', 'dist']) {
    for (const rule of ['no-pages', 'nothing-measured']) {
      assert.deepEqual(humanRecords([human({ route, rule, detail: 'nothing was checked' })]), [
        { rule, subjects: [], detail: 'nothing was checked', excerpt: '' },
      ]);
    }
  }
});

test('every register finding is the fault of the document, whatever its rule', () => {
  const drifted = { rule: 'registers-drift', detail: 'run npm run assets:registers and commit the result' };
  const missing = { rule: 'registers-markers-missing', detail: DOC };

  assert.deepEqual(registerRecords([drifted, missing]), [
    { rule: 'registers-drift', subjects: [DOC], detail: drifted.detail, excerpt: '' },
    { rule: 'registers-markers-missing', subjects: [DOC], detail: DOC, excerpt: '' },
  ]);
});

test('a finding that carries no detail or excerpt gets empty strings, never undefined', () => {
  assert.deepEqual(contentRecords([{ route: '/a', rule: 'h1-count' }]), [
    { rule: 'h1-count', subjects: ['/a'], detail: '', excerpt: '' },
  ]);
  assert.deepEqual(humanRecords([{ route: '/a', rule: 'passive-voice' }]), [
    { rule: 'passive-voice', subjects: ['/a'], detail: '', excerpt: '' },
  ]);
  assert.deepEqual(registerRecords([{ rule: 'registers-drift' }]), [
    { rule: 'registers-drift', subjects: [DOC], detail: '', excerpt: '' },
  ]);
});

test('no findings give no records, and every finding gives one record, in order', () => {
  for (const records of [contentRecords, humanRecords, registerRecords]) assert.deepEqual(records([]), []);

  const findings = [content({ route: '/b' }), drift('/a'), content({ route: '/b' }), shared('/a + /b')];

  assert.deepEqual(
    contentRecords(findings).map((record) => record.rule),
    ['h1-count', 'doc-drift', 'h1-count', 'duplicate-sentence']
  );
});

test('the findings that go in are never changed', () => {
  const findings = [drift('/a'), shared('/a + /b'), content({ route: null })];
  const before = structuredClone(findings);

  contentRecords(findings);

  assert.deepEqual(findings, before);
});

test('what the mappers return is accepted by the strict findings schema and parses back unchanged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gate-records-'));
  const batches = [
    ['gate:content', contentRecords([content(), drift('/a'), shared('/a + /b'), content({ route: null })])],
    ['gate:human', humanRecords([human(), human({ route: '/var/build/dist', rule: 'no-pages' })])],
    ['gate:registers', registerRecords([{ rule: 'registers-drift', detail: 'run it' }])],
  ];
  try {
    for (const [gate, findings] of batches) {
      assert.notDeepEqual(findings, []);
      recordGateFindings({ gate, findings, env: { GATE_FINDINGS_DIR: directory } });
      const written = parseGateFindings(readFileSync(join(directory, findingsFileName(gate)), 'utf8'));
      assert.deepEqual(written, { gate, findings });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
