import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseSpec } from './spec-gate.mjs';

const repo = resolve(process.argv[2] ?? '..');
const specsRoot = join(repo, 'openspec', 'specs');

const walk = (dir, prefix = '') => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(join(dir, entry.name), relative));
    else if (entry.name === 'spec.md') found.push(prefix);
  }
  return found;
};

export const readSpecs = () =>
  walk(specsRoot)
    .filter(Boolean)
    .map((capability) => ({ capability, ...parseSpec(readFileSync(join(specsRoot, capability, 'spec.md'), 'utf8')) }));

export const specsRootPath = specsRoot;
export const repoPath = repo;
export { writeFileSync };
