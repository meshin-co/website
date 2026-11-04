import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LLMS_COLLECTIONS, LLMS_SHARD_MAX_ENTRIES, llmsCollectionFiles } from '../src/utils/llms-collections.mjs';
import { llmsCollectionText, llmsCorpusGaps } from './llms-corpus.mjs';

const collectionOf = (name) => LLMS_COLLECTIONS.find((collection) => collection.name === name);
const POST = collectionOf('post');
const GLOSSARY = collectionOf('glossary');
const CAP = LLMS_SHARD_MAX_ENTRIES.post;
const SHARDED = 3 * CAP + 1;

const idOf = (index) => `entry-${String(index).padStart(4, '0')}`;
const urlOf = (collection, index) => `https://meshin.co${collection.base}/${idOf(index)}`;
const urlLine = (url) => `[${url}](${url})`;
const dropUrlLine = (text, url) =>
  text
    .split('\n')
    .filter((line) => line !== urlLine(url))
    .join('\n');

const entriesOf = (collection, count) =>
  Array.from({ length: count }, (_, index) => ({
    id: idOf(index),
    title: idOf(index),
    url: urlOf(collection, index),
    summary: 'Summary.',
    body: 'Body.',
    published: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
  }));

const pointerText = (collection, count) =>
  `# meshin.co\n\n- [${collection.title}](https://meshin.co${collection.file}): ${count} entries, full body text of each.\n`;

const corpusOf = (count, { collection = POST, llmsTxtCount = count, llmsFullCount = count } = {}) => ({
  llmsTxt: pointerText(collection, llmsTxtCount),
  llmsFullTxt: pointerText(collection, llmsFullCount),
  files: Object.fromEntries(
    llmsCollectionFiles({
      site: 'meshin.co',
      origin: 'https://meshin.co',
      name: collection.name,
      title: collection.title,
      entries: entriesOf(collection, count),
    }).map(({ param, text }) => [param, text])
  ),
});

const gaps = (corpus, collection = POST) => llmsCorpusGaps({ ...corpus, collections: [collection] });

test('a single file collection and a sharded collection are both clean', () => {
  for (const count of [CAP, CAP + 1, SHARDED]) assert.deepEqual(gaps(corpusOf(count)), [], `${count} entries`);
});

test('the llms.txt count must equal the entries shipped, single file or sharded', () => {
  assert.deepEqual(gaps(corpusOf(2, { llmsTxtCount: 3 })), ['llms.txt says 3 entries for post, its files hold 2']);
  assert.deepEqual(gaps(corpusOf(SHARDED, { llmsTxtCount: 9 })), [
    'llms.txt says 9 entries for post, its files hold 10',
  ]);
});

test('the llms-full.txt count must equal the entries shipped, single file or sharded', () => {
  assert.deepEqual(gaps(corpusOf(2, { llmsFullCount: 3 })), [
    'llms-full.txt says 3 entries for post, its files hold 2',
  ]);
  assert.deepEqual(gaps(corpusOf(SHARDED, { llmsFullCount: 9 })), [
    'llms-full.txt says 9 entries for post, its files hold 10',
  ]);
});

test('llms.txt and llms-full.txt are each held to the count, so one drifting does not hide the other', () => {
  assert.deepEqual(gaps(corpusOf(SHARDED, { llmsTxtCount: 9, llmsFullCount: 11 })), [
    'llms.txt says 9 entries for post, its files hold 10',
    'llms-full.txt says 11 entries for post, its files hold 10',
  ]);
});

test('a collection with files but no count line in llms.txt is reported', () => {
  const corpus = corpusOf(CAP);
  assert.deepEqual(gaps({ ...corpus, llmsTxt: '# meshin.co\n' }), ['llms.txt has no count line for post']);
});

test('a collection with files but no count line in llms-full.txt is reported', () => {
  const corpus = corpusOf(SHARDED);
  assert.deepEqual(gaps({ ...corpus, llmsFullTxt: '# meshin.co\n' }), ['llms-full.txt has no count line for post']);
});

test('a shard that declares a range it does not hold is reported', () => {
  const corpus = corpusOf(SHARDED);
  corpus.files['post-2'] = corpus.files['post-2'].replace('entries 4-6', 'entries 4-5');
  assert.ok(gaps(corpus).includes('/llms/post-2.txt declares entries 4-5, the index says 4-6'));
});

test('a shard that holds fewer entries than the index counts is reported', () => {
  const corpus = corpusOf(SHARDED);
  corpus.files['post-3'] = dropUrlLine(corpus.files['post-3'], urlOf(POST, 8));
  assert.ok(gaps(corpus).includes('/llms/post-3.txt holds 2 entries, the index says 3 (range 7-9)'));
});

test('a shard whose next link is gone or points elsewhere is reported', () => {
  const corpus = corpusOf(SHARDED);
  corpus.files['post-1'] = corpus.files['post-1'].replace('llms/post-2.txt', 'llms/post-3.txt');
  assert.ok(gaps(corpus).includes('/llms/post-1.txt does not link to /llms/post-2.txt as its next part'));
});

test('a last shard that still links onward, or a middle one that claims to be last, is reported', () => {
  const corpus = corpusOf(SHARDED);
  corpus.files['post-2'] = corpus.files['post-2'].replace(/Next part: .*\n$/, 'This is the last part.\n');
  assert.ok(gaps(corpus).includes('/llms/post-2.txt says it is the last part, the index lists a /llms/post-3.txt'));
});

test('an entry shipped in two shards is reported once', () => {
  const corpus = corpusOf(SHARDED);
  const duplicate = corpus.files['post-1'].match(/# entry-0000[\s\S]*?\n\n---\n\n/)[0];
  corpus.files['post-2'] = corpus.files['post-2'].replace('\n\n# entry-0003', `\n\n${duplicate}# entry-0003`);
  const twice = gaps(corpus).filter((gap) => gap.includes('ships twice'));
  assert.deepEqual(twice, ['https://meshin.co/blog/entry-0000 ships twice across the post shards']);
});

test('a shard the index does not list, or lists without shipping, is reported', () => {
  const orphan = corpusOf(SHARDED);
  orphan.files['post-5'] = orphan.files['post-4'];
  assert.ok(gaps(orphan).includes('/llms/post-5.txt ships but the post index does not list it'));
  const missing = corpusOf(SHARDED);
  delete missing.files['post-3'];
  assert.ok(gaps(missing).includes('the post index lists /llms/post-3.txt, which did not ship'));
});

test('a shard over the entry cap is reported', () => {
  const corpus = corpusOf(SHARDED);
  corpus.files['post-1'] += `\n${urlLine('https://meshin.co/blog/extra')}\n`;
  assert.ok(gaps(corpus).includes('/llms/post-1.txt holds 4 entries, over the 3 entry cap'));
});

test('the cap a shard is held to is the cap of its own collection', () => {
  const corpus = corpusOf(34, { collection: GLOSSARY });
  assert.deepEqual(gaps(corpus, GLOSSARY), []);
  corpus.files['glossary-1'] += `\n${urlLine('https://meshin.co/glossary/extra')}\n`;
  assert.ok(gaps(corpus, GLOSSARY).includes('/llms/glossary-1.txt holds 34 entries, over the 33 entry cap'));
});

test('an index that lists an entry itself is reported, once for each entry it lists', () => {
  const corpus = corpusOf(SHARDED);
  corpus.files.post += `\n${urlLine(urlOf(POST, 0))}\n${urlLine(urlOf(POST, 7))}\n`;
  assert.deepEqual(gaps(corpus), [
    `/llms/post.txt is an index of shards but lists ${urlOf(POST, 0)} itself`,
    `/llms/post.txt is an index of shards but lists ${urlOf(POST, 7)} itself`,
  ]);
});

test('a collection with neither files nor a count line is skipped, it is an empty collection', () => {
  assert.deepEqual(gaps({ llmsTxt: '# meshin.co\n', llmsFullTxt: '# meshin.co\n', files: {} }), []);
});

test('a shard shipped beside a single-file collection is reported, there is no index to list it', () => {
  const corpus = corpusOf(CAP);
  corpus.files['post-1'] = '# meshin.co\n';
  assert.ok(gaps(corpus).includes('/llms/post-1.txt ships but the post index does not list it'));
});

test('the text of a sharded collection is its index followed by every shard the index names, in index order', () => {
  const { files } = corpusOf(SHARDED);
  const text = llmsCollectionText(files, 'post');
  const positions = Array.from({ length: SHARDED }, (_, index) => text.indexOf(urlLine(urlOf(POST, index))));

  assert.ok(text.includes('Entries 1-3'));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b)
  );
});

test('a shard the index does not name is no part of the collection text', () => {
  const { files } = corpusOf(SHARDED);
  files['post-5'] = `${urlLine('https://meshin.co/blog/stray')}\n`;
  assert.ok(!llmsCollectionText(files, 'post').includes('/blog/stray'));
});

test('a shard the index names but the build did not ship adds nothing and is not an error', () => {
  const { files } = corpusOf(SHARDED);
  delete files['post-2'];
  const text = llmsCollectionText(files, 'post');
  assert.ok(text.includes(urlLine(urlOf(POST, 2))));
  assert.ok(!text.includes(urlLine(urlOf(POST, 3))));
});

test('a single file collection is its own text, and a collection with no file has none', () => {
  const { files } = corpusOf(CAP);
  assert.equal(llmsCollectionText(files, 'post'), files.post);
  assert.equal(llmsCollectionText({}, 'post'), undefined);
});
