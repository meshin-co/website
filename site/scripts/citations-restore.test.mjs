import assert from 'node:assert/strict';
import { test } from 'node:test';

import { standInKind } from '../src/utils/archive-url.mjs';
import { archivedEntryText, restoredEntryText, searchedEntryText } from './citation-rewrites.mjs';
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

const restore = (text, changes) => restoredEntryText({ text, original: DEAD, ...changes });
const secondReading = (url, ...more) => ['  - title: A second reading', `    url: ${url}`, ...more];

function assertRestored({ body, extra = () => [], kept = [] }) {
  const standIn = searchFor();
  assert.equal(
    restore(entry({ extra: extra(standIn), sources: [...searchedRow(DEAD), ...kept], body: body?.(standIn) })),
    entry({ extra: extra(DEAD), sources: [...row(DEAD), ...kept], body: body?.(DEAD) })
  );
}

for (const [style, spell] of STYLES) {
  test(`a ${style} search row goes back to the address it cited, and the original line is gone`, () => {
    const tail = [`    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'"];
    const standIn = searchFor('The report', PUBLISHER);

    assert.equal(
      restore(entry({ sources: row(spell(standIn), `    original: ${spell(DEAD)}`, ...tail) })),
      entry({ sources: row(spell(DEAD), ...tail) })
    );
  });
}

test('the url takes the spelling the original line had, so the row reads as it did before the machine touched it', () => {
  const quotedOriginal = row(searchFor(), `    original: "${DEAD}"`);

  assert.equal(restore(entry({ sources: quotedOriginal })), entry({ sources: row(`"${DEAD}"`) }));
});

test('the restored row is an open row again: it has no original and is no stand-in', () => {
  const sources = row(searchFor('The report', PUBLISHER), `    original: ${DEAD}`, `    publisher: ${PUBLISHER}`);
  const [source] = frontmatterOf(restore(entry({ sources }))).sources;

  assert.equal(source.url, DEAD);
  assert.equal(Object.hasOwn(source, 'original'), false);
  assert.equal(standInKind(source), null);
});

test('the original line is removed and the url line is put back, whatever the key order or comment', () => {
  const layouts = [
    [
      [`  - url: ${DEAD}`, '    title: T'],
      [`  - url: ${searchFor('T')}`, `    original: ${DEAD}`, '    title: T'],
    ],
    [
      ['  - title: T', `    url: ${DEAD}`, '    publisher: P'],
      ['  - title: T', `    url: ${searchFor('T', 'P')}`, `    original: ${DEAD}`, '    publisher: P'],
    ],
    [
      ['  - publisher: P', `    url: ${DEAD}`, '    title: T'],
      ['  - publisher: P', `    url: ${searchFor('T', 'P')}`, `    original: ${DEAD}`, '    title: T'],
    ],
    [
      ['- title: T', `  url: ${DEAD}`],
      ['- title: T', `  url: ${searchFor('T')}`, `  original: ${DEAD}`],
    ],
    [
      ['    -   title: T', `        url: ${DEAD}`],
      ['    -   title: T', `        url: ${searchFor('T')}`, `        original: ${DEAD}`],
    ],
    [
      ['  - title: T', `    url: "${DEAD}"   # moved`, '    publisher: P'],
      ['  - title: T', `    url: "${searchFor('T', 'P')}"   # moved`, `    original: "${DEAD}"`, '    publisher: P'],
    ],
    [
      ['  - title: T', `    url: ${DEAD}`, '    note: after'],
      ['  - title: T', `    original: ${DEAD}`, `    url: ${searchFor('T')}`, '    note: after'],
    ],
  ];

  for (const [sources, searched] of layouts) assert.equal(restore(entry({ sources: searched })), entry({ sources }));
});

test('a CRLF entry stays CRLF, also when the original line is the last line of the front matter', () => {
  const body = (address) => ['', `See [the report](${address}).`, ''];
  const tail = "    retrieved: '2026-10-02'";

  assert.equal(
    restore(crlf(entry({ sources: searchedRow(DEAD, tail), body: body(searchFor()) }))),
    crlf(entry({ sources: row(DEAD, tail), body: body(DEAD) }))
  );
  assert.equal(restore(crlf(entry({ sources: searchedRow(DEAD) }))), crlf(entry({ sources: row(DEAD) })));
});

test('every form a body cites the search in is pointed back at the address: links, autolinks, definitions, cells, bare text', () => {
  assertRestored({ body: bodyForms });
});

test('links inside other front matter strings are pointed back at the address, and the front matter still reads as it should', () => {
  assertRestored({ extra: stringsCiting });
  const parsed = frontmatterOf(restore(entry({ extra: stringsCiting(searchFor()), sources: searchedRow(DEAD) })));

  assert.equal(parsed.answer, `See [the report](${DEAD}) for the detail.`);
  assert.equal(parsed.definition, `First paragraph cites [the report](${DEAD}).\n\nSecond paragraph.\n`);
});

test('a search for another title or publisher is another address, even when it starts with this one', () => {
  const longer = searchFor('The report', PUBLISHER);
  const kept = [...row(longer, `    original: ${OTHER}`, `    publisher: ${PUBLISHER}`)];

  assertRestored({
    kept,
    body: (address) => ['', `[the report](${address})`, '', `[the report, by the publisher](${longer})`, ''],
  });
});

test('every row that rests on a search link for the address goes back, each with the prose that linked to its own search', () => {
  const another = searchFor('Another');
  const kept = ['  - title: Another', `    url: ${another}`, `    original: ${OTHER}`];
  const sources = [
    ...searchedRow(DEAD),
    ...secondReading(searchFor('A second reading', PUBLISHER), `    original: ${DEAD}`, `    publisher: ${PUBLISHER}`),
    ...kept,
  ];
  const prose = (first, second) => ['', `[one](${first}) and [two](${second}) and [other](${another}).`, ''];

  assert.equal(
    restore(entry({ sources, body: prose(searchFor(), searchFor('A second reading', PUBLISHER)) })),
    entry({
      sources: [...row(DEAD), ...secondReading(DEAD, `    publisher: ${PUBLISHER}`), ...kept],
      body: prose(DEAD, DEAD),
    })
  );
});

test('naming the rows restores those rows only, and the prose that links to the search of another row stays', () => {
  const searched = secondReading(searchFor('A second reading'), `    original: ${DEAD}`);
  const body = (first, second) => ['', `[first](${first}) and [second](${second}).`, ''];
  const before = entry({
    sources: [...searchedRow(DEAD), ...searched],
    body: body(searchFor(), searchFor('A second reading')),
  });

  assert.equal(
    restore(before, { positions: [2] }),
    entry({
      sources: [...searchedRow(DEAD), ...secondReading(DEAD)],
      body: body(searchFor(), DEAD),
    })
  );
  assert.equal(
    restore(before, { positions: [1, 2] }),
    entry({ sources: [...row(DEAD), ...secondReading(DEAD)], body: body(DEAD, DEAD) })
  );
});

test('a row that stays on the very same search link keeps it, unless prose links to that search and could mean either address', () => {
  const twins = [...searchedRow(DEAD), ...searchedRow(OTHER)];

  assert.equal(restore(entry({ sources: twins })), entry({ sources: [...row(DEAD), ...searchedRow(OTHER)] }));
  refused(
    () => restore(entry({ sources: twins, body: ['', `See [the report](${searchFor()}).`, ''] })),
    /more than one row rests on/
  );
});

const unaddressed = (source) =>
  Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'url' && key !== 'original'));

test('retrieved, updatedDate and every other field of the row stay exactly as they were', () => {
  const tail = [`    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'", '    note: kept as written'];
  const before = entry({ sources: row(searchFor('The report', PUBLISHER), `    original: ${DEAD}`, ...tail) });
  const { sources: now, ...sameFields } = frontmatterOf(restore(before));
  const { sources: was, ...otherFields } = frontmatterOf(before);

  assert.deepEqual(sameFields, otherFields);
  assert.deepEqual(unaddressed(now[0]), unaddressed(was[0]));
});

test('restoring what the search rewrite made gives back the entry byte for byte', () => {
  const sources = [...row(DEAD, `    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'"), ...row(OTHER)];
  const before = entry({ extra: stringsCiting(DEAD), sources, body: bodyForms(DEAD) });

  assert.equal(restore(searchedEntryText({ text: before, url: DEAD })), before);
  assert.equal(restore(searchedEntryText({ text: crlf(before), url: DEAD })), crlf(before));
});

test('a row that does not rest on a search link for the address is refused, whatever it rests on instead', () => {
  const pattern = /no source row rests on a search link for https:\/\/example\.org\/report/;
  const archived = archivedRow(DEAD, SNAPSHOT);
  const handMade = row('https://www.google.com/search?q=something+else', `    original: ${DEAD}`);

  refused(() => restore(entry({ sources: row(DEAD) })), pattern);
  refused(() => restore(entry({ sources: archived })), pattern);
  refused(() => restore(entry({ sources: searchedRow(OTHER) })), pattern);
  refused(() => restore(entry({ sources: handMade })), pattern);
  refused(() => restore(entry({ sources: [] })), pattern);
  refused(() => restore(entry({ sources: searchedRow(DEAD) }), { positions: [] }), pattern);
});

test('naming a row that does not rest on a search link for the address is refused, naming the row', () => {
  const sources = [...searchedRow(DEAD), ...row(OTHER), ...searchedRow(OTHER)];

  refused(() => restore(entry({ sources }), { positions: [1, 2] }), /sources row 2 does not rest on a search link/);
  refused(() => restore(entry({ sources }), { positions: [3] }), /sources row 3 does not rest on a search link/);
  refused(() => restore(entry({ sources }), { positions: [9] }), /sources row 9 does not rest on a search link/);
});

test('restoring twice is refused the second time, because the row no longer rests on a search link', () => {
  const once = restore(entry({ sources: searchedRow(DEAD) }));

  refused(() => restore(once), /no source row rests on a search link/);
});

test('an address YAML would spell differently inside different strings is refused', () => {
  const original = "https://example.org/it's";
  const text = entry({ sources: row(searchFor(), `    original: "${original}"`) });

  refused(() => restoredEntryText({ text, original }), /quote|backslash|whitespace/);
});

test('an entry that cannot be read as a cited entry is refused, saying why', () => {
  const cases = [
    [`Just text citing ${DEAD}.\n`, /front matter/],
    [`---\ntitle: never closed\nsources:\n${searchedRow(DEAD).join('\n')}\n`, /front matter/],
    [['---', 'title: [broken', '---', ''].join('\n'), /does not parse/],
    [['---', 'title: no sources', '---', ''].join('\n'), /no source row rests/],
  ];

  for (const [text, pattern] of cases) refused(() => restore(text), pattern);
});

test('a row the rewrite cannot edit in place is refused, naming the row', () => {
  const standIn = searchFor();
  const cases = [
    [[`  - {title: The report, url: "${standIn}", original: "${DEAD}"}`], /sources row 1 is not a block mapping/],
    [
      ['  - title: The report', '    url: >-', `      ${standIn}`, `    original: ${DEAD}`],
      /sources row 1 spells its url as/,
    ],
    [
      ['  - title: The report', `    url: ${standIn}`, '    original: >-', `      ${DEAD}`],
      /sources row 1 spells its original as/,
    ],
    [
      ['  - title: The report', `    url: ${standIn}`, '    original: "https://example.org/rep\\u006frt"'],
      /sources row 1 spells its original as/,
    ],
  ];

  for (const [sources, pattern] of cases) refused(() => restore(entry({ sources })), pattern);
});

test('an original line that shares its line with the start of the row cannot be removed without taking the row along, so it is refused', () => {
  const sources = [`  - original: ${DEAD}`, '    title: The report', `    url: ${searchFor()}`];

  refused(
    () => restore(entry({ sources })),
    /sources row 1 keeps its original on a line that holds more than the original/
  );
});

test('a rewrite that would change another row through a shared anchor is refused, naming that row', () => {
  const sources = [
    '  - title: The report',
    `    url: ${searchFor()}`,
    `    original: &gone ${DEAD}`,
    '  - title: Another',
    `    url: ${OTHER}`,
    '    note: *gone',
  ];

  refused(() => restore(entry({ sources })), /front matter does not parse|sources row 2 reads/);
});

test('an occurrence of the search in code is not rewritten and stops the rewrite, naming its line', () => {
  const cases = [
    { body: ['', '```sh', `curl ${searchFor()}`, '```', ''] },
    { body: ['', '~~~', `curl ${searchFor()}`, '~~~', ''] },
    { body: ['', `Fetch \`${searchFor()}\` by hand.`, ''] },
    { extra: [`note: Fetch \`${searchFor()}\` by hand.`] },
  ];

  for (const shape of cases) {
    const text = entry({ sources: searchedRow(DEAD), ...shape });
    const line =
      text.split('\n').findIndex((candidate) => candidate.includes('/search?') && !candidate.includes('url:')) + 1;
    refused(() => restore(text), new RegExp(`line ${line}: `));
  }
});

test('an entry the archive rewrite produced is not a search row, so restoring it is refused', () => {
  const archived = archivedEntryText({ text: entry({ sources: row(DEAD) }), url: DEAD, archiveUrl: SNAPSHOT });

  refused(() => restore(archived), /no source row rests on a search link/);
});
