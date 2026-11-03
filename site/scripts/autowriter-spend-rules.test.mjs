import assert from 'node:assert/strict';
import { test } from 'node:test';

import { spendReportFindings } from './autowriter-spend-rules.mjs';
import { GENERATED_AT, filesOf, ledgerOf, recordOf, writingCall } from './fixtures/spend-report-corpus.mjs';
import { REPORT_PATH, reportText } from './spend-report-text.mjs';

const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const TERM_DRAFT = writingCall({ input: 6000, output: 1200, tag: 'term' });

const post = recordOf({ slug: 'a-post', at: '2026-11-02T07:00:00.000Z', calls: [DRAFT, CORRECTION] });
const term = recordOf({
  slug: 'a-term',
  format: 'term',
  at: '2026-11-02T07:00:01.000Z',
  ledgerSlug: 'a-post',
  calls: [TERM_DRAFT],
});
const ledger = ledgerOf({ slug: 'a-post', calls: [...post.calls, ...term.calls] });

const SHIPPED = filesOf({ ledgers: [ledger], records: [post, term] });
const POST_ONLY = filesOf({ ledgers: [ledger], records: [post] });
const NOTHING = filesOf({});
const STAMP = '3fa620f';

const committedFor = (files, stamp = STAMP) => reportText(files, stamp, GENERATED_AT);
const check = (files, committed) => spendReportFindings({ ...files, committed });
const only = (found) => {
  assert.equal(found.length, 1, JSON.stringify(found));
  return found[0];
};

test('a report that is what the records give passes, with records or with none', () => {
  assert.deepEqual(check(SHIPPED, committedFor(SHIPPED)), []);
  assert.deepEqual(check(NOTHING, committedFor(NOTHING)), []);
});

test('the stamp is the one input read back from the file, so any commit hash passes and a new commit changes nothing', () => {
  for (const stamp of ['3fa620f', 'a'.repeat(40), 'a revision before 6a0c9c2']) {
    assert.deepEqual(check(SHIPPED, committedFor(SHIPPED, stamp)), [], stamp);
  }
});

test('a missing report is named even when no record exists, and says how to write it', () => {
  for (const files of [SHIPPED, NOTHING]) {
    const found = only(check(files, null));
    assert.equal(found.rule, 'spend-report-missing');
    assert.equal(found.path, REPORT_PATH);
    assert.match(found.detail, /^the file does not exist; run npm run audit:spend to write it$/);
  }
});

test('a record added with the report left as it was is named, at the first line that differs', () => {
  const found = only(check(SHIPPED, committedFor(POST_ONLY)));
  assert.equal(found.rule, 'spend-report-differs');
  assert.equal(found.path, REPORT_PATH);
  assert.match(
    found.detail,
    /^line \d+ differs: the file has ".*" but the records give ".*"; run npm run audit:spend to regenerate it$/
  );
  const stale = committedFor(POST_ONLY).split('\n');
  const fresh = committedFor(SHIPPED).split('\n');
  const at = stale.findIndex((line, index) => line !== fresh[index]);
  assert.ok(found.detail.startsWith(`line ${at + 1} differs: `), found.detail);
  assert.ok(found.detail.includes(stale[at]) && found.detail.includes(fresh[at]), found.detail);
});

test('a record deleted with the report left as it was is named too', () => {
  assert.equal(only(check(POST_ONLY, committedFor(SHIPPED))).rule, 'spend-report-differs');
});

test('a figure edited by hand is named with the line it is on, both ways round', () => {
  const edited = committedFor(SHIPPED).replace(
    /(\| all +\| 2 +\| 31,000 +\| 6,200 +\| )0\.062/,
    (_, row) => `${row}0.001`
  );
  const found = only(check(SHIPPED, edited));
  assert.equal(found.rule, 'spend-report-differs');
  assert.match(
    found.detail,
    /the file has "\| all +\| 2 +\| 31,000 +\| 6,200 +\| 0\.001 +\|" but the records give "\| all +\| 2 +\| 31,000 +\| 6,200 +\| 0\.062 +\|"/
  );
});

test('a record whose own figure is changed is named, so editing the evidence and the report together needs the report to follow', () => {
  const dearer = recordOf({
    slug: 'a-post',
    at: '2026-11-02T07:00:00.000Z',
    calls: [writingCall({ input: 99000, output: 3000, tag: 'draft' }), CORRECTION],
  });
  const files = filesOf({ ledgers: [ledger], records: [dearer, term] });
  assert.equal(only(check(files, committedFor(SHIPPED))).rule, 'spend-report-differs');
});

test('a report with no stamp is named at the stamp line, because the stamp is part of the file', () => {
  const unstamped = committedFor(SHIPPED).replace(/^Generated-from: .*\n/m, '');
  const found = only(check(SHIPPED, unstamped));
  assert.equal(found.rule, 'spend-report-differs');
  assert.match(found.detail, /^line 3 differs: /);
  assert.match(found.detail, /Generated-from: /);
});

test('a missing last line, an extra last line and a missing final newline each say so', () => {
  const lines = committedFor(SHIPPED).split('\n');
  const without = lines.slice(0, -2).join('\n') + '\n';
  assert.match(
    only(check(SHIPPED, without)).detail,
    new RegExp(`^line ${lines.length - 1} is missing: the records give `)
  );
  const more = committedFor(SHIPPED) + 'one more line\n';
  assert.match(
    only(check(SHIPPED, more)).detail,
    new RegExp(`^line ${lines.length} is extra: the file has "one more line"`)
  );
  const noNewline = committedFor(SHIPPED).slice(0, -1);
  assert.match(only(check(SHIPPED, noNewline)).detail, /^the file must end in exactly one newline; /);
});

test('windows line endings are a difference, named at the first line', () => {
  const found = only(check(SHIPPED, committedFor(SHIPPED).replaceAll('\n', '\r\n')));
  assert.match(found.detail, /^line 1 differs: /);
});

test('a very long line is shortened in the finding, so one defect stays one readable line', () => {
  const found = only(
    check(SHIPPED, committedFor(SHIPPED).replace('# Spend report', `# Spend report ${'x'.repeat(900)}`))
  );
  assert.ok(found.detail.length < 500, `the detail is ${found.detail.length} characters`);
  assert.match(found.detail, /\.\.\."/);
  assert.equal(found.detail.includes('\n'), false);
});

test('an unreadable record is not a reason to refuse a report that says so, and is a reason to refuse one that does not', () => {
  const broken = {
    ledgers: SHIPPED.ledgers,
    records: [...SHIPPED.records, { path: 'audits/autowriter/generations/broken.json', text: '{no' }],
  };
  assert.deepEqual(check(broken, committedFor(broken)), []);
  assert.equal(only(check(broken, committedFor(SHIPPED))).rule, 'spend-report-differs');
});
