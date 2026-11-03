import { readFileSync } from 'node:fs';

import yaml from 'js-yaml';

export function siteOrigin(configPath) {
  const origin = yaml.load(readFileSync(configPath, 'utf8'))?.site?.site;
  if (!origin) throw new Error(`links-gate: ${configPath} has no site.site to skip absolute self-links with`);
  return origin;
}

export const THIRD_PARTY_HOSTS = [
  'static.cloudflareinsights.com',
  'linkedin.com',
  'cal.com',
  'github.com/meshin-co',
  'apps.apple.com',
];

export const skippedHosts = (origin) => [...THIRD_PARTY_HOSTS, `^${origin}`];

const EXTERNAL = '^https?://(?!localhost|127\\.0\\.0\\.1)';

const EXTENSIONLESS_LOCAL = '^(http://(?:localhost|127\\.0\\.0\\.1):\\d+/(?:[^/?#]+/)*[^/?#.]+)([?#].*)?$';

export function linkArgs({ origin, json = false } = {}) {
  return [
    'dist',
    '--recurse',
    ...(json ? ['--format', 'json'] : ['--silent']),
    '--url-rewrite-search',
    EXTENSIONLESS_LOCAL,
    '--url-rewrite-replace',
    '$1.html$2',
    '--skip',
    [...skippedHosts(origin), EXTERNAL].join('|'),
  ];
}

export function linkFindings(results) {
  return results
    .filter(({ state }) => state === 'BROKEN')
    .map(({ url, status, parent }) => `${parent} -> ${url} (${status > 0 ? status : 'no response'})`);
}

const where = (routes = []) => `on ${routes.length} page${routes.length === 1 ? '' : 's'}, e.g. ${routes[0]}`;

export function externalFindings(results, routesByAddress) {
  const found = { answered: 0, dead: [], unverified: [] };
  for (const { url, verdict, status, reason } of results.values()) {
    if (verdict === 'answered') found.answered += 1;
    else if (verdict === 'dead') found.dead.push(`${url} (${status}) ${where(routesByAddress.get(url))}`);
    else found.unverified.push(`${url} (${reason}) ${where(routesByAddress.get(url))}`);
  }
  return found;
}
