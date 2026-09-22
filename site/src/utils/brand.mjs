import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readBrand(configSource) {
  const name = /^\s{2}name:\s*(.+)$/m.exec(configSource)?.[1]?.trim();
  if (!name) throw new Error('site config declares no site.name; every title suffix derives from it');
  return { name };
}

export function titleSuffix(brand) {
  return ` — ${brand.name}`;
}

export function brandFromDisk(configPath = resolve(process.cwd(), 'src/config.yaml')) {
  return readBrand(readFileSync(configPath, 'utf8'));
}
