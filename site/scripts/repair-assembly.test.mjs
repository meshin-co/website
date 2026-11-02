import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, afterEach, test } from 'node:test';

import { ATTEMPT_CAP } from './autowriter-ledger.mjs';
import { isDispositionFile, refusalOf } from './autowriter-refusals.mjs';
import { repairedReason } from './disposition-restate.mjs';
import { claimOf, DRAFTS, RUN_DAY, splitEntry } from './fixtures/entry-drafts.mjs';
import {
  buildFailure,
  commitFiles,
  emptyRepo,
  ENTRY,
  FORMAT,
  keysOf,
  landedRepo,
  OWN,
  OWNER_REASON,
  pathsOf,
  PRETTIER_ENTRY,
  read,
  refusedAsDeleted,
  removeRepos,
  removeTemplates,
  repair,
  REPAIRED,
  repairRun,
  reworded,
  ROUTE,
  ROUTES,
  SLUG,
  STALE_COMMAND,
  strayRun,
  textOf,
  treeOf,
  UNTOUCHED,
} from './fixtures/repair-repo.mjs';
import { digestOf, fakeRun, gitIn } from './fixtures/route-repo.mjs';

afterEach(removeRepos);
after(removeTemplates);

const CORE = 'docs/SEMANTIC-CORE.md';
const DRAFT_DESCRIPTION = REPAIRED.fields.description;
const COMMANDS = [
  PRETTIER_ENTRY,
  'npm run build',
  'node scripts/semantic-core.mjs',
  'node scripts/generate-registers.mjs',
  STALE_COMMAND,
  FORMAT,
  'node scripts/semantic-core.mjs --check dist',
  'npm run gate:registers',
  'npm run gate:editorial',
  'npm run gate:content',
  'npm run gate:human',
  'npm run gate:machine',
  'git status --porcelain -z --untracked-files=all',
];
const reasonOf = (number) => repairedReason({ route: ROUTE, slug: SLUG, attempt: { number, of: ATTEMPT_CAP } });
const layout = (rows) => `${JSON.stringify(rows, null, 2)}\n`;

test('it returns the entry and every file its text made stale, sorted by path, and the six gates it ran', async () => {
  const root = await landedRepo();
  const result = await repair(root, repairRun(root));

  assert.deepEqual(pathsOf(result), [OWN, ROUTES, ENTRY]);
  assert.ok(result.files.every(({ text }) => typeof text === 'string' && text.endsWith('\n')));
  assert.deepEqual(result.gates, [
    { name: 'semantic-core', exit: 0 },
    { name: 'gate:registers', exit: 0 },
    { name: 'gate:editorial', exit: 0 },
    { name: 'gate:content', exit: 0 },
    { name: 'gate:human', exit: 0 },
    { name: 'gate:machine', exit: 0 },
  ]);
});

test('it runs the commands in order, the site ones from site/ and git from the repository root', async () => {
  const root = await landedRepo();
  const run = repairRun(root);
  await repair(root, run);

  assert.deepEqual(keysOf(run), COMMANDS);
  for (const { key, cwd } of run.calls) assert.equal(cwd, key.startsWith('git ') ? root : join(root, 'site'), key);
});

test('the entry is written before any command runs, and no baseline build or gate precedes the one build', async () => {
  const root = await landedRepo();
  const original = read(root, ENTRY);
  const onDisk = [];
  const record = () => onDisk.push(read(root, ENTRY));
  const run = repairRun(root, { before: { [PRETTIER_ENTRY]: record, 'npm run build': record } });
  const result = await repair(root, run);

  assert.equal(keysOf(run)[0], PRETTIER_ENTRY);
  assert.equal(keysOf(run).filter((key) => key === 'npm run build').length, 1);
  assert.equal(keysOf(run).filter((key) => key === 'npm run gate:editorial').length, 1);
  assert.notEqual(onDisk[0], original);
  assert.equal(onDisk[1], textOf(result, ENTRY));
});

test('a tree that is already red is repaired, because the repair is what turns it green', async () => {
  const root = await landedRepo();
  commitFiles(root, [{ path: ENTRY, text: `${read(root, ENTRY)}\nA hand edit nobody dispositioned.\n` }], 'hand edit');
  const probe = fakeRun(root)('npm', ['run', 'gate:editorial'], { cwd: join(root, 'site') });
  assert.equal(probe.status, 1);

  const { gates, files } = await repair(root, repairRun(root));

  assert.ok(gates.every(({ exit }) => exit === 0));
  assert.ok(files.some(({ path }) => path === OWN));
});

test('the entry is the draft rendered with the run date it was given', async () => {
  const root = await landedRepo();
  const { frontmatter } = splitEntry(textOf(await repair(root, repairRun(root)), ENTRY));
  const dated = splitEntry(textOf(await repair(root, repairRun(root), { runDate: '2026-03-04' }), ENTRY));

  assert.equal(frontmatter.description, DRAFT_DESCRIPTION);
  assert.deepEqual(frontmatter.publishDate, RUN_DAY);
  assert.deepEqual(dated.frontmatter.publishDate, new Date('2026-03-04T00:00:00Z'));
});

test('every stale file is restated under the repair reason, the entry own disposition included, and no other row moves', async () => {
  const root = await landedRepo();
  const shared = JSON.parse(read(root, ROUTES));
  const result = await repair(root, repairRun(root));
  const entry = textOf(result, ENTRY);
  const own = JSON.parse(textOf(result, OWN));
  const routes = JSON.parse(textOf(result, ROUTES));
  const reason = reasonOf(1);
  const page = digestOf(`page:${entry}`);

  assert.equal(shared.at(-1).reason, OWNER_REASON);
  assert.deepEqual(
    own.map((row) => [row.target, row.status, row.reason, row.digest]),
    [
      [`src/data/post/${SLUG}.md`, 'rewritten', reason, digestOf(entry)],
      [ROUTE, 'rewritten', reason, page],
    ]
  );
  assert.deepEqual(routes.slice(0, -1), shared.slice(0, -1));
  assert.deepEqual(routes.at(-1), { ...shared.at(-1), status: 'rewritten', reason, digest: page });
  assert.equal(textOf(result, OWN), layout(own));
  assert.equal(textOf(result, ROUTES), layout(routes));
});

test('the reason names the attempt it was written in', async () => {
  const root = await landedRepo();
  const result = await repair(root, repairRun(root), { attempt: { number: 2, of: ATTEMPT_CAP } });
  const reasons = JSON.parse(textOf(result, OWN)).map(({ reason }) => reason);

  assert.deepEqual(reasons, [reasonOf(2), reasonOf(2)]);
  assert.ok(reasons[0].includes(`attempt 2 of ${ATTEMPT_CAP}.`));
});

test('a restate under attempt two is not read as a seal by the guard that refuses one', async () => {
  const root = await landedRepo();
  commitFiles(root, (await repair(root, repairRun(root))).files, 'attempt 1');
  const second = await repair(root, repairRun(root), {
    draft: reworded('A second wording of the description.'),
    attempt: { number: 2, of: ATTEMPT_CAP },
  });

  const moved = second.files.filter(({ path }) => isDispositionFile(path));
  assert.deepEqual(
    moved.map(({ path }) => path),
    [OWN, ROUTES]
  );
  for (const { path, text } of moved)
    assert.equal(refusalOf({ path, before: gitIn(root, 'show', `HEAD:${path}`), after: text }), null, path);
  assert.equal(JSON.parse(textOf(second, OWN))[0].reason, reasonOf(2));
});

test('a generated file the regeneration changed comes back with the entry, and the tree gets the original back', async () => {
  const root = await landedRepo();
  const original = read(root, CORE);
  const note = () => writeFileSync(join(root, CORE), `${read(root, CORE)}\nA note a command appended.\n`);
  const run = repairRun(root, { before: { 'node scripts/semantic-core.mjs --check dist': note } });
  const result = await repair(root, run);

  assert.ok(textOf(result, CORE).endsWith('A note a command appended.\n'));
  assert.equal(read(root, CORE), original);
});

test('it leaves the working tree exactly as it found it, so what it returns is not on disk', async () => {
  const root = await landedRepo();
  const before = treeOf(root);
  const { files } = await repair(root, repairRun(root));

  assert.equal(files.length, 3);
  assert.equal(before.status, '');
  assert.deepEqual(treeOf(root), before);
});

const BLOCKING = ['node scripts/semantic-core.mjs --check dist', 'npm run gate:registers', 'npm run gate:editorial'];

for (const check of BLOCKING)
  test(`when the blocking check "${check}" fails the entry is restored and the tree is byte for byte what it was`, async () => {
    const root = await landedRepo();
    const before = treeOf(root);
    const original = read(root, ENTRY);
    const run = repairRun(root, { fail: { [check]: { status: 1, stdout: 'findings: 1' } } });

    await assert.rejects(repair(root, run), buildFailure(check, 'findings: 1'));

    assert.equal(keysOf(run).at(-1), check);
    assert.equal(read(root, ENTRY), original);
    assert.deepEqual(treeOf(root), before);
  });

test('an entry that is not on disk is refused, because a repair never creates one, and nothing is touched', async () => {
  const root = emptyRepo();
  const before = treeOf(root);
  const run = repairRun(root);

  await assert.rejects(repair(root, run), buildFailure(ENTRY));
  assert.deepEqual(run.calls, []);
  assert.deepEqual(treeOf(root), before);
});

test('a deleted tracked file is refused by name, and the entry is still put back', async () => {
  const root = await landedRepo();
  const original = read(root, ENTRY);

  await assert.rejects(
    repair(
      root,
      strayRun(root, () => rmSync(join(root, UNTOUCHED)))
    ),
    refusedAsDeleted(UNTOUCHED)
  );
  assert.equal(read(root, ENTRY), original);
});

test('a failing information gate is recorded with its exit code, never stops the run, and the files still come back', async () => {
  const root = await landedRepo();
  const { gates, files } = await repair(root, repairRun(root, { exits: { 'gate:human': 3, 'gate:content': 1 } }));

  assert.deepEqual(
    gates.filter(({ exit }) => exit !== 0),
    [
      { name: 'gate:content', exit: 1 },
      { name: 'gate:human', exit: 3 },
    ]
  );
  assert.equal(files.length, 3);
});

test('a glossary entry is repaired the same way: its own disposition, the shared row and the entry come back', async () => {
  const root = await landedRepo('term');
  const run = repairRun(root);
  const draft = { ...DRAFTS.term, fields: { ...DRAFTS.term.fields, description: 'A model registry lists models.' } };
  const { files } = await repair(root, run, { claim: claimOf('term'), draft });

  assert.deepEqual(
    files.map(({ path }) => path),
    ['audits/phase-4.7/dispositions/generated-model-registry.json', ROUTES, 'site/src/data/glossary/model-registry.md']
  );
  assert.ok(keysOf(run).includes('npx prettier --write src/data/glossary/model-registry.md'));
});

test('a draft that changes nothing returns no file, and no format command is run without a path', async () => {
  const root = await landedRepo();
  const run = repairRun(root);
  const { files, gates } = await repair(root, run, { draft: DRAFTS.article });

  assert.deepEqual(files, []);
  assert.ok(gates.every(({ exit }) => exit === 0));
  assert.ok(keysOf(run).includes(STALE_COMMAND));
  assert.ok(keysOf(run).every((key) => key !== 'npx prettier --write'));
});
