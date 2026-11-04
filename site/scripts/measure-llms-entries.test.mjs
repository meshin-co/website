import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LARGEST_MEASURED_ENTRY_BYTES,
  LLMS_COLLECTIONS,
  LLMS_FILE_MAX_BYTES,
  LLMS_SHARD_FRAME_BYTES,
  LLMS_SHARD_MAX_ENTRIES,
  llmsCollectionFiles,
} from '../src/utils/llms-collections.mjs';
import { stripMarkdown } from '../src/utils/machine-text.mjs';
import { measureLlmsEntries } from './measure-llms-entries.mjs';

const SCRIPT = fileURLToPath(new URL('./measure-llms-entries.mjs', import.meta.url));
const SITE = 'Test Site';
const ORIGIN = 'https://example.test';
const SEPARATOR_BYTES = 7;
const TRAILING_NEWLINE_BYTES = 1;

const entryOf = (id, { body, updated = '2026-09-01T00:00:00.000Z', published = '2026-08-01T00:00:00.000Z' }) => ({
  id,
  title: 'Title of ' + id,
  url: ORIGIN + '/blog/' + id,
  summary: 'Summary of ' + id + '.',
  body,
  updated,
  published,
});

const blockBytes = ({ title, updated, url, summary, body }) =>
  Buffer.byteLength(
    [[`# ${title}`, updated, `[${url}](${url})`, summary].filter(Boolean).join('\n\n'), stripMarkdown(body)].join(
      '\n\n'
    )
  );

const shardSizes = (entries) => entries.map((entry) => blockBytes(entry) + SEPARATOR_BYTES);

const flatSizes = (entries) =>
  entries.map(
    (entry, index) => blockBytes(entry) + (index === entries.length - 1 ? TRAILING_NEWLINE_BYTES : SEPARATOR_BYTES)
  );

const filesOf = (generated) => Object.fromEntries(generated.map(({ param, text }) => [param + '.txt', text]));

const summarise = (sizes) => ({
  entries: sizes.length,
  largest: Math.max(...sizes),
  mean: Math.floor(sizes.reduce((sum, size) => sum + size, 0) / sizes.length),
});

const postEntries = (count) =>
  Array.from({ length: count }, (_, index) =>
    entryOf('post-' + String(index).padStart(2, '0'), {
      body: 'word '.repeat(40 * (index + 1)).trim(),
      published: '2026-08-' + String(index + 1).padStart(2, '0') + 'T00:00:00.000Z',
    })
  );

const generate = (name, title, entries) => llmsCollectionFiles({ site: SITE, origin: ORIGIN, name, title, entries });

test('a flat collection file measures to the entry sizes it was built from', () => {
  const entries = [
    entryOf('alpha', { body: 'a'.repeat(100) }),
    entryOf('beta', { body: 'b'.repeat(400), published: '2026-08-02T00:00:00.000Z' }),
    entryOf('gamma', { body: 'c'.repeat(250), published: '2026-08-03T00:00:00.000Z' }),
  ];
  const generated = generate('service', 'Offers', entries);
  assert.deepEqual(
    generated.map(({ param }) => param),
    ['service']
  );

  const measured = measureLlmsEntries(filesOf(generated));

  assert.deepEqual(measured.service, summarise(flatSizes(entries)));
});

test('a sharded collection at its cap plus one measures every entry, including a one-entry shard', () => {
  const entries = postEntries(LLMS_SHARD_MAX_ENTRIES.post + 1);
  const generated = generate('post', 'Writing', entries);
  assert.deepEqual(
    generated.map(({ param }) => param),
    ['post', 'post-1', 'post-2']
  );

  const measured = measureLlmsEntries(filesOf(generated));

  assert.deepEqual(measured.post, summarise(shardSizes(entries)));
});

test('the last entry of a shard that closes on Next part and of one that closes on the last part are both counted', () => {
  const entries = postEntries(LLMS_SHARD_MAX_ENTRIES.post * 2);
  const files = filesOf(generate('post', 'Writing', entries));
  assert.match(files['post-1.txt'], /Next part: /);
  assert.match(files['post-2.txt'], /This is the last part\./);

  const measured = measureLlmsEntries(files);

  assert.deepEqual(measured.post, summarise(shardSizes(entries)));
});

test('an index file holds no entry and adds nothing', () => {
  const [index, ...shards] = generate('post', 'Writing', postEntries(LLMS_SHARD_MAX_ENTRIES.post + 1));

  const withIndex = measureLlmsEntries(filesOf([index, ...shards]));
  const withoutIndex = measureLlmsEntries(filesOf(shards));

  assert.deepEqual(withIndex, withoutIndex);
});

test('an entry with no date line is one entry', () => {
  const entries = [
    entryOf('dated', { body: 'x'.repeat(120) }),
    { ...entryOf('undated', { body: 'y'.repeat(300) }), updated: undefined },
  ];
  const generated = generate('faq', 'Questions', entries);
  assert.doesNotMatch(generated[0].text, /# Title of undated\n\n20/);

  const measured = measureLlmsEntries(filesOf(generated));

  assert.deepEqual(measured.faq, summarise(flatSizes(entries)));
});

test('a body that holds a horizontal rule is still one entry', () => {
  const body = 'before the rule\n\n---\n\nafter the rule';
  assert.ok(stripMarkdown(body).includes('\n\n---\n\n'));
  const entries = [entryOf('a-ruled', { body }), entryOf('b-plain', { body: 'z'.repeat(90) })];

  const measured = measureLlmsEntries(filesOf(generate('glossary', 'Glossary', entries)));

  assert.deepEqual(measured.glossary, summarise(flatSizes(entries)));
});

test('a rule in the body of the last entry of a shard is not mistaken for the closing', () => {
  const entries = postEntries(LLMS_SHARD_MAX_ENTRIES.post + 1);
  entries[entries.length - 1] = {
    ...entries[entries.length - 1],
    body: 'closing words\n\n---\n\nmore closing words',
  };

  const measured = measureLlmsEntries(filesOf(generate('post', 'Writing', entries)));

  assert.deepEqual(measured.post, summarise(shardSizes(entries)));
});

test('every collection is reported, and one with no file reads zero', () => {
  const measured = measureLlmsEntries({});

  assert.deepEqual(
    Object.keys(measured),
    LLMS_COLLECTIONS.map(({ name }) => name)
  );
  for (const result of Object.values(measured)) assert.deepEqual(result, { entries: 0, largest: 0, mean: 0 });
});

test('a file of another collection is not counted for this one', () => {
  const generated = generate('resource', 'Resources', [entryOf('one', { body: 'r'.repeat(80) })]);

  const measured = measureLlmsEntries(filesOf(generated));

  assert.equal(measured.resource.entries, 1);
  assert.equal(measured.post.entries, 0);
});

const withDist = (files, run) => {
  const root = mkdtempSync(join(tmpdir(), 'measure-llms-'));
  try {
    mkdirSync(join(root, 'llms'), { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(root, 'llms', name), text);
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

const capAt = (largest) => Math.floor((LLMS_FILE_MAX_BYTES - LLMS_SHARD_FRAME_BYTES) / largest);

test('the CLI prints one row per collection with the record and both caps, and exits 0', () => {
  const entries = [entryOf('a', { body: 'a'.repeat(100) }), entryOf('b', { body: 'b'.repeat(300) })];
  const files = filesOf(generate('faq', 'Q', entries));
  const { largest, mean } = summarise(flatSizes(entries));

  const { status, stdout } = withDist(files, (root) => cli(root));

  assert.equal(status, 0);
  const lines = stdout.split('\n');
  const row = lines.find((line) => line.startsWith('faq '));
  assert.ok(row, stdout);
  assert.deepEqual(row.trim().split(/\s+/), [
    'faq',
    '2',
    String(largest),
    String(mean),
    String(LARGEST_MEASURED_ENTRY_BYTES.faq),
    String(LLMS_SHARD_MAX_ENTRIES.faq),
    String(capAt(largest)),
  ]);
  for (const { name } of LLMS_COLLECTIONS) assert.ok(lines.some((line) => line.startsWith(name + ' ')));
});

test('the CLI says a collection grew past the record when its largest entry is above it, and only then', () => {
  const grown = LARGEST_MEASURED_ENTRY_BYTES.faq + 1;
  const baseBytes = blockBytes(entryOf('grown', { body: 'g' })) - 1;
  const grownEntry = entryOf('grown', { body: 'g'.repeat(grown - 1 - baseBytes) });
  assert.equal(flatSizes([grownEntry])[0], grown);
  const files = {
    ...filesOf(generate('faq', 'Q', [grownEntry])),
    ...filesOf(generate('glossary', 'G', [entryOf('tiny', { body: 'tiny' })])),
  };

  const { stdout } = withDist(files, (root) => cli(root));

  const lines = stdout.split('\n');
  assert.equal(lines.filter((line) => line.includes('grew past the record')).length, 1);
  assert.ok(lines.some((line) => line.startsWith('faq') && line.includes('grew past the record')));
  assert.ok(!lines.some((line) => line.startsWith('glossary') && line.includes('grew past the record')));
});

test('the CLI refuses a directory with no llms folder, naming it', () => {
  const root = mkdtempSync(join(tmpdir(), 'measure-llms-empty-'));
  try {
    const { status, stderr } = cli(root);

    assert.equal(status, 2);
    assert.match(stderr, /no llms directory under/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
