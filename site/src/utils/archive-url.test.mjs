import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SEARCH_ORIGIN,
  archiveSnapshot,
  archiveUrlFor,
  capturedOn,
  citedHost,
  isSearchFor,
  isSnapshotOf,
  isStandInNote,
  isStandInPhrase,
  searchFallbackUrl,
  standInKind,
  standInNote,
} from './archive-url.mjs';

const DOI = 'https://doi.org/10.6028/NIST.AI.100-1';
const SNAPSHOT = `https://web.archive.org/web/20251025031200/${DOI}`;
const MEDIA = 'https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF';
const RAW_SNAPSHOT = `https://web.archive.org/web/20260612015047id_/${MEDIA}`;

test('a snapshot address names the capture instant and the address that was captured', () => {
  assert.deepEqual(archiveSnapshot(SNAPSHOT), { timestamp: '20251025031200', original: DOI });
});

test('the raw form with an id_ flag, which one entry already cites, is a snapshot of the same address', () => {
  assert.deepEqual(archiveSnapshot(RAW_SNAPSHOT), { timestamp: '20260612015047', original: MEDIA });
});

test('an address that is not a full Wayback snapshot is not one', () => {
  const refused = [
    DOI,
    `http://web.archive.org/web/20251025031200/${DOI}`,
    `https://web.archive.org/web/2025102503/${DOI}`,
    'https://web.archive.org/web/20251025031200/',
    'https://web.archive.org/web/20251025031200',
    `https://example.com/web/20251025031200/${DOI}`,
    `https://web.archive.org/save/${DOI}`,
    'not a url',
    undefined,
  ];
  for (const address of refused) assert.equal(archiveSnapshot(address), null, String(address));
});

test('a snapshot is of an address when the address it captured is the same one', () => {
  assert.equal(isSnapshotOf(SNAPSHOT, DOI), true);
  assert.equal(isSnapshotOf(RAW_SNAPSHOT, MEDIA), true);
  assert.equal(
    isSnapshotOf('https://web.archive.org/web/20251025031200/https://example.com', 'https://example.com/'),
    true
  );
});

test('a snapshot of another address, or an address that is no snapshot, is not of the original', () => {
  assert.equal(isSnapshotOf(SNAPSHOT, 'https://doi.org/10.6028/NIST.AI.100-2'), false);
  assert.equal(isSnapshotOf(SNAPSHOT, 'https://doi.org/10.6028/nist.ai.100-1'), false);
  assert.equal(isSnapshotOf(DOI, DOI), false);
  assert.equal(isSnapshotOf(SNAPSHOT, 'not a url'), false);
});

test('the capture date is read from the timestamp, and an impossible date reads as nothing', () => {
  assert.equal(capturedOn(SNAPSHOT), '2025-10-25');
  assert.equal(capturedOn(RAW_SNAPSHOT), '2026-06-12');
  assert.equal(capturedOn(`https://web.archive.org/web/20251345000000/${DOI}`), null);
  assert.equal(capturedOn(DOI), null);
});

test('the address of a capture is built from the instant and the original, and reads back the same', () => {
  const built = archiveUrlFor({ timestamp: '20251025031200', original: DOI });

  assert.equal(built, SNAPSHOT);
  assert.deepEqual(archiveSnapshot(built), { timestamp: '20251025031200', original: DOI });
});

test('an address is never built from a timestamp that is not fourteen digits', () => {
  assert.throws(() => archiveUrlFor({ timestamp: '20251025', original: DOI }), /fourteen digits/);
});

const SOURCE = { title: 'The report', publisher: 'Example Org' };
const SEARCH = 'https://www.google.com/search?q=%22The+report%22+Example+Org';
const SEARCH_NOTE = 'the original page has gone; this link is a search for it';
const queryOf = (url) => new URL(url).searchParams.get('q');

test('a search link goes to the search origin and asks for the title as a phrase, then the publisher', () => {
  assert.equal(SEARCH_ORIGIN, 'https://www.google.com/search');
  assert.equal(searchFallbackUrl(SOURCE), SEARCH);
  assert.equal(queryOf(searchFallbackUrl(SOURCE)), '"The report" Example Org');
});

test('a search link is the same address every time, whatever order the fields were written in', () => {
  assert.equal(searchFallbackUrl({ publisher: 'Example Org', title: 'The report' }), SEARCH);
  assert.equal(searchFallbackUrl({ ...SOURCE }), searchFallbackUrl({ ...SOURCE }));
});

test('a source with no publisher, an empty one or a blank one is searched for by its title alone', () => {
  const alone = 'https://www.google.com/search?q=%22The+report%22';

  assert.equal(searchFallbackUrl({ title: 'The report' }), alone);
  assert.equal(searchFallbackUrl({ title: 'The report', publisher: undefined }), alone);
  assert.equal(searchFallbackUrl({ title: 'The report', publisher: '' }), alone);
  assert.equal(searchFallbackUrl({ title: 'The report', publisher: '   ' }), alone);
});

test('quotes, separators and non-ASCII letters in a title stay inside one encoded query value', () => {
  const titles = [
    "It's a 100% trial: A&B = C+D? #1",
    'Überprüfung – Café 日本語 🚀',
    'Regulation (EU) 2024/1689 [AI Act] {draft}',
  ];

  for (const title of titles) {
    const url = searchFallbackUrl({ title, publisher: 'Publisher & Sons' });
    const parsed = new URL(url);

    assert.equal(parsed.origin + parsed.pathname, SEARCH_ORIGIN, title);
    assert.deepEqual([...parsed.searchParams.keys()], ['q'], title);
    assert.equal(queryOf(url), `"${title}" Publisher & Sons`, title);
    assert.doesNotMatch(url, /[\s"'<>#{}[\]\\]/u, title);
  }
});

test('a title that already holds double quotes cannot end its own phrase early', () => {
  const url = searchFallbackUrl({ title: 'The "Big" Report, 5" pipe', publisher: 'Example Org' });

  assert.equal(queryOf(url), '"The Big Report, 5 pipe" Example Org');
  assert.equal(queryOf(url).split('"').length - 1, 2);
});

test('whitespace inside and around a title or publisher is collapsed, so one source has one search', () => {
  const messy = searchFallbackUrl({ title: '  The \n report\t ', publisher: ' Example   Org ' });

  assert.equal(messy, SEARCH);
});

test('a search link is never built from a title that holds no words', () => {
  for (const title of [undefined, null, 7, '', '   ', '""']) {
    assert.throws(() => searchFallbackUrl({ title, publisher: 'Example Org' }), /title/, String(title));
  }
});

test('an address is the search for a source only when it is exactly the search built from that source', () => {
  assert.equal(isSearchFor(SEARCH, SOURCE), true);
  assert.equal(isSearchFor(SEARCH, { title: 'The report', publisher: 'Another Org' }), false);
  assert.equal(isSearchFor(SEARCH, { title: 'Another report', publisher: 'Example Org' }), false);
  assert.equal(isSearchFor(`${SEARCH}&hl=en`, SOURCE), false);
  assert.equal(isSearchFor(SEARCH.replace('https', 'http'), SOURCE), false);
  assert.equal(isSearchFor(SNAPSHOT, SOURCE), false);
  assert.equal(isSearchFor(undefined, SOURCE), false);
  assert.equal(isSearchFor(SEARCH, { title: undefined, publisher: 'Example Org' }), false);
});

test('a stand-in is an archive copy when the url is a snapshot of the original it names', () => {
  assert.equal(standInKind({ ...SOURCE, url: SNAPSHOT, original: DOI }), 'archive');
  assert.equal(standInKind({ ...SOURCE, url: RAW_SNAPSHOT, original: MEDIA }), 'archive');
});

test('a stand-in is a search when the url is the search for this source and an original is named', () => {
  assert.equal(standInKind({ ...SOURCE, url: SEARCH, original: DOI }), 'search');
  assert.equal(
    standInKind({ title: 'The report', url: 'https://www.google.com/search?q=%22The+report%22', original: DOI }),
    'search'
  );
});

test('a row with no original is no stand-in, whatever its url looks like', () => {
  assert.equal(standInKind({ ...SOURCE, url: SNAPSHOT }), null);
  assert.equal(standInKind({ ...SOURCE, url: SEARCH }), null);
  assert.equal(standInKind({ ...SOURCE, url: DOI }), null);
  assert.equal(standInKind({ ...SOURCE, url: SEARCH, original: undefined }), null);
});

test('a url that stands in for nothing the row names is no stand-in', () => {
  const another = 'https://doi.org/10.6028/NIST.AI.100-2';

  assert.equal(standInKind({ ...SOURCE, url: SNAPSHOT, original: another }), null);
  assert.equal(standInKind({ ...SOURCE, url: DOI, original: DOI }), null);
  assert.equal(standInKind({ ...SOURCE, url: searchFallbackUrl({ title: 'Another report' }), original: DOI }), null);
  assert.equal(standInKind({ ...SOURCE, url: searchFallbackUrl({ title: 'The report' }), original: DOI }), null);
  assert.equal(standInKind({ ...SOURCE, url: SEARCH, original: 7 }), null);
});

test('an archive address whose timestamp is no calendar day is no stand-in, because nothing could date it', () => {
  const undated = `https://web.archive.org/web/20251345000000/${DOI}`;

  assert.equal(standInKind({ ...SOURCE, url: undated, original: DOI }), null);
});

test('the note on an archive copy names the day read from the timestamp of its address', () => {
  assert.equal(standInNote({ ...SOURCE, url: SNAPSHOT, original: DOI }), 'Internet Archive copy, captured 2025-10-25');
  assert.equal(
    standInNote({ ...SOURCE, url: RAW_SNAPSHOT, original: MEDIA }),
    'Internet Archive copy, captured 2026-06-12'
  );
});

test('the note on a search link says the original page has gone and that the link is a search', () => {
  assert.equal(standInNote({ ...SOURCE, url: SEARCH, original: DOI }), SEARCH_NOTE);
});

test('a row that is no stand-in has no note', () => {
  assert.equal(standInNote({ ...SOURCE, url: DOI }), null);
  assert.equal(standInNote({ ...SOURCE, url: SNAPSHOT }), null);
  assert.equal(standInNote({ ...SOURCE, url: SNAPSHOT, original: 'https://doi.org/other' }), null);
});

test('a text is a stand-in note only when it is exactly one of the two notes', () => {
  assert.equal(isStandInNote(SEARCH_NOTE), true);
  assert.equal(isStandInNote('Internet Archive copy, captured 2025-10-25'), true);
  const invented = [
    '',
    'Internet Archive copy',
    'Internet Archive copy, captured 25 Oct 2025',
    'Internet Archive copy, captured 2025-10-25 and verified',
    'internet archive copy, captured 2025-10-25',
    `${SEARCH_NOTE}.`,
    'the original page has gone',
    'this link is a search for it',
    'retrieved 2026-10-02',
  ];
  for (const text of invented) assert.equal(isStandInNote(text), false, text);
});

test('the host a source is labelled with is the host of the address it cites, never of the copy standing in for it', () => {
  assert.equal(citedHost({ url: DOI }), 'doi.org');
  assert.equal(citedHost({ url: 'https://www.nist.gov/itl/ai-risk-management-framework' }), 'nist.gov');
  assert.equal(citedHost({ url: SNAPSHOT, original: DOI }), 'doi.org');
  assert.equal(citedHost({ url: RAW_SNAPSHOT, original: MEDIA }), 'media.defense.gov');
  assert.equal(citedHost({ ...SOURCE, url: SEARCH, original: 'https://www.eur-lex.europa.eu/x' }), 'eur-lex.europa.eu');
});

test('the fixed words of the two notes are told apart from every other sentence, so they can be left out of the ledger', () => {
  assert.equal(isStandInPhrase(SEARCH_NOTE), true);
  assert.equal(isStandInPhrase('Internet Archive copy, captured'), true);
  for (const text of [
    '',
    'Internet Archive copy',
    `${SEARCH_NOTE}, so read it twice`,
    'Internet Archive copy, captured 2025-10-25',
  ]) {
    assert.equal(isStandInPhrase(text), false, text);
  }
});
