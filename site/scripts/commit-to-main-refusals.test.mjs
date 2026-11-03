import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { isGenerationRecord, refusalFor, removalRefusalFor } from './autowriter-refusals.mjs';
import { CommitError, commitAndPush, runCli } from './commit-to-main.mjs';
import { restatedReason } from './disposition-restate.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const IDENTITY = { name: 'Test Writer', email: 'writer@example.test' };
const SEED = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const BAND = 'audits/sentence-band.json';
const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
const CLAIMED_AT = '2026-11-01T07:00:00.000Z';
const LEDGER = recordPath('ledger', 'model-registry', CLAIMED_AT);
const GENERATED = recordPath('disposition', 'model-registry', CLAIMED_AT);
const PLACEMENTS = [ROUTES, GENERATED, `${recordDirectory('disposition')}/2026/11/extra/generated-model-registry.json`];
const directories = [];

after(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const ROWS = [
  { target: '/', status: 'verified', reason: 'The home page was re-read.', digest: 'aaaaaaaaaaaa' },
  {
    target: '/blog',
    location: 'head.title',
    status: 'verified',
    reason: 'The title was checked.',
    digest: 'aaaaaaaaaaaa',
  },
];
const asFile = (rows) => JSON.stringify(rows, null, 2) + '\n';
const BASE = {
  'README.md': 'seed\n',
  [BAND]: '{"low":1}\n',
  'audits/lighthouse-green.json': '{"green":true}\n',
  'audits/phase-4.7/lh-measured.json': '{"tree":"a"}\n',
  [ROUTES]: asFile(ROWS),
  [LEDGER]: '{"attempts":1}\n',
};

function makeWorld(files = {}) {
  const base = mkdtempSync(join(tmpdir(), 'commit-to-main-refusals-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  const repo = join(base, 'work');
  git(base, 'init', '--bare', '--initial-branch=main', remote);
  mkdirSync(repo);
  git(repo, 'init', '--initial-branch=main');
  for (const [path, text] of Object.entries({ ...BASE, ...files })) put(repo, path, text);
  git(repo, 'add', '--all');
  git(repo, ...SEED, 'commit', '--message', 'seed');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', 'origin', 'main');
  return { repo, remote, remoteHead: () => git(remote, 'rev-parse', 'refs/heads/main') };
}

const request = (repoRoot, overrides = {}) => ({
  repoRoot,
  paths: ['content/a.txt'],
  message: 'Add a',
  identity: IDENTITY,
  ...overrides,
});

const refusedWith =
  (...parts) =>
  (error) =>
    error instanceof CommitError && parts.every((part) => error.message.includes(part));

function silent() {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    return { status: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}

const spelled = [
  [BAND, 'sentence-band'],
  ['audits/entry-length.json', 'entry-length'],
  ['audits/lighthouse-green.json', 'lighthouse-record'],
  ['audits/phase-4.7/lh-measured.json', 'lighthouse-stamp'],
  ['audits/phase-4.7/lh-mobile/lhr-0.json', 'lighthouse-report'],
  ['./' + BAND, 'sentence-band'],
  ['audits//sentence-band.json', 'sentence-band'],
  ['audits\\sentence-band.json', 'sentence-band'],
  ['Audits/Sentence-Band.JSON', 'sentence-band'],
];

for (const [path, id] of spelled) {
  test(JSON.stringify(path) + ' is refused as ' + id + ', naming why, before git is called', async () => {
    const fake = silent();

    await assert.rejects(
      commitAndPush(request('/repo', { paths: ['content/a.txt', path], run: fake.run })),
      refusedWith(id + ': ' + refusalFor(path).why)
    );
    assert.equal(fake.calls.length, 0);
  });
}

test('the CLI exits 1 and names the refused path and its reason, and git is never reached', async () => {
  const lines = [];
  const code = await runCli(['--message', 'x', '--path', BAND], {
    repoRoot: '/this/root/does/not/exist',
    commit: undefined,
    err: (text) => lines.push(text),
  });

  assert.equal(code, 1);
  assert.ok(lines.join('\n').includes('sentence-band: ' + refusalFor(BAND).why), lines.join('\n'));
});

test('a modified refused file that nobody listed stays out of the commit and stays modified', async () => {
  const world = makeWorld();
  put(world.repo, BAND, '{"low":2}\n');
  put(world.repo, 'content/a.txt', 'alpha\n');

  const result = await commitAndPush(request(world.repo));

  assert.equal(git(world.remote, 'show', '--name-only', '--format=', result.commit), 'content/a.txt');
  assert.equal(git(world.repo, 'status', '--porcelain'), 'M ' + BAND);
});

const REACHED = [
  ['a directory that holds it', ['audits']],
  ['a directory with a trailing slash', ['audits/']],
  ['the repository root', ['.']],
  ['a wildcard', ['audits/sentence-b*']],
  ['a glob pathspec', [':(glob)audits/**/*.json']],
  ['a pathspec from the top', [':/audits']],
  ['an ordinary file beside it', ['content/a.txt', 'audits']],
];

for (const [name, paths] of REACHED) {
  test('a refused file reached through ' + name + ' is refused after the add, and everything is unstaged', async () => {
    const world = makeWorld();
    const head = git(world.repo, 'rev-parse', 'HEAD');
    put(world.repo, BAND, '{"low":2}\n');
    put(world.repo, 'content/a.txt', 'alpha\n');

    await assert.rejects(
      commitAndPush(request(world.repo, { paths })),
      refusedWith(BAND, 'sentence-band: ' + refusalFor(BAND).why)
    );

    assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
    assert.equal(git(world.repo, 'rev-parse', 'HEAD'), head);
    assert.equal(world.remoteHead(), head);
    assert.equal(readFileSync(join(world.repo, BAND), 'utf8'), '{"low":2}\n');
    assert.equal(readFileSync(join(world.repo, 'content/a.txt'), 'utf8'), 'alpha\n');
  });
}

test('a refused file that was moved away is refused as a deletion, not hidden as a rename', async () => {
  const world = makeWorld();
  renameSync(join(world.repo, BAND), join(world.repo, 'audits/moved.json'));

  await assert.rejects(commitAndPush(request(world.repo, { paths: ['audits'] })), refusedWith(BAND, 'sentence-band: '));
  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
});

test('the refusal says so when the paths could not be unstaged', async () => {
  const run = (args) => {
    if (args[0] === 'diff') return { status: 0, stdout: BAND + '\n', stderr: '' };
    if (args[0] === 'reset') return { status: 1, stdout: '', stderr: 'fatal: index.lock exists' };
    return { status: 0, stdout: '', stderr: '' };
  };

  await assert.rejects(
    commitAndPush(request('/repo', { paths: ['audits'], run })),
    refusedWith('sentence-band', 'still staged', 'index.lock exists')
  );
});

const moved = (rows, indexes, digest) => rows.map((row, index) => (indexes.includes(index) ? { ...row, digest } : row));
const RESTATE = {
  status: 'rewritten',
  reason: restatedReason({
    routes: ['/glossary/model-registry'],
    generationPaths: [recordPath('generation', 'model-registry', CLAIMED_AT)],
  }),
};

test('a digest that moves under the reason a person wrote is refused as the seal, naming the entries', async () => {
  const world = makeWorld();
  const head = git(world.repo, 'rev-parse', 'HEAD');
  put(world.repo, ROUTES, asFile(moved(ROWS, [0, 1], 'bbbbbbbbbbbb')));

  await assert.rejects(
    commitAndPush(request(world.repo, { paths: [ROUTES] })),
    refusedWith(ROUTES, 'disposition-seal:', 'entries: /, /blog head.title')
  );

  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(world.remoteHead(), head);
});

test('the seal is refused too when the whole dispositions directory is the path', async () => {
  const world = makeWorld();
  put(world.repo, ROUTES, asFile(moved(ROWS, [0], 'bbbbbbbbbbbb')));

  await assert.rejects(
    commitAndPush(request(world.repo, { paths: ['audits/phase-4.7/dispositions'] })),
    refusedWith('disposition-seal:')
  );
});

test('a seal is refused in a disposition file wherever it lies: flat, in its month and below it make three', async () => {
  let refused = 0;
  for (const path of PLACEMENTS) {
    const world = makeWorld({ [path]: asFile(ROWS) });
    const head = git(world.repo, 'rev-parse', 'HEAD');
    put(world.repo, path, asFile(moved(ROWS, [0, 1], 'bbbbbbbbbbbb')));

    await assert.rejects(
      commitAndPush(request(world.repo, { paths: [recordDirectory('disposition')] })),
      refusedWith(path, 'disposition-seal:', 'entries: /, /blog head.title')
    );
    refused += 1;

    assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
    assert.equal(world.remoteHead(), head);
  }
  assert.equal(refused, 3);
});

test('a disposition file that cannot be read is refused, and so is a restate that is not a list', async () => {
  for (const text of ['{not json', '{"target":"/"}']) {
    const world = makeWorld();
    put(world.repo, ROUTES, text);

    await assert.rejects(
      commitAndPush(request(world.repo, { paths: [ROUTES] })),
      refusedWith(ROUTES, 'disposition-unreadable:')
    );
  }
});

test('a restate is committed and pushed: the digest, the status and the reason all move', async () => {
  const world = makeWorld();
  const text = asFile(moved(ROWS, [0, 1], 'bbbbbbbbbbbb').map((row) => ({ ...row, ...RESTATE })));
  put(world.repo, ROUTES, text);

  const result = await commitAndPush(request(world.repo, { paths: [ROUTES] }));

  assert.equal(result.committed, true);
  assert.equal(world.remoteHead(), result.commit);
  assert.equal(git(world.remote, 'show', result.commit + ':' + ROUTES) + '\n', text);
});

test('a new disposition file and a ledger are committed as before', async () => {
  const world = makeWorld();
  put(world.repo, GENERATED, '[]\n');
  put(world.repo, LEDGER, '{"attempts":2}\n');

  const paths = [GENERATED, LEDGER];
  const result = await commitAndPush(request(world.repo, { paths }));

  assert.equal(result.committed, true);
  assert.equal(
    git(world.remote, 'show', '--name-only', '--format=', result.commit).split('\n').sort().join('|'),
    [...paths].sort().join('|')
  );
});

test('a restate is committed wherever the disposition file lies: flat, in its month and below it make three', async () => {
  let committed = 0;
  for (const path of PLACEMENTS) {
    const world = makeWorld({ [path]: asFile(ROWS) });
    const text = asFile(moved(ROWS, [0, 1], 'bbbbbbbbbbbb').map((row) => ({ ...row, ...RESTATE })));
    put(world.repo, path, text);

    const result = await commitAndPush(request(world.repo, { paths: [path] }));

    assert.equal(result.committed, true);
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'show', result.commit + ':' + path) + '\n', text);
    committed += 1;
  }
  assert.equal(committed, 3);
});

const GENERATIONS = recordDirectory('generation');
const RECORD = recordPath('generation', 'model-registry', CLAIMED_AT);
const FLAT_RECORD = `${GENERATIONS}/model-registry.json`;
const DEEP_RECORD = `${GENERATIONS}/2026/11/extra/model-registry.json`;
const RECORD_PLACEMENTS = [FLAT_RECORD, RECORD, DEEP_RECORD];
const RECORD_TEXT = '{"slug":"model-registry"}\n';
const REMOVED = `generation-record-removed: ${removalRefusalFor(FLAT_RECORD).why}`;
const MOVED_OUT = 'audits/autowriter/moved-model-registry.json';
const CLAIM = recordPath('claim', 'model-registry', CLAIMED_AT);

function worldWithRecord(record = RECORD) {
  return makeWorld({ [record]: RECORD_TEXT, 'content/a.txt': 'alpha\n' });
}

function moveFile(world, from, to) {
  mkdirSync(dirname(join(world.repo, to)), { recursive: true });
  renameSync(join(world.repo, from), join(world.repo, to));
}

function assertNothingMoved(world, head) {
  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(git(world.repo, 'rev-parse', 'HEAD'), head);
  assert.equal(world.remoteHead(), head);
}

test('a listed generation record that was deleted is refused wherever it lies: flat, in its month and below it make three', async () => {
  let refused = 0;
  for (const record of RECORD_PLACEMENTS) {
    const world = worldWithRecord(record);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    rmSync(join(world.repo, record));

    await assert.rejects(commitAndPush(request(world.repo, { paths: [record] })), refusedWith(record, REMOVED));
    refused += 1;

    assertNothingMoved(world, head);
    assert.equal(existsSync(join(world.repo, record)), false);
    assert.equal(git(world.repo, 'status', '--porcelain'), 'D ' + record);
  }
  assert.equal(refused, 3);
});

test('a deleted record listed with an ordinary new file refuses the whole commit, flat, in its month and below it', async () => {
  let refused = 0;
  for (const record of RECORD_PLACEMENTS) {
    const world = worldWithRecord(record);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    rmSync(join(world.repo, record));
    put(world.repo, 'content/b.txt', 'beta\n');

    await assert.rejects(
      commitAndPush(request(world.repo, { paths: ['content/b.txt', record] })),
      refusedWith(record, 'generation-record-removed')
    );
    refused += 1;

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, 'content/b.txt'), 'utf8'), 'beta\n');
    assert.equal(git(world.remote, 'ls-tree', '-r', '--name-only', 'main').includes('content/b.txt'), false);
  }
  assert.equal(refused, 3);
});

test('a modified record and a newly added record are committed and pushed, flat, in their month and below it', async () => {
  let committed = 0;
  for (const record of RECORD_PLACEMENTS) {
    const added = record.replace('model-registry', 'another-entry');
    const world = worldWithRecord(record);
    put(world.repo, record, '{"slug":"model-registry","changed":true}\n');
    put(world.repo, added, '{"slug":"another-entry"}\n');

    const result = await commitAndPush(request(world.repo, { paths: [record, added] }));

    assert.equal(result.committed, true);
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(
      git(world.remote, 'show', '--name-status', '--format=', result.commit).split('\n').sort().join('|'),
      ['A\t' + added, 'M\t' + record].sort().join('|')
    );
    committed += 1;
  }
  assert.equal(committed, 3);
});

const RENAMES = [
  ['month record renamed within its month directory', RECORD, `${GENERATIONS}/2026/11/renamed.json`],
  ['month record renamed into another month directory', RECORD, `${GENERATIONS}/2026/12/model-registry.json`],
  ['month record renamed into the flat generations directory', RECORD, FLAT_RECORD],
  ['month record renamed out of the family', RECORD, MOVED_OUT],
  ['flat record re-homed into its month', FLAT_RECORD, RECORD],
  ['flat record renamed within the flat directory', FLAT_RECORD, `${GENERATIONS}/renamed.json`],
  ['flat record renamed out of the family', FLAT_RECORD, MOVED_OUT],
  ['deeper record re-homed into its month', DEEP_RECORD, RECORD],
];

for (const [name, from, to] of RENAMES) {
  test('a ' + name + ' is refused as a removal when both paths are listed', async () => {
    const world = worldWithRecord(from);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    moveFile(world, from, to);

    await assert.rejects(commitAndPush(request(world.repo, { paths: [from, to] })), refusedWith(from, REMOVED));

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, to), 'utf8'), RECORD_TEXT);
    assert.equal(existsSync(join(world.repo, from)), false);
  });

  test('a ' + name + ' is refused as a removal when only the old path is listed', async () => {
    const world = worldWithRecord(from);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    moveFile(world, from, to);

    await assert.rejects(commitAndPush(request(world.repo, { paths: [from] })), refusedWith(from, REMOVED));

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, to), 'utf8'), RECORD_TEXT);
    assert.equal(existsSync(join(world.repo, from)), false);
  });

  test('a ' + name + ' with only the new path listed commits the addition and leaves the old record', async () => {
    const world = worldWithRecord(from);
    moveFile(world, from, to);

    const result = await commitAndPush(request(world.repo, { paths: [to] }));

    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'show', '--name-status', '--format=', result.commit), 'A\t' + to);
    assert.equal(git(world.remote, 'show', result.commit + ':' + from) + '\n', RECORD_TEXT);
    assert.equal(git(world.repo, 'status', '--porcelain'), 'D ' + from);
  });

  test('after a ' + name + ' with only the new path listed the old record is still a generation record', async () => {
    const world = worldWithRecord(from);
    moveFile(world, from, to);

    const result = await commitAndPush(request(world.repo, { paths: [to] }));

    const tree = git(world.remote, 'ls-tree', '-r', '--name-only', result.commit).split('\n');
    assert.ok(tree.includes(from), tree.join('\n'));
    assert.ok(tree.filter(isGenerationRecord).includes(from), tree.filter(isGenerationRecord).join('\n'));
  });
}

const NOT_RECORDS = [
  ['an ordinary file', 'content/a.txt'],
  ['a ledger in its month', LEDGER],
  ['a claim in its month', CLAIM],
  ['a generated disposition in its month', GENERATED],
  ['a file that is not json among the records', `${GENERATIONS}/notes.txt`],
];

test('a deleted path that is not a generation record is committed as a removal: five kinds are tried', async () => {
  let committed = 0;
  for (const [, path] of NOT_RECORDS) {
    const world = makeWorld({
      'content/a.txt': 'alpha\n',
      [CLAIM]: '{"status":"written"}\n',
      [GENERATED]: '[]\n',
      [`${GENERATIONS}/notes.txt`]: 'notes\n',
    });
    rmSync(join(world.repo, path));

    const result = await commitAndPush(request(world.repo, { paths: [path] }));

    assert.equal(result.committed, true);
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'show', '--name-status', '--format=', result.commit), 'D\t' + path);
    committed += 1;
  }
  assert.equal(committed, NOT_RECORDS.length);
  assert.equal(committed, 5);
});

test('the CLI exits 1 and prints the refusal for a deleted generation record, flat, in its month and below it', async () => {
  let refused = 0;
  for (const record of RECORD_PLACEMENTS) {
    const world = worldWithRecord(record);
    const head = git(world.repo, 'rev-parse', 'HEAD');
    rmSync(join(world.repo, record));
    const lines = [];

    const code = await runCli(['--message', 'x', '--path', record], {
      repoRoot: world.repo,
      err: (text) => lines.push(text),
    });

    assert.equal(code, 1);
    assert.ok(lines.join('\n').includes(record + ': ' + REMOVED), lines.join('\n'));
    assertNothingMoved(world, head);
    refused += 1;
  }
  assert.equal(refused, 3);
});
