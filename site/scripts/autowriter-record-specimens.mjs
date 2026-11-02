import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ELEVEN_WORD_SENTENCE,
  ENTRY_PATH,
  RECORD_PATH,
  asJson,
  entryText,
  recordWith,
} from './fixtures/record-rules-scene.mjs';

const GATE = 'gate:autowriter';
const BAND_PATH = '../audits/sentence-band.json';

const elevenWordEntry = () => entryText({ sentences: Array(10).fill(ELEVEN_WORD_SENTENCE) });

async function plantScene(addUntrackedFile, copySite, { record, entry = entryText() }) {
  const restoreRecord = await addUntrackedFile(join(copySite, '..', RECORD_PATH), asJson(record));
  try {
    const restoreEntry = await addUntrackedFile(join(copySite, '..', ENTRY_PATH), entry);
    return async () => {
      await restoreEntry();
      await restoreRecord();
    };
  } catch (error) {
    await restoreRecord();
    throw error;
  }
}

const committedBand = async (copySite) => JSON.parse(await readFile(join(copySite, BAND_PATH), 'utf8'));

const planScene = (addUntrackedFile, scene) => async (copySite) =>
  plantScene(addUntrackedFile, copySite, scene(await committedBand(copySite)));

const offSchema = (band) => ({ record: { ...recordWith({ band }), schema: 2 } });

const withoutBand = (band) => ({
  record: Object.fromEntries(Object.entries(recordWith({ band })).filter(([key]) => key !== 'band')),
});

const withoutFactRow = (band) => {
  const [, ...rows] = recordWith({ band }).claimTable;
  return { record: recordWith({ band, claimTable: rows }) };
};

const elevenWordProse = (band) => {
  const entry = elevenWordEntry();
  return { entry, record: recordWith({ band, claimTable: [], entry }) };
};

const zeroedMeasurement = (band) => {
  const record = recordWith({ band });
  record.band.measured = {
    ...record.band.measured,
    sentences: 0,
    median: 0,
    shareBelowThreshold: 0,
    shareJustBelow: 0,
  };
  return { record };
};

const bumpBandLimit = (text) => {
  const record = JSON.parse(text);
  record.bands.article.medianFloor += 1;
  return asJson(record);
};

const addCorpusEntry = (text) => {
  const record = JSON.parse(text);
  record.corpus.article.entries += 1;
  return asJson(record);
};

const driftDistribution = (text) => {
  const record = JSON.parse(text);
  record.distribution.article.pooled.shareBelowThreshold += 0.01;
  return asJson(record);
};

export const recordSpecimens = ({ addUntrackedFile, editFile }) => ({
  autowriterGenerationOffSchema: {
    gate: GATE,
    token: `generation-schema ${RECORD_PATH}: schema must equal 1`,
    plant: planScene(addUntrackedFile, offSchema),
  },
  autowriterGenerationWithoutBand: {
    gate: GATE,
    token: `generation-schema ${RECORD_PATH}: band is required`,
    plant: planScene(addUntrackedFile, withoutBand),
  },
  autowriterFactWithoutClaimRow: {
    gate: GATE,
    token: `fact-unbound ${RECORD_PATH}`,
    plant: planScene(addUntrackedFile, withoutFactRow),
  },
  autowriterProseOffTheBand: {
    gate: GATE,
    token: `below-threshold-share ${RECORD_PATH}`,
    plant: planScene(addUntrackedFile, elevenWordProse),
  },
  autowriterBandMeasurementForged: {
    gate: GATE,
    token: `band-measurement-differs ${RECORD_PATH}`,
    plant: planScene(addUntrackedFile, zeroedMeasurement),
  },
  autowriterBandRecordStale: {
    gate: GATE,
    token: 'record-bands-stale audits/sentence-band.json',
    plant: (copySite) => editFile(join(copySite, BAND_PATH), bumpBandLimit),
  },
  autowriterBandRecordDistributionDrifted: {
    gate: GATE,
    token: 'record-distribution-stale audits/sentence-band.json',
    plant: (copySite) => editFile(join(copySite, BAND_PATH), driftDistribution),
  },
  autowriterBandRecordCorpusDrifted: {
    gate: GATE,
    token: 'record-corpus-stale audits/sentence-band.json',
    plant: (copySite) => editFile(join(copySite, BAND_PATH), addCorpusEntry),
  },
});
