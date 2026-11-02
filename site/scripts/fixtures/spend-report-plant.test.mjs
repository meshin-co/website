import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { REPORT_PATH, reportText } from '../spend-report-text.mjs';
import { filesOf, ledgerOf, recordOf, writingCall } from './spend-report-corpus.mjs';
import { REVISION, plantSpendReport, spendReportFiles } from './spend-report-plant.mjs';

function inEmptyRepo(body) {
  const root = mkdtempSync(join(tmpdir(), 'spend-report-plant-'));
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('planting writes the report of an empty corpus at the path the gate reads', () =>
  inEmptyRepo((root) => {
    plantSpendReport(root);
    assert.equal(readFileSync(join(root, REPORT_PATH), 'utf8'), reportText({ ledgers: [], records: [] }, REVISION));
  }));

test('the files of a report count the records given as written, and are not written to the disk', () =>
  inEmptyRepo((root) => {
    const post = recordOf({ slug: 'a-post', at: '2026-11-02T07:00:00.000Z', calls: [writingCall({ tag: 'draft' })] });
    const parts = filesOf({ ledgers: [ledgerOf({ slug: 'a-post', calls: post.calls })], records: [post] });
    const files = spendReportFiles(root, [...parts.ledgers, ...parts.records]);
    assert.deepEqual(Object.keys(files), [REPORT_PATH]);
    assert.equal(files[REPORT_PATH], reportText(parts, REVISION));
    assert.throws(() => readFileSync(join(root, REPORT_PATH)), { code: 'ENOENT' });
  }));
