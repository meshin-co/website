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

const held = (file, extra = {}) => ({
  file,
  ...entry('evals-baseline', '1.0'),
  data: { ...entry('evals-baseline', '1.0').data, ...extra },
});

for (const [label, extra] of [
  ['draft', { draft: true }],
  ['noindex', { noindex: true }],
]) {
  test(`a series cannot be formed when a ${label} entry holds the address of a published one, and every holder file is named`, () => {
    assert.throws(
      () => groupSeries([held('spec/evals-baseline-1.0.md'), held('spec/twin.md', extra)]),
      (error) =>
        error.message.includes('evals-baseline/1.0') &&
        error.message.includes('spec/evals-baseline-1.0.md') &&
        error.message.includes('spec/twin.md')
    );
  });
}

test('every duplicated address is refused in one message, each with its own holders', () => {
  assert.throws(
    () =>
      groupSeries([
        { file: 'spec/a-1.md', ...entry('alpha', '1.0') },
        { file: 'spec/a-2.md', ...entry('alpha', '1.0') },
        { file: 'spec/z-1.md', ...entry('zed', '2.0') },
        { file: 'spec/z-2.md', ...entry('zed', '2.0') },
      ]),
    (error) =>
      /alpha\/1\.0 \(spec\/a-1\.md, spec\/a-2\.md\); zed\/2\.0 \(spec\/z-1\.md, spec\/z-2\.md\)/.test(error.message)
  );
});
