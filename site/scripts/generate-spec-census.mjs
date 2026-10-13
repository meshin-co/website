import { censusFromSpecs } from './spec-gate.mjs';
import { readSpecs, repoPath, writeFileSync } from './spec-tree.mjs';
import { join } from 'node:path';

const specs = readSpecs();
const census = censusFromSpecs(specs);
const file = join(repoPath, 'openspec', 'CENSUS.json');
writeFileSync(file, `${JSON.stringify(census, null, 2)}\n`);
console.log(
  `census: ${specs.length} capabilities, ${specs.reduce((total, spec) => total + spec.requirements.length, 0)} requirements`
);
