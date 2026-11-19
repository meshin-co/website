import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runCli } from './commit-state.mjs';
import { git, makeWorld, put } from './fixtures/state-world.mjs';
import { BOT_EMAIL, BOT_NAME } from './pr-classify.mjs';
import { STATE_BRANCH } from './record-layout.mjs';

const ARGUMENTS = [
  '--message',
  'Refresh report',
  '--path',
  'state/spend-report.md',
  '--path',
  'state/ledger/2026/11/x.json',
];
const refuse = async () => assert.fail('commit must not run');

async function cli(argv, options = {}) {
  const lines = { out: [], err: [] };
  const sinks = { out: (text) => lines.out.push(text), err: (text) => lines.err.push(text) };
  const code = await runCli(argv, { repoRoot: '/repo', commit: refuse, ...sinks, ...options });
  return { code, out: lines.out, err: lines.err.join('\n') };
}

test('the CLI exits 2 and names the flag when --message or --path is missing, unknown, repeated or valueless', async () => {
  for (const [argv, flag] of [
    [['--path', 'state/a.json'], '--message'],
    [['--message', 'x'], '--path'],
    [[...ARGUMENTS, '--force'], '--force'],
    [['--message'], '--message'],
    [[...ARGUMENTS, '--message', 'again'], '--message'],
    [[...ARGUMENTS, '--ref', STATE_BRANCH, '--ref', STATE_BRANCH], '--ref'],
    [[...ARGUMENTS, '--path', '--message', 'x'], '--path'],
  ]) {
    const result = await cli(argv);
    assert.equal(result.code, 2, argv.join(' '));
    assert.match(result.err, new RegExp(flag));
    assert.match(result.err, /Usage: node scripts\/commit-state\.mjs/);
  }
});

test('the CLI prints the sha on success and passes the bot identity, the paths and the state branch', async () => {
  const seen = [];
  const commit = async (options) => {
    seen.push(options);
    return { committed: true, commit: 'b'.repeat(40) };
  };
  const result = await cli(ARGUMENTS, { commit });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, ['committed ' + 'b'.repeat(40)]);
  assert.deepEqual(seen, [
    {
      repoRoot: '/repo',
      paths: ['state/spend-report.md', 'state/ledger/2026/11/x.json'],
      message: 'Refresh report',
      identity: { name: BOT_NAME, email: BOT_EMAIL },
      ref: STATE_BRANCH,
    },
  ]);
});

test('the CLI prints nothing to commit and exits 0 when there is no change', async () => {
  const result = await cli(ARGUMENTS, { commit: async () => ({ committed: false, commit: null }) });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, ['nothing to commit']);
});

test('the CLI exits 1 and prints the message when the commit fails', async () => {
  const commit = async () => {
    throw new Error('push to origin autowriter-state was rejected 3 times; nothing was forced');
  };
  const result = await cli(ARGUMENTS, { commit });
  assert.equal(result.code, 1);
  assert.match(result.err, /rejected 3 times/);
});

test('the CLI never prints a credential that a failure carries', async () => {
  const commit = async () => {
    throw new Error('fatal: unable to access https://bot:hunter2@github.com/o/r.git/: 403');
  };
  const result = await cli(ARGUMENTS, { commit });
  assert.equal(result.code, 1);
  assert.equal(result.err.includes('hunter2'), false);
});

for (const ref of ['main', 'master', 'refs/heads/main', 'release']) {
  test(`the CLI refuses --ref ${ref} with exit 1 and never runs git`, async () => {
    const result = await cli([...ARGUMENTS, '--ref', ref], { commit: undefined });
    assert.equal(result.code, 1);
    assert.match(result.err, /commit-state writes only to autowriter-state/);
    assert.deepEqual(result.out, []);
  });
}

test('the CLI refuses a path outside state with exit 1 and names the rule', async () => {
  const result = await cli(['--message', 'x', '--path', 'audits/spend-report.md'], { commit: undefined });
  assert.equal(result.code, 1);
  assert.match(result.err, /refused "audits\/spend-report\.md": commit-state commits only paths under state\//);
});

test('the CLI commits for real into the state checkout and pushes with the bot identity', async () => {
  const world = makeWorld();
  const main = world.remoteHead('main');
  put(world.repo, 'state/spend-report.md', 'report\n');
  const result = await cli(['--message', 'Refresh report', '--path', 'state/spend-report.md'], {
    repoRoot: world.repo,
    commit: undefined,
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.out, ['committed ' + world.remoteHead()]);
  assert.equal(
    git(world.remote, 'log', '-1', '--format=%ae|%ce', `refs/heads/${STATE_BRANCH}`),
    `${BOT_EMAIL}|${BOT_EMAIL}`
  );
  assert.equal(world.remoteHead('main'), main);
});

test('the CLI creates the state branch on the first run', async () => {
  const world = makeWorld({ branch: false, state: 'fresh' });
  put(world.repo, 'state/spend-report.md', 'report\n');
  const result = await cli(['--message', 'Refresh report', '--path', 'state/spend-report.md'], {
    repoRoot: world.repo,
    commit: undefined,
  });
  assert.equal(result.code, 0);
  assert.deepEqual(world.remoteFiles(), ['spend-report.md']);
});
