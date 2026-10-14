import { readFile } from 'node:fs/promises';

import { join } from 'node:path';

import { discoverRoutes, routeFile } from './gate.mjs';
import { siteOrigin } from './links-gate.mjs';
import { ALLOWED_ORIGINS, analyticsClaimFindings, originFindings } from './third-party.mjs';

const distDir = process.argv[2] ?? 'dist';
const routes = await discoverRoutes(distDir);

const pages = [];
for (const route of routes) {
  pages.push({ route, html: await readFile(await routeFile(distDir, route), 'utf8') });
}

const origin = siteOrigin(join('src', 'config.yaml'));
const findings = [...originFindings(pages, origin), ...analyticsClaimFindings(pages)];

console.log(
  `paid: ${routes.length} routes, ${Object.keys(ALLOWED_ORIGINS).length} declared third-party origin(s), ${findings.length} findings`
);
for (const finding of findings) console.error(`PAID ${finding}`);
if (findings.length > 0) process.exitCode = 1;
