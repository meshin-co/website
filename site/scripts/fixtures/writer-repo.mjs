import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BAND_FILE } from '../sentence-band.mjs';
import { REPO_FILES } from '../writer-tree.mjs';
import { BAND, CORE, ENTRIES, FACTS, ROUTES, TAGS } from './writer-corpus.mjs';

const REAL_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ENGINE_FILES = [
  'AGENTS.md',
  'docs/CONTENT-GATE.md',
  REPO_FILES.bannedPhrases,
  REPO_FILES.controlledWords,
  'site/src/content.config.ts',
  'site/.agents/skills/write-copy.md',
  'site/.agents/skills/write-for-humans.md',
  'site/.agents/skills/place-a-new-text.md',
  'site/.agents/skills/add-collection-entry.md',
];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const tagModule = () =>
  `export const TAGS = [\n${TAGS.map((slug) => `  { slug: '${slug}', name: '${slug}' },`).join('\n')}\n];\n`;

function copy(root, path) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  copyFileSync(join(REAL_ROOT, path), join(root, path));
}

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

export function makeRepo({ band = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'writer-repo-'));
  for (const path of ENGINE_FILES) copy(root, path);
  put(root, 'docs/SEMANTIC-CORE.md', CORE);
  put(root, REPO_FILES.routes, json(ROUTES));
  put(root, REPO_FILES.contentFacts, json(FACTS));
  put(root, REPO_FILES.tags, tagModule());
  if (band) put(root, BAND_FILE, json(BAND));
  for (const [collection, slugs] of Object.entries(ENTRIES))
    for (const slug of slugs) put(root, `${REPO_FILES.collections[collection]}/${slug}.md`, '');
  return root;
}

export const removeRepo = (root) => rmSync(root, { recursive: true, force: true });
