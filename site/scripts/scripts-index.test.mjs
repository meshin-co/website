import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const index = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
const listed = new Set([...index.matchAll(/^\| `([a-z0-9-]+\.(?:mjs|cjs))`/gm)].map(([, file]) => file));
const present = readdirSync(new URL('.', import.meta.url))
  .filter((file) => /\.(mjs|cjs)$/.test(file))
  .filter((file) => !file.endsWith('.test.mjs'));

test('every script in the directory has a row in the index, so the map cannot rot', () => {
  const missing = present.filter((file) => !listed.has(file));
  assert.deepEqual(missing, [], `not in scripts/README.md: ${missing.join(', ')}`);
});

test('every row in the index names a script that exists', () => {
  const dead = [...listed].filter((file) => !present.includes(file));
  assert.deepEqual(dead, [], `listed but absent: ${dead.join(', ')}`);
});

test('every script is classified under exactly one role heading', () => {
  const roles = [...index.matchAll(/^## (.+)$/gm)].map(([, role]) => role);
  assert.ok(roles.length >= 4, 'the index must group scripts by role');
  const rows = [...index.matchAll(/^\| `([a-z0-9-]+\.(?:mjs|cjs))`/gm)].map(([, file]) => file);
  assert.equal(new Set(rows).size, rows.length, 'a script appears under two roles');
});
