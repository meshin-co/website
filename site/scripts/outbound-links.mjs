import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { skippedHosts } from './links-gate.mjs';

const ANCHOR = /<a\b[^>]*>/gi;
const HREF = /\bhref="([^"]*)"/i;
const OUTBOUND = /^https?:\/\//i;

const asRequested = (href) => href.replaceAll('&amp;', '&').split('#')[0];

export function outboundFrom(documents, origin) {
  const skipped = new RegExp(skippedHosts(origin).join('|'));
  const routesByAddress = new Map();

  for (const { route, html } of documents) {
    for (const [tag] of (html ?? '').matchAll(ANCHOR)) {
      const href = HREF.exec(tag)?.[1];
      if (!href || !OUTBOUND.test(href)) continue;
      const address = asRequested(href);
      if (skipped.test(address)) continue;
      routesByAddress.set(address, new Set([...(routesByAddress.get(address) ?? []), route]));
    }
  }

  return new Map(
    [...routesByAddress].sort(([a], [b]) => (a < b ? -1 : 1)).map(([address, routes]) => [address, [...routes].sort()])
  );
}

const pagesUnder = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pagesUnder(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });

export function readOutbound(dist, origin) {
  const documents = pagesUnder(dist).map((file) => {
    const path = relative(dist, file).split(sep).join('/');
    return { route: path === 'index.html' ? '/' : `/${path.replace(/\.html$/, '')}`, html: readFileSync(file, 'utf8') };
  });
  return outboundFrom(documents, origin);
}
