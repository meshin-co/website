import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageInDays, measuredDate, staleFindings } from './report-freshness.mjs';

const TODAY = '2026-11-15';
const STAMP = {
  today: TODAY,
  report: 'audits/example.md',
  refresh: 'npm run audit:example',
  maxAgeDays: 35,
};

const only = (findings) => {
  assert.equal(findings.length, 1, JSON.stringify(findings));
  return findings[0];
};

test('age counts whole UTC days across a month end and a leap day', () => {
  assert.equal(ageInDays('2026-11-01', '2026-11-01'), 0);
  assert.equal(ageInDays('2026-10-31', '2026-11-01'), 1);
  assert.equal(ageInDays('2028-02-01', '2028-03-07'), 35);
  assert.equal(ageInDays('2027-02-01', '2027-03-07'), 34);
});

test('a day that is not on the calendar is not a measured day, and a leap day is', () => {
  assert.equal(measuredDate('Measured: 2028-02-29'), '2028-02-29');
  assert.equal(measuredDate('Measured: 2026-02-31'), null);
  assert.equal(measuredDate('Measured: 2026-13-01'), null);
});

test('the measured day of a report is read when it is real, bold or plain, and is nothing otherwise', () => {
  assert.equal(measuredDate('Measured: 2026-11-01 (window 2026-08-01 to 2026-10-30)'), '2026-11-01');
  assert.equal(measuredDate('**Measured:** 2026-11-01'), '2026-11-01');
  assert.equal(measuredDate('Measured: 2026-02-31'), null);
  assert.equal(measuredDate('Measured: yesterday'), null);
  assert.equal(measuredDate('# Report\n\nNo measurement line here.\n'), null);
});

test('the limit itself is fresh and one day past it is stale, naming the report, the day and the command', () => {
  assert.deepEqual(staleFindings({ ...STAMP, measured: '2026-10-11' }), []);
  const finding = only(staleFindings({ ...STAMP, measured: '2026-10-10' }));

  assert.equal(finding.rule, 'report-stale');
  assert.equal(finding.path, 'audits/example.md');
  assert.equal(finding.detail, 'measured 2026-10-10; refresh with npm run audit:example (36 days old, limit 35)');
});

test('the limit is the one the caller gives, not a number the module knows', () => {
  assert.deepEqual(staleFindings({ ...STAMP, maxAgeDays: 8, measured: '2026-11-07' }), []);
  assert.equal(
    only(staleFindings({ ...STAMP, maxAgeDays: 8, measured: '2026-11-06' })).detail.endsWith('limit 8)'),
    true
  );
});

test('a report with no date cannot be shown fresh, so it fails and names the command', () => {
  const finding = only(staleFindings({ ...STAMP, measured: null }));

  assert.equal(finding.rule, 'report-stale');
  assert.equal(
    finding.detail,
    'no "Measured: YYYY-MM-DD" line with a real date, so its age cannot be shown; make it with npm run audit:example'
  );
});

test('a date from the future cannot defeat the age check, but one day of timezone skew is tolerated', () => {
  assert.deepEqual(staleFindings({ ...STAMP, measured: '2026-11-16' }), []);
  const finding = only(staleFindings({ ...STAMP, measured: '2026-11-17' }));

  assert.equal(finding.rule, 'report-stale');
  assert.equal(
    finding.detail,
    'measured 2026-11-17, 2 days after today 2026-11-15; a date in the future cannot show it fresh, so re-measure with npm run audit:example'
  );
});
