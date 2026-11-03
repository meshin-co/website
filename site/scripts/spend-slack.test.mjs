import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockKitProblems } from './fixtures/block-kit.mjs';
import {
  GENERATED_AT,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { PHONE_COLUMNS, widthOf } from './slack-table.mjs';
import { monthLineOf } from './spend-ceiling.mjs';
import { corpusOf, reportModel } from './spend-report-model.mjs';
import { REPORT_PATH } from './spend-report-text.mjs';
import { endedMessage, monthPart, spendMessage } from './spend-slack.mjs';

const NEWEST = '2026-11-02T07:00:00.000Z';
const TERM_AT = '2026-11-02T07:00:01.000Z';
const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const TERM_DRAFT = writingCall({ input: 6000, output: 1200, tag: 'term' });

const post = recordOf({ slug: 'a-post', at: NEWEST, calls: [DRAFT, CORRECTION] });
const term = recordOf({ slug: 'a-term', format: 'term', at: TERM_AT, ledgerSlug: 'a-post', calls: [TERM_DRAFT] });
const ledger = ledgerOf({ slug: 'a-post', calls: [...post.calls, ...term.calls] });

const modelFor = (parts) => reportModel(corpusOf(filesOf(parts)), { at: GENERATED_AT });
const populated = () => modelFor({ ledgers: [ledger], records: [term, post] });
const entriesOf = (model, ...slugs) =>
  model.rows
    .filter(({ slug }) => slugs.includes(slug))
    .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt));

const STATUS = { month: '2026-11', spentMicro: 62_000, ceilingUsd: 25 };
const REACHED = { month: '2026-11', spentMicro: 25_010_000, ceilingUsd: 25 };
const OPEN_ENDED = { month: '2026-11', spentMicro: 625_000, ceilingUsd: 25 };
const RUN = { label: 'run 777', url: 'https://github.test/o/r/actions/runs/777' };
const PULL_REQUEST = { label: '#84', url: 'https://github.test/o/r/pull/84' };
const ISSUE = { label: '#41', url: 'https://github.test/o/r/issues/41' };
const LINKS = {
  run: RUN,
  pullRequest: PULL_REQUEST,
  entries: { 'a-post': 'https://site.test/blog/a-post', 'a-term': 'https://site.test/glossary/a-term' },
};
const NO_LINKS = { run: null, pullRequest: null, entries: {} };
const build = ({ model = populated(), slugs = ['a-post', 'a-term'], status = STATUS, links = LINKS } = {}) =>
  spendMessage({ model, rows: entriesOf(model, ...slugs), status, links });

const prose = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const columns = (...texts) => ({ type: 'section', fields: texts.map((text) => ({ type: 'mrkdwn', text })) });
const small = (...texts) => ({ type: 'context', elements: texts.map((text) => ({ type: 'mrkdwn', text })) });
const fenced = (lines) => ['```', ...lines, '```'].join('\n');
const DIVIDER = { type: 'divider' };
const HEADER = { type: 'header', text: { type: 'plain_text', text: '2026-11 spend against the monthly ceiling' } };

const MONTH_TABLE = ['            USD', 'Spent     0.062', 'Ceiling  25.00', 'Left     24.938'];
const REACHED_TABLE = ['             USD', 'Spent      25.01', 'Ceiling    25.00', 'Left     none'];
const ENDED_TABLE = ['            USD', 'Spent     0.625', 'Ceiling  25.00', 'Left     24.375'];
const ENTRY_TOKENS = ['Tokens    input  output', 'article  25,000   5,000', 'term      6,000   1,200'];
const ENTRY_COST = ['Cost       USD', 'article  0.05', 'term     0.012'];
const TOKENS = [
  'Tokens    input  output',
  'all      31,000   6,200',
  'article  25,000   5,000',
  'term      6,000   1,200',
];
const COST = [
  'Cost     entries    USD',
  'all            2  0.062',
  'article        1  0.05',
  'term           1  0.012',
];
const PAID = [
  '                        USD',
  'Writing calls         0.062',
  'Repair calls          0.00',
  'Ended with no entry   0.00',
  'No generation record  0.00',
  'Everything paid for   0.062',
];
const ZERO_WARNINGS =
  'Warnings: 0 (every ledger agrees with its generation record; this does not say that every run produced an entry)';
const CAVEAT = 'The 30 days end at the newest entry. They are not the calendar month of the spend ceiling.';
const RATE = 'gpt-6.1-terra-2026-10-01';

test('the blocks of a message about two entries, in order, with every table pinned to the character', () => {
  assert.deepEqual(build().blocks, [
    HEADER,
    prose(fenced(MONTH_TABLE)),
    DIVIDER,
    prose(
      '*This entry*\narticle <https://site.test/blog/a-post|a-post>\nterm <https://site.test/glossary/a-term|a-term>'
    ),
    columns(
      '*Pull request*\n<https://github.test/o/r/pull/84|#84>',
      '*Workflow run*\n<https://github.test/o/r/actions/runs/777|run 777>'
    ),
    small('The entries are live at these addresses once the pull request merges and the site is published.'),
    prose(fenced([...ENTRY_TOKENS, '', ...ENTRY_COST])),
    DIVIDER,
    prose(`*Last 30 days*, to 2026-11-02T07:00:01.000Z\n${fenced([...TOKENS, '', ...COST])}`),
    prose(`*All time*, since 2026-11-02T07:00:00.000Z\n${fenced([...TOKENS, '', ...COST])}`),
    prose(`*Everything paid for*\n${fenced(PAID)}`),
    prose(`*Rates*\n• ${RATE}: 1 USD per million input tokens, 5 USD per million output tokens`),
    small(CAVEAT),
    DIVIDER,
    small(ZERO_WARNINGS),
    small(`Full tables: \`${REPORT_PATH}\``),
  ]);
});

test('the month against the ceiling is the first thing: the header names it, the next block holds the figures, and the text opens with its sentence', () => {
  const { blocks, text } = build();
  assert.deepEqual(blocks.slice(0, 2), [HEADER, prose(fenced(MONTH_TABLE))]);
  assert.equal(text.split('\n')[0], monthLineOf(STATUS));
  assert.equal(
    text.split('\n')[0],
    '2026-11 so far: 0.062 USD spent of the 25.00 USD monthly ceiling, 24.938 USD left.'
  );
});

test('the fallback text holds every fact of the message by itself, as plain lines of numbers and units', () => {
  assert.equal(
    build().text,
    [
      monthLineOf(STATUS),
      '',
      'This entry',
      'article <https://site.test/blog/a-post|a-post>: 25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'term <https://site.test/glossary/a-term|a-term>: 6,000 input tokens, 1,200 output tokens, 0.012 USD',
      '',
      'Pull request: <https://github.test/o/r/pull/84|#84>',
      'Workflow run: <https://github.test/o/r/actions/runs/777|run 777>',
      '',
      'Last 30 days, to 2026-11-02T07:00:01.000Z',
      'all: 2 entries, 31,000 input tokens, 6,200 output tokens, 0.062 USD',
      'article: 1 entry, 25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'term: 1 entry, 6,000 input tokens, 1,200 output tokens, 0.012 USD',
      '',
      'All time, since 2026-11-02T07:00:00.000Z',
      'all: 2 entries, 31,000 input tokens, 6,200 output tokens, 0.062 USD',
      'article: 1 entry, 25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'term: 1 entry, 6,000 input tokens, 1,200 output tokens, 0.012 USD',
      'Everything paid for: 0.062 USD, of which writing calls 0.062 USD, repair calls 0.00 USD, runs that ended with no entry 0.00 USD and spend with no generation record 0.00 USD.',
      '',
      `Rates: ${RATE} at 1 USD per million input tokens and 5 USD per million output tokens`,
      '',
      CAVEAT,
      '',
      ZERO_WARNINGS,
    ].join('\n')
  );
});

test('a post that shipped alone is reported alone, with its own row in the table and no term in the text', () => {
  const { blocks, text } = build({ slugs: ['a-post'] });
  assert.equal(blocks[3].text.text, '*This entry*\narticle <https://site.test/blog/a-post|a-post>');
  assert.deepEqual(blocks[6], prose(fenced([ENTRY_TOKENS[0], ENTRY_TOKENS[1], '', 'Cost      USD', 'article  0.05'])));
  assert.doesNotMatch(text.split('\n\n')[1], /a-term/);
  assert.match(text, /Last 30 days, to 2026-11-02T07:00:01\.000Z\nall: 2 entries/);
});

test('two entries of one format get a number each, in the list and in the table, so no row is ambiguous', () => {
  const other = recordOf({ slug: 'b-post', at: TERM_AT, ledgerSlug: 'a-post', calls: [TERM_DRAFT] });
  const together = ledgerOf({ slug: 'a-post', calls: [...post.calls, ...other.calls, ...term.calls] });
  const model = modelFor({ ledgers: [together], records: [post, other, term] });
  const { blocks, text } = build({ model, slugs: ['a-post', 'b-post'] });
  assert.equal(blocks[3].text.text, '*This entry*\narticle 1 <https://site.test/blog/a-post|a-post>\narticle 2 b-post');
  assert.deepEqual(
    blocks[6],
    prose(
      fenced([
        'Tokens      input  output',
        'article 1  25,000   5,000',
        'article 2   6,000   1,200',
        '',
        'Cost         USD',
        'article 1  0.05',
        'article 2  0.012',
      ])
    )
  );
  assert.match(text, /\narticle 2 b-post: 6,000 input tokens, 1,200 output tokens, 0\.012 USD\n/);
});

test('with no address known the entries are their slugs, nothing claims they are live and no link is left half-built', () => {
  const { blocks, text } = build({ links: NO_LINKS });
  assert.equal(blocks[3].text.text, '*This entry*\narticle a-post\nterm a-term');
  assert.equal(JSON.stringify(blocks).includes('are live'), false);
  assert.equal(
    blocks.some((block) => block.fields),
    false
  );
  assert.doesNotMatch(text, /<https?:/);
  assert.doesNotMatch(text, /Pull request|Workflow run/);
});

test('a pull request that is known by number only is shown as that number, and a run that is not known is left out', () => {
  const { blocks, text } = build({ links: { ...NO_LINKS, pullRequest: { label: '#84', url: null } } });
  assert.deepEqual(blocks[4], columns('*Pull request*\n#84'));
  assert.match(text, /\nPull request: #84\n/);
});

test('when the ceiling is reached the third figure is none, and the consequence is said under the table', () => {
  const { blocks, text } = build({ status: REACHED });
  assert.deepEqual(blocks.slice(0, 3), [
    HEADER,
    prose(fenced(REACHED_TABLE)),
    small('The ceiling is reached, so the writer does not run for the rest of the month.'),
  ]);
  assert.equal(
    text.split('\n')[0],
    '2026-11 so far: 25.01 USD spent of the 25.00 USD monthly ceiling, none left: the ceiling is reached, so the writer does not run for the rest of the month.'
  );
});

test('warnings are a section a person must read, capped at three with a count of the rest', () => {
  const warnings = ['one', 'two', 'three', 'four', 'five'].map((name) => `lost-${name}: needs a person`);
  const { blocks, text } = build({ model: { ...populated(), warnings } });
  const warned = blocks.filter((block) => JSON.stringify(block).includes('Warnings'));
  assert.deepEqual(warned, [
    prose(
      `*Warnings: 5* (each needs a person to look at it)\n• lost-one: needs a person\n• lost-two: needs a person\n• lost-three: needs a person\nand 2 more in ${REPORT_PATH}`
    ),
  ]);
  assert.ok(
    text.endsWith(
      `Warnings: 5 (each needs a person to look at it)\nlost-one: needs a person\nlost-two: needs a person\nlost-three: needs a person\nand 2 more in ${REPORT_PATH}`
    )
  );
});

test('a count of zero is a quiet context line, and a count of one or more is a section: the two never look alike', () => {
  const quiet = build().blocks.filter((block) => JSON.stringify(block).includes('Warnings'));
  assert.deepEqual(
    quiet.map((block) => block.type),
    ['context']
  );
  const loud = build({ model: { ...populated(), warnings: ['x: look'] } }).blocks.filter((block) =>
    JSON.stringify(block).includes('Warnings')
  );
  assert.deepEqual(
    loud.map((block) => block.type),
    ['section']
  );
});

test('a note is not in the message and is never counted as a warning, and its money sits in its own row of the paid table', () => {
  const model = {
    ...populated(),
    notes: ['lost-post: this run ended on 2026-11-02 and left no generation record'],
    paidAllTime: { ...populated().paidAllTime, endedMicro: 27_000, totalMicro: 89_000 },
  };
  const { blocks, text } = build({ model });
  assert.doesNotMatch(JSON.stringify(blocks), /lost-post|Notes/);
  assert.doesNotMatch(text, /lost-post|Notes/);
  assert.match(text, /^Warnings: 0 \(/m);
  assert.match(blocks[10].text.text, /Ended with no entry {3}0\.027\n/);
  assert.match(blocks[10].text.text, /No generation record {2}0\.00\n/);
});

test('rates are listed newest first, three at most, with a count of the earlier ones', () => {
  const older = ['m1', 'm2', 'm3', 'm4'].map((model, at) =>
    recordOf({
      slug: `old-${model}`,
      at: `2026-10-0${at + 1}T07:00:00.000Z`,
      runId: `run-${model}`,
      calls: [writingCall({ tag: model, price: { inputPerMillion: at + 2, outputPerMillion: 8 }, model })],
    })
  );
  const ledgers = [ledger, ...older.map(({ slug, calls }) => ledgerOf({ slug, calls }))];
  const model = modelFor({ ledgers, records: [term, post, ...older] });
  const { blocks, text } = build({ model });
  assert.equal(
    blocks[11].text.text,
    [
      '*Rates*',
      `• ${RATE}: 1 USD per million input tokens, 5 USD per million output tokens`,
      '• m4: 5 USD per million input tokens, 8 USD per million output tokens',
      '• m3: 4 USD per million input tokens, 8 USD per million output tokens',
      `and 2 earlier in ${REPORT_PATH}`,
    ].join('\n')
  );
  assert.ok(
    text.includes(
      [
        `Rates: ${RATE} at 1 USD per million input tokens and 5 USD per million output tokens`,
        'm4 at 5 USD per million input tokens and 8 USD per million output tokens',
        'm3 at 4 USD per million input tokens and 8 USD per million output tokens',
        `and 2 earlier in ${REPORT_PATH}`,
      ].join('\n')
    )
  );
});

test('whatever a warning says, no markup in it is read and no mention can be raised', () => {
  const hostile = 'x: <!channel> & <https://evil.test|click> *bold*';
  const { blocks, text } = build({ model: { ...populated(), warnings: [hostile] } });
  const warned = blocks.find((block) => block.text?.text.startsWith('*Warnings'));
  assert.ok(warned.text.text.includes('&lt;!channel&gt; &amp; &lt;https://evil.test|click&gt;'));
  assert.equal(text.includes('<!channel>'), false);
  assert.equal(text.includes('<https://evil.test'), false);
  assert.deepEqual(blockKitProblems({ text, blocks }), []);
});

test('no table line is wider than a phone shows, even for a year of entries and a long figure', () => {
  const base = populated();
  const total = { entries: 365, input: 14_600_000, output: 2_920_000, micro: 300_123_456 };
  const formats = [
    { format: 'article', ...total },
    { format: 'term', ...total },
  ];
  const model = {
    ...base,
    thirtyDays: { ...base.thirtyDays, totals: { all: total, formats } },
    allTime: { ...base.allTime, totals: { all: total, formats } },
    paidAllTime: {
      writingMicro: 300_123_456,
      repairMicro: 45_000_000,
      endedMicro: 48_500_000,
      unmatchedMicro: 27_000_000,
      totalMicro: 420_623_456,
    },
  };
  const rows = [
    {
      slug: 'big',
      format: 'article',
      generatedAt: NEWEST,
      input: 99_999,
      output: 16_000,
      micro: 1_234_567,
      repairMicro: 0,
    },
  ];
  const status = { month: '2026-11', spentMicro: 24_999_999, ceilingUsd: 25 };
  const { blocks } = spendMessage({ model, rows, status, links: NO_LINKS });
  const lines = blocks
    .filter((block) => block.type === 'section' && block.text?.text.includes('```'))
    .flatMap((block) => block.text.text.split('```').filter((_, at) => at % 2 === 1))
    .flatMap((body) => body.split('\n'));
  assert.ok(lines.length > 15);
  assert.ok(widthOf(lines) <= PHONE_COLUMNS, `${widthOf(lines)} columns`);
});

test('every payload this builds is one Slack accepts: the limits, the escaping and the fences', () => {
  const warnings = Array.from({ length: 40 }, (_, at) => `${'w'.repeat(400)} ${at} <b> & c`);
  for (const message of [
    build(),
    build({ links: NO_LINKS }),
    build({ status: REACHED }),
    build({ slugs: ['a-post'] }),
    build({ model: { ...populated(), warnings } }),
  ])
    assert.deepEqual(blockKitProblems(message), []);
});

test('no link in any block or in the text is markdown, and the text never exceeds the length Slack advises', () => {
  const { blocks, text } = build();
  assert.doesNotMatch(JSON.stringify(blocks), /\]\(/);
  assert.doesNotMatch(text, /\]\(/);
  assert.ok(text.length < 4000);
});

test('the same input gives the same message every time', () => {
  assert.deepEqual(build(), build());
});

test('a message is never built from an empty model, or without the ceiling status that says what the month spent', () => {
  const empty = modelFor({});
  assert.throws(() => spendMessage({ model: empty, rows: [], status: STATUS, links: NO_LINKS }), /no entry/);
  const model = populated();
  const rows = entriesOf(model, 'a-post');
  assert.throws(() => spendMessage({ model, rows, status: undefined, links: NO_LINKS }), /ceiling status/);
  assert.throws(() => build({ status: { month: '2026-11' } }), /ceiling status/);
});

test('the month part is the header and the aligned figures, with a line under them only when the ceiling is reached', () => {
  assert.deepEqual(monthPart(STATUS), { blocks: [HEADER, prose(fenced(MONTH_TABLE))], text: monthLineOf(STATUS) });
  assert.equal(monthPart(REACHED).blocks.length, 3);
});

test('a merged ledger changes no figure of the message, which counts the records', () => {
  const model = modelFor({ ledgers: [mergedLedger(ledger)], records: [term, post] });
  assert.deepEqual(build({ model }).blocks.slice(0, 11), build().blocks.slice(0, 11));
});

const NO_ENTRY = { date: '2026-11-10', runMicro: 0, status: OPEN_ENDED, links: { run: RUN, issue: null } };

test('the blocks of a day that ended with no entry: the month first, then what happened, then the cost and the run', () => {
  const { blocks } = endedMessage({
    ...NO_ENTRY,
    reason: 'the picker chose nothing to write: every candidate was set aside.',
  });
  assert.deepEqual(blocks, [
    HEADER,
    prose(fenced(ENDED_TABLE)),
    DIVIDER,
    prose('*No entry was written on 2026-11-10*\nThe picker chose nothing to write: every candidate was set aside.'),
    columns('*What the run cost*\n0.00 USD', '*Workflow run*\n<https://github.test/o/r/actions/runs/777|run 777>'),
  ]);
});

test('the fallback text of a day with no entry opens with the month and keeps the sentence the message always had', () => {
  const { text } = endedMessage({ ...NO_ENTRY, reason: 'the writer did not run', runMicro: 12_500 });
  assert.equal(
    text,
    [
      '2026-11 so far: 0.625 USD spent of the 25.00 USD monthly ceiling, 24.375 USD left.',
      '',
      'No entry was written on 2026-11-10: the writer did not run. The run cost 0.0125 USD.',
      '',
      'Workflow run: <https://github.test/o/r/actions/runs/777|run 777>',
    ].join('\n')
  );
});

test('a reason that ends in a full stop or spans lines is one clean sentence in both the block and the text', () => {
  const { blocks, text } = endedMessage({ ...NO_ENTRY, reason: 'the picker chose nothing: nothing\nis ready.  ' });
  assert.equal(
    blocks[3].text.text,
    '*No entry was written on 2026-11-10*\nThe picker chose nothing: nothing is ready.'
  );
  assert.match(
    text,
    /^No entry was written on 2026-11-10: the picker chose nothing: nothing is ready\. The run cost 0\.00 USD\.$/m
  );
});

test('the escalation issue of a write that stopped is a third column, and its link is a link', () => {
  const { blocks, text } = endedMessage({
    ...NO_ENTRY,
    reason: 'the write stopped on a-post (output)',
    links: { run: RUN, issue: ISSUE },
  });
  assert.deepEqual(
    blocks.at(-1),
    columns(
      '*What the run cost*\n0.00 USD',
      '*Workflow run*\n<https://github.test/o/r/actions/runs/777|run 777>',
      '*Escalation issue*\n<https://github.test/o/r/issues/41|#41>'
    )
  );
  assert.match(text, /\nEscalation issue: <https:\/\/github\.test\/o\/r\/issues\/41\|#41>$/);
});

test('with no link known the cost still stands alone, and a ceiling that is reached says what follows', () => {
  const { blocks, text } = endedMessage({
    ...NO_ENTRY,
    status: REACHED,
    reason: "the month's spend reached the ceiling, so the writer did not run",
    links: { run: null, issue: null },
  });
  assert.deepEqual(blocks.slice(0, 3), [
    HEADER,
    prose(fenced(REACHED_TABLE)),
    small('The ceiling is reached, so the writer does not run for the rest of the month.'),
  ]);
  assert.deepEqual(blocks.at(-1), columns('*What the run cost*\n0.00 USD'));
  assert.doesNotMatch(text, /Workflow run|<https?:/);
});

test('a day with no entry is a payload Slack accepts, for every ending and every set of links', () => {
  const reasons = [
    "the month's spend reached the ceiling, so the writer did not run",
    'the picker chose to strengthen a page and wrote nothing: Strengthen /blog/x for "query" <b> & c',
    'the write ended with no entry, because term a-term was skipped (no draft passed)',
    'the write stopped on a-post (output)',
    `${'long '.repeat(900)}reason`,
  ];
  for (const reason of reasons)
    for (const links of [
      { run: RUN, issue: ISSUE },
      { run: null, issue: null },
    ])
      assert.deepEqual(blockKitProblems(endedMessage({ ...NO_ENTRY, reason, links })), [], reason.slice(0, 40));
});

test('two entries of one format with six-figure token counts and a six-decimal cost still fit a phone', () => {
  const rows = ['a-post', 'b-post'].map((slug) => ({
    format: 'article',
    slug,
    input: 123_456,
    output: 78_901,
    micro: 123_456,
  }));
  const { blocks } = spendMessage({ model: populated(), rows, status: STATUS, links: NO_LINKS });
  const fenced = blocks.flatMap(({ text }) => (text?.text ?? '').split('```').filter((_, at) => at % 2 === 1));
  const widest = widthOf(fenced.flatMap((body) => body.split('\n')));
  assert.ok(widest <= PHONE_COLUMNS, `the widest table line is ${widest} columns`);
});
