import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractGraphs, danglingIds, duplicateIds, missingTypes } from './jsonld-gate.mjs';

const page = (json) => `<html><head><script type="application/ld+json">${json}</script></head></html>`;

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
