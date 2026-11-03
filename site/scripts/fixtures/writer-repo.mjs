import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LENGTH_FILE, deriveLimits, lengthRecord, measureLength } from '../entry-length.mjs';
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

const filler = (count) =>
  Array.from({ length: count }, (_, index) => (index === count - 1 ? 'end.' : `w${index}`)).join(' ');
const sectioned = (counts) =>
  counts.map((count, index) => `## Question ${index + 1}?\n\n${filler(count)}\n`).join('\n');

const SMALL_CORPUS = [
  { collection: 'post', body: sectioned([40, 40, 40, 40]) },
  { collection: 'post', body: sectioned([60, 60, 60, 60, 60]) },
  { collection: 'glossary', body: sectioned([20, 40]) },
  { collection: 'glossary', body: sectioned([40, 40]) },
];

function smallLengthRecord() {
  const measure = measureLength(SMALL_CORPUS);
  return `${JSON.stringify(lengthRecord({ measure, limits: deriveLimits(measure), measuredOn: '2026-11-02' }), null, 2)}\n`;
}

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

export function makeRepo({ band = true, length = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'writer-repo-'));
  for (const path of ENGINE_FILES) copy(root, path);
  put(root, 'docs/SEMANTIC-CORE.md', CORE);
  put(root, REPO_FILES.routes, json(ROUTES));
  put(root, REPO_FILES.contentFacts, json(FACTS));
  put(root, REPO_FILES.tags, tagModule());
  if (band) put(root, BAND_FILE, json(BAND));
  if (length) put(root, LENGTH_FILE, length === true ? smallLengthRecord() : length);
  for (const [collection, slugs] of Object.entries(ENTRIES))
    for (const slug of slugs) put(root, `${REPO_FILES.collections[collection]}/${slug}.md`, '');
  return root;
}

export const removeRepo = (root) => rmSync(root, { recursive: true, force: true });
