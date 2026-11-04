import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { citedUrls, citingEntries, SOURCE_COLLECTIONS } from './citations.mjs';

const DEAD = 'https://example.org/report';
const OTHER = 'https://example.org/elsewhere';
const snapshotOf = (address) => `https://web.archive.org/web/20251025031200/${address}`;
const DATES = ['publishDate: 2026-09-08', 'updatedDate: 2026-10-25'];
const entry = ({ dates = DATES, extra = [], sources, body = ['', 'Body.', ''] }) =>
  ['---', 'title: A test entry', ...dates, ...extra, 'sources:', ...sources, '---', ...body].join('\n');
const row = (address, ...more) => ['  - title: The report', `    url: ${address}`, ...more];
const archivedRow = (address, ...more) => row(snapshotOf(address), `    original: ${address}`, ...more);
const searchedRow = (address, ...more) =>
  row(searchFallbackUrl({ title: 'The report' }), `    original: ${address}`, ...more);

const made = [];
const treeWith = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'citations-'));
  made.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
};
after(() => made.forEach((root) => rmSync(root, { recursive: true, force: true })));

test('the cited collections are the five the site has', () => {
  assert.deepEqual(SOURCE_COLLECTIONS, ['post', 'glossary', 'faq', 'service', 'resource']);
});

const listed = (file, fields) => {
  const [collection, name] = file.split('/');
  return {
    path: `site/src/data/${file}`,
    collection,
    slug: name.replace(/\.mdx?$/, ''),
    sourceTitle: 'The report',
    publisher: null,
    retrieved: null,
    updatedDate: '2026-10-25',
    publishDate: '2026-09-08',
    ...fields,
  };
};

const citedTree = () =>
  treeWith({
    'site/src/data/glossary/alpha.md': entry({
      sources: row(DEAD, '    publisher: Example Org', "    retrieved: '2026-10-02'"),
    }),
    'site/src/data/post/beta.mdx': entry({
      dates: ['publishDate: 2026-09-01', 'updatedDate: 2026-10-26'],
      sources: row(DEAD),
    }),
    'site/src/data/resource/epsilon.md': entry({
      sources: [
        ...row(DEAD, "    retrieved: '2026-10-05'"),
        ...row(OTHER, "    retrieved: '2026-10-06'"),
        ...row(DEAD, "    retrieved: '2026-10-20'"),
      ],
    }),
    'site/src/data/faq/gamma.md': '---\nquestion: Q\nupdatedDate: 2026-10-02\n---\n',
    'site/src/data/service/delta.md': entry({ sources: archivedRow(DEAD) }),
    'site/src/data/author/zeta.md': entry({ sources: row(DEAD) }),
    'site/src/data/post/notes.txt': `sources: ${DEAD}`,
  });

test('citingEntries lists the entries whose rows cite the address, sorted by path, with row and entry dates', () => {
  assert.deepEqual(citingEntries({ repoRoot: citedTree(), url: DEAD }), [
    listed('glossary/alpha.md', { publisher: 'Example Org', retrieved: '2026-10-02', citedOn: '2026-10-02', rows: 1 }),
    listed('post/beta.mdx', { publishDate: '2026-09-01', updatedDate: '2026-10-26', citedOn: '2026-10-26', rows: 1 }),
    listed('resource/epsilon.md', { retrieved: '2026-10-05', citedOn: '2026-10-05', rows: 2 }),
  ]);
});

test('citingEntries leaves out archived entries, entries without sources, other collections and other files', () => {
  const repoRoot = citedTree();

  assert.deepEqual(
    citingEntries({ repoRoot, url: DEAD }).map(({ slug }) => slug),
    ['alpha', 'beta', 'epsilon']
  );
  assert.deepEqual(citingEntries({ repoRoot, url: 'https://example.org/nobody' }), []);
});

test('citingEntries reads every date form as the same UTC calendar day, and a missing publishDate as null', () => {
  const forms = [
    ["retrieved: '2026-10-02'", '2026-10-02'],
    ['retrieved: 2026-10-03', '2026-10-03'],
    ["retrieved: '2026-10-02T23:30:00-05:00'", '2026-10-03'],
    ['retrieved: 2026-10-03T00:30:00+02:00', '2026-10-02'],
  ];
  for (const [line, day] of forms) {
    const repoRoot = treeWith({ 'site/src/data/faq/one.md': entry({ sources: row(DEAD, `    ${line}`) }) });
    assert.equal(citingEntries({ repoRoot, url: DEAD })[0].citedOn, day, line);
  }

  const dates = ['updatedDate: 2026-10-25T23:30:00-05:00'];
  const [found] = citingEntries({
    repoRoot: treeWith({ 'site/src/data/faq/one.md': entry({ dates, sources: row(DEAD) }) }),
    url: DEAD,
  });
  assert.deepEqual([found.citedOn, found.updatedDate, found.publishDate], ['2026-10-26', '2026-10-26', null]);
});

test('citingEntries names the entry when a date it needs is not a calendar day or is missing', () => {
  const texts = [
    entry({ sources: row(DEAD, "    retrieved: 'last Tuesday'") }),
    entry({ sources: row(DEAD, "    retrieved: '2026-02-31'") }),
    entry({ dates: ['publishDate: 2026-09-08'], sources: row(DEAD) }),
  ];

  for (const text of texts) {
    const repoRoot = treeWith({ 'site/src/data/post/odd.md': text });
    assert.throws(() => citingEntries({ repoRoot, url: DEAD }), /site\/src\/data\/post\/odd\.md: .*(day|date)/);
  }
});

test('an entry whose front matter cannot be read stops both listings and names its path', () => {
  const repoRoot = treeWith({ 'site/src/data/post/broken.md': 'no front matter here\n' });

  assert.throws(() => citingEntries({ repoRoot, url: DEAD }), /site\/src\/data\/post\/broken\.md: .*front matter/);
  assert.throws(() => citedUrls({ repoRoot }), /site\/src\/data\/post\/broken\.md: .*front matter/);
  assert.deepEqual(citedUrls({ repoRoot: treeWith({}) }), new Map());
});

test('citedUrls maps every cited address to the paths that cite it, once each, rows already archived left out', () => {
  const alphaPath = 'site/src/data/glossary/alpha.md';
  const epsilonPath = 'site/src/data/resource/epsilon.md';

  assert.deepEqual(
    [...citedUrls({ repoRoot: citedTree() })],
    [
      [DEAD, [alphaPath, 'site/src/data/post/beta.mdx', epsilonPath]],
      [OTHER, [epsilonPath]],
    ]
  );
});

test('a row that rests on a search link is listed as cited by no one, like one that rests on a snapshot', () => {
  const repoRoot = treeWith({
    'site/src/data/faq/theta.md': entry({ sources: searchedRow(DEAD) }),
    'site/src/data/post/iota.md': entry({ sources: [...archivedRow(OTHER), ...searchedRow(DEAD)] }),
  });

  assert.deepEqual(citingEntries({ repoRoot, url: DEAD }), []);
  assert.deepEqual(citingEntries({ repoRoot, url: OTHER }), []);
  assert.deepEqual(citedUrls({ repoRoot }), new Map());
});
