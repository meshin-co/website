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

test('type integer accepts a whole number', () => {
  assertAccepted({ type: 'integer' }, 3);
});

test('type integer rejects a fraction', () => {
  assertRejectedOnce({ type: 'integer' }, 1.5, '$', 'must be of type integer');
});

test('type number rejects NaN', () => {
  assertRejectedOnce({ type: 'number' }, NaN, '$', 'must be of type number');
});

test('type number rejects Infinity', () => {
  assertRejectedOnce({ type: 'number' }, Infinity, '$', 'must be of type number');
});

test('type object rejects an array', () => {
  assertRejectedOnce({ type: 'object' }, [], '$', 'must be of type object');
});

test('type object rejects null', () => {
  assertRejectedOnce({ type: 'object' }, null, '$', 'must be of type object');
});

test('a type union accepts null', () => {
  assertAccepted({ type: ['integer', 'null'] }, null);
});

test('a type union rejects a value of neither type and names both', () => {
  assertRejectedOnce({ type: ['integer', 'null'] }, 'x', '$', 'integer or null');
});

test('const accepts a deeply equal object', () => {
  assertAccepted({ const: { a: [1, { b: 2 }] } }, { a: [1, { b: 2 }] });
});

test('const rejects a different value', () => {
  assertRejectedOnce({ const: 1 }, 2, '$', 'must equal 1');
});

test('enum accepts a member', () => {
  assertAccepted({ enum: ['open', 'merged'] }, 'merged');
});

test('enum rejects a non-member and lists the members', () => {
  assertRejectedOnce({ enum: ['open', 'merged'] }, 'closed', '$', 'must be one of "open", "merged"');
});

test('pattern accepts a match anywhere in the string', () => {
  assertAccepted({ pattern: 'b+' }, 'aabbcc');
});

test('pattern rejects a string without a match', () => {
  assertRejectedOnce({ pattern: '^[0-9a-f]{40}$' }, 'xyz', '$', 'must match pattern ^[0-9a-f]{40}$');
});

test('pattern ignores a number', () => {
  assertAccepted({ pattern: '^a$' }, 7);
});

test('minLength accepts a string at the minimum', () => {
  assertAccepted({ minLength: 2 }, 'ab');
});

test('minLength rejects a shorter string', () => {
  assertRejectedOnce({ minLength: 2 }, 'a', '$', 'at least 2 characters');
});

test('maxLength accepts a string at the maximum', () => {
  assertAccepted({ maxLength: 2 }, 'ab');
});

test('maxLength rejects a longer string', () => {
  assertRejectedOnce({ maxLength: 2 }, 'abc', '$', 'at most 2 characters');
});

test('minimum accepts the boundary', () => {
  assertAccepted({ minimum: 1 }, 1);
});

test('minimum rejects a smaller number', () => {
  assertRejectedOnce({ minimum: 1 }, 0, '$', 'must be >= 1');
});

test('maximum accepts the boundary', () => {
  assertAccepted({ maximum: 5 }, 5);
});

test('maximum rejects a larger number', () => {
  assertRejectedOnce({ maximum: 5 }, 6, '$', 'must be <= 5');
});

test('minimum ignores a string', () => {
  assertAccepted({ minimum: 1 }, 'a');
});
