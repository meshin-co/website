import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import {
  extractGraphs,
  danglingIds,
  duplicateIds,
  missingTypes,
  missingProperties,
  requiredTypesFor,
  REQUIRED_PROPERTIES,
  main,
} from './jsonld-gate.mjs';

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

test("a node missing one of its type's required properties is reported by id and property name", () => {
  const graphs = extractGraphs(page('{"@graph":[{"@type":"Organization","@id":"https://x/#org","name":"X"}]}'));
  const failures = missingProperties(graphs, '/');
  assert.ok(failures.some((failure) => failure.includes('https://x/#org') && failure.includes('logo')));
  assert.ok(!failures.some((failure) => failure.includes('name')));
});

test('a node satisfying every required property of its type reports nothing', () => {
  const graphs = extractGraphs(
    page(
      JSON.stringify({
        '@graph': [
          {
            '@type': 'DefinedTermSet',
            '@id': 'x',
            ...Object.fromEntries(REQUIRED_PROPERTIES.DefinedTermSet.map((prop) => [prop, 'x'])),
          },
        ],
      })
    )
  );
  assert.deepEqual(missingProperties(graphs, '/'), []);
});

test('a required type absent from REQUIRED_PROPERTIES fails the property gate closed', () => {
  const graphs = extractGraphs(page('{"@graph":[{"@type":"NeverDefined","@id":"x"}]}'));
  assert.deepEqual(missingProperties(graphs, '/'), ['NeverDefined matches no known jsonld property family']);
});

test('a union type checks the properties of whichever variant is actually present', () => {
  const graphs = extractGraphs(page('{"@graph":[{"@type":"SoftwareSourceCode","@id":"x","name":"N"}]}'));
  const failures = missingProperties(graphs, '/');
  assert.ok(failures.some((failure) => failure.includes('codeRepository')));
  assert.ok(!failures.some((failure) => failure.startsWith('CreativeWork ')));
});

test('a required type absent from the graph reports no property failures, since missingTypes already reports the absence', () => {
  const graphs = extractGraphs(page('{"@graph":[]}'));
  assert.deepEqual(missingProperties(graphs, '/'), []);
});

test('a route of a known family is required to carry that family node', () => {
  assert.deepEqual(requiredTypesFor('/blog/category/governance'), ['CollectionPage', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/blog/why-pilots-stall'), ['BlogPosting', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/faq/what-is-ai-governance'), ['FAQPage', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/blog/tag/ai-governance'), ['CollectionPage', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/privacy'), ['BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/'), ['Organization', 'Person', 'WebSite']);
});

test('a route matching no family yields no requirements instead of an empty pass', () => {
  assert.equal(requiredTypesFor('/blog/tags/extra'), undefined);
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
    const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), html);
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

test('a route with the right type present but a missing required property fails the gate closed', async () => {
  const dir = await withFixture({
    '/blog/tag/governance': page(
      '{"@graph":[{"@type":"CollectionPage","@id":"https://x/blog/tag/governance#page","isPartOf":{"@id":"https://x/#website"}},{"@type":"WebSite","@id":"https://x/#website"},{"@type":"BreadcrumbList","@id":"https://x/blog/tag/governance#breadcrumbs","itemListElement":[]}]}'
    ),
  });
  try {
    process.exitCode = undefined;
    let logged = '';
    const error = console.error;
    console.error = (line) => {
      logged += line;
    };
    const log = console.log;
    console.log = () => {};
    try {
      await main(dir);
    } finally {
      console.error = error;
      console.log = log;
    }
    assert.equal(process.exitCode, 1);
    assert.match(logged, /CollectionPage node .* is missing required property name/);
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

test('a page satisfying its family requirements, including property completeness, passes the gate', async () => {
  const graph = {
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': 'https://x/about#page',
        url: 'https://x/about',
        name: 'About',
        mainEntity: { '@id': 'https://x/#person' },
        isPartOf: { '@id': 'https://x/#website' },
      },
      {
        '@type': 'Person',
        '@id': 'https://x/#person',
        name: 'Dmitri Meshin',
        jobTitle: 'Fractional Chief AI Officer',
        url: 'https://x/about',
        worksFor: { '@id': 'https://x/#org' },
        sameAs: ['https://example.com/in/x'],
        knowsAbout: ['AI governance'],
      },
      { '@type': 'WebSite', '@id': 'https://x/#website' },
      { '@type': 'Organization', '@id': 'https://x/#org' },
      { '@type': 'BreadcrumbList', '@id': 'https://x/about#breadcrumbs', itemListElement: [] },
    ],
  };
  const dir = await withFixture({ '/about': page(JSON.stringify(graph)) });
  try {
    process.exitCode = undefined;
    await quiet(() => main(dir));
    assert.equal(process.exitCode, undefined);
  } finally {
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
});

test('a node whose id points at another page keeps its reference shape, because only the defining page carries the floor', () => {
  const graphs = extractGraphs(
    page('{"@graph":[{"@type":"DefinedTerm","@id":"https://x/glossary/term#term","name":"T"}]}')
  );
  assert.deepEqual(missingProperties(graphs, '/services/retainer'), []);
  assert.ok(missingProperties(graphs, '/glossary/term').length > 0);
});

test('a companion node no route declares still carries a floor, because WebPage had none', () => {
  const graphs = extractGraphs(
    page('{"@graph":[{"@type":"WebPage","@id":"https://x/terms#webpage","url":"u","name":"n"}]}')
  );
  const failures = missingProperties(graphs, '/terms');
  assert.ok(failures.some((failure) => failure.includes('dateModified')));
});
