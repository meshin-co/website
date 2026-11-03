import assert from 'node:assert/strict';
import { test } from 'node:test';

import { siteBrand } from '../../scripts/site-brand.mjs';
import { buildOgTree, collectText } from './og-template.mjs';

const BRAND_TEXT = siteBrand().name;

test('collectText returns the eyebrow, title and footer text in order', () => {
  const tree = buildOgTree({
    eyebrow: 'Service',
    title: 'A Fixed-Fee AI Readiness Assessment',
    footer: 'A short page description under 155 characters.',
  });
  assert.deepEqual(collectText(tree), [
    'Service',
    'A Fixed-Fee AI Readiness Assessment',
    'A short page description under 155 characters.',
    BRAND_TEXT,
  ]);
});

test('a long title is carried through in full, not truncated', () => {
  const longTitle = 'Governance that survives procurement, the board and every vendor review that follows it, '
    .repeat(3)
    .trim();
  const tree = buildOgTree({ title: longTitle, footer: 'A short page description.' });
  assert.ok(collectText(tree).includes(longTitle));
});

test('an omitted eyebrow produces no empty text node', () => {
  const tree = buildOgTree({ title: 'A Title With No Eyebrow', footer: 'A short page description.' });
  assert.deepEqual(collectText(tree), ['A Title With No Eyebrow', 'A short page description.', BRAND_TEXT]);
  assert.ok(!collectText(tree).includes(''));
});

test('the root element carries the fixed 1200x630 canvas size', () => {
  const tree = buildOgTree({ title: 'A Title', footer: 'A short page description.' });
  assert.equal(tree.props.style.width, 1200);
  assert.equal(tree.props.style.height, 630);
});
