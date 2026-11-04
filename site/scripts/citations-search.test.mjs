import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parse } from 'yaml';

import { searchFallbackUrl, standInKind } from '../src/utils/archive-url.mjs';
import { archivedEntryText, searchedEntryText } from './citation-rewrites.mjs';
import { RewriteError } from './entry-surgery.mjs';

const DEAD = 'https://example.org/report';
const OTHER = 'https://example.org/elsewhere';
const PUBLISHER = 'Example Org';
const SNAPSHOT = `https://web.archive.org/web/20251025031200/${DEAD}`;
const STYLES = [
  ['plain', (address) => address],
  ['single-quoted', (address) => `'${address}'`],
  ['double-quoted', (address) => `"${address}"`],
];
const DATES = ['publishDate: 2026-09-08', 'updatedDate: 2026-10-25'];
const entry = ({ dates = DATES, extra = [], sources, body = ['', 'Body.', ''] }) =>
  ['---', 'title: A test entry', ...dates, ...extra, 'sources:', ...sources, '---', ...body].join('\n');
const row = (address, ...more) => ['  - title: The report', `    url: ${address}`, ...more];
const searchFor = (title = 'The report', publisher = undefined) => searchFallbackUrl({ title, publisher });
const searchedRow = (address, ...more) => row(searchFor(), `    original: ${address}`, ...more);
const rewrite = (text, url = DEAD) => searchedEntryText({ text, url });
const crlf = (text) => text.replaceAll('\n', '\r\n');
const frontmatterOf = (text) => parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1]);
const refused = (run, pattern) =>
  assert.throws(run, (error) => {
    assert.ok(error instanceof RewriteError, `not a RewriteError: ${error}`);
    assert.match(error.message, pattern);
    return true;
  });
function assertSearched({ url = DEAD, body, extra = () => [], kept = [] }) {
  const standIn = searchFor();
  assert.equal(
    rewrite(entry({ extra: extra(url), sources: [...row(url), ...kept], body: body?.(url) }), url),
    entry({ extra: extra(standIn), sources: [...searchedRow(url), ...kept], body: body?.(standIn) })
  );
}
function lineDiff(before, afterText) {
  const was = before.split('\n');
  const changed = [];
  const added = [];
  let next = 0;
  for (const line of afterText.split('\n')) {
    if (line === was[next]) next += 1;
    else if (/^\s*original: /.test(line)) added.push(line);
    else changed.push([was[next++], line]);
  }
  assert.equal(next, was.length, 'every line of the original is still there');
  return { changed, added };
}

for (const [style, spell] of STYLES) {
  test(`a ${style} url row reads as the search for its title and publisher and keeps the cited address as original`, () => {
    const tail = [`    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'"];
    const standIn = searchFor('The report', PUBLISHER);

    assert.equal(
      rewrite(entry({ sources: row(spell(DEAD), ...tail) })),
      entry({ sources: row(spell(standIn), `    original: ${spell(DEAD)}`, ...tail) })
    );
  });
}

test('the stand-in asks for the title and publisher of the row, never for the dead address', () => {
  const result = rewrite(entry({ sources: row(DEAD, `    publisher: ${PUBLISHER}`) }));
  const [source] = frontmatterOf(result).sources;

  assert.equal(source.url, 'https://www.google.com/search?q=%22The+report%22+Example+Org');
  assert.equal(source.original, DEAD);
  assert.equal(standInKind(source), 'search');
  assert.equal(source.url.includes(encodeURIComponent(DEAD)), false);
  assert.equal(source.url.includes('example.org'), false);
});

test('a title YAML spells in quotes is searched for as the text it parses to', () => {
  const sources = ["  - title: 'It''s \"quoted\": A & B # C'", `    url: ${DEAD}`];
  const [source] = frontmatterOf(rewrite(entry({ sources }))).sources;

  assert.equal(source.title, 'It\'s "quoted": A & B # C');
  assert.equal(source.url, searchFallbackUrl({ title: source.title }));
  assert.equal(standInKind(source), 'search');
});

test('the original line follows the url line at the indentation of its row, whatever the key order or comment', () => {
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
  ];

  for (const [sources, expected] of layouts) assert.equal(rewrite(entry({ sources })), entry({ sources: expected }));
});

test('a CRLF entry stays CRLF, including the added line, also when the url row closes the front matter', () => {
  const body = (address) => ['', `See [the report](${address}).`, ''];
  const tail = "    retrieved: '2026-10-02'";

  assert.equal(
    rewrite(crlf(entry({ sources: row(DEAD, tail), body: body(DEAD) }))),
    crlf(entry({ sources: searchedRow(DEAD, tail), body: body(searchFor()) }))
  );
  assert.equal(rewrite(crlf(entry({ sources: row(DEAD) }))), crlf(entry({ sources: searchedRow(DEAD) })));
});

test('every open row that cites the address gets the search for its own title and publisher, and no other row changes', () => {
  const second = ['  - title: A second reading', `    url: ${DEAD}`, `    publisher: ${PUBLISHER}`];
  const expectedSecond = [
    '  - title: A second reading',
    `    url: ${searchFor('A second reading', PUBLISHER)}`,
    `    original: ${DEAD}`,
    `    publisher: ${PUBLISHER}`,
  ];

  assert.equal(
    rewrite(entry({ sources: [...row(DEAD), ...second, ...row(OTHER)] })),
    entry({ sources: [...searchedRow(DEAD), ...expectedSecond, ...row(OTHER)] })
  );
});

test('every row that cites the address is rewritten, in whatever style, and no other row is', () => {
  const searched = (spell) => row(spell(searchFor()), `    original: ${spell(DEAD)}`);

  assert.equal(
    rewrite(entry({ sources: [...STYLES.flatMap(([, spell]) => row(spell(DEAD))), ...row(OTHER)] })),
    entry({ sources: [...STYLES.flatMap(([, spell]) => searched(spell)), ...row(OTHER)] })
  );
});

const bodyForms = (address) => [
  '',
  `An inline [report](${address}) link, a titled [report](${address} "The Report") one and an autolink <${address}>.`,
  `A link whose text is the address: [${address}](${address}). Between \`a\` code and [it](${address}) and \`b\` code.`,
  `A bare ${address}. Another ${address}, then ${address}; then ${address}: yes ${address}? ${address}!`,
  `In quotes "${address}." or brackets (${address}.) or [${address}] or after a link (${address}).`,
  '',
  `[ref]: ${address} "Reference title"`,
  `[angle]: <${address}>`,
  '',
  `| [report](${address}) | cited in a table |`,
  '',
  `Finally ${address}.`,
];

const stringsCiting = (address) => [
  `shortDefinition: A claim with [a source](${address}) in it.`,
  'definition: |',
  `  First paragraph cites [the report](${address}).`,
  '',
  '  Second paragraph.',
  `answer: 'See [the report](${address}) for the detail.'`,
  `note: "Also <${address}> here."`,
];

test('every form a body cites the address in is pointed at the search: links, autolinks, definitions, cells, bare text', () => {
  assertSearched({ body: bodyForms });
});

test('links inside other front matter strings are pointed at the search, and the front matter still reads as it should', () => {
  assertSearched({ extra: stringsCiting });
  const standIn = searchFor();
  const parsed = frontmatterOf(rewrite(entry({ extra: stringsCiting(DEAD), sources: row(DEAD) })));

  assert.equal(parsed.answer, `See [the report](${standIn}) for the detail.`);
  assert.equal(parsed.definition, `First paragraph cites [the report](${standIn}).\n\nSecond paragraph.\n`);
  assert.equal(parsed.sources[0].original, DEAD);
});

test('prose that links to the address is refused when the rows citing it would each search for something different', () => {
  const sources = [...row(DEAD), '  - title: A second reading', `    url: ${DEAD}`];

  refused(
    () => rewrite(entry({ sources, body: ['', `See [the report](${DEAD}).`, ''] })),
    /search for something different/
  );
  refused(() => rewrite(entry({ sources, extra: [`note: See [it](${DEAD}).`] })), /search for something different/);
});

test('an address that merely starts with the cited address is another address and stays as it is', () => {
  const suffixes = ['/', 'b', '/b', '?x=1', '#frag', '.html', ',b', '-2', ':8080/', '.evil.test/x'];

  for (const base of [DEAD, 'https://example.org']) {
    const variants = suffixes.map((suffix) => `${base}${suffix}`);
    const links = variants.map((variant) => `[variant](${variant})`);

    assertSearched({
      url: base,
      kept: variants.flatMap((variant) => row(variant)),
      body: (address) => ['', `[the report](${address})`, '', ...links, `Not ${base}..x either.`, ''],
    });
  }
});

test('an address inside a longer address, such as a snapshot or a proxy, is not an occurrence', () => {
  const embedded = [
    `[older copy](https://web.archive.org/web/20200101000000/${DEAD})`,
    `[raw copy](https://web.archive.org/web/20200101000000id_/${DEAD})`,
    `[via proxy](https://proxy.example.net/?u=${DEAD})`,
  ];

  assertSearched({ body: (address) => ['', `[the report](${address})`, '', ...embedded, ''] });
});

test('addresses with parentheses, a query string or percent escapes are replaced whole, never by prefix', () => {
  const wiki = 'https://en.wikipedia.org/wiki/Foo_(bar)';
  const short = 'https://en.wikipedia.org/wiki/Foo';
  const lex = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689';

  for (const url of [wiki, lex]) {
    assertSearched({ url, body: (address) => ['', `The [page](${address}) says so.`, ''] });
  }
  assertSearched({ url: short, body: (address) => ['', `[short](${address})`, `[long](${wiki})`, ''] });
});

test('the rewrite changes the url line, adds one line, and touches only the lines that hold the address', () => {
  const before = entry({ extra: stringsCiting(DEAD), sources: [...row(DEAD), ...row(OTHER)], body: bodyForms(DEAD) });
  const { changed, added } = lineDiff(before, rewrite(before));

  assert.deepEqual(added, [`    original: ${DEAD}`]);
  assert.deepEqual(
    changed.map(([was]) => was),
    before.split('\n').filter((line) => line.includes(DEAD))
  );
  assert.ok(changed.every(([was, now]) => now === was.replaceAll(DEAD, searchFor())));
});

test('retrieved, updatedDate and every other field of the row stay exactly as they were', () => {
  const tail = [`    publisher: ${PUBLISHER}`, "    retrieved: '2026-10-02'", '    note: kept as written'];
  const before = entry({ sources: row(DEAD, ...tail) });
  const after = frontmatterOf(rewrite(before));
  const { sources: was, ...otherFields } = frontmatterOf(before);
  const { sources: now, ...sameFields } = after;

  assert.deepEqual(sameFields, otherFields);
  assert.deepEqual(
    { ...now[0], url: undefined, original: undefined },
    { ...was[0], url: undefined, original: undefined }
  );
});

test('an entry that already carries the cited address as original is refused, whichever stand-in carries it', () => {
  const searched = rewrite(entry({ sources: row(DEAD), body: bodyForms(DEAD) }));
  const archived = archivedEntryText({ text: entry({ sources: row(DEAD) }), url: DEAD, archiveUrl: SNAPSHOT });

  refused(() => rewrite(searched), /already has a stand-in/);
  refused(() => rewrite(archived), /already has a stand-in/);
  refused(() => rewrite(entry({ sources: [...searchedRow(DEAD), ...row(DEAD)] })), /already has a stand-in/);
  refused(() => rewrite(entry({ sources: row(DEAD, `    original: ${DEAD}`) })), /already has a stand-in/);
});

test('a row with no title to search for is refused, naming the row', () => {
  const cases = [
    [[`  - url: ${DEAD}`], /sources row 1 has no title/],
    [[`  - url: ${DEAD}`, '    title: ""'], /sources row 1 has no title/],
    [['  - title: \'""\'', `    url: ${DEAD}`], /sources row 1 has no title/],
    [[...row(OTHER), `  - url: ${DEAD}`, `    publisher: ${PUBLISHER}`], /sources row 2 has no title/],
  ];

  for (const [sources, pattern] of cases) refused(() => rewrite(entry({ sources })), pattern);
});

test('an address YAML would spell differently inside different strings is refused', () => {
  const text = entry({ sources: row("'https://example.org/it''s'") });

  refused(() => rewrite(text, "https://example.org/it's"), /quote|backslash|whitespace/);
});

test('an entry that cannot be read as a cited entry is refused, saying why', () => {
  const cases = [
    [`Just text citing ${DEAD}.\n`, /front matter/],
    [`---\ntitle: never closed\nsources:\n${row(DEAD).join('\n')}\n`, /front matter/],
    [['---', 'title: [broken', '---', ''].join('\n'), /does not parse/],
    [entry({ sources: row(OTHER), body: ['', `[the report](${DEAD})`, ''] }), /no source row cites/],
    [['---', 'title: no sources', '---', ''].join('\n'), /no source row cites/],
  ];

  for (const [text, pattern] of cases) refused(() => rewrite(text), pattern);
});

test('a row the rewrite cannot edit in place is refused, naming the row', () => {
  const cases = [
    [[`  - {title: The report, url: ${DEAD}}`], /sources row 1 is not a block mapping/],
    [['  - title: The report', '    url: >-', `      ${DEAD}`], /sources row 1 spells its url as/],
    [['  - title: The report', '    url: "https://example.org/rep\\u006frt"'], /sources row 1 spells its url as/],
    [
      ['  - title: The report', `    url: &dead ${DEAD}`, '  - title: Again', '    url: *dead'],
      /sources row 2 spells its url as "\*dead"/,
    ],
  ];

  for (const [sources, pattern] of cases) refused(() => rewrite(entry({ sources })), pattern);
});

test('a rewrite that would change another row through a shared anchor is refused, naming that row', () => {
  const sources = [
    '  - title: The report',
    `    url: &dead ${DEAD}`,
    '  - title: Another',
    `    url: ${OTHER}`,
    '    note: *dead',
  ];

  refused(() => rewrite(entry({ sources })), /sources row 2 reads/);
});

test('an occurrence in code is not rewritten and stops the rewrite, naming its line', () => {
  const cases = [
    { body: ['', '```sh', `curl ${DEAD}`, '```', ''] },
    { body: ['', '~~~', `curl ${DEAD}`, '~~~', ''] },
    { body: ['', '```', `curl ${DEAD}`] },
    { body: ['', `Fetch \`${DEAD}\` by hand.`, ''] },
    { extra: [`note: Fetch \`${DEAD}\` by hand.`] },
  ];

  for (const shape of cases) {
    const text = entry({ sources: row(DEAD), ...shape });
    const line = text.split('\n').findIndex((candidate) => candidate.includes(DEAD) && !candidate.includes('url:')) + 1;
    refused(() => rewrite(text), new RegExp(`line ${line}: `));
  }
});
