import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseStale, restateFile, restatedReason } from './disposition-restate.mjs';
import { dispositionFor } from './route-derive.mjs';
import { WriterError } from './writer-error.mjs';

const ENTRIES = [
  { target: '/blog', location: 'head.title', status: 'verified', reason: 'Title checked.', digest: 'aaaaaaaaaaaa' },
  { target: '/glossary', status: 'rewritten', reason: 'Glossary index re-read.', digest: 'bbbbbbbbbbbb' },
  { target: 'src/data/post/a.md', location: 'body.p', status: 'verified', reason: 'Read.', digest: 'cccccccccccc' },
];
const REASON = 'Changed by the writer. No human has read the new text.';
const STATUS = dispositionFor({ slug: 'x', target: 't', digest: 'd', runDate: '2026-11-02' }).status;
const layout = (entries) => `${JSON.stringify(entries, null, 2)}\n`;
const restate = (overrides = {}) =>
  restateFile({
    file: 'routes.json',
    text: layout(ENTRIES),
    stale: [
      { index: 0, target: '/blog', digest: '111111111111' },
      { index: 1, target: '/glossary', digest: '222222222222' },
    ],
    reason: REASON,
    ...overrides,
  });
const refusedBy = (pattern) => (error) =>
  error instanceof WriterError && error.kind === 'build' && pattern.test(error.message);

test('the listed entries take the generated status, the new reason and the fresh digest, nothing else changes', () => {
  const entries = JSON.parse(restate());

  assert.deepEqual(entries[0], { ...ENTRIES[0], status: STATUS, reason: REASON, digest: '111111111111' });
  assert.deepEqual(entries[1], { ...ENTRIES[1], status: STATUS, reason: REASON, digest: '222222222222' });
  assert.deepEqual(Object.keys(entries[0]), ['target', 'location', 'status', 'reason', 'digest']);
});

test('an entry that is not listed keeps its exact text, and the file keeps its layout', () => {
  const text = restate();
  const block = JSON.stringify(ENTRIES[2], null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  assert.ok(text.includes(block));
  assert.ok(text.endsWith('}\n]\n'));
  assert.equal(text, layout(JSON.parse(text)));
});

test('a file that is not laid out as two-space JSON and a newline is refused instead of reformatted', () => {
  for (const text of [
    JSON.stringify(ENTRIES, null, '\t') + '\n',
    JSON.stringify(ENTRIES),
    JSON.stringify(ENTRIES, null, 2),
  ])
    assert.throws(() => restate({ text }), refusedBy(/routes\.json.*laid out/));
});

test('a file that is not JSON, or not a list, is refused naming the file', () => {
  assert.throws(() => restate({ text: 'not json' }), refusedBy(/routes\.json/));
  assert.throws(() => restate({ text: '{}\n' }), refusedBy(/routes\.json/));
});

test('an entry whose target is not the one the list names is refused, naming both', () => {
  assert.throws(
    () => restate({ stale: [{ index: 1, target: '/blog', digest: '111111111111' }] }),
    refusedBy(/entry 1.*\/glossary.*\/blog/)
  );
  assert.throws(
    () => restate({ stale: [{ index: 7, target: '/blog', digest: '111111111111' }] }),
    refusedBy(/entry 7.*nothing/)
  );
});

test('the reason names every route and every generation record and says no human has read the text', () => {
  const reason = restatedReason({ routes: ['/blog/a', '/glossary/b', '/blog/c'], slugs: ['a', 'b', 'c'] });

  assert.match(reason, /added \/blog\/a, \/glossary\/b and \/blog\/c /);
  assert.match(
    reason,
    /generation records audits\/autowriter\/generations\/a\.json, audits\/autowriter\/generations\/b\.json and audits\/autowriter\/generations\/c\.json/
  );
  assert.match(reason, /written by a model, and no human has read it/);
  assert.doesNotMatch(reason, /seal|\n/i);
});

test('one route and two routes are named in the singular and the pair form', () => {
  assert.match(
    restatedReason({ routes: ['/blog/a'], slugs: ['a'] }),
    /added \/blog\/a \(generation record audits\/autowriter\/generations\/a\.json\)/
  );
  assert.match(
    restatedReason({ routes: ['/blog/a', '/glossary/b'], slugs: ['a', 'b'] }),
    /added \/blog\/a and \/glossary\/b \(generation records/
  );
});

const ITEM = { file: 'routes.json', index: 0, target: '/blog', digest: 'abcdef012345' };

test('a stale list is read back as it was printed, keeping only the four fields', () => {
  assert.deepEqual(
    parseStale(
      JSON.stringify([
        { ...ITEM, extra: 'x' },
        { ...ITEM, index: 1 },
      ])
    ),
    [ITEM, { ...ITEM, index: 1 }]
  );
  assert.deepEqual(parseStale('[]\n'), []);
});

const MALFORMED = {
  'text that is not JSON': 'not json',
  'an object instead of a list': '{}',
  'an item that is not an object': '[1]',
  'a file name with a directory in it': JSON.stringify([{ ...ITEM, file: '../routes.json' }]),
  'a file name inside a directory': JSON.stringify([{ ...ITEM, file: 'a/routes.json' }]),
  'a file that is not a .json file': JSON.stringify([{ ...ITEM, file: 'routes.md' }]),
  'an index that is not a whole number': JSON.stringify([{ ...ITEM, index: 1.5 }]),
  'a negative index': JSON.stringify([{ ...ITEM, index: -1 }]),
  'an empty target': JSON.stringify([{ ...ITEM, target: '' }]),
  'a digest of the wrong length': JSON.stringify([{ ...ITEM, digest: 'abcdef01234' }]),
  'a digest in capitals': JSON.stringify([{ ...ITEM, digest: 'ABCDEF012345' }]),
  'one entry listed twice': JSON.stringify([ITEM, ITEM]),
};

for (const [name, stdout] of Object.entries(MALFORMED))
  test(`${name} is refused as the output of the stale-dispositions script`, () => {
    assert.throws(() => parseStale(stdout), refusedBy(/scripts\/stale-dispositions\.mjs/));
  });
