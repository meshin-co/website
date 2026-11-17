import assert from 'node:assert/strict';
import { test } from 'node:test';

import { highlightedCode } from './highlight.mjs';

const SAMPLES = {
  json: '"spec": "1.0"',
  markdown: 'Cite [the page](https://example.com/page).',
  shell: 'echo "done"',
};

test('JSON comes back as one code element of spans carrying the classes the code stylesheet colours', async () => {
  const html = await highlightedCode('{ "tool": "promptfoo", "count": 4 }', 'json');

  assert.match(html, /^<code class="language-json">/);
  assert.match(html, /<\/code>$/);
  assert.match(html, /<span class="pl-ent">"tool"<\/span>/);
  assert.match(html, /<span class="pl-s">/);
  assert.match(html, /<span class="pl-c1">4<\/span>/);
});

for (const [language, source] of Object.entries(SAMPLES)) {
  test(`${language}, a language a call site names, reaches colour classes`, async () => {
    assert.match(await highlightedCode(source, language), /class="pl-/);
  });
}

for (const language of ['console', 'text', 'no-such-language']) {
  test(`${language} is refused by name, not coloured by a grammar that is not its own`, async () => {
    await assert.rejects(highlightedCode('x', language), new RegExp(language));
  });
}

test('the text of the block is what comes back once the tags are taken away', async () => {
  const source = '{\n  "a": [1, true, null],\n  "b": "x y"\n}';

  const html = await highlightedCode(source, 'json');

  assert.equal(html.replace(/<[^>]*>/g, ''), source);
});
