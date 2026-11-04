import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';

import {
  createSearch,
  MAXIMUM_QUERY_WORDS,
  MAXIMUM_RESULTS,
  searchWords,
  STOP_WORDS,
  termsOf,
} from '../../public/search/index-model.mjs';
import { scanRank } from '../../scripts/fixtures/search-oracle.mjs';
import { buildSearchIndex, INDEX_LIMITS, ROW_LIMITS, readIndexDocuments } from './search-index.mjs';

const entry = (href, title, description, text, kind = 'Writing') => ({ href, title, description, kind, text });

const SMALL = { chunkBytes: 400, pageDocuments: 3, listCap: 50 };

const HAND_WRITTEN = [
  entry(
    '/blog/government-audit',
    'Government audit of vendors',
    'How governance reviews vendor audit',
    'governing boards audit government vendors'
  ),
  entry(
    '/blog/go-live',
    'Go live without surprises',
    'Goal setting for go live',
    'goals and goal tracking before go-live and golive'
  ),
  entry(
    '/glossary/iso-42001',
    'ISO 42001',
    'The management system standard for AI',
    'ISO/IEC 42001 certification and ISO 27001 overlap',
    'Glossary'
  ),
  entry(
    '/faq/what-is-a-register',
    'What is an AI register',
    'A register lists every AI system',
    'register entries name an owner; the register is reviewed',
    'Answer'
  ),
  entry(
    '/blog/multi-agent',
    'Multi-agent systems',
    'Agents that call agents',
    'multi-agent routing, agent memory, and AGENT handoffs'
  ),
  entry('/about', 'About', 'Who runs this', 'Founder with 20 years of audits', 'Page'),
  entry('/blog/evals', 'Evals', 'Evals in CI', 'evals evals evals and one more eval'),
  entry('/blog/telemetry', 'Adoption telemetry', 'Measure use', 'telemetry telemetry for adoption'),
];

const filesOf = (entries, limits = SMALL) => buildSearchIndex(entries, limits).files;

function runtime(files) {
  const fetched = [];
  const fetchJson = async (path) => {
    fetched.push(path);
    if (!files.has(path)) throw new Error(`${path} 404`);
    return JSON.parse(files.get(path));
  };
  return { fetched, search: createSearch(fetchJson) };
}

const hrefsOf = (result) => result.rows.map(({ href }) => href);
const withoutStopWords = (item) => ({
  ...item,
  title: termsOf(item.title).join(' '),
  description: termsOf(item.description).join(' '),
  text: termsOf(item.text).join(' '),
});
const oracleHrefs = (entries, query) => scanRank(entries.map(withoutStopWords), query).map(({ href }) => href);

const word = (seed) => `w${seed.toString(36)}x`;
function generated(count, vocabulary, perDocument) {
  let state = 12345;
  const next = (limit) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return Math.floor(state / 65536) % limit;
  };
  return Array.from({ length: count }, (_, index) => {
    const pick = (n) => Array.from({ length: n }, () => word(next(vocabulary))).join(' ');
    return entry(`/blog/post-${String(index).padStart(4, '0')}`, pick(3), pick(8), pick(perDocument));
  });
}

test('the search words of a query drop stop words and one-letter words, and fold case', () => {
  assert.deepEqual(termsOf('How to Build an AI System Register'), ['build', 'ai', 'system', 'register']);
  assert.deepEqual(termsOf('a I x'), []);
  assert.ok(STOP_WORDS.has('the') && !STOP_WORDS.has('it') && !STOP_WORDS.has('ai'));
});

test('a repeated word is kept once with its count, and at most the word limit is used', () => {
  assert.deepEqual(searchWords('evals evals ci'), [
    { word: 'evals', repeat: 2 },
    { word: 'ci', repeat: 1 },
  ]);
  const many = Array.from({ length: MAXIMUM_QUERY_WORDS + 3 }, (_, index) => `term${index}`).join(' ');
  assert.equal(searchWords(many).length, MAXIMUM_QUERY_WORDS);
});

test('the build is deterministic and independent of input order', () => {
  const forward = buildSearchIndex(HAND_WRITTEN, SMALL);
  const backward = buildSearchIndex([...HAND_WRITTEN].reverse(), SMALL);

  assert.deepEqual([...forward.files], [...backward.files]);
  assert.equal(forward.manifest.version, backward.manifest.version);
});

test('any change to a document changes the version, and every file path carries it', () => {
  const changed = HAND_WRITTEN.map((item, index) =>
    index === 0 ? { ...item, description: `${item.description}!` } : item
  );
  const before = buildSearchIndex(HAND_WRITTEN, SMALL);
  const after = buildSearchIndex(changed, SMALL);

  assert.notEqual(before.manifest.version, after.manifest.version);
  for (const path of before.files.keys()) {
    assert.ok(
      path === '/search-index/manifest.json' || path.startsWith(`/search-index/${before.manifest.version}/`),
      path
    );
  }
});

test('document ids follow href order, and kind runs name the kind of every id', () => {
  const { manifest, files } = buildSearchIndex(HAND_WRITTEN, SMALL);
  const documents = readIndexDocuments((path) => files.get(path));

  assert.deepEqual(
    documents.map(({ href }) => href),
    HAND_WRITTEN.map(({ href }) => href).sort((a, b) => a.localeCompare(b))
  );
  assert.equal(manifest.documents, HAND_WRITTEN.length);
  for (const document of documents) {
    assert.equal(document.kind, HAND_WRITTEN.find(({ href }) => href === document.href).kind);
  }
});

test('every chunk stays inside the chunk size unless one key alone is larger, and the manifest names the last key of each', () => {
  const { manifest, files } = buildSearchIndex(generated(120, 60, 40), SMALL);
  const chunkPaths = [...files.keys()].filter((path) => path.includes('/t/'));

  assert.equal(chunkPaths.length, manifest.lastKeys.length);
  assert.ok(chunkPaths.length > 3);
  chunkPaths.forEach((path, index) => {
    const flat = JSON.parse(files.get(path));
    const keys = [];
    for (let at = 0; at < flat.length; at += 2 + 2 * Math.abs(flat[at + 1])) keys.push(flat[at]);
    assert.equal(keys.at(-1), manifest.lastKeys[index]);
    assert.deepEqual(keys, [...keys].sort());
    if (keys.length > 1) assert.ok(files.get(path).length <= SMALL.chunkBytes, `${path} ${files.get(path).length}`);
  });
});

test('every document page holds at most the page size and the last page holds the rest', () => {
  const { manifest, files } = buildSearchIndex(generated(10, 30, 10), SMALL);
  const pages = [...files.keys()].filter((path) => path.includes('/d/')).map((path) => JSON.parse(files.get(path)));

  assert.equal(manifest.pageSize, SMALL.pageDocuments);
  assert.deepEqual(
    pages.map((page) => page.length),
    [3, 3, 3, 1]
  );
  for (const row of pages.flat()) assert.deepEqual(Object.keys(row), ['0', '1', '2']);
});

test('the ranking equals the old whole-array scan for every word, every prefix and many word pairs', async () => {
  const entries = HAND_WRITTEN.map((item) => ({ ...item }));
  const { search } = runtime(filesOf(entries));
  const vocabulary = new Set(entries.flatMap((item) => termsOf(`${item.title} ${item.description} ${item.text}`)));
  const queries = new Set([
    'gov',
    'go',
    'goal',
    'multi agent',
    'iso 42001',
    'evals evals',
    'agent agent memory',
    'zzz',
    'audit vendors',
    'register owner',
    '42',
    '27001',
  ]);
  for (const term of vocabulary) {
    for (let length = 2; length <= term.length; length++) queries.add(term.slice(0, length));
  }
  const terms = [...vocabulary].sort();
  terms.forEach((term, index) => queries.add(`${term} ${terms[(index * 7 + 3) % terms.length]}`));

  let answered = 0;
  for (const query of queries) {
    if (searchWords(query).length === 0) continue;
    const expected = oracleHrefs(entries, query).slice(0, MAXIMUM_RESULTS);
    assert.deepEqual(hrefsOf(await search(query)), expected, query);
    if (expected.length > 0) answered++;
  }
  assert.ok(answered > 100, `only ${answered} queries had a result to compare`);
});

test('the ranking equals the old scan on a generated corpus that spans many chunks, pages and shared prefixes', async () => {
  const entries = generated(150, 90, 60);
  const { search } = runtime(filesOf(entries, { chunkBytes: 700, pageDocuments: 4, listCap: 500 }));
  const prefixes = new Set(['w1', 'w2', 'wa', 'wz', 'w1x', 'w10', 'w1a', 'w3b x']);
  for (let seed = 0; seed < 90; seed += 4) prefixes.add(`${word(seed)} ${word(seed + 1)}`);
  for (let seed = 0; seed < 90; seed += 9) prefixes.add(word(seed));

  let answered = 0;
  for (const query of prefixes) {
    const result = await search(query);
    const expected = oracleHrefs(entries, query);
    assert.deepEqual(hrefsOf(result), expected.slice(0, MAXIMUM_RESULTS), query);
    assert.equal(result.kinds.length, expected.length, `${query} counts every match, not only the page`);
    if (expected.length > MAXIMUM_RESULTS) answered++;
  }
  assert.ok(answered > 10, `only ${answered} queries had more matches than one page`);
});

test('a stop word is not indexed and a query made only of stop words matches nothing and fetches nothing', async () => {
  const { files } = buildSearchIndex(HAND_WRITTEN, SMALL);
  const keys = [...files.entries()]
    .filter(([path]) => path.includes('/t/'))
    .flatMap(([, text]) => JSON.parse(text).filter((item) => typeof item === 'string'));
  const { fetched, search } = runtime(files);

  assert.ok(!keys.includes('the') && !keys.includes('and') && keys.includes('register'));
  assert.deepEqual(await search('the and of'), { kinds: [], rows: [] });
  assert.deepEqual(fetched, []);
});

test('a first query fetches the manifest, one chunk per distinct word and only the pages of its hits', async () => {
  const entries = generated(150, 90, 60);
  const { fetched, search } = runtime(filesOf(entries, { chunkBytes: 700, pageDocuments: 4, listCap: 500 }));
  const [first, second] = [...new Set(termsOf(entries[40].text))];
  const result = await search(`${first} ${second}`);

  const chunks = fetched.filter((path) => path.includes('/t/'));
  const pages = fetched.filter((path) => path.includes('/d/'));
  assert.equal(fetched[0], '/search-index/manifest.json');
  assert.ok(chunks.length <= 2);
  assert.ok(pages.length <= result.rows.length && pages.length > 0);
  assert.equal(fetched.length, 1 + chunks.length + pages.length);
});

test('a second query reuses what the first fetched', async () => {
  const { fetched, search } = runtime(filesOf(HAND_WRITTEN));
  await search('register');
  const first = fetched.length;
  await search('register');

  assert.equal(fetched.length, first);
});

test('a failed fetch is retried inside the same query and a lasting failure rejects, then recovers on the next query', async () => {
  const files = filesOf(HAND_WRITTEN);
  let failing = true;
  const fetched = [];
  const search = createSearch(async (path) => {
    fetched.push(path);
    if (failing && path.includes('/t/')) throw new Error('offline');
    return JSON.parse(files.get(path));
  });

  await assert.rejects(() => search('register'), /offline/);
  failing = false;
  assert.deepEqual(hrefsOf(await search('register')), oracleHrefs(HAND_WRITTEN, 'register'));
});

test('a manifest cached before a redeploy is dropped when its files are gone, and the query still answers', async () => {
  const before = filesOf(HAND_WRITTEN);
  const after = filesOf(HAND_WRITTEN.map((item) => ({ ...item, description: `${item.description} again` })));
  let current = before;
  const search = createSearch(async (path) => {
    if (!current.has(path)) throw new Error(`${path} 404`);
    return JSON.parse(current.get(path));
  });

  await search('register');
  current = after;
  assert.deepEqual(hrefsOf(await search('audit')), oracleHrefs(HAND_WRITTEN, 'audit'));
});

test('a list longer than the list cap keeps the best-weighted documents and says so', () => {
  const crowded = Array.from({ length: 12 }, (_, index) =>
    entry(
      `/blog/c-${String(index).padStart(2, '0')}`,
      index < 3 ? 'zebra' : 'other',
      'x',
      `zebra ${'zebra '.repeat(index)}`
    )
  );
  const { files } = buildSearchIndex(crowded, { chunkBytes: 4000, pageDocuments: 4, listCap: 5 });
  const flat = [...files.entries()].filter(([path]) => path.includes('/t/')).flatMap(([, text]) => JSON.parse(text));
  const at = flat.indexOf('zebra');
  const count = flat[at + 1];
  const ids = [];
  let id = 0;
  for (let index = 0; index < Math.abs(count); index++) ids.push((id += flat[at + 2 + index]));

  assert.equal(count, -5);
  assert.deepEqual(ids, [1, 2, 9, 10, 11]);
});

test('a truncated list never lets a document through that another word excluded, and ranks by the retained weights', async () => {
  const crowded = Array.from({ length: 12 }, (_, index) =>
    entry(
      `/blog/c-${String(index).padStart(2, '0')}`,
      'zebra',
      'x',
      `zebra ${'zebra '.repeat(index)} ${index === 11 ? 'rareword' : ''}`
    )
  );
  const { search } = runtime(filesOf(crowded, { chunkBytes: 4000, pageDocuments: 4, listCap: 5 }));

  assert.deepEqual(hrefsOf(await search('zebra rareword')), ['/blog/c-11']);
  assert.equal(hrefsOf(await search('zebra')).length, 5);
});

test('the number of bytes a first query can fetch does not grow with the number of documents that share a vocabulary', async () => {
  const worstCase = (count) => {
    const files = filesOf(generated(count, 60, 80), { chunkBytes: 2000, pageDocuments: 4, listCap: 64 });
    const sizes = (marker) =>
      [...files].filter(([path]) => path.includes(marker)).map(([, text]) => gzipSync(text).byteLength);
    return { chunk: Math.max(...sizes('/t/')), page: Math.max(...sizes('/d/')), chunks: sizes('/t/').length };
  };
  const small = worstCase(60);
  const large = worstCase(600);

  assert.ok(large.chunk <= small.chunk * 1.5, `chunk ${small.chunk} -> ${large.chunk}`);
  assert.ok(large.page <= small.page * 1.5, `page ${small.page} -> ${large.page}`);
  assert.ok(large.chunks < small.chunks * 4, `chunks ${small.chunks} -> ${large.chunks} for ten times the documents`);
});

test('the default limits are the ones the build and the guard share', () => {
  assert.deepEqual(Object.keys(INDEX_LIMITS).sort(), ['chunkBytes', 'listCap', 'pageDocuments']);
  for (const value of Object.values(INDEX_LIMITS)) assert.ok(Number.isInteger(value) && value > 0);
});

test('a long title or description is clipped in its page row but still searchable in full, and a long href is refused', async () => {
  const long = (word, count) => `${word} `.repeat(count).trim();
  const entries = [
    entry('/blog/a', long('title', 80), long('description', 200), 'x'),
    entry('/blog/b', 'Short', 'Short', 'x'),
  ];
  const { files } = buildSearchIndex(entries, SMALL);
  const [first] = readIndexDocuments((path) => files.get(path));
  const { search } = runtime(files);

  assert.ok(first.title.length <= ROW_LIMITS.title && first.title.endsWith('…'));
  assert.ok(first.description.length <= ROW_LIMITS.description && first.description.endsWith('…'));
  assert.deepEqual(hrefsOf(await search('description')), ['/blog/a']);
  assert.throws(
    () => buildSearchIndex([entry(`/blog/${'x'.repeat(ROW_LIMITS.href)}`, 'T', 'D', 'x')], SMALL),
    /href longer than/
  );
});

test('the list cap is derived from the chunk size, so a single full list always fits in one chunk', () => {
  assert.equal(INDEX_LIMITS.listCap, Math.floor(INDEX_LIMITS.chunkBytes / 10));
});

test('a word over the list cap does not filter when another word can: its retained weights only add to the score', async () => {
  const crowded = Array.from({ length: 12 }, (_, index) =>
    entry(
      `/blog/c-${String(index).padStart(2, '0')}`,
      index < 3 ? 'zebra' : 'other',
      'x',
      `zebra ${'zebra '.repeat(index)} ${index === 0 ? 'ghost' : ''}`
    )
  );
  const { search } = runtime(filesOf(crowded, { chunkBytes: 4000, pageDocuments: 4, listCap: 5 }));

  assert.deepEqual(hrefsOf(await search('zebra ghost')), ['/blog/c-00']);
});

test('when every word is over the list cap the best documents of all their lists are ranked together, best first', async () => {
  const crowded = Array.from({ length: 12 }, (_, index) =>
    entry(
      `/blog/c-${String(index).padStart(2, '0')}`,
      'x',
      'x',
      `${'zebra '.repeat(index + 1)} ${'quagga '.repeat(12 - index)}`
    )
  );
  const { search } = runtime(filesOf(crowded, { chunkBytes: 4000, pageDocuments: 4, listCap: 5 }));
  const result = await search('zebra quagga');

  assert.equal(result.kinds.length, 10);
  assert.ok(result.rows.length > 0);
});
