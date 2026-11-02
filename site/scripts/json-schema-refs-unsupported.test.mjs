import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateJsonSchema } from './json-schema.mjs';

function assertRejectedOnce(schema, value, path, fragment) {
  const problems = validateJsonSchema(schema, value);

  assert.equal(problems.length, 1, JSON.stringify(problems));
  assert.equal(problems[0].path, path);
  assert.ok(problems[0].problem.includes(fragment), problems[0].problem);
}

function assertAccepted(schema, value) {
  assert.deepEqual(validateJsonSchema(schema, value), []);
}

test('a $ref to a $defs entry reports problems at the referencing path', () => {
  const schema = {
    $defs: { sha: { type: 'string', pattern: '^[0-9a-f]{4}$' } },
    properties: { head: { $ref: '#/$defs/sha' } },
  };

  assertRejectedOnce(schema, { head: 'zzzz' }, '$.head', 'must match pattern');
});

test('a $ref to a $defs entry accepts a conforming value', () => {
  assertAccepted({ $defs: { sha: { type: 'string' } }, items: { $ref: '#/$defs/sha' } }, ['a']);
});

test('a recursive $ref validates a nested value', () => {
  const schema = {
    $defs: { node: { type: 'object', properties: { next: { $ref: '#/$defs/node' } } } },
    $ref: '#/$defs/node',
  };

  assertRejectedOnce(schema, { next: { next: 3 } }, '$.next.next', 'must be of type object');
});

test('a $ref that points at a missing $defs entry throws', () => {
  assert.throws(() => validateJsonSchema({ $ref: '#/$defs/missing' }, 1), /json-schema.*\$ref.*#\/\$defs\/missing/);
});

test('an external $ref throws', () => {
  assert.throws(() => validateJsonSchema({ $ref: 'https://example.com/a.json' }, 1), /json-schema.*\$ref/);
});

test('a $ref to a pointer outside $defs throws', () => {
  const schema = { properties: { a: { type: 'string' }, b: { $ref: '#/properties/a' } } };

  assert.throws(() => validateJsonSchema(schema, {}), /json-schema.*\$ref/);
});

test('a $ref that only refers to itself throws instead of recursing forever', () => {
  const schema = { $defs: { loop: { $ref: '#/$defs/loop' } }, $ref: '#/$defs/loop' };

  assert.throws(() => validateJsonSchema(schema, 1), /json-schema.*cycle/);
});

const UNSUPPORTED_KEYWORDS = {
  format: 'email',
  if: { type: 'string' },
  then: { minLength: 1 },
  else: { minLength: 2 },
  not: { type: 'string' },
  patternProperties: { '^a': {} },
  propertyNames: { pattern: '^a' },
  dependentRequired: { a: ['b'] },
  contains: { type: 'string' },
  multipleOf: 2,
  exclusiveMinimum: 1,
  prefixItems: [{ type: 'string' }],
  unevaluatedProperties: false,
};

for (const [keyword, argument] of Object.entries(UNSUPPORTED_KEYWORDS)) {
  test('the unsupported keyword ' + keyword + ' throws naming the keyword and its schema path', () => {
    const schema = { properties: { verdict: { [keyword]: argument } } };
    const expected = new RegExp('json-schema.*"' + keyword + '".*#/properties/verdict');

    assert.throws(() => validateJsonSchema(schema, {}), expected);
  });
}

test('an unsupported keyword at the root names the root path', () => {
  assert.throws(() => validateJsonSchema({ format: 'email' }, 'a@b.c'), /json-schema.*"format".* at #$/);
});

test('an unsupported keyword inside items throws with the items path', () => {
  assert.throws(() => validateJsonSchema({ items: { not: {} } }, []), /json-schema.*"not".*#\/items/);
});

test('an unsupported keyword inside an unreferenced $defs entry throws', () => {
  assert.throws(
    () => validateJsonSchema({ $defs: { unused: { multipleOf: 2 } } }, 1),
    /json-schema.*"multipleOf".*#\/\$defs\/unused/
  );
});

test('an unsupported keyword inside allOf throws with the allOf index', () => {
  assert.throws(() => validateJsonSchema({ allOf: [{}, { format: 'uri' }] }, 1), /json-schema.*"format".*#\/allOf\/1/);
});

test('an unsupported keyword inside additionalProperties throws', () => {
  assert.throws(
    () => validateJsonSchema({ additionalProperties: { contains: {} } }, {}),
    /json-schema.*"contains".*#\/additionalProperties/
  );
});

test('an unsupported keyword inside oneOf throws even though the value is valid', () => {
  assert.throws(
    () => validateJsonSchema({ oneOf: [{ type: 'integer' }, { if: {} }] }, 1),
    /json-schema.*"if".*#\/oneOf\/1/
  );
});

test('an unknown type name throws', () => {
  assert.throws(() => validateJsonSchema({ type: 'float' }, 1), /json-schema.*"type"/);
});

test('an unknown type name inside a type array throws', () => {
  assert.throws(() => validateJsonSchema({ type: ['string', 'date'] }, 'a'), /json-schema.*"type"/);
});

test('a required that is not an array throws', () => {
  assert.throws(() => validateJsonSchema({ required: 'a' }, {}), /json-schema.*"required"/);
});

test('a required array holding a non-string throws', () => {
  assert.throws(() => validateJsonSchema({ required: ['a', 1] }, {}), /json-schema.*"required"/);
});

test('a pattern that is not a valid regular expression throws', () => {
  assert.throws(() => validateJsonSchema({ pattern: '(' }, 'a'), /json-schema.*"pattern"/);
});

test('a subschema that is not an object throws', () => {
  assert.throws(() => validateJsonSchema({ properties: { a: 'string' } }, {}), /json-schema.*#\/properties\/a/);
});
