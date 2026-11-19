import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectionRows, componentRows, constantRows } from './editorial-inventory.mjs';

const ENGLISH = [
  'Customers can return the item within thirty days of delivery.',
  'Return to the old process only when a named owner agrees.',
  'You may return the item; we refund the full price within ten days.',
  'The page should say what would cause the work to stop or return for review.',
];

const EXTRACTORS = {
  'a string constant': (text) => constantRows([{ file: 'x.mjs', source: `note: ${JSON.stringify(text)},` }]),
  'a text node': (text) => componentRows([{ file: 'x.astro', source: `<p>${text}</p>` }]),
  'a prose attribute': (text) => componentRows([{ file: 'x.astro', source: `<Section lead="${text}" />` }]),
  'a frontmatter field': (text) => collectionRows([{ file: 'x.md', frontmatter: { shortAnswer: text }, body: '' }]),
};

for (const [where, extract] of Object.entries(EXTRACTORS)) {
  test(`a sentence that holds the word return is copy in ${where}`, () => {
    for (const sentence of ENGLISH) {
      assert.deepEqual(
        extract(sentence).map((row) => row.text),
        [sentence]
      );
    }
  });
}

const CODE = [
  '(!og) return undefined;',
  'if (!imageUrl) return undefined;',
  'if (done) return;',
  'if (done) { return; }',
  'return slug;',
];

for (const [where, extract] of Object.entries(EXTRACTORS)) {
  test(`a return statement is still code in ${where}`, () => {
    for (const fragment of CODE) {
      assert.deepEqual(extract(fragment), [], fragment);
    }
  });
}

test('a return statement caught between braces in a string constant is still code', () => {
  const rows = constantRows([
    { file: 'permalinks.ts', source: "javascript: ') ) { return slug; } switch (type) { case'" },
  ]);
  assert.deepEqual(rows, []);
});

test('the sentence of a published answer that held the word return is in the inventory', () => {
  const rows = collectionRows([
    {
      file: 'src/data/post/board-memo-ai-strategy-one-page.md',
      frontmatter: {
        fullAnswer:
          'The page should still stand on its own: a director should be able to see who owns delivery, what spending is requested and what would cause the work to stop or return for review.',
      },
      body: '',
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.location),
    ['frontmatter.fullAnswer']
  );
});
