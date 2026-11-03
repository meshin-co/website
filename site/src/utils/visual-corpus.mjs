import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const VISUAL_MODE = 'visual';
export const MANIFEST_PATH = 'src/data/visual-corpus.json';

const LIVE_PATTERN = ['*.md', '*.mdx'];
const ENTRY_FILE = /\.mdx?$/;
const REFREEZE = 'run npm run assets:visual-corpus';

const entryFilesIn = (directory) =>
  existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => ENTRY_FILE.test(name))
        .sort()
    : [];

export function freezeCorpus(dataDirectory) {
  const folders = readdirSync(dataDirectory, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort();
  return Object.fromEntries(folders.map((folder) => [folder, entryFilesIn(resolve(dataDirectory, folder))]));
}

export function readManifest(root = process.cwd()) {
  const path = resolve(root, MANIFEST_PATH);
  if (!existsSync(path)) throw new Error(`visual corpus: ${MANIFEST_PATH} is missing; ${REFREEZE}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function collectionPattern(collection, { mode = 'production', root = process.cwd() } = {}) {
  if (mode !== VISUAL_MODE) return LIVE_PATTERN;
  const present = entryFilesIn(resolve(root, 'src/data', collection));
  const manifest = readManifest(root);
  if (!(collection in manifest)) {
    if (present.length === 0) return [];
    throw new Error(
      `visual corpus: ${collection} has ${present.length} entries in src/data/${collection} and the manifest does not list the collection; ${REFREEZE}`
    );
  }
  const gone = manifest[collection].filter((name) => !present.includes(name));
  if (gone.length > 0) {
    const verb = gone.length === 1 ? 'is' : 'are';
    throw new Error(
      `visual corpus: ${collection} pins ${gone.join(', ')}, which ${verb} no longer in src/data/${collection}; ${REFREEZE} to freeze the corpus again`
    );
  }
  return manifest[collection];
}
