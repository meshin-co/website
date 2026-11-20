import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const SCORECARD = 'ai-readiness-scorecard-five-drivers';

const HUB_JSON_LD =
  '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":"Hub"}]}</script>';
const NOINDEX = '<meta name="robots" content="noindex, follow">';

const link = (href) => `<a href="${href}">${href}</a>`;

const page = ({ head = '', main = '' } = {}) =>
  `<!doctype html><html><head><title>t</title>${head}</head><body><header></header><main>${main}</main><footer></footer></body></html>`;

const listing = (routes) => `<ul>${routes.map((route) => `<li>${link(route)}</li>`).join('')}</ul>`;

const keepReading = (route) => `<nav aria-label="More in this category">${link(route)}</nav>`;

export function builtSiteWithAStrandedPost(slug = SCORECARD) {
  const stranded = `/blog/${slug}`;
  const posts = ['/blog/board-memo', '/blog/quarterly-report'];
  const hubs = ['/blog/category/executive', '/blog/tag/ai-governance', '/blog/tag/ai-pilots'];

  return {
    'index.html': page({ main: `<p>${link('/blog')} and ${link(posts[0])}.</p>` }),
    'blog.html': page({ head: HUB_JSON_LD, main: listing([...hubs, '/blog/page/2', ...posts, stranded]) }),
    ...Object.fromEntries(
      hubs.map((hub) => [`${hub.slice(1)}.html`, page({ head: HUB_JSON_LD, main: listing([...posts, stranded]) })])
    ),
    'blog/page/2.html': page({ head: HUB_JSON_LD + NOINDEX, main: listing([stranded]) }),
    'blog/board-memo.html': page({ main: `<p>Read ${link(posts[1])}.</p>${keepReading(stranded)}` }),
    'blog/quarterly-report.html': page({ main: `<p>Read ${link(posts[0])}.</p>${keepReading(stranded)}` }),
    [`blog/${slug}.html`]: page({ main: `<p>Read ${link(posts[0])}.</p>` }),
  };
}

export const withALonelyPage = (files) => ({ ...files, 'lonely.html': page({ main: '<p>Nobody links here.</p>' }) });

export const withABodyLinkTo = (files, route) => ({
  ...files,
  'blog/quarterly-report.html': page({ main: `<p>Read ${link('/blog/board-memo')} and ${link(route)}.</p>` }),
});

export function writeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'orphan-scene-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return { root, remove: () => rmSync(root, { recursive: true, force: true }) };
}
