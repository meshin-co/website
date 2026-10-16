import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprint, staleReason, uncommittedBuildFiles } from './lh-evidence.mjs';

test('the fingerprint covers only what can change the built output', () => {
  const withProse = fingerprint([
    ['site/src/pages/index.astro', 'aaa'],
    ['docs/PRD.md', 'bbb'],
    ['audits/phase-5/REPORT.md', 'ccc'],
  ]);
  const withoutProse = fingerprint([['site/src/pages/index.astro', 'aaa']]);

  assert.equal(withProse, withoutProse);
});

test('the order files arrive in does not change the fingerprint', () => {
  const one = fingerprint([
    ['site/src/pages/a.astro', '1'],
    ['site/src/pages/b.astro', '2'],
  ]);
  const other = fingerprint([
    ['site/src/pages/b.astro', '2'],
    ['site/src/pages/a.astro', '1'],
  ]);

  assert.equal(one, other);
});

test('a changed source file changes the fingerprint', () => {
  const before = fingerprint([['site/src/pages/index.astro', 'aaa']]);
  const after = fingerprint([['site/src/pages/index.astro', 'aab']]);

  assert.notEqual(before, after);
});

test('a tree matching the recorded green run needs no second run', () => {
  assert.equal(staleReason({ fingerprint: 'abc' }, 'abc'), undefined);
});

test('a tree that no recorded run measured is refused, and says what to run', () => {
  const reason = staleReason({ fingerprint: 'abc', recordedAt: '2026-10-16T08:00:00Z' }, 'xyz');

  assert.match(reason, /npm run gate:lh/);
  assert.match(reason, /2026-10-16T08:00:00Z/);
});

test('a missing record is refused too, because no run has ever been recorded', () => {
  assert.match(staleReason(undefined, 'xyz'), /no local lighthouse run/i);
});

test('an edit not yet committed is named, because the fingerprint would describe another tree', () => {
  const porcelain = [' M site/src/pages/index.astro', '?? site/src/components/New.astro', ' M docs/PRD.md'].join('\n');

  assert.deepEqual(uncommittedBuildFiles(porcelain), ['site/src/pages/index.astro', 'site/src/components/New.astro']);
});

test('a rename reports its destination, which is the file the build would read', () => {
  assert.deepEqual(uncommittedBuildFiles('R  site/src/a.astro -> site/src/b.astro'), ['site/src/b.astro']);
});

test('uncommitted prose is not a reason to refuse', () => {
  assert.deepEqual(uncommittedBuildFiles(' M docs/PRD.md\n?? audits/phase-5/REPORT.md'), []);
});
