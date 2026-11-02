import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { DISPOSITION_DIRECTORY, GENERATED_STATUS } from './route-derive.mjs';
import { digestOf, LIST_STALE, restateStale } from './route-steps.mjs';
import { fileTransaction } from './route-transaction.mjs';
import { WriterError } from './writer-error.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const REASON = 'Restated for the text the run wrote. No human has read it.';
const A = `${DISPOSITION_DIRECTORY}/a.json`;
const B = `${DISPOSITION_DIRECTORY}/b.json`;
const row = (target, digest) => ({ target, status: 'verified', reason: 'Read by the owner.', digest });
const FILES = {
  'a.json': [row('/blog', 'aaaaaaaaaaaa'), row('/glossary', 'bbbbbbbbbbbb')],
  'b.json': [row('/blog/x', 'cccccccccccc')],
};
const STALE = [
  { file: 'a.json', index: 1, target: '/glossary', digest: '111111111111' },
  { file: 'b.json', index: 0, target: '/blog/x', digest: '222222222222' },
];
const layout = (entries) => `${JSON.stringify(entries, null, 2)}\n`;
const restated = (entry, digest) => ({ ...entry, status: GENERATED_STATUS, reason: REASON, digest });

function scene(list = STALE) {
  const root = mkdtempSync(join(tmpdir(), 'route-steps-'));
  roots.push(root);
  mkdirSync(join(root, DISPOSITION_DIRECTORY), { recursive: true });
  for (const [name, entries] of Object.entries(FILES))
    writeFileSync(join(root, DISPOSITION_DIRECTORY, name), layout(entries));
  const commands = [];
  const succeed = async (command) => {
    commands.push(command);
    return { status: 0, stdout: JSON.stringify(list), stderr: '' };
  };
  const transaction = fileTransaction(root);
  const restate = (extra = {}) => restateStale({ repoRoot: root, transaction, succeed, reason: REASON, ...extra });
  return { root, commands, transaction, restate, read: (path) => readFileSync(join(root, path), 'utf8') };
}

test('it asks for the stale list once and restates every file the list names with the reason it was given', async () => {
  const { commands, restate, read } = scene();

  assert.deepEqual(await restate(), [A, B]);
  assert.deepEqual(commands, [LIST_STALE]);
  assert.equal(read(A), layout([FILES['a.json'][0], restated(FILES['a.json'][1], '111111111111')]));
  assert.equal(read(B), layout([restated(FILES['b.json'][0], '222222222222')]));
});

test('a file the caller says the run wrote is refused when the list names it, and the transaction takes back what was restated before', async () => {
  const { restate, transaction, read } = scene();

  await assert.rejects(
    restate({ mayNotBeStale: [B] }),
    (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes(B)
  );
  transaction.restore();
  assert.equal(read(A), layout(FILES['a.json']));
  assert.equal(read(B), layout(FILES['b.json']));
});

test('a file that nothing forbids is restated whether or not the run wrote it, which is how a repair restates its own entry', async () => {
  const { restate, read } = scene();

  assert.deepEqual(await restate({ mayNotBeStale: [] }), [A, B]);
  assert.equal(JSON.parse(read(B))[0].reason, REASON);
});

test('a list that names nothing restates nothing and leaves every file as it was', async () => {
  const { restate, read } = scene([]);

  assert.deepEqual(await restate(), []);
  assert.equal(read(A), layout(FILES['a.json']));
  assert.equal(read(B), layout(FILES['b.json']));
});

const printing =
  (stdout, calls = []) =>
  async (command) => {
    calls.push(command);
    return { status: 0, stdout, stderr: '' };
  };

test('the digest of a built target is asked of the digest script from site/ and comes back without its newline', async () => {
  const calls = [];

  assert.equal(await digestOf(printing('0123456789ab\n', calls), '/blog/x'), '0123456789ab');
  assert.deepEqual(calls, [['node', 'scripts/disposition-digest.mjs', '.', 'dist', '/blog/x']]);
});

for (const printed of [
  '',
  'not a digest',
  '0123456789a',
  '0123456789abc',
  '0123456789AB',
  '0123456789ab\n0123456789ab',
])
  test(`${JSON.stringify(printed)} is not twelve hex digits, so no digest is taken from it`, async () => {
    await assert.rejects(
      digestOf(printing(printed), '/blog/x'),
      (error) =>
        error instanceof WriterError &&
        error.kind === 'build' &&
        error.message.includes('scripts/disposition-digest.mjs printed') &&
        error.message.includes('for /blog/x, not twelve hex digits')
    );
  });

test('what the digest script printed is quoted in the refusal, cut to sixty characters', async () => {
  const printed = 'x'.repeat(100);

  await assert.rejects(digestOf(printing(printed), '/blog/x'), (error) => {
    assert.ok(error.message.includes(`"${'x'.repeat(60)}"`));
    assert.ok(!error.message.includes('x'.repeat(61)));
    return true;
  });
});
