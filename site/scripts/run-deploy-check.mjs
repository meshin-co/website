import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { credentialFindings } from './deploy.mjs';

const findings = credentialFindings(process.env);
if (findings.length > 0) {
  for (const finding of findings) console.error(`DEPLOY ${finding}`);
  console.error(`deploy:check: ${findings.length} finding(s); copy site/.env.example to .env and fill it in`);
  process.exit(1);
}

const projects = spawnSync(join('node_modules', '.bin', 'wrangler'), ['pages', 'project', 'list'], {
  encoding: 'utf8',
  env: process.env,
});

if (projects.status !== 0) {
  console.error(projects.stdout || projects.stderr);
  console.error('deploy:check: the token cannot list Pages projects; it needs Account | Cloudflare Pages | Edit');
  process.exit(1);
}

const project = process.env.CLOUDFLARE_PAGES_PROJECT;
const exists = new RegExp(`\\b${project}\\b`).test(projects.stdout);

console.log(`deploy:check: token reaches Pages in account ${process.env.CLOUDFLARE_ACCOUNT_ID.slice(0, 6)}…`);
console.log(
  exists
    ? `deploy:check: project ${project} exists`
    : `deploy:check: project ${project} does not exist yet; npm run deploy:preview creates it`
);
