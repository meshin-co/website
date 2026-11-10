import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DUPLICATE_MINIMUM_WORDS } from './content-gate.mjs';
import { proseBlocks, proseSentences } from './entry-prose.mjs';
import { generatedSlugs } from './measure-sentence-band.mjs';
import { bandProblems, deriveBands, entryStats, loadCorpus, measureCorpus } from './sentence-band.mjs';

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

const FORMATS = [
  { format: 'article', collection: 'post' },
  { format: 'term', collection: 'glossary' },
];

const LIVE_ENTRIES = loadCorpus(REPO, { exclude: [] });
const LIVE_MEASURED = measureCorpus(LIVE_ENTRIES, { threshold: DUPLICATE_MINIMUM_WORDS });

test('each format band passes a typical hand-written entry of its format and at least four in five of them', () => {
  const bands = deriveBands(LIVE_MEASURED);
  for (const { format, collection } of FORMATS) {
    const band = bands[format];
    const measured = LIVE_ENTRIES.filter((live) => live.collection === collection)
      .map((live) => {
        const sentences = proseSentences(proseBlocks(live));
        return { id: live.id, sentences, median: entryStats({ sentences, band }).median };
      })
      .filter(({ sentences }) => sentences.length >= band.minimumSentences)
      .sort((a, b) => a.median - b.median || a.id.localeCompare(b.id));
    assert.ok(measured.length > 0, `the live corpus has ${format} entries long enough to measure`);
    const typical = measured[Math.floor(measured.length / 2)];
    assert.deepEqual(bandProblems({ sentences: typical.sentences, band }), [], typical.id);
    const passing = measured.filter(({ sentences }) => bandProblems({ sentences, band }).length === 0);
    assert.ok(
      passing.length / measured.length >= 0.8,
      `${passing.length} of ${measured.length} ${format} entries pass`
    );
  }
});
