import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { buildSearchIndex } from '../src/utils/search-index.mjs';
import { invokedDirectly } from './invoked-directly.mjs';
import { fillPageText } from './search-page-text.mjs';

const ENTRIES_FILE = 'search-entries.json';

async function readEntries(distDir) {
  const file = join(distDir, ENTRIES_FILE);

  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (cause) {
    throw new Error(`build-search-index: cannot read ${file}, run \`astro build\` first`, { cause });
  }
}

export async function writeSearchIndex(distDir) {
  const { entries } = await fillPageText(distDir, await readEntries(distDir));
  const { manifest, files } = buildSearchIndex(entries);

  for (const [urlPath, text] of files) {
    const target = join(distDir, urlPath.slice(1));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text);
  }
  await rm(join(distDir, ENTRIES_FILE));

  return { documents: manifest.documents, files: files.size, version: manifest.version };
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  const { documents, files, version } = await writeSearchIndex(process.argv[2] ?? 'dist');
  console.log(`search-index: ${documents} documents, ${files} files, version ${version}`);
}
