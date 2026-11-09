import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { keywordReportText } from './fixtures/pick-scene.mjs';
import { keywordRow, keywordsOf } from './fixtures/topic-inputs.mjs';
import { KEYWORD_REPORT_PATH, keywordCandidates, readKeywords } from './topic-keywords.mjs';

const FRAMEWORK = keywordRow('ai governance framework', 803, 1051);
const EXAMPLES = keywordRow('prompt injection examples', 303);
const POLICY = keywordRow('ai governance policy', 32);

const phrases = (report) => keywordCandidates(report).map(({ phrase }) => phrase);

const inRepo = (body) => {
  const root = mkdtempSync(join(tmpdir(), 'topic-keywords-'));
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const putReport = (root, text) => {
  mkdirSync(dirname(join(root, KEYWORD_REPORT_PATH)), { recursive: true });
  writeFileSync(join(root, KEYWORD_REPORT_PATH), text);
};

test('candidates are listed most exact impressions first, whatever the order of the report', () => {
  assert.deepEqual(phrases(keywordsOf([POLICY, FRAMEWORK, EXAMPLES])), [
    'ai governance framework',
    'prompt injection examples',
    'ai governance policy',
  ]);
});

test('the exact count orders the list even when the broad count says otherwise', () => {
  const narrow = keywordRow('narrow phrase', 100, 100);
  const wide = keywordRow('wide phrase', 90, 5000);
  assert.deepEqual(phrases(keywordsOf([wide, narrow])), ['narrow phrase', 'wide phrase']);
});

test('candidates level on the exact count are ordered by the broad count, then by the phrase', () => {
  const rows = [keywordRow('b phrase', 40, 40), keywordRow('a phrase', 40, 40), keywordRow('c phrase', 40, 90)];
  assert.deepEqual(phrases(keywordsOf(rows)), ['c phrase', 'a phrase', 'b phrase']);
});

test('a candidate carries its arm, its phrase, its exact and broad counts and the day the report was measured', () => {
  assert.deepEqual(keywordCandidates(keywordsOf([FRAMEWORK])), [
    { arm: 'keyword', phrase: 'ai governance framework', exact: 803, broad: 1051, measured: '2026-11-09' },
  ]);
});

test('a row with no exact impression is no candidate', () => {
  assert.deepEqual(phrases(keywordsOf([keywordRow('broad only', 0, 40), POLICY])), ['ai governance policy']);
});

test('a report with no Measured day offers no candidate, so no choice can state a missing day', () => {
  assert.deepEqual(keywordCandidates(keywordsOf([FRAMEWORK], { measured: null })), []);
});

test('listing the candidates leaves the report as it was and gives the same list twice', () => {
  const report = keywordsOf([POLICY, FRAMEWORK]);
  const before = structuredClone(report);
  const first = keywordCandidates(report);
  assert.deepEqual(keywordCandidates(report), first);
  assert.deepEqual(report, before);
});

test('the report is read from audits/keyword-demand.md under the repository root, with its candidates and its day', () => {
  inRepo((root) => {
    const candidates = [
      ['ai governance policy', 32, 32],
      ['ai governance framework', 803, 1051],
    ];
    putReport(root, keywordReportText({ candidates, measured: '2026-11-08' }));
    const report = readKeywords(root);
    assert.equal(KEYWORD_REPORT_PATH, 'audits/keyword-demand.md');
    assert.equal(report.measured, '2026-11-08');
    assert.deepEqual(keywordCandidates(report), [
      { arm: 'keyword', phrase: 'ai governance framework', exact: 803, broad: 1051, measured: '2026-11-08' },
      { arm: 'keyword', phrase: 'ai governance policy', exact: 32, broad: 32, measured: '2026-11-08' },
    ]);
  });
});

test('a missing report is no candidates and no error', () => {
  inRepo((root) => {
    assert.deepEqual(keywordCandidates(readKeywords(root)), []);
  });
});

test('a report that cannot be read is no candidates and no error: a directory in its place, an empty file, text that is no report', () => {
  const unreadable = {
    'a directory in its place': (root) => mkdirSync(join(root, KEYWORD_REPORT_PATH), { recursive: true }),
    'an empty file': (root) => putReport(root, ''),
    'text that is no report': (root) => putReport(root, 'not a report\n\n| a | b |\n| - | - |\n| 1 | 2 |\n'),
  };
  for (const [name, plant] of Object.entries(unreadable)) {
    inRepo((root) => {
      plant(root);
      assert.deepEqual(keywordCandidates(readKeywords(root)), [], name);
    });
  }
});

test('a report whose candidates section is empty reads as no candidates', () => {
  inRepo((root) => {
    putReport(root, keywordReportText());
    assert.deepEqual(keywordCandidates(readKeywords(root)), []);
  });
});
