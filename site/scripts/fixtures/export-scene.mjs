import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENE_FILES, SCENE_TEXT, sceneReader } from './partition-scene.mjs';

const CONFIG_PATH = 'site/engine.config.json';
const WRITE_DAILY = '.github/workflows/write-daily.yml';
const REAL_CONFIG = join(fileURLToPath(import.meta.url), '..', '..', '..', 'engine.config.json');

function exportableConfig() {
  const real = JSON.parse(readFileSync(REAL_CONFIG, 'utf8').replaceAll('example', 'sample'));
  const scene = JSON.parse(SCENE_TEXT[CONFIG_PATH]);
  return JSON.stringify({
    ...real,
    diff: { ...real.diff, ...scene.diff },
    content: { ...real.content, ...scene.content },
  });
}

const SCHEDULED_WORKFLOW = "name: Write daily\non:\n  schedule:\n    - cron: '59 5 * * *'\n  workflow_dispatch:\n";

export function writeScene(root, { extra = {}, without = [], bytes = {} } = {}) {
  const read = sceneReader({ [CONFIG_PATH]: exportableConfig(), [WRITE_DAILY]: SCHEDULED_WORKFLOW, ...extra });
  const files = [...new Set([...SCENE_FILES, ...Object.keys(extra)])].filter((file) => !without.includes(file));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), bytes[file] ?? read(file));
  }
  return files;
}
