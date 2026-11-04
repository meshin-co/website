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
    '--retry',
    '--retry-errors',
    '--retry-errors-count',
    '3',
    '--retry-errors-jitter',
    '500',
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

function malformation(address) {
  if (/\s/.test(address)) return 'contains whitespace';
  if (!URL.canParse(address)) return 'does not parse as an address';
  const { hostname } = new URL(address);
  return hostname.includes('.') || hostname.startsWith('[') ? null : 'the host is not a domain name';
}

export function malformedFindings(outbound) {
  return [...outbound].flatMap(([address, routes]) => {
    const why = malformation(address);
    return why === null ? [] : [`${address} (${why}) ${where(routes)}`];
  });
}
