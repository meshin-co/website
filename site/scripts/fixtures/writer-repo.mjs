import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BAND_FILE } from '../sentence-band.mjs';

const REAL_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const COPIED = [
  'AGENTS.md',
  'docs/CONTENT-GATE.md',
  'docs/SEMANTIC-CORE.md',
  'audits/routes.json',
  'site/banned-phrases.json',
  'site/content-facts.json',
  'site/controlled-words.json',
  'site/src/content.config.ts',
  'site/src/data/tags.mjs',
  'site/.agents/skills/write-copy.md',
  'site/.agents/skills/write-for-humans.md',
  'site/.agents/skills/place-a-new-text.md',
  'site/.agents/skills/add-collection-entry.md',
];
const LISTED = ['site/src/data/post', 'site/src/data/glossary', 'site/src/data/resource'];

function copy(root, path) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  copyFileSync(join(REAL_ROOT, path), join(root, path));
}

export function makeRepo({ band = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'writer-repo-'));
  for (const path of band ? [...COPIED, BAND_FILE] : COPIED) copy(root, path);
  for (const directory of LISTED) {
    mkdirSync(join(root, directory), { recursive: true });
    for (const name of readdirSync(join(REAL_ROOT, directory))) writeFileSync(join(root, directory, name), '');
  }
  return root;
}

export const removeRepo = (root) => rmSync(root, { recursive: true, force: true });
