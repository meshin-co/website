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

export function linkArgs({ skipExternal = false, origin } = {}) {
  const hosts = skippedHosts(origin);
  const skip = skipExternal ? [...hosts, EXTERNAL] : hosts;
  return [
    'dist',
    '--recurse',
    '--silent',
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
    skip.join('|'),
  ];
}
