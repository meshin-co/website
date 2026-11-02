import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderMarkdown } from './writer-markdown.mjs';

const html = (markdown) => renderMarkdown(markdown).replace(/\n/g, '');

test('consecutive lines make one paragraph and a blank line starts the next', () => {
  assert.equal(html('One line\nstill one.\n\nSecond.'), '<p>One line still one.</p><p>Second.</p>');
});

test('an empty body renders nothing', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown('\n\n  \n'), '');
});

test('headings keep their level and their inline markup', () => {
  assert.equal(html('## Why **now**?\n\n### Next'), '<h2>Why <strong>now</strong>?</h2><h3>Next</h3>');
  assert.equal(html('# Title'), '<h1>Title</h1>');
});

test('bullet and numbered lists become one list each, and an indented line continues its item', () => {
  assert.equal(
    html('- one\n- two\n  more\n\n1. first\n2) second'),
    '<ul><li>one</li><li>two more</li></ul><ol><li>first</li><li>second</li></ol>'
  );
});

test('a table has a header row, a body and cells with inline markup', () => {
  const table = '| Owner | Step |\n| --- | :-: |\n| Ops | Page the **owner** |\n| Legal | Tell the customer |';
  assert.equal(
    html(table),
    '<table><thead><tr><th>Owner</th><th>Step</th></tr></thead><tbody>' +
      '<tr><td>Ops</td><td>Page the <strong>owner</strong></td></tr>' +
      '<tr><td>Legal</td><td>Tell the customer</td></tr></tbody></table>'
  );
});

test('a pipe line with no separator row under it is a paragraph, not a table', () => {
  assert.equal(html('| a | b |\nplain'), '<p>| a | b | plain</p>');
});

test('inline markup: emphasis, code, links, autolinks and images', () => {
  assert.equal(
    html('A *soft* and __hard__ point with `code`.'),
    '<p>A <em>soft</em> and <strong>hard</strong> point with <code>code</code>.</p>'
  );
  assert.equal(
    html('See [the register](/glossary/ai-register#x) and <https://nist.gov/a>.'),
    '<p>See <a href="/glossary/ai-register#x">the register</a> and <a href="https://nist.gov/a">https://nist.gov/a</a>.</p>'
  );
  assert.equal(html('![alt text](/img/a.png)'), '<p><img alt="alt text" src="/img/a.png"></p>');
});

test('underscores inside a word are not emphasis', () => {
  assert.equal(html('snake_case_name and a_b'), '<p>snake_case_name and a_b</p>');
});

test('raw html and entities are escaped so the page model sees text, not tags', () => {
  assert.equal(
    html('<script>x</script> & <b>y</b>'),
    '<p>&lt;script&gt;x&lt;/script&gt; &amp; &lt;b&gt;y&lt;/b&gt;</p>'
  );
});

test('a fenced block is kept as code, escaped and never parsed', () => {
  const fenced = '```yaml\nowner: *ops*\n- not a list\n```\n\nAfter.';
  assert.equal(html(fenced), '<pre><code>owner: *ops*\n- not a list</code></pre><p>After.</p>'.replace(/\n/g, ''));
  assert.equal(renderMarkdown(fenced).split('\n')[0], '<pre><code>owner: *ops*');
});

test('a block quote wraps its lines in one paragraph and a rule is a rule', () => {
  assert.equal(
    html('> quoted line\n> more\n\n---\n\nAfter'),
    '<blockquote><p>quoted line more</p></blockquote><hr><p>After</p>'
  );
});

test('a list item that opens with bold keeps the bold element first, as the bolded-lead rule reads it', () => {
  assert.match(html('- **Owner:** ops'), /^<ul><li><strong>Owner:<\/strong> ops<\/li><\/ul>$/);
});

test('windows line endings render like unix ones', () => {
  assert.equal(html('A\r\n\r\nB'), '<p>A</p><p>B</p>');
});
