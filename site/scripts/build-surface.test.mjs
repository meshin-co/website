import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affectsBuild } from './build-surface.mjs';

test('prose cannot change what a gate measured', () => {
  for (const path of [
    'docs/PRD.md',
    'audits/phase-5/REPORT.md',
    'site/.agents/skills/run-the-gate.md',
    'openspec/changes/13-free-analytics/tasks.md',
    'investigation/2026-10-14-citations.md',
    'README.md',
  ])
    assert.equal(affectsBuild(path), false, path);
});

test('source, config, content and the workflows themselves do change it', () => {
  for (const path of [
    'site/src/pages/index.astro',
    'site/src/data/post/a-post.md',
    'site/scripts/gate.mjs',
    'site/package.json',
  ])
    assert.equal(affectsBuild(path), true, path);
});

test('a test file cannot change the built output, however much it is edited', () => {
  for (const path of [
    'site/scripts/gate.test.mjs',
    'site/src/utils/jsonld.test.mjs',
    'site/tests/visual.spec.ts',
    'site/scripts/fixtures/github-api.mjs',
  ])
    assert.equal(affectsBuild(path), false, path);
});

test('a shipped directory merely named tests or fixtures is still a build input', () => {
  for (const path of ['site/src/data/fixtures/x.md', 'site/public/tests/a.png', 'site/src/components/tests/Card.astro'])
    assert.equal(affectsBuild(path), true, path);
});

test('a workflow orchestrates gates but cannot change what npm run build produces', () => {
  for (const path of ['.github/workflows/ci.yml', '.github/workflows/publish-live.yml', '.githooks/pre-push'])
    assert.equal(affectsBuild(path), false, path);
});

test('the playwright config drives the visual suite, not the build', () => {
  assert.equal(affectsBuild('site/playwright.config.ts'), false);
});

test('the lighthouse config is a build input, because it sets the verdict a record claims', () => {
  assert.equal(affectsBuild('site/lighthouserc.cjs'), true);
});
