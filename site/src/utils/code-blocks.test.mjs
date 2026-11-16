import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeStarryNight from 'rehype-starry-night';

import {
  COPIED_LABEL,
  COPY_ARIA_LABEL,
  COPY_FAILED_LABEL,
  COPY_LABEL,
  rehypeCodeBlocks,
  rehypeJsonBlocks,
} from './code-blocks.mjs';

const text = (value) => ({ type: 'text', value });
const element = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const root = (children) => ({ type: 'root', children });
const preOf = (source) => element('pre', {}, [element('code', {}, [text(source)])]);

test('every pre becomes a code block holding the pre, a hidden copy button and a status region', () => {
  const pre = preOf('npm test');
  const tree = root([pre]);

  rehypeCodeBlocks()(tree);

  const [block] = tree.children;
  assert.equal(block.tagName, 'div');
  assert.deepEqual(block.properties.className, ['code-block']);
  const [wrapped, button, status] = block.children;
  assert.equal(wrapped, pre);
  assert.equal(button.tagName, 'button');
  assert.equal(button.properties.type, 'button');
  assert.equal(button.properties.hidden, true);
  assert.equal(button.properties.ariaLabel, COPY_ARIA_LABEL);
  assert.equal(button.properties.dataDone, COPIED_LABEL);
  assert.equal(button.properties.dataFailed, COPY_FAILED_LABEL);
  assert.deepEqual(button.children, [text(COPY_LABEL)]);
  assert.equal(status.properties.role, 'status');
});

test('a pre nested in a quote is wrapped in place and no other node changes', () => {
  const paragraph = element('p', {}, [text('Run it.')]);
  const pre = preOf('make');
  const tree = root([element('blockquote', {}, [paragraph, pre])]);

  rehypeCodeBlocks()(tree);

  const [paragraphAfter, block] = tree.children[0].children;
  assert.equal(paragraphAfter, paragraph);
  assert.equal(block.properties.className[0], 'code-block');
  assert.equal(block.children[0], pre);
});

test('a document with no pre comes out as it went in', () => {
  const tree = root([element('p', {}, [text('Nothing to copy.')])]);
  const before = structuredClone(tree);

  rehypeCodeBlocks()(tree);

  assert.deepEqual(tree, before);
});

const render = async (markdown) => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    rehypePlugins: [rehypeJsonBlocks, rehypeStarryNight, rehypeCodeBlocks],
  });
  return (await processor.render(markdown)).code;
};

test('a fenced block is coloured by its language with classes and carries the copy control', async () => {
  const html = await render('```json\n{ "spec": "1.0", "ok": true }\n```');

  assert.match(html, /<code class="language-json">/);
  assert.match(html, /class="pl-ent"/);
  assert.match(html, /class="pl-c1"/);
  assert.match(html, /<div class="code-block"><pre>/);
  assert.match(html, /<button type="button" class="code-copy"[^>]* hidden/);
  assert.doesNotMatch(html, /style=/);
});

test('each language the site documents reaches the colour classes', async () => {
  const samples = {
    yaml: 'on: [push]\njobs:\n  eval:\n    runs-on: ubuntu-latest',
    bash: 'export PASS_RATE=95 && echo "ok"',
    ts: 'export const total: number = 42;',
    diff: '- old\n+ new',
  };
  for (const [language, source] of Object.entries(samples)) {
    const html = await render(`\`\`\`${language}\n${source}\n\`\`\``);
    assert.match(html, /class="pl-/, `${language} has no colour class`);
  }
});

test('a block with no language, or one nobody can colour, keeps its text and still gets the control', async () => {
  const html = await render('    indented\n\n```text\nplain\n```');

  assert.doesNotMatch(html, /class="pl-/);
  assert.equal(html.match(/class="code-block"/g)?.length, 2);
});

test('astro.config.ts labels JSON, then colours, then wraps, ahead of the other rehype plugins', async () => {
  const config = await readFile(new URL('../../astro.config.ts', import.meta.url), 'utf8');

  assert.match(config, /rehypePlugins:\s*\[\s*rehypeJsonBlocks,\s*rehypeStarryNight,\s*rehypeCodeBlocks,/);
});

const indented = (source) =>
  source
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

const HOLDS_JSON = {
  'an object': '{\n  "spec": "1.0",\n  "source": { "tool": "x" },\n  "ok": [true, null, 4]\n}',
  'an array': '[1, "two", { "three": 3 }]',
};

for (const [what, source] of Object.entries(HOLDS_JSON)) {
  test(`an unlabelled block that holds ${what} is labelled json and coloured`, async () => {
    const html = await render(`Before.\n\n${indented(source)}\n`);

    assert.match(html, /<code class="language-json">/);
    assert.match(html, /class="pl-/);
  });
}

test('a fence with no language is labelled the way an indented block is', async () => {
  const html = await render('```\n{ "a": 1 }\n```');

  assert.match(html, /<code class="language-json">/);
  assert.match(html, /class="pl-ent"/);
});

const REFUSED = {
  'a bare number': '42',
  'a bare string': '"text"',
  'a bare true': 'true',
  'a bare null': 'null',
  'a trailing comma': '{ "a": 1, }',
  'single quotes': "{ 'a': 1 }",
  'an unquoted key': '{ a: 1 }',
  'a document cut short': '{ "a": [1, 2',
  'a shell brace group': '{ echo hi; }',
  'a shell test': '[ -f file ] && echo yes',
  'a line of prose': 'The refusal prints the first line below.',
  'command line output': 'tool check --strict\nnote: "x": would fall by 0.25, from 1 to 0.75',
};

for (const [what, source] of Object.entries(REFUSED)) {
  test(`an unlabelled block that holds ${what} stays unlabelled and uncoloured`, async () => {
    const html = await render(`Before.\n\n${indented(source)}\n`);

    assert.match(html, /<code>/);
    assert.doesNotMatch(html, /language-|class="pl-/);
  });
}

test('inline code that holds JSON is not a block and is left alone', async () => {
  const html = await render('Write `{"a": 1}` here.');

  assert.doesNotMatch(html, /language-|class="pl-/);
});

for (const language of ['yaml', 'text', 'json']) {
  test(`a block already labelled ${language} is never relabelled, even when its body is JSON`, async () => {
    const html = await render(`\`\`\`${language}\n{ "a": 1 }\n\`\`\``);

    assert.match(html, new RegExp(`<code class="language-${language}">`));
    assert.equal(html.match(/language-/g)?.length, 1);
  });
}

test('a code element that carries another class keeps it and gains the json label', () => {
  const code = element('code', { className: ['wide'] }, [text('{ "a": 1 }')]);
  const tree = root([element('pre', {}, [code])]);

  rehypeJsonBlocks()(tree);

  assert.deepEqual(code.properties.className, ['wide', 'language-json']);
});
