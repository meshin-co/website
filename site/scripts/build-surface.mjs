import { readEngineConfig } from './engine-config.mjs';

const PROSE = 'prose';
const TOOLING = 'tooling';
const BUILD = 'build';

export function compileRules(diff) {
  return Object.freeze({
    proseDirectories: diff.proseDirectories,
    proseExtensions: diff.proseExtensions,
    shippedDirectories: diff.shippedDirectories,
    automationDirectories: diff.automationDirectories,
    testTooling: new Set(diff.testTooling),
    testFile: new RegExp(diff.testFilePattern),
    testDirectory: new RegExp(diff.testDirectoryPattern),
  });
}

export const DEFAULT_RULES = compileRules(readEngineConfig().diff);

const isPlainPath = (path) =>
  typeof path === 'string' &&
  path !== '' &&
  !path.startsWith('/') &&
  !path.startsWith('"') &&
  !path.endsWith('/') &&
  !path.includes('\\') &&
  !path.includes('\0') &&
  path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');

const within = (path, directories) => directories.some((directory) => path.startsWith(directory));

export function classifyPath(path, rules = DEFAULT_RULES) {
  if (!isPlainPath(path)) return BUILD;
  if (within(path, rules.proseDirectories)) return PROSE;
  if (rules.testFile.test(path) || rules.testTooling.has(path)) return TOOLING;
  if (within(path, rules.shippedDirectories)) return BUILD;
  if (rules.proseExtensions.some((extension) => path.endsWith(extension))) return PROSE;
  if (within(path, rules.automationDirectories) || rules.testDirectory.test(path)) return TOOLING;
  return BUILD;
}

export const affectsBuild = (path, rules) => classifyPath(path, rules) === BUILD;

export const drawsFullGraph = (path, rules) => classifyPath(path, rules) !== PROSE;

export const needsFullGraph = (paths, rules) =>
  !Array.isArray(paths) || paths.length === 0 || paths.some((path) => drawsFullGraph(path, rules));
