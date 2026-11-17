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

test('a value that satisfies every constraint yields no problems', () => {
  assertAccepted({ type: 'object', required: ['a'], properties: { a: { type: 'string' } } }, { a: 'x' });
});

test('annotation keywords never change the verdict', () => {
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:example',
    $comment: 'note',
    title: 'T',
    description: 'D',
    examples: [1],
    default: 2,
    type: 'integer',
  };

  assertAccepted(schema, 5);
});

test('a problem deep in objects and arrays carries a dollar, dot and bracket path', () => {
  const schema = {
    type: 'object',
    properties: {
      attempts: {
        type: 'array',
        items: { type: 'object', properties: { judgedCommit: { pattern: '^[0-9a-f]{40}$' } } },
      },
    },
  };

  assertRejectedOnce(
    schema,
    { attempts: [{ judgedCommit: 'abc' }] },
    '$.attempts[0].judgedCommit',
    'must match pattern ^[0-9a-f]{40}$'
  );
});

test('every problem is collected in document order', () => {
  const schema = {
    type: 'object',
    properties: { a: { type: 'integer' }, b: { type: 'string' }, c: { type: 'array', items: { type: 'integer' } } },
  };
  const paths = validateJsonSchema(schema, { a: 'x', b: 1, c: [1, 'y', 3, 'z'] }).map((problem) => problem.path);

  assert.deepEqual(paths, ['$.a', '$.b', '$.c[1]', '$.c[3]']);
});
test('required reports the missing key at the key path', () => {
  assertRejectedOnce({ required: ['a', 'b'] }, { a: 1 }, '$.b', 'is required');
});

test('required accepts an object that has every key', () => {
  assertAccepted({ required: ['a'] }, { a: null });
});

test('required ignores an array', () => {
  assertAccepted({ required: ['a'] }, []);
});

test('a property absent from the value is skipped unless required', () => {
  assertAccepted({ properties: { a: { type: 'string' } } }, {});
});

test('additionalProperties false rejects an extra key at the extra key path', () => {
  assertRejectedOnce(
    { properties: { a: {} }, additionalProperties: false },
    { a: 1, extra: 2 },
    '$.extra',
    'unexpected key'
  );
});

test('additionalProperties false accepts an object with only declared keys', () => {
  assertAccepted({ properties: { a: {} }, additionalProperties: false }, { a: 1 });
});

test('additionalProperties as a schema validates every undeclared value', () => {
  const schema = { properties: { a: {} }, additionalProperties: { type: 'integer' } };

  assertRejectedOnce(schema, { a: 'x', b: 1, c: 'y' }, '$.c', 'must be of type integer');
});

test('minProperties rejects an object with fewer keys', () => {
  assertRejectedOnce({ minProperties: 1 }, {}, '$', 'at least 1 properties');
});

test('minProperties accepts an object at the boundary', () => {
  assertAccepted({ minProperties: 1 }, { a: null });
});

test('minProperties ignores an array', () => {
  assertAccepted({ minProperties: 1 }, []);
});

test('items rejects a bad element at its index', () => {
  assertRejectedOnce({ items: { type: 'string' } }, ['a', 2], '$[1]', 'must be of type string');
});

test('items accepts matching elements', () => {
  assertAccepted({ items: { type: 'string' } }, ['a', 'b']);
});

test('minItems rejects a shorter array', () => {
  assertRejectedOnce({ minItems: 2 }, [1], '$', 'at least 2 items');
});

test('maxItems rejects a longer array', () => {
  assertRejectedOnce({ maxItems: 3 }, [1, 2, 3, 4], '$', 'at most 3 items');
});

test('minItems and maxItems accept lengths at both boundaries', () => {
  assertAccepted({ minItems: 1, maxItems: 2 }, [1, 2]);
});

test('uniqueItems rejects deeply equal elements', () => {
  assertRejectedOnce({ uniqueItems: true }, [{ a: [1] }, { a: [1] }], '$', 'unique');
});

test('uniqueItems accepts distinct elements', () => {
  assertAccepted({ uniqueItems: true }, [{ a: 1 }, { a: 2 }, 1, '1']);
});

test('allOf reports the problems of every failing subschema', () => {
  const schema = { allOf: [{ minimum: 5 }, { type: 'integer' }] };

  assert.equal(validateJsonSchema(schema, 1.5).length, 2);
});

test('allOf accepts a value every subschema accepts', () => {
  assertAccepted({ allOf: [{ minimum: 1 }, { maximum: 3 }] }, 2);
});

test('anyOf rejects a value no subschema accepts with one problem at the path', () => {
  assertRejectedOnce(
    { properties: { a: { anyOf: [{ type: 'string' }, { type: 'null' }] } } },
    { a: 1 },
    '$.a',
    'at least one'
  );
});

test('anyOf accepts a value one subschema accepts', () => {
  assertAccepted({ anyOf: [{ type: 'string' }, { type: 'null' }] }, null);
});

test('oneOf rejects a value no subschema accepts', () => {
  assertRejectedOnce({ oneOf: [{ type: 'string' }, { type: 'null' }] }, 1, '$', 'exactly one');
});

test('oneOf rejects a value two subschemas accept', () => {
  assertRejectedOnce({ oneOf: [{ type: 'integer' }, { minimum: 0 }] }, 3, '$', 'exactly one');
});

test('oneOf accepts a value exactly one subschema accepts', () => {
  assertAccepted({ oneOf: [{ type: 'integer' }, { type: 'string' }] }, 3);
});
