import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mainWriteFindings } from './main-write-scan.mjs';

const scan = (text, path = 'x.yml') => mainWriteFindings([{ path, text }]);
const REMOVED = ['commit', 'to', 'main'].join('-');

const FLAGGED = {
  'a push to origin main': ['git push origin main', 'push-origin-main'],
  'a forced push to main': ['git push --force origin main', 'push-origin-main'],
  'a push to master': ['git push origin master', 'push-origin-main'],
  'a push to a full ref of main': ['git push origin refs/heads/main', 'push-origin-main'],
  'a push of HEAD to main': ['git push origin HEAD:main', 'push-head-to-main'],
  'a push of HEAD to a full ref of main': ['git push origin HEAD:refs/heads/main', 'push-head-to-main'],
  'a commit with the ref main': ['node scripts/commit-branch.mjs --ref main', 'commit-ref-main'],
  'a commit with the ref given by an equals sign': ['node x.mjs --ref=refs/heads/main', 'commit-ref-main'],
  'a push in a script array': ["spawn('git', ['push', 'origin', 'main'])", 'push-array-main'],
  'a push without a refspec': ['git push', 'push-without-refspec'],
  'a push of the remote alone': ['git push origin', 'push-without-refspec'],
  'a write through the refs api': ['gh api -X PATCH repos/x/y/git/refs/heads/main', 'ref-update-main'],
  'the removed script': [`node scripts/${REMOVED}.mjs --message x --path y`, 'removed-commit-script'],
  'the removed script imported': [`import { runGit } from './${REMOVED}.mjs';`, 'removed-commit-script'],
};

for (const [name, [text, rule]] of Object.entries(FLAGGED)) {
  test(`${name} is flagged as ${rule}`, () => {
    const found = scan(text);

    assert.equal(found.length, 1);
    assert.equal(found[0].rule, rule);
    assert.equal(found[0].line, 1);
    assert.equal(found[0].text, text);
  });
}

for (const text of [
  'git push origin HEAD:refs/heads/autowriter-state',
  'git push origin refs/heads/autowriter/x:refs/heads/autowriter/x',
  'git push origin autowriter/x',
  'git push origin autowriter-state',
  "spawn('git', ['push', 'origin', 'HEAD:refs/heads/autowriter-state'])",
  'git fetch origin main',
  'git checkout main',
  'git merge origin/main',
  'git log origin/main..HEAD',
  'echo "main"',
]) {
  test(`${text} is not flagged`, () => {
    assert.deepEqual(scan(text), []);
  });
}

for (const text of [
  'description: Run the whole graph, the way a push to main does',
  '  description: a push to main publishes its own build',
  'name: push origin main',
  '      - name: push origin HEAD',
  'run-name: push to main',
  '# git push origin main',
  '      # a push to main',
  '// git push origin main',
]) {
  test(`the text-only line "${text.trim()}" runs nothing, so it is not flagged`, () => {
    assert.deepEqual(scan(text), []);
  });
}

test('a workflow dispatch that names the ref main starts a run on main and writes nothing to it', () => {
  assert.deepEqual(scan('gh workflow run watch-pr.yml --ref main -f pr="${url##*/}"'), []);
  assert.deepEqual(scan('          gh workflow run write-daily.yml --ref main'), []);
});

test('a dispatch does not hide a write chained after it on the same line', () => {
  const found = scan('gh workflow run watch-pr.yml --ref main && git push origin main');

  assert.equal(found.length, 1);
  assert.equal(found[0].rule, 'push-origin-main');
});

test('a write on a line of a run block is flagged with its own line number', () => {
  const found = scan(['run: |', '  echo start', '  git push origin main', '  echo done'].join('\n'));

  assert.equal(found.length, 1);
  assert.equal(found[0].line, 3);
  assert.equal(found[0].text, 'git push origin main');
});

test('a command split over lines with backslashes is judged as one line and reported at its first line', () => {
  const found = scan(['run: |', '  git push origin \\', '    main'].join('\n'));

  assert.equal(found.length, 1);
  assert.equal(found[0].rule, 'push-origin-main');
  assert.equal(found[0].line, 2);
});

test('every finding names the file it was found in', () => {
  const found = mainWriteFindings([
    { path: 'a.yml', text: 'git push origin main' },
    { path: 'b.mjs', text: 'echo clean' },
    { path: 'c.yml', text: 'git push' },
  ]);

  assert.deepEqual(
    found.map(({ path, rule }) => [path, rule]),
    [
      ['a.yml', 'push-origin-main'],
      ['c.yml', 'push-without-refspec'],
    ]
  );
});

test('no file at all gives no finding', () => {
  assert.deepEqual(mainWriteFindings([]), []);
});
