import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parse } from 'yaml';

import { archivedEntryText } from './citation-rewrites.mjs';
import { RewriteError } from './entry-surgery.mjs';

const DEAD = 'https://example.org/report';
const OTHER = 'https://example.org/elsewhere';
const snapshotOf = (address) => `https://web.archive.org/web/20251025031200/${address}`;
const SNAPSHOT = snapshotOf(DEAD);
const STYLES = [
  ['plain', (address) => address],
  ['single-quoted', (address) => `'${address}'`],
  ['double-quoted', (address) => `"${address}"`],
];
const DATES = ['publishDate: 2026-09-08', 'updatedDate: 2026-10-25'];
const entry = ({ dates = DATES, extra = [], sources, body = ['', 'Body.', ''] }) =>
  ['---', 'title: A test entry', ...dates, ...extra, 'sources:', ...sources, '---', ...body].join('\n');
const row = (address, ...more) => ['  - title: The report', `    url: ${address}`, ...more];
const archivedRow = (address, ...more) => row(snapshotOf(address), `    original: ${address}`, ...more);
const rewrite = (text, { url = DEAD, archiveUrl = snapshotOf(url) } = {}) =>
  archivedEntryText({ text, url, archiveUrl });
const crlf = (text) => text.replaceAll('\n', '\r\n');
const frontmatterOf = (text) => parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1]);
const refused = (run, pattern) =>
  assert.throws(run, (error) => {
    assert.ok(error instanceof RewriteError, `not a RewriteError: ${error}`);
    assert.match(error.message, pattern);
    return true;
  });
function assertRewritten({ url = DEAD, body, extra = () => [], kept = [] }) {
  const archiveUrl = snapshotOf(url);
  assert.equal(
    rewrite(entry({ extra: extra(url), sources: [...row(url), ...kept], body: body?.(url) }), { url }),
    entry({ extra: extra(archiveUrl), sources: [...archivedRow(url), ...kept], body: body?.(archiveUrl) })
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

test('a RewriteError is an Error that names itself', () => {
  assert.ok(new RewriteError('no') instanceof Error);
  assert.equal(new RewriteError('no').name, 'RewriteError');
});

for (const [style, spell] of STYLES) {
  test(`a ${style} url row reads as the snapshot and keeps the cited address as original, in the same style`, () => {
    const tail = ['    publisher: Example Org', "    retrieved: '2026-10-02'"];
    assert.equal(
      rewrite(entry({ sources: row(spell(DEAD), ...tail) })),
      entry({ sources: row(spell(SNAPSHOT), `    original: ${spell(DEAD)}`, ...tail) })
    );
  });
}

test('the original line follows the url line at the indentation of its row, whatever the key order or comment', () => {
  const layouts = [
    [
      [`  - url: ${DEAD}`, '    title: T'],
      [`  - url: ${SNAPSHOT}`, `    original: ${DEAD}`, '    title: T'],
    ],
    [
      ['  - title: T', `    url: ${DEAD}`, '    publisher: P'],
      ['  - title: T', `    url: ${SNAPSHOT}`, `    original: ${DEAD}`, '    publisher: P'],
    ],
    [
      ['  - publisher: P', `    url: ${DEAD}`],
      ['  - publisher: P', `    url: ${SNAPSHOT}`, `    original: ${DEAD}`],
    ],
    [
      ['- title: T', `  url: ${DEAD}`],
      ['- title: T', `  url: ${SNAPSHOT}`, `  original: ${DEAD}`],
    ],
    [
      ['    -   title: T', `        url: ${DEAD}`],
      ['    -   title: T', `        url: ${SNAPSHOT}`, `        original: ${DEAD}`],
    ],
    [
      ['  - title: T', `    url: "${DEAD}"   # moved`, '    publisher: P'],
      ['  - title: T', `    url: "${SNAPSHOT}"   # moved`, `    original: "${DEAD}"`, '    publisher: P'],
    ],
  ];

  for (const [sources, expected] of layouts) assert.equal(rewrite(entry({ sources })), entry({ sources: expected }));
});

test('a CRLF entry stays CRLF, including the added line, also when the url row closes the front matter', () => {
  const body = (address) => ['', `See [the report](${address}).`, ''];
  const tail = "    retrieved: '2026-10-02'";

  assert.equal(
    rewrite(crlf(entry({ sources: row(DEAD, tail), body: body(DEAD) }))),
    crlf(entry({ sources: archivedRow(DEAD, tail), body: body(SNAPSHOT) }))
  );
  assert.equal(rewrite(crlf(entry({ sources: row(DEAD) }))), crlf(entry({ sources: archivedRow(DEAD) })));
});

test('every row that cites the address is rewritten, in whatever style, and no other row is', () => {
  const archived = (spell) => row(spell(SNAPSHOT), `    original: ${spell(DEAD)}`);

  assert.equal(
    rewrite(entry({ sources: [...STYLES.flatMap(([, spell]) => row(spell(DEAD))), ...row(OTHER)] })),
    entry({ sources: [...STYLES.flatMap(([, spell]) => archived(spell)), ...row(OTHER)] })
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

test('every form a body cites the address in is rewritten: links, autolinks, definitions, cells, bare text', () => {
  assertRewritten({ body: bodyForms });
});

test('links inside other front matter strings are rewritten, and the front matter still reads as it should', () => {
  assertRewritten({ extra: stringsCiting });
  const parsed = frontmatterOf(rewrite(entry({ extra: stringsCiting(DEAD), sources: row(DEAD) })));

  assert.equal(parsed.answer, `See [the report](${SNAPSHOT}) for the detail.`);
  assert.equal(parsed.definition, `First paragraph cites [the report](${SNAPSHOT}).\n\nSecond paragraph.\n`);
  assert.equal(parsed.sources[0].original, DEAD);
});

test('an address that merely starts with the cited address is another address and stays as it is', () => {
  const suffixes = ['/', 'b', '/b', '?x=1', '#frag', '.html', ',b', '-2', ':8080/', '.evil.test/x'];

  for (const base of [DEAD, 'https://example.org']) {
    const variants = suffixes.map((suffix) => `${base}${suffix}`);
    const links = variants.map((variant) => `[variant](${variant})`);

    assertRewritten({
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

  assertRewritten({ body: (address) => ['', `[the report](${address})`, '', ...embedded, ''] });
});

test('addresses with parentheses, a query string or percent escapes are replaced whole, never by prefix', () => {
  const wiki = 'https://en.wikipedia.org/wiki/Foo_(bar)';
  const short = 'https://en.wikipedia.org/wiki/Foo';
  const lex = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202401689';

  for (const url of [wiki, lex]) {
    assertRewritten({ url, body: (address) => ['', `The [page](${address}) says so.`, ''] });
  }
  assertRewritten({ url: short, body: (address) => ['', `[short](${address})`, `[long](${wiki})`, ''] });
});

test('the rewrite changes the url line, adds one line, and touches only the lines that hold the address', () => {
  const before = entry({ extra: stringsCiting(DEAD), sources: [...row(DEAD), ...row(OTHER)], body: bodyForms(DEAD) });
  const { changed, added } = lineDiff(before, rewrite(before));

  assert.deepEqual(added, [`    original: ${DEAD}`]);
  assert.deepEqual(
    changed.map(([was]) => was),
    before.split('\n').filter((line) => line.includes(DEAD))
  );
  assert.ok(changed.every(([was, now]) => now === was.replaceAll(DEAD, SNAPSHOT)));
});

test('an entry that already carries the cited address as original is refused as already holding a stand-in', () => {
  const result = rewrite(entry({ sources: row(DEAD), body: bodyForms(DEAD) }));

  refused(() => rewrite(result), /already has a stand-in/);
  refused(() => rewrite(entry({ sources: [...archivedRow(DEAD), ...row(DEAD)] })), /already has a stand-in/);
  refused(() => rewrite(entry({ sources: row(DEAD, `    original: ${DEAD}`) })), /already has a stand-in/);
});

test('an address that is not a snapshot of the cited address is refused before any edit', () => {
  const text = entry({ sources: row(DEAD) });

  refused(() => rewrite(text, { archiveUrl: snapshotOf(OTHER) }), /not a Wayback snapshot of/);
  refused(() => rewrite(text, { archiveUrl: DEAD }), /not a Wayback snapshot of/);
  refused(() => archivedEntryText({ text, url: DEAD, archiveUrl: undefined }), /not a Wayback snapshot of/);
});

test('an address YAML would spell differently inside different strings is refused', () => {
  const text = entry({ sources: row("'https://example.org/it''s'") });

  refused(() => rewrite(text, { url: "https://example.org/it's" }), /quote|backslash|whitespace/);
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
