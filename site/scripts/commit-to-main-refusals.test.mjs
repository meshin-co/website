import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { refusalFor, removalRefusalFor } from './autowriter-refusals.mjs';
import { CommitError, commitAndPush, runCli } from './commit-to-main.mjs';
import { restatedReason } from './disposition-restate.mjs';

for (const variable of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[variable];
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const IDENTITY = { name: 'Test Writer', email: 'writer@example.test' };
const SEED = ['-c', 'user.name=Seed', '-c', 'user.email=seed@example.test', '-c', 'commit.gpgsign=false'];
const BAND = 'audits/sentence-band.json';
const ROUTES = 'audits/phase-4.7/dispositions/routes.json';
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
  'audits/autowriter/ledger.json': '{"attempts":1}\n',
};

function makeWorld() {
  const base = mkdtempSync(join(tmpdir(), 'commit-to-main-refusals-'));
  directories.push(base);
  const remote = join(base, 'remote.git');
  const repo = join(base, 'work');
  git(base, 'init', '--bare', '--initial-branch=main', remote);
  mkdirSync(repo);
  git(repo, 'init', '--initial-branch=main');
  for (const [path, text] of Object.entries(BASE)) put(repo, path, text);
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
  reason: restatedReason({ routes: ['/glossary/model-registry'], slugs: ['model-registry'] }),
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
  put(world.repo, 'audits/phase-4.7/dispositions/generated-model-registry.json', '[]\n');
  put(world.repo, 'audits/autowriter/ledger.json', '{"attempts":2}\n');

  const paths = ['audits/phase-4.7/dispositions/generated-model-registry.json', 'audits/autowriter/ledger.json'];
  const result = await commitAndPush(request(world.repo, { paths }));

  assert.equal(result.committed, true);
  assert.equal(
    git(world.remote, 'show', '--name-only', '--format=', result.commit).split('\n').sort().join('|'),
    [...paths].sort().join('|')
  );
});

const RECORD = 'audits/autowriter/generations/model-registry.json';
const OTHER_RECORD = 'audits/autowriter/generations/another-entry.json';
const RECORD_TEXT = '{"slug":"model-registry"}\n';

function worldWithRecord() {
  const world = makeWorld();
  put(world.repo, RECORD, RECORD_TEXT);
  put(world.repo, 'content/a.txt', 'alpha\n');
  git(world.repo, 'add', '--all');
  git(world.repo, ...SEED, 'commit', '--message', 'seed a record');
  git(world.repo, 'push', 'origin', 'main');
  return world;
}

function assertNothingMoved(world, head) {
  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(git(world.repo, 'rev-parse', 'HEAD'), head);
  assert.equal(world.remoteHead(), head);
}

test('a listed generation record that was deleted is refused and the deletion stays in the working tree', async () => {
  const world = worldWithRecord();
  const head = git(world.repo, 'rev-parse', 'HEAD');
  rmSync(join(world.repo, RECORD));

  await assert.rejects(
    commitAndPush(request(world.repo, { paths: [RECORD] })),
    refusedWith(RECORD, 'generation-record-removed: ' + removalRefusalFor(RECORD).why)
  );

  assertNothingMoved(world, head);
  assert.equal(existsSync(join(world.repo, RECORD)), false);
  assert.equal(git(world.repo, 'status', '--porcelain'), 'D ' + RECORD);
});

test('a deleted record listed with an ordinary new file refuses the whole commit', async () => {
  const world = worldWithRecord();
  const head = git(world.repo, 'rev-parse', 'HEAD');
  rmSync(join(world.repo, RECORD));
  put(world.repo, 'content/b.txt', 'beta\n');

  await assert.rejects(
    commitAndPush(request(world.repo, { paths: ['content/b.txt', RECORD] })),
    refusedWith(RECORD, 'generation-record-removed')
  );

  assertNothingMoved(world, head);
  assert.equal(readFileSync(join(world.repo, 'content/b.txt'), 'utf8'), 'beta\n');
  assert.equal(git(world.remote, 'ls-tree', '-r', '--name-only', 'main').includes('content/b.txt'), false);
});

test('a modified record and a newly added record are committed and pushed', async () => {
  const world = worldWithRecord();
  put(world.repo, RECORD, '{"slug":"model-registry","changed":true}\n');
  put(world.repo, OTHER_RECORD, '{"slug":"another-entry"}\n');

  const result = await commitAndPush(request(world.repo, { paths: [RECORD, OTHER_RECORD] }));

  assert.equal(result.committed, true);
  assert.equal(world.remoteHead(), result.commit);
  assert.equal(
    git(world.remote, 'show', '--name-status', '--format=', result.commit).split('\n').sort().join('|'),
    ['A\t' + OTHER_RECORD, 'M\t' + RECORD].sort().join('|')
  );
});

const RENAMES = [
  ['to a name in the same directory', 'audits/autowriter/generations/renamed.json'],
  ['out of the directory', 'audits/autowriter/moved-model-registry.json'],
];

for (const [name, target] of RENAMES) {
  test('a record renamed ' + name + ' is refused as a removal when both paths are listed', async () => {
    const world = worldWithRecord();
    const head = git(world.repo, 'rev-parse', 'HEAD');
    renameSync(join(world.repo, RECORD), join(world.repo, target));

    await assert.rejects(
      commitAndPush(request(world.repo, { paths: [RECORD, target] })),
      refusedWith(RECORD, 'generation-record-removed')
    );

    assertNothingMoved(world, head);
    assert.equal(readFileSync(join(world.repo, target), 'utf8'), RECORD_TEXT);
    assert.equal(existsSync(join(world.repo, RECORD)), false);
  });

  test(
    'a record renamed ' + name + ' with only the new path listed commits the addition and leaves the old record',
    async () => {
      const world = worldWithRecord();
      renameSync(join(world.repo, RECORD), join(world.repo, target));

      const result = await commitAndPush(request(world.repo, { paths: [target] }));

      assert.equal(git(world.remote, 'show', '--name-status', '--format=', result.commit), 'A\t' + target);
      assert.equal(git(world.remote, 'show', result.commit + ':' + RECORD) + '\n', RECORD_TEXT);
      assert.equal(git(world.repo, 'status', '--porcelain'), 'D ' + RECORD);
    }
  );
}

test('a deleted path that is not a record is committed as a removal', async () => {
  const world = worldWithRecord();
  rmSync(join(world.repo, 'content/a.txt'));

  const result = await commitAndPush(request(world.repo, { paths: ['content/a.txt'] }));

  assert.equal(result.committed, true);
  assert.equal(world.remoteHead(), result.commit);
  assert.equal(git(world.remote, 'show', '--name-status', '--format=', result.commit), 'D\tcontent/a.txt');
});

test('the CLI exits 1 and prints the refusal for a deleted generation record', async () => {
  const world = worldWithRecord();
  const head = git(world.repo, 'rev-parse', 'HEAD');
  rmSync(join(world.repo, RECORD));
  const lines = [];

  const code = await runCli(['--message', 'x', '--path', RECORD], {
    repoRoot: world.repo,
    err: (text) => lines.push(text),
  });

  assert.equal(code, 1);
  assert.ok(
    lines.join('\n').includes(RECORD + ': generation-record-removed: ' + removalRefusalFor(RECORD).why),
    lines.join('\n')
  );
  assertNothingMoved(world, head);
});
