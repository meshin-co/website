import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  citedCommands,
  citedPaths,
  enforcesRowRange,
  isExternal,
  lockedRowClaims,
  resolveCandidates,
} from './docs-gate.mjs';

const repo = resolve(process.argv[2] ?? '..');

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith('.md')) out.push(path);
  }
  return out;
};

const docs = [join(repo, 'AGENTS.md'), ...walk(join(repo, 'docs')), ...walk(join(repo, 'site/.agents/skills'))].filter(
  (path) => existsSync(path)
);

const scripts = JSON.parse(readFileSync(join(repo, 'site/package.json'), 'utf8')).scripts;
const lockedRows = readFileSync(join(repo, 'docs/plan/reference/locked-decisions.md'), 'utf8');
const highestRow = Math.max(...[...lockedRows.matchAll(/^\| L(\d+)/gm)].map(([, number]) => Number(number)));

const findings = [];

for (const doc of docs) {
  const text = readFileSync(doc, 'utf8');
  const relative = doc.slice(repo.length + 1);

  for (const cited of citedPaths(text)) {
    if (isExternal(cited)) continue;
    const resolved = resolveCandidates(cited, relative).some((candidate) => {
      const absolute = join(repo, candidate);
      return existsSync(absolute) && statSync(absolute).isFile();
    });
    if (resolved) continue;
    findings.push({ doc: relative, rule: 'dead-path', detail: cited });
  }

  for (const command of citedCommands(text)) {
    if (scripts[command]) continue;
    findings.push({ doc: relative, rule: 'dead-command', detail: `npm run ${command}` });
  }

  for (const claimed of enforcesRowRange(relative) ? lockedRowClaims(text) : []) {
    if (claimed === highestRow) continue;
    findings.push({
      doc: relative,
      rule: 'stale-row-range',
      detail: `claims L1-L${claimed}, the reference holds L1-L${highestRow}`,
    });
  }
}

console.log(`docs: ${docs.length} files checked, ${findings.length} findings`);
for (const finding of findings) console.log(`  ${finding.rule} ${finding.doc}: ${finding.detail}`);
process.exitCode = findings.length === 0 ? 0 : 1;
