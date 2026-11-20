import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { refusalFor } from './autowriter-refusals.mjs';
import { commitToBranch } from './commit-branch.mjs';
import { restatedReason } from './disposition-restate.mjs';
import {
  BAND,
  CLAIMED_AT,
  LEDGER,
  ROUTES,
  ROWS,
  asFile,
  git,
  makeWorld,
  put,
  refusedWith,
  removeWorlds,
  request,
  silent,
} from './fixtures/commit-branch-world.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

const STATE_LEDGER = 'state/ledger/2026/11/model-registry.json';
const GENERATED = recordPath('disposition', 'model-registry', CLAIMED_AT);
const PLACEMENTS = [ROUTES, GENERATED, `${recordDirectory('disposition')}/2026/11/extra/generated-model-registry.json`];

after(removeWorlds);

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
      commitToBranch(request('/repo', { paths: ['content/a.txt', path], run: fake.run })),
      refusedWith(id + ': ' + refusalFor(path).why)
    );
    assert.equal(fake.calls.length, 0);
  });
}

test('a file of the state is refused by name, because only commit-state.mjs writes the state', async () => {
  const fake = silent();

  await assert.rejects(
    commitToBranch(request('/repo', { paths: ['content/a.txt', STATE_LEDGER], run: fake.run })),
    refusedWith('state-record: ', STATE_LEDGER)
  );
  assert.equal(fake.calls.length, 0);
});

test('a modified refused file that nobody listed stays out of the commit and stays modified', async () => {
  const world = makeWorld();
  put(world.repo, BAND, '{"low":2}\n');
  put(world.repo, 'content/a.txt', 'alpha\n');

  const result = await commitToBranch(request(world.repo));

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
      commitToBranch(request(world.repo, { paths })),
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

  await assert.rejects(
    commitToBranch(request(world.repo, { paths: ['audits'] })),
    refusedWith(BAND, 'sentence-band: ')
  );
  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
});

test('the refusal says so when the paths could not be unstaged', async () => {
  const run = (args) => {
    if (args[0] === 'diff') return { status: 0, stdout: BAND + '\n', stderr: '' };
    if (args[0] === 'reset') return { status: 1, stdout: '', stderr: 'fatal: index.lock exists' };
    return { status: 0, stdout: '', stderr: '' };
  };

  await assert.rejects(
    commitToBranch(request('/repo', { paths: ['audits'], run })),
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
    commitToBranch(request(world.repo, { paths: [ROUTES] })),
    refusedWith(ROUTES, 'disposition-seal:', 'entries: /, /blog head.title')
  );

  assert.equal(git(world.repo, 'diff', '--cached', '--name-only'), '');
  assert.equal(world.remoteHead(), head);
});

test('the seal is refused too when the whole dispositions directory is the path', async () => {
  const world = makeWorld();
  put(world.repo, ROUTES, asFile(moved(ROWS, [0], 'bbbbbbbbbbbb')));

  await assert.rejects(
    commitToBranch(request(world.repo, { paths: ['audits/phase-4.7/dispositions'] })),
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
      commitToBranch(request(world.repo, { paths: [recordDirectory('disposition')] })),
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
      commitToBranch(request(world.repo, { paths: [ROUTES] })),
      refusedWith(ROUTES, 'disposition-unreadable:')
    );
  }
});

test('a restate is committed and pushed: the digest, the status and the reason all move', async () => {
  const world = makeWorld();
  const text = asFile(moved(ROWS, [0, 1], 'bbbbbbbbbbbb').map((row) => ({ ...row, ...RESTATE })));
  put(world.repo, ROUTES, text);

  const result = await commitToBranch(request(world.repo, { paths: [ROUTES] }));

  assert.equal(result.committed, true);
  assert.equal(world.remoteHead(), result.commit);
  assert.equal(git(world.remote, 'show', result.commit + ':' + ROUTES) + '\n', text);
});

test('a new disposition file and a ledger are committed as before', async () => {
  const world = makeWorld();
  put(world.repo, GENERATED, '[]\n');
  put(world.repo, LEDGER, '{"attempts":2}\n');

  const paths = [GENERATED, LEDGER];
  const result = await commitToBranch(request(world.repo, { paths }));

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

    const result = await commitToBranch(request(world.repo, { paths: [path] }));

    assert.equal(result.committed, true);
    assert.equal(world.remoteHead(), result.commit);
    assert.equal(git(world.remote, 'show', result.commit + ':' + path) + '\n', text);
    committed += 1;
  }
  assert.equal(committed, 3);
});
