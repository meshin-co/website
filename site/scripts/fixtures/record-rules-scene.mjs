import { stringify } from 'yaml';

import { DUPLICATE_MINIMUM_WORDS } from '../content-gate.mjs';
import { COLLECTION_OF, parseEntrySource, proseBlocks, proseSentences } from '../entry-prose.mjs';
import { buildRecord } from '../generation-record.mjs';
import { recordPath } from '../record-layout.mjs';
import { BAND_FILE, bandRecord, deriveBands, entryStats, measureCorpus } from '../sentence-band.mjs';
import { DATA_DIRECTORY } from '../writer-tree.mjs';
import { recordInput } from './generation-input.mjs';

export const SLUG = 'zz-specimen';
export const RECORD_PATH = recordPath('generation', SLUG, recordInput().claim.claimedAt);
export const ENTRY_PATH = `audits/autowriter/generations/${SLUG}.md`;
export const NIST_URL = 'https://www.nist.gov/itl/ai-risk-management-framework';
export const FACT =
  'The framework was released in January and it names four functions for managing the risk of a model.';
export const ELEVEN_WORD_SENTENCE = 'The register lists each model with its owner and its version.';

const FILLER = [
  'Every owner should write down what the model does and who answers for it.',
  'A register that nobody reads is only a list, so name a reader.',
  'The first row should describe the model that touches customer data most often.',
  'A short entry that names its owner beats a long one that names nobody.',
  'Reviewers ask the same questions each quarter, so the register should hold the answers.',
  'When a vendor changes a model without notice, the register shows the change.',
  'Teams that keep the register next to the code find the rows stay current.',
  'Nobody should read the whole register before approving one small change to a row.',
];

export const SENTENCES = [FACT, ...FILLER];

export const proseOf = (text) => {
  const { frontmatter, body } = parseEntrySource(text);
  return proseSentences(proseBlocks({ collection: COLLECTION_OF.article, frontmatter, body }));
};

const SOURCES = [{ title: 'NIST AI RMF', url: NIST_URL, publisher: 'NIST', retrieved: '2026-11-02' }];

export function entryText({ sentences = SENTENCES } = {}) {
  const [shortAnswer, fullAnswer, ...body] = sentences;
  const frontmatter = { title: 'A scratch entry', shortAnswer, fullAnswer, sources: SOURCES };
  return `---\n${stringify(frontmatter)}---\n\n${body.join('\n\n')}\n`;
}

const TABLE = [
  {
    sentence: FACT,
    marker: 'sourced',
    source: { id: 'S1', title: 'NIST AI RMF', url: NIST_URL },
    span: 'names four functions',
  },
  { sentence: FILLER[0], marker: 'own-reading', source: null, span: null },
];

export function recordWith({ path = ENTRY_PATH, claimTable = TABLE, entry = entryText(), band = BAND_RECORD } = {}) {
  const input = recordInput();
  const limits = band.bands.article;
  return buildRecord({
    ...input,
    claim: { ...input.claim, slug: SLUG },
    route: `/blog/${SLUG}`,
    entryPath: path,
    files: [path, RECORD_PATH],
    claimTable,
    band: {
      measuredOn: band.measuredOn,
      limits,
      measured: entryStats({ sentences: proseOf(entry), band: limits }),
    },
  });
}

export const asJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const sentenceOf = (words) => `${Array(words).fill('word').join(' ')}.`;
const runs = (...spans) => spans.flatMap(([count, words]) => Array(count).fill(words));

const SCENE_PROFILES = {
  'zz-band-low': runs([6, 5], [5, 10], [9, 14]),
  'zz-band-high': runs([9, 15]),
};

const termText = ([shortDefinition, definition, ...body]) =>
  `---\n${stringify({ title: 'A scratch term', shortDefinition, definition })}---\n\n${body.join('\n\n')}\n`;

const SCENE_TEXT = {
  [COLLECTION_OF.article]: (sentences) => entryText({ sentences }),
  [COLLECTION_OF.term]: termText,
};

const SCENE_CORPUS = Object.entries(SCENE_TEXT).flatMap(([collection, render]) =>
  Object.entries(SCENE_PROFILES).map(([slug, lengths]) => ({
    collection,
    path: `${DATA_DIRECTORY}/${collection}/${slug}.md`,
    text: render(lengths.map(sentenceOf)),
  }))
);

const sceneMeasure = measureCorpus(
  SCENE_CORPUS.map(({ collection, text: source }) => ({ collection, ...parseEntrySource(source) })),
  { threshold: DUPLICATE_MINIMUM_WORDS }
);

export const BAND_RECORD = bandRecord({
  measure: sceneMeasure,
  bands: deriveBands(sceneMeasure),
  measuredOn: '2026-11-02',
});

export const bandSceneFiles = () => ({
  [BAND_FILE]: asJson(BAND_RECORD),
  ...Object.fromEntries(SCENE_CORPUS.map(({ path: file, text: source }) => [file, source])),
});
