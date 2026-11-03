import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
const POST_ROUTE = '/blog/how-to-write-an-ai-incident-runbook';
const TERM_ROUTE = '/glossary/model-registry';
const FACTS = 'site/content-facts.json';
const CORE = 'docs/SEMANTIC-CORE.md';
const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
const LEDGER = 'audits/routes.json';

const entriesOf = (...formats) => formats.map((format) => ({ claim: claimOf(format), draft: DRAFTS[format] }));
const assemble = (root, run, entries = entriesOf('article', 'term')) =>
  assembleRoute({ repoRoot: root, entries, runDate: RUN_DATE, run });
const textOf = ({ files }, path) => files.find((file) => file.path === path)?.text;
const untouched = (root) => ({ files: snapshotOf(root), branches: gitIn(root, 'branch', '--format=%(refname:short)') });
const keysOf = (run) => run.calls.map(({ key }) => key);
const countOf = (run, key) => keysOf(run).filter((candidate) => candidate === key).length;

test('a post and a term assemble in one call: each entry file, each disposition, the two shared files once', async () => {
  const root = repo();
  const { files } = await assemble(root, fakeRun(root));
  const paths = files.map(({ path }) => path);

  assert.deepEqual(paths, [POST, TERM, FACTS, CORE, POST_DISPOSITION, TERM_DISPOSITION, LEDGER, ROUTES]);
  assert.equal(new Set(paths).size, paths.length);
});

test('the order of the entries is the order of the entry files and of the disposition files', async () => {
  const root = repo();
  const { files } = await assemble(root, fakeRun(root), entriesOf('term', 'article'));

  assert.deepEqual(
    files.map(({ path }) => path),
    [TERM, POST, FACTS, CORE, TERM_DISPOSITION, POST_DISPOSITION, LEDGER, ROUTES]
  );
});

test('both passages, both facts rows and both register rows are in the one returned text of each shared file', async () => {
  const root = repo();
  const result = await assemble(root, fakeRun(root));
  const prompts = parseBuyerPrompts(textOf(result, CORE));
  const facts = JSON.parse(textOf(result, FACTS)).targetQuery;

  assert.ok(
    prompts
      .find(({ number }) => number === 22)
      .passages.some(({ text, route }) => text === DRAFTS.article.passage && route === POST_ROUTE)
  );
  assert.ok(
    prompts
      .find(({ number }) => number === 2)
      .passages.some(({ text, route }) => text === DRAFTS.term.passage && route === TERM_ROUTE)
  );
  assert.equal(facts[POST_ROUTE], 'ai incident runbook');
  assert.equal(facts[TERM_ROUTE], 'model registry');
  assert.ok(textOf(result, CORE).includes(`| \`${POST_ROUTE}\` | ai incident runbook |`));
  assert.ok(textOf(result, CORE).includes(`| \`${TERM_ROUTE}\` |`));
  assert.ok(result.gates.every(({ exit }) => exit === 0));
});

test('the regeneration and every check run once, the build and the editorial gate twice, formatting and the digest once per entry', async () => {
  const root = repo();
  const run = fakeRun(root);
  await assemble(root, run);

  for (const key of [
    'node scripts/semantic-core.mjs',
    'node scripts/generate-registers.mjs',
    'node scripts/semantic-core.mjs --check dist',
    'npm run gate:registers',
    'npm run gate:content',
    'npm run gate:human',
    'npm run gate:machine',
    'npx prettier --write content-facts.json',
    'node scripts/stale-dispositions.mjs . dist',
  ])
    assert.equal(countOf(run, key), 1, key);
  assert.equal(countOf(run, 'npm run build'), 2);
  assert.equal(countOf(run, 'npm run gate:editorial'), 2);
  assert.equal(keysOf(run).filter((key) => key.startsWith('npx prettier --write ../audits/')).length, 1);
  assert.equal(keysOf(run).filter((key) => key.startsWith('npx prettier --write src/')).length, 2);
  assert.equal(keysOf(run).filter((key) => key.startsWith('node scripts/disposition-digest.mjs')).length, 4);
  assert.ok(run.calls.every(({ cwd }) => cwd === join(root, 'site')));
});

test('each disposition carries the digest of its own built entry', async () => {
  const root = repo();
  const result = await assemble(root, fakeRun(root));
  const [postRow] = JSON.parse(textOf(result, POST_DISPOSITION));
  const [termRow] = JSON.parse(textOf(result, TERM_DISPOSITION));

  assert.equal(postRow.target, POST.replace(/^site\//, ''));
  assert.equal(termRow.target, TERM.replace(/^site\//, ''));
  assert.equal(postRow.digest, digestOf(textOf(result, POST)));
  assert.equal(termRow.digest, digestOf(textOf(result, TERM)));
  assert.notEqual(postRow.digest, termRow.digest);
});

test('the whole run leaves the tree exactly as it found it', async () => {
  const root = repo();
  const before = untouched(root);
  await assemble(root, fakeRun(root));

  assert.deepEqual(untouched(root), before);
  assert.equal(gitIn(root, 'status', '--porcelain'), '');
});

const OCTOBER = '2026-10-31T23:59:59.999Z';
const acrossTwoMonths = () => [
  { claim: { ...claimOf('article'), claimedAt: OCTOBER }, draft: DRAFTS.article },
  ...entriesOf('term'),
];

test('entries claimed in two months file their dispositions under their own months, and the restated reason names each record under its own', async () => {
  const root = repo();
  const result = await assemble(root, fakeRun(root), acrossTwoMonths());
  const october = recordPath('disposition', claimOf('article').slug, OCTOBER);
  const { reason } = JSON.parse(textOf(result, ROUTES))[1];

  assert.notEqual(october, POST_DISPOSITION);
  assert.deepEqual(
    result.files.map(({ path }) => path),
    [POST, TERM, FACTS, CORE, october, TERM_DISPOSITION, LEDGER, ROUTES]
  );
  assert.ok(
    reason.includes(
      '(generation records audits/autowriter/generations/2026/10/how-to-write-an-ai-incident-runbook.json and audits/autowriter/generations/2026/11/model-registry.json)'
    )
  );
});

test('a run that fails after it filed dispositions under two months takes both month directories away', async () => {
  const root = repo();
  const before = untouched(root);
  const run = fakeRun(root, { fail: { 'node scripts/stale-dispositions.mjs . dist': { status: 2, stdout: 'broke' } } });

  await assert.rejects(assemble(root, run, acrossTwoMonths()), WriterError);
  assert.deepEqual(untouched(root), before);
  assert.equal(gitIn(root, 'status', '--porcelain'), '');
});

const STEPS = [
  'npx prettier --write src/data/post/how-to-write-an-ai-incident-runbook.md',
  'npx prettier --write src/data/glossary/model-registry.md',
  'npx prettier --write content-facts.json',
  'npm run build',
  'node scripts/semantic-core.mjs',
  'node scripts/generate-registers.mjs',
  'npm run assets:routes',
  'node scripts/disposition-digest.mjs . dist src/data/post/how-to-write-an-ai-incident-runbook.md',
  'node scripts/disposition-digest.mjs . dist /blog/how-to-write-an-ai-incident-runbook',
  'node scripts/disposition-digest.mjs . dist src/data/glossary/model-registry.md',
  'node scripts/disposition-digest.mjs . dist /glossary/model-registry',
  'node scripts/stale-dispositions.mjs . dist',
  `npx prettier --write ../${POST_DISPOSITION} ../${TERM_DISPOSITION} ../${ROUTES}`,
  'node scripts/semantic-core.mjs --check dist',
  'npm run gate:registers',
  'npm run gate:editorial',
];

for (const step of STEPS) {
  test(`when "${step}" fails in a two-entry run, the tree is byte for byte what it was`, async () => {
    const root = repo();
    const before = untouched(root);
    const run = fakeRun(root, { fail: { [step]: { status: 2, stdout: 'something broke' } } });

    await assert.rejects(
      assemble(root, run),
      (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes(step)
    );

    assert.deepEqual(untouched(root), before);
    assert.equal(gitIn(root, 'status', '--porcelain'), '');
  });
}

const failing = (root, stdout) =>
  fakeRun(root, { fail: { 'npm run gate:editorial': { status: 1, stdout, onCall: 2 } } });

test('the error names the entries the failing output mentions, though the message carries only the tail of it', async () => {
  const root = repo();
  const lines = [`FAIL ${TERM_ROUTE} is stale`, ...Array.from({ length: 30 }, (_, index) => `filler ${index + 1}`)];

  await assert.rejects(
    assemble(root, failing(root, lines.join('\n'))),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'build' &&
      error.message.includes('npm run gate:editorial') &&
      error.message.includes(`entries named in the output: ${TERM_ROUTE}`) &&
      !error.message.includes(POST_ROUTE) &&
      !error.message.includes('is stale') &&
      error.message.includes('filler 30')
  );
});

test('an entry is named by its file path as well as by its route', async () => {
  const root = repo();

  await assert.rejects(
    assemble(root, failing(root, `src/data/post/how-to-write-an-ai-incident-runbook.md: sentence too long`)),
    (error) =>
      error.message.includes(`entries named in the output: ${POST_ROUTE}`) && !error.message.includes(TERM_ROUTE)
  );
});

test('a route that only starts with the route of an entry does not name that entry', async () => {
  const root = repo();

  await assert.rejects(
    assemble(root, failing(root, `FAIL ${POST_ROUTE}-part-two`)),
    (error) => error instanceof WriterError && !error.message.includes('entries named in the output')
  );
});

const BAD_ENTRIES = {
  'a call without entries': undefined,
  'an empty list of entries': [],
  'an object where the list should be': {},
  'a null entry': [null],
  'an entry without a draft': [{ claim: claimOf('term') }],
  'an entry without a claim': [{ draft: DRAFTS.term }],
};

for (const [name, entries] of Object.entries(BAD_ENTRIES)) {
  test(`${name} is refused before any command runs`, async () => {
    const root = repo();
    const before = untouched(root);
    const run = fakeRun(root);

    await assert.rejects(
      assembleRoute({ repoRoot: root, entries, runDate: RUN_DATE, run }),
      (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes('entries')
    );
    assert.deepEqual(run.calls, []);
    assert.deepEqual(untouched(root), before);
  });
}

for (const claimedAt of [undefined, '', 'yesterday', '2026-02-30T00:00:00Z']) {
  test(`a claim time of ${JSON.stringify(claimedAt)} leaves no month to file the disposition under and is refused before any command runs`, async () => {
    const root = repo();
    const before = untouched(root);
    const run = fakeRun(root);
    const entries = [{ claim: { ...claimOf('article'), claimedAt }, draft: DRAFTS.article }];

    await assert.rejects(assemble(root, run, entries), /is not a UTC instant/);
    assert.deepEqual(run.calls, []);
    assert.deepEqual(untouched(root), before);
  });
}

test('the single-entry call shape is gone: a claim and a draft beside the root are not read', async () => {
  const root = repo();
  const run = fakeRun(root);

  await assert.rejects(
    assembleRoute({ repoRoot: root, claim: claimOf('term'), draft: DRAFTS.term, runDate: RUN_DATE, run }),
    (error) => error instanceof WriterError && error.message.includes('entries')
  );
  assert.deepEqual(run.calls, []);
});

const refusedBeforeAnyCommand = async (entries, pattern, prepare = () => {}) => {
  const root = repo();
  prepare(root);
  const before = untouched(root);
  const run = fakeRun(root);

  await assert.rejects(
    assemble(root, run, entries),
    (error) => error instanceof WriterError && error.kind === 'build' && pattern.test(error.message)
  );
  assert.deepEqual(run.calls, []);
  assert.deepEqual(untouched(root), before);
};

test('two entries that would write the same entry file are refused before any command runs', () =>
  refusedBeforeAnyCommand(entriesOf('term', 'term'), /model-registry\.md is written by two entries/));

test('an article and a term with one slug would share a disposition file and are refused', () =>
  refusedBeforeAnyCommand(
    [{ claim: { ...claimOf('article'), slug: 'model-registry' }, draft: DRAFTS.article }, ...entriesOf('term')],
    new RegExp(`${TERM_DISPOSITION.replaceAll('.', '\\.')} is written by two entries`)
  ));

test('two entries that aim at one query are refused, naming the route that holds it', () =>
  refusedBeforeAnyCommand(
    [{ claim: { ...claimOf('article'), query: 'Model Registry' }, draft: DRAFTS.article }, ...entriesOf('term')],
    new RegExp(POST_ROUTE)
  ));

test('a later entry whose file already exists stops the whole run before any file is touched', () =>
  refusedBeforeAnyCommand(entriesOf('article', 'term'), /model-registry\.md already exists/, (root) => {
    mkdirSync(dirname(join(root, TERM)), { recursive: true });
    writeFileSync(join(root, TERM), 'written by hand\n');
  }));
