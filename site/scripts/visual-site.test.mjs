import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { VISUAL_DIST, VISUAL_ORIGIN, VISUAL_PORT, visualTemplates } from './visual-site.mjs';

function distWith(files) {
  const dist = mkdtempSync(join(tmpdir(), 'visual-site-'));
  for (const file of files) {
    mkdirSync(join(dist, file, '..'), { recursive: true });
    writeFileSync(join(dist, file), '<!doctype html>');
  }
  return dist;
}

test('the visual site is its own build folder on its own origin, named once for the config and the spec', () => {
  assert.equal(VISUAL_DIST, 'dist-visual');
  assert.equal(VISUAL_ORIGIN, `http://127.0.0.1:${VISUAL_PORT}`);
});

test('it picks the first route in sort order of every template from the visual build', async () => {
  const dist = distWith([
    'index.html',
    'about.html',
    'blog.html',
    'blog/b-post.html',
    'blog/a-post.html',
    'glossary/evals.html',
  ]);

  assert.deepEqual(await visualTemplates(dist), ['/', '/about', '/blog', '/blog/a-post', '/glossary/evals']);
});

test('a build folder that is not there fails naming the folder and the command that builds it', async () => {
  const missing = join(tmpdir(), 'visual-site-never-built');

  await assert.rejects(
    () => visualTemplates(missing),
    new RegExp(`${missing} is missing; run npm run build:visual, or npm run gate:visual, which builds it first`)
  );
});

test('a build folder with no page fails, because zero screenshots would read as a pass', async () => {
  const dist = distWith(['_astro/site.css', 'robots.txt']);

  await assert.rejects(() => visualTemplates(dist), /holds no page, so no template would be screenshotted/);
});

test('a route is read from the build it names, so a second page in the live build changes nothing', async () => {
  const visual = distWith(['index.html', 'blog/a-post.html']);
  distWith(['index.html', 'blog/0-live-only.html']);

  assert.deepEqual(await visualTemplates(visual), ['/', '/blog/a-post']);
});
