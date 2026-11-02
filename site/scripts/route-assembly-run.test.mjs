import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { recordPath } from './record-layout.mjs';
import { assembleRoute } from './route-assembly.mjs';
import { parseBuyerPrompts } from './semantic-core.mjs';
import { WriterError } from './writer-error.mjs';
import { claimOf, DRAFTS, RUN_DATE } from './fixtures/entry-drafts.mjs';
import { digestOf, fakeRun, gitIn, makeRepo, snapshotOf } from './fixtures/route-repo.mjs';

const roots = [];
const repo = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const POST = 'site/src/data/post/how-to-write-an-ai-incident-runbook.md';
const TERM = 'site/src/data/glossary/model-registry.md';
const POST_DISPOSITION = recordPath('disposition', claimOf('article').slug, claimOf('article').claimedAt);
const TERM_DISPOSITION = recordPath('disposition', claimOf('term').slug, claimOf('term').claimedAt);
const FACTS = 'site/content-facts.json';
const CORE = 'docs/SEMANTIC-CORE.md';
const ROUTES = 'audits/phase-4.7/dispositions/routes.json';

const assemble = (root, run, format, claim = claimOf(format)) =>
  assembleRoute({
    repoRoot: root,
    entries: [{ claim, draft: DRAFTS[format] }],
    runDate: RUN_DATE,
    run,
  });
const textOf = ({ files }, path) => files.find((file) => file.path === path)?.text;

function land(root, { files }) {
  for (const { path, text } of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

async function postLanded(root) {
  const post = await assemble(root, fakeRun(root), 'article');
  land(root, post);
  return post;
}

test('a term assembled on top of a landed post carries the wiring of both', async () => {
  const root = repo();
  await postLanded(root);
  const term = await assemble(root, fakeRun(root), 'term');
  const facts = JSON.parse(textOf(term, FACTS)).targetQuery;
  const prompts = parseBuyerPrompts(textOf(term, CORE));

  assert.equal(facts['/blog/how-to-write-an-ai-incident-runbook'], 'ai incident runbook');
  assert.equal(facts['/glossary/model-registry'], 'model registry');
  assert.ok(
    prompts
      .find(({ number }) => number === 22)
      .passages.some(({ route }) => route === '/blog/how-to-write-an-ai-incident-runbook')
  );
  assert.ok(
    prompts.find(({ number }) => number === 2).passages.some(({ route }) => route === '/glossary/model-registry')
  );
  assert.ok(term.gates.every(({ exit }) => exit === 0));
});

test('the second assembly builds a tree that holds the first entry and does not return the first entry again', async () => {
  const root = repo();
  await postLanded(root);
  const landed = snapshotOf(root);
  const run = fakeRun(root);
  const term = await assemble(root, run, 'term');

  assert.ok(run.calls.some(({ key }) => key === 'npm run build'));
  assert.deepEqual(term.files.map(({ path }) => path).sort(), [CORE, FACTS, TERM, TERM_DISPOSITION, ROUTES].sort());
  assert.deepEqual(snapshotOf(root), landed);
  assert.ok(textOf(term, CORE).includes('| `/blog/how-to-write-an-ai-incident-runbook` |'));
  assert.ok(textOf(term, CORE).includes('| `/glossary/model-registry` |'));
});

test('each entry has its own disposition file, and each digest comes from its own built entry', async () => {
  const root = repo();
  const post = await postLanded(root);
  const term = await assemble(root, fakeRun(root), 'term');

  const [postRow] = JSON.parse(textOf(post, POST_DISPOSITION));
  const [termRow] = JSON.parse(textOf(term, TERM_DISPOSITION));

  assert.equal(postRow.target, POST.replace(/^site\//, ''));
  assert.equal(termRow.target, TERM.replace(/^site\//, ''));
  assert.equal(postRow.digest, digestOf(textOf(post, POST)));
  assert.equal(termRow.digest, digestOf(textOf(term, TERM)));
  assert.notEqual(postRow.digest, termRow.digest);
});

const STEPS = [
  'npx prettier --write src/data/glossary/model-registry.md',
  'npx prettier --write content-facts.json',
  'npm run build',
  'node scripts/semantic-core.mjs',
  'node scripts/generate-registers.mjs',
  'node scripts/disposition-digest.mjs . dist src/data/glossary/model-registry.md',
  'node scripts/disposition-digest.mjs . dist /glossary/model-registry',
  'node scripts/stale-dispositions.mjs . dist',
  `npx prettier --write ../${TERM_DISPOSITION} ../${ROUTES}`,
  'node scripts/semantic-core.mjs --check dist',
  'npm run gate:registers',
  'npm run gate:editorial',
];

for (const step of STEPS) {
  test(`when the second assembly fails at "${step}", the landed post is untouched and nothing of the term is left`, async () => {
    const root = repo();
    await postLanded(root);
    const landed = snapshotOf(root);

    await assert.rejects(
      assemble(root, fakeRun(root, { fail: { [step]: { status: 2, stdout: 'broke' } } }), 'term'),
      (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes(step)
    );

    assert.deepEqual(snapshotOf(root), landed);
    assert.ok(existsSync(join(root, POST)) && existsSync(join(root, POST_DISPOSITION)));
    assert.ok(!existsSync(join(root, TERM)) && !existsSync(join(root, TERM_DISPOSITION)));
  });
}

test('after a failed assembly the same call runs again on the same tree and succeeds', async () => {
  const root = repo();
  await postLanded(root);
  const fail = { 'npm run gate:editorial': { status: 1, stdout: 'stale dispositions' } };

  await assert.rejects(assemble(root, fakeRun(root, { fail }), 'term'), WriterError);
  const retry = await assemble(root, fakeRun(root), 'term');

  assert.equal(retry.files.length, 5);
  assert.equal(JSON.parse(textOf(retry, TERM_DISPOSITION))[0].digest, digestOf(textOf(retry, TERM)));
});

test('a failed assembly followed by a good one returns what a good assembly alone returns, on an identical tree', async () => {
  const root = repo();
  const clean = makeRepo();
  roots.push(clean);

  await assert.rejects(
    assemble(root, fakeRun(root, { fail: { 'npm run build': { status: 1 } } }), 'article'),
    WriterError
  );
  const afterFailure = await assemble(root, fakeRun(root), 'article');
  const alone = await assemble(clean, fakeRun(clean), 'article');

  assert.deepEqual(afterFailure.files, alone.files);
  assert.deepEqual(snapshotOf(root), snapshotOf(clean));
  assert.equal(gitIn(root, 'branch', '--format=%(refname:short)'), 'main\n');
  assert.equal(readFileSync(join(root, FACTS), 'utf8'), readFileSync(join(clean, FACTS), 'utf8'));
});

const DECEMBER = '2026-12-01T00:00:00.000Z';
const DECEMBER_DISPOSITION = recordPath('disposition', claimOf('term').slug, DECEMBER);
const laterTerm = () => ({ ...claimOf('term'), claimedAt: DECEMBER });

test('a term claimed in a later month is filed under that month and leaves the month of the landed post alone', async () => {
  const root = repo();
  await postLanded(root);
  const landed = snapshotOf(root);
  const term = await assemble(root, fakeRun(root), 'term', laterTerm());

  assert.equal(DECEMBER_DISPOSITION, 'audits/phase-4.7/dispositions/2026/12/generated-model-registry.json');
  assert.deepEqual(term.files.map(({ path }) => path).sort(), [CORE, FACTS, TERM, DECEMBER_DISPOSITION, ROUTES].sort());
  assert.deepEqual(snapshotOf(root), landed);
  assert.ok(existsSync(join(root, POST_DISPOSITION)));
});

test('when that assembly fails the month of the landed post stays and the month it would have made is gone', async () => {
  const root = repo();
  await postLanded(root);
  const landed = snapshotOf(root);
  const fail = { 'node scripts/stale-dispositions.mjs . dist': { status: 2, stdout: 'broke' } };

  await assert.rejects(assemble(root, fakeRun(root, { fail }), 'term', laterTerm()), WriterError);
  assert.deepEqual(snapshotOf(root), landed);
  assert.ok(existsSync(join(root, dirname(POST_DISPOSITION))));
  assert.ok(!existsSync(join(root, dirname(DECEMBER_DISPOSITION))));
});
