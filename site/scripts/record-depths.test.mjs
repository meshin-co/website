import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLACES, filedAt } from './fixtures/record-depths.mjs';
import { RECORD_FAMILIES, familyOf, layoutProblem, recordPath } from './record-layout.mjs';

const DATE = '2026-11-01T00:00:00.000Z';
const at = filedAt(DATE);

test('there is one placement for each place the tests name, and the places are named for what they are', () => {
  assert.deepEqual(Object.keys(at), ['flat', 'month', 'deeper']);
  assert.deepEqual(Object.keys(PLACES), Object.keys(at));
});

test('flat names no year and month directory, month is the path the writer files, deeper lies one directory below the month', () => {
  assert.equal(at.flat('ledger', 'x-post'), 'audits/autowriter/x-post.json');
  assert.equal(at.month('ledger', 'x-post'), 'audits/autowriter/2026/11/x-post.json');
  assert.equal(at.deeper('ledger', 'x-post'), 'audits/autowriter/2026/11/extra/x-post.json');
  assert.equal(at.flat('disposition', 'x-post'), 'audits/phase-4.7/dispositions/generated-x-post.json');
  assert.equal(at.month('disposition', 'x-post'), 'audits/phase-4.7/dispositions/2026/11/generated-x-post.json');
  assert.equal(at.deeper('disposition', 'x-post'), 'audits/phase-4.7/dispositions/2026/11/extra/generated-x-post.json');
});

for (const family of RECORD_FAMILIES) {
  test(`the three placements of a ${family} are three different files of that family, and only the month one is filed as the layout wants`, () => {
    const placed = {
      flat: at.flat(family, 'x-post'),
      month: at.month(family, 'x-post'),
      deeper: at.deeper(family, 'x-post'),
    };

    assert.equal(new Set(Object.values(placed)).size, 3);
    assert.equal(placed.month, recordPath(family, 'x-post', DATE));
    for (const path of Object.values(placed)) assert.equal(familyOf(path), family, path);
    assert.equal(layoutProblem(placed.month), null);
    assert.notEqual(layoutProblem(placed.flat), null);
    assert.notEqual(layoutProblem(placed.deeper), null);
  });
}
