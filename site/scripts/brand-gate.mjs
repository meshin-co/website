import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { brandFromDisk } from '../src/utils/brand.mjs';

const GATED_ROOTS = ['src', 'scripts'];
const GATED_EXTENSIONS = new Set(['.astro', '.ts', '.mjs']);
const EXCLUDED_DIR_PREFIXES = ['src/data/'];
const TEST_FILE = /\.test\.mjs$/;

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function brandLiteralPattern(brandName) {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(brandName)}(?![a-z0-9]|\\.[a-z])`, 'gi');
}

export function findBrandLiterals(content, pattern) {
  return content
    .split('\n')
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter(({ text }) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });
}

export function isGatedFile(posixPath) {
  if (TEST_FILE.test(posixPath)) return false;
  if (!GATED_EXTENSIONS.has(`.${posixPath.split('.').pop()}`)) return false;
  return !EXCLUDED_DIR_PREFIXES.some((prefix) => posixPath.startsWith(prefix));
}

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      })
    : [];

export function discoverGatedFiles(siteRoot) {
  return GATED_ROOTS.flatMap((root) => walk(join(siteRoot, root)))
    .filter((path) => GATED_EXTENSIONS.has(extname(path)))
    .map((path) => relative(siteRoot, path).split(sep).join('/'))
    .filter(isGatedFile)
    .sort();
}

async function main(siteRootArg) {
  const siteRoot = siteRootArg ? resolve(siteRootArg) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const brand = brandFromDisk(join(siteRoot, 'src/config.yaml'));
  const pattern = brandLiteralPattern(brand.name);
  const files = discoverGatedFiles(siteRoot);

  const findings = files.flatMap((file) =>
    findBrandLiterals(readFileSync(join(siteRoot, file), 'utf8'), pattern).map((hit) => ({ file, ...hit }))
  );

  for (const finding of findings) console.error(`${finding.file}:${finding.line} ${finding.text}`);
  console.log(
    findings.length === 0
      ? `brand: ${files.length} files scanned, 0 typed literals of the configured brand name`
      : `brand: ${files.length} files scanned, ${findings.length} typed literals of the configured brand name`
  );
  if (findings.length > 0) process.exitCode = 1;
}

if (import.meta.filename === process.argv[1]) {
  await main(process.argv[2]);
}
