import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

import { FEED_BASES } from './feeds.mjs';
import { lastmod } from './lastmod.mjs';

export async function collectionLastmods(dataDir) {
  const lastmods = {};
  for (const [kind, base] of Object.entries(FEED_BASES)) {
    const dir = join(dataDir, kind);
    const files = (await readdir(dir).catch(() => [])).filter((file) => /\.mdx?$/.test(file));
    for (const file of files) {
      const text = await readFile(join(dir, file), 'utf8');
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
      if (!frontmatter) continue;
      const modified = lastmod(yaml.load(frontmatter));
      if (modified) lastmods[`/${base}/${file.replace(/\.mdx?$/, '')}`] = modified;
    }
  }
  return lastmods;
}
