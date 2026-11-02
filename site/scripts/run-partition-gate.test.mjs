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

const NAMES_THE_SITE = { 'site/.agents/skills/names-the-site.md': '# Skill\n\nAsk the owner of example.test.\n' };

test('a tree whose only finding is site-bound fails by default', () => {
  const result = run('--root', repository(Object.keys(NAMES_THE_SITE), NAMES_THE_SITE));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^PARTITION site-bound site\/\.agents\/skills\/names-the-site\.md: /m);
});

test('--allow site-bound still prints the file, marks it ALLOWED, counts it and exits 0', () => {
  const result = run('--root', repository(Object.keys(NAMES_THE_SITE), NAMES_THE_SITE), '--allow', 'site-bound');
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /^ALLOWED site-bound site\/\.agents\/skills\/names-the-site\.md: /m);
  assert.match(result.stdout, /; 0 findings; 1 allowed$/m);
});

test('--allow site-bound never hides a file that fits no rule', () => {
  const root = repository(['mystery.bin', ...Object.keys(NAMES_THE_SITE)], NAMES_THE_SITE);
  const result = run('--root', root, '--allow', 'site-bound');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^PARTITION unclassified mystery\.bin: /m);
  assert.match(result.stdout, /; 1 finding; 1 allowed$/m);
});

test('only site-bound can be allowed: any other rule is a usage error', () => {
  const result = run('--root', repository(), '--allow', 'unclassified');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /only site-bound can be allowed/);
});

test('a tracked file deleted from the working tree is not part of the tree: an anchor its seed served is unserved', () => {
  const root = repository();
  rmSync(join(root, 'seed/site/src/data/tags.mjs.seed'));
  const result = run('--root', root);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /^PARTITION anchor-unserved site\/src\/data\/tags\.mjs: /m);
});
