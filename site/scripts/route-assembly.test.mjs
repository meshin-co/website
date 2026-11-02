import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

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

const SLUG = 'how-to-write-an-ai-incident-runbook';
const ENTRY = `site/src/data/post/${SLUG}.md`;
const DISPOSITION = `audits/phase-4.7/dispositions/generated-${SLUG}.json`;
const FORMATTED_ENTRY = `src/data/post/${SLUG}.md`;
const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
const DISPOSITION_FORMAT = `npx prettier --write ../${DISPOSITION} ../${ROUTES}`;
const STALE_COMMAND = 'node scripts/stale-dispositions.mjs . dist';
const ROUTE_DIGEST = `node scripts/disposition-digest.mjs . dist /blog/${SLUG}`;

const assemble = (root, run, { format = 'article', claim = claimOf(format), draft = DRAFTS[format] } = {}) =>
  assembleRoute({ repoRoot: root, entries: [{ claim, draft }], runDate: RUN_DATE, run });

const read = (root, path) => readFileSync(join(root, path), 'utf8');
const textOf = (files, path) => files.find((file) => file.path === path)?.text;
const untouched = (root) => ({ files: snapshotOf(root), branches: gitIn(root, 'branch', '--format=%(refname:short)') });

test('it returns the files it assembled, entry first and restated dispositions last, and the six gates it ran', async () => {
  const root = repo();
  const { files, gates } = await assemble(root, fakeRun(root));

  assert.deepEqual(
    files.map(({ path }) => path),
    [ENTRY, 'site/content-facts.json', 'docs/SEMANTIC-CORE.md', DISPOSITION, ROUTES]
  );
  assert.ok(files.every(({ text }) => typeof text === 'string' && text.endsWith('\n')));
  assert.deepEqual(gates, [
    { name: 'semantic-core', exit: 0 },
    { name: 'gate:registers', exit: 0 },
    { name: 'gate:editorial', exit: 0 },
    { name: 'gate:content', exit: 0 },
    { name: 'gate:human', exit: 0 },
    { name: 'gate:machine', exit: 0 },
  ]);
});

test('it leaves the working tree exactly as it found it, so the files it returns are not on disk', async () => {
  const root = repo();
  const before = untouched(root);
  const { files } = await assemble(root, fakeRun(root));

  assert.equal(files.length, 5);
  assert.deepEqual(untouched(root), before);
  assert.equal(gitIn(root, 'status', '--porcelain'), '');
  for (const path of [ENTRY, DISPOSITION]) assert.ok(!existsSync(join(root, path)), path);
});

test('it runs the commands in the order the skills give, every one with site/ as its directory', async () => {
  const root = repo();
  const run = fakeRun(root);
  await assemble(root, run);

  assert.deepEqual(
    run.calls.map(({ key }) => key),
    [
      'npm run build',
      'npm run gate:editorial',
      `npx prettier --write ${FORMATTED_ENTRY}`,
      'npx prettier --write content-facts.json',
      'npm run build',
      'node scripts/semantic-core.mjs',
      'node scripts/generate-registers.mjs',
      `node scripts/disposition-digest.mjs . dist ${FORMATTED_ENTRY}`,
      ROUTE_DIGEST,
      STALE_COMMAND,
      DISPOSITION_FORMAT,
      'node scripts/semantic-core.mjs --check dist',
      'npm run gate:registers',
      'npm run gate:editorial',
      'npm run gate:content',
      'npm run gate:human',
      'npm run gate:machine',
    ]
  );
  assert.ok(run.calls.every(({ cwd }) => cwd === join(root, 'site')));
});

test('prettier is never run on the semantic core, and only the entry, the content facts and the disposition files are formatted', async () => {
  const root = repo();
  const run = fakeRun(root);
  await assemble(root, run);

  assert.ok(!run.calls.some(({ key }) => key.includes('prettier') && key.includes('SEMANTIC-CORE')));
  assert.equal(run.calls.filter(({ key }) => key.startsWith('npx prettier')).length, 3);
});

test('the entry text is the formatted text, and the disposition digest is the digest of that text', async () => {
  const root = repo();
  const draft = { ...DRAFTS.article, body: 'A line with trailing spaces.   \n\nAnother line.\t' };
  const { files } = await assemble(root, fakeRun(root), { draft });

  const entry = textOf(files, ENTRY);
  const [row] = JSON.parse(textOf(files, DISPOSITION));

  assert.ok(!/[ \t]+$/m.test(entry));
  assert.equal(row.digest, digestOf(entry));
});

test('the generated disposition holds a row for the entry file and a row for its page, in the layout of the repository files', async () => {
  const root = repo();
  const { files } = await assemble(root, fakeRun(root));
  const text = textOf(files, DISPOSITION);
  const rows = JSON.parse(text);

  assert.equal(text, `${JSON.stringify(rows, null, 2)}\n`);
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0]), ['target', 'status', 'reason', 'digest']);
  assert.equal(rows[0].target, FORMATTED_ENTRY);
  assert.equal(rows[1].target, `/blog/${SLUG}`);
  assert.deepEqual(Object.keys(rows[1]), ['target', 'status', 'reason', 'digest']);
  assert.equal(rows[0].status, 'rewritten');
  assert.match(rows[0].reason, new RegExp(`claims/${SLUG}\\.json`));
  assert.match(rows[0].reason, new RegExp(`generations/${SLUG}\\.json`));
});

test('the content-facts row is the claim query in lower case, and no other row moved', async () => {
  const root = repo();
  const before = JSON.parse(read(root, 'site/content-facts.json'));
  const { files } = await assemble(root, fakeRun(root));
  const after = JSON.parse(textOf(files, 'site/content-facts.json'));

  assert.equal(after.targetQuery[`/blog/${SLUG}`], 'ai incident runbook');
  assert.deepEqual(
    { ...after.targetQuery, [`/blog/${SLUG}`]: undefined },
    { ...before.targetQuery, [`/blog/${SLUG}`]: undefined }
  );
  assert.deepEqual(after.numbers, before.numbers);
});

test('the passage sits under its prompt, and the generated layer was regenerated after the insertion', async () => {
  const root = repo();
  const { files } = await assemble(root, fakeRun(root));
  const doc = textOf(files, 'docs/SEMANTIC-CORE.md');
  const prompt = parseBuyerPrompts(doc).find(({ number }) => number === 22);

  assert.ok(prompt.passages.some(({ text, route }) => text === DRAFTS.article.passage && route === `/blog/${SLUG}`));
  assert.ok(doc.includes(`| \`/blog/${SLUG}\` | ai incident runbook |`));
});

test('a term entry also lands in the registers', async () => {
  const root = repo();
  const { files } = await assemble(root, fakeRun(root), { format: 'term' });

  assert.ok(textOf(files, 'docs/SEMANTIC-CORE.md').includes('| `/glossary/model-registry` |'));
  assert.ok(textOf(files, 'site/src/data/glossary/model-registry.md'));
  assert.ok(textOf(files, 'audits/phase-4.7/dispositions/generated-model-registry.json'));
});

test('a failing information gate is recorded with its exit code and does not stop the assembly', async () => {
  const root = repo();
  const { gates, files } = await assemble(root, fakeRun(root, { exits: { 'gate:human': 3, 'gate:content': 1 } }));

  assert.deepEqual(
    gates.filter(({ exit }) => exit !== 0),
    [
      { name: 'gate:content', exit: 1 },
      { name: 'gate:human', exit: 3 },
    ]
  );
  assert.equal(files.length, 5);
});

test('a failed build names the command and carries only the last 20 lines of its output', async () => {
  const root = repo();
  const stdout = Array.from({ length: 30 }, (_, index) => `output line ${index + 1}`).join('\n');
  const run = fakeRun(root, { fail: { 'npm run build': { status: 1, stdout, stderr: 'the build broke' } } });

  await assert.rejects(
    assemble(root, run),
    (error) =>
      error instanceof WriterError &&
      error.kind === 'build' &&
      error.message.includes('npm run build') &&
      error.message.includes('output line 30') &&
      error.message.includes('the build broke') &&
      error.message.includes('output line 12') &&
      !error.message.includes('output line 11\n')
  );
});

const STEPS = [
  `npx prettier --write ${FORMATTED_ENTRY}`,
  'npx prettier --write content-facts.json',
  'npm run build',
  'node scripts/semantic-core.mjs',
  'node scripts/generate-registers.mjs',
  `node scripts/disposition-digest.mjs . dist ${FORMATTED_ENTRY}`,
  ROUTE_DIGEST,
  STALE_COMMAND,
  DISPOSITION_FORMAT,
  'node scripts/semantic-core.mjs --check dist',
  'npm run gate:registers',
  'npm run gate:editorial',
];

for (const step of STEPS) {
  test(`when "${step}" fails the tree is byte for byte what it was, with no branch and no stray file`, async () => {
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

test('a command that never finishes is a failure naming the command, and the tree is restored', async () => {
  const root = repo();
  const before = untouched(root);
  const run = fakeRun(root, { fail: { 'npm run build': { status: null, stdout: '', stderr: 'timed out' } } });

  await assert.rejects(
    assemble(root, run),
    (error) =>
      error instanceof WriterError &&
      error.message.includes('npm run build') &&
      error.message.includes('did not finish')
  );
  assert.deepEqual(untouched(root), before);
});

test('a command that throws leaves the tree restored and lets the error through', async () => {
  const root = repo();
  const before = untouched(root);
  const inner = fakeRun(root);
  const run = (command, args, options) => {
    if (args.includes('build')) throw new Error('spawn failed');
    return inner(command, args, options);
  };

  await assert.rejects(assemble(root, run), /spawn failed/);
  assert.deepEqual(untouched(root), before);
});

test('a digest that is not twelve hex digits is a failure, and the tree is restored', async () => {
  const root = repo();
  const before = untouched(root);
  const key = `node scripts/disposition-digest.mjs . dist ${FORMATTED_ENTRY}`;

  await assert.rejects(
    assemble(root, fakeRun(root, { fail: { [key]: { status: 0, stdout: 'not a digest\n' } } })),
    WriterError
  );
  assert.deepEqual(untouched(root), before);
});

test('a passage the built page does not carry fails the semantic-core check, and the tree is restored', async () => {
  const root = repo();
  const before = untouched(root);
  const draft = { ...DRAFTS.article, passage: 'A sentence that is not in the entry at all.' };

  await assert.rejects(
    assemble(root, fakeRun(root), { draft }),
    (error) => error instanceof WriterError && error.message.includes('buyer-prompt-passage-missing')
  );
  assert.deepEqual(untouched(root), before);
});

test('a prompt number the document does not hold stops the assembly before any file or command is touched', async () => {
  const root = repo();
  const before = untouched(root);
  const run = fakeRun(root);
  const claim = { ...claimOf('article'), prompt: { number: 99, text: 'no such prompt' } };

  await assert.rejects(
    assemble(root, run, { claim }),
    (error) => error instanceof WriterError && error.message.includes('99')
  );
  assert.deepEqual(run.calls, []);
  assert.deepEqual(untouched(root), before);
});

test('a query that content-facts already gives to another route stops the assembly before any file is touched', async () => {
  const root = repo();
  const before = untouched(root);
  const run = fakeRun(root);
  const claim = { ...claimOf('article'), query: 'Existing Post Query' };

  await assert.rejects(
    assemble(root, run, { claim }),
    (error) => error instanceof WriterError && error.message.includes('/blog/existing-post')
  );
  assert.deepEqual(run.calls, []);
  assert.deepEqual(untouched(root), before);
});

test('an entry or a disposition that is already on disk is never overwritten', async () => {
  for (const path of [ENTRY, DISPOSITION]) {
    const root = repo();
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), 'written by hand\n');
    const before = untouched(root);
    const run = fakeRun(root);

    await assert.rejects(assemble(root, run), (error) => error instanceof WriterError && error.message.includes(path));
    assert.deepEqual(run.calls, []);
    assert.deepEqual(untouched(root), before);
  }
});

test('a format the writer does not write is refused before any file is touched', async () => {
  const root = repo();
  const before = untouched(root);
  const run = fakeRun(root);

  await assert.rejects(
    assemble(root, run, { claim: { ...claimOf('term'), format: 'faq-answer' } }),
    (error) => error instanceof WriterError && error.message.includes('faq-answer')
  );
  assert.deepEqual(run.calls, []);
  assert.deepEqual(untouched(root), before);
});
