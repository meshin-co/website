import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const COMMAND = fileURLToPath(new URL('./fetch-keyword-demand.mjs', import.meta.url));
const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const SPECIFIERS = [
  /(?:^|\n)\s*(?:import|export)\s[^;'"`]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function reachableFrom(entry) {
  const files = new Set();
  const packages = new Set();
  const visit = (file) => {
    if (files.has(file)) return;
    files.add(file);
    const text = readFileSync(file, 'utf8');
    for (const pattern of SPECIFIERS) {
      for (const [, specifier] of text.matchAll(pattern)) {
        if (specifier.startsWith('node:')) continue;
        if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier));
        else packages.add(specifier);
      }
    }
  };
  visit(entry);
  return { files: [...files].map((file) => basename(file)), packages: [...packages].sort() };
}

const plants = [];
after(() => plants.forEach((plant) => rmSync(plant, { recursive: true, force: true })));

function plantGraph(files) {
  const dir = mkdtempSync(join(tmpdir(), 'import-graph-'));
  plants.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return join(dir, 'entry.mjs');
}

test('the command reaches no npm package, so the workflow can run it before npm ci installs any', () => {
  const { files, packages } = reachableFrom(COMMAND);

  assert.deepEqual(packages, []);
  for (const name of [
    'audit-command.mjs',
    'brand.mjs',
    'engine-config.mjs',
    'evidence-gate.mjs',
    'keyword-demand-cache.mjs',
    'keyword-demand-render.mjs',
    'keyword-demand-rows.mjs',
    'keyword-demand.mjs',
    'keyword-report.mjs',
    'report.mjs',
    'topic-owners.mjs',
  ]) {
    assert.ok(files.includes(name), `${name} is in the graph the check walked`);
  }
});

test('the walk names a package whether it is imported plainly, over several lines, re-exported, bare, dynamically or required', () => {
  const entry = plantGraph({
    'entry.mjs': "import { leaf } from './leaf.mjs';\nimport './shared.cjs';\n",
    'leaf.mjs': [
      "import plain from 'plain-package';",
      'import {',
      '  second,',
      "} from 'multi-line-package';",
      "export { third } from 're-export-package';",
      "export * from 'star-package';",
      "import 'side-effect-package';",
      "const fourth = await import('dynamic-package');",
      "import { fine } from 'node:fs';",
      '',
    ].join('\n'),
    'shared.cjs': "const { join } = require('node:path');\nconst fifth = require('required-package');\n",
  });

  assert.deepEqual(reachableFrom(entry).packages, [
    'dynamic-package',
    'multi-line-package',
    'plain-package',
    're-export-package',
    'required-package',
    'side-effect-package',
    'star-package',
  ]);
});

test('the walk follows a relative import into the file it names and counts a word list that holds "from" as no import', () => {
  const entry = plantGraph({
    'entry.mjs': "import { words } from './nested/words.mjs';\n",
    'nested/words.mjs': "export const words = [\n  'for',\n  'from',\n  'how',\n];\nimport deep from '../deep.mjs';\n",
    'deep.mjs': "import hidden from 'hidden-package';\n",
  });
  const { files, packages } = reachableFrom(entry);

  assert.deepEqual(files, ['entry.mjs', 'words.mjs', 'deep.mjs']);
  assert.deepEqual(packages, ['hidden-package']);
});

test('npm run audit:keywords reads site/.env when it exists, as audit:demand does, and gate:keywords checks the repository root', () => {
  assert.equal(scripts['audit:keywords'], 'node --env-file-if-exists=.env scripts/fetch-keyword-demand.mjs');
  assert.equal(scripts['gate:keywords'], 'node scripts/keyword-demand-gate.mjs ..');
});
