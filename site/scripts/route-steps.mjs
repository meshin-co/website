import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseStale, restateFile } from './disposition-restate.mjs';
import { recordDirectory } from './record-layout.mjs';
import { outputTail, plainOutput } from './route-transaction.mjs';
import { WriterError } from './writer-error.mjs';

export const SITE_DIRECTORY = 'site';
export const SEMANTIC_CORE = 'docs/SEMANTIC-CORE.md';
const DIGEST = /^[0-9a-f]{12}$/;

const npm = (script) => ['npm', 'run', script];
export const BUILD = npm('build');
export const EDITORIAL = { name: 'gate:editorial', command: npm('gate:editorial') };
export const LIST_STALE = ['node', 'scripts/stale-dispositions.mjs', '.', 'dist'];
export const REGENERATE = [
  ['node', 'scripts/semantic-core.mjs'],
  ['node', 'scripts/generate-registers.mjs'],
];
const BLOCKING_CHECKS = [
  { name: 'semantic-core', command: ['node', 'scripts/semantic-core.mjs', '--check', 'dist'] },
  { name: 'gate:registers', command: npm('gate:registers') },
  EDITORIAL,
];
const INFORMATION_GATES = ['gate:content', 'gate:human', 'gate:machine'].map((name) => ({ name, command: npm(name) }));

export const siteRelative = (path) => path.slice(SITE_DIRECTORY.length + 1);
export const prettier = (path) => ['npx', 'prettier', '--write', path];
const exitOf = ({ status }) => status ?? 1;
export const outcomeOf = ({ status }) => (status === null ? 'did not finish' : `exited with status ${status}`);
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mentions = (output, { route, target }) =>
  new RegExp(`${escaped(route)}(?![A-Za-z0-9-])`).test(output) || output.includes(target);

function failureOf(command, result, plans) {
  const output = plainOutput(result);
  const named = plans.filter((planned) => mentions(output, planned)).map(({ route }) => route);
  const naming = named.length === 0 ? '' : `\nentries named in the output: ${named.join(', ')}`;
  return new WriterError('build', `${command.join(' ')} ${outcomeOf(result)}:\n${outputTail(result)}${naming}`);
}

export function commandsIn({ run, cwd, plans }) {
  const execute = ([command, ...args]) => run(command, args, { cwd });
  const succeed = async (command) => {
    const result = await execute(command);
    if (result.status !== 0) throw failureOf(command, result, plans);
    return result;
  };
  return { execute, succeed };
}

export async function digestOf(succeed, target) {
  const printed = (await succeed(['node', 'scripts/disposition-digest.mjs', '.', 'dist', target])).stdout.trim();
  if (!DIGEST.test(printed))
    throw new WriterError(
      'build',
      `scripts/disposition-digest.mjs printed "${printed.slice(0, 60)}" for ${target}, not twelve hex digits`
    );
  return printed;
}

export async function restateStale({ repoRoot, transaction, succeed, reason, mayNotBeStale = [] }) {
  const stale = parseStale((await succeed(LIST_STALE)).stdout);
  const restated = [];
  for (const [file, items] of Map.groupBy(stale, (item) => item.file)) {
    const path = `${recordDirectory('disposition')}/${file}`;
    if (mayNotBeStale.includes(path))
      throw new WriterError('build', `${path} is a disposition this run wrote, and it cannot be stale`);
    const text = readFileSync(join(repoRoot, path), 'utf8');
    transaction.write(path, restateFile({ file, text, stale: items, reason }));
    restated.push(path);
  }
  return restated;
}

export const formatDispositions = (succeed, paths) =>
  succeed(['npx', 'prettier', '--write', ...paths.map((path) => `../${path}`)]);

export async function runBlockingChecks(succeed) {
  for (const { command } of BLOCKING_CHECKS) await succeed(command);
  return BLOCKING_CHECKS.map(({ name }) => ({ name, exit: 0 }));
}

export async function runInformationGates(execute) {
  const gates = [];
  for (const { name, command } of INFORMATION_GATES) gates.push({ name, exit: exitOf(await execute(command)) });
  return gates;
}

export const filesOf = (repoRoot, paths) =>
  paths.map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
