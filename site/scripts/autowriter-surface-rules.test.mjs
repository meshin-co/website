import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { LEGACY_EXCEPTIONS, historyReport, judgeCommit, judgeSurface } from './autowriter-refusal-rules.mjs';
import { SHARED_DERIVED } from './derived-files.mjs';

const RULE = 'unregistered-path-committed';
const RECORD = 'audits/autowriter/generations/2026/11/a-slug.json';
const OBJECT = 'a'.repeat(40);
const REPOSITORY = resolve(import.meta.dirname, '..', '..');

const OWN = [
  RECORD,
  'audits/autowriter/2026/11/a-slug.json',
  'audits/autowriter/claims/2026/11/a-slug.json',
  'audits/phase-4.7/dispositions/2026/11/generated-a-slug.json',
  'site/src/data/post/a-slug.md',
];
const RESTATED = [
  'audits/phase-4.7/dispositions/articles-telemetry.json',
  'audits/phase-4.7/dispositions/2026/11/generated-another-slug.json',
];

const commitOf = (paths, sha = 'c'.repeat(40)) => ({
  sha,
  records: [RECORD],
  changes: [...new Set([RECORD, ...paths])].map((path) => ({ path, before: null, after: OBJECT })),
});

test('a pipeline commit that touches its own files, the shared derived files and restated dispositions is clean', () => {
  assert.deepEqual(judgeSurface(commitOf([...OWN, ...SHARED_DERIVED, ...RESTATED])), []);
});

test("a path that is not the run's own and that the catch-up does not know is a finding that names the path and the registry", () => {
  const [finding, ...rest] = judgeSurface(commitOf(['audits/new-derived-index.json']));

  assert.equal(rest.length, 0);
  assert.equal(finding.rule, RULE);
  assert.equal(finding.path, RECORD);
  assert.match(finding.detail, /touched audits\/new-derived-index\.json, which is not this run's own/);
  assert.match(finding.detail, /derived-files\.mjs/);
  assert.match(finding.detail, /in commit c{12}/);
});

test("another slug's article or record is not this run's own", () => {
  const paths = ['site/src/data/post/another-slug.md', 'audits/autowriter/claims/2026/11/another-slug.json'];

  assert.equal(judgeSurface(commitOf(paths)).length, 2);
});

test('a refused path is reported once, by its own rule, and not again as an unregistered path', () => {
  const commit = commitOf(['audits/sentence-band.json']);

  assert.deepEqual(
    judgeCommit(commit, () => '[]').map(({ rule }) => rule),
    ['refused-path-committed']
  );
  assert.deepEqual(judgeSurface(commit), []);
});

test('the one legacy commit keeps its screenshot baselines, and no other commit may have them', () => {
  const baseline = 'site/tests/__screenshots__/linux/blog.png';
  const [legacy] = LEGACY_EXCEPTIONS;

  assert.deepEqual(judgeSurface(commitOf([baseline], legacy.sha)), []);
  assert.equal(judgeSurface(commitOf([baseline])).length, 1);
  assert.equal(judgeSurface(commitOf(['audits/new-derived-index.json'], legacy.sha)).length, 1);
});

test('the history of this repository holds no pipeline commit with an unregistered path', () => {
  const { findings } = historyReport({ root: REPOSITORY });

  assert.deepEqual(
    findings.filter(({ rule }) => rule === RULE),
    []
  );
});

test('every exception names one commit, described one way, with no path left to a prefix guess', () => {
  for (const { sha, prefix, paths } of LEGACY_EXCEPTIONS) {
    assert.match(sha, /^[0-9a-f]{40}$/);
    assert.ok(
      (prefix === undefined) !== (paths === undefined),
      `${sha} is described both by a prefix and by a path list, and one commit is described one way`
    );
    if (paths !== undefined) assert.ok(paths.length > 0 && paths.every((path) => !path.endsWith('/')));
  }
});

test('an excepted commit is forgiven the paths it names and judged on every other one', () => {
  const { sha, paths } = LEGACY_EXCEPTIONS.find(({ paths: named }) => named !== undefined);
  const excepted = commitOf(paths, sha);
  assert.deepEqual([...judgeCommit(excepted, () => '[]'), ...judgeSurface(excepted)], []);

  const alsoRefused = judgeCommit(commitOf([...paths, 'audits/sentence-band.json'], sha), () => '[]');
  assert.deepEqual(
    alsoRefused.map(({ rule }) => rule),
    ['refused-path-committed']
  );
  assert.match(alsoRefused[0].detail, /audits\/sentence-band\.json/);
});

test('the same paths in any other commit are refused, so the exception is one commit wide', () => {
  const { paths } = LEGACY_EXCEPTIONS.find(({ paths: named }) => named !== undefined);
  const commit = commitOf(paths);
  const elsewhere = [...judgeCommit(commit, () => '[]'), ...judgeSurface(commit)];
  assert.deepEqual([...new Set(elsewhere.map(({ rule }) => rule))].sort(), [
    'refused-path-committed',
    'unregistered-path-committed',
  ]);
});
