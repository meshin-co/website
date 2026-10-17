import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LLMS_SHARD_MAX_ENTRIES, llmsCollectionFiles } from '../src/utils/llms-collections.mjs';
import { llmsCorpusGaps } from './llms-corpus.mjs';

const COLLECTIONS = [{ name: 'post', base: '/blog' }];

const entriesOf = (count) =>
  Array.from({ length: count }, (_, index) => {
    const id = `entry-${String(index).padStart(4, '0')}`;
    return {
      id,
      title: id,
      url: `https://meshin.co/blog/${id}`,
      summary: 'Summary.',
      body: 'Body.',
      published: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    };
  });

const corpusOf = (count, reported = count) => ({
  llmsTxt: `# meshin.co\n\n## Full text\n\n- [Writing](https://meshin.co/llms/post.txt): ${reported} entries, full body text of each.\n`,
  files: Object.fromEntries(
    llmsCollectionFiles({
      site: 'meshin.co',
      origin: 'https://meshin.co',
      name: 'post',
      title: 'Writing',
      entries: entriesOf(count),
    }).map(({ param, text }) => [param, text])
  ),
});

const gaps = ({ llmsTxt, files }) => llmsCorpusGaps({ llmsTxt, files, collections: COLLECTIONS });

test('a single file collection and a three-shard collection are both clean', () => {
  assert.deepEqual(gaps(corpusOf(100)), []);
  assert.deepEqual(gaps(corpusOf(250)), []);
});

test('the llms.txt count must equal the entries shipped, single file or sharded', () => {
  assert.deepEqual(gaps(corpusOf(8, 9)), ['llms.txt says 9 entries for post, its files hold 8']);
  assert.deepEqual(gaps(corpusOf(250, 249)), ['llms.txt says 249 entries for post, its files hold 250']);
});

test('a collection with files but no count line in llms.txt is reported', () => {
  const corpus = corpusOf(8);
  assert.deepEqual(gaps({ ...corpus, llmsTxt: '# meshin.co\n' }), ['llms.txt has no count line for post']);
});

test('a shard that declares a range it does not hold is reported', () => {
  const corpus = corpusOf(250);
  corpus.files['post-2'] = corpus.files['post-2'].replace('entries 101-200', 'entries 101-199');
  assert.ok(gaps(corpus).includes('/llms/post-2.txt declares entries 101-199, the index says 101-200'));
});

test('a shard that holds fewer entries than the index counts is reported', () => {
  const corpus = corpusOf(250);
  const text = corpus.files['post-3'];
  corpus.files['post-3'] = text.replace(/# entry-0200[\s\S]*?\n\n---\n\n/, '');
  assert.ok(gaps(corpus).some((gap) => gap.startsWith('/llms/post-3.txt holds 49 entries, the index says 50')));
});

test('a shard whose next link is gone or points elsewhere is reported', () => {
  const corpus = corpusOf(250);
  corpus.files['post-1'] = corpus.files['post-1'].replace('llms/post-2.txt', 'llms/post-3.txt');
  assert.ok(gaps(corpus).includes('/llms/post-1.txt does not link to /llms/post-2.txt as its next part'));
});

test('a last shard that still links onward, or a middle one that claims to be last, is reported', () => {
  const corpus = corpusOf(250);
  corpus.files['post-2'] = corpus.files['post-2'].replace(/Next part: .*\n$/, 'This is the last part.\n');
  assert.ok(gaps(corpus).includes('/llms/post-2.txt says it is the last part, the index lists a /llms/post-3.txt'));
});

test('an entry shipped in two shards is reported once', () => {
  const corpus = corpusOf(250);
  const duplicate = corpus.files['post-1'].match(/# entry-0000[\s\S]*?\n\n---\n\n/)[0];
  corpus.files['post-2'] = corpus.files['post-2'].replace('\n\n# entry-0100', `\n\n${duplicate}# entry-0100`);
  assert.ok(gaps(corpus).includes('https://meshin.co/blog/entry-0000 ships twice across the post shards'));
});

test('a shard the index does not list, or lists without shipping, is reported', () => {
  const orphan = corpusOf(250);
  orphan.files['post-4'] = orphan.files['post-3'];
  assert.ok(gaps(orphan).includes('/llms/post-4.txt ships but the post index does not list it'));
  const missing = corpusOf(250);
  delete missing.files['post-3'];
  assert.ok(gaps(missing).includes('the post index lists /llms/post-3.txt, which did not ship'));
});

test('a shard over the entry cap is reported', () => {
  const corpus = corpusOf(250);
  const extra = Array.from(
    { length: LLMS_SHARD_MAX_ENTRIES + 1 },
    (_, index) => `[https://meshin.co/blog/x${index}](https://meshin.co/blog/x${index})`
  );
  corpus.files['post-1'] += `\n${extra.join('\n')}\n`;
  assert.ok(
    gaps(corpus).some((gap) =>
      gap.startsWith(
        `/llms/post-1.txt holds ${100 + extra.length} entries, over the ${LLMS_SHARD_MAX_ENTRIES} entry cap`
      )
    )
  );
});

test('a collection with neither files nor a count line is skipped, it is an empty collection', () => {
  assert.deepEqual(gaps({ llmsTxt: '# meshin.co\n', files: {} }), []);
});

test('a shard shipped beside a single-file collection is reported, there is no index to list it', () => {
  const corpus = corpusOf(8);
  corpus.files['post-1'] = '# meshin.co\n';
  assert.ok(gaps(corpus).includes('/llms/post-1.txt ships but the post index does not list it'));
});
