import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { searchFallbackUrl, standInNote } from '../src/utils/archive-url.mjs';
import { constantRows, untraceableText } from './editorial-inventory.mjs';

const ORIGINAL = 'https://example.org/report';
const ARCHIVE_NOTE = standInNote({
  title: 'The report',
  url: `https://web.archive.org/web/20251025031200/${ORIGINAL}`,
  original: ORIGINAL,
});
const SEARCH_NOTE = standInNote({
  title: 'The report',
  url: searchFallbackUrl({ title: 'The report' }),
  original: ORIGINAL,
});
const NOTES = [ARCHIVE_NOTE, SEARCH_NOTE];
const untraceable = (text) => untraceableText([{ route: '/x', html: `<main><p>${text}</p></main>` }], []);

test('both notes were read from the one function that writes them', () => {
  assert.equal(typeof ARCHIVE_NOTE, 'string');
  assert.equal(typeof SEARCH_NOTE, 'string');
  assert.notEqual(ARCHIVE_NOTE, SEARCH_NOTE);
});

test('a source line that ends in a stand-in note is composed metadata, whatever the publisher and retrieved date before it', () => {
  const lines = [
    'European Commission, AI Act Service Desk · retrieved 2026-10-02',
    'UK Financial Conduct Authority · retrieved 2026-10-02',
    'NIST · retrieved 2026-10-02',
    'European Commission, AI Act Service Desk',
    'UK Financial Conduct Authority',
    'doi.org',
  ];

  for (const note of NOTES) {
    for (const line of lines) assert.deepEqual(untraceable(`${line} · ${note}`), [], `${line} · ${note}`);
  }
});

test('a note that is not exactly one of the two is authored copy, and so is a note that is not the end of the line', () => {
  const invented = [
    'NIST · retrieved 2026-10-02 · this page was rewritten by a robot last night',
    'NIST · retrieved 2026-10-02 · Internet Archive copy, captured last Tuesday',
    `NIST · retrieved 2026-10-02 · ${ARCHIVE_NOTE} and then some more words`,
    `NIST · retrieved 2026-10-02 · ${SEARCH_NOTE}, so read it twice`,
    `The register notes that the source moved, and ${SEARCH_NOTE}`,
    `We wrote down that ${ARCHIVE_NOTE}`,
    `${SEARCH_NOTE} and nothing else on the line`,
  ];

  for (const text of invented) assert.equal(untraceable(text).length, 1, text);
});

const MODULE = { file: 'src/utils/archive-url.mjs', source: readFileSync('src/utils/archive-url.mjs', 'utf8') };
const textsOf = (rows) => rows.map(({ text }) => text);

test('the module that writes the two notes adds no source copy to the ledger, because a note is composed text', () => {
  assert.deepEqual(textsOf(constantRows([MODULE])), []);
});

test('only the fixed words of the two notes are exempt as source copy; a longer sentence that quotes them is not', () => {
  const source = [
    `const SEARCH_NOTE = '${SEARCH_NOTE}';`,
    `const LEAD = 'Internet Archive copy, captured';`,
    `const LONGER = '${SEARCH_NOTE}, so read it twice';`,
    `const REWORDED = 'Internet Archive copy, captured by a robot';`,
    `const OTHER = 'A sentence nobody reviewed yet';`,
  ].join('\n');

  assert.deepEqual(textsOf(constantRows([{ file: 'src/utils/other.mjs', source }])), [
    `${SEARCH_NOTE}, so read it twice`,
    'Internet Archive copy, captured by a robot',
    'A sentence nobody reviewed yet',
  ]);
});
