import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseArguments, runCli } from './catch-up-entry.mjs';
import { OUTCOMES } from './repair-outcome.mjs';

const HEAD = 'a'.repeat(40);
const MERGED = 'b'.repeat(40);

async function run(argv, result) {
  const out = [];
  const err = [];
  const seen = [];
  const catchUpOn = async (options) => {
    seen.push(options);
    if (result instanceof Error) throw result;
    return result;
  };
  const status = await runCli(argv, {
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    catchUpOn,
    repoRoot: '/repository',
    run: () => ({ status: 0, stdout: '', stderr: '' }),
  });
  return { status, out, err, seen, last: out.length === 0 ? null : JSON.parse(out.at(-1)) };
}

test('the command takes the head the watcher judged and, by default, origin/main as the base', () => {
  assert.deepEqual(parseArguments(['--head', HEAD]), { head: HEAD, base: 'origin/main' });
  assert.deepEqual(parseArguments(['--head', HEAD, '--base', 'origin/release']), {
    head: HEAD,
    base: 'origin/release',
  });
});

test('a head that is not a whole commit hash is a usage error, and so is an unknown flag', async () => {
  assert.throws(() => parseArguments(['--head', 'main']), /--head needs a 40 character commit hash/);
  assert.throws(() => parseArguments(['--head', HEAD, '--force', 'yes']), /unexpected argument --force/);
  assert.equal((await run(['--head', 'main'])).status, 2);
});

test('a catch-up that merged prints the repaired outcome and the new commit on its last line, and exits 0', async () => {
  const { status, last, seen } = await run(['--head', HEAD], { outcome: 'caught-up', commit: MERGED, paths: [] });

  assert.equal(status, 0);
  assert.equal(last.outcome, 'repaired');
  assert.equal(last.commit, MERGED);
  assert.deepEqual(seen, [{ repoRoot: '/repository', head: HEAD, base: 'origin/main', run: seen[0].run }]);
});

test('a branch that already holds main is stale, so the watcher judges it again and pushes nothing', async () => {
  const { status, last } = await run(['--head', HEAD], { outcome: 'current' });

  assert.equal(status, 1);
  assert.equal(last.outcome, 'stale');
  assert.equal(last.commit, undefined);
});

test('every way the catch-up can stop maps to an outcome the watcher already reads', async () => {
  const stops = {
    conflict: 'conflict',
    'lost-rows': 'unconverged',
    'out-of-scope': 'unconverged',
    unconverged: 'unconverged',
  };
  for (const [stopped, outcome] of Object.entries(stops)) {
    const { status, last } = await run(['--head', HEAD], { outcome: stopped, paths: ['docs/SEMANTIC-CORE.md'] });
    assert.equal(status, 1, stopped);
    assert.equal(last.outcome, outcome, stopped);
    assert.ok(OUTCOMES.includes(last.outcome));
    assert.deepEqual(last.paths, ['docs/SEMANTIC-CORE.md']);
  }
});

test('an error is the failed outcome on one line, so the workflow can read it with jq', async () => {
  const { status, last, out, err } = await run(
    ['--head', HEAD],
    new Error('npm run build exited with status 1:\nboom')
  );

  assert.equal(status, 1);
  assert.equal(last.outcome, 'failed');
  assert.equal(out.at(-1).includes('\n'), false);
  assert.match(err.join(' '), /npm run build exited with status 1/);
});
