import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { provenanceFindings, readArtefacts } from './evidence-gate.mjs';

const repo = resolve(process.argv[2] ?? '..');
const auditsDir = join(repo, 'audits');

const walk = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith('.md')) found.push(full);
  }
  return found;
};

const artefacts = readArtefacts(statSync(auditsDir).isDirectory() ? walk(auditsDir) : []);
const findings = provenanceFindings(artefacts);

for (const finding of findings)
  console.error(`EVIDENCE ${finding.rule} ${finding.path.replace(`${repo}/`, '')}: ${finding.detail}`);
console.log(`evidence: ${artefacts.length} artefacts checked, ${findings.length} findings`);
process.exitCode = findings.length === 0 ? 0 : 1;
