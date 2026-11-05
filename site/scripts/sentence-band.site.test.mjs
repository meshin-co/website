import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DUPLICATE_MINIMUM_WORDS } from './content-gate.mjs';
import { generatedSlugs } from './measure-sentence-band.mjs';
import { loadCorpus, measureCorpus } from './sentence-band.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

const LIVE = measureCorpus(loadCorpus(REPO, { exclude: generatedSlugs(REPO) }), {
  threshold: DUPLICATE_MINIMUM_WORDS,
});
const within = (value, low, high) => value >= low && value <= high;

test('the extraction reproduces the hand-written corpus of each format as the owner measured it', () => {
  const { article, term } = LIVE.distribution;
  assert.ok(LIVE.corpus.article.entries >= 8 && LIVE.corpus.article.sentences >= 1400, JSON.stringify(LIVE.corpus));
  assert.ok(LIVE.corpus.term.entries >= 30 && LIVE.corpus.term.sentences >= 650, JSON.stringify(LIVE.corpus));
  assert.ok(within(article.pooled.sentenceWords.p5, 3, 6) && within(article.pooled.sentenceWords.p50, 12, 14));
  assert.ok(within(article.pooled.sentenceWords.p95, 22, 26) && within(article.pooled.shareBelowThreshold, 0.38, 0.47));
  assert.ok(within(article.pooled.shareJustBelow, 0.18, 0.25) && within(article.pooled.shareOneBelow, 0.04, 0.065));
  assert.ok(within(term.pooled.sentenceWords.p5, 5, 9) && within(term.pooled.sentenceWords.p50, 15, 17));
  assert.ok(within(term.pooled.sentenceWords.p95, 23, 27) && within(term.pooled.shareBelowThreshold, 0.2, 0.3));
  assert.ok(within(term.pooled.shareJustBelow, 0.15, 0.22) && within(term.pooled.shareOneBelow, 0.04, 0.065));
});
