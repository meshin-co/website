import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { insertPassage } from './route-derive.mjs';
import { parseBuyerPrompts } from './semantic-core.mjs';
import { CORE_TEXT, GENERATED_LAYER, REGISTERS } from './fixtures/semantic-core-doc.mjs';
import { WriterError } from './writer-error.mjs';

const ROUTE = '/glossary/model-registry';
const PASSAGE = 'A registry row says which model runs where.';
const NEW_LINE = `Passage: "${PASSAGE}" (\`${ROUTE}\`)`;

const insert = (promptNumber, text = CORE_TEXT, overrides = {}) =>
  insertPassage(text, { promptNumber, passage: PASSAGE, route: ROUTE, ...overrides });

const passagesOf = (text, number) => parseBuyerPrompts(text).find((prompt) => prompt.number === number).passages;

const lineAfter = (text, line) => {
  const lines = text.split('\n');
  return lines[lines.indexOf(line) + 1];
};

test('the passage goes after the last passage line of the prompt, before the Why line', () => {
  const text = insert(1);
  const lines = text.split('\n');
  const second = lines.indexOf('Passage: "Second passage." (`/b`)');

  assert.equal(lines[second + 1], NEW_LINE);
  assert.equal(lines[second + 2], 'Why: because.');
});

test('with no passage line it goes after the Must win line', () => {
  assert.equal(lineAfter(insert(2), 'Must win: `/c`.'), NEW_LINE);
});

test('with neither it goes after the heading line', () => {
  assert.equal(lineAfter(insert(3), '**3. third prompt**'), NEW_LINE);
});

test('a Must win entry that wraps onto more lines is not cut in the middle', () => {
  const text = insert(5);

  assert.equal(lineAfter(text, 'and a continuation line that names `/f`.'), NEW_LINE);
  assert.equal(lineAfter(text, 'Must win: `/d`, support `/e`'), 'and a continuation line that names `/f`.');
});

test('two prompts that share one block get the line after the shared Must win entry, whichever number is named', () => {
  for (const number of [6, 7]) {
    const text = insert(number);
    assert.equal(lineAfter(text, 'Must win: nothing. Retired by a decision.'), NEW_LINE, `prompt ${number}`);
    assert.deepEqual(passagesOf(text, 6), passagesOf(text, 7));
  }
});

test('prompt 2 is not confused with prompt 22', () => {
  const text = insert(2);

  assert.deepEqual(passagesOf(text, 22), [{ text: 'Twenty-second passage.', route: '/z' }]);
  assert.deepEqual(passagesOf(text, 2), [{ text: PASSAGE, route: ROUTE }]);
});

test('parseBuyerPrompts reads the passage back for that route, on every prompt of the fixture', () => {
  for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 22]) {
    assert.ok(
      passagesOf(insert(number), number).some((passage) => passage.text === PASSAGE && passage.route === ROUTE),
      `prompt ${number}`
    );
  }
});

test('the other prompts read exactly as before', () => {
  const before = parseBuyerPrompts(CORE_TEXT);
  const after = parseBuyerPrompts(insert(2));

  for (const prompt of before.filter(({ number }) => number !== 2))
    assert.deepEqual(
      after.find(({ number }) => number === prompt.number),
      prompt
    );
});

test('a passage written without a route keeps counting for the page it counted for, and the new one is added', () => {
  const text = insert(4);

  assert.deepEqual(passagesOf(text, 4), [
    { text: 'A passage written without a route.', route: '/blog/bare' },
    { text: PASSAGE, route: ROUTE },
  ]);
  assert.ok(text.includes('Passage: "A passage written without a route." (`/blog/bare`) (article lead)'));
});

test('the only lines that change are the new one and, for a bare passage, that passage line', () => {
  const before = CORE_TEXT.split('\n');
  for (const [number, converted] of [
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 1],
    [5, 0],
    [8, 0],
  ]) {
    const after = insert(number).split('\n');
    const added = after.filter((line) => !before.includes(line));
    const removed = before.filter((line) => !after.includes(line));

    assert.equal(after.length, before.length + 1, `prompt ${number}`);
    assert.equal(added.length, 1 + converted, `prompt ${number}`);
    assert.equal(removed.length, converted, `prompt ${number}`);
    assert.ok(added.includes(NEW_LINE));
  }
});

test('calling it again with the same passage and route changes nothing', () => {
  for (const number of [1, 2, 3, 4]) {
    const once = insert(number);
    assert.equal(insert(number, once), once, `prompt ${number}`);
  }
});

test('a passage already on the prompt, written without a route, is not added a second time', () => {
  const same = insert(4, CORE_TEXT, { passage: 'A passage written without a route.', route: '/blog/bare' });

  assert.equal(same, CORE_TEXT);
});

test('the generated layer and the registers are byte for byte what they were, also for the last prompt', () => {
  for (const number of [1, 8]) {
    const text = insert(number);

    assert.ok(text.includes(GENERATED_LAYER), `prompt ${number}`);
    assert.ok(text.includes(REGISTERS), `prompt ${number}`);
  }
});

test('the last prompt gets the line at the top of its block, not after the registers that follow it', () => {
  const text = insert(8);

  assert.equal(lineAfter(text, 'Passage: "Last passage." (`/last`)'), NEW_LINE);
  assert.ok(text.indexOf(NEW_LINE) < text.indexOf('<!-- REGISTERS:BEGIN -->'));
});

test('a prompt that is not in the document is refused, naming the number', () => {
  assert.throws(
    () => insert(31),
    (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes('31')
  );
});

test('a document with no buyer-prompt section is refused', () => {
  assert.throws(
    () => insert(1, CORE_TEXT.replace('### The 30 buyer prompts', '### Something else')),
    (error) => error instanceof WriterError && error.kind === 'build'
  );
});

test('a passage the parser could not read back is refused before any text changes', () => {
  const refused = [
    { passage: 'He said "no" twice.' },
    { passage: 'Two\nlines.' },
    { passage: '' },
    { passage: ' padded ' },
    { route: 'glossary/no-slash' },
    { route: '/with`tick' },
    { route: '/with space' },
  ];
  for (const overrides of refused)
    assert.throws(
      () => insert(2, CORE_TEXT, overrides),
      (error) => error instanceof WriterError && error.kind === 'build',
      JSON.stringify(overrides)
    );
});

const REAL_CORE = readFileSync(fileURLToPath(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url)), 'utf8');
const NUMBERS = parseBuyerPrompts(REAL_CORE).map(({ number }) => number);

const numbersSharingABlockWith = (doc, number) => {
  const paragraph = doc.split('\n\n').find((chunk) => new RegExp(`^\\*\\*${number}\\.`, 'm').test(chunk));
  return [...paragraph.matchAll(/^\*\*(\d+)\./gm)].map((match) => Number(match[1]));
};

test('on the real document every prompt reads back the new passage, and every passage it had keeps counting', () => {
  const before = parseBuyerPrompts(REAL_CORE);
  assert.ok(before.length > 0, 'the real document holds no buyer prompt');

  for (const number of NUMBERS) {
    const after = parseBuyerPrompts(insert(number, REAL_CORE));
    const chosen = after.find((prompt) => prompt.number === number);

    assert.ok(
      chosen.passages.some((passage) => passage.text === PASSAGE && passage.route === ROUTE),
      `prompt ${number}`
    );
    for (const was of before.find((prompt) => prompt.number === number).passages)
      assert.ok(
        chosen.passages.some((passage) => passage.text === was.text && passage.route === was.route),
        `prompt ${number} lost "${was.text.slice(0, 40)}"`
      );
    const sharing = numbersSharingABlockWith(REAL_CORE, number);
    for (const prompt of before.filter((other) => !sharing.includes(other.number)))
      assert.deepEqual(
        after.find((other) => other.number === prompt.number),
        prompt,
        `prompt ${prompt.number}`
      );
  }
});

test('on the real document one line is added, plus the passage line of a bare passage, and nothing else moves', () => {
  const before = REAL_CORE.split('\n');

  for (const number of NUMBERS) {
    const after = insert(number, REAL_CORE).split('\n');
    const added = after.filter((line) => !before.includes(line));
    const removed = before.filter((line) => !after.includes(line));

    assert.equal(after.length, before.length + 1, `prompt ${number}`);
    assert.ok(added.includes(NEW_LINE), `prompt ${number}`);
    assert.ok(added.length <= 2 && removed.length === added.length - 1, `prompt ${number}`);
    for (const line of removed) assert.match(line, /^Passage: "/);
  }
});

test('on the real document the generated layer and the registers are untouched for every prompt', () => {
  const layer = (text, begin, end) => text.slice(text.indexOf(begin), text.indexOf(end));
  const markers = [
    ['<!-- semantic-core:begin generated -->', '<!-- semantic-core:end generated -->'],
    ['<!-- REGISTERS:BEGIN -->', '<!-- REGISTERS:END -->'],
  ];

  for (const number of NUMBERS) {
    const after = insert(number, REAL_CORE);
    for (const [begin, end] of markers)
      assert.equal(layer(after, begin, end), layer(REAL_CORE, begin, end), `prompt ${number}`);
  }
});
