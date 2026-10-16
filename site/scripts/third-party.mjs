const FETCHED_REL = /^(?:stylesheet|preload|modulepreload|prefetch|icon|apple-touch-icon|manifest)$/i;
const ABSOLUTE = String.raw`(?:https?:)?\/\/[^"']+`;
const SCRIPT_OR_MEDIA = new RegExp(
  String.raw`<(?:script|img|iframe|source|video|audio|embed)\b[^>]*?(?<![-\w])src\s*=\s*["'](${ABSOLUTE})["']`,
  'gi'
);
const LINK = /<link\b([^>]*)>/gi;
const REL = /(?<![-\w])rel\s*=\s*["']([^"']+)["']/i;
const HREF = new RegExp(String.raw`(?<![-\w])href\s*=\s*["'](${ABSOLUTE})["']`, 'i');
const COUNTING_CLAIM = /Cloudflare Web Analytics counts page views|counted by Cloudflare Web Analytics/i;
const NO_COUNTING_CLAIM = /no analytics runs at all|Analytics<\/dt>\s*<dd[^>]*>\s*None/i;

export const BEACON_ORIGIN = 'https://static.cloudflareinsights.com';

export const ALLOWED_ORIGINS = {
  [BEACON_ORIGIN]:
    'Cloudflare Web Analytics, free on every Cloudflare plan, cookieless and needing no consent banner (L58)',
};

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi;
const EXECUTABLE_TYPE = /^(?:module|text\/javascript|application\/javascript)$/i;
const QUOTED_URL = new RegExp(String.raw`["'](${ABSOLUTE})["']`, 'gi');

function requestedUrls(html) {
  const urls = [...html.matchAll(SCRIPT_OR_MEDIA)].map(([, url]) => url);

  for (const [, attrs] of html.matchAll(LINK)) {
    const rel = attrs.match(REL)?.[1] ?? '';
    const href = attrs.match(HREF)?.[1];
    if (href && rel.split(/\s+/).some((token) => FETCHED_REL.test(token))) urls.push(href);
  }

  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
    const type = attrs.match(/(?<![-\w])type\s*=\s*["']([^"']+)["']/i)?.[1];
    if (type && !EXECUTABLE_TYPE.test(type.trim())) continue;
    for (const [, url] of body.matchAll(QUOTED_URL)) urls.push(url);
  }

  return urls;
}

export function loadedOrigins(html, selfOrigin = '') {
  const origins = new Set();
  for (const url of requestedUrls(html)) {
    const parsed = URL.parse(url, 'https://inherited.invalid');
    if (parsed && parsed.origin !== selfOrigin) origins.add(parsed.origin);
  }
  return [...origins];
}

export function blockingThirdPartyFindings(pages, selfOrigin = '') {
  const findings = [];
  for (const { route, html } of pages) {
    for (const [, url] of html.matchAll(SCRIPT_OR_MEDIA)) {
      const parsed = URL.parse(url, 'https://inherited.invalid');
      if (!parsed || parsed.origin === selfOrigin) continue;
      findings.push(
        `${route} loads ${parsed.origin} from a markup tag; measured on 2026-10-16 that costs 810ms of mobile LCP, so it is appended after the load event instead`
      );
    }
  }
  return findings;
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
  const claim = beaconShips ? NO_COUNTING_CLAIM : COUNTING_CLAIM;
  const wrong = beaconShips
    ? 'denies analytics, but the build loads the Cloudflare beacon'
    : 'tells a reader page views are counted, but the build loads no beacon';

  return pages.filter(({ html }) => claim.test(html)).map(({ route }) => `${route} ${wrong}`);
}
