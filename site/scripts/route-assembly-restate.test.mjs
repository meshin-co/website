import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { recordPath } from './record-layout.mjs';
import { assembleRoute } from './route-assembly.mjs';
import { dispositionFor } from './route-derive.mjs';
import { WriterError } from './writer-error.mjs';
import { claimOf, DRAFTS, RUN_DATE } from './fixtures/entry-drafts.mjs';
import { DISPOSITIONS, listingDigest, staleEntries } from './fixtures/route-dispositions.mjs';
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

const SLUG = 'how-to-write-an-ai-incident-runbook';
const POST = `site/src/data/post/${SLUG}.md`;
const TERM = 'site/src/data/glossary/model-registry.md';
const POST_ROUTE = `/blog/${SLUG}`;
const TERM_ROUTE = '/glossary/model-registry';
const ARTICLE = claimOf('article');
const TERM_CLAIM = claimOf('term');
const POST_DISPOSITION = recordPath('disposition', SLUG, ARTICLE.claimedAt);
const TERM_DISPOSITION = recordPath('disposition', TERM_CLAIM.slug, TERM_CLAIM.claimedAt);
const ROUTES = `${DISPOSITIONS}/routes.json`;
const POSTS = `${DISPOSITIONS}/posts.json`;
const FACTS = 'site/content-facts.json';
const CORE = 'docs/SEMANTIC-CORE.md';
const STALE_COMMAND = 'node scripts/stale-dispositions.mjs . dist';
const TERM_DIGEST_COMMAND = 'node scripts/disposition-digest.mjs . dist src/data/glossary/model-registry.md';

const assemble = (root, run, formats = ['article', 'term']) =>
  assembleRoute({
    repoRoot: root,
    entries: formats.map((format) => ({ claim: claimOf(format), draft: DRAFTS[format] })),
    runDate: RUN_DATE,
    run,
  });
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const textOf = ({ files }, path) => files.find((file) => file.path === path)?.text;
const pathsOf = ({ files }) => files.map(({ path }) => path);
const keysOf = (run) => run.calls.map(({ key }) => key);
const layout = (entries) => `${JSON.stringify(entries, null, 2)}\n`;
const restated = (entry, digest, reason) => ({ ...entry, status: 'rewritten', reason, digest });
const originalRoutes = (root) => JSON.parse(read(root, ROUTES));
const untouched = (root) => ({
  files: snapshotOf(root),
  branches: gitIn(root, 'branch', '--format=%(refname:short)'),
  status: gitIn(root, 'status', '--porcelain'),
});

test('the baseline is built and checked first, then the entries are written and formatted', async () => {
  const root = repo();
  const run = fakeRun(root);
  await assemble(root, run);

  assert.deepEqual(keysOf(run).slice(0, 4), [
    'npm run build',
    'npm run gate:editorial',
    `npx prettier --write src/data/post/${SLUG}.md`,
    'npx prettier --write src/data/glossary/model-registry.md',
  ]);
});

test('a red baseline stops the run with the gate named, its first findings carried, and nothing written', async () => {
  const root = repo();
  const posts = JSON.parse(read(root, POSTS));
  posts[0].digest = '000000000000';
  writeFileSync(join(root, POSTS), layout(posts));
  const before = untouched(root);
  const run = fakeRun(root);

  await assert.rejects(
    assemble(root, run),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'build' &&
      error.message.includes('the baseline already fails gate:editorial') &&
      error.message.includes('the writer will not write on a red baseline') &&
      error.message.includes('src/data/post/existing-post.md')
  );
  assert.deepEqual(keysOf(run), ['npm run build', 'npm run gate:editorial']);
  assert.deepEqual(untouched(root), before);
});

test('only the first fifteen lines of a red baseline are carried, not the tail', async () => {
  const root = repo();
  const stdout = Array.from({ length: 30 }, (_, index) => `finding ${index + 1}`).join('\n');
  const run = fakeRun(root, { fail: { 'npm run gate:editorial': { status: 1, stdout, onCall: 1 } } });

  await assert.rejects(
    assemble(root, run),
    (error) =>
      error.message.includes('finding 15') &&
      !error.message.includes('finding 16') &&
      !error.message.includes('finding 30')
  );
});

test('a baseline that does not build stops the run before the gate runs', async () => {
  const root = repo();
  const before = untouched(root);
  const run = fakeRun(root, {
    fail: { 'npm run build': { status: 1, stdout: 'the pristine tree is broken', onCall: 1 } },
  });

  await assert.rejects(
    assemble(root, run),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'build' &&
      /baseline already fails the build/.test(error.message) &&
      error.message.includes('the pristine tree is broken')
  );
  assert.deepEqual(keysOf(run), ['npm run build']);
  assert.deepEqual(untouched(root), before);
});

test('every entry the new text made stale is restated with a fresh digest, and nothing else in its file changes', async () => {
  const root = repo();
  const original = originalRoutes(root);
  const result = await assemble(root, fakeRun(root));
  const entries = JSON.parse(textOf(result, ROUTES));
  const { reason } = entries[1];
  const blog = listingDigest(['existing-post', SLUG]);
  const glossary = listingDigest(['ai-register', 'model-registry']);

  assert.equal(
    textOf(result, ROUTES),
    layout([
      original[0],
      restated(original[1], blog, reason),
      restated(original[2], blog, reason),
      restated(original[3], glossary, reason),
    ])
  );
  assert.deepEqual(Object.keys(entries[1]), Object.keys(original[1]));
  assert.equal(entries[2].reason, reason);
  assert.equal(entries[3].reason, reason);
});

test('the new reason names every route the run added and every generation record, and says no human has read the text', async () => {
  const root = repo();
  const { reason } = JSON.parse(textOf(await assemble(root, fakeRun(root)), ROUTES))[3];

  for (const part of [
    POST_ROUTE,
    TERM_ROUTE,
    `audits/autowriter/generations/2026/11/${SLUG}.json`,
    'audits/autowriter/generations/2026/11/model-registry.json',
  ])
    assert.ok(reason.includes(part), part);
  assert.match(reason, /no human has read it/);
  assert.doesNotMatch(reason, /seal/i);
});

test('the files come back entries first, then the shared files, the generated dispositions and the restated ones', async () => {
  const root = repo();
  const result = await assemble(root, fakeRun(root));

  assert.deepEqual(pathsOf(result), [POST, TERM, FACTS, CORE, POST_DISPOSITION, TERM_DISPOSITION, ROUTES]);
  assert.ok(!pathsOf(result).includes(POSTS));
});

test('a generated disposition is returned once, exactly as written, and is never restated', async () => {
  const root = repo();
  const result = await assemble(root, fakeRun(root));
  const rows = JSON.parse(textOf(result, POST_DISPOSITION));

  assert.equal(new Set(pathsOf(result)).size, pathsOf(result).length);
  assert.equal(textOf(result, POST_DISPOSITION), layout(rows));
  assert.deepEqual(
    rows.map(({ target }) => target),
    [`src/data/post/${SLUG}.md`, POST_ROUTE]
  );
  for (const row of rows)
    assert.equal(
      row.reason,
      dispositionFor({
        claimPath: recordPath('claim', SLUG, ARTICLE.claimedAt),
        generationPath: recordPath('generation', SLUG, ARTICLE.claimedAt),
        target: row.target,
        digest: row.digest,
        runDate: RUN_DATE,
      }).reason
    );
});

test('the disposition files are formatted in one command after the stale list, generated files first', async () => {
  const root = repo();
  const run = fakeRun(root);
  await assemble(root, run);
  const keys = keysOf(run);
  const format = `npx prettier --write ../${POST_DISPOSITION} ../${TERM_DISPOSITION} ../${ROUTES}`;

  assert.ok(keys.includes(format));
  assert.ok(keys.indexOf(STALE_COMMAND) > keys.indexOf(TERM_DIGEST_COMMAND));
  assert.ok(keys.indexOf(format) > keys.indexOf(STALE_COMMAND));
  assert.ok(keys.indexOf(format) < keys.indexOf('node scripts/semantic-core.mjs --check dist'));
});

test('a term alone restates the glossary entry and leaves the blog entries byte for byte', async () => {
  const root = repo();
  const original = originalRoutes(root);
  const result = await assemble(root, fakeRun(root), ['term']);
  const entries = JSON.parse(textOf(result, ROUTES));
  const { reason, digest } = entries[3];

  assert.equal(digest, listingDigest(['ai-register', 'model-registry']));
  assert.match(reason, /generation record audits\/autowriter\/generations\/2026\/11\/model-registry\.json/);
  assert.ok(reason.includes(TERM_ROUTE) && !reason.includes('/blog/'));
  assert.equal(textOf(result, ROUTES), layout([...original.slice(0, 3), restated(original[3], digest, reason)]));
});

test('a run that makes nothing stale rewrites no existing disposition file', async () => {
  const root = repo();
  rmSync(join(root, ROUTES));
  const run = fakeRun(root);
  const result = await assemble(root, run, ['article']);

  assert.deepEqual(pathsOf(result), [POST, FACTS, CORE, POST_DISPOSITION]);
  assert.ok(keysOf(run).includes(STALE_COMMAND));
  assert.ok(keysOf(run).includes(`npx prettier --write ../${POST_DISPOSITION}`));
});

test('a stale list that names one of the run own dispositions is refused and the tree restored', async () => {
  const root = repo();
  const before = untouched(root);
  const own = [
    {
      file: POST_DISPOSITION.slice(DISPOSITIONS.length + 1),
      index: 0,
      target: `src/data/post/${SLUG}.md`,
      digest: 'aaaaaaaaaaaa',
    },
  ];
  const run = fakeRun(root, { fail: { [STALE_COMMAND]: { status: 0, stdout: JSON.stringify(own) } } });

  await assert.rejects(
    assemble(root, run, ['article']),
    (error) => error instanceof WriterError && error.message.includes(POST_DISPOSITION)
  );
  assert.deepEqual(untouched(root), before);
});

for (const stdout of [
  'not json',
  '{}',
  '[{"file":"../x.json","index":0,"target":"/","digest":"aaaaaaaaaaaa"}]',
  '[{"file":"/audits/x.json","index":0,"target":"/","digest":"aaaaaaaaaaaa"}]',
  '[{"file":"2026//10/x.json","index":0,"target":"/","digest":"aaaaaaaaaaaa"}]',
  '[{"file":"a.json","index":0,"target":"/","digest":"zz"}]',
])
  test(`a stale list of ${JSON.stringify(stdout).slice(0, 30)} is refused and the tree restored`, async () => {
    const root = repo();
    const before = untouched(root);
    const run = fakeRun(root, { fail: { [STALE_COMMAND]: { status: 0, stdout } } });

    await assert.rejects(
      assemble(root, run, ['article']),
      (error) =>
        error instanceof WriterError &&
        error.kind === 'build' &&
        error.message.includes('scripts/stale-dispositions.mjs')
    );
    assert.deepEqual(untouched(root), before);
  });

test('a disposition file laid out another way is refused rather than reformatted, and the tree restored', async () => {
  const root = repo();
  writeFileSync(join(root, ROUTES), `${JSON.stringify(originalRoutes(root), null, '\t')}\n`);
  const before = untouched(root);

  await assert.rejects(
    assemble(root, fakeRun(root), ['article']),
    (error) => error instanceof WriterError && error.message.includes('routes.json') && /laid out/.test(error.message)
  );
  assert.deepEqual(untouched(root), before);
});

const EARLIER = `${DISPOSITIONS}/2026/10/generated-earlier-post.json`;
const earlierRow = (digest) => ({
  target: '/blog',
  status: 'rewritten',
  reason: 'Written by the unattended writer. No human has read this text.',
  digest,
});
const filed = (root, name, rows) => {
  mkdirSync(dirname(join(root, DISPOSITIONS, name)), { recursive: true });
  writeFileSync(join(root, DISPOSITIONS, name), layout(rows));
};

test('a generated disposition an earlier run filed under its month is restated where it lies when the new text made it stale', async () => {
  const root = repo();
  const original = [earlierRow(listingDigest(['existing-post']))];
  filed(root, EARLIER.slice(DISPOSITIONS.length + 1), original);
  const before = untouched(root);
  const run = fakeRun(root);
  const result = await assemble(root, run, ['article']);
  const [{ reason, digest }] = JSON.parse(textOf(result, EARLIER));

  assert.deepEqual(pathsOf(result), [POST, FACTS, CORE, POST_DISPOSITION, EARLIER, ROUTES]);
  assert.equal(digest, listingDigest(['existing-post', SLUG]));
  assert.equal(textOf(result, EARLIER), layout([restated(original[0], digest, reason)]));
  assert.equal(reason, JSON.parse(textOf(result, ROUTES))[1].reason);
  assert.ok(keysOf(run).includes(`npx prettier --write ../${POST_DISPOSITION} ../${EARLIER} ../${ROUTES}`));
  assert.deepEqual(untouched(root), before);
});

test('the stale list of the fake world reads a flat file, a file under its month and a deeper one, and its gate counts three', () => {
  const root = repo();
  const names = ['stale.json', '2026/10/generated-earlier-post.json', '2026/10/extra/deeper.json'];
  for (const name of names) filed(root, name, [earlierRow('000000000000')]);
  const site = join(root, 'site');
  const run = fakeRun(root);
  const listed = staleEntries(root);

  assert.equal(listed.length, 3);
  assert.deepEqual(
    listed.map(({ file }) => file),
    [...names].sort()
  );
  assert.ok(listed.every(({ index, target }) => index === 0 && target === '/blog'));
  assert.deepEqual(
    JSON.parse(run('node', ['scripts/stale-dispositions.mjs', '.', 'dist'], { cwd: site }).stdout),
    listed
  );
  assert.match(run('npm', ['run', 'gate:editorial'], { cwd: site }).stdout, /findings: 3/);
});

const LATE_FAILURES = [
  [STALE_COMMAND, 1],
  [`npx prettier --write ../${POST_DISPOSITION} ../${ROUTES}`, 1],
  ['npm run build', 2],
  ['node scripts/semantic-core.mjs --check dist', 1],
  ['npm run gate:registers', 1],
  ['npm run gate:editorial', 2],
];

for (const [command, onCall] of LATE_FAILURES)
  test(`when "${command}" fails on call ${onCall} the tree is byte for byte what it was, restated files included`, async () => {
    const root = repo();
    const before = untouched(root);
    const run = fakeRun(root, { fail: { [command]: { status: 2, stdout: 'broke', onCall } } });

    await assert.rejects(
      assemble(root, run, ['article']),
      (error) =>
        error instanceof WriterError &&
        error.kind === 'build' &&
        error.message.includes(command) &&
        !/baseline/.test(error.message)
    );
    assert.deepEqual(untouched(root), before);
  });

test('a red gate after the restating names the entry its output mentions', async () => {
  const root = repo();
  const run = fakeRun(root, {
    fail: { 'npm run gate:editorial': { status: 1, stdout: `FAIL ${POST_ROUTE} is stale`, onCall: 2 } },
  });

  await assert.rejects(assemble(root, run, ['article']), (error) =>
    error.message.includes(`entries named in the output: ${POST_ROUTE}`)
  );
});

test('the information gates run after the restating, and a failing one still returns the restated files', async () => {
  const root = repo();
  const run = fakeRun(root, { exits: { 'gate:human': 3 } });
  const result = await assemble(root, run, ['article']);
  const keys = keysOf(run);

  assert.ok(pathsOf(result).includes(ROUTES));
  assert.deepEqual(
    result.gates.filter(({ exit }) => exit !== 0),
    [{ name: 'gate:human', exit: 3 }]
  );
  assert.ok(keys.indexOf('npm run gate:human') > keys.indexOf(STALE_COMMAND));
});

test('no command the assembly runs mentions the seal', async () => {
  const root = repo();
  const run = fakeRun(root);
  await assemble(root, run);

  assert.ok(keysOf(run).every((key) => !/seal/i.test(key)));
});
