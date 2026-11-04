import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIMITS,
  assemble,
  bold,
  context,
  divider,
  escapeText,
  fields,
  header,
  link,
  message,
  preformatted,
  section,
  sections,
} from './slack-blocks.mjs';

test('the three characters Slack reads as markup are escaped, so a title can never mention a channel', () => {
  assert.equal(escapeText('a & b <!channel> > c'), 'a &amp; b &lt;!channel&gt; &gt; c');
  assert.equal(escapeText('&lt;'), '&amp;lt;');
  assert.equal(escapeText('plain text 1,200 USD'), 'plain text 1,200 USD');
});

test('a link is Slack syntax with an escaped label, and never markdown', () => {
  assert.equal(link('https://github.test/o/r/pull/72', '#72'), '<https://github.test/o/r/pull/72|#72>');
  assert.equal(link('https://x.test', 'a <b> & c'), '<https://x.test|a &lt;b&gt; &amp; c>');
  assert.equal(link('https://x.test/a?b=1&c=2', 'x'), '<https://x.test/a?b=1&amp;c=2|x>');
});

test('a link whose address Slack could misread or a reader should not trust is only its label', () => {
  for (const url of [
    null,
    undefined,
    '',
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://x.test/a',
    'https://x.test/a b',
    'https://x.test/a|b',
    'https://x.test/<b>',
    'https://x.test/a>b',
  ])
    assert.equal(link(url, 'the label'), 'the label', String(url));
});

test('a header is plain text, so no markup in it is ever read, and it is cut at the limit with an ellipsis', () => {
  assert.deepEqual(header('Escalation: credential'), {
    type: 'header',
    text: { type: 'plain_text', text: 'Escalation: credential' },
  });
  const cut = header('x'.repeat(400)).text.text;
  assert.equal(cut.length, LIMITS.header);
  assert.ok(cut.endsWith('…'));
  assert.throws(() => header('  '), /empty/);
});

test('a cut never splits a character that takes two code units', () => {
  const cut = header('x'.repeat(LIMITS.header - 2) + '😀😀').text.text;
  assert.ok(cut.endsWith('…'));
  assert.doesNotMatch(cut, /[\uD800-\uDBFF]…$/);
});

test('a section is one block of markup text and a divider is a bare rule', () => {
  assert.deepEqual(section('*Hello*'), { type: 'section', text: { type: 'mrkdwn', text: '*Hello*' } });
  assert.deepEqual(divider(), { type: 'divider' });
  assert.throws(() => section(' '), /empty/);
  assert.throws(() => section('x'.repeat(LIMITS.text + 1)), /too long/);
});

test('text longer than a section may hold is split on line ends, and nothing is lost or invented', () => {
  const line = 'a line of the detail that is fairly long, '.repeat(5).trim();
  const text = Array.from({ length: 60 }, (_, at) => `${at}: ${line}`).join('\n');
  const blocks = sections(text);
  assert.ok(blocks.length > 1);
  for (const block of blocks) assert.ok(block.text.text.length <= LIMITS.text, String(block.text.text.length));
  assert.equal(blocks.map((block) => block.text.text).join('\n'), text);
});

test('one line longer than a section is split hard rather than refused, and blank text makes no block', () => {
  const blocks = sections('y'.repeat(LIMITS.text * 2 + 10));
  assert.equal(blocks.length, 3);
  assert.equal(blocks.map((block) => block.text.text).join(''), 'y'.repeat(LIMITS.text * 2 + 10));
  assert.deepEqual(sections(' \n\t '), []);
  assert.deepEqual(sections(''), []);
});

test('field columns are one section of labelled values, at most ten, none empty', () => {
  assert.deepEqual(fields(['*A*\n1', '*B*\n2']), {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: '*A*\n1' },
      { type: 'mrkdwn', text: '*B*\n2' },
    ],
  });
  assert.throws(() => fields([]), /between 1 and 10/);
  assert.throws(() => fields(Array.from({ length: 11 }, () => 'x')), /between 1 and 10/);
  assert.throws(() => fields(['ok', '  ']), /empty/);
  assert.throws(() => fields(['x'.repeat(LIMITS.field + 1)]), /too long/);
});

test('a context line is small text of at most ten elements, none empty', () => {
  assert.deepEqual(context('one', 'two'), {
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: 'one' },
      { type: 'mrkdwn', text: 'two' },
    ],
  });
  assert.throws(() => context(), /between 1 and 10/);
  assert.throws(() => context(''), /empty/);
});

test('preformatted text is fenced, escaped, and no content can close the fence early', () => {
  assert.equal(preformatted(['a  1', 'b 22']), '```\na  1\nb 22\n```');
  assert.equal(preformatted(['a < b & c']), '```\na &lt; b &amp; c\n```');
  const hostile = preformatted(['x```y']);
  assert.equal(hostile.match(/```/g).length, 2);
});

test('bold wraps text in Slack bold', () => {
  assert.equal(bold('Warnings: 2'), '*Warnings: 2*');
});

test('a message is the fallback text and its blocks, and the text is cut at the length Slack advises', () => {
  const blocks = [divider()];
  assert.deepEqual(message({ text: 'hello', blocks }), { text: 'hello', blocks });
  const long = message({ text: 'z'.repeat(LIMITS.fallback + 500), blocks }).text;
  assert.equal(long.length, LIMITS.fallback);
  assert.ok(long.endsWith('…'));
});

test('a message with no block or more blocks than Slack accepts is a bug, not a payload', () => {
  assert.throws(() => message({ text: 'x', blocks: [] }), /between 1 and 50/);
  assert.throws(() => message({ text: 'x', blocks: Array.from({ length: 51 }, () => divider()) }), /between 1 and 50/);
  assert.throws(() => message({ text: ' ', blocks: [divider()] }), /fallback text/);
});

test('a message is assembled from parts that each carry their blocks and their fallback lines, and an empty part adds nothing', () => {
  const one = { blocks: [section('one')], text: 'one' };
  const two = { blocks: [divider(), section('two')], text: 'two\nlines' };
  const none = { blocks: [], text: '' };
  assert.deepEqual(assemble(one, none, two), {
    text: 'one\n\ntwo\nlines',
    blocks: [section('one'), divider(), section('two')],
  });
  assert.throws(() => assemble(none), /between 1 and 50/);
});
