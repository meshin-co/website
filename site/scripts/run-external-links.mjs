import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { internalNofollowFindings, relFindings } from './external-links.mjs';

const dist = process.argv[2] ?? 'dist';

const pages = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pages(path));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
};

const routeOf = (file) => {
  const rel = relative(dist, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  return `/${rel
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '')}`;
};

const files = pages(dist);
const read = (file) => ({ route: routeOf(file), html: readFileSync(file, 'utf8') });
const documents = files.map(read);
const findings = documents.flatMap(({ route, html }) => relFindings(route, html));
const internal = documents.flatMap(({ route, html }) => internalNofollowFindings(route, html));

const byHref = new Map();
for (const finding of findings) {
  const key = `${finding.href} | ${finding.missing.join(' ')}`;
  if (!byHref.has(key)) byHref.set(key, { ...finding, routes: [] });
  byHref.get(key).routes.push(finding.route);
}

console.log(
  `external: ${files.length} pages, ${findings.length} outbound links missing a required rel token, ${internal.length} internal links wrongly marked nofollow`
);
for (const entry of byHref.values()) {
  console.log(
    `  EXTERNAL ${entry.href} is missing ${entry.missing.join(', ')} on ${entry.routes.length} route(s), e.g. ${entry.routes[0]}`
  );
}
for (const finding of internal) {
  console.log(`  INTERNAL ${finding.href} carries nofollow on ${finding.route}; internal links keep their signal`);
}

process.exitCode = findings.length === 0 && internal.length === 0 ? 0 : 1;
