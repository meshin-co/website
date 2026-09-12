import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { extractGraphs, danglingIds, duplicateIds, missingTypes, requiredTypesFor, main } from './jsonld-gate.mjs';

const page = (json) => `<html><head><script type="application/ld+json">${json}</script></head></html>`;
const graphlessPage = '<html><head><title>x</title></head></html>';

test('every ld+json block on a page is extracted and parsed', () => {
  const html = page('{"@graph":[{"@id":"a"}]}').replace(
    '</head>',
    '<script type="application/ld+json">{"@graph":[]}</script></head>'
  );

  assert.equal(extractGraphs(html).length, 2);
});

test('an unparseable ld+json block is a failure, not a skipped block', () => {
  assert.throws(() => extractGraphs(page('{"@graph":[')), /parse/);
});

test('a reference to an id no node declares is reported', () => {
  const graphs = extractGraphs(
    page('{"@graph":[{"@type":"Person","@id":"https://x/#person","worksFor":{"@id":"https://x/#org"}}]}')
  );

  assert.deepEqual(danglingIds(graphs), ['https://x/#org']);
});

test('a graph whose references all resolve reports nothing', () => {
  const graphs = extractGraphs(
    page(
      '{"@graph":[{"@type":"Person","@id":"https://x/#person","worksFor":{"@id":"https://x/#org"}},{"@type":"Organization","@id":"https://x/#org"}]}'
    )
  );

  assert.deepEqual(danglingIds(graphs), []);
});

test('a page missing a type its route requires is reported', () => {
  const graphs = extractGraphs(page('{"@graph":[{"@type":"Organization","@id":"https://x/#org"}]}'));

  assert.deepEqual(missingTypes(graphs, ['Organization', 'BreadcrumbList']), ['BreadcrumbList']);
});

test('two nodes declaring the same id are reported', () => {
  const graphs = extractGraphs(
    page('{"@graph":[{"@type":"Person","@id":"https://x/#person"},{"@type":"Person","@id":"https://x/#person"}]}')
  );

  assert.deepEqual(danglingIds(graphs), []);
  assert.deepEqual(duplicateIds(graphs), ['https://x/#person']);
});

test('a route of a known family is required to carry that family node', () => {
  assert.deepEqual(requiredTypesFor('/blog/category/governance'), ['CollectionPage', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/blog/why-pilots-stall'), ['BlogPosting', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/faq/what-is-ai-governance'), ['FAQPage', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/privacy'), ['BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/'), ['Organization', 'Person', 'WebSite']);
});

test('a route matching no family yields no requirements instead of an empty pass', () => {
  assert.equal(requiredTypesFor('/blog/tag/governance'), undefined);
  assert.equal(requiredTypesFor('/speaking'), undefined);
  assert.equal(requiredTypesFor('/freshly-invented-route'), undefined);
});

const quiet = async (run) => {
  const log = console.log;
  const error = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    await run();
  } finally {
    console.log = log;
    console.error = error;
  }
};

const withFixture = async (pages) => {
  const dir = await mkdtemp(join(tmpdir(), 'jsonld-gate-'));
  for (const [route, html] of Object.entries(pages)) {
    await mkdir(join(dir, route === '/' ? '' : route), { recursive: true });
    await writeFile(join(dir, route === '/' ? 'index.html' : `${route}/index.html`), html);
  }
  return dir;
};

test('a route matching no known pattern fails the gate closed', async () => {
  const dir = await withFixture({
    '/blog/tag/governance': page('{"@graph":[{"@type":"CollectionPage","@id":"https://x/blog/tag/governance#page"}]}'),
  });
  try {
    process.exitCode = undefined;
    await quiet(() => main(dir));
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
});

test('a page outside the exempt set carrying no graph fails the gate', async () => {
  const dir = await withFixture({ '/now': graphlessPage });
  try {
    process.exitCode = undefined;
    await quiet(() => main(dir));
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
});

test('an exempt utility route without a graph passes the gate', async () => {
  const dir = await withFixture({ '/search': graphlessPage });
  try {
    process.exitCode = undefined;
    await quiet(() => main(dir));
    assert.equal(process.exitCode, undefined);
  } finally {
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
});

test('a page satisfying its family requirements passes the gate', async () => {
  const dir = await withFixture({
    '/about': page(
      '{"@graph":[{"@type":"ProfilePage","@id":"https://x/about#page","mainEntity":{"@id":"https://x/#person"}},{"@type":"Person","@id":"https://x/#person"},{"@type":"BreadcrumbList","@id":"https://x/about#breadcrumbs"}]}'
    ),
  });
  try {
    process.exitCode = undefined;
    await quiet(() => main(dir));
    assert.equal(process.exitCode, undefined);
  } finally {
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
});
