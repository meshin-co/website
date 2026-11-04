import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as rewrites from './citation-rewrites.mjs';
import { DEAD, SNAPSHOT, entry, refused, row } from './fixtures/citation-text.mjs';

const NOT_AN_ENTRY = `Just text citing ${DEAD}.\n`;
const OPEN_ROW = entry({ sources: row(DEAD) });
const NO_TITLE = entry({ sources: [`  - url: ${DEAD}`] });
const SHARED_REFUSALS = [
  ['archivedEntryText', () => rewrites.archivedEntryText({ text: NOT_AN_ENTRY, url: DEAD, archiveUrl: SNAPSHOT })],
  ['searchedEntryText', () => rewrites.searchedEntryText({ text: NOT_AN_ENTRY, url: DEAD })],
  ['restoredEntryText', () => rewrites.restoredEntryText({ text: NOT_AN_ENTRY, original: DEAD })],
  ['upgradedEntryText', () => rewrites.upgradedEntryText({ text: NOT_AN_ENTRY, original: DEAD, archiveUrl: SNAPSHOT })],
];
const OWN_REFUSALS = [
  [
    'archivedEntryText',
    () => rewrites.archivedEntryText({ text: OPEN_ROW, url: DEAD, archiveUrl: DEAD }),
    /not a Wayback snapshot of/,
  ],
  ['searchedEntryText', () => rewrites.searchedEntryText({ text: NO_TITLE, url: DEAD }), /has no title/],
  [
    'restoredEntryText',
    () => rewrites.restoredEntryText({ text: OPEN_ROW, original: DEAD }),
    /no source row rests on a search link/,
  ],
  [
    'upgradedEntryText',
    () => rewrites.upgradedEntryText({ text: OPEN_ROW, original: DEAD, archiveUrl: DEAD }),
    /not a Wayback snapshot of/,
  ],
];

test('the module offers the four rewrites and re-exports nothing', () => {
  assert.deepEqual(Object.keys(rewrites).sort(), SHARED_REFUSALS.map(([name]) => name).sort());
});

for (const [name, refuse] of SHARED_REFUSALS) {
  test(`${name} refuses a text that is no entry through the parse the read side shares`, () => {
    refused(refuse, /no front matter block between --- lines/);
  });
}

for (const [name, refuse, pattern] of OWN_REFUSALS) {
  test(`${name} refuses with the RewriteError of entry-surgery, the one every caller catches`, () => {
    refused(refuse, pattern);
  });
}
