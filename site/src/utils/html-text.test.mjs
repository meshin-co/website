import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escapeHtmlText } from './html-text.mjs';

test('characters that break element text are escaped', () => {
  assert.equal(escapeHtmlText('AI Readiness & Risk Assessment'), 'AI Readiness &amp; Risk Assessment');
  assert.equal(escapeHtmlText('a < b > c'), 'a &lt; b &gt; c');
});

test('an already escaped entity is not escaped twice', () => {
  assert.equal(escapeHtmlText('Tom &amp; Jerry'), 'Tom &amp; Jerry');
  assert.equal(escapeHtmlText('caf&#233;'), 'caf&#233;');
});

test('text with nothing to escape is returned unchanged', () => {
  assert.equal(escapeHtmlText('Fractional Chief AI Officer'), 'Fractional Chief AI Officer');
});
