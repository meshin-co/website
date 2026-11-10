import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { SCENE_FILES, SCENE_TEXT } from './fixtures/partition-scene.mjs';

const runner = join(import.meta.dirname, 'run-partition-gate.mjs');
const roots = [];

function repository(extra = [], text = {}) {
  const root = mkdtempSync(join(tmpdir(), 'partition-'));
  roots.push(root);
  for (const file of [...SCENE_FILES, ...extra]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text[file] ?? SCENE_TEXT[file] ?? '');
  }
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['add', '-A'], { cwd: root });
  return root;
}

const run = (...args) => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test('a tracked tree where every file fits a rule exits 0 and ends with the three counts', () => {
  const result = run('--root', repository());
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^partition: \d+ engine, \d+ site, \d+ evidence files; 0 findings$/m);
});

test('a stray tracked file exits 1 and is named in a PARTITION line', () => {
  const result = run('--root', repository(['mystery.bin']));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^PARTITION unclassified mystery\.bin: /m);
  assert.match(result.stdout, /; 1 finding$/m);
});

test('--list prints each file with its class and the rule that gave it', () => {
  const result = run('--root', repository(), '--list');
  assert.match(result.stdout, /^engine seed-template seed\/docs\/SEMANTIC-CORE\.md\.seed$/m);
  assert.match(result.stdout, /^site seeded docs\/SEMANTIC-CORE\.md$/m);
});

test('a tree with no engine configuration reports the unreadable fact as a finding and exits 1', () => {
  const root = mkdtempSync(join(tmpdir(), 'partition-'));
  roots.push(root);
  writeFileSync(join(root, 'README.md'), 'x');
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['add', '-A'], { cwd: root });
  const result = run('--root', root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^PARTITION facts-unreadable /m);
});

test('an unknown option exits 2 with the usage line', () => {
  const result = run('--nope');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage: node scripts\/run-partition-gate\.mjs/);
});

const bareDirectory = () => {
  const root = mkdtempSync(join(tmpdir(), 'partition-bare-'));
  roots.push(root);
  writeFileSync(join(root, 'a.txt'), 'a\n');
  return root;
};

test('a directory that is not a repository is refused with the sentence that names git init, and no stack trace', () => {
  const root = bareDirectory();
  const result = run('--root', root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(`^PARTITION not-a-repository ${root}: .*git init && git add -A`, 'm'));
  assert.match(result.stdout, /^partition: 0 engine, 0 site, 0 evidence files; 1 finding$/m);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout + result.stderr, /\n\s+at |Command failed/);
});

test('a repository where nothing is staged is refused with the sentence that names git add, not judged as 22 unserved anchors', () => {
  const root = bareDirectory();
  spawnSync('git', ['init', '-q'], { cwd: root });
  const result = run('--root', root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(`^PARTITION nothing-tracked ${root}: .*git add -A`, 'm'));
  assert.doesNotMatch(result.stdout, /anchor-unserved/);
  assert.equal(result.stderr, '');
});

const NAMES_THE_SITE = { 'site/.agents/skills/names-the-site.md': '# Skill\n\nAsk the owner of example.test.\n' };
const ALSO_NAMES_THE_SITE = { 'site/.agents/skills/also-names-the-site.md': '# Skill\n\nWrite to example.test.\n' };

test('a tree whose only finding is site-bound fails by default', () => {
  const result = run('--root', repository(Object.keys(NAMES_THE_SITE), NAMES_THE_SITE));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^PARTITION site-bound site\/\.agents\/skills\/names-the-site\.md: /m);
});

test('--allow site-bound=1 prints the one file, marks it ALLOWED, counts it and exits 0', () => {
  const result = run('--root', repository(Object.keys(NAMES_THE_SITE), NAMES_THE_SITE), '--allow', 'site-bound=1');
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^ALLOWED site-bound site\/\.agents\/skills\/names-the-site\.md: /m);
  assert.match(result.stdout, /; 0 findings; 1 allowed$/m);
});

test('--allow site-bound=1 never hides a file that fits no rule', () => {
  const root = repository(['mystery.bin', ...Object.keys(NAMES_THE_SITE)], NAMES_THE_SITE);
  const result = run('--root', root, '--allow', 'site-bound=1');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^PARTITION unclassified mystery\.bin: /m);
  assert.match(result.stdout, /; 1 finding; 1 allowed$/m);
});

test('a file over the ceiling fails: every file that names the site is enforced and the ceiling line says why', () => {
  const text = { ...NAMES_THE_SITE, ...ALSO_NAMES_THE_SITE };
  const result = run('--root', repository(Object.keys(text), text), '--allow', 'site-bound=1');
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /^PARTITION site-bound site\/\.agents\/skills\/names-the-site\.md: /m);
  assert.match(result.stdout, /^PARTITION site-bound site\/\.agents\/skills\/also-names-the-site\.md: /m);
  assert.match(
    result.stdout,
    /^PARTITION site-bound-ceiling 2 files: 1 is allowed, so a new engine file names the site/m
  );
  assert.doesNotMatch(result.stdout, /^ALLOWED /m);
});

test('fewer files than the ceiling passes and says how far the ceiling can drop', () => {
  const result = run('--root', repository(Object.keys(NAMES_THE_SITE), NAMES_THE_SITE), '--allow', 'site-bound=3');
  assert.equal(result.status, 0, result.stdout);
  assert.match(
    result.stdout,
    /^NOTE site-bound: 1 file names the site and 3 are allowed; lower --allow to site-bound=1$/m
  );
});

test('only site-bound can be allowed, and only with a number of files: any other form is a usage error', () => {
  for (const flag of ['unclassified=3', 'site-bound', 'site-bound=many']) {
    const result = run('--root', repository(), '--allow', flag);
    assert.equal(result.status, 2, flag);
    assert.match(result.stderr, /--allow takes site-bound=<number of files>/, flag);
  }
});

test('a tracked file deleted from the working tree is not part of the tree: an anchor its seed served is unserved', () => {
  const root = repository();
  rmSync(join(root, 'seed/site/src/data/tags.mjs.seed'));
  const result = run('--root', root);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /^PARTITION anchor-unserved site\/src\/data\/tags\.mjs: /m);
});
