import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  citedCommands,
  discoverDocs,
  citedPaths,
  emptyDiscoveryFinding,
  enforcesRowRange,
  ignoredCitation,
  isBuildOutput,
  isExternal,
  isRecord,
  lockedRowClaims,
  mayBeRecord,
  parseIgnoreReport,
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

test('a record marker at the top of the file is recognized only in its exact form', () => {
  assert.equal(isRecord('---\nrecord: true\n---\n\n# Dossier\n\nbody'), true);
  assert.equal(isRecord('---\nrecord: true\n---'), true);
});

test('a record marker is not recognized when it is not the first thing in the file', () => {
  assert.equal(isRecord('# Dossier\n\n---\nrecord: true\n---\n'), false);
});

test('record: false in front matter is not a record marker', () => {
  assert.equal(isRecord('---\nrecord: false\n---\n\n# Dossier\n'), false);
});

test('the words "record: true" appearing in prose, not as a fence, is not a marker', () => {
  assert.equal(isRecord('record: true is the phrase the marker uses.\n'), false);
});

test('a file under investigation/ may be a record, and nothing outside it may', () => {
  assert.equal(mayBeRecord('investigation/01-absorption-from-donor-harness.md'), true);
  assert.equal(mayBeRecord('docs/plan/INDEX.md'), false);
  assert.equal(mayBeRecord('site/investigation/01-note.md'), false);
});

test('the investigation index is never a record, because it tells the reader where to look and its paths must resolve', () => {
  assert.equal(mayBeRecord('investigation/00-INDEX.md'), false);
});

test('the summary line names every record the marker exempted, so a skip is never counted as a check', () => {
  assert.equal(
    summaryLine({ fileCount: 151, findingCount: 0, skippedBuildOutputCount: 0, recordCount: 1 }),
    'docs: 151 files checked, 0 findings, 1 record exempt (record: true)'
  );
  assert.equal(
    summaryLine({ fileCount: 151, findingCount: 2, skippedBuildOutputCount: 2, recordCount: 3 }),
    'docs: 151 files checked, 2 findings, 2 build-output citations unverified (no build present), 3 records exempt (record: true)'
  );
});

const ignoreRecord = (source, line, pattern, path) => `${[source, line, pattern, path].join('\0')}\0`;

test('a git ignore report lists each ignored path with the rule that matched it', () => {
  const report = parseIgnoreReport(
    ignoreRecord('.gitignore', '15', 'audits/phase-local/', 'audits/phase-local/a.json')
  );
  assert.deepEqual(report.get('audits/phase-local/a.json'), {
    source: '.gitignore',
    line: '15',
    pattern: 'audits/phase-local/',
  });
});

test('a path that matches only a negated pattern is not ignored, although verbose git still lists it', () => {
  assert.equal(parseIgnoreReport(ignoreRecord('.gitignore', '4', '!keep.json', 'keep.json')).has('keep.json'), false);
});

test('an empty or truncated ignore report yields no ignored path, rather than a path with missing fields', () => {
  assert.equal(parseIgnoreReport('').size, 0);
  assert.equal(parseIgnoreReport('.gitignore\u000015\u0000audits/\u0000').size, 0);
});

test('a citation whose only copy on disk is ignored says which rule ignores it and that a clean checkout lacks it', () => {
  const report = parseIgnoreReport(
    ignoreRecord('.gitignore', '15', 'audits/phase-local/', 'audits/phase-local/a.json')
  );
  const message = ignoredCitation('audits/phase-local/a.json', ['audits/phase-local/a.json'], report);
  assert.match(message, /audits\/phase-local\/a\.json/);
  assert.match(message, /\.gitignore:15 \(audits\/phase-local\/\)/);
  assert.match(message, /clean checkout/);
});

test('a citation is held by a clean checkout when any file it resolves to is not ignored', () => {
  const report = parseIgnoreReport(ignoreRecord('.gitignore', '2', 'docs/a.mjs', 'docs/a.mjs'));
  assert.equal(ignoredCitation('a.mjs', ['docs/a.mjs', 'a.mjs'], report), null);
  assert.equal(ignoredCitation('a.mjs', ['a.mjs', 'docs/a.mjs'], report), null);
});

test('a citation that resolved through another directory names the file it resolved to', () => {
  const report = parseIgnoreReport(ignoreRecord('.gitignore', '2', 'scripts/a.mjs', 'site/scripts/a.mjs'));
  assert.match(ignoredCitation('scripts/a.mjs', ['site/scripts/a.mjs'], report), /site\/scripts\/a\.mjs/);
});

test('the summary line names an ignore check that could not run, so a skip is never counted as a pass', () => {
  assert.equal(
    summaryLine({ fileCount: 9, findingCount: 0, skippedBuildOutputCount: 0, ignoreCheckSkipped: true }),
    'docs: 9 files checked, 0 findings, ignored-path check skipped (git could not answer)'
  );
});

function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'docs-gate-run-'));
  mkdirSync(join(root, 'docs/plan/reference'), { recursive: true });
  writeFileSync(join(root, 'docs/plan/reference/locked-decisions.md'), '| L1 | x | y |\n');
  mkdirSync(join(root, 'site'), { recursive: true });
  writeFileSync(join(root, 'site/package.json'), JSON.stringify({ scripts: {} }));
  mkdirSync(join(root, 'investigation'), { recursive: true });
  return root;
}

const RUN_SCRIPT = join(import.meta.dirname, 'run-docs-gate.mjs');
const MARKER = '---\nrecord: true\n---\n\n';
const FOREIGN_CITATIONS =
  'See `docs/DOES-NOT-EXIST.md` for the artefact this audit found, run `npm run gate:gone`, and note locked rows L1-L12.\n';

function runGate(root) {
  const { status, stdout } = spawnSync(process.execPath, [RUN_SCRIPT, root], { encoding: 'utf8' });
  return { status, stdout };
}

test('a marked record may cite a path, a command and a row range this repository does not hold', () => {
  const root = fixtureRepo();
  writeFileSync(join(root, 'investigation/99-a-record.md'), `${MARKER}# A record\n\n${FOREIGN_CITATIONS}`);
  const { status, stdout } = runGate(root);
  assert.equal(status, 0);
  assert.match(stdout, /^docs: 1 files checked, 0 findings, 1 record exempt \(record: true\)$/m);
});

test('the same citations in an unmarked file still fail the gate, one finding for each rule', () => {
  const root = fixtureRepo();
  writeFileSync(join(root, 'investigation/99-an-instruction.md'), `# An instruction\n\n${FOREIGN_CITATIONS}`);
  const { status, stdout } = runGate(root);
  assert.equal(status, 1);
  assert.match(stdout, /dead-path investigation\/99-an-instruction\.md: docs\/DOES-NOT-EXIST\.md/);
  assert.match(stdout, /dead-command investigation\/99-an-instruction\.md: npm run gate:gone/);
  assert.match(stdout, /stale-row-range investigation\/99-an-instruction\.md: claims L1-L12/);
});

test('the marker on the investigation index does not exempt it, so the index stays checked', () => {
  const root = fixtureRepo();
  writeFileSync(join(root, 'investigation/00-INDEX.md'), `${MARKER}# Index\n\n${FOREIGN_CITATIONS}`);
  const { status, stdout } = runGate(root);
  assert.equal(status, 1);
  assert.match(stdout, /dead-path investigation\/00-INDEX\.md: docs\/DOES-NOT-EXIST\.md/);
  assert.doesNotMatch(stdout, /record exempt/);
});

test('the marker outside investigation/ exempts nothing, because every other document instructs', () => {
  const root = fixtureRepo();
  writeFileSync(join(root, 'docs/a-guide.md'), `${MARKER}# A guide\n\n${FOREIGN_CITATIONS}`);
  const { status, stdout } = runGate(root);
  assert.equal(status, 1);
  assert.match(stdout, /dead-path docs\/a-guide\.md: docs\/DOES-NOT-EXIST\.md/);
  assert.doesNotMatch(stdout, /record exempt/);
});

const git = (cwd, ...args) => spawnSync('git', args, { cwd, stdio: 'ignore' });

function gitFixture({ ignore = 'generated/\n', forceAdd = false } = {}) {
  const root = fixtureRepo();
  mkdirSync(join(root, 'generated'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), ignore);
  writeFileSync(join(root, 'generated/report.json'), '[]');
  writeFileSync(join(root, 'docs/guide.md'), '# Guide\n\nThe build writes `generated/report.json`.\n');
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  if (forceAdd) git(root, 'add', '-f', 'generated/report.json');
  return root;
}

test('a document citing a file that git ignores fails, naming the path and the rule, though the file is on disk', () => {
  const { status, stdout } = runGate(gitFixture());
  assert.equal(status, 1);
  assert.match(stdout, /ignored-path docs\/guide\.md: generated\/report\.json/);
  assert.match(stdout, /\.gitignore:1 \(generated\/\)/);
  assert.match(stdout, /clean checkout/);
  assert.doesNotMatch(stdout, /dead-path/);
});

test('the same citation passes when git does not ignore the file', () => {
  const { status, stdout } = runGate(gitFixture({ ignore: '' }));
  assert.equal(status, 0);
  assert.match(stdout, /^docs: 2 files checked, 0 findings$/m);
});

test('a file that matches an ignore pattern but was force-added is tracked, so a clean checkout holds it', () => {
  const { status, stdout } = runGate(gitFixture({ forceAdd: true }));
  assert.equal(status, 0);
  assert.match(stdout, /^docs: 2 files checked, 0 findings$/m);
});

test('a build-output citation is never an ignored-path finding, because the build is ignored by design', () => {
  const root = gitFixture({ ignore: 'site/dist/\n' });
  mkdirSync(join(root, 'site/dist'), { recursive: true });
  writeFileSync(join(root, 'site/dist/gate-routes.json'), '{}');
  writeFileSync(join(root, 'docs/guide.md'), '# Guide\n\nThe gate reads `dist/gate-routes.json`.\n');
  git(root, 'add', '-A');
  const { status, stdout } = runGate(root);
  assert.equal(status, 0);
  assert.match(stdout, /^docs: 2 files checked, 0 findings$/m);
});

test('with git unavailable the ignore check is skipped and named, never failed', () => {
  const root = gitFixture();
  const noGit = mkdtempSync(join(tmpdir(), 'docs-gate-no-git-'));
  const { status, stdout } = spawnSync(process.execPath, [RUN_SCRIPT, root], {
    encoding: 'utf8',
    env: { PATH: noGit },
  });
  assert.equal(status, 0);
  assert.doesNotMatch(stdout, /ignored-path docs/);
  assert.match(stdout, /^docs: 2 files checked, 0 findings, ignored-path check skipped \(git could not answer\)$/m);
});

test('outside a repository the ignore check is skipped the same way', () => {
  const root = fixtureRepo();
  writeFileSync(join(root, 'docs/guide.md'), '# Guide\n\nSee `site/package.json`.\n');
  const { status, stdout } = runGate(root);
  assert.equal(status, 0);
  assert.match(stdout, /ignored-path check skipped/);
});
