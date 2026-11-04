import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { searchStandIns } from './citations.mjs';
import {
  DEAD,
  OTHER,
  PUBLISHER,
  SNAPSHOT,
  archivedRow,
  entry,
  row,
  searchFor,
  searchedRow,
} from './fixtures/citation-text.mjs';

const made = [];
const treeWith = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'citations-standins-'));
  made.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
};
after(() => made.forEach((root) => rmSync(root, { recursive: true, force: true })));

const listed = (file, fields) => {
  const [collection, name] = file.split('/');
  return {
    path: `site/src/data/${file}`,
    collection,
    slug: name.replace(/\.mdx?$/, ''),
    position: 1,
    sourceTitle: 'The report',
    publisher: null,
    citedOn: '2026-10-25',
    url: searchFor(),
    original: DEAD,
    ...fields,
  };
};

const tree = () =>
  treeWith({
    'site/src/data/glossary/alpha.md': entry({
      sources: [
        ...row(DEAD),
        ...row(
          searchFor('The report', PUBLISHER),
          `    original: ${DEAD}`,
          `    publisher: ${PUBLISHER}`,
          "    retrieved: '2026-10-02'"
        ),
      ],
    }),
    'site/src/data/post/beta.mdx': entry({
      dates: ['publishDate: 2026-09-01', 'updatedDate: 2026-10-26'],
      sources: searchedRow(OTHER),
    }),
    'site/src/data/resource/epsilon.md': entry({
      sources: [
        ...searchedRow(DEAD, "    retrieved: '2026-10-05'"),
        '  - title: A second reading',
        `    url: ${searchFor('A second reading')}`,
        `    original: ${DEAD}`,
        "    retrieved: '2026-10-06'",
      ],
    }),
    'site/src/data/service/delta.md': entry({ sources: archivedRow(DEAD, SNAPSHOT) }),
    'site/src/data/faq/gamma.md': '---\nquestion: Q\nupdatedDate: 2026-10-02\n---\n',
    'site/src/data/author/zeta.md': entry({ sources: searchedRow(DEAD) }),
    'site/src/data/post/notes.txt': `sources: ${DEAD}`,
    'site/src/data/faq/handmade.md': entry({
      sources: row('https://www.google.com/search?q=something+else', `    original: ${DEAD}`),
    }),
  });

test('searchStandIns lists every row that rests on a search link, by path and then by row, each with its own dates and title', () => {
  assert.deepEqual(searchStandIns({ repoRoot: tree() }).standIns, [
    listed('glossary/alpha.md', {
      position: 2,
      publisher: PUBLISHER,
      citedOn: '2026-10-02',
      url: searchFor('The report', PUBLISHER),
    }),
    listed('post/beta.mdx', { citedOn: '2026-10-26', original: OTHER }),
    listed('resource/epsilon.md', { citedOn: '2026-10-05' }),
    listed('resource/epsilon.md', {
      position: 2,
      sourceTitle: 'A second reading',
      citedOn: '2026-10-06',
      url: searchFor('A second reading'),
    }),
  ]);
});

test('searchStandIns leaves out open rows, archive rows, a search nobody built from the row, other collections and other files', () => {
  const { standIns, unreadable } = searchStandIns({ repoRoot: tree() });

  assert.deepEqual(
    standIns.map(({ path }) => path).filter((path) => /delta|zeta|notes|handmade|gamma/.test(path)),
    []
  );
  assert.deepEqual(unreadable, []);
  assert.deepEqual(searchStandIns({ repoRoot: treeWith({}) }), { standIns: [], unreadable: [] });
});

test('searchStandIns names an entry whose date or front matter it cannot read, and still lists every entry it can read', () => {
  const root = treeWith({
    'site/src/data/post/odd.md': entry({ sources: searchedRow(DEAD, "    retrieved: 'last Tuesday'") }),
    'site/src/data/post/broken.md': 'no front matter here\n',
    'site/src/data/post/zeta.md': entry({ sources: searchedRow(OTHER) }),
  });

  const { standIns, unreadable } = searchStandIns({ repoRoot: root });

  assert.deepEqual(
    standIns.map(({ path }) => path),
    ['site/src/data/post/zeta.md']
  );
  assert.deepEqual(
    unreadable.map(({ path }) => path),
    ['site/src/data/post/broken.md', 'site/src/data/post/odd.md']
  );
  assert.match(unreadable[0].message, /^site\/src\/data\/post\/broken\.md: .*front matter/);
  assert.match(unreadable[1].message, /^site\/src\/data\/post\/odd\.md: .*is not a calendar day/);
});
