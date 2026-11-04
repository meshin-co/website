import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyEdits,
  assertNoLeftover,
  assertRowsAfter,
  assertSpellable,
  citesUrl,
  codeRanges,
  covered,
  isOpen,
  isSearchStandIn,
  occurrences,
  openRowsFor,
  pairOf,
  parseEntry,
  RewriteError,
  spelledValue,
} from './entry-surgery.mjs';
import {
  DEAD,
  OTHER,
  SNAPSHOT,
  STYLES,
  archivedRow,
  crlf,
  entry,
  refused,
  row,
  searchFor,
  searchedRow,
} from './fixtures/citation-text.mjs';

const span = (start) => ({ start, end: start + DEAD.length });
const verdicts = (text) => {
  const code = codeRanges(text);
  return occurrences(text, DEAD).map((found) => covered(code, found));
};
const readRow = (...sources) => {
  const text = entry({ sources });
  return { text, source: parseEntry(text).rows[0] };
};

test('a RewriteError is an Error that carries its own name and the message it was given', () => {
  const error = new RewriteError('the entry has no front matter');

  assert.ok(error instanceof Error);
  assert.equal(error.name, 'RewriteError');
  assert.equal(error.message, 'the entry has no front matter');
  assert.equal(String(error), 'RewriteError: the entry has no front matter');
});

test('the module exports what the read side and the rewrites import, and keeps its other helpers to itself', async () => {
  const surface = Object.keys(await import('./entry-surgery.mjs')).sort();

  assert.deepEqual(surface, [
    'RewriteError',
    'applyEdits',
    'assertNoLeftover',
    'assertRowsAfter',
    'assertSpellable',
    'citesUrl',
    'codeRanges',
    'covered',
    'isOpen',
    'isSearchStandIn',
    'occurrences',
    'openRowsFor',
    'pairOf',
    'parseEntry',
    'spelledValue',
  ]);
});

test('an address ends where prose takes over: a space, a closing bracket or quote, or sentence punctuation', () => {
  const spaced = ['', ' next', '\n'];
  const closers = [')', ']', '>', '"', '`'];
  const punctuation = ['.', ',', ';', ':', '!', '?', "'", '*', '_', '~', '.)', '?!', '...'];

  for (const after of [...spaced, ...closers, ...punctuation]) {
    assert.deepEqual(occurrences(`See ${DEAD}${after}`, DEAD), [span(4)], `after ${JSON.stringify(after)}`);
  }
});

test('an address that goes on is another address: more path, a query, a fragment, a port or a bracket', () => {
  const moreWord = ['s', '/', '/2', '.html', ',b', '-draft', '_v2'];
  const otherPart = ['?page=2', '#top', ':8080/', '(draft)', '[1]', '%20', '=1', '&x=1', '+1', '@x', '$x'];

  for (const after of [...moreWord, ...otherPart]) {
    assert.deepEqual(occurrences(`See ${DEAD}${after}`, DEAD), [], `after ${JSON.stringify(after)}`);
  }
});

test('an address that ends a longer one is another address: a proxy, a snapshot, a letter or a mark before it', () => {
  const wordy = ['x', '9', 'é', '\u0301'];
  const pathy = ['/', ':', '=', '.', '-', '?', '#', '@', '&', '+', '%', ',', ';', '!', '$'];

  for (const before of [...wordy, ...pathy]) {
    assert.deepEqual(occurrences(`See ${before}${DEAD}`, DEAD), [], `before ${JSON.stringify(before)}`);
  }
});

test('an address starts after a space, an opening bracket or quote, or emphasis', () => {
  for (const before of ['', ' ', '\n', '(', '[', '<', '"', "'", '*', '_', '|', '>', '`']) {
    const found = occurrences(`See ${before}${DEAD}`, DEAD);

    assert.deepEqual(found, [span(4 + before.length)], `before ${JSON.stringify(before)}`);
  }
});

test('every occurrence is reported with its own span, in order, and a refused candidate hides no later one', () => {
  const text = `${DEAD}s ${DEAD}, (${DEAD}) x${DEAD}`;

  assert.deepEqual(occurrences(text, DEAD), [span(DEAD.length + 2), span(2 * DEAD.length + 5)]);
  assert.deepEqual(occurrences(DEAD, DEAD), [span(0)]);
  assert.deepEqual(occurrences('no address in this text', DEAD), []);
});

test('an address in a fenced block or an inline code span is covered by code, one in prose is not', () => {
  const text = [
    `Before ${DEAD}`,
    '',
    '```text',
    `inside ${DEAD}`,
    '```',
    '',
    `Inline \`${DEAD}\` and ${DEAD} after.`,
  ].join('\n');

  assert.deepEqual(verdicts(text), [false, true, true, false]);
});

test('a fence closes on a line of its own character, as long as the opener, and nothing else', () => {
  const cases = [
    ['a tilde fence', ['~~~', DEAD, '~~~', DEAD], [true, false]],
    ['indentation', ['  ```', DEAD, '  ```', DEAD], [true, false]],
    ['a longer opener needs a closer as long', ['````', '```', DEAD, '````', DEAD], [true, false]],
    ['another character does not close', ['```', '~~~', DEAD, '```', DEAD], [true, false]],
    ['text after the closer keeps it open', ['```', '``` text', DEAD, '```', DEAD], [true, false]],
    ['an opener holding more backticks is no fence', [`\`\`\` ${DEAD} \`\`\``, DEAD], [true, false]],
    ['a fence never closed runs to the end', [`Before ${DEAD}`, '```', DEAD, `After ${DEAD}`], [false, true, true]],
  ];

  for (const [name, lines, expected] of cases) assert.deepEqual(verdicts(lines.join('\n')), expected, name);
});

test('an inline code span ends at the same run of backticks, and never reaches across a blank line', () => {
  const cases = [
    ['one backtick', `\`${DEAD}\` and ${DEAD}`, [true, false]],
    ['a double run holding a single backtick', `\`\`a \` ${DEAD}\`\` and ${DEAD}`, [true, false]],
    ['a backtick that never closes', `a \` ${DEAD} and ${DEAD}`, [false, false]],
    ['a blank line between the backticks', `\`a ${DEAD}\n\nb\` ${DEAD}`, [false, false]],
  ];

  for (const [name, text, expected] of cases) assert.deepEqual(verdicts(text), expected, name);
});

test('a span is covered only when one range holds all of it', () => {
  const ranges = [
    { start: 0, end: 5 },
    { start: 5, end: 10 },
  ];

  assert.equal(covered(ranges, { start: 1, end: 4 }), true);
  assert.equal(covered(ranges, { start: 0, end: 5 }), true);
  assert.equal(covered(ranges, { start: 3, end: 8 }), false);
  assert.equal(covered(ranges, { start: 9, end: 11 }), false);
  assert.equal(covered([], { start: 0, end: 1 }), false);
});

test('edits are positions in the text as it was, so a longer or shorter edit never shifts a later one', () => {
  const text = 'aaa bbb ccc';
  const [first, second, third] = [
    { start: 0, end: 3, text: 'AAAAAAAA' },
    { start: 4, end: 7, text: '' },
    { start: 8, end: 11, text: 'C' },
  ];

  assert.equal(applyEdits(text, [first, second, third]), 'AAAAAAAA  C');
  assert.equal(applyEdits(text, [third, second, first]), 'AAAAAAAA  C');
  assert.equal(applyEdits(text, [second, third, first]), 'AAAAAAAA  C');
});

test('an insertion lands beside a replacement that ends there, and the list of edits is left as given', () => {
  const edits = [
    { start: 5, end: 6, text: 'NEW' },
    { start: 6, end: 6, text: '+' },
  ];
  const given = structuredClone(edits);

  assert.equal(applyEdits('url: x\n', edits), 'url: NEW+\n');
  assert.equal(applyEdits('url: x\n', [...edits].reverse()), 'url: NEW+\n');
  assert.deepEqual(edits, given);
});

test('a rewrite that changed a row it was not asked to change is refused, naming the row', () => {
  const before = entry({ sources: [...row(DEAD), ...row(OTHER)] });
  const { rows } = parseEntry(before);
  const result = before.replace(`url: ${OTHER}`, 'url: https://example.org/changed');

  refused(
    () => assertRowsAfter({ result, rows, changed: [rows[0]], isSound: () => true }),
    /^sources row 2 reads \{"title":"The report","url":"https:\/\/example\.org\/changed"\} after the rewrite$/
  );
});

test('a row the rewrite did change must read the way the rewrite meant, and rows it left alone are not asked', () => {
  const before = entry({ sources: row(DEAD) });
  const { rows } = parseEntry(before);
  const result = before.replace(DEAD, OTHER);
  const asked = [];
  const isSound = (now, source) => {
    asked.push([now, source]);
    return now.url === OTHER;
  };

  assert.doesNotThrow(() => assertRowsAfter({ result, rows, changed: rows, isSound }));
  assert.deepEqual(asked, [[{ title: 'The report', url: OTHER }, rows[0]]]);
  refused(() => assertRowsAfter({ result, rows, changed: rows, isSound: () => false }), /^sources row 1 reads /);
  assert.doesNotThrow(() =>
    assertRowsAfter({
      result: before,
      rows,
      changed: [],
      isSound: () => assert.fail('a row left alone is compared, never judged'),
    })
  );
});

test('a rewrite that adds or loses a sources row is refused', () => {
  const { rows } = parseEntry(entry({ sources: row(DEAD) }));
  const result = entry({ sources: [...row(DEAD), ...row(OTHER)] });

  refused(() => assertRowsAfter({ result, rows, changed: rows, isSound: () => true }), /how many sources rows/);
});

test('an entry reads as its front matter and its sources rows, each row knowing where it sits in the text', () => {
  const text = entry({ sources: [...row(DEAD), ...row(OTHER)] });

  for (const written of [text, crlf(text)]) {
    const { frontmatter, rows } = parseEntry(written);

    assert.equal(frontmatter.title, 'A test entry');
    assert.deepEqual(
      rows.map(({ index, value }) => [index, value.url]),
      [
        [0, DEAD],
        [1, OTHER],
      ]
    );
    for (const { node, offset } of rows) {
      assert.ok(written.slice(offset + node.range[0]).startsWith('title: The report'));
    }
  }
});

test('an entry whose sources are missing or are no list has no rows', () => {
  assert.deepEqual(parseEntry('---\ntitle: T\n---\nBody\n').rows, []);
  assert.deepEqual(parseEntry('---\ntitle: T\nsources: none\n---\n').rows, []);
  assert.deepEqual(parseEntry('---\nsources: []\n---\n').rows, []);
});

test('a text that is no entry is refused, saying why', () => {
  refused(() => parseEntry(`Just text citing ${DEAD}.\n`), /no front matter block between --- lines/);
  refused(() => parseEntry('---\ntitle: [broken\n---\n'), /^the front matter does not parse: /);
});

test('a row is open when it cites an address of its own, and a search stand-in when its url searches for its title', () => {
  const { rows } = parseEntry(
    entry({
      sources: [
        ...row(DEAD),
        ...row(OTHER),
        ...archivedRow(DEAD, SNAPSHOT),
        ...searchedRow(DEAD),
        ...row(searchFor('Another title'), `    original: ${DEAD}`),
      ],
    })
  );

  assert.deepEqual(rows.map(isOpen), [true, true, false, false, false]);
  assert.deepEqual(rows.map(citesUrl(DEAD)), [true, false, false, false, false]);
  assert.deepEqual(rows.map(isSearchStandIn), [false, false, false, true, false]);
});

test('the rows to rewrite are the open rows that cite the address, in order', () => {
  const { rows } = parseEntry(entry({ sources: [...row(DEAD), ...row(OTHER), ...row(DEAD)] }));

  assert.deepEqual(
    openRowsFor(rows, DEAD).map(({ index }) => index),
    [0, 2]
  );
});

test('an entry that already stands in for the address, or never cites it, is refused', () => {
  const standingIn = [[...archivedRow(DEAD, SNAPSHOT), ...row(DEAD)], row(DEAD, `    original: ${OTHER}`)];

  for (const sources of standingIn) {
    refused(() => openRowsFor(parseEntry(entry({ sources })).rows, DEAD), /already has a stand-in/);
  }
  refused(() => openRowsFor(parseEntry(entry({ sources: row(OTHER) })).rows, DEAD), /no source row cites/);
});

test('an address left where the rewrite changes nothing is refused, naming each line, unless that many were allowed', () => {
  const text = ['first', `second ${DEAD}`, `third ${DEAD}.`].join('\n');

  assert.doesNotThrow(() => assertNoLeftover(text, OTHER));
  assert.doesNotThrow(() => assertNoLeftover(text, DEAD, 2));
  refused(() => assertNoLeftover(text, DEAD), /\(line 2: second https:.*; line 3: third https:.*\); a person decides$/);
  refused(() => assertNoLeftover(text, DEAD, 1), /still cited where the rewrite does not change it/);
});

test('an address YAML spells differently in different strings is refused, the first one named', () => {
  const unspellable = ['https://example.org/a b', 'https://example.org/a"b', "https://example.org/a'b", 'a\\b', 'a\tb'];

  assert.doesNotThrow(() => assertSpellable([DEAD, OTHER]));
  for (const address of unspellable) {
    assert.throws(
      () => assertSpellable([DEAD, address]),
      (error) =>
        error instanceof RewriteError && error.message.startsWith(`${address} holds whitespace, a quote or a backslash`)
    );
  }
});

test('a url is spelled in place, plain or in either quote, with the quotes inside the span', () => {
  const quotes = ['', "'", '"'];

  STYLES.forEach(([style, spell], at) => {
    const { text, source } = readRow(...row(spell(DEAD)));
    const spelled = spelledValue({ text, row: source, pair: pairOf(source, 'url'), name: 'url', address: DEAD });

    assert.equal(text.slice(spelled.start, spelled.end), spell(DEAD), style);
    assert.deepEqual([spelled.spelled, spelled.quote], [spell(DEAD), quotes[at]], style);
  });
});

test('a row that is no block mapping, lacks the key, or spells the address another way is refused, naming the row', () => {
  const flow = readRow(`  - {title: The report, url: ${DEAD}}`);
  const plain = readRow(...row(DEAD));
  const folded = readRow('  - title: The report', '    url: >-', `      ${DEAD}`);
  const spelling =
    ({ text, source }, address) =>
    () =>
      spelledValue({ text, row: source, pair: pairOf(source, 'url'), name: 'url', address });

  refused(() => pairOf(flow.source, 'url'), /^sources row 1 is not a block mapping/);
  refused(() => pairOf(plain.source, 'original'), /^sources row 1 is not a block mapping/);
  refused(spelling(folded, DEAD), /^sources row 1 spells its url as/);
  refused(spelling(plain, OTHER), /^sources row 1 spells its url as "https:\/\/example\.org\/report"/);
});
