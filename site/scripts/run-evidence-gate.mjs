import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { gitObjectType, LEGACY_PROSE_PROVENANCE, provenanceFindings, readArtefacts } from './evidence-gate.mjs';

const repo = resolve(process.argv[2] ?? '..');
const auditsDir = join(repo, 'audits');

const walk = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith('.md')) found.push(relative(repo, full));
  }
  return found;
};

const artefacts = readArtefacts(repo, statSync(auditsDir).isDirectory() ? walk(auditsDir) : []);
const findings = provenanceFindings(artefacts, gitObjectType(repo));
const legacy = Object.keys(LEGACY_PROSE_PROVENANCE);

for (const finding of findings) console.error(`EVIDENCE ${finding.rule} ${finding.path}: ${finding.detail}`);
console.log(
  `evidence: ${artefacts.length} artefacts checked, ${findings.length} findings, ${legacy.length} legacy reports allowed prose provenance (${legacy.join(', ')})`
);
process.exitCode = findings.length === 0 ? 0 : 1;
