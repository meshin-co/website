import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ORIGINS } from './autowriter-claims.mjs';
import { run } from './measure-origins.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..', '..');

function measure(root) {
  const out = [];
  const err = [];
  const code = run({ repoRoot: root, out: (line) => out.push(line), err: (line) => err.push(line) });
  return { code, out, err };
}

const cellsOf = (line) => line.trim().split(/\s{2,}/);
const rowOf = (lines, first) => cellsOf(lines.find((line) => line.startsWith(first + '  ')));

test('over the committed tree it exits 0 and every entry is counted under exactly one known origin', () => {
  const { code, out, err } = measure(REAL_ROOT);
  assert.deepEqual(err, []);
  assert.equal(code, 0);
  const total = Number(out[0].split(' ')[0]);
  assert.ok(total >= 2, out[0]);
  const counted = ORIGINS.map((origin) => Number(rowOf(out, origin)[1]));
  assert.equal(
    counted.reduce((sum, count) => sum + count, 0),
    total,
    out.join('\n')
  );
  assert.equal(Number(rowOf(out, 'all')[1]), total);
});
