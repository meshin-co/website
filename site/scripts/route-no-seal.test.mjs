import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const MODULES = [
  'entry-files.mjs',
  'route-derive.mjs',
  'route-assembly.mjs',
  'route-steps.mjs',
  'repair-assembly.mjs',
  'entry-commit.mjs',
  'disposition-digest.mjs',
  'route-transaction.mjs',
  'disposition-restate.mjs',
  'stale-dispositions.mjs',
];

const sourceOf = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('no route module names the seal, the sealing function or the seal flag, so none can reach it', () => {
  for (const file of MODULES) assert.doesNotMatch(sourceOf(file), /seal/i, file);
});

test('the only thing a route module takes from the editorial gate is the report builder', () => {
  const imports = MODULES.flatMap((file) =>
    [...sourceOf(file).matchAll(/import \{([^}]*)\} from '\.\/editorial-gate\.mjs'/g)].map(([, names]) => names.trim())
  );

  assert.ok(imports.length > 0);
  assert.ok(imports.every((names) => names === 'buildReport'));
});

test('no route module stages the whole tree or runs a command through a shell', () => {
  for (const file of MODULES) {
    const source = sourceOf(file);
    assert.doesNotMatch(source, /['"]-A['"]|--all|shell:\s*true|execSync|['"]add['"],\s*\[?['"]\.['"]/, file);
  }
});
