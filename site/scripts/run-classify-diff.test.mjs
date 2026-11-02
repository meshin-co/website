import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after as afterAll, test } from 'node:test';

import { commitIn, gitAt, makeDiffRepo, removeRepo } from './fixtures/diff-repo.mjs';

const SCRIPT = join(import.meta.dirname, 'run-classify-diff.mjs');
const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const roots = [];
afterAll(() => roots.forEach(removeRepo));

const run = (args, cwd = tmpdir()) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });

function scene(change) {
  const root = makeDiffRepo();
  roots.push(root);
  const before = gitAt(root, 'rev-parse', 'HEAD');
  commitIn(root, change);
  return { root, before, after: gitAt(root, 'rev-parse', 'HEAD') };
}

const flags = ({ root, before, after }) => ['--repository', root, '--before', before, '--after', after];

test('a prose commit prints code=false on stdout and nothing else there, with the reasons on stderr', () => {
  const found = run(flags(scene({ write: { 'docs/PRD.md': '# v2\n' } })));
  assert.equal(found.status, 0, found.stderr);
  assert.equal(found.stdout, 'code=false\n');
  assert.match(found.stderr, /^classify: diff before [0-9a-f]{12} \.\. [0-9a-f]{12}$/m);
  assert.match(found.stderr, /^classify: build surface changed: false$/m);
});

test('a build commit prints code=true', () => {
  const found = run(flags(scene({ write: { 'site/src/pages/index.astro': '<h1>x</h1>\n' } })));
  assert.equal(found.status, 0, found.stderr);
  assert.equal(found.stdout, 'code=true\n');
  assert.match(found.stderr, /^classify: {3}build {4}site\/src\/pages\/index\.astro$/m);
});

test('an empty before is a legal flag value, because a pull request sends none', () => {
  const { root, after } = scene({ write: { 'docs/PRD.md': '# v2\n' } });
  const found = run(['--repository', root, '--before', '', '--after', after]);
  assert.equal(found.status, 0, found.stderr);
  assert.equal(found.stdout, 'code=false\n');
});

for (const [label, args] of [
  ['no after', ['--before', 'abc']],
  ['an empty after', ['--before', 'abc', '--after', '']],
  ['an unknown flag', ['--after', 'abc', '--verbose']],
  ['a flag with no value', ['--after']],
  ['a bare word', ['--after', 'abc', 'extra']],
]) {
  test(`${label} is a wiring mistake: exit 2, nothing on stdout, and the usage on stderr`, () => {
    const found = run(args);
    assert.equal(found.status, 2);
    assert.equal(found.stdout, '');
    assert.match(found.stderr, /usage: node scripts\/run-classify-diff\.mjs --before/);
  });
}

test('the answer is the same from the repository root, from site and from anywhere else', () => {
  const given = scene({ write: { 'site/src/pages/index.astro': '<h1>x</h1>\n', 'docs/PRD.md': '# v2\n' } });
  const answers = [REPOSITORY, join(REPOSITORY, 'site'), tmpdir()].map((cwd) => run(flags(given), cwd));
  for (const found of answers) {
    assert.equal(found.status, 0, found.stderr);
    assert.equal(found.stdout, 'code=true\n');
  }
  assert.deepEqual(new Set(answers.map(({ stderr }) => stderr)).size, 1);
});

test('with no --repository the checkout is found from the script, never from the working directory', () => {
  const found = run(['--before', 'HEAD', '--after', 'HEAD'], tmpdir());
  assert.equal(found.status, 0, found.stderr);
  assert.equal(found.stdout, 'code=true\n');
  assert.match(found.stderr, /no path changed between the base and the commit/);
  assert.doesNotMatch(found.stderr, /could not read the diff/);
});
