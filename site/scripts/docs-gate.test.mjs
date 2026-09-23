import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  citedCommands,
  discoverDocs,
  citedPaths,
  emptyDiscoveryFinding,
  enforcesRowRange,
  isBuildOutput,
  isExternal,
  lockedRowClaims,
  resolveCandidates,
  summaryLine,
} from './docs-gate.mjs';

test('a backticked repo path is cited, and a filename suffix fragment is not', () => {
  const cited = citedPaths('see `docs/PRD.md` and rename to `.done.md`');
  assert.deepEqual(cited, ['docs/PRD.md']);
});

test('a route path is never a repo path, because the site serves it and the repo does not hold it', () => {
  assert.deepEqual(citedPaths('the build emits `/feed.json` and `/llms.txt`'), []);
});

test('a placeholder path is not checkable, so it is excluded by name', () => {
  assert.deepEqual(citedPaths('evidence lands in `audits/phase-N/REPORT.md`'), []);
});

test('a skill URL is not a repo path', () => {
  assert.deepEqual(citedPaths('read `skill://perfect-coder` first'), []);
});

test('every npm command mentioned in prose is collected', () => {
  assert.deepEqual(citedCommands('run `npm run gate:lh` then npm run build'), ['gate:lh', 'build']);
});

test('a locked-row range claim is extracted so it can be compared with the real rows', () => {
  assert.deepEqual(lockedRowClaims('the locked decisions L1-L49 live in the reference'), [49]);
  assert.deepEqual(lockedRowClaims('rows L1\u2013L54 are closed'), [54]);
  assert.deepEqual(lockedRowClaims('no range here'), []);
});

test('a single row mention is not a range claim, because prose cites one row constantly', () => {
  assert.deepEqual(lockedRowClaims('per L13 the budget is 1850 ms'), []);
});

test('a path is resolved against the citing document first, because an index links its own siblings', () => {
  assert.deepEqual(resolveCandidates('reference/locked-decisions.md', 'docs/plan/INDEX.md'), [
    'docs/plan/reference/locked-decisions.md',
    'reference/locked-decisions.md',
    'site/reference/locked-decisions.md',
  ]);
});

test('a path inside another tool tree is external, because this repo never holds it', () => {
  assert.equal(isExternal('.omp-perfect-coder/config.yml'), true);
  assert.equal(isExternal('extensions/lib/test-existence.ts'), true);
  assert.equal(isExternal('docs/PRD.md'), false);
});

test('a finished phase file is a historical record, so its row-range claim is not enforced', () => {
  assert.equal(enforcesRowRange('docs/plan/phases/phase-0-initialization.done.md'), false);
  assert.equal(enforcesRowRange('docs/plan/phases/phase-5-launch.next.md'), true);
  assert.equal(enforcesRowRange('AGENTS.md'), true);
});

test('the reference itself may cite a past range in a row, so only the docs pointing at it are checked', () => {
  assert.equal(enforcesRowRange('docs/plan/reference/locked-decisions.md'), false);
});

test('markdown discovery falls back to a walk when git is unavailable, because the gate must run outside a repo', () => {
  const viaGit = () => {
    throw new Error('fatal: not a git repository');
  };
  const viaWalk = () => ['docs/a.md', 'node_modules/x/b.md', 'audits/phase-1/REPORT.md', 'dist/c.md'];
  assert.deepEqual(discoverDocs(viaGit, viaWalk), ['docs/a.md']);
});

test('git discovery wins when it works, and still drops generated evidence', () => {
  const viaGit = () => ['AGENTS.md', 'audits/phase-1/REPORT.md', 'docs/b.md'];
  assert.deepEqual(
    discoverDocs(viaGit, () => []),
    ['AGENTS.md', 'docs/b.md']
  );
});

test('a build-output root under site/ is ignored the same as its bare form, because the walk branch always sees the site/ prefix', () => {
  const viaWalk = () => ['docs/a.md', 'site/dist/gate-summary.md', 'dist/legacy.md', 'site/.astro/cache.md'];
  assert.deepEqual(
    discoverDocs(() => {
      throw new Error('no git');
    }, viaWalk),
    ['docs/a.md']
  );
});

test('site/src/data content entries are excluded from the doc set, because articles are gated by gate:content and gate:editorial, not this gate', () => {
  const viaGit = () => ['AGENTS.md', 'site/src/data/blog/post-1.md', 'docs/b.md'];
  assert.deepEqual(
    discoverDocs(viaGit, () => []),
    ['AGENTS.md', 'docs/b.md']
  );
});

test('an empty discovered set is a finding, not a silent pass, because a git repo with only untracked docs must not report 0 findings', () => {
  assert.equal(emptyDiscoveryFinding(0)?.rule, 'no-docs-discovered');
  assert.equal(emptyDiscoveryFinding(3), null);
});

test('a build-output path is recognized in both its bare and site/-prefixed form', () => {
  assert.equal(isBuildOutput('dist/gate-routes.json'), true);
  assert.equal(isBuildOutput('site/dist/gate-routes.json'), true);
  assert.equal(isBuildOutput('docs/PRD.md'), false);
});

test('the summary line stays silent about skipped build-output citations when none were skipped', () => {
  assert.equal(
    summaryLine({ fileCount: 84, findingCount: 0, skippedBuildOutputCount: 0 }),
    'docs: 84 files checked, 0 findings'
  );
});

test('the summary line reports skipped build-output citations instead of silently dropping them', () => {
  assert.equal(
    summaryLine({ fileCount: 84, findingCount: 0, skippedBuildOutputCount: 1 }),
    'docs: 84 files checked, 0 findings, 1 build-output citation unverified (no build present)'
  );
  assert.equal(
    summaryLine({ fileCount: 84, findingCount: 2, skippedBuildOutputCount: 3 }),
    'docs: 84 files checked, 2 findings, 3 build-output citations unverified (no build present)'
  );
});
