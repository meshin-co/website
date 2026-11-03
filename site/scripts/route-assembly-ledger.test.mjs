import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { claimOf, DRAFTS, RUN_DATE } from './fixtures/entry-drafts.mjs';
import { fakeRun, gitIn, makeRepo, snapshotOf, START_ROUTES } from './fixtures/route-repo.mjs';
import { assembleRoute } from './route-assembly.mjs';
import { collectRoutes } from './routes-gate.mjs';
import { WriterError } from './writer-error.mjs';

const roots = [];
const repo = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const LEDGER = 'audits/routes.json';
const WRITTEN_ROUTES = [
  '/blog/how-to-write-an-ai-incident-runbook',
  '/blog/category/governance',
  '/blog/tag/ai-governance',
  '/blog/tag/production-readiness',
];

const assemble = (root, run = fakeRun(root), format = 'article') =>
  assembleRoute({
    repoRoot: root,
    entries: [{ claim: claimOf(format), draft: DRAFTS[format] }],
    runDate: RUN_DATE,
    run,
  });
const ledgerIn = (files) => files.find(({ path }) => path === LEDGER);
const plantLedger = (root, ledger) => {
  mkdirSync(dirname(join(root, LEDGER)), { recursive: true });
  writeFileSync(join(root, LEDGER), `${JSON.stringify(ledger, null, 2)}\n`);
  gitIn(root, 'add', '--', LEDGER);
  gitIn(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'ledger');
};

test('an assembly that adds an entry returns the route ledger, beside the files it changes', async () => {
  const root = repo();
  const { files } = await assemble(root);

  assert.ok(ledgerIn(files), 'audits/routes.json is not among the returned files');
});

test('the ledger an assembly returns is the routes the build produced, tags and categories included', async () => {
  const root = repo();
  const { files } = await assemble(root);

  const carried = JSON.parse(ledgerIn(files).text);

  assert.deepEqual(carried, collectRoutes(join(root, 'site', 'dist')));
  assert.deepEqual(carried, [...START_ROUTES, ...WRITTEN_ROUTES].sort());
  assert.equal(ledgerIn(files).text, `${JSON.stringify(carried, null, 2)}\n`);
});

test('a ledger that was already stale is rewritten from the build, never patched with the new route', async () => {
  const root = repo();
  plantLedger(root, ['/', '/blog/existing-post']);
  const { files } = await assemble(root);

  const carried = JSON.parse(ledgerIn(files).text);

  assert.ok(carried.includes('/glossary/ai-register'), 'the route the old ledger missed is still missing');
  assert.deepEqual(carried, collectRoutes(join(root, 'site', 'dist')));
});

test('a ledger that already lists every route the build makes is not returned, so the commit holds no empty change', async () => {
  const root = repo();
  plantLedger(root, [...START_ROUTES, ...WRITTEN_ROUTES].sort());
  const { files } = await assemble(root);

  assert.equal(ledgerIn(files), undefined);
});

test('a build that drops a route the ledger lists is refused, because rewriting the ledger would hide the removal', async () => {
  const root = repo();
  plantLedger(root, [...START_ROUTES, '/blog/gone'].sort());
  const before = { files: snapshotOf(root), status: gitIn(root, 'status', '--porcelain') };

  await assert.rejects(assemble(root), (error) => {
    assert.ok(error instanceof WriterError && error.kind === 'build', error.message);
    assert.match(error.message, /drops \/blog\/gone/);
    assert.match(error.message, /routes-removed\.json/);
    return true;
  });

  assert.deepEqual({ files: snapshotOf(root), status: gitIn(root, 'status', '--porcelain') }, before);
});

test('a ledger that is not a list of routes is refused naming the file, and the tree is left as it was', async () => {
  const root = repo();
  plantLedger(root, { routes: [] });
  const before = snapshotOf(root);

  await assert.rejects(
    assemble(root),
    (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes(LEDGER)
  );

  assert.deepEqual(snapshotOf(root), before);
});

test('a failure of the ledger command is a build failure that names the command', async () => {
  const root = repo();
  const run = fakeRun(root, { fail: { 'npm run assets:routes': { status: 3, stderr: 'no dist' } } });

  await assert.rejects(
    assemble(root, run),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'build' &&
      error.message.includes('npm run assets:routes') &&
      error.message.includes('no dist')
  );
});
