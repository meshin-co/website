import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LENGTH_FILE, deriveLimits, lengthRecord, measureLength } from '../entry-length.mjs';
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

export function makeRepo({ band = true, length = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'writer-repo-'));
  for (const path of band ? [...COPIED, BAND_FILE] : COPIED) copy(root, path);
  if (length) {
    mkdirSync(dirname(join(root, LENGTH_FILE)), { recursive: true });
    writeFileSync(join(root, LENGTH_FILE), length === true ? smallLengthRecord() : length);
  }
  for (const directory of LISTED) {
    mkdirSync(join(root, directory), { recursive: true });
    for (const name of readdirSync(join(REAL_ROOT, directory))) writeFileSync(join(root, directory, name), '');
  }
  return root;
}

export const removeRepo = (root) => rmSync(root, { recursive: true, force: true });
