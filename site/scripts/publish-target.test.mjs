import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockingFiles, pickGatedRun } from './publish-target.mjs';
import { PROSE_DIRS } from './build-surface.mjs';

test('the newest green ci run on main that carries a dist is the publishable one', () => {
  const runs = [
    { id: 9, head_branch: 'main', conclusion: 'success', hasDist: false },
    { id: 8, head_branch: 'main', conclusion: 'failure', hasDist: true },
    { id: 7, head_branch: 'main', conclusion: 'success', hasDist: true },
    { id: 6, head_branch: 'main', conclusion: 'success', hasDist: true },
  ];

  assert.equal(pickGatedRun(runs).id, 7);
});

test('a green run on another branch is never publishable', () => {
  const runs = [{ id: 5, head_branch: 'feat/x', conclusion: 'success', hasDist: true }];

  assert.equal(pickGatedRun(runs), undefined);
});

test('prose committed after the gated run cannot change what was measured', () => {
  const files = [
    'docs/PRD.md',
    'audits/phase-12/REPORT.md',
    'site/.agents/skills/publish-the-build.md',
    'openspec/changes/13-free-analytics/tasks.md',
    'investigation/2026-10-14-citations.md',
    'README.md',
  ];

  assert.deepEqual(blockingFiles(files), []);
});

test('source, config or content committed after the gated run blocks publishing', () => {
  const files = [
    'docs/PRD.md',
    'site/src/pages/index.astro',
    'site/src/data/post/a-post.md',
    '.github/workflows/ci.yml',
  ];

  assert.deepEqual(blockingFiles(files), [
    'site/src/pages/index.astro',
    'site/src/data/post/a-post.md',
    '.github/workflows/ci.yml',
  ]);
});

test('a workflow-only commit blocks a publish, because it can change how the bytes are shipped', () => {
  assert.deepEqual(blockingFiles(['.github/workflows/publish-live.yml']), ['.github/workflows/publish-live.yml']);
});

test('the prose directories are the ones the build surface names, so the two guards cannot drift apart', () => {
  for (const dir of PROSE_DIRS) assert.deepEqual(blockingFiles([`${dir}a.txt`]), []);
});
