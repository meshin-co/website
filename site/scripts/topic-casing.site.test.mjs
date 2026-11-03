import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { casedForms, casingTexts, restoreCase } from './topic-casing.mjs';

test('the committed core restores the casing of a Search Console query', () => {
  const core = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');
  const forms = casedForms(casingTexts(core));
  assert.equal(restoreCase('what is the eu ai act', forms), 'what is the EU AI act');
  for (const token of ['ai', 'eu', 'nist']) assert.equal(forms.get(token), token.toUpperCase());
});
