import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { MAXIMUM_QUERY_WORDS, MAXIMUM_RESULTS, decodeChunk } from '../public/search/index-model.mjs';
import { INDEX_LIMITS, buildSearchIndex, chunkPath, manifestPath } from '../src/utils/search-index.mjs';
import { articles, change, sharedTermIndex, withDist, without } from './fixtures/search-budget-world.mjs';
import { measureSearchIndex } from './measure-search.mjs';
import { firstQueryWorstCase } from './search-budget.mjs';

const gz = (text) => gzipSync(text).byteLength;
const sum = (numbers) => numbers.reduce((total, number) => total + number, 0);
const descending = (numbers) => [...numbers].sort((a, b) => b - a);
const textsAt = (files, marker) => [...files].filter(([path]) => path.includes(marker)).map(([, text]) => text);
const entry = (href, kind, text, title = '') => ({ href, title, description: '', kind, text });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test('the manifest, the term chunks and the document pages are each counted by files, gzipped bytes and largest file', () => {
  const { files } = buildSearchIndex(articles(30, { words: 200 }));
  const chunks = textsAt(files, '/t/').map(gz);
  const pages = textsAt(files, '/d/').map(gz);
  const manifest = gz(files.get(manifestPath));

  const measured = measureSearchIndex(files);

  assert.ok(chunks.length >= 1 && pages.length > 1);
  assert.deepEqual(measured.manifest, { files: 1, gz: manifest, largest: manifest });
  assert.deepEqual(measured.chunks, { files: chunks.length, gz: sum(chunks), largest: Math.max(...chunks) });
  assert.deepEqual(measured.pages, { files: pages.length, gz: sum(pages), largest: Math.max(...pages) });
  assert.deepEqual(measured.others, { files: 0, gz: 0, largest: 0 });
  assert.equal(measured.files, files.size);
  assert.equal(measured.gz, manifest + sum(chunks) + sum(pages));
});

test('a file the manifest does not name is counted in the total as another file and is neither a chunk nor a page', () => {
  const { files } = buildSearchIndex(articles(10, { words: 50 }));
  const stray = '{"stray":true}';
  const plain = measureSearchIndex(files);

  const measured = measureSearchIndex(change(files, '/search-index/stray.json', stray));

  assert.deepEqual(measured.others, { files: 1, gz: gz(stray), largest: gz(stray) });
  assert.equal(measured.files, files.size + 1);
  assert.equal(measured.gz, plain.gz + gz(stray));
  assert.deepEqual([measured.chunks, measured.pages], [plain.chunks, plain.pages]);
});

test('the worst first query is the manifest, the largest chunks up to the word limit and the largest pages up to the result limit, as the guard reads it', () => {
  const { files } = buildSearchIndex(articles(60, { words: 100 }), {
    ...INDEX_LIMITS,
    chunkBytes: 1200,
    pageDocuments: 2,
  });
  const chunks = descending(textsAt(files, '/t/').map(gz));
  const pages = descending(textsAt(files, '/d/').map(gz));
  assert.ok(chunks.length > MAXIMUM_QUERY_WORDS && pages.length > MAXIMUM_RESULTS);

  const { worst, unfilled } = measureSearchIndex(files);

  const manifest = gz(files.get(manifestPath));
  const largestChunks = sum(chunks.slice(0, MAXIMUM_QUERY_WORDS));
  const largestPages = sum(pages.slice(0, MAXIMUM_RESULTS));
  assert.deepEqual(worst, {
    manifest,
    chunks: largestChunks,
    pages: largestPages,
    total: manifest + largestChunks + largestPages,
  });
  assert.deepEqual(unfilled, { chunks: 0, pages: 0, bytes: 0 });
  withDist(files, (dist) => assert.equal(worst.total, firstQueryWorstCase(dist)));
});

test('the chunks and pages a first query can fetch that the index does not hold yet are priced at the largest chunk and the mean page', () => {
  const { files } = buildSearchIndex(articles(10, { words: 30 }));
  const chunks = textsAt(files, '/t/').map(gz);
  const pages = textsAt(files, '/d/').map(gz);
  assert.ok(chunks.length < MAXIMUM_QUERY_WORDS && pages.length < MAXIMUM_RESULTS);

  const { unfilled } = measureSearchIndex(files);

  const missingChunks = MAXIMUM_QUERY_WORDS - chunks.length;
  const missingPages = MAXIMUM_RESULTS - pages.length;
  assert.deepEqual(unfilled, {
    chunks: missingChunks,
    pages: missingPages,
    bytes: Math.round(missingChunks * Math.max(...chunks) + (missingPages * sum(pages)) / pages.length),
  });
});

test('the documents, the Writing articles among them and the kind runs are read from the manifest', () => {
  const kinds = [
    'Page',
    'Writing',
    'Writing',
    'Answer',
    'Writing',
    'Page',
    'Writing',
    'Writing',
    'Writing',
    'Glossary',
  ];
  const entries = kinds.map((kind, at) => entry(`/${String(at).padStart(2, '0')}`, kind, 'alpha'));

  const measured = measureSearchIndex(buildSearchIndex(entries).files);

  assert.equal(measured.documents, 10);
  assert.equal(measured.articles, 6);
  assert.equal(measured.kindRuns, 7);
});

test('an index that cannot be measured is refused naming the file: no manifest, a manifest or a chunk that is not JSON, a chunk that is missing', () => {
  const { files, manifest } = buildSearchIndex(articles(10, { words: 30 }));
  const chunk = chunkPath(manifest.version, 0);

  assert.throws(() => measureSearchIndex(new Map()), { message: `${manifestPath} is missing` });
  assert.throws(() => measureSearchIndex(change(files, manifestPath, '{"version":')), {
    message: `${manifestPath} is not valid JSON`,
  });
  assert.throws(() => measureSearchIndex(without(files, chunk)), {
    message: `${chunk} is named by the manifest but missing`,
  });
  assert.throws(() => measureSearchIndex(change(files, chunk, '[')), { message: `${chunk} is not valid JSON` });
});

const PAIR = 4;
const OWNED_KEY = 7;
const TINY = [
  entry('/a', 'Page', 'aa'),
  entry('/w1', 'Writing', 'aa ee', 'bb'),
  entry('/w2', 'Writing', 'aa cc cc'),
  entry('/z', 'Page', 'dd ee'),
];

test('what an article adds is its postings and the keys only it holds, in the bytes the chunk encoding gives them', () => {
  const { files, manifest } = buildSearchIndex(TINY);
  assert.equal(
    files.get(chunkPath(manifest.version, 0)),
    '["aa",3,0,1,1,1,1,1,"bb",1,1,8,"cc",1,2,2,"dd",1,3,1,"ee",2,1,2,1,1]'
  );

  const { growth, lists } = measureSearchIndex(files);

  const aa = 2 * PAIR;
  const bb = PAIR + OWNED_KEY;
  const cc = PAIR + OWNED_KEY;
  const ee = PAIR;
  assert.equal(growth.postingBytes, (aa + bb + cc + ee) / 2);
  assert.deepEqual(lists, { cut: 0, soonest: { key: 'aa', postings: 3, carriers: 2 } });
});

const TALL = [
  ...Array.from({ length: 10 }, (_, at) => entry(`/a${at}`, 'Page', 'pp')),
  { ...entry('/b10', 'Writing', 'qq'), title: 'qq', description: 'qq' },
  entry('/b11', 'Writing', 'qq rr'),
];

test('a step or a weight of two digits costs a byte more than one of a single digit', () => {
  const { files } = buildSearchIndex(TALL);
  assert.ok([...files.values()].some((text) => text.includes('"qq",2,10,1,12,1,"rr",1,11,1]')));

  const { growth } = measureSearchIndex(files);

  const qq = PAIR + 2 + PAIR;
  const rr = PAIR + 1 + OWNED_KEY;
  assert.equal(growth.postingBytes, (qq + rr) / 2);
});

const ownWord = (at) => `${String.fromCharCode(97 + Math.floor(at / 20), 97 + (at % 20))}qz`;
const sharedCorpus = (count) => buildSearchIndex(articles(count, { words: 300 }));
const ownWordCorpus = (count) =>
  buildSearchIndex(
    articles(count, { words: 300 }).map((article, at) => ({ ...article, text: `${article.text} ${ownWord(at)}` }))
  );
const chunkBytes = (files) => sum(textsAt(files, '/t/').map((text) => Buffer.byteLength(text)));
const addedPerArticle = (build, from, to) =>
  (chunkBytes(build(to).files) - chunkBytes(build(from).files)) / (to - from);
const estimated = (build, count) => measureSearchIndex(build(count).files).growth.postingBytes;

test('the estimate follows what the index builder adds for the next articles, within 2%, with and without a word of their own', () => {
  for (const build of [sharedCorpus, ownWordCorpus]) {
    const real = addedPerArticle(build, 60, 80);
    assert.ok(real > 200, `${real}`);
    assert.ok(Math.abs(estimated(build, 60) / real - 1) < 0.02, `${estimated(build, 60)} against ${real}`);
  }
  assert.ok(estimated(ownWordCorpus, 60) - estimated(sharedCorpus, 60) > 10);
});

test('an article adds chunks at the rate of its chunk text, and a page for each page size of articles', () => {
  const { files, manifest } = buildSearchIndex(articles(100, { words: 300 }));
  assert.ok(manifest.lastKeys.length > 1);

  const { growth } = measureSearchIndex(files);

  near(growth.chunks, growth.postingBytes / INDEX_LIMITS.chunkBytes);
  near(growth.files, growth.chunks + 1 / manifest.pageSize);
});

const growthWithLastKeys = ({ files, manifest }, keyAt) => {
  const lastKeys = manifest.lastKeys.map((_, at) => keyAt(at));
  return measureSearchIndex(change(files, manifestPath, JSON.stringify({ ...manifest, lastKeys }))).growth;
};
const keyOfLength = (length) => 'k'.repeat(length);

test('each chunk an article adds costs the manifest the raw bytes of one last key in its array, with no gzip saving assumed', () => {
  const index = buildSearchIndex(articles(100, { words: 300 }));
  const plain = measureSearchIndex(index.files).growth;

  const tenBytes = growthWithLastKeys(index, () => keyOfLength(7));
  const elevenBytes = growthWithLastKeys(index, () => keyOfLength(8));

  near(tenBytes.chunks, plain.chunks);
  near(tenBytes.manifestBytes, plain.chunks * 10);
  near(elevenBytes.manifestBytes, plain.chunks * 11);
});

test('the manifest bytes of a chunk are the mean over all the last keys: not the shortest, the longest, the first or the last', () => {
  const index = buildSearchIndex(articles(100, { words: 300 }));
  const count = index.manifest.lastKeys.length;
  assert.ok(count >= 3);

  const longFirst = growthWithLastKeys(index, (at) => keyOfLength(at === 0 ? 31 : 7));
  const longLast = growthWithLastKeys(index, (at) => keyOfLength(at === count - 1 ? 31 : 7));

  near(longFirst.manifestBytes, longFirst.chunks * (10 + 24 / count));
  near(longLast.manifestBytes, longLast.chunks * (10 + 24 / count));
});

test('a last key is priced in bytes and not in characters: four two-byte letters cost 11 bytes in the array', () => {
  const index = buildSearchIndex(articles(100, { words: 300 }));

  const { chunks, manifestBytes } = growthWithLastKeys(index, () => 'éééé');

  near(manifestBytes, chunks * 11);
});

test('a list cut to the list cap takes no more postings from a new article, so it adds nothing and is counted as cut', () => {
  const { files } = buildSearchIndex(articles(30, { words: 100 }), { ...INDEX_LIMITS, listCap: 5 });
  const keys = sum(textsAt(files, '/t/').map((text) => decodeChunk(JSON.parse(text)).length));

  const { growth, lists } = measureSearchIndex(files);

  assert.deepEqual([growth.postingBytes, growth.chunks, growth.manifestBytes], [0, 0, 0]);
  near(growth.files, 1 / INDEX_LIMITS.pageDocuments);
  assert.deepEqual(lists, { cut: keys, soonest: null });
});

test('an index with no Writing article has no growth to measure and no list an article can fill', () => {
  const pagesOnly = articles(12, { words: 50 }).map((article) => ({ ...article, kind: 'Page' }));

  const measured = measureSearchIndex(buildSearchIndex(pagesOnly).files);

  assert.equal(measured.articles, 0);
  assert.equal(measured.growth, null);
  assert.deepEqual(measured.lists, { cut: 0, soonest: null });
});

const repeat = (count, text) => Array.from({ length: count }, () => text);
const indexOfTexts = (articleTexts, pageTexts) =>
  buildSearchIndex([
    ...articleTexts.map((text, at) => entry(`/blog/a-${String(at).padStart(2, '0')}`, 'Writing', text)),
    ...pageTexts.map((text, at) => entry(`/pages/p-${String(at).padStart(2, '0')}`, 'Page', text)),
  ]).files;

test('the list to fill first is the one the articles carry fastest, not the longest list and not one no article carries', () => {
  const decoys = repeat(30, 'decoyword');
  const slowLongest = indexOfTexts(
    ['shortlist longlist', ...repeat(9, 'shortlist')],
    [...repeat(3, 'shortlist'), ...repeat(25, 'longlist'), ...decoys]
  );
  const carriedAlike = indexOfTexts(repeat(10, 'shortlist longlist'), [
    ...repeat(3, 'shortlist'),
    ...repeat(16, 'longlist'),
    ...decoys,
  ]);

  assert.deepEqual(measureSearchIndex(slowLongest).lists.soonest, { key: 'shortlist', postings: 13, carriers: 10 });
  assert.deepEqual(measureSearchIndex(carriedAlike).lists.soonest, { key: 'longlist', postings: 26, carriers: 10 });
});

test('a list of exactly the list cap is the next to be cut, and a list over the cap is cut and counted', () => {
  const full = measureSearchIndex(sharedTermIndex(INDEX_LIMITS.listCap).files);
  const over = measureSearchIndex(sharedTermIndex(INDEX_LIMITS.listCap + 1).files);

  assert.deepEqual(full.lists, {
    cut: 0,
    soonest: { key: 'sharedterm', postings: INDEX_LIMITS.listCap, carriers: INDEX_LIMITS.listCap },
  });
  assert.deepEqual(over.lists, { cut: 1, soonest: null });
});
