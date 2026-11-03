import assert from 'node:assert/strict';
import test from 'node:test';

import { diffScope } from './diff-scope.mjs';
import { changedFiles } from './spec-gate.mjs';

const UNBORN = '0000000000000000000000000000000000000000..abc1234';

const scripted = (answers) => {
  const calls = [];
  const git = (args) => {
    const call = args.join(' ');
    calls.push(call);
    return call in answers ? answers[call] : '';
  };
  git.calls = calls;
  return git;
};

test('a named range is read once, and the base is the side the range starts from', () => {
  const git = scripted({ 'diff --name-only aaa111..bbb222': 'site/src/a.md\n\nsite/src/b.md\n' });

  assert.deepEqual(diffScope({ git, range: 'aaa111..bbb222' }), {
    base: 'aaa111',
    files: ['site/src/a.md', 'site/src/b.md'],
  });
  assert.deepEqual(git.calls, ['diff --name-only aaa111..bbb222']);
});

test('a three-dot range starts from the same side as a two-dot one', () => {
  const git = scripted({ 'diff --name-only aaa111...bbb222': 'x.md\n' });

  assert.equal(diffScope({ git, range: 'aaa111...bbb222' }).base, 'aaa111');
});

test('with no range the base is the merge base with main, and committed, working and untracked files merge once', () => {
  const git = scripted({
    'merge-base HEAD origin/main': 'base9\n',
    'diff --name-only base9..HEAD': 'a.md\nb.md\n',
    'diff --name-only HEAD': 'b.md\n',
    'ls-files --others --exclude-standard': 'c.md\n',
  });

  assert.deepEqual(diffScope({ git }), { base: 'base9', files: ['a.md', 'b.md', 'c.md'] });
});

test('a range of a branch that has no history yet falls back to the merge base, and says so in the base', () => {
  const git = scripted({
    [`diff --name-only ${UNBORN}`]: null,
    'merge-base HEAD origin/main': 'base9\n',
    'diff --name-only base9..HEAD': 'fallback.md\n',
  });

  const scope = diffScope({ git, range: UNBORN });

  assert.equal(scope.base, 'base9');
  assert.deepEqual(scope.files, ['fallback.md']);
});

test('a range whose first side is not in the history falls back to the merge base', () => {
  const git = scripted({
    'diff --name-only gone..HEAD': null,
    'merge-base HEAD origin/main': 'base9\n',
    'diff --name-only base9..HEAD': 'fallback.md\n',
  });

  assert.deepEqual(diffScope({ git, range: 'gone..HEAD' }), { base: 'base9', files: ['fallback.md'] });
});

test('with neither a usable range nor a main to compare with there is no base, so nothing can be called inherited', () => {
  const git = scripted({ 'merge-base HEAD origin/main': null, 'diff --name-only HEAD': 'w.md\n' });

  assert.deepEqual(diffScope({ git }), { base: null, files: ['w.md'] });
  assert.equal(diffScope({ git: () => null }).base, null);
});

test('the spec gate still reads its files through the same scope', () => {
  const git = scripted({ 'diff --name-only x..y': 'ranged.md\n' });

  assert.deepEqual(changedFiles({ git, range: 'x..y' }), diffScope({ git, range: 'x..y' }).files);
});
