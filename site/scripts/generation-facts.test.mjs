import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { bandFor, entryStats, readBandRecord } from './sentence-band.mjs';
import { bandOf, verifiedModel } from './generation-facts.mjs';
import { cleanDraft, claimFor } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { draftSentences } from './writer-preflight.mjs';

const roots = [];
after(() => roots.forEach(removeRepo));
const repo = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};

test('the model check names the vendor and the variable of the adapter and takes the rest from the verified model', async () => {
  const adapter = {
    id: 'openai',
    modelVariable: 'OPENAI_WRITING_MODEL',
    verifyModel: async () => ({ id: 'gpt-6.1-terra', shutdownDate: '2027-01-01', note: 'retires soon' }),
  };
  assert.deepEqual(await verifiedModel(adapter), {
    vendor: 'openai',
    modelVariable: 'OPENAI_WRITING_MODEL',
    model: 'gpt-6.1-terra',
    shutdownDate: '2027-01-01',
    note: 'retires soon',
  });
});

test('a model that fails verification is not swallowed', async () => {
  const adapter = {
    id: 'openai',
    modelVariable: 'OPENAI_WRITING_MODEL',
    verifyModel: async () => {
      throw new Error('the model is unknown');
    },
  };
  await assert.rejects(verifiedModel(adapter), /the model is unknown/);
});

test('the band of an entry is the limits of its format and the measurement of its own sentences', () => {
  const root = repo();
  const draft = cleanDraft('article');
  const claim = claimFor('article');
  const record = readBandRecord(root);
  const limits = bandFor(record, 'article');
  const sentences = draftSentences({ draft, claim });

  const band = bandOf({ repoRoot: root, claim, draft });

  assert.equal(band.measuredOn, record.measuredOn);
  assert.deepEqual(band.limits, limits);
  assert.deepEqual(band.measured, entryStats({ sentences, band: limits }));
});

test('the band follows the format of the claim', () => {
  const root = repo();
  const band = bandOf({ repoRoot: root, claim: claimFor('term'), draft: cleanDraft('term') });
  assert.equal(band.limits.format, 'term');
  assert.equal(band.measured.format, 'term');
});
