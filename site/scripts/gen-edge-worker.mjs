import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

import { invokedDirectly } from './invoked-directly.mjs';

const HANDLER = new URL('./markdown-negotiation.mjs', import.meta.url);

export async function writeEdgeHandler(distDir) {
  const target = join(distDir, '_worker.js');
  await copyFile(HANDLER, target);
  return target;
}

if (invokedDirectly(import.meta.filename, process.argv[1])) {
  const target = await writeEdgeHandler(process.argv[2] ?? 'dist');
  console.log(`edge: ${target}`);
}
