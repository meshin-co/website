import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { commitRoute } from './entry-commit.mjs';
import { assembleRoute } from './route-assembly.mjs';
import { collectRoutes } from './routes-gate.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';
import { claimOf, DRAFTS, RUN_DATE } from './fixtures/entry-drafts.mjs';
import { gitRun } from './fixtures/git-run.mjs';
import { fakeRun, gitIn, makeRepo, snapshotOf } from './fixtures/route-repo.mjs';

const roots = [];
const repo = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const EXTRAS = [
  { path: 'audits/autowriter/generations/model-registry.json', text: '{"slug":"model-registry"}\n' },
  { path: 'audits/autowriter/model-registry.json', text: '{"attempts":1}\n' },
];
const BRANCH = 'autowriter/model-registry';

const assemble = (root, formats = ['term']) =>
  assembleRoute({
    repoRoot: root,
    entries: formats.map((format) => ({ claim: claimOf(format), draft: DRAFTS[format] })),
    runDate: RUN_DATE,
    run: fakeRun(root),
  });
const stateOf = (root) => ({
  files: snapshotOf(root),
  head: gitIn(root, 'rev-parse', 'HEAD'),
  branches: gitIn(root, 'branch', '--format=%(refname:short)'),
  status: gitIn(root, 'status', '--porcelain'),
});

test('the files an assembly returns commit as they are, beside the records, in one commit by the bot', async () => {
  const root = repo();
  const { files } = await assemble(root);
  const everything = [...files, ...EXTRAS];

  const { commit, branch } = await commitRoute({
    repoRoot: root,
    branch: BRANCH,
    files: everything,
    message: 'content: add a term',
    run: gitRun(),
  });

  assert.equal(branch, BRANCH);
  assert.equal(gitIn(root, 'rev-parse', 'HEAD').trim(), commit);
  assert.deepEqual(
    gitIn(root, 'show', '--name-only', '--format=', commit).split('\n').filter(Boolean).sort(),
    everything.map(({ path }) => path).sort()
  );
  assert.equal(
    gitIn(root, 'log', '-1', '--format=%an|%ae|%cn|%ce').trim(),
    `${BOT_NAME}|${BOT_EMAIL}|${BOT_NAME}|${BOT_EMAIL}`
  );
  assert.equal(gitIn(root, 'status', '--porcelain'), '');
});

test('an assembly followed by a commit that fails leaves the repository exactly as it was before the assembly', async () => {
  const root = repo();
  const before = stateOf(root);

  const { files } = await assemble(root);
  await assert.rejects(
    commitRoute({
      repoRoot: root,
      branch: BRANCH,
      files: [...files, ...EXTRAS],
      message: 'content: add a term',
      run: gitRun({ fail: (args) => args.includes('commit') }),
    })
  );

  assert.deepEqual(stateOf(root), before);
});

test('an assembly that is never committed leaves nothing behind either', async () => {
  const root = repo();
  const before = stateOf(root);

  await assemble(root);

  assert.deepEqual(stateOf(root), before);
});

test('a post and a term assembled together commit as one commit, every file once', async () => {
  const root = repo();
  const { files } = await assemble(root, ['article', 'term']);
  const everything = [...files, ...EXTRAS];

  const { commit } = await commitRoute({
    repoRoot: root,
    branch: BRANCH,
    files: everything,
    message: 'content: add two entries',
    run: gitRun(),
  });
  const committed = gitIn(root, 'show', '--name-only', '--format=', commit).split('\n').filter(Boolean).sort();

  assert.deepEqual(committed, everything.map(({ path }) => path).sort());
  assert.equal(new Set(committed).size, committed.length);
  assert.equal(gitIn(root, 'rev-list', '--count', 'main..HEAD').trim(), '1');
  assert.equal(gitIn(root, 'status', '--porcelain'), '');
});

test('a pipeline commit that adds an entry also carries the route ledger, and the ledger is the routes the build produced', async () => {
  const root = repo();
  const { files } = await assemble(root, ['article']);

  const { commit } = await commitRoute({
    repoRoot: root,
    branch: BRANCH,
    files: [...files, ...EXTRAS],
    message: 'content: add a post',
    run: gitRun(),
  });

  const carried = gitIn(root, 'show', '--name-only', '--format=', commit).split('\n').filter(Boolean);
  assert.ok(carried.includes('audits/routes.json'), `the commit carries ${carried.join(', ')}`);
  const ledger = JSON.parse(gitIn(root, 'show', `${commit}:audits/routes.json`));
  assert.deepEqual(ledger, collectRoutes(join(root, 'site', 'dist')));
  assert.ok(ledger.includes('/blog/how-to-write-an-ai-incident-runbook'));
});
