import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { THIRD_PATH, exceptedCommitWithAThirdPath, legacySpecimens } from './autowriter-legacy-specimens.mjs';
import {
  SQUASH_OF_133,
  historyReport,
  judgeCommit,
  judgeSurface,
  pipelineCommits,
  repositoryGit,
} from './autowriter-refusal-rules.mjs';
import { BOT, HUMAN, commitAs, gitIn, initRepo, removeRepos, shallowClone } from './fixtures/history-repo.mjs';
import { FAMILIES, manifestFamilies } from './mutation-smoke.mjs';
import { SPECIMENS } from './mutation-specimens.mjs';
import { recordPath } from './record-layout.mjs';

const NAME = 'autowriterExceptedCommitTouchesAThirdPath';
const RECORD = recordPath('generation', 'first-post', '2026-11-01T07:00:00.000Z');
const FUSED = [RECORD, ...SQUASH_OF_133.paths];

const made = [];
after(() => removeRepos(...made));
const track = (root) => {
  made.push(root);
  return root;
};

const repoWithTheFusedCommit = () => {
  const root = track(initRepo());
  commitAs(root, HUMAN, { write: { 'README.md': 'start\n' }, message: 'chore(fixture): start' });
  const sha = commitAs(root, BOT, {
    write: Object.fromEntries(FUSED.map((path) => [path, '{}\n'])),
    message: `feat(autowriter): write first-post\n\nProvenance: ${RECORD}`,
  });
  commitAs(root, HUMAN, { write: { 'later.txt': 'later\n' }, message: 'chore(fixture): later' });
  return { root, sha };
};

const judged = (root, sha) => pipelineCommits(repositoryGit(root)).find((commit) => commit.sha === sha);
const changed = (commit) => commit.changes.map(({ path }) => path).sort();
const asTheSquash = (commit) => ({ ...commit, sha: SQUASH_OF_133.sha });
const findingsFor = (commit) => [...judgeCommit(commit, () => '[]'), ...judgeSurface(commit)];
const stateOf = (root) => ({
  head: gitIn(root, ['rev-parse', 'HEAD']).trim(),
  index: readFileSync(join(root, '.git/index')),
  status: gitIn(root, ['status', '--porcelain=v1', '--untracked-files=all']),
  replaced: gitIn(root, ['replace', '--list']),
});

test('a different commit that touches both paths of the squash of #133 is refused for each path, once', () => {
  const { root } = repoWithTheFusedCommit();
  const { findings } = historyReport({ root });

  assert.deepEqual(findings.map(({ rule }) => rule).sort(), ['refused-path-committed', 'unregistered-path-committed']);
  for (const path of SQUASH_OF_133.paths)
    assert.equal(findings.filter(({ detail }) => detail.includes(path)).length, 1, path);
});

test('the plant gives a commit a third path under its own hash, touches no branch, index or file, and the undo takes it back', async () => {
  const { root, sha } = repoWithTheFusedCommit();
  const before = stateOf(root);
  assert.deepEqual(changed(judged(root, sha)), [...FUSED].sort());

  const restore = await exceptedCommitWithAThirdPath(sha).plant(join(root, 'site'));
  const during = stateOf(root);

  assert.deepEqual(changed(judged(root, sha)), [...FUSED, THIRD_PATH].sort());
  assert.notEqual(during.replaced, before.replaced);
  assert.deepEqual({ ...during, replaced: '' }, { ...before, replaced: '' });
  await restore();
  assert.deepEqual(stateOf(root), before);
  assert.deepEqual(changed(judged(root, sha)), [...FUSED].sort());
});

test('judged as the squash of #133, the commit with a third path is refused for that path alone, under the token the registry names', async () => {
  const { root, sha } = repoWithTheFusedCommit();
  assert.deepEqual(findingsFor(asTheSquash(judged(root, sha))), []);

  const restore = await exceptedCommitWithAThirdPath(sha).plant(join(root, 'site'));
  const [only, ...rest] = findingsFor(asTheSquash(judged(root, sha)));
  await restore();

  assert.equal(rest.length, 0);
  assert.equal(only.rule, 'unregistered-path-committed');
  assert.ok(only.detail.includes(SPECIMENS[NAME].token), only.detail);
});

test('a plant for a commit the repository does not hold says so and writes nothing', async () => {
  const { root } = repoWithTheFusedCommit();
  const before = stateOf(root);

  await assert.rejects(
    () => exceptedCommitWithAThirdPath('4'.repeat(40)).plant(join(root, 'site')),
    /is not in the history/
  );
  assert.deepEqual(stateOf(root), before);
});

test('a plant outside a git repository fails before it writes anything, and says so', async () => {
  const plain = mkdtempSync(join(tmpdir(), 'autowriter-legacy-specimens-plain-'));
  try {
    await assert.rejects(
      () => exceptedCommitWithAThirdPath(SQUASH_OF_133.sha).plant(join(plain, 'site')),
      /is not a git repository/
    );
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test('a plant in a shallow clone fails and leaves the repository as it was', async () => {
  const { root, sha } = repoWithTheFusedCommit();
  const clone = track(shallowClone(root));
  const before = stateOf(clone);

  await assert.rejects(() => exceptedCommitWithAThirdPath(sha).plant(join(clone, 'site')), /shallow/);
  assert.deepEqual(stateOf(clone), before);
});

test('the specimen is registered against gate:autowriter with a token that names the real commit, and the smoke runs it as a family', () => {
  assert.deepEqual(Object.keys(legacySpecimens()), [NAME]);
  assert.equal(SPECIMENS[NAME].gate, 'gate:autowriter');
  assert.ok(SPECIMENS[NAME].token.includes(THIRD_PATH));
  assert.ok(SPECIMENS[NAME].token.endsWith(`in commit ${SQUASH_OF_133.sha.slice(0, 12)}`));
  const family = manifestFamilies(FAMILIES).find(({ specimen }) => specimen === NAME);
  assert.equal(family?.kind, 'specimen');
  assert.equal(family.id, 'autowriter-excepted-commit-touches-a-third-path');
});
