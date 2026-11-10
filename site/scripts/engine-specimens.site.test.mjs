import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const REAL_ROOT = join(import.meta.dirname, '..', '..');

const run = async (command, args, cwd) => {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
};

test('the real tree is green when the check runs from the repository root', async () => {
  const result = await run('node', ['site/scripts/check-engine.mjs'], REAL_ROOT);

  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /^engine: 0 findings/m);
});
