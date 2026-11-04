import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockKitProblems } from './fixtures/block-kit.mjs';
import {
  A_POST,
  A_TERM,
  DIVIDER,
  DOWN,
  HEADER,
  MONTH_TABLE,
  NO_LINKS,
  POST_FIGURES,
  REACHED,
  REFUSED,
  STATUS,
  TERM_FIGURES,
  columns,
  fenced,
  fieldsOf,
  live,
  prose,
  sectionsText,
  small,
  surface,
  unanswered,
  unreachable,
  withPage,
} from './fixtures/live-messages.mjs';
import { ENTRIES_PER_MESSAGE, messageGroups } from './live-slack.mjs';
import { PHONE_COLUMNS, widthOf } from './slack-table.mjs';
import { monthLineOf } from './spend-ceiling.mjs';
import { monthPart } from './spend-slack.mjs';

test('the blocks of a message about one live entry, in order, pinned to the character', () => {
  assert.deepEqual(live().blocks, [
    HEADER,
    prose(fenced(MONTH_TABLE)),
    DIVIDER,
    prose('*The entry is live*'),
    prose(
      '*What an AI system register holds*\narticle `a-post`\n_Buyer prompt 3: “How do I keep an AI system register?”_'
    ),
    prose(fenced(POST_FIGURES)),
    columns(
      '*The page*\n<https://site.test/blog/a-post|/blog/a-post>',
      '*A markdown sidecar*\n<https://site.test/blog/a-post.md|/blog/a-post.md>',
      '*A social card*\n<https://site.test/og/post/a-post.png|/og/post/a-post.png>'
    ),
    small('The page answered HTTP 200 on attempt 1, checked 2026-11-03 09:00:12 UTC.'),
    small('Workflow run <https://github.test/o/r/actions/runs/777|run 777>'),
  ]);
});

test('the fallback text carries every fact of the message by itself, with the month sentence first', () => {
  assert.equal(
    live().text,
    [
      monthLineOf(STATUS),
      '',
      'The entry is live.',
      '',
      'What an AI system register holds',
      'article a-post',
      'Buyer prompt 3: “How do I keep an AI system register?”',
      '25,000 input tokens, 5,000 output tokens, 0.05 USD',
      'The page: <https://site.test/blog/a-post|/blog/a-post>',
      'A markdown sidecar: <https://site.test/blog/a-post.md|/blog/a-post.md>',
      'A social card: <https://site.test/og/post/a-post.png|/og/post/a-post.png>',
      'The page answered HTTP 200 on attempt 1, checked 2026-11-03 09:00:12 UTC.',
      '',
      'Workflow run: <https://github.test/o/r/actions/runs/777|run 777>',
    ].join('\n')
  );
});

test('the month against the ceiling is the first thing in a live message and in a warning: the same two blocks and the same first line as every other message', () => {
  const failing = withPage(A_POST, unanswered());
  for (const message of [live(), unreachable([failing])]) {
    assert.deepEqual(message.blocks.slice(0, 2), monthPart(STATUS).blocks);
    assert.equal(message.text.split('\n')[0], monthLineOf(STATUS));
  }
});

test('two entries are one message, each with its own title, figures, links and check time', () => {
  const message = live([A_POST, A_TERM]);
  assert.equal(message.blocks.filter(({ type }) => type === 'header').length, 1);
  assert.equal(message.blocks[3].text.text, '*2 entries are live*');
  assert.deepEqual(
    message.blocks.slice(4).map(({ type }) => type),
    ['section', 'section', 'section', 'context', 'section', 'section', 'section', 'context', 'context']
  );
  const figures = message.blocks.map((block) => block.text?.text);
  assert.ok(
    figures.includes(prose(fenced(TERM_FIGURES)).text.text) && figures.includes(prose(fenced(POST_FIGURES)).text.text)
  );
  assert.match(
    sectionsText(message),
    /What is an AI register\?\*\nterm `a-term`\n_Buyer prompt 12: “AI register definition”_/
  );
  assert.deepEqual(
    message.blocks.filter(({ type }) => type === 'context').map((block) => block.elements[0].text),
    [
      'The page answered HTTP 200 on attempt 1, checked 2026-11-03 09:00:12 UTC.',
      'The page answered HTTP 200 on attempt 2, checked 2026-11-03 09:00:17 UTC.',
      'Workflow run <https://github.test/o/r/actions/runs/777|run 777>',
    ]
  );
  assert.match(message.text, /^2 entries are live\.$/m);
  assert.ok(message.text.indexOf('a-post') < message.text.indexOf('a-term'));
});

test('a surface that does not answer is plain text with its status and time, not a link, and a warning section says a person has something to do', () => {
  const broken = {
    ...A_POST,
    surfaces: [surface('sidecar', 'a markdown sidecar', '/blog/a-post.md', unanswered()), A_POST.surfaces[1]],
  };
  const message = live([broken]);
  const [columnsBlock] = fieldsOf(message);
  assert.deepEqual(
    columnsBlock.fields.map(({ text }) => text),
    [
      '*The page*\n<https://site.test/blog/a-post|/blog/a-post>',
      '*A markdown sidecar*\n/blog/a-post.md (HTTP 404, checked 2026-11-03 09:02:21 UTC)',
      '*A social card*\n<https://site.test/og/post/a-post.png|/og/post/a-post.png>',
    ]
  );
  const warning = [
    '*A surface of an entry that is live does not answer*',
    '• `a-post`: a markdown sidecar /blog/a-post.md, HTTP 404 after 8 attempts, last checked 2026-11-03 09:02:21 UTC',
    'A person has something to do: find out why the published build lacks what is named above. A later publish does not check an announced entry again.',
  ].join('\n');
  assert.ok(message.blocks.some((block) => block.text?.text === warning));
  assert.ok(message.text.includes('A surface of an entry that is live does not answer'));
  assert.ok(message.text.includes('A markdown sidecar: /blog/a-post.md (HTTP 404, checked 2026-11-03 09:02:21 UTC)'));
});

test('a surface that fails with no status says what failed, and one attempt is not "1 attempts"', () => {
  const gone = surface(
    'og-image',
    'a social card',
    '/og/post/a-post.png',
    unanswered('request failed: ECONNREFUSED', 1)
  );
  const { text } = live([{ ...A_POST, surfaces: [gone] }]);
  assert.match(text, /A social card: .* \(request failed: ECONNREFUSED, checked/);
  assert.match(text, /ECONNREFUSED after 1 attempt, last/);
});

test('a page that did not answer is never announced as live', () => {
  assert.throws(
    () => live([A_TERM, withPage(A_POST, unanswered('request failed: ECONNREFUSED'))]),
    /a-post.*not reachable/
  );
});

test('without a workflow run there is no footer, no column and no mention of it', () => {
  const message = live([A_POST], { links: NO_LINKS });
  assert.equal(message.blocks.at(-1).type, 'context');
  assert.match(message.blocks.at(-1).elements[0].text, /^The page answered/);
  assert.doesNotMatch(message.text, /Workflow run/);
  assert.doesNotMatch(JSON.stringify(message.blocks), /Workflow run/);
  const warning = unreachable([DOWN], { links: NO_LINKS });
  assert.deepEqual([fieldsOf(warning).length, /Workflow run/.test(warning.text)], [0, false]);
});

test('when the ceiling is reached the message keeps saying so, under the table', () => {
  const message = live([A_POST], { status: REACHED });
  assert.match(message.blocks[2].elements[0].text, /ceiling is reached/);
  assert.match(message.text.split('\n')[0], /none left/);
});

test('more links than one block holds become more blocks, ten columns at most in each', () => {
  const paths = Array.from({ length: 12 }, (_, at) => surface('sidecar', `surface ${at}`, `/s/${at}`));
  const message = live([{ ...A_POST, surfaces: paths }]);
  assert.deepEqual(
    fieldsOf(message).map(({ fields }) => fields.length),
    [10, 3]
  );
});

test('whatever a title or a prompt says, no markup in it is read, no mention is raised, a long one is cut with an ellipsis and a line break never splits it', () => {
  const hostile = {
    ...A_POST,
    title: 'Tom & Jerry <!channel> <b>bold</b>',
    prompt: { number: 3, text: 'a <https://evil.test|click> & b' },
  };
  const message = live([hostile]);
  assert.ok(sectionsText(message).includes('Tom &amp; Jerry &lt;!channel&gt; &lt;b&gt;bold&lt;/b&gt;'));
  assert.ok(sectionsText(message).includes('a &lt;https://evil.test|click&gt; &amp; b'));
  assert.equal(message.text.includes('<!channel>'), false);
  assert.equal(message.text.includes('<https://evil.test'), false);
  assert.deepEqual(blockKitProblems(message), []);
  const long = live([{ ...A_POST, title: 'T'.repeat(500), prompt: { number: 3, text: 'p'.repeat(2000) } }]);
  assert.deepEqual(blockKitProblems(long), []);
  assert.ok(long.text.length < 4000);
  assert.match(sectionsText(long), /^\*T+…\*$/m);
  assert.match(sectionsText(long), /“p+…”/);
  assert.equal(sectionsText(long).includes('p'.repeat(301)), false);
  const spread = live([{ ...A_POST, title: 'One\n  two', prompt: { number: 3, text: 'first\n\nsecond' } }]);
  assert.match(sectionsText(spread), /^\*One two\*$/m);
  assert.match(sectionsText(spread), /^_Buyer prompt 3: “first second”_$/m);
});

test('no table line is wider than a phone shows', () => {
  const big = { ...A_POST, input: 14_600_000, output: 2_920_000, micro: 300_123_456 };
  const lines = live([big, A_TERM])
    .blocks.filter((block) => block.type === 'section' && block.text?.text.includes('```'))
    .flatMap((block) => block.text.text.split('```').filter((_, at) => at % 2 === 1))
    .flatMap((body) => body.split('\n'));
  assert.ok(lines.length > 8);
  assert.ok(widthOf(lines) <= PHONE_COLUMNS, `${widthOf(lines)} columns`);
});

test('every payload a live message can be is one Slack accepts, and the same input gives the same message', () => {
  const broken = { ...A_POST, surfaces: [surface('sidecar', 'a markdown sidecar', '/blog/a-post.md', unanswered())] };
  for (const message of [
    live(),
    live([A_POST, A_TERM]),
    live([A_POST, A_TERM, { ...A_TERM, slug: 'b-term' }]),
    live([broken]),
    live([A_POST], { links: NO_LINKS }),
    live([A_POST], { status: REACHED }),
  ])
    assert.deepEqual(blockKitProblems(message), []);
  assert.deepEqual(live([A_POST, A_TERM]), live([A_POST, A_TERM]));
});

test('the blocks of a warning about an entry that merged and is not reachable, in order, pinned to the character', () => {
  assert.deepEqual(unreachable([DOWN]).blocks, [
    HEADER,
    prose(fenced(MONTH_TABLE)),
    DIVIDER,
    prose(
      [
        '*An entry that merged is not reachable*',
        '• `a-post`: <https://site.test/blog/a-post|https://site.test/blog/a-post>, HTTP 404 after 8 attempts, last checked 2026-11-03 09:02:21 UTC',
        'A person has something to do: find out why the page is not served. No entry named above is recorded as announced, so the next publish checks each one again and posts this warning again until its page answers.',
      ].join('\n')
    ),
    columns('*Workflow run*\n<https://github.test/o/r/actions/runs/777|run 777>'),
  ]);
});

test('the fallback text of the warning says what happened, what a person does and where, with the month sentence first', () => {
  assert.equal(
    unreachable([DOWN]).text,
    [
      monthLineOf(STATUS),
      '',
      'An entry that merged is not reachable. A person has something to do.',
      'a-post: <https://site.test/blog/a-post|https://site.test/blog/a-post>, HTTP 404 after 8 attempts, last checked 2026-11-03 09:02:21 UTC',
      'Find out why the page is not served. No entry named above is recorded as announced, so the next publish checks each one again and posts this warning again until its page answers.',
      '',
      'Workflow run: <https://github.test/o/r/actions/runs/777|run 777>',
    ].join('\n')
  );
});

test('every entry that is not reachable is named once, with its own error and its own time', () => {
  const { blocks, text } = unreachable([DOWN, REFUSED]);
  const warning = blocks.find((block) => block.text?.text.startsWith('*An entry'));
  const bullets = warning.text.text.split('\n').filter((line) => line.startsWith('• '));
  assert.match(bullets[0], /`a-post`: .*HTTP 404 after 8 attempts, last checked 2026-11-03 09:02:21 UTC/);
  assert.match(bullets[1], /`a-term`: .*ECONNREFUSED after 8 attempts, last checked 2026-11-03 09:03:00 UTC/);
  assert.equal(bullets.length, 2);
  assert.match(text, /\na-term: .*ECONNREFUSED after 8 attempts/);
});

test('a long list of entries that are not reachable shows five and counts the rest', () => {
  const entries = Array.from({ length: 8 }, (_, at) => withPage({ ...A_POST, slug: `post-${at}` }, unanswered()));
  const { blocks, text } = unreachable(entries);
  const warning = blocks.find((block) => block.text?.text.startsWith('*An entry'));
  assert.equal(warning.text.text.match(/^• /gm).length, 5);
  assert.match(warning.text.text, /\nand 3 more\n/);
  assert.match(text, /\nand 3 more\n/);
});

test('every warning is one Slack accepts, and whatever an error says no markup in it is read', () => {
  const hostile = withPage(A_POST, unanswered('request failed: <!channel> & <https://evil.test|x>'));
  for (const message of [
    unreachable([DOWN]),
    unreachable([DOWN, REFUSED]),
    unreachable([hostile]),
    unreachable([DOWN], { status: REACHED }),
    unreachable(Array.from({ length: 8 }, (_, at) => withPage({ ...A_POST, slug: `p${at}` }, unanswered()))),
  ])
    assert.deepEqual(blockKitProblems(message), []);
  const { blocks, text } = unreachable([hostile]);
  assert.ok(JSON.stringify(blocks).includes('&lt;!channel&gt; &amp; &lt;https://evil.test|x&gt;'));
  assert.equal(text.includes('<!channel>'), false);
});

test('a message is refused without what it needs: entries that fit, a page that answered or not, and the status of the month', () => {
  assert.throws(() => live([]), /at least one entry/);
  const many = Array.from({ length: ENTRIES_PER_MESSAGE + 1 }, (_, at) => ({ ...A_POST, slug: `post-${at}` }));
  assert.throws(() => live(many), new RegExp(`at most ${ENTRIES_PER_MESSAGE} entries`));
  assert.equal(ENTRIES_PER_MESSAGE, 3);
  assert.throws(() => unreachable([]), /at least one entry/);
  assert.throws(() => unreachable([A_POST]), /a-post.*answered/);
  assert.throws(() => live([A_POST], { status: null }), /ceiling status/);
  assert.throws(() => unreachable([DOWN], { status: { month: '2026-11' } }), /ceiling status/);
});

test('entries are split into messages of three at most, in order, and no entry is left out or repeated', () => {
  const numbers = Array.from({ length: 7 }, (_, at) => at + 1);
  assert.deepEqual(messageGroups(numbers), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(messageGroups(numbers.slice(0, 3)), [[1, 2, 3]]);
  assert.deepEqual(messageGroups([]), []);
});

const DEBT = {
  tree: 'bbbbbbbbbbbb',
  last: 'the last recorded run (2026-11-04T02:51:16.487Z) measured aaaaaaaaaaaa',
  owed: [{ slug: 'a-post', mergedCommit: 'd716823', recordedAt: '2026-11-04T03:43:07.953Z' }],
  clear: 'cd site && GATE_PHASE=<bucket> npm run gate:lh && GATE_PHASE=<bucket> npm run lh:record',
};

test('a live message about an unmeasured tree carries one warning section: the tree, the run before it, the entry that owes it and the command', () => {
  const message = live([A_POST], { unmeasured: DEBT });

  assert.deepEqual(blockKitProblems(message), []);
  const warning = sectionsText(message);
  assert.match(warning, /\*This build shipped without a Lighthouse measurement\*/);
  assert.match(warning, /tree bbbbbbbbbbbb: the last recorded run \(2026-11-04T02:51:16\.487Z\) measured aaaaaaaaaaaa/);
  assert.match(warning, /`a-post` owes the measurement \(merged as d716823\)/);
  assert.match(
    warning,
    /GATE_PHASE=&lt;bucket&gt; npm run gate:lh &amp;&amp; GATE_PHASE=&lt;bucket&gt; npm run lh:record/
  );
  assert.match(message.text, /This build shipped without a Lighthouse measurement\. A person has something to do\./);
  assert.ok(message.text.indexOf('A markdown sidecar') < message.text.indexOf('without a Lighthouse measurement'));
  assert.ok(message.text.indexOf('without a Lighthouse measurement') < message.text.indexOf('Workflow run:'));
});

test('a live message about a measured tree says nothing about measurement', () => {
  assert.doesNotMatch(live().text, /Lighthouse/);
  assert.deepEqual(live([A_POST], { unmeasured: null }), live());
});
