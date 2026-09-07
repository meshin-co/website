import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
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

export function renderHeaders(scriptHashes) {
  const scriptSrc = ["'self'", 'https://plausible.io', ...scriptHashes.map((hash) => `'${hash}'`)].join(' ');
  const policy = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `connect-src 'self' https://plausible.io`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `style-src 'self'`,
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
  const hashes = new Set();
  for (const file of files) {
    for (const hash of collectInlineScriptHashes(await readFile(file, 'utf8'))) hashes.add(hash);
  }
  const sorted = [...hashes].sort();
  await writeFile(join(distDir, '_headers'), renderHeaders(sorted));
  console.log(`_headers written for ${files.length} pages, ${sorted.length} inline script hash(es)`);
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2] ?? 'dist');
}
