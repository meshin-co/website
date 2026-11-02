import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_RULES, classifyPath } from './build-surface.mjs';

const MAX_BUFFER = 64 * 1024 * 1024;
const SHOWN_PATHS = 12;
const SHORT_SHA = 12;

const git = (repository, args) =>
  execFileSync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const short = (sha) => sha.slice(0, SHORT_SHA);

function resolveCommit(repository, revision) {
  if (typeof revision !== 'string' || revision === '' || revision.startsWith('-')) return null;
  try {
    return git(repository, ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`]).trim();
  } catch {
    return null;
  }
}

function baseOf(repository, before, tip) {
  const given = resolveCommit(repository, before);
  if (given !== null) return { base: given, why: `before ${short(given)}` };
  const parent = resolveCommit(repository, `${tip}^1`);
  if (parent !== null) return { base: parent, why: `no usable before, so the parent ${short(parent)}` };
  const empty = git(repository, ['hash-object', '-t', 'tree', '/dev/null']).trim();
  return { base: empty, why: 'no usable before and no parent: the first commit, so the empty tree' };
}

function readDiff({ repository, before, after }) {
  const tip = resolveCommit(repository, after);
  if (tip === null) return { failure: `after ${JSON.stringify(after)} is not a commit of ${repository}` };
  try {
    const { base, why } = baseOf(repository, before, tip);
    const names = git(repository, ['diff', '--name-only', '-z', '--no-renames', base, tip, '--']);
    return { tip, why, paths: names.split('\0').filter((path) => path !== '') };
  } catch (error) {
    return { failure: error.message.split('\n')[0] };
  }
}

const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const layoutLines = (repository, rules) =>
  rules.shippedDirectories
    .filter((directory) => !isDirectory(join(repository, directory)))
    .map(
      (directory) =>
        `shipped directory ${directory} is not in this checkout, so the rules do not describe this repository and every gate runs`
    );

function listing(classes) {
  const drawing = classes.filter(({ cls }) => cls !== 'prose');
  const shown = drawing.slice(0, SHOWN_PATHS).map(({ cls, path }) => `  ${cls.padEnd(8)} ${path}`);
  const hidden = drawing.length - shown.length;
  return hidden > 0 ? [...shown, `  ... and ${hidden} more`] : shown;
}

function countsLine(classes) {
  const count = (name) => classes.filter(({ cls }) => cls === name).length;
  return `${classes.length} changed paths: ${count('prose')} prose, ${count('tooling')} tooling, ${count('build')} build`;
}

export function classifyDiff({ repository, before, after, rules = DEFAULT_RULES }) {
  const read = readDiff({ repository, before, after });
  const layout = layoutLines(repository, rules);
  if (read.failure !== undefined) {
    const lines = [`could not read the diff (${read.failure}), so every gate runs`, ...layout];
    return { code: true, lines: [...lines, 'build surface changed: true'] };
  }
  const classes = read.paths.map((path) => ({ path, cls: classifyPath(path, rules) }));
  const empty =
    read.paths.length === 0
      ? ['no path changed between the base and the commit, so nothing proves the base was right and every gate runs']
      : [];
  const code = empty.length > 0 || layout.length > 0 || classes.some(({ cls }) => cls !== 'prose');
  const lines = [
    `diff ${read.why} .. ${short(read.tip)}`,
    countsLine(classes),
    ...listing(classes),
    ...empty,
    ...layout,
    `build surface changed: ${code}`,
  ];
  return { code, lines };
}
