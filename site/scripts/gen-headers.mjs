import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
const INLINE_STYLE = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
const EXECUTABLE_TYPES = new Set(['', 'text/javascript', 'module', 'application/javascript']);

const typeOf = (attributes) => (attributes.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? '').toLowerCase();

export function collectInlineScriptHashes(html) {
  const hashes = new Set();
  for (const [, attributes, body] of html.matchAll(INLINE_SCRIPT)) {
    if (!EXECUTABLE_TYPES.has(typeOf(attributes))) continue;
    hashes.add(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);
  }
  return [...hashes];
}

export const BEACON_HOST = 'static.cloudflareinsights.com';

export function collectInlineStyleHashes(html) {
  const hashes = new Set();
  for (const [, , body] of html.matchAll(INLINE_STYLE)) {
    hashes.add(`sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);
  }
  return [...hashes];
}

export function renderHeaders(scriptHashes, styleHashes = [], { analyticsBeacon = false } = {}) {
  const beacon = analyticsBeacon ? ['https://static.cloudflareinsights.com'] : [];
  const scriptSrc = ["'self'", ...beacon, ...scriptHashes.map((hash) => `'${hash}'`)].join(' ');
  const styleSrc = ["'self'", ...styleHashes.map((hash) => `'${hash}'`)].join(' ');
  const connectSrc = ["'self'", ...(analyticsBeacon ? ['https://cloudflareinsights.com'] : [])].join(' ');
  const policy = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `connect-src ${connectSrc}`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `style-src ${styleSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'none'`,
    `frame-ancestors 'none'`,
    'upgrade-insecure-requests',
  ].join('; ');

  return `/*
  Content-Security-Policy: ${policy}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  X-Frame-Options: DENY

/rss.xml
  X-Robots-Tag: noindex

/*/rss.xml
  X-Robots-Tag: noindex

/feed.json
  X-Robots-Tag: noindex

/llms.txt
  X-Robots-Tag: noindex

/llms-full.txt
  X-Robots-Tag: noindex

/search-index*
  X-Robots-Tag: noindex

/*.md
  X-Robots-Tag: noindex

https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/og/*
  Cache-Control: public, max-age=604800

/*.html
  Cache-Control: public, max-age=0, must-revalidate
`;
}

async function htmlFilesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

async function main(distDir) {
  const files = await htmlFilesIn(distDir);
  const scripts = new Set();
  const styles = new Set();
  let analyticsBeacon = false;
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    for (const hash of collectInlineScriptHashes(html)) scripts.add(hash);
    for (const hash of collectInlineStyleHashes(html)) styles.add(hash);
    if (html.includes(BEACON_HOST)) analyticsBeacon = true;
  }
  const sortedScripts = [...scripts].sort();
  const sortedStyles = [...styles].sort();
  await writeFile(join(distDir, '_headers'), renderHeaders(sortedScripts, sortedStyles, { analyticsBeacon }));
  console.log(
    `_headers written for ${files.length} pages, ${sortedScripts.length} inline script hash(es), ${sortedStyles.length} inline style hash(es)`
  );
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
