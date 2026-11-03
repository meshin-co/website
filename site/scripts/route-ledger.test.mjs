import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';

import { regenerateRouteLedger, ROUTE_LEDGER, WRITE_ROUTE_LEDGER } from './route-ledger.mjs';
import { WriterError } from './writer-error.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const textOf = (routes) => `${JSON.stringify(routes, null, 2)}\n`;
function repoWith(routes) {
  const root = mkdtempSync(join(tmpdir(), 'route-ledger-'));
  roots.push(root);
  if (routes !== undefined) {
    mkdirSync(dirname(join(root, ROUTE_LEDGER)), { recursive: true });
    writeFileSync(join(root, ROUTE_LEDGER), textOf(routes));
  }
  return root;
}
const stage = (root, built) => {
  const tracked = [];
  const commands = [];
  return {
    tracked,
    commands,
    input: {
      repoRoot: root,
      transaction: { track: (path) => tracked.push(path) },
      succeed: async (command) => {
        commands.push(command);
        writeFileSync(join(root, ROUTE_LEDGER), textOf(built));
      },
    },
  };
};

test('the ledger is written by the npm script a person runs, with the file tracked first so a restore can undo it', async () => {
  const root = repoWith(['/']);
  const { input, tracked, commands } = stage(root, ['/', '/a']);

  await regenerateRouteLedger(input);

  assert.deepEqual(commands, [WRITE_ROUTE_LEDGER]);
  assert.deepEqual(WRITE_ROUTE_LEDGER, ['npm', 'run', 'assets:routes']);
  assert.deepEqual(tracked, [ROUTE_LEDGER]);
});

test('an added route is carried, an unchanged ledger is not, and the answer names the file', async () => {
  const added = await regenerateRouteLedger(stage(repoWith(['/']), ['/', '/a']).input);
  const same = await regenerateRouteLedger(stage(repoWith(['/', '/a']), ['/', '/a']).input);

  assert.deepEqual(added, { path: ROUTE_LEDGER, changed: true });
  assert.deepEqual(same, { path: ROUTE_LEDGER, changed: false });
});

test('a dropped route is refused naming every route, and the file the build wrote is left for the transaction to undo', async () => {
  const root = repoWith(['/', '/a', '/b']);

  await assert.rejects(regenerateRouteLedger(stage(root, ['/']).input), (error) => {
    assert.ok(error instanceof WriterError && error.kind === 'build');
    assert.match(error.message, /drops \/a, \/b from audits\/routes\.json/);
    return true;
  });
  assert.equal(readFileSync(join(root, ROUTE_LEDGER), 'utf8'), textOf(['/']));
});

test('a repository with no ledger is refused, because no route can be compared', async () => {
  await assert.rejects(
    regenerateRouteLedger(stage(repoWith(undefined), ['/']).input),
    (error) =>
      error instanceof WriterError && error.message === `${ROUTE_LEDGER} does not exist, so no route can be compared`
  );
});

test('a ledger that is not JSON or not a list of strings is refused naming the file', async () => {
  for (const text of ['{', '{"routes":[]}', '[1]']) {
    const root = repoWith(['/']);
    writeFileSync(join(root, ROUTE_LEDGER), text);
    await assert.rejects(
      regenerateRouteLedger(stage(root, ['/']).input),
      (error) => error instanceof WriterError && error.message.startsWith(ROUTE_LEDGER),
      text
    );
  }
});
