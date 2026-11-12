import test from 'node:test';
import assert from 'node:assert/strict';

import { duplicateSpecAddresses, groupSeries } from './spec-series.mjs';

const entry = (name, version) => ({
  id: `${name}/${version}`,
  data: { name, version, publishDate: new Date('2026-11-12'), updatedDate: new Date('2026-11-12') },
});

test('two entries at one address are named, and the address is named once however many entries hold it', () => {
  const found = duplicateSpecAddresses([
    entry('evals-baseline', '1.0'),
    entry('evals-baseline', '1.0'),
    entry('evals-baseline', '1.0'),
  ]);
  assert.deepEqual(found, ['evals-baseline/1.0']);
});

test('one artefact at several versions and several artefacts at one version are not duplicates', () => {
  const found = duplicateSpecAddresses([
    entry('evals-baseline', '1.0'),
    entry('evals-baseline', '1.1'),
    entry('governance-answer', '1.0'),
  ]);
  assert.deepEqual(found, []);
});

test('every duplicated address is reported, in sorted order', () => {
  const found = duplicateSpecAddresses([
    entry('zed', '2.0'),
    entry('zed', '2.0'),
    entry('alpha', '1.0'),
    entry('alpha', '1.0'),
  ]);
  assert.deepEqual(found, ['alpha/1.0', 'zed/2.0']);
});

test('a series cannot be formed from two entries at one address', () => {
  assert.throws(
    () => groupSeries([entry('evals-baseline', '1.0'), entry('evals-baseline', '1.0')]),
    /evals-baseline\/1\.0/
  );
});

test('a series forms when every address is held once', () => {
  const series = groupSeries([entry('evals-baseline', '1.1'), entry('evals-baseline', '1.0')]);
  assert.deepEqual(
    series.map(({ name }) => name),
    ['evals-baseline']
  );
});
