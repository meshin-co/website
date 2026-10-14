import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { credentialFindings, deployArgs, deploymentUrl, ledgerFindings, previewBranch } from './deploy.mjs';
import { collectRoutes } from './routes-gate.mjs';

const production = !process.argv.includes('--preview');
const branch = production ? 'main' : previewBranch(process.argv);

const findings = credentialFindings(process.env);
if (findings.length > 0) {
  for (const finding of findings) console.error(`DEPLOY ${finding}`);
  process.exit(1);
}

const ledger = JSON.parse(readFileSync(join('..', 'audits', 'routes.json'), 'utf8'));
const drift = ledgerFindings(ledger, collectRoutes('dist'));
if (drift.length > 0) {
  for (const finding of drift) console.error(`DEPLOY ${finding}`);
  process.exit(1);
}

console.log(`deploy: ${ledger.length} routes, branch ${branch}`);

const result = spawnSync(
  join('node_modules', '.bin', 'wrangler'),
  deployArgs({
    project: process.env.CLOUDFLARE_PAGES_PROJECT,
    dist: 'dist',
    branch,
  }),
  { encoding: 'utf8', env: process.env }
);

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status !== 0) process.exit(result.status ?? 1);

const url = deploymentUrl(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
if (!url) {
  console.error('DEPLOY wrangler reported no deployment address; nothing can be smoked or linked');
  process.exit(1);
}

console.log(`deploy: url=${url}`);
