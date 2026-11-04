import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { MAXIMUM_QUERY_WORDS, MAXIMUM_RESULTS } from '../public/search/index-model.mjs';
import { INDEX_LIMITS, buildSearchIndex, chunkPath, manifestPath } from '../src/utils/search-index.mjs';
import {
  ARTICLES,
  CHUNKS,
  GREEN,
  LAST_KEY,
  PAGES,
  ROW_SHAPE,
  articles,
  change,
  chunk,
  firstQueryLine,
  page,
  problemsOf,
  rowsOf,
  withDist,
  withManifest,
  without,
} from './fixtures/search-budget-world.mjs';
import {
  FIRST_QUERY_BUDGET_BYTES,
  INDEX_FILE_BUDGET,
  firstQueryBreakdown,
  firstQueryWorstCase,
  listIndexFiles,
  searchIndexProblems,
} from './search-budget.mjs';

const ABSENT = join(tmpdir(), `search-budget-absent-${process.pid}`);

const gz = (text) => gzipSync(text).byteLength;
const sizesAt = (files, marker) => [...files].filter(([path]) => path.includes(marker)).map(([, text]) => gz(text));
const largestSum = (sizes, count) =>
  [...sizes]
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((total, size) => total + size, 0);
const othersOf = (files) =>
  largestSum(sizesAt(files, '/t/'), MAXIMUM_QUERY_WORDS) + largestSum(sizesAt(files, '/d/'), MAXIMUM_RESULTS);
const worstCaseOf = (files) => gz(files.get(manifestPath)) + othersOf(files);

const NOISE = (() => {
  let text = '';
  for (let block = 0; text.length < 150_000; block++)
    text += createHash('sha256').update(String(block)).digest('base64url');
  return text;
})();

const withWorstCase = (files, target) => {
  const wanted = target - othersOf(files);
  const render = (length) => JSON.stringify({ ...GREEN.manifest, kindRuns: [[0, `Writing${NOISE.slice(0, length)}`]] });
  let length = Math.round(wanted * 1.33);
  for (let step = 0; step < 8 && Math.abs(wanted - gz(render(length))) > 3; step++)
    length = Math.max(0, length + Math.round((wanted - gz(render(length))) * 1.33));
  for (let offset = 0; offset < 400; offset++) {
    for (const candidate of offset === 0 ? [length] : [length + offset, length - offset]) {
      if (candidate >= 0 && gz(render(candidate)) === wanted) return change(files, manifestPath, render(candidate));
    }
  }
  throw new Error(`no manifest makes the worst first query exactly ${target} bytes`);
};

test('a built index of 600 documents passes, and its worst first query is the manifest, the 8 largest chunks and the 20 largest pages, gzipped', () => {
  assert.ok(CHUNKS > MAXIMUM_QUERY_WORDS && PAGES > MAXIMUM_RESULTS, 'the fixture must need the selection');

  assert.deepEqual(problemsOf(GREEN.files), []);
  withDist(GREEN.files, (dist) => assert.equal(firstQueryWorstCase(dist), worstCaseOf(GREEN.files)));
});

test('an index with fewer chunks and pages than the limits counts every one of its files', () => {
  const small = buildSearchIndex(articles(10, { words: 30 }));
  assert.ok(small.manifest.lastKeys.length <= MAXIMUM_QUERY_WORDS);
  const everyFile = [...small.files.values()].reduce((total, text) => total + gz(text), 0);

  withDist(small.files, (dist) => assert.equal(firstQueryWorstCase(dist), everyFile));
});

test('the breakdown adds the manifest, the largest chunks up to the word limit and the largest pages up to the result limit', () => {
  const ascending = (count) => Array.from({ length: count }, (_, index) => index + 1);
  const chunks = ascending(MAXIMUM_QUERY_WORDS + 2);
  const pages = ascending(MAXIMUM_RESULTS + 5);
  const total = (sizes) => sizes.reduce((sum, size) => sum + size, 0);
  const largestChunks = total(chunks.slice(-MAXIMUM_QUERY_WORDS));
  const largestPages = total(pages.slice(-MAXIMUM_RESULTS));

  assert.deepEqual(firstQueryBreakdown({ manifest: 100, chunks, pages }), {
    manifest: 100,
    chunks: largestChunks,
    pages: largestPages,
    total: 100 + largestChunks + largestPages,
  });
  assert.deepEqual(firstQueryBreakdown({ manifest: 100, chunks: [4, 5], pages: [6] }), {
    manifest: 100,
    chunks: 9,
    pages: 6,
    total: 115,
  });
});

test('the index files are listed as sorted url paths, at any depth, and none when the folder is absent', () => {
  const deeper = change(change(GREEN.files, '/search-index/zz/deep/er.json', '[]'), '/search.html', 'x');

  withDist(deeper, (dist) =>
    assert.deepEqual(listIndexFiles(dist), [...GREEN.files.keys(), '/search-index/zz/deep/er.json'].sort())
  );
  withDist(new Map([['/search.html', 'x']]), (dist) => assert.deepEqual(listIndexFiles(dist), []));
  assert.deepEqual(listIndexFiles(ABSENT), []);
});

test('a dist with no manifest is refused by name, whether the other files are there, the folder is empty or dist is absent', () => {
  const missing = ['search-index: /search-index/manifest.json is missing'];

  assert.deepEqual(problemsOf(without(GREEN.files, manifestPath)), missing);
  assert.deepEqual(problemsOf(new Map()), missing);
  assert.deepEqual(searchIndexProblems(ABSENT), missing);
});

test('a manifest that is not JSON or not an object is refused, and the same manifest pretty-printed passes', () => {
  assert.deepEqual(problemsOf(change(GREEN.files, manifestPath, '{"version":')), [
    'search-index: /search-index/manifest.json is not valid JSON',
  ]);
  for (const text of ['[]', 'null', '"text"', '7']) {
    assert.deepEqual(problemsOf(change(GREEN.files, manifestPath, text)), [
      'search-index: /search-index/manifest.json is not an object',
    ]);
  }
  assert.deepEqual(problemsOf(change(GREEN.files, manifestPath, JSON.stringify(GREEN.manifest, null, 2))), []);
});

const KIND_RUNS_RULE =
  'kindRuns is not a list of [firstId, kind] pairs that start at 0, ascend and stay below documents';
const LAST_KEYS_RULE = 'lastKeys is not a list of non-empty strings';
const VERSION_RULE = 'version is not 10 lowercase hex characters';
const DOCUMENTS_RULE = 'documents is not a positive whole number';
const PAGE_SIZE_RULE = `pageSize is not ${INDEX_LIMITS.pageDocuments}`;
const SHAPE_CASES = [
  ['a version of nine hex characters', { version: '0123456ab' }, VERSION_RULE],
  ['a version of eleven hex characters', { version: '0123456789a' }, VERSION_RULE],
  ['an upper-case version', { version: 'ABCDEF0123' }, VERSION_RULE],
  ['a version that is a number', { version: 1234567890 }, VERSION_RULE],
  ['no version', { version: undefined }, VERSION_RULE],
  ['zero documents', { documents: 0 }, DOCUMENTS_RULE],
  ['a fractional document count', { documents: 1.5 }, DOCUMENTS_RULE],
  ['a document count in text', { documents: '600' }, DOCUMENTS_RULE],
  ['a page size of seven', { pageSize: 7 }, PAGE_SIZE_RULE],
  ['a page size of five', { pageSize: 5 }, PAGE_SIZE_RULE],
  ['lastKeys that is text', { lastKeys: LAST_KEY }, LAST_KEYS_RULE],
  ['no last keys', { lastKeys: [] }, LAST_KEYS_RULE],
  ['a last key that is a number', { lastKeys: [...GREEN.manifest.lastKeys.slice(0, -1), 5] }, LAST_KEYS_RULE],
  ['an empty last key', { lastKeys: [...GREEN.manifest.lastKeys.slice(0, -1), ''] }, LAST_KEYS_RULE],
  ['kind runs that are text', { kindRuns: 'Writing' }, KIND_RUNS_RULE],
  ['no kind runs', { kindRuns: [] }, KIND_RUNS_RULE],
  ['a kind run that is not a pair', { kindRuns: [[0]] }, KIND_RUNS_RULE],
  ['a first kind run that does not start at 0', { kindRuns: [[1, 'Writing']] }, KIND_RUNS_RULE],
  [
    'kind runs out of order',
    {
      kindRuns: [
        [0, 'Writing'],
        [5, 'Page'],
        [3, 'Answer'],
      ],
    },
    KIND_RUNS_RULE,
  ],
  [
    'kind runs that repeat an id',
    {
      kindRuns: [
        [0, 'Writing'],
        [5, 'Page'],
        [5, 'Answer'],
      ],
    },
    KIND_RUNS_RULE,
  ],
  [
    'a kind run that starts at the document count',
    {
      kindRuns: [
        [0, 'Writing'],
        [600, 'Page'],
      ],
    },
    KIND_RUNS_RULE,
  ],
  ['a kind run with no kind', { kindRuns: [[0, '']] }, KIND_RUNS_RULE],
  ['a field outside the contract', { titles: ['one'] }, 'field "titles" is not in the contract'],
];

for (const [name, edit, rule] of SHAPE_CASES) {
  test(`a manifest with ${name} is refused for that field alone`, () => {
    assert.deepEqual(problemsOf(withManifest(GREEN.files, edit)), [`search-index: manifest ${rule}`]);
  });
}

test('a manifest at the edge of its shape passes: the last kind run starts at the last document, and one document is enough', () => {
  assert.deepEqual(
    problemsOf(
      withManifest(GREEN.files, {
        kindRuns: [
          [0, 'Writing'],
          [599, 'Page'],
        ],
      })
    ),
    []
  );

  const single = buildSearchIndex([{ href: '/a', title: 'alpha', description: '', kind: 'Writing', text: '' }]);
  assert.equal(single.manifest.documents, 1);
  assert.deepEqual(problemsOf(single.files), []);
});

test('a file the manifest names but the dist lacks is refused by path, chunk or page', () => {
  assert.deepEqual(problemsOf(without(GREEN.files, chunk(3))), [
    `search-index: ${chunk(3)} is named by the manifest but missing`,
  ]);
  assert.deepEqual(problemsOf(without(GREEN.files, page(5))), [
    `search-index: ${page(5)} is named by the manifest but missing`,
  ]);
});

test('a file no manifest names is refused by path: an extra chunk, an extra page, a stray file and a stale version', () => {
  const strays = [chunk(CHUNKS), page(PAGES), '/search-index/notes.txt', chunkPath('0123456789', 0)];

  for (const path of strays) {
    assert.deepEqual(problemsOf(change(GREEN.files, path, '[]')), [
      `search-index: ${path} is not named by the manifest`,
    ]);
  }
});

test('a manifest that counts one more chunk or one more page than the dist holds is refused for the missing file', () => {
  const moreChunks = withManifest(GREEN.files, { lastKeys: [...GREEN.manifest.lastKeys, `${LAST_KEY}z`] });
  const morePages = withManifest(GREEN.files, { documents: GREEN.manifest.documents + GREEN.manifest.pageSize });

  assert.deepEqual(problemsOf(moreChunks), [`search-index: ${chunk(CHUNKS)} is named by the manifest but missing`]);
  assert.deepEqual(problemsOf(morePages), [`search-index: ${page(PAGES)} is named by the manifest but missing`]);
});

test('each legacy artifact in the dist root is refused by name, and files that only share the search name are not', () => {
  for (const name of ['search-entries.json', 'search-index.json', 'search-index-post.json']) {
    assert.deepEqual(problemsOf(change(GREEN.files, `/${name}`, '[]')), [
      `search-index: /${name} is a legacy artifact and must not ship`,
    ]);
  }
  for (const path of ['/search.html', '/search/box.mjs', '/search-demand.json', '/search-indexes.txt']) {
    assert.deepEqual(problemsOf(change(GREEN.files, path, 'x')), [], path);
  }
});

test('4000 files pass the file budget and 4001 are refused, whatever else is in the folder', () => {
  const withStrays = (count) => {
    const copy = new Map(GREEN.files);
    for (let index = 0; index < count; index++) copy.set(`/search-index/stray/${index}.json`, '[]');
    return copy;
  };
  const room = INDEX_FILE_BUDGET - GREEN.files.size;
  const line = (files) => `search-index: ${files} files (over ${INDEX_FILE_BUDGET})`;

  const atBudget = problemsOf(withStrays(room));
  const overBudget = problemsOf(withStrays(room + 1));

  assert.equal(atBudget.length, room);
  assert.ok(!atBudget.includes(line(INDEX_FILE_BUDGET)));
  assert.equal(overBudget.length, room + 2);
  assert.ok(overBudget.includes(line(INDEX_FILE_BUDGET + 1)));
});

test('a worst first query of exactly the cap passes and one byte over it is refused with its size', () => {
  const atCap = withWorstCase(GREEN.files, FIRST_QUERY_BUDGET_BYTES);
  const overCap = withWorstCase(GREEN.files, FIRST_QUERY_BUDGET_BYTES + 1);

  withDist(atCap, (dist) => assert.equal(firstQueryWorstCase(dist), FIRST_QUERY_BUDGET_BYTES));
  assert.deepEqual(problemsOf(atCap), []);
  assert.deepEqual(problemsOf(overCap), [firstQueryLine(FIRST_QUERY_BUDGET_BYTES + 1)]);
});

test('the index does not grow with the corpus: 600 documents sharing 60 words pass, and the same documents with their body text in the page rows do not', () => {
  assert.deepEqual(problemsOf(GREEN.files), []);

  const oldShape = new Map(GREEN.files);
  for (let index = 0; index < PAGES; index++) {
    const rows = rowsOf(GREEN.files, index).map((row, at) => [
      ...row,
      ARTICLES[index * GREEN.manifest.pageSize + at].text,
    ]);
    oldShape.set(page(index), JSON.stringify(rows));
  }
  const problems = problemsOf(oldShape);

  assert.ok(worstCaseOf(oldShape) > FIRST_QUERY_BUDGET_BYTES);
  assert.equal(problems.length, ARTICLES.length + 1);
  assert.equal(problems.filter((line) => line.endsWith(`is not ${ROW_SHAPE}`)).length, ARTICLES.length);
  assert.ok(problems.includes(firstQueryLine(worstCaseOf(oldShape))));
});
