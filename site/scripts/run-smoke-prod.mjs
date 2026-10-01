import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatorRevision } from './report.mjs';
import { checkHeaders, checkNoindex, renderSmoke, verdictFor } from './smoke-prod.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';

const origin = (process.argv[2] ?? `https://${brandFromDisk().name}`).replace(/\/$/, '');
const out = process.argv[3] ?? '../audits/phase-5/smoke-prod.md';

const CANONICAL = [
  '/',
  '/services',
  '/pricing',
  '/approach',
  '/about',
  '/contact',
  '/faq',
  '/blog',
  '/glossary',
  '/resources',
];
const MACHINE = [
  '/robots.txt',
  '/sitemap-index.xml',
  '/llms.txt',
  '/rss.xml',
  '/feed.json',
  '/.well-known/security.txt',
];

const rows = [];

const home = await fetch(`${origin}/`, { redirect: 'manual' });
const headers = Object.fromEntries([...home.headers].map(([key, value]) => [key.toLowerCase(), value]));
rows.push(checkHeaders(headers));
rows.push(verdictFor({ route: '/', status: home.status }));
rows.push(checkNoindex(home.status === 200 ? await home.text() : ''));

for (const route of CANONICAL.slice(1)) {
  const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
  rows.push(verdictFor({ route, status: response.status }));
}

for (const route of MACHINE) {
  const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
  rows.push(verdictFor({ route, status: response.status }));
}

mkdirSync(join(out, '..'), { recursive: true });
writeFileSync(out, renderSmoke(origin, rows, generatorRevision()));

const failures = rows.filter((row) => row.status === 'fail');
console.log(`smoke: ${rows.length - failures.length} of ${rows.length} checks pass against ${origin} -> ${out}`);
for (const row of failures) console.log(`  FAIL ${row.check}: ${row.detail}`);
process.exitCode = failures.length === 0 ? 0 : 1;
