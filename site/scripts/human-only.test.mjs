import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

import {
  UNATTENDED_VARIABLE,
  UnattendedRefusal,
  exitWhenUnattended,
  isUnattended,
  markUnattended,
  refuseWhenUnattended,
} from './human-only.mjs';

test('the marker is the variable the workflows set', () => {
  assert.equal(UNATTENDED_VARIABLE, 'AUTOWRITER_UNATTENDED');
});

test('an unset variable is a person at a terminal', () => {
  assert.equal(isUnattended({}), false);
});

test('1 and true mark an unattended run', () => {
  assert.equal(isUnattended({ AUTOWRITER_UNATTENDED: '1' }), true);
  assert.equal(isUnattended({ AUTOWRITER_UNATTENDED: 'true' }), true);
});

test('every other value is not the marker, so a stray 0 or empty string never locks the owner out', () => {
  for (const value of ['', '0', 'false', 'yes', ' 1', 'TRUE', 'on'])
    assert.equal(isUnattended({ AUTOWRITER_UNATTENDED: value }), false, JSON.stringify(value));
});

test('with no argument the process environment decides', () => {
  const before = process.env.AUTOWRITER_UNATTENDED;
  try {
    process.env.AUTOWRITER_UNATTENDED = '1';
    assert.equal(isUnattended(), true);
    delete process.env.AUTOWRITER_UNATTENDED;
    assert.equal(isUnattended(), false);
  } finally {
    if (before === undefined) delete process.env.AUTOWRITER_UNATTENDED;
    else process.env.AUTOWRITER_UNATTENDED = before;
  }
});

test('an unattended run is refused with the action named and the marker named', () => {
  assert.throws(
    () => refuseWhenUnattended('re-seal the dispositions', { AUTOWRITER_UNATTENDED: '1' }),
    (error) => {
      assert.ok(error instanceof UnattendedRefusal);
      assert.equal(error.name, 'UnattendedRefusal');
      assert.equal(
        error.message,
        'refusing to re-seal the dispositions in an unattended run: a person at a terminal does this; AUTOWRITER_UNATTENDED is set'
      );
      return true;
    }
  );
});

test('an attended run passes the guard and gets nothing back', () => {
  assert.equal(refuseWhenUnattended('re-seal the dispositions', {}), undefined);
});

test('markUnattended sets the variable on the environment it is given', () => {
  const env = {};
  markUnattended(env);
  assert.equal(env.AUTOWRITER_UNATTENDED, '1');
  assert.equal(isUnattended(env), true);
});

test('markUnattended with no argument reaches a child process', () => {
  const marked = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { markUnattended } from './human-only.mjs'; import { spawnSync } from 'node:child_process'; markUnattended(); const child = spawnSync(process.execPath, ['-p', 'process.env.AUTOWRITER_UNATTENDED'], { encoding: 'utf8' }); process.stdout.write(child.stdout.trim());",
    ],
    { cwd: import.meta.dirname, encoding: 'utf8', env: { PATH: process.env.PATH } }
  );
  assert.equal(marked.stdout, '1', marked.stderr);
});

test('a command line that is refused prints the message alone and exits 1, with no stack', () => {
  const refused = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { exitWhenUnattended } from './human-only.mjs'; exitWhenUnattended('do the thing'); console.log('went on');",
    ],
    { cwd: import.meta.dirname, encoding: 'utf8', env: { PATH: process.env.PATH, AUTOWRITER_UNATTENDED: 'true' } }
  );
  assert.equal(refused.status, 1);
  assert.equal(refused.stdout, '');
  assert.equal(
    refused.stderr,
    'refusing to do the thing in an unattended run: a person at a terminal does this; AUTOWRITER_UNATTENDED is set\n'
  );
});

test('a command line that is attended goes on', () => {
  assert.equal(exitWhenUnattended('do the thing', {}), undefined);
});
