import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatorRevision } from './report.mjs';
import {
  ACCEPT_PROBES,
  CANONICAL,
  MACHINE,
  PATH_SHAPES,
  acceptVerdict,
  canonicalHostVerdict,
  checkHeaders,
  checkNoindex,
  markdownNegotiationVerdict,
  pathAgreementVerdict,
  renderSmoke,
  varyVerdict,
  verdictFor,
} from './smoke-prod.mjs';
import { brandFromDisk } from '../src/utils/brand.mjs';

const origin = (process.argv[2] ?? `https://${brandFromDisk().name}`).replace(/\/$/, '');
const out = process.argv[3] ?? '../audits/phase-local/smoke-prod.md';

async function observe(path, accept) {
  const response = await fetch(`${origin}${path}`, { headers: { accept }, redirect: 'manual' });
  await response.body?.cancel();
  return {
    status: response.status,
    location: response.headers.get('location') ?? undefined,
    contentLocation: response.headers.get('content-location') ?? undefined,
  };
}

const rows = [];

const home = await fetch(`${origin}/`, { redirect: 'manual' });
const headers = Object.fromEntries([...home.headers].map(([key, value]) => [key.toLowerCase(), value]));
rows.push(checkHeaders(headers));
rows.push(verdictFor({ route: '/', status: home.status }));
rows.push(checkNoindex(home.status === 200 ? await home.text() : ''));

const asMarkdown = await fetch(`${origin}/`, { headers: { accept: 'text/markdown' }, redirect: 'manual' });
rows.push(
  markdownNegotiationVerdict({
    status: asMarkdown.status,
    contentType: asMarkdown.headers.get('content-type') ?? '',
  })
);
rows.push(varyVerdict('html', headers.vary ?? null));
rows.push(varyVerdict('markdown', asMarkdown.headers.get('vary')));

for (const probe of ACCEPT_PROBES) {
  const response = await fetch(`${origin}/`, { headers: { accept: probe.accept }, redirect: 'manual' });
  const contentType = response.headers.get('content-type') ?? '';
  rows.push(acceptVerdict(probe, { status: response.status, contentType }));
}

for (const path of PATH_SHAPES) {
  const html = await observe(path, 'text/html');
  const markdown = await observe(path, 'text/markdown');
  rows.push(pathAgreementVerdict(path, { html, markdown }));
}

for (const route of CANONICAL.slice(1)) {
  const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
  rows.push(verdictFor({ route, status: response.status }));
}

for (const route of MACHINE) {
  const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
  rows.push(verdictFor({ route, status: response.status }));
}

if (new URL(origin).hostname === brandFromDisk().name) {
  for (const path of ['/', '/about']) {
    const response = await fetch(`https://www.${brandFromDisk().name}${path}`, { redirect: 'manual' });
    const seen = { status: response.status, location: response.headers.get('location') };
    rows.push(canonicalHostVerdict(seen, origin, path));
  }
}

mkdirSync(join(out, '..'), { recursive: true });
writeFileSync(out, renderSmoke(origin, rows, generatorRevision(out)));

const failures = rows.filter((row) => row.status === 'fail');
console.log(`smoke: ${rows.length - failures.length} of ${rows.length} checks pass against ${origin} -> ${out}`);
for (const row of failures) console.log(`  FAIL ${row.check}: ${row.detail}`);
process.exitCode = failures.length === 0 ? 0 : 1;
