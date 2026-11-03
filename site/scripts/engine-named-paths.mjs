import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT_DIRECTORY = 'site/scripts';
const WORKFLOW_DIRECTORY = '.github/workflows';
const CONFIGURATION_FILES = ['site/playwright.config.ts', 'site/lighthouserc.cjs', 'site/package.json'];

const SCRIPT_FILE = /\.mjs$/;
const TEST_FILE = /\.test\.mjs$/;
const SPECIMEN_CATALOGUE = /-specimens\.mjs$/;
const WORKFLOW_FILE = /\.yml$/;

const assertsAboutPaths = (name) => TEST_FILE.test(name);
const plantsAbsentPaths = (name) => SPECIMEN_CATALOGUE.test(name);
const isEngineScript = (name) => SCRIPT_FILE.test(name) && !assertsAboutPaths(name) && !plantsAbsentPaths(name);
const isWorkflow = (name) => WORKFLOW_FILE.test(name);

function filesIn(directory, accepts) {
  if (!existsSync(directory)) return [];
  const names = readdirSync(directory).filter(accepts);
  return names.map((name) => join(directory, name));
}

const textOf = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

function engineSourceText(repo) {
  const sources = [
    ...filesIn(join(repo, SCRIPT_DIRECTORY), isEngineScript),
    ...filesIn(join(repo, WORKFLOW_DIRECTORY), isWorkflow),
    ...CONFIGURATION_FILES.map((file) => join(repo, file)),
  ];
  return sources.map(textOf).join('\n');
}

const NAME_CHARACTER = /[\w@.-]/;
const CONTINUES_THE_NAME = /^(?:[\w@-]|\.[\w@-])/;

function namesWhole(text, name) {
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    const before = text.charAt(at - 1);
    const after = text.slice(at + name.length, at + name.length + 2);
    if (!NAME_CHARACTER.test(before) && !CONTINUES_THE_NAME.test(after)) return true;
  }
  return false;
}

function spellings(path) {
  const withoutSlash = path.replace(/\/+$/, '');
  return [...new Set([withoutSlash, withoutSlash.replace(/^site\//, '')])].filter(Boolean);
}

export function engineNamedPaths(repo) {
  const text = engineSourceText(repo);
  return (path) => spellings(path).some((spelling) => namesWhole(text, spelling));
}
