import assert from 'node:assert/strict';
import { test } from 'node:test';

import { capturedOn, isSnapshotOf, standInKind } from '../src/utils/archive-url.mjs';
import { archivedEntryText, searchedEntryText, upgradedEntryText } from './citation-rewrites.mjs';
import {
  DEAD,
  OTHER,
  PUBLISHER,
  SNAPSHOT,
  STYLES,
  archivedRow,
  bodyForms,
  crlf,
  entry,
  frontmatterOf,
  refused,
  row,
  searchFor,
  searchedRow,
  stringsCiting,
} from './fixtures/citation-text.mjs';

const upgrade = (text, changes) => upgradedEntryText({ text, original: DEAD, archiveUrl: SNAPSHOT, ...changes });
const secondReading = (url, ...more) => ['  - title: A second reading', `    url: ${url}`, ...more];

function assertUpgraded({ body, extra = () => [], kept = [] }) {
  assert.equal(
    upgrade(entry({ extra: extra(searchFor()), sources: [...searchedRow(DEAD), ...kept], body: body?.(searchFor()) })),
    entry({ extra: extra(SNAPSHOT), sources: [...archivedRow(DEAD, SNAPSHOT), ...kept], body: body?.(SNAPSHOT) })
  );
}

for (const [style, spell] of STYLES) {
  test(`a ${style} search row moves to the snapshot in its own quoting and keeps the original line as it was`, () => {
    const tail = [`    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'"];
    const standIn = searchFor('The report', PUBLISHER);

    assert.equal(
      upgrade(entry({ sources: row(spell(standIn), `    original: ${spell(DEAD)}`, ...tail) })),
      entry({ sources: row(spell(SNAPSHOT), `    original: ${spell(DEAD)}`, ...tail) })
    );
  });
}

test('the upgraded row is an archive row: a snapshot of its own original, with a capture day', () => {
  const [source] = frontmatterOf(upgrade(entry({ sources: searchedRow(DEAD) }))).sources;

  assert.equal(source.url, SNAPSHOT);
  assert.equal(source.original, DEAD);
  assert.equal(standInKind(source), 'archive');
  assert.equal(isSnapshotOf(source.url, source.original), true);
  assert.equal(capturedOn(source.url), '2025-10-25');
});

test('every form a body cites the search in is pointed at the snapshot: links, autolinks, definitions, cells, bare text', () => {
  assertUpgraded({ body: bodyForms });
});

test('links inside other front matter strings are pointed at the snapshot, and the front matter still reads as it should', () => {
  assertUpgraded({ extra: stringsCiting });
  const parsed = frontmatterOf(upgrade(entry({ extra: stringsCiting(searchFor()), sources: searchedRow(DEAD) })));

  assert.equal(parsed.answer, `See [the report](${SNAPSHOT}) for the detail.`);
  assert.equal(parsed.sources[0].original, DEAD);
});

test('upgrading what the search rewrite made is what the archive rewrite of the same entry makes, byte for byte', () => {
  const sources = [...row(DEAD, `    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'"), ...row(OTHER)];
  const before = entry({ extra: stringsCiting(DEAD), sources, body: bodyForms(DEAD) });
  const archived = (text) => archivedEntryText({ text, url: DEAD, archiveUrl: SNAPSHOT });

  assert.equal(upgrade(searchedEntryText({ text: before, url: DEAD })), archived(before));
  assert.equal(upgrade(searchedEntryText({ text: crlf(before), url: DEAD })), archived(crlf(before)));
});

test('every row that rests on a search link for the address moves to the snapshot, each with the prose that linked to its own search', () => {
  const another = searchFor('Another');
  const kept = ['  - title: Another', `    url: ${another}`, `    original: ${OTHER}`];
  const second = searchFor('A second reading', PUBLISHER);
  const sources = [
    ...searchedRow(DEAD),
    ...secondReading(second, `    original: ${DEAD}`, `    publisher: ${PUBLISHER}`),
    ...kept,
  ];
  const prose = (first, other) => ['', `[one](${first}) and [two](${other}) and [other](${another}).`, ''];

  assert.equal(
    upgrade(entry({ sources, body: prose(searchFor(), second) })),
    entry({
      sources: [
        ...archivedRow(DEAD, SNAPSHOT),
        ...secondReading(SNAPSHOT, `    original: ${DEAD}`, `    publisher: ${PUBLISHER}`),
        ...kept,
      ],
      body: prose(SNAPSHOT, SNAPSHOT),
    })
  );
});

test('naming the rows upgrades those rows only, and the prose that links to the search of another row stays', () => {
  const searched = secondReading(searchFor('A second reading'), `    original: ${DEAD}`);
  const body = (first, second) => ['', `[first](${first}) and [second](${second}).`, ''];
  const before = entry({
    sources: [...searchedRow(DEAD), ...searched],
    body: body(searchFor(), searchFor('A second reading')),
  });

  assert.equal(
    upgrade(before, { positions: [1] }),
    entry({
      sources: [...archivedRow(DEAD, SNAPSHOT), ...searched],
      body: body(SNAPSHOT, searchFor('A second reading')),
    })
  );
});

test('a row that stays on the very same search link keeps it, unless prose links to that search and could mean either address', () => {
  const twins = [...searchedRow(DEAD), ...searchedRow(OTHER)];

  assert.equal(
    upgrade(entry({ sources: twins })),
    entry({ sources: [...archivedRow(DEAD, SNAPSHOT), ...searchedRow(OTHER)] })
  );
  refused(
    () => upgrade(entry({ sources: twins, body: ['', `See [the report](${searchFor()}).`, ''] })),
    /more than one row rests on/
  );
});

test('a snapshot that is not of the original, or has no capture day, is refused whatever the rows hold', () => {
  const text = entry({ sources: searchedRow(DEAD) });
  const noDay = `https://web.archive.org/web/20251345031200/${DEAD}`;

  refused(
    () => upgrade(text, { archiveUrl: `https://web.archive.org/web/20251025031200/${OTHER}` }),
    /not a Wayback snapshot of/
  );
  refused(() => upgrade(text, { archiveUrl: DEAD }), /not a Wayback snapshot of/);
  refused(() => upgrade(text, { archiveUrl: noDay }), /sources row 1 reads/);
});

test('a row that does not rest on a search link for the address is refused, whatever it rests on instead', () => {
  const pattern = /no source row rests on a search link for https:\/\/example\.org\/report/;

  refused(() => upgrade(entry({ sources: row(DEAD) })), pattern);
  refused(() => upgrade(entry({ sources: archivedRow(DEAD, SNAPSHOT) })), pattern);
  refused(() => upgrade(entry({ sources: searchedRow(OTHER) })), pattern);
  refused(() => upgrade(entry({ sources: searchedRow(DEAD) }), { positions: [] }), pattern);
  refused(
    () => upgrade(entry({ sources: [...searchedRow(DEAD), ...row(OTHER)] }), { positions: [2] }),
    /sources row 2 does not rest on a search link/
  );
});

test('upgrading twice is refused the second time, because the row no longer rests on a search link', () => {
  const once = upgrade(entry({ sources: searchedRow(DEAD) }));

  refused(() => upgrade(once), /no source row rests on a search link/);
});

test('an address YAML would spell differently inside different strings is refused', () => {
  const original = "https://example.org/it's";
  const text = entry({ sources: row(searchFor(), `    original: "${original}"`) });
  const archiveUrl = `https://web.archive.org/web/20251025031200/${original}`;

  refused(() => upgradedEntryText({ text, original, archiveUrl }), /quote|backslash|whitespace/);
});

test('a row the rewrite cannot edit in place is refused, naming the row', () => {
  const standIn = searchFor();
  const cases = [
    [[`  - {title: The report, url: "${standIn}", original: "${DEAD}"}`], /sources row 1 is not a block mapping/],
    [
      ['  - title: The report', '    url: >-', `      ${standIn}`, `    original: ${DEAD}`],
      /sources row 1 spells its url as/,
    ],
  ];

  for (const [sources, pattern] of cases) refused(() => upgrade(entry({ sources })), pattern);
});

test('an occurrence of the search in code is not rewritten and stops the rewrite, naming its line', () => {
  const text = entry({ sources: searchedRow(DEAD), body: ['', '```sh', `curl ${searchFor()}`, '```', ''] });
  const line = text.split('\n').findIndex((candidate) => candidate.startsWith('curl')) + 1;

  refused(() => upgrade(text), new RegExp(`line ${line}: `));
});

test('retrieved, updatedDate and every other field of the row stay exactly as they were', () => {
  const tail = [`    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'", '    note: kept as written'];
  const before = entry({ sources: row(searchFor('The report', PUBLISHER), `    original: ${DEAD}`, ...tail) });
  const { sources: now, ...sameFields } = frontmatterOf(upgrade(before));
  const { sources: was, ...otherFields } = frontmatterOf(before);

  assert.deepEqual(sameFields, otherFields);
  assert.deepEqual({ ...now[0], url: undefined }, { ...was[0], url: undefined });
});
