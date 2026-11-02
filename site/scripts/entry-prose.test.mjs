import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { COLLECTION_OF, parseEntrySource, proseBlocks, proseSentences, wordCount } from './entry-prose.mjs';

const DATA = fileURLToPath(new URL('../src/data/', import.meta.url));

const bodyBlocks = (body) => proseBlocks({ collection: 'glossary', frontmatter: {}, body });

test('each writer format maps to the collection its entries live in', () => {
  assert.deepEqual(COLLECTION_OF, { term: 'glossary', article: 'post' });
});

test('a post contributes its short answer, full answer, takeaways and FAQ answers before the body', () => {
  const frontmatter = {
    title: 'A title that is not prose',
    description: 'A description that is not prose.',
    shortAnswer: 'The short answer.',
    fullAnswer: 'First full paragraph.\n\nSecond full paragraph.',
    keyTakeaways: ['First takeaway.', 'Second takeaway.'],
    faq: [
      { q: 'A question?', a: 'First answer.' },
      { q: 'Another question?', a: 'Second answer.' },
    ],
    tags: ['one-tag'],
    category: 'governance',
  };
  assert.deepEqual(proseBlocks({ collection: 'post', frontmatter, body: 'Body paragraph.' }), [
    'The short answer.',
    'First full paragraph.',
    'Second full paragraph.',
    'First takeaway.',
    'Second takeaway.',
    'First answer.',
    'Second answer.',
    'Body paragraph.',
  ]);
});

test('a glossary term contributes its short definition and each definition paragraph before the body', () => {
  const frontmatter = {
    title: 'What is a model card?',
    term: 'model card',
    description: 'Not prose here.',
    shortDefinition: 'A model card is a short record.',
    definition: 'First paragraph of the definition.\n\nSecond paragraph of the definition.',
    relatedTerms: ['evals'],
  };
  const body = '## Why it comes up\n\nIt comes up often.';
  assert.deepEqual(proseBlocks({ collection: 'glossary', frontmatter, body }), [
    'A model card is a short record.',
    'First paragraph of the definition.',
    'Second paragraph of the definition.',
    'It comes up often.',
  ]);
});

test('the FAQ collection has no prose fields, because the writer never writes a FAQ answer', () => {
  const frontmatter = { question: 'Who owns the code?', answer: 'You do. It is written down.' };
  assert.throws(() => proseBlocks({ collection: 'faq', frontmatter, body: '' }), /"faq"/);
});

test('front matter that leaves out optional prose fields is read without error', () => {
  const frontmatter = { fullAnswer: 'Only this.', faq: null };
  assert.deepEqual(proseBlocks({ collection: 'post', frontmatter, body: '' }), ['Only this.']);
});

test('the prose fields of a collection are exactly the prefix of the full block list', () => {
  const fields = { shortDefinition: 'Fields come first.' };
  const prefix = proseBlocks({ collection: 'glossary', frontmatter: fields, body: '' });
  const full = proseBlocks({ collection: 'glossary', frontmatter: fields, body: 'Then the body.' });
  assert.deepEqual(full.slice(0, prefix.length), prefix);
  assert.deepEqual(full.slice(prefix.length), ['Then the body.']);
});

test('front-matter prose goes through the same markdown reduction as the body', () => {
  const frontmatter = { shortDefinition: 'See [the register](/glossary/ai-register) and **both** rules.' };
  assert.deepEqual(proseBlocks({ collection: 'glossary', frontmatter, body: '' }), [
    'See the register and both rules.',
  ]);
});

test('a collection with no defined prose fields is refused by name', () => {
  assert.throws(() => proseBlocks({ collection: 'service', frontmatter: {}, body: 'Text.' }), /"service"/);
});

test('soft-wrapped lines join into one paragraph and blank lines separate paragraphs', () => {
  assert.deepEqual(bodyBlocks('First line of one\nparagraph that wraps.\n\nSecond paragraph.\n'), [
    'First line of one paragraph that wraps.',
    'Second paragraph.',
  ]);
});

test('headings and horizontal rules are dropped and end the paragraph before them', () => {
  const body = 'Intro text.\n## A heading\nText right after.\n\n---\n\n###### Deep heading\n\n* * *\n\nLast text.';
  assert.deepEqual(bodyBlocks(body), ['Intro text.', 'Text right after.', 'Last text.']);
});

test('fenced code is dropped, tilde fences too, and an unterminated fence drops the rest', () => {
  const closed = 'Before.\n\n```js\nconst x = 1.\nSecond line.\n```\n\nBetween.\n\n~~~\ncode.\n~~~\n\nAfter.';
  assert.deepEqual(bodyBlocks(closed), ['Before.', 'Between.', 'After.']);
  assert.deepEqual(bodyBlocks('Kept.\n\n```\nnever closed.\n\nstill code.'), ['Kept.']);
});

test('table cells are separate blocks and the separator row is dropped', () => {
  const table = [
    '| Condition | Meaning |',
    '| :-- | --: |',
    '| An owner. | One named person. |',
    '| A metric. | One number. |',
  ].join('\n');
  assert.deepEqual(bodyBlocks(`Lead-in.\n\n${table}\n\nAfter the table.`), [
    'Lead-in.',
    'Condition',
    'Meaning',
    'An owner.',
    'One named person.',
    'A metric.',
    'One number.',
    'After the table.',
  ]);
});

test('an empty cell yields no block and an escaped pipe stays inside its cell', () => {
  assert.deepEqual(bodyBlocks('| a \\| b | |\n| --- | --- |'), ['a | b']);
});

test('every list item is its own block whatever the marker, and a wrapped item stays whole', () => {
  const list = [
    '- First item.',
    '* Second item',
    '  that wraps.',
    '+ Third item.',
    '1. Numbered item.',
    '2) Another numbered item.',
    '    - Nested item.',
  ].join('\n');
  assert.deepEqual(bodyBlocks(list), [
    'First item.',
    'Second item that wraps.',
    'Third item.',
    'Numbered item.',
    'Another numbered item.',
    'Nested item.',
  ]);
});

test('a paragraph that opens with bold text is not mistaken for a list item', () => {
  assert.deepEqual(bodyBlocks('**Note.** The rest follows.'), ['Note. The rest follows.']);
});

test('blockquote markers are stripped and the quoted text is kept', () => {
  assert.deepEqual(bodyBlocks('> Quoted line one\n> continues here.\n>\n> > Nested quote.\n\nPlain.'), [
    'Quoted line one continues here.',
    'Nested quote.',
    'Plain.',
  ]);
});

test('inline markdown reduces to the visible text', () => {
  const cases = [
    ['See [the register](/glossary/ai-register) first.', 'See the register first.'],
    ['See [NIST](https://en.wikipedia.org/wiki/NIST_(agency)) first.', 'See NIST first.'],
    ['A [reference link][ref] works.', 'A reference link works.'],
    ['An image ![alt text](/a.png) vanishes.', 'An image vanishes.'],
    [
      'Use `code` and **bold** and *italic* and _more italic_ and ~~gone~~.',
      'Use code and bold and italic and more italic and gone.',
    ],
    ['Footnote\\* appears.', 'Footnote* appears.'],
    ['Visit <https://example.com/a> now.', 'Visit https://example.com/a now.'],
  ];
  for (const [markdown, visible] of cases) assert.deepEqual(bodyBlocks(markdown), [visible], markdown);
});

test('snake_case words, spaced asterisks and a bare less-than sign are left alone', () => {
  const text = 'The snake_case_name and 2 * 3 * 4 and a < b stay.';
  assert.deepEqual(bodyBlocks(text), [text]);
});

test('html comments and tags are removed and a line break separates words', () => {
  const body = [
    'Text <!-- hidden',
    'across lines --> stays.',
    '',
    '<div class="note">Inside <strong>bold</strong> html.<br>Next line.</div>',
    '',
    '<hr>',
  ].join('\n');
  assert.deepEqual(bodyBlocks(body), ['Text stays.', 'Inside bold html. Next line.']);
});

test('a block that reduces to nothing is not kept', () => {
  assert.deepEqual(bodyBlocks('![only an image](/a.png)\n\n<span class="x"></span>\n\nKept.'), ['Kept.']);
});

test('sentences come from each block alone, so an unterminated block never merges into the next', () => {
  assert.deepEqual(proseSentences(['Owner', 'One two three. Four five?', 'It costs approx. 3.5 days. Done.']), [
    'Owner',
    'One two three.',
    'Four five?',
    'It costs approx. 3.5 days.',
    'Done.',
  ]);
});

test('words are whitespace-separated tokens, as the duplicate-sentence rule counts them', () => {
  assert.equal(wordCount('  Two   words\there. '), 3);
  assert.equal(wordCount(''), 0);
});

test('an entry source splits into parsed front matter and the markdown body', () => {
  const raw =
    '---\ntitle: A title\ncount: 3\nlist:\n  - one\n  - two\ntext: |\n  First.\n\n  Second.\n---\n\nBody text.\n';
  assert.deepEqual(parseEntrySource(raw), {
    frontmatter: { title: 'A title', count: 3, list: ['one', 'two'], text: 'First.\n\nSecond.\n' },
    body: '\nBody text.\n',
  });
});

test('a source with only front matter has an empty body, and Windows line endings are read', () => {
  assert.deepEqual(parseEntrySource('---\r\nterm: Why\r\n---\r\n'), { frontmatter: { term: 'Why' }, body: '' });
});

test('a front matter block with nothing in it reads as an empty object', () => {
  assert.deepEqual(parseEntrySource('---\n\n---\nBody text.\n'), { frontmatter: {}, body: 'Body text.\n' });
});

test('a source with no front matter block is refused', () => {
  assert.throws(() => parseEntrySource('Just some text.'), /front matter/);
});

const liveEntries = () =>
  Object.values(COLLECTION_OF).flatMap((collection) =>
    readdirSync(join(DATA, collection))
      .filter((name) => name.endsWith('.md'))
      .map((name) => ({ collection, name, ...parseEntrySource(readFileSync(join(DATA, collection, name), 'utf8')) }))
  );

test('every live entry yields sentences and no block of it carries markdown', () => {
  const markup = /\]\(|\*\*|`|<\/?[a-z]|^(?:#|\||>|[-*+]\s|\d+[.)]\s)|\|$/i;
  const entries = liveEntries();
  assert.deepEqual(new Set(entries.map((entry) => entry.collection)), new Set(['post', 'glossary']));
  for (const entry of entries) {
    const blocks = proseBlocks(entry);
    assert.ok(proseSentences(blocks).length > 0, `${entry.collection}/${entry.name} has no sentences`);
    for (const block of blocks)
      assert.doesNotMatch(block, markup, `${entry.collection}/${entry.name}: ${block.slice(0, 60)}`);
  }
});
