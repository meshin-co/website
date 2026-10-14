import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { credentialFindings, deployArgs, ledgerFindings } from './deploy.mjs';
import { collectRoutes } from './routes-gate.mjs';

const previewIndex = process.argv.indexOf('--preview');
const production = previewIndex === -1;
const branch = production ? 'main' : (process.argv[previewIndex + 1] ?? 'preview');

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
  { stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 1);
