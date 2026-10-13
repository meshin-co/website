import { indexFromSpecs } from './spec-gate.mjs';
import { readSpecs, repoPath, writeFileSync } from './spec-tree.mjs';
import { join } from 'node:path';

const specs = readSpecs();
const file = join(repoPath, 'openspec', 'INDEX.md');
writeFileSync(file, indexFromSpecs(specs));
console.log(`index: ${specs.length} capabilities`);
