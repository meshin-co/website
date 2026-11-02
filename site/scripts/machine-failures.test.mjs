import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { GATE_FINDINGS_VARIABLE, parseGateFindings, recordGateFindings } from './gate-findings.mjs';
import { createFailureLog } from './machine-failures.mjs';

const GATE = 'gate:machine';
const MACHINE_SOURCE = readFileSync(join(import.meta.dirname, 'machine.mjs'), 'utf8');

const scratches = [];
afterEach(() => {
  for (const directory of scratches.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const scratch = () => {
  const directory = mkdtempSync(join(tmpdir(), 'machine-failures-'));
  scratches.push(directory);
  return directory;
};

const record = (log, directory) =>
  recordGateFindings({ gate: GATE, findings: log.records(), env: { [GATE_FINDINGS_VARIABLE]: directory } });

const filled = () => {
  const log = createFailureLog();
  log.add('llms-size', 'llms.txt is 9000 bytes, over the 8192 byte guard', ['/llms.txt']);
  log.add('sidecar-missing', 'no markdown sidecar for /about.md', ['/about.md']);
  log.add('date-agreement', '/about modified dates disagree');
  return log;
};

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

const rawPushes = (source) =>
  [...source.matchAll(/\bfailures\s*\.\s*push\s*\(/g)].map((match) => lineOf(source, match.index));

const written = (directory) => {
  const file = join(directory, 'gate-machine.json');
  assert.ok(existsSync(file), 'gate-machine.json was written');
  return parseGateFindings(readFileSync(file, 'utf8'));
};

test('a failure keeps its rule, its text and its subjects, in the order it was added', () => {
  const log = filled();

  assert.equal(log.size, 3);
  assert.deepEqual(log.texts(), [
    'llms.txt is 9000 bytes, over the 8192 byte guard',
    'no markdown sidecar for /about.md',
    '/about modified dates disagree',
  ]);
  assert.deepEqual(log.records(), [
    {
      rule: 'llms-size',
      subjects: ['/llms.txt'],
      detail: 'llms.txt is 9000 bytes, over the 8192 byte guard',
      excerpt: '',
    },
    { rule: 'sidecar-missing', subjects: ['/about.md'], detail: 'no markdown sidecar for /about.md', excerpt: '' },
    { rule: 'date-agreement', subjects: [], detail: '/about modified dates disagree', excerpt: '' },
  ]);
});

test('a log nobody added to has no text, no record and a size of zero', () => {
  const log = createFailureLog();

  assert.equal(log.size, 0);
  assert.deepEqual(log.texts(), []);
  assert.deepEqual(log.records(), []);
});

test('two logs share nothing', () => {
  const first = createFailureLog();
  const second = createFailureLog();
  first.add('llms-size', 'one');

  assert.equal(first.size, 1);
  assert.equal(second.size, 0);
  assert.deepEqual(second.texts(), []);
});

test('the text comes back exactly as given, so the line printed under MACHINE does not move', () => {
  const texts = ['  padded  ', 'two\nlines', 'x'.repeat(700), 'caf\u00e9 \u2014 \u201cquoted\u201d', ''];
  const log = createFailureLog();
  for (const text of texts) log.add('llms-size', text);

  assert.deepEqual(log.texts(), texts);
  assert.deepEqual(
    log.records().map((entry) => entry.detail),
    texts
  );
});

test('the log hands out its own copies: nothing a caller does to them reaches the log', () => {
  const subjects = ['/llms.txt'];
  const log = createFailureLog();
  log.add('llms-size', 'one', subjects);
  assert.equal(log.size, 1);

  subjects.push('/other');
  log.records()[0].subjects.push('/another');
  log.records()[0].rule = 'changed';
  log.texts().push('extra');

  assert.deepEqual(log.records(), [{ rule: 'llms-size', subjects: ['/llms.txt'], detail: 'one', excerpt: '' }]);
  assert.deepEqual(log.texts(), ['one']);
  assert.equal(log.size, 1);
});

test('addAll tags every text a check returned with one rule, in order, each with its own copy of the subjects', () => {
  const subjects = ['/llms.txt'];
  const log = createFailureLog();
  log.addAll('llms-size', ['one', 'two'], subjects);
  assert.equal(log.size, 2);
  subjects.push('/other');
  log.records()[0].subjects.push('/another');

  assert.deepEqual(log.texts(), ['one', 'two']);
  assert.deepEqual(log.records(), [
    { rule: 'llms-size', subjects: ['/llms.txt'], detail: 'one', excerpt: '' },
    { rule: 'llms-size', subjects: ['/llms.txt'], detail: 'two', excerpt: '' },
  ]);
});

test('addAll of a check that found nothing adds nothing, and its subjects default to none', () => {
  const log = createFailureLog();
  log.addAll('llms-size', []);
  assert.equal(log.size, 0);

  log.addAll('sidecar-content', ['sidecar for /about carries no title']);
  assert.deepEqual(log.records(), [
    { rule: 'sidecar-content', subjects: [], detail: 'sidecar for /about carries no title', excerpt: '' },
  ]);
});

test('addAll keeps nothing when its rule, its list or one of its texts is refused', () => {
  const log = createFailureLog();

  assert.throws(() => log.addAll('Llms-Size', ['one']), { name: 'TypeError', message: /rule id/ });
  assert.throws(() => log.addAll('llms-size', 'one'), { name: 'TypeError', message: /list/ });
  assert.throws(() => log.addAll('llms-size', undefined), { name: 'TypeError', message: /list/ });
  assert.throws(() => log.addAll('llms-size', ['one', 42]), { name: 'TypeError', message: /text/ });
  assert.throws(() => log.addAll('llms-size', ['one'], ['/ok', 7]), { name: 'TypeError', message: /subjects/ });
  assert.equal(log.size, 0);
  assert.deepEqual(log.texts(), []);
});

test('a rule id that is not lowercase words joined by single hyphens is refused, and nothing is kept', () => {
  const refused = [
    'Llms-size',
    'LLMS-SIZE',
    'llms_size',
    'llms size',
    'llms.size',
    'llms:size',
    'llms/size',
    '-llms-size',
    'llms-size-',
    'llms--size',
    ' llms-size',
    'llms-size ',
    'llms-size\n',
    '',
    undefined,
    null,
    42,
    ['llms-size'],
    {},
  ];
  const log = createFailureLog();

  for (const rule of refused) {
    assert.throws(() => log.add(rule, 'text'), { name: 'TypeError', message: /rule id/ }, String(rule));
  }
  assert.equal(log.size, 0);
  assert.deepEqual(log.texts(), []);
});

test('every rule id the machine gate emits is accepted', () => {
  const accepted = ['humans-components-missing', 'llms-size', 'feed-coverage', 'catalog-description-drift', 'a'];
  const log = createFailureLog();
  for (const rule of accepted) assert.doesNotThrow(() => log.add(rule, 'text'), rule);
  assert.equal(log.size, accepted.length);
});

test('a text that is not a string, and subjects that are not a list of strings, are refused', () => {
  const log = createFailureLog();

  for (const text of [undefined, null, 42, ['text'], {}]) {
    assert.throws(() => log.add('llms-size', text), { name: 'TypeError', message: /text/ }, String(text));
  }
  for (const subjects of ['/llms.txt', null, 42, {}, [1], [null], ['/a', undefined]]) {
    assert.throws(
      () => log.add('llms-size', 'text', subjects),
      { name: 'TypeError', message: /subjects/ },
      String(subjects)
    );
  }
  assert.equal(log.size, 0);
});

test('the records pass the findings file the repair loop reads, and come back as they went in', () => {
  const directory = scratch();
  const log = filled();
  record(log, directory);

  const { gate, findings } = written(directory);
  assert.equal(gate, GATE);
  assert.deepEqual(findings, log.records());
});

test('a text longer than 400 characters is cut in the findings file and printed whole', () => {
  const directory = scratch();
  const log = createFailureLog();
  log.add('date-agreement', `/about ${'y'.repeat(500)}`, ['/about']);
  record(log, directory);

  const [finding] = written(directory).findings;
  assert.equal(finding.detail, log.texts()[0].slice(0, 400));
  assert.equal(log.texts()[0].length, 507);
});

test('a subject the findings file refuses fails when it is recorded, so a bad path cannot hide in the log', () => {
  const directory = scratch();
  const log = createFailureLog();
  log.add('llms-size', 'text', ['../escape']);

  assert.throws(() => record(log, directory), /subject 0/);
  assert.equal(existsSync(join(directory, 'gate-machine.json')), false);
});

test('an empty log removes a findings file an earlier run left behind', () => {
  const directory = scratch();
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'gate-machine.json'), 'stale');
  record(createFailureLog(), directory);

  assert.equal(existsSync(join(directory, 'gate-machine.json')), false);
});

test('machine.mjs pushes no failure by hand, so every failure it reports carries a rule id', () => {
  assert.deepEqual(rawPushes(MACHINE_SOURCE), []);
});

test('the push guard sees a failure pushed by hand, on one line or across several', () => {
  assert.deepEqual(rawPushes('failures.push(`x`);'), [1]);
  assert.deepEqual(rawPushes('const a = 1;\nfailures .push (`x`);'), [2]);
  assert.deepEqual(rawPushes('failures\n  .push(`x`);'), [1]);
  assert.deepEqual(rawPushes('failures.add(rule, text);\nfailures.addAll(rule, texts);\ngaps.push(gap);'), []);
  assert.deepEqual(rawPushes('if (a) failures.push(`x`);\nfailures.add(rule, text);\nfailures.push(`y`);'), [1, 3]);
});
