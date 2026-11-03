import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { spendReportFindings } from './autowriter-spend-rules.mjs';
import { spendSpecimens } from './autowriter-spend-specimens.mjs';
import { GENERATED_AT } from './fixtures/spend-report-corpus.mjs';
import { addUntrackedFile, editFile, removeFile } from './mutation-specimens.mjs';
import { corpusFiles } from './spend-report.mjs';
import { REPORT_PATH, reportText } from './spend-report-text.mjs';

const SPECIMENS = spendSpecimens({ addUntrackedFile, editFile, removeFile });
const NAMES = [
  'autowriterSpendReportDeleted',
  'autowriterSpendReportEdited',
  'autowriterSpendReportStale',
  'autowriterSpendReportUnstamped',
];

async function inCopy(body) {
  const root = mkdtempSync(join(tmpdir(), 'spend-specimens-'));
  try {
    mkdirSync(join(root, 'site'), { recursive: true });
    mkdirSync(dirname(join(root, REPORT_PATH)), { recursive: true });
    writeFileSync(join(root, REPORT_PATH), reportText({ ledgers: [], records: [] }, 'abc1234', GENERATED_AT));
    return await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function printed(root) {
  const committed = existsSync(join(root, REPORT_PATH)) ? readFileSync(join(root, REPORT_PATH), 'utf8') : null;
  return spendReportFindings({ ...corpusFiles(root), committed })
    .map(({ rule, path, detail }) => `AUTOWRITER ${rule} ${path}: ${detail}`)
    .join('\n');
}

test('four specimens, each against gate:autowriter, each with a token of its own', () => {
  assert.deepEqual(Object.keys(SPECIMENS).sort(), NAMES);
  const tokens = NAMES.map((name) => SPECIMENS[name].token);
  assert.equal(new Set(tokens).size, tokens.length, 'two specimens share a token');
  for (const name of NAMES) {
    assert.equal(SPECIMENS[name].gate, 'gate:autowriter', name);
    assert.equal(typeof SPECIMENS[name].plant, 'function', name);
  }
});

test('the module can be built with no tools, which is how the registry lists its names', () => {
  assert.deepEqual(Object.keys(spendSpecimens({})).sort(), NAMES);
});

for (const name of NAMES) {
  test(`${name} is clean before, names its token when planted, and is clean again once restored`, () =>
    inCopy(async (root) => {
      assert.equal(printed(root), '');
      const restore = await SPECIMENS[name].plant(join(root, 'site'));
      assert.equal(typeof restore, 'function', 'plant returned no restore function');
      const planted = printed(root);
      assert.ok(planted.includes(SPECIMENS[name].token), planted);
      await restore();
      assert.equal(printed(root), '');
      assert.equal(
        readFileSync(join(root, REPORT_PATH), 'utf8'),
        reportText({ ledgers: [], records: [] }, 'abc1234', GENERATED_AT)
      );
    }));
}
