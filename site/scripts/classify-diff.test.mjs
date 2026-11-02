import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after as afterAll, test } from 'node:test';

import { classifyDiff } from './classify-diff.mjs';
import { commitIn, gitAt, makeDiffRepo, removeRepo } from './fixtures/diff-repo.mjs';

const roots = [];
const freshRepo = (files) => {
  const root = makeDiffRepo(files);
  roots.push(root);
  return root;
};
afterAll(() => roots.forEach(removeRepo));

const head = (root) => gitAt(root, 'rev-parse', 'HEAD');
const parent = (root) => gitAt(root, 'rev-parse', 'HEAD~1');
const ZEROS = '0'.repeat(40);

const verdictOf = (root, change, { before } = {}) => {
  const start = head(root);
  commitIn(root, change);
  return classifyDiff({ repository: root, before: before ?? start, after: head(root) });
};

const said = ({ lines }) => lines.join('\n');

test('a commit that touches only prose draws no graph, and says how it counted', () => {
  const found = verdictOf(freshRepo(), { write: { 'docs/PRD.md': '# PRD v2\n', 'audits/a.json': '{}\n' } });
  assert.equal(found.code, false);
  assert.match(said(found), /2 changed paths: 2 prose, 0 tooling, 0 build/);
  assert.match(said(found), /build surface changed: false/);
});

test('one build path among prose draws the graph and is named with its class', () => {
  const found = verdictOf(freshRepo(), {
    write: { 'docs/PRD.md': '# PRD v2\n', 'site/src/pages/index.astro': '<h1>changed</h1>\n' },
  });
  assert.equal(found.code, true);
  assert.match(said(found), /build\s+site\/src\/pages\/index\.astro/);
  assert.doesNotMatch(said(found), /prose\s+docs\/PRD\.md/);
  assert.match(said(found), /build surface changed: true/);
});

test('a workflow or a test alone draws the graph, because it changes what the gates do', () => {
  for (const path of ['.github/workflows/ci.yml', 'site/scripts/gate.test.mjs', '.githooks/pre-push']) {
    const found = verdictOf(freshRepo(), { write: { [path]: 'x\n' } });
    assert.equal(found.code, true, path);
    assert.match(said(found), /tooling/, path);
  }
});

test('deleting a build file draws the graph, because a deletion is a change', () => {
  const found = verdictOf(freshRepo(), { remove: ['site/public/robots.txt'] });
  assert.equal(found.code, true);
  assert.match(said(found), /site\/public\/robots\.txt/);
});

test('moving a build file into a prose directory still names the build path it left', () => {
  const found = verdictOf(freshRepo(), { move: [['site/src/pages/index.astro', 'docs/index.md']] });
  assert.equal(found.code, true);
  assert.match(said(found), /build\s+site\/src\/pages\/index\.astro/);
});

test('a path git would quote is read as it is, so a prose file with an accent stays prose', () => {
  const prose = verdictOf(freshRepo(), { write: { 'docs/caf\u00e9 \u201cnotes\u201d.md': 'x\n' } });
  assert.equal(prose.code, false);
  const built = verdictOf(freshRepo(), { write: { 'site/src/pages/caf\u00e9.astro': 'x\n' } });
  assert.equal(built.code, true);
  assert.match(said(built), /site\/src\/pages\/caf\u00e9\.astro/);
});

test('the diff runs from the previous head, so a prose push after a code push draws nothing', () => {
  const root = freshRepo();
  const start = head(root);
  commitIn(root, { write: { 'site/src/pages/index.astro': '<h1>one</h1>\n' } });
  const afterCode = head(root);
  commitIn(root, { write: { 'docs/PRD.md': '# PRD v3\n' } });
  assert.equal(classifyDiff({ repository: root, before: afterCode, after: head(root) }).code, false);
  assert.equal(classifyDiff({ repository: root, before: start, after: head(root) }).code, true);
});

for (const [label, before] of [
  ['an empty before', ''],
  ['an all-zero before, as a new branch sends', ZEROS],
  ['a before this repository has never seen', 'a'.repeat(40)],
  ['a before that is not a revision at all', 'not a revision'],
  ['a before that looks like an option', '--output=/tmp/should-never-exist'],
]) {
  test(`${label} falls back to the parent of the commit, and says so`, () => {
    const root = freshRepo();
    commitIn(root, { write: { 'docs/PRD.md': '# PRD v2\n' } });
    const found = classifyDiff({ repository: root, before, after: head(root) });
    assert.equal(found.code, false);
    assert.match(said(found), /no usable before/);
    assert.match(said(found), new RegExp(parent(root).slice(0, 12)));
    commitIn(root, { write: { 'site/src/pages/index.astro': '<h1>x</h1>\n' } });
    assert.equal(classifyDiff({ repository: root, before, after: head(root) }).code, true);
  });
}

test('a first commit has no parent, so every file in it counts and the graph runs', () => {
  const root = freshRepo();
  const first = gitAt(root, 'rev-list', '--max-parents=0', 'HEAD');
  const found = classifyDiff({ repository: root, before: ZEROS, after: first });
  assert.equal(found.code, true);
  assert.match(said(found), /first commit/);
});

test('a diff that names no path proves nothing about its base, so the graph runs', () => {
  const root = freshRepo();
  const found = classifyDiff({ repository: root, before: head(root), after: head(root) });
  assert.equal(found.code, true);
  assert.match(said(found), /no path changed/);
});

test('an after that does not resolve draws the graph and never throws', () => {
  const root = freshRepo();
  const found = classifyDiff({ repository: root, before: head(root), after: 'f'.repeat(40) });
  assert.equal(found.code, true);
  assert.match(said(found), /could not read the diff/);
});

test('a directory that is no repository draws the graph and never throws', () => {
  const found = classifyDiff({
    repository: mkdtempSync(join(tmpdir(), 'not-a-repo-')),
    before: ZEROS,
    after: 'a'.repeat(40),
  });
  assert.equal(found.code, true);
  assert.match(said(found), /could not read the diff/);
});

test('a repository whose shipped directories the rules do not find draws the graph, even for prose', () => {
  const root = freshRepo({ 'docs/PRD.md': '# PRD\n', 'content/post/a.md': 'a\n' });
  const found = verdictOf(root, { write: { 'content/post/a.md': 'changed\n' } });
  assert.equal(found.code, true);
  assert.match(said(found), /shipped directory site\/src\/ is not in this checkout/);
});

test('a long list of build paths is cut short and says how many it left out', () => {
  const write = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`site/src/pages/p${index}.astro`, 'x\n']));
  const found = verdictOf(freshRepo(), { write });
  assert.equal(found.code, true);
  assert.match(said(found), /30 changed paths: 0 prose, 0 tooling, 30 build/);
  assert.match(said(found), /and 18 more/);
  assert.equal(found.lines.filter((line) => /^\s+build\s/.test(line)).length, 12);
});
