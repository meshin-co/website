import { bandFor, entryStats, readBandRecord } from './sentence-band.mjs';
import { draftSentences } from './writer-preflight.mjs';

export async function verifiedModel(adapter) {
  const checked = await adapter.verifyModel();
  return {
    vendor: adapter.id,
    modelVariable: adapter.modelVariable,
    model: checked.id,
    shutdownDate: checked.shutdownDate,
    note: checked.note,
  };
}

export function bandOf({ repoRoot, claim, draft }) {
  const record = readBandRecord(repoRoot);
  const limits = bandFor(record, claim.format);
  const sentences = draftSentences({ draft, claim });
  return { measuredOn: record.measuredOn, limits, measured: entryStats({ sentences, band: limits }) };
}
