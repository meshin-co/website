import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';

import { GENERATED_BEGIN, GENERATED_END, generatedTitles } from './autowriter-claims.mjs';
import { siteBrand } from './site-brand.mjs';

test('the real generated layer is read whole: one title per route row, in every family the core names', () => {
  const doc = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');
  const block = doc.slice(doc.indexOf(GENERATED_BEGIN), doc.indexOf(GENERATED_END));
  const routeRows = block.split('\n').filter((line) => line.startsWith('| `'));
  const named = [...block.matchAll(/^### ([a-z-]+) \((\d+)\)/gm)].map(([, family, count]) => [family, Number(count)]);
  const rows = generatedTitles(doc);
  const suffix = titleSuffix(siteBrand());
  assert.equal(rows.length, routeRows.length);
  assert.ok(rows.length > 0, 'no title was read');
  assert.ok(
    rows.every(({ title }) => title.endsWith(suffix)),
    'a title lost its brand suffix'
  );
  assert.ok(named.length > 0, 'the core names no family');
  for (const [family, count] of named) {
    assert.equal(rows.filter((row) => row.family === family).length, count, `${family} titles read`);
  }
});
