import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateJsonSchema } from '../../scripts/json-schema.mjs';

const schema = JSON.parse(
  readFileSync(new URL('./spec/evals-baseline-1.0/baseline.schema.json', import.meta.url), 'utf8')
);

const baseline = {
  spec: '1.0',
  source: { tool: 'promptfoo', toolVersion: '0.100.0', shape: 'promptfoo-results-3' },
  recordedAt: '2026-09-02T09:00:00.000Z',
  cases: { count: 4, digest: 'e6c6ecf167ab' },
  metrics: { 'agent :: accuracy': { value: 1, samples: 4, tolerance: 0 } },
};

const anchoredFields = [
  { name: 'recordedAt', valid: baseline.recordedAt, put: (document, value) => (document.recordedAt = value) },
  { name: 'cases.digest', valid: baseline.cases.digest, put: (document, value) => (document.cases.digest = value) },
];

const dialects = {
  'ECMAScript, where $ is the end of the text': (pattern) => pattern,
  'Python re.search, where $ also matches before a final line feed': (pattern) =>
    pattern.replace(/\$$/, () => '(?=\\n?$)'),
  'Ruby, where ^ and $ match at every line': (pattern) =>
    pattern.replace(/^\^/, () => '(?<![^\\n])').replace(/\$$/, () => '(?![^\\n])'),
};

function patternNodes(node, found = []) {
  if (Array.isArray(node)) node.forEach((child) => patternNodes(child, found));
  else if (node !== null && typeof node === 'object') {
    if (typeof node.pattern === 'string') found.push(node);
    Object.values(node).forEach((child) => patternNodes(child, found));
  }
  return found;
}

function schemaUnder(dialect) {
  const copy = structuredClone(schema);
  for (const node of patternNodes(copy)) node.pattern = dialect(node.pattern);
  return copy;
}

const withLineBreaks = (text) => [`${text}\n`, `${text}\n\n`, `${text}\r\n`, `\n${text}`, `zz\n${text}`, `${text}\nzz`];

test('the schema holds the two anchored patterns this test models, so it checked something', () => {
  assert.equal(patternNodes(schema).length, anchoredFields.length);
});

test('every pattern is anchored at both ends and sits beside one exact length, because $ ends the text in only some engines', () => {
  for (const node of patternNodes(schema)) {
    assert.match(node.pattern, /^\^.*\$$/, node.pattern);
    assert.ok(Number.isInteger(node.minLength), `${node.pattern} states no minLength`);
    assert.equal(node.maxLength, node.minLength, `${node.pattern} states no maxLength equal to its minLength`);
  }
});

for (const [dialect, rewrite] of Object.entries(dialects)) {
  const modelled = schemaUnder(rewrite);

  test(`${dialect}: the valid baseline is accepted`, () => {
    assert.deepEqual(validateJsonSchema(modelled, baseline), []);
  });

  for (const { name, valid, put } of anchoredFields) {
    test(`${dialect}: ${name} with a line break before, after or around it is refused`, () => {
      for (const text of withLineBreaks(valid)) {
        const document = structuredClone(baseline);
        put(document, text);
        assert.notDeepEqual(validateJsonSchema(modelled, document), [], `${name} ${JSON.stringify(text)} was accepted`);
      }
    });
  }
}
