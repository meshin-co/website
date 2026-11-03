import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MANIFEST_PATH, freezeCorpus } from '../src/utils/visual-corpus.mjs';
import { invokedDirectly } from './invoked-directly.mjs';

export const manifestText = (frozen) => `${JSON.stringify(frozen, null, 2)}\n`;

export function main(root = process.cwd()) {
  const frozen = freezeCorpus(resolve(root, 'src/data'));
  writeFileSync(resolve(root, MANIFEST_PATH), manifestText(frozen));
  const collections = Object.keys(frozen).length;
  const entries = Object.values(frozen).reduce((total, names) => total + names.length, 0);
  console.log(`visual corpus: pinned ${entries} entries in ${collections} collections in ${MANIFEST_PATH}`);
}

if (invokedDirectly(import.meta.filename, process.argv[1])) main();
