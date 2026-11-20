import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { neighbourPosts, relatedPosts } from '../src/utils/post-neighbors.mjs';

const SITE_DIR = fileURLToPath(new URL('..', import.meta.url));

const COLLECTION_JSON_LD =
  '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":"Hub"}]}</script>';

const CATEGORY_HUB = '/blog/category/governance';

const link = (href) => `<a href="${href}">link</a>`;

const page = ({ head = '', main = '' }) =>
  `<!doctype html><html><head><title>t</title>${head}</head><body><header>${link('/blog')}</header><main>${main}</main><footer>${link('/')}</footer></body></html>`;

const entry = (index) => ({
  id: `post-${String(index).padStart(2, '0')}`,
  data: { publishDate: new Date(Date.UTC(2026, 9, index + 1)) },
});

const categoryOf = (size) => Array.from({ length: size }, (_, index) => entry(index));

const hub = (posts) =>
  page({
    head: COLLECTION_JSON_LD,
    main: `<ul>${posts.map(({ id }) => `<li>${link(`/blog/${id}`)}</li>`).join('')}</ul>`,
  });

const postPage = (posts, { id }) => {
  const { previous, next } = neighbourPosts(posts, id);
  const breadcrumb = `<nav aria-label="Breadcrumb">${link('/blog')}${link(CATEGORY_HUB)}</nav>`;
  const neighbours = [previous, next]
    .filter(Boolean)
    .map((other) => link(`/blog/${other.id}`))
    .join('');
  const related = relatedPosts(posts, id)
    .map((other) => `<article><h3>${link(`/blog/${other.id}`)}</h3></article>`)
    .join('');
  return page({
    main: `${breadcrumb}<article><nav aria-label="More in this category">${neighbours}</nav>${related}</article>`,
  });
};

const siteOf = (posts) => ({
  'index.html': page({ main: `<p>${link('/blog')}</p>` }),
  'blog.html': hub(posts),
  [`${CATEGORY_HUB.slice(1)}.html`]: hub(posts),
  ...Object.fromEntries(posts.map((post) => [`blog/${post.id}.html`, postPage(posts, post)])),
});

const runGate = async (files) => {
  const dist = await mkdtemp(join(tmpdir(), 'related-block-'));
  try {
    for (const [name, html] of Object.entries(files)) {
      await mkdir(dirname(join(dist, name)), { recursive: true });
      await writeFile(join(dist, name), html);
    }
    return spawnSync('node', ['scripts/orphan-gate.mjs', dist], { cwd: SITE_DIR, encoding: 'utf8' });
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
};

const stranded = (run) =>
  [...run.stdout.matchAll(/^ {2}(\/blog\/post-\d+) is linked only from/gm)].map(([, route]) => route);

test('publishing the ninth post into a category strands no older one', async () => {
  const run = await runGate(siteOf(categoryOf(9)));

  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /chrome-only: 0 of 9 routes that must earn a body link/);
});

test('publishing the tenth post strands the oldest, and the gate names it and only it', async () => {
  const run = await runGate(siteOf(categoryOf(10)));

  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.deepEqual(stranded(run), ['/blog/post-00']);
});

test('every post beyond the nine newest of a category is named', async () => {
  const run = await runGate(siteOf(categoryOf(12)));

  assert.deepEqual(stranded(run).sort(), ['/blog/post-00', '/blog/post-01', '/blog/post-02']);
});

test('a category of two leaves nothing for the gate to name, each post linking the other from its block', async () => {
  const run = await runGate(siteOf(categoryOf(2)));

  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /chrome-only: 0 of 2 routes that must earn a body link/);
});

test('a category of one has no block to appear in, so its only post is named', async () => {
  const run = await runGate(siteOf(categoryOf(1)));

  assert.deepEqual(stranded(run), ['/blog/post-00']);
});
