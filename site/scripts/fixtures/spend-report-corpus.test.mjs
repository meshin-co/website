import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateLedger } from '../autowriter-ledger.mjs';
import { describeProblem } from '../autowriter-records.mjs';
import { validateRecord } from '../generation-record.mjs';
import {
  filesOf,
  ledgerOf,
  ledgerPath,
  mergedLedger,
  recordOf,
  recordPath,
  stoppedLedger,
  writingCall,
} from './spend-report-corpus.mjs';

const AT = '2026-11-02T07:00:00.000Z';
const readable = (problems) => problems.map(describeProblem);

test('an article record and a term record pass the real record validator', () => {
  assert.deepEqual(readable(validateRecord(recordOf({ slug: 'a-post', at: AT }))), []);
  assert.deepEqual(readable(validateRecord(recordOf({ slug: 'a-term', format: 'term', at: AT }))), []);
});

test('a term record names the ledger of the post it was written beside, and keeps its own slug and format', () => {
  const term = recordOf({ slug: 'a-term', format: 'term', ledgerSlug: 'a-post', at: AT });
  assert.equal(term.ledger, ledgerPath('a-post'));
  assert.equal(term.slug, 'a-term');
  assert.equal(term.entry.format, 'term');
  assert.ok(term.files.includes(term.entry.path));
});

test('the run id and the instant of a record are the ones asked for', () => {
  const record = recordOf({ slug: 'a-post', at: AT, runId: 'run-9' });
  assert.equal(record.runId, 'run-9');
  assert.equal(record.generatedAt, AT);
});

test('a call keeps the model, the price and a cost the validator accepts, for any price', () => {
  const price = { inputPerMillion: 0.15, outputPerMillion: 0.6 };
  const call = writingCall({ input: 12345, output: 678, price, model: 'other-model', tag: 'x' });
  assert.equal(call.resolvedModel, 'other-model');
  assert.deepEqual(call.price, price);
  assert.deepEqual(readable(validateRecord(recordOf({ slug: 'a-post', at: AT, calls: [call] }))), []);
});

test('a ledger covers the writing calls it is given, and its merged and stopped forms are valid', () => {
  const record = recordOf({ slug: 'a-post', at: AT });
  const ledger = ledgerOf({ slug: 'a-post', calls: record.calls });
  assert.deepEqual(ledger.generation, record.totals);
  assert.deepEqual(readable(validateLedger(ledger)), []);
  assert.deepEqual(readable(validateLedger(mergedLedger(ledger))), []);
  assert.deepEqual(readable(validateLedger(stoppedLedger(ledger))), []);
});

test('filesOf names each file after its slug, so the file stem check of the real readers passes', () => {
  const record = recordOf({ slug: 'a-post', at: AT });
  const ledger = ledgerOf({ slug: 'a-post', calls: record.calls });
  const files = filesOf({ ledgers: [ledger], records: [record] });
  assert.deepEqual(
    files.ledgers.map(({ path }) => path),
    [ledgerPath('a-post')]
  );
  assert.deepEqual(
    files.records.map(({ path }) => path),
    [recordPath('a-post')]
  );
  assert.equal(JSON.parse(files.records[0].text).slug, 'a-post');
  assert.ok(files.records[0].text.endsWith('\n'));
});
