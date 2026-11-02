import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = resolve(import.meta.dirname, '..', '..', '..');

const IMPORT_SPECIFIER =
  /(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

export function importClosure(entries) {
  const seen = new Set();
  const queue = entries.map((entry) => resolve(REPOSITORY, entry));
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_SPECIFIER)) {
      queue.push(resolve(dirname(file), match[1] ?? match[2] ?? match[3]));
    }
  }
  return [...seen].map((file) => relative(REPOSITORY, file)).sort();
}

const schemaFiles = () =>
  readdirSync(join(REPOSITORY, 'site/scripts'))
    .filter((name) => name.endsWith('.schema.json'))
    .map((name) => `site/scripts/${name}`);

export const realEngineConfig = () => JSON.parse(readFileSync(join(REPOSITORY, 'site/engine.config.json'), 'utf8'));

export function engineScene({ entries, mutate = (config) => config, extraFiles = [] }) {
  const root = mkdtempSync(join(tmpdir(), 'engine-scene-'));
  const files = [
    ...new Set([
      ...importClosure(entries),
      ...schemaFiles(),
      'site/package.json',
      'site/src/config.yaml',
      ...extraFiles,
    ]),
  ];
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(REPOSITORY, file), join(root, file));
  }
  writeFileSync(join(root, 'site/engine.config.json'), `${JSON.stringify(mutate(realEngineConfig()), null, 2)}\n`);
  const modules = join(REPOSITORY, 'site/node_modules');
  if (existsSync(modules)) symlinkSync(modules, join(root, 'site/node_modules'));

  return {
    root,
    files,
    evaluate(module, expression) {
      const url = pathToFileURL(join(root, module)).href;
      const code = `import * as m from ${JSON.stringify(url)}; console.log(JSON.stringify(${expression}));`;
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
        cwd: join(root, 'site'),
        encoding: 'utf8',
      });
      if (run.status !== 0) throw new Error(run.stderr.trim() || 'no output');
      return JSON.parse(run.stdout);
    },
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}
