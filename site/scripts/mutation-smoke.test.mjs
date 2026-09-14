import assert from 'node:assert/strict';
import { test } from 'node:test';

import { expectedFailure, FAMILIES, manifestFamilies, parseArgs } from './mutation-smoke.mjs';

test('manifestFamilies accepts the shipped family manifest', () => {
  const families = manifestFamilies(FAMILIES);
  assert.equal(families.length, FAMILIES.length);
  assert.ok(families.every((family) => typeof family.id === 'string'));
});

test('manifestFamilies rejects an unknown kind naming the family', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'wishful-thinking' }]), /x.*unknown kind/);
});

test('manifestFamilies rejects duplicate family ids', () => {
  const entry = { id: 'x', kind: 'unit-covered' };
  assert.throws(() => manifestFamilies([entry, entry]), /duplicate/);
});

test('manifestFamilies rejects a build family without expectation tokens', () => {
  assert.throws(
    () => manifestFamilies([{ id: 'x', kind: 'build', fixture: 'f.md', plant: 'src/data/faq', tokens: [] }]),
    /tokens/
  );
});

test('manifestFamilies rejects a gate family with an unknown gate selector', () => {
  assert.throws(() => manifestFamilies([{ id: 'x', kind: 'gate', gate: 'wishes', tokens: ['t'] }]), /gate/);
});

test('expectedFailure passes only a non-zero exit that names every token', () => {
  assert.equal(expectedFailure({ code: 1, output: 'tags.0: Invalid option' }, ['tags.0']).ok, true);
  assert.equal(expectedFailure({ code: 0, output: 'tags.0: Invalid option' }, ['tags.0']).ok, false);
  assert.equal(expectedFailure({ code: 1, output: 'somewhere else' }, ['tags.0']).ok, false);
  assert.equal(expectedFailure({ code: null, output: 'killed' }, ['tags.0']).ok, false);
});

test('expectedFailure reasons name the unmet expectation', () => {
  assert.match(expectedFailure({ code: 0, output: '' }, ['tags.0']).reason, /exited zero/);
  assert.match(expectedFailure({ code: 1, output: '' }, ['tags.0']).reason, /tags\.0/);
});

test('parseArgs understands only --fast', () => {
  assert.deepEqual(parseArgs([]), { fast: false });
  assert.deepEqual(parseArgs(['--fast']), { fast: true });
  assert.throws(() => parseArgs(['--slow']), /unknown flag/);
});

test('a message wrapped across lines by a narrow terminal still names the field', () => {
  const run = { code: 1, output: 'question: must be 98\n  characters or fewer' };
  assert.equal(expectedFailure(run, ['question: must be 98 characters or fewer']).ok, true);
});

test('colour codes never hide the field name', () => {
  const run = { code: 1, output: '\u001b[31mtitle: must be 98 characters or fewer\u001b[0m' };
  assert.equal(expectedFailure(run, ['title: must be 98 characters or fewer']).ok, true);
});

test('a missed token reports the tail of what the build actually said', () => {
  const result = expectedFailure({ code: 1, output: 'something else entirely' }, ['title: must be 98']);
  assert.equal(result.ok, false);
  assert.match(result.reason, /something else entirely/);
});
