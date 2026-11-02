import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { fileTransaction, outputHead, outputTail, plainOutput } from './route-transaction.mjs';

const roots = [];
const scratch = () => {
  const root = mkdtempSync(join(tmpdir(), 'route-transaction-'));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const BINARY = Buffer.from([0xff, 0xfe, 0x00, 0x41, 0x80, 0x0a]);

test('a file the transaction wrote is gone again after the restore, and so are the directories it had to create', () => {
  const root = scratch();
  mkdirSync(join(root, 'audits'));
  const transaction = fileTransaction(root);

  transaction.write('audits/autowriter/generations/model-registry.json', '{}\n');
  assert.equal(readFileSync(join(root, 'audits/autowriter/generations/model-registry.json'), 'utf8'), '{}\n');

  transaction.restore();
  assert.equal(existsSync(join(root, 'audits/autowriter')), false);
  assert.equal(existsSync(join(root, 'audits')), true);
});

test('a file that existed comes back byte for byte, even when it is not text', () => {
  const root = scratch();
  writeFileSync(join(root, 'blob.bin'), BINARY);
  const transaction = fileTransaction(root);

  transaction.write('blob.bin', 'replaced');
  transaction.restore();

  assert.deepEqual(readFileSync(join(root, 'blob.bin')), BINARY);
});

test('a tracked file that something else changed is put back to what it held when it was first tracked', () => {
  const root = scratch();
  writeFileSync(join(root, 'docs.md'), 'before\n');
  const transaction = fileTransaction(root);

  transaction.track('docs.md');
  writeFileSync(join(root, 'docs.md'), 'changed by a command\n');
  transaction.write('docs.md', 'written by the route\n');
  transaction.restore();

  assert.equal(readFileSync(join(root, 'docs.md'), 'utf8'), 'before\n');
});

test('a tracked path that did not exist is removed when a command created it', () => {
  const root = scratch();
  const transaction = fileTransaction(root);

  transaction.track('made-later.json');
  writeFileSync(join(root, 'made-later.json'), '[]');
  transaction.restore();

  assert.equal(existsSync(join(root, 'made-later.json')), false);
});

test('restoring twice changes nothing the second time', () => {
  const root = scratch();
  writeFileSync(join(root, 'kept.txt'), 'kept\n');
  const transaction = fileTransaction(root);

  transaction.write('kept.txt', 'x');
  transaction.write('new/new.txt', 'y');
  transaction.restore();
  transaction.restore();

  assert.equal(readFileSync(join(root, 'kept.txt'), 'utf8'), 'kept\n');
  assert.equal(existsSync(join(root, 'new')), false);
});

test('a path nobody tracked is left alone by the restore', () => {
  const root = scratch();
  writeFileSync(join(root, 'other.txt'), 'other\n');
  const transaction = fileTransaction(root);

  transaction.write('mine.txt', 'mine');
  writeFileSync(join(root, 'other.txt'), 'edited elsewhere\n');
  transaction.restore();

  assert.equal(readFileSync(join(root, 'other.txt'), 'utf8'), 'edited elsewhere\n');
});

const numbered = (count) => Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n');

test('the tail of a failed command is its last 20 lines, the output stream before the error stream', () => {
  const tail = outputTail({ stdout: numbered(25), stderr: 'error one\nerror two\n' });
  const lines = tail.split('\n');

  assert.equal(lines.length, 20);
  assert.equal(lines.at(-1), 'error two');
  assert.equal(lines.at(-3), 'line 25');
  assert.ok(!tail.includes('line 5\n'));
});

test('a short output is returned whole, and colour codes are removed from it', () => {
  const tail = outputTail({ stdout: '\u001b[31mfailed\u001b[39m step one\n', stderr: '' });

  assert.equal(tail, 'failed step one');
});

test('a command that printed nothing has an empty tail', () => {
  assert.equal(outputTail({ stdout: '', stderr: '' }), '');
  assert.equal(outputTail({}), '');
});

test('the whole output is returned with colour codes removed, where the tail keeps twenty lines of it', () => {
  const stdout = Array.from({ length: 30 }, (_, index) => `\u001b[31mline ${index + 1}\u001b[0m`).join('\n');

  const whole = plainOutput({ stdout, stderr: 'the end' });

  assert.ok(whole.startsWith('line 1\n'));
  assert.ok(whole.endsWith('the end'));
  assert.ok(!whole.includes('\u001b'));
  assert.equal(outputTail({ stdout, stderr: 'the end' }).split('\n').length, 20);
});

test('the head is the first fifteen lines of the output with colour codes removed', () => {
  const stdout = Array.from({ length: 30 }, (_, index) => `\u001b[31mline ${index + 1}\u001b[0m`).join('\n');
  const lines = outputHead({ stdout, stderr: 'the end' }).split('\n');

  assert.equal(lines.length, 15);
  assert.equal(lines[0], 'line 1');
  assert.equal(lines[14], 'line 15');
  assert.equal(outputHead({ stdout: 'short', stderr: '' }), 'short');
});
