import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { getViteConfig } from 'astro/config';
import rehypeStarryNight from 'rehype-starry-night';

import { rehypeCodeBlocks } from './code-blocks.mjs';

const SITE = fileURLToPath(new URL('../../', import.meta.url));
const COMPONENT = '/src/components/site/CodeBlock.astro';
const CACHE = mkdtempSync(join(tmpdir(), 'code-block-'));

let server;
let render;

before(async () => {
  const { createServer } = await import(createRequire(import.meta.resolve('astro')).resolve('vite'));
  const config = await getViteConfig(
    { root: SITE, cacheDir: CACHE },
    { configFile: false, root: SITE, logLevel: 'silent' }
  )({ command: 'serve', mode: 'test' });
  server = await createServer({
    ...config,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { experimental_AstroContainer: AstroContainer } = await server.ssrLoadModule('astro/container');
  const { default: CodeBlock } = await server.ssrLoadModule(COMPONENT);
  const container = await AstroContainer.create();
  render = (props) => container.renderToString(CodeBlock, { props });
});

after(async () => {
  await server?.close();
  rmSync(CACHE, { recursive: true, force: true });
});

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#x3C;': '<', '&#x26;': '&' };
const decode = (html) => html.replace(/&(?:lt|gt|amp|quot|#39|#x3C|#x26);/g, (entity) => ENTITIES[entity]);
const preOf = (html) => /<pre>([\s\S]*?)<\/pre>/.exec(html)[1];
const tagNames = (fragment) => [...fragment.matchAll(/<\/?([a-z][a-z0-9-]*)/gi)].map(([, name]) => name.toLowerCase());
const visibleText = (fragment) => decode(fragment.replace(/<[^>]*>/g, ''));

test('a block given a language comes out as colour classes inside pre and code', async () => {
  const html = await render({ text: '{ "spec": "1.0", "ok": true }', language: 'json' });

  assert.match(html, /<pre><code class="language-json">/);
  assert.match(html, /<span class="pl-ent">"spec"<\/span>/);
  assert.match(html, /<span class="pl-c1">true<\/span>/);
});

test('a coloured block still carries the copy button, the status region and the class it was given', async () => {
  const html = await render({ text: '"spec": "1.0"', language: 'json', class: 'mt-3' });

  assert.match(html, /^<div class="code-block mt-3">/);
  assert.match(html, /<button type="button" class="code-copy"[^>]* hidden>Copy<\/button>/);
  assert.match(html, /<span class="sr-only" role="status"><\/span><\/div>$/);
});

test('a coloured block ships no style attribute', async () => {
  const html = await render({ text: '{ "spec": "1.0", "ok": true, "none": null }', language: 'json' });

  assert.match(html, /class="pl-/);
  assert.doesNotMatch(html, /style=/);
});

test('a block with no language renders as it always did: a bare pre, no code element, no colour class', async () => {
  const html = await render({ text: 'plain words, https://example.com/page' });

  assert.match(html, /^<div class="code-block"><pre>plain words, https:\/\/example\.com\/page<\/pre><button/);
  assert.doesNotMatch(html, /<code|pl-/);
});

test('a language the grammar set does not cover fails the render by name, so a typo cannot leave a block grey', async () => {
  await assert.rejects(render({ text: 'x', language: 'console' }), /console/);
});

const HOSTILE = [
  '<script>alert(1)</script>',
  '& &amp; &lt;b&gt; &#60; &unknown;',
  '</code></pre><button onclick="x">',
  '<!-- never closed',
  `"double" and 'single' and ]]> and \`tick\``,
].join('\n');

const HOSTILE_JSON = '{ "html": "<script>alert(1)</script>", "amp": "&amp;", "close": "</code></pre><img src=x>" }';

const HOSTILE_BLOCKS = {
  'no language': { text: HOSTILE },
  'a language that tokenises it': { text: HOSTILE_JSON, language: 'json' },
  'a language that cannot parse it': { text: HOSTILE, language: 'json' },
  'markdown, which reads angle brackets as raw HTML': { text: HOSTILE, language: 'markdown' },
};

for (const [what, props] of Object.entries(HOSTILE_BLOCKS)) {
  test(`text that looks like markup renders as visible characters, with ${what}`, async () => {
    const fragment = preOf(await render(props));

    const unexpected = tagNames(fragment).filter((name) => name !== 'code' && name !== 'span');
    assert.deepEqual(unexpected, [], 'a tag came out of the text');
    assert.equal(visibleText(fragment), props.text);
  });
}

const processorOf = () =>
  createMarkdownProcessor({ syntaxHighlight: false, rehypePlugins: [rehypeStarryNight, rehypeCodeBlocks] });

const PARITY = {
  json: '{\n  "spec": "1.0",\n  "source": { "tool": "x" },\n  "ok": [true, null, 4]\n}',
  markdown: 'Cite [the page](https://example.com/page) or *not*.',
  shell: 'export PASS_RATE=95 && echo "ok"',
};

for (const [language, text] of Object.entries(PARITY)) {
  test(`${language} is marked up by the component exactly as a Markdown fence marks it up`, async () => {
    const fence = (await (await processorOf()).render(`\`\`\`${language}\n${text}\n\`\`\``)).code;

    const block = await render({ text, language });

    assert.match(block, /class="pl-/);
    assert.equal(block, fence.replace('\n</code>', '</code>'));
  });
}
