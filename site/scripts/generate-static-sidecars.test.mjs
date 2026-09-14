import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSidecar, classifyPage } from './generate-static-sidecars.mjs';

const PAGE = { path: '/about', title: 'About Dmitri Meshin', description: 'A description.' };

const HTML = `<!doctype html><html><head><title>x</title></head><body>
<header><nav>chrome</nav></header>
<main id="main">
<nav aria-label="Breadcrumb"><ol><li>Home</li></ol></nav>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>
<style>.eyebrow { color: red; }</style>
<h1>Dmitri Meshin</h1>
<p>I'm Dmitri Meshin, a platform engineer by trade.</p>
<p>My work is getting one AI system into production.</p>
</main>
<footer>footer chrome</footer>
</body></html>`;

test('buildSidecar carries the page title, description and canonical url', () => {
  const sidecar = buildSidecar({ page: PAGE, html: HTML, updatedIso: '2026-09-05T00:00:00.000Z' });

  assert.match(sidecar, /^# About Dmitri Meshin\n/);
  assert.match(sidecar, /^> A description\.$/m);
  assert.match(sidecar, /^Source: https:\/\/meshin\.co\/about$/m);
  assert.match(sidecar, /^Updated: 2026-09-05$/m);
});

test('buildSidecar derives the body from the rendered main content, not the header or footer chrome', () => {
  const sidecar = buildSidecar({ page: PAGE, html: HTML, updatedIso: '2026-09-05T00:00:00.000Z' });

  assert.match(sidecar, /I'm Dmitri Meshin, a platform engineer by trade\./);
  assert.match(sidecar, /My work is getting one AI system into production\./);
  assert.ok(!sidecar.includes('chrome'), 'header/footer chrome leaked into the sidecar body');
});

test('buildSidecar drops the breadcrumb nav text out of the extracted body', () => {
  const sidecar = buildSidecar({ page: PAGE, html: HTML, updatedIso: '2026-09-05T00:00:00.000Z' });
  assert.ok(!sidecar.includes('Home'), 'breadcrumb nav text leaked into the sidecar body');
});

test('buildSidecar never leaks a sibling JSON-LD script or inline style block into the sidecar body', () => {
  const sidecar = buildSidecar({ page: PAGE, html: HTML, updatedIso: '2026-09-05T00:00:00.000Z' });
  assert.ok(!sidecar.includes('BreadcrumbList'), 'JSON-LD script content leaked into the sidecar body');
  assert.ok(!sidecar.includes('color: red'), 'inline style content leaked into the sidecar body');
});

test('buildSidecar refuses to render a stub page whose route has no lastmod, rather than defaulting to build time', () => {
  assert.throws(() => buildSidecar({ page: PAGE, html: HTML, updatedIso: null }), /no lastmod for \/about/);
});

test('classifyPage writes a sidecar when both html and a lastmod are available', () => {
  const result = classifyPage({ page: PAGE, html: HTML, updatedIso: '2026-09-05T00:00:00.000Z' });
  assert.equal(result.status, 'written');
  assert.match(result.sidecar, /^# About Dmitri Meshin\n/);
});

test('classifyPage skips a page with no lastmod instead of throwing, so one gitless route never crashes the whole postbuild run', () => {
  const result = classifyPage({ page: PAGE, html: HTML, updatedIso: null });
  assert.deepEqual(result, { status: 'skipped-no-lastmod', path: '/about' });
});

test('classifyPage reports missing built html distinctly from a missing lastmod', () => {
  const result = classifyPage({ page: PAGE, html: null, updatedIso: '2026-09-05T00:00:00.000Z' });
  assert.deepEqual(result, { status: 'missing-html', path: '/about' });
});

test('classifyPage checks html before lastmod, so a page missing both is reported as missing-html', () => {
  const result = classifyPage({ page: PAGE, html: null, updatedIso: null });
  assert.equal(result.status, 'missing-html');
});
