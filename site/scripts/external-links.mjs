export const EXTERNAL_REL = ['nofollow', 'noopener', 'noreferrer'];

const OUR_HOSTS = ['meshin.co'];
const ANCHOR = /<a\b[^>]*>/gi;
const HREF = /\bhref="([^"]*)"/i;
const REL = /\brel="([^"]*)"/i;

const isOurs = (host) => OUR_HOSTS.some((ours) => host === ours || host.endsWith(`.${ours}`));

export function externalAnchors(html) {
  const anchors = [];

  for (const [tag] of (html ?? '').matchAll(ANCHOR)) {
    const href = HREF.exec(tag)?.[1];
    if (!href || !/^https?:\/\//i.test(href)) continue;

    let host;
    try {
      host = new URL(href).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      continue;
    }
    if (isOurs(host)) continue;

    const rel = (REL.exec(tag)?.[1] ?? '')
      .split(/\s+/)
      .map((token) => token.toLowerCase())
      .filter(Boolean);

    anchors.push({ href, host, rel });
  }

  return anchors;
}

export function relFindings(route, html) {
  return externalAnchors(html)
    .map((anchor) => ({ ...anchor, missing: EXTERNAL_REL.filter((token) => !anchor.rel.includes(token)) }))
    .filter((anchor) => anchor.missing.length > 0)
    .map(({ href, missing }) => ({ route, href, missing }));
}

export function internalNofollowFindings(route, html) {
  const findings = [];

  for (const [tag] of (html ?? '').matchAll(ANCHOR)) {
    const href = HREF.exec(tag)?.[1];
    if (!href) continue;

    const isInternal = href.startsWith('/') || /^https?:\/\/(www\.)?meshin\.co(\/|$)/i.test(href);
    if (!isInternal) continue;

    const rel = (REL.exec(tag)?.[1] ?? '').toLowerCase();
    if (!rel.split(/\s+/).includes('nofollow')) continue;

    findings.push({ route, href });
  }

  return findings;
}
