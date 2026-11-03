import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockKitProblems } from './block-kit.mjs';

const text = (value, type = 'mrkdwn') => ({ type, text: value });
const section = (value) => ({ type: 'section', text: text(value) });
const valid = () => ({
  text: 'fallback',
  blocks: [
    { type: 'header', text: text('Title', 'plain_text') },
    section('*bold* and <https://x.test/a?b=1&amp;c=2|a link> and 1 &lt; 2'),
    { type: 'divider' },
    { type: 'section', fields: [text('*A*\n1'), text('*B*\n2')] },
    { type: 'context', elements: [text('small')] },
  ],
});
const problemsWith = (change) => {
  const message = valid();
  change(message);
  return blockKitProblems(message).join(' | ');
};

test('a message that follows the Block Kit limits has no problem', () => {
  assert.deepEqual(blockKitProblems(valid()), []);
});

const SPECIMENS = [
  ['no fallback text', (m) => (m.text = ''), /fallback text/],
  ['a fallback text over 4000', (m) => (m.text = 'x'.repeat(4001)), /fallback text/],
  ['no block', (m) => (m.blocks = []), /1 to 50 blocks/],
  ['fifty-one blocks', (m) => (m.blocks = Array.from({ length: 51 }, () => ({ type: 'divider' }))), /1 to 50 blocks/],
  ['a key Slack does not know at the top', (m) => (m.channel = '#x'), /unknown key channel/],
  ['a block type this pipeline never sends', (m) => m.blocks.push({ type: 'actions', elements: [] }), /type actions/],
  ['a header of markup text', (m) => (m.blocks[0].text = text('Title')), /header.*plain_text/],
  ['a header over 150', (m) => (m.blocks[0].text = text('x'.repeat(151), 'plain_text')), /header.*150/],
  ['an empty header', (m) => (m.blocks[0].text = text('', 'plain_text')), /header.*empty/],
  ['a section with no text and no fields', (m) => (m.blocks[1] = { type: 'section' }), /text or fields/],
  ['a section over 3000', (m) => (m.blocks[1] = section('x'.repeat(3001))), /3000/],
  ['eleven fields', (m) => (m.blocks[3].fields = Array.from({ length: 11 }, () => text('f'))), /1 to 10 fields/],
  ['a field over 2000', (m) => (m.blocks[3].fields = [text('f'.repeat(2001))]), /2000/],
  ['an empty field', (m) => (m.blocks[3].fields = [text('')]), /empty/],
  ['eleven context elements', (m) => (m.blocks[4].elements = Array.from({ length: 11 }, () => text('c'))), /1 to 10/],
  ['an empty context element', (m) => (m.blocks[4].elements = [text(' ')]), /empty/],
  ['a divider with a text', (m) => (m.blocks[2] = { type: 'divider', text: text('x') }), /unknown key text/],
  ['an unescaped angle bracket', (m) => (m.blocks[1] = section('a <!channel> b')), /unescaped/],
  ['a lone greater-than', (m) => (m.blocks[1] = section('a > b')), /unescaped/],
  ['an unescaped ampersand', (m) => (m.blocks[1] = section('fish & chips')), /unescaped &/],
  ['an unescaped ampersand in a link', (m) => (m.blocks[1] = section('<https://x.test/?a=1&b=2|l>')), /unescaped &/],
  ['a code fence that never closes', (m) => (m.blocks[1] = section('```\nx')), /code fence/],
  ['markup text typed as something else', (m) => (m.blocks[1].text = text('x', 'html')), /type html/],
];

for (const [name, change, expected] of SPECIMENS)
  test(`a planted specimen is caught: ${name}`, () => {
    assert.match(problemsWith(change), expected);
  });
