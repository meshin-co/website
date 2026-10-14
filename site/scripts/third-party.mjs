const RESOURCE_REF = /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
const ANCHOR = /<a\b[^>]*?href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
const ANALYTICS_CLAIM = /counted by Cloudflare Web Analytics/i;

export const BEACON_ORIGIN = 'https://static.cloudflareinsights.com';

export const ALLOWED_ORIGINS = {
  [BEACON_ORIGIN]:
    'Cloudflare Web Analytics, free on every Cloudflare plan, cookieless and needing no consent banner (L58)',
};

export function loadedOrigins(html, selfOrigin = '') {
  const anchors = new Set();
  for (const [, url] of html.matchAll(ANCHOR)) anchors.add(url);

  const origins = new Set();
  for (const [, url] of html.matchAll(RESOURCE_REF)) {
    if (anchors.has(url)) continue;
    const origin = new URL(url).origin;
    if (origin !== selfOrigin) origins.add(origin);
  }
  return [...origins];
}

export function originFindings(pages, selfOrigin = '') {
  const findings = [];
  for (const { route, html } of pages) {
    for (const origin of loadedOrigins(html, selfOrigin)) {
      if (origin in ALLOWED_ORIGINS) continue;
      findings.push(`${route} loads ${origin}, which no entry in ALLOWED_ORIGINS declares free (L58)`);
    }
  }
  return findings;
}

export function analyticsClaimFindings(pages) {
  const beaconShips = pages.some(({ html }) => loadedOrigins(html).includes(BEACON_ORIGIN));
  const findings = [];
  for (const { route, html } of pages) {
    if (!ANALYTICS_CLAIM.test(html) || beaconShips) continue;
    findings.push(`${route} tells a reader page views are counted, but the build loads no beacon`);
  }
  return findings;
}
