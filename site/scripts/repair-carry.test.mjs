import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CARRY_SHARE, CARRY_SHARE_WHOLE_ENTRY, contentWords, uncarried } from './repair-carry.mjs';

const words = (count, tag) => Array.from({ length: count }, (_, at) => `${tag}w${at + 1}x`);
const sentence = (list) => `${list.join(' ')}.`;
const oneBlock = (...sentences) => [sentences];
const eachInItsOwnBlock = (...sentences) => sentences.map((one) => [one]);

test('the shares are the numbers the repair guard documents', () => {
  assert.equal(CARRY_SHARE, 0.5);
  assert.equal(CARRY_SHARE_WHOLE_ENTRY, 0.34);
});

test('content words drop the small words, ignore case and fold a plural or a past tense into the base word', () => {
  const plain = contentWords('The owner names the plan.');
  const varied = contentWords('The Owners of the plan are named.');
  assert.equal(plain.size, 3);
  assert.deepEqual([...varied].sort(), [...plain].sort());
});

test('a number is a content word, so a figure that vanishes counts against the sentence', () => {
  assert.ok(contentWords('ISO 42001 asks for a policy.').has('42001'));
});

test('a sentence of small words only has no content words and so nothing to carry', () => {
  assert.equal(contentWords('It is what it is.').size, 0);
});

test('a sentence kept word for word is carried', () => {
  const before = [sentence(words(10, 'a'))];
  assert.deepEqual(uncarried({ before, after: oneBlock(...before), share: CARRY_SHARE }), []);
});

test('a sentence deleted outright is not carried, however much its neighbours say about the same topic', () => {
  const before = [sentence(words(10, 'a')), sentence(words(10, 'b'))];
  const after = oneBlock(before[1]);
  assert.deepEqual(uncarried({ before, after, share: CARRY_SHARE }), [before[0]]);
});

test('the share is exact: half of the content words carry the sentence, one fewer does not', () => {
  const original = words(10, 'a');
  const before = [sentence(original)];
  const half = oneBlock(sentence([...original.slice(0, 5), ...words(5, 'z')]));
  const fewer = oneBlock(sentence([...original.slice(0, 4), ...words(6, 'z')]));
  assert.deepEqual(uncarried({ before, after: half, share: CARRY_SHARE }), []);
  assert.deepEqual(uncarried({ before, after: fewer, share: CARRY_SHARE }), before);
});

test('the whole-entry share lets a heavier rewrite through: four of ten carry it, three do not', () => {
  const original = words(10, 'a');
  const before = [sentence(original)];
  const four = oneBlock(sentence([...original.slice(0, 4), ...words(6, 'z')]));
  const three = oneBlock(sentence([...original.slice(0, 3), ...words(7, 'z')]));
  assert.deepEqual(uncarried({ before, after: four, share: CARRY_SHARE_WHOLE_ENTRY }), []);
  assert.deepEqual(uncarried({ before, after: three, share: CARRY_SHARE_WHOLE_ENTRY }), before);
});

test('a sentence split in two is carried by the pair, though neither half carries it alone', () => {
  const original = words(10, 'a');
  const before = [sentence(original)];
  const after = oneBlock(sentence(original.slice(0, 5)), sentence(original.slice(5)));
  assert.deepEqual(uncarried({ before, after, share: 0.9 }), []);
});

test('two sentences merged into one are both carried by it', () => {
  const first = words(6, 'a');
  const second = words(6, 'b');
  const before = [sentence(first), sentence(second)];
  assert.deepEqual(uncarried({ before, after: oneBlock(sentence([...first, ...second])), share: CARRY_SHARE }), []);
});

test('a sentence moved to another place is still carried', () => {
  const before = [sentence(words(8, 'a')), sentence(words(8, 'b')), sentence(words(8, 'c'))];
  assert.deepEqual(uncarried({ before, after: oneBlock(before[2], before[0], before[1]), share: CARRY_SHARE }), []);
});

test('two sentences that are not neighbours do not carry a sentence together', () => {
  const original = words(10, 'a');
  const before = [sentence(original)];
  const after = oneBlock(sentence(original.slice(0, 5)), sentence(words(8, 'm')), sentence(original.slice(5)));
  assert.deepEqual(uncarried({ before, after, share: 0.9 }), before);
});

test('two neighbours that sit in different blocks do not carry a sentence together either', () => {
  const original = words(10, 'a');
  const before = [sentence(original)];
  const after = eachInItsOwnBlock(sentence(original.slice(0, 5)), sentence(original.slice(5)));
  assert.deepEqual(uncarried({ before, after, share: 0.9 }), before);
});

test('a sentence with no content words is never reported', () => {
  assert.deepEqual(uncarried({ before: ['It is what it is.'], after: [], share: CARRY_SHARE }), []);
});
