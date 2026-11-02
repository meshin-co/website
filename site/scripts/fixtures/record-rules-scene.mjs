import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify } from 'yaml';

import { COLLECTION_OF, parseEntrySource, proseBlocks, proseSentences } from '../entry-prose.mjs';
import { buildRecord } from '../generation-record.mjs';
import { recordPath } from '../record-layout.mjs';
import { entryStats } from '../sentence-band.mjs';
import { recordInput } from './generation-input.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const CORPUS_DIRECTORIES = ['site/src/data/post', 'site/src/data/glossary'];
const BAND_PATH = 'audits/sentence-band.json';

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

const BAND = (format, medianFloor, medianCeiling, belowThresholdCap, justBelowCap) => ({
  format,
  threshold: 12,
  justBelowFrom: 8,
  minimumSentences: 8,
  medianFloor,
  medianCeiling,
  belowThresholdCap,
  justBelowCap,
});

export const BAND_RECORD = {
  schema: 1,
  measuredOn: '2026-11-02',
  threshold: 12,
  minimumSentences: 8,
  bands: { article: BAND('article', 10, 15, 0.5779, 0.2907), term: BAND('term', 13, 19, 0.381, 0.2942) },
};

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

export function realBandFiles() {
  const files = { [BAND_PATH]: readFileSync(join(REPO, BAND_PATH), 'utf8') };
  for (const directory of CORPUS_DIRECTORIES) {
    if (!existsSync(join(REPO, directory))) continue;
    for (const name of readdirSync(join(REPO, directory)).filter((file) => file.endsWith('.md')))
      files[`${directory}/${name}`] = readFileSync(join(REPO, directory, name), 'utf8');
  }
  return files;
}
