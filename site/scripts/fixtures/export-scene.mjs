import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { SCENE_FILES, sceneReader } from './partition-scene.mjs';

export function writeScene(root, { extra = {}, without = [], bytes = {} } = {}) {
  const read = sceneReader(extra);
  const files = [...new Set([...SCENE_FILES, ...Object.keys(extra)])].filter((file) => !without.includes(file));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), bytes[file] ?? read(file));
  }
  return files;
}
