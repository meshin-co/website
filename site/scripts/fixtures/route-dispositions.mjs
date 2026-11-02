import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { recordFiles } from '../record-layout.mjs';

export const DISPOSITIONS = 'audits/phase-4.7/dispositions';
const LISTED_COLLECTIONS = { '/blog': 'post', '/glossary': 'glossary' };

export const digestOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);

export const listingDigest = (slugs) => digestOf(`listing:${[...slugs].sort().join('|')}`);

const slugsIn = (directory) =>
  existsSync(directory) ? readdirSync(directory).map((name) => name.replace(/\.md$/, '')) : [];

export function freshDigest(root, target) {
  const site = join(root, 'site');
  if (target === '/') return digestOf('home');
  if (Object.hasOwn(LISTED_COLLECTIONS, target))
    return listingDigest(slugsIn(join(site, 'src/data', LISTED_COLLECTIONS[target])));
  const page = /^\/(blog|glossary)\/(.+)$/.exec(target);
  const file = page ? join(site, 'src/data', LISTED_COLLECTIONS[`/${page[1]}`], `${page[2]}.md`) : join(site, target);
  if (!existsSync(file) || !(page || target.startsWith('src/'))) return null;
  return digestOf(`${page ? 'page:' : ''}${readFileSync(file, 'utf8')}`);
}

const rowOf = (target, status, reason, digest, location) => ({
  target,
  ...(location ? { location } : {}),
  status,
  reason,
  digest,
});

export function seedDispositions(root) {
  const blog = freshDigest(root, '/blog');
  const files = {
    'posts.json': [
      rowOf(
        'src/data/post/existing-post.md',
        'verified',
        'The post was re-read.',
        freshDigest(root, 'src/data/post/existing-post.md')
      ),
      rowOf('src/data/post/ghost.md', 'verified', 'The post carries no copy rows.', 'e3b0c44298fc'),
    ],
    'routes.json': [
      rowOf('/', 'verified', 'The home page was re-read.', freshDigest(root, '/')),
      rowOf('/blog', 'verified', 'The title was checked against the page.', blog, 'head.title'),
      rowOf('/blog', 'rewritten', 'The blog index was rewritten and re-read.', blog, 'body.p'),
      rowOf('/glossary', 'rewritten', 'The glossary index was rewritten and re-read.', freshDigest(root, '/glossary')),
    ],
  };
  mkdirSync(join(root, DISPOSITIONS), { recursive: true });
  return Object.entries(files).map(([name, rows]) => {
    writeFileSync(join(root, DISPOSITIONS, name), `${JSON.stringify(rows, null, 2)}\n`);
    return `${DISPOSITIONS}/${name}`;
  });
}

export function staleEntries(root) {
  return recordFiles(root, 'disposition')
    .map((path) => path.slice(DISPOSITIONS.length + 1))
    .flatMap((file) =>
      JSON.parse(readFileSync(join(root, DISPOSITIONS, file), 'utf8')).flatMap((entry, index) => {
        const fresh = freshDigest(root, entry.target);
        return fresh !== null && fresh !== entry.digest ? [{ file, index, target: entry.target, digest: fresh }] : [];
      })
    );
}
