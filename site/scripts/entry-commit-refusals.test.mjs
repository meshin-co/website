import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { refusalFor } from './autowriter-refusals.mjs';
import { restatedReason } from './disposition-restate.mjs';
import { commitRepair, commitRoute } from './entry-commit.mjs';
import {
  BRANCH,
  changedGit,
  committedFiles,
  MESSAGE,
  onBranch,
  refusedWith,
  scene,
  stateOf,
} from './fixtures/commit-scene.mjs';
import { gitRun } from './fixtures/git-run.mjs';
import { FIXTURE_IDENTITY, gitIn } from './fixtures/route-repo.mjs';
import { generationFile } from './generation-record.mjs';

const cleanup = [];
const open = () => {
  const made = scene();
  cleanup.push(made.root);
  return made;
};
afterEach(() => {
  for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
});

const commit = ({ root, files }, run = gitRun()) =>
  commitRoute({ repoRoot: root, branch: BRANCH, files, message: MESSAGE, run });
const repair = ({ root, files }, run = gitRun()) => commitRepair({ repoRoot: root, files, message: MESSAGE, run });
const BOTH = [
  ['a new route', commit, () => {}],
  ['a repair', repair, onBranch],
];

const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
const heldRoutes = (root) => JSON.parse(gitIn(root, 'show', `HEAD:${ROUTES}`));
const asFile = (rows) => `${JSON.stringify(rows, null, 2)}\n`;
const withDigest = (rows, indexes, digest) =>
  rows.map((row, index) => (indexes.includes(index) ? { ...row, digest } : row));
const RESTATE = {
  status: 'rewritten',
  reason: restatedReason({ routes: ['/glossary/model-registry'], slugs: ['model-registry'] }),
};
const restated = (rows, indexes, digest) =>
  rows.map((row, index) => (indexes.includes(index) ? { ...row, ...RESTATE, digest } : row));
const landed = (root, path, text) => {
  writeFileSync(join(root, path), text);
  gitIn(root, 'add', '--', path);
  gitIn(root, ...FIXTURE_IDENTITY, 'commit', '--quiet', '-m', 'an earlier restate');
};

const FORBIDDEN = [
  ['audits/sentence-band.json', 'sentence-band'],
  ['audits/entry-length.json', 'entry-length'],
  ['audits/lighthouse-green.json', 'lighthouse-record'],
  ['audits/phase-zz-specimen/lh-measured.json', 'lighthouse-stamp'],
  ['audits/phase-zz-specimen/lh-desktop/lhr-1.json', 'lighthouse-report'],
  ['Audits/Sentence-Band.json', 'sentence-band'],
];

for (const [kind, write, prepare] of BOTH) {
  for (const [path, id] of FORBIDDEN) {
    test(kind + ' refuses ' + path + ' as ' + id + ', naming why, before anything is touched', async () => {
      const made = open();
      prepare(made);
      const before = stateOf(made.root);
      const run = gitRun();
      const files = [...made.files, { path, text: '{}\n' }];

      await assert.rejects(write({ ...made, files }, run), refusedWith(path, id + ': ' + refusalFor(path).why));
      assert.deepEqual(stateOf(made.root), before);
      assert.ok(!changedGit(run.calls), 'git changed something');
    });
  }

  test(kind + ' refuses a digest that moves under the reason a person wrote, and names the entries', async () => {
    const made = open();
    prepare(made);
    const text = asFile(withDigest(heldRoutes(made.root), [0, 1], 'bbbbbbbbbbbb'));
    const before = stateOf(made.root);
    const run = gitRun();

    await assert.rejects(
      write({ ...made, files: [...made.files, { path: ROUTES, text }] }, run),
      refusedWith(ROUTES, 'disposition-seal:', 'entries: /, /blog head.title')
    );
    assert.deepEqual(stateOf(made.root), before);
    assert.ok(!changedGit(run.calls), 'git changed something');
  });

  test(kind + ' refuses a disposition file that is not a list of dispositions', async () => {
    const made = open();
    prepare(made);
    const before = stateOf(made.root);
    const run = gitRun();

    await assert.rejects(
      write({ ...made, files: [...made.files, { path: ROUTES, text: '{not json' }] }, run),
      refusedWith(ROUTES, 'disposition-unreadable:')
    );
    assert.deepEqual(stateOf(made.root), before);
    assert.ok(!changedGit(run.calls), 'git changed something');
  });

  test(kind + ' lets a restate through, where the digest, the status and the reason all move', async () => {
    const made = open();
    prepare(made);
    const text = asFile(restated(heldRoutes(made.root), [0, 1], 'cccccccccccc'));

    await write({ ...made, files: [...made.files, { path: ROUTES, text }] });

    assert.equal(gitIn(made.root, 'show', 'HEAD:' + ROUTES), text);
    assert.deepEqual(committedFiles(made.root), [...made.listed, ROUTES].sort());
  });

  test(kind + ' lets a restate repeat, where the digest moves again under the reason the pipeline wrote', async () => {
    const made = open();
    landed(made.root, ROUTES, asFile(restated(heldRoutes(made.root), [0, 1], 'cccccccccccc')));
    prepare(made);
    const text = asFile(withDigest(heldRoutes(made.root), [0, 1], 'dddddddddddd'));

    await write({ ...made, files: [...made.files, { path: ROUTES, text }] });

    assert.equal(gitIn(made.root, 'show', 'HEAD:' + ROUTES), text);
  });

  test(
    kind + ' cannot remove a generation record: a listed record with no text is refused before git is touched',
    async () => {
      const made = open();
      prepare(made);
      const record = generationFile('another-entry');
      const before = stateOf(made.root);
      const run = gitRun();

      await assert.rejects(
        write({ ...made, files: [...made.files, { path: record }] }, run),
        refusedWith(record, 'has no text')
      );
      assert.deepEqual(stateOf(made.root), before);
      assert.ok(!changedGit(run.calls), 'git changed something');
    }
  );
}
