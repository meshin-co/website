import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { MIRROR_FILE, mirrorAccount, mirrorProblems, mirrorSummary, specMirrors } from './spec-artefacts.mjs';

const ENTRY = {
  filePath: 'src/data/spec/evals-baseline-1.0.md',
  data: { name: 'evals-baseline', version: '1.0' },
};
const NOTHING_DECLARED = { declared: 0, compared: 0, skipped: [], problems: [] };
const PRESENT = { checkout: 'upstream', path: 'fixtures/vectors.json' };
const ABSENT = { checkout: 'no-such-checkout', path: 'fixtures/vectors.json' };

function newRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'spec-mirrors-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFolder(root, name, { stored = 'abc', declaration = { 'vectors.json': PRESENT } } = {}) {
  const folder = join(root, 'src/data/spec', name);
  mkdirSync(folder, { recursive: true });
  if (stored !== null) writeFileSync(join(folder, 'vectors.json'), stored);
  if (declaration !== null) {
    writeFileSync(
      join(folder, MIRROR_FILE),
      typeof declaration === 'string' ? declaration : JSON.stringify(declaration)
    );
  }
  return folder;
}

function writeUpstream(root, text = 'abc') {
  mkdirSync(join(root, 'upstream/fixtures'), { recursive: true });
  writeFileSync(join(root, 'upstream/fixtures/vectors.json'), text);
}

test('a folder that declares no mirror has nothing declared, compared or skipped', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', { declaration: null });
  assert.deepEqual(mirrorAccount(ENTRY, { root }), NOTHING_DECLARED);
});

test('a copy equal to its upstream file is declared and compared', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0');
  writeUpstream(root);
  assert.deepEqual(mirrorAccount(ENTRY, { root }), { declared: 1, compared: 1, skipped: [], problems: [] });
});

test('a copy that differs from its upstream file is compared, and its problem is kept', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', { stored: 'abc' });
  writeUpstream(root, 'abd');
  const account = mirrorAccount(ENTRY, { root });
  assert.equal(account.declared, 1);
  assert.equal(account.compared, 1);
  assert.deepEqual(account.skipped, []);
  assert.equal(account.problems.length, 1);
  assert.deepEqual(account.problems, mirrorProblems(ENTRY, { root }));
});

test('a checkout that is not on this machine is declared and not compared, and the skip names the path it looked for and the value the declaration holds', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', { declaration: { 'vectors.json': ABSENT } });
  assert.deepEqual(mirrorAccount(ENTRY, { root }), {
    declared: 1,
    compared: 0,
    skipped: [
      {
        file: 'vectors.json',
        reason: `no checkout at ${join(root, 'no-such-checkout')}, which ${MIRROR_FILE} declares as no-such-checkout`,
      },
    ],
    problems: [],
  });
});

test('a checkout that is here but holds no such file is a problem and not a skip', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', {
    declaration: { 'vectors.json': { ...PRESENT, path: 'fixtures/vector.json' } },
  });
  writeUpstream(root);
  const account = mirrorAccount(ENTRY, { root });
  assert.equal(account.declared, 1);
  assert.equal(account.compared, 0);
  assert.deepEqual(account.skipped, []);
  assert.equal(account.problems.length, 1);
  assert.match(account.problems[0], /holds no fixtures\/vector\.json/);
  assert.match(account.problems[0], /the layout of that checkout moved/);
});

test('a declared file that is not in the folder is a problem and not a skip, even when the checkout is absent', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', { stored: null, declaration: { 'vectors.json': ABSENT } });
  const account = mirrorAccount(ENTRY, { root });
  assert.equal(account.compared, 0);
  assert.deepEqual(account.skipped, []);
  assert.equal(account.problems.length, 1);
});

test('a declaration that is not valid declares nothing and is a problem', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', { declaration: '{' });
  const account = mirrorAccount(ENTRY, { root });
  assert.equal(account.declared, 0);
  assert.equal(account.compared, 0);
  assert.equal(account.problems.length, 1);
});

test('each declared file is counted by itself: one compared, one not', (t) => {
  const root = newRoot(t);
  const folder = writeFolder(root, 'evals-baseline-1.0', {
    declaration: { 'vectors.json': PRESENT, 'baseline.schema.json': ABSENT },
  });
  writeFileSync(join(folder, 'baseline.schema.json'), 'x');
  writeUpstream(root);
  const account = mirrorAccount(ENTRY, { root });
  assert.equal(account.declared, 2);
  assert.equal(account.compared, 1);
  assert.deepEqual(
    account.skipped.map(({ file }) => file),
    ['baseline.schema.json']
  );
  assert.deepEqual(account.problems, []);
});

test('a tree with no specification folder declares no mirror', (t) => {
  assert.deepEqual(specMirrors({ root: newRoot(t) }), NOTHING_DECLARED);
});

test('every folder that holds a mirror declaration is counted, and a folder that holds none is not', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0');
  writeFolder(root, 'zz-2.0', { declaration: { 'vectors.json': ABSENT } });
  writeFolder(root, 'plain-1.0', { declaration: null });
  writeUpstream(root);
  const account = specMirrors({ root });
  assert.equal(account.declared, 2);
  assert.equal(account.compared, 1);
  assert.deepEqual(
    account.skipped.map(({ file }) => file),
    ['src/data/spec/zz-2.0/vectors.json']
  );
  assert.deepEqual(account.problems, []);
});

test('a problem found in a folder names the folder it was found in', (t) => {
  const root = newRoot(t);
  writeFolder(root, 'evals-baseline-1.0', { stored: 'abc' });
  writeUpstream(root, 'abd');
  const { problems } = specMirrors({ root });
  assert.equal(problems.length, 1);
  assert.ok(problems[0].startsWith('src/data/spec/evals-baseline-1.0: vectors.json is not the upstream file'));
});

test('the summary of a tree that declares no mirror says so', () => {
  assert.deepEqual(mirrorSummary(NOTHING_DECLARED), ['mirrors: none declared']);
});

test('the summary of mirrors that were all compared is one line of counts', () => {
  assert.deepEqual(mirrorSummary({ declared: 2, compared: 2, skipped: [], problems: [] }), [
    'mirrors: 2 declared, 2 compared, 0 not compared',
  ]);
});

test('the summary says plainly that nothing was compared, and gives the reason of each skip', () => {
  const skipped = [
    { file: 'src/data/spec/a/vectors.json', reason: 'no checkout at /x, which mirror.json declares as ../x' },
  ];
  assert.deepEqual(mirrorSummary({ declared: 1, compared: 0, skipped, problems: [] }), [
    'mirrors: 1 declared, 0 compared, 1 not compared; nothing was compared with an upstream file',
    'not compared: src/data/spec/a/vectors.json: no checkout at /x, which mirror.json declares as ../x',
  ]);
});

test('the summary of a partial comparison counts both sides and does not say that nothing was compared', () => {
  const skipped = [
    { file: 'src/data/spec/b/vectors.json', reason: 'no checkout at /y, which mirror.json declares as ../y' },
  ];
  const [counts, ...reasons] = mirrorSummary({ declared: 3, compared: 2, skipped, problems: [] });
  assert.equal(counts, 'mirrors: 3 declared, 2 compared, 1 not compared');
  assert.deepEqual(reasons, [
    'not compared: src/data/spec/b/vectors.json: no checkout at /y, which mirror.json declares as ../y',
  ]);
});

test('a mirror that could not be compared because of a problem is counted as not compared, without a skip reason', () => {
  const problems = [
    'src/data/spec/a: /c holds no p, so f cannot be compared with it: the layout of that checkout moved',
  ];
  assert.deepEqual(mirrorSummary({ declared: 1, compared: 0, skipped: [], problems }), [
    'mirrors: 1 declared, 0 compared, 1 not compared; nothing was compared with an upstream file',
  ]);
});
