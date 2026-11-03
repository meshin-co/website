import { existsSync } from 'node:fs';

import { discoverRoutes } from './gate.mjs';
import { templateRoutes } from './templates.mjs';

export const VISUAL_DIST = 'dist-visual';
export const VISUAL_PORT = 4323;
export const VISUAL_ORIGIN = `http://127.0.0.1:${VISUAL_PORT}`;

export async function visualTemplates(distDir = VISUAL_DIST) {
  if (!existsSync(distDir)) {
    throw new Error(`${distDir} is missing; run npm run build:visual, or npm run gate:visual, which builds it first`);
  }
  const templates = templateRoutes(await discoverRoutes(distDir));
  if (templates.length === 0) throw new Error(`${distDir} holds no page, so no template would be screenshotted`);
  return templates;
}
