import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateJsonSchema } from '../../scripts/json-schema.mjs';

const folder = new URL('./spec/evals-baseline-1.0/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('baseline.schema.json', folder), 'utf8'));
const suite = JSON.parse(readFileSync(new URL('vectors.json', folder), 'utf8'));
const page = readFileSync(new URL('./spec/evals-baseline-1.0.md', import.meta.url), 'utf8');

const problemsOf = (document) => validateJsonSchema(schema, document);

function exampleBaseline() {
  const lines = page.split('\n');
  const intro = lines.findIndex((line) => line.startsWith('A baseline recorded from a promptfoo run'));
  assert.notEqual(intro, -1, 'the page no longer introduces its example baseline');
  const block = [];
  for (const line of lines.slice(intro + 1)) {
    if (line.startsWith('    ')) block.push(line.slice(4));
    else if (line.trim() !== '' || block.length > 0) break;
  }
  return JSON.parse(block.join('\n'));
}

const example = exampleBaseline();

test('the schema names the address it is served at', () => {
  const [, name, version] = page.match(/^name: (\S+)\nversion: '([^']+)'$/m) ?? [];
  assert.match(
    schema.$id,
    new RegExp(`^https://[^/]+/spec/${name}/${version.replace('.', '\\.')}/baseline\\.schema\\.json$`)
  );
});

test('every keyword the schema uses is one the repository validator enforces', () => {
  assert.doesNotThrow(() => problemsOf(example));
});

test('the baseline the page shows as its example is valid', () => {
  assert.deepEqual(problemsOf(example), []);
});

test('every baseline a record vector writes is valid', () => {
  const written = suite.vectors.flatMap((vector) => vector.writes.map((file) => ({ id: vector.id, ...file })));
  assert.ok(written.length > 0, 'no vector writes a baseline, so nothing here was checked');
  for (const { id, path, content } of written) {
    assert.deepEqual(problemsOf(JSON.parse(content)), [], `${id} writes ${path}`);
  }
});

const rejects = (name, mutate) =>
  test(`the schema refuses a baseline where ${name}`, () => {
    const document = structuredClone(example);
    mutate(document);
    assert.notDeepEqual(problemsOf(document), [], JSON.stringify(document));
  });

const accepts = (name, mutate) =>
  test(`the schema accepts a baseline where ${name}`, () => {
    const document = structuredClone(example);
    mutate(document);
    assert.deepEqual(problemsOf(document), []);
  });

const metricOf = (document) => document.metrics['agent :: accuracy'];

for (const key of ['spec', 'source', 'recordedAt', 'cases', 'metrics']) {
  rejects(`the top-level key ${key} is missing`, (document) => delete document[key]);
}
rejects('the top level holds a key the table does not name', (document) => (document.extra = 1));
for (const spec of ['1.1', '2.0', '1', '1.0.0', '1.00', '', 1, null]) {
  rejects(`spec is ${JSON.stringify(spec)}`, (document) => (document.spec = spec));
}
for (const key of ['tool', 'toolVersion', 'shape']) {
  rejects(`source.${key} is missing`, (document) => delete document.source[key]);
}
rejects('source holds a key the table does not name', (document) => (document.source.extra = 1));
rejects('source.tool is another tool', (document) => (document.source.tool = 'inspect'));
rejects('source.shape is another shape', (document) => (document.source.shape = 'promptfoo-results-4'));
rejects('a promptfoo baseline names the DeepEval shape', (document) => (document.source.shape = 'deepeval-test-run'));
rejects('a DeepEval baseline names the promptfoo shape', (document) => (document.source.tool = 'deepeval'));
rejects('source.toolVersion is a number', (document) => (document.source.toolVersion = 1));
rejects('source is a list', (document) => (document.source = [document.source]));
for (const recordedAt of [
  '2026-09-02T09:00:00Z',
  '2026-09-02T09:00:00.000+02:00',
  '2026-09-02 09:00:00.000Z',
  '2026-09-02T09:00:00.0000Z',
  '2026-13-02T09:00:00.000Z',
  '2026-09-32T09:00:00.000Z',
  '2026-09-02T24:00:00.000Z',
  '2026-09-02T09:60:00.000Z',
  '2026-09-02',
  1788339600000,
  null,
]) {
  rejects(`recordedAt is ${JSON.stringify(recordedAt)}`, (document) => (document.recordedAt = recordedAt));
}
for (const key of ['count', 'digest']) {
  rejects(`cases.${key} is missing`, (document) => delete document.cases[key]);
}
rejects('cases holds a key the table does not name', (document) => (document.cases.extra = 1));
for (const count of [0, -1, 1.5, '4', null]) {
  rejects(`cases.count is ${JSON.stringify(count)}`, (document) => (document.cases.count = count));
}
for (const digest of ['e6c6ecf167a', 'e6c6ecf167abc', 'E6C6ECF167AB', 'g6c6ecf167ab', '', 123456789012, null]) {
  rejects(`cases.digest is ${JSON.stringify(digest)}`, (document) => (document.cases.digest = digest));
}
for (const metrics of [{}, [], null, 3]) {
  rejects(`metrics is ${JSON.stringify(metrics)}`, (document) => (document.metrics = metrics));
}
for (const key of ['value', 'samples', 'tolerance']) {
  rejects(`a metric lacks ${key}`, (document) => delete metricOf(document)[key]);
}
rejects('a metric holds a key the table does not name', (document) => (metricOf(document).tolerence = 0));
rejects('a metric is a list', (document) => (document.metrics['agent :: accuracy'] = [1, 4, 0]));
for (const value of ['1', null, true, [1]]) {
  rejects(`a metric value is ${JSON.stringify(value)}`, (document) => (metricOf(document).value = value));
}
for (const samples of [0, -4, 1.5, '4', null]) {
  rejects(`a metric samples is ${JSON.stringify(samples)}`, (document) => (metricOf(document).samples = samples));
}
for (const tolerance of [-0.000001, -1, '0', null]) {
  rejects(
    `a metric tolerance is ${JSON.stringify(tolerance)}`,
    (document) => (metricOf(document).tolerance = tolerance)
  );
}
accepts('a DeepEval baseline carries a null tool version', (document) => {
  document.source = { tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run' };
});
accepts('a promptfoo baseline carries a null tool version', (document) => (document.source.toolVersion = null));
accepts('a metric value is negative', (document) => (metricOf(document).value = -0.5));
accepts('a metric tolerance is zero', (document) => (metricOf(document).tolerance = 0));
accepts('a metric key holds a newline and non-Latin text', (document) => {
  document.metrics['agent\n:: точность'] = { value: 1, samples: 4, tolerance: 0 };
});
accepts('the digest holds only digits', (document) => (document.cases.digest = '123456789012'));
accepts(
  'recordedAt is the last millisecond of a year',
  (document) => (document.recordedAt = '2026-12-31T23:59:59.999Z')
);

for (const value of [4000000001, -4000000001]) {
  rejects(`a metric value is ${value}`, (document) => (metricOf(document).value = value));
}
for (const value of [4000000000, -4000000000]) {
  accepts(`a metric value is ${value}`, (document) => (metricOf(document).value = value));
}
rejects('a metric tolerance is 4000000001', (document) => (metricOf(document).tolerance = 4000000001));
accepts('a metric tolerance is 4000000000', (document) => (metricOf(document).tolerance = 4000000000));
