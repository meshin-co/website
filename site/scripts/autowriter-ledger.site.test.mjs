import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ATTEMPT_CAP, IMMEDIATE_KINDS, MONTHLY_SPEND_CEILING_USD, QUARANTINE_HOURS } from './autowriter-ledger.mjs';

test('locked row L62 states the bounds this module enforces, so the document cannot drift from the code', () => {
  const rows = readFileSync(new URL('../../docs/plan/reference/locked-decisions.md', import.meta.url), 'utf8');
  const row = rows.split('\n').find((line) => line.startsWith('| L62 '));
  assert.ok(row, 'locked-decisions.md has no row L62');
  assert.ok(
    row.includes(QUARANTINE_HOURS + ' hours'),
    'L62 does not state the ' + QUARANTINE_HOURS + ' hour quarantine'
  );
  assert.ok(row.includes(ATTEMPT_CAP + ' attempts'), 'L62 does not state the ' + ATTEMPT_CAP + ' attempt cap');
  assert.ok(
    row.includes('$' + MONTHLY_SPEND_CEILING_USD),
    'L62 does not state the $' + MONTHLY_SPEND_CEILING_USD + ' ceiling'
  );
  for (const kind of IMMEDIATE_KINDS)
    assert.ok(row.includes('`' + kind + '`'), 'L62 does not name the immediate kind ' + kind);
  for (const named of ['npm run assets:seal', 'audits/lighthouse-green.json', 'npm run gate:autowriter']) {
    assert.ok(row.includes(named), 'L62 does not name ' + named);
  }
});
