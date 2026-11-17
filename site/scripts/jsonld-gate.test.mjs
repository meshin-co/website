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
  unidentifiedNodes,
  GRAPH_EXEMPT,
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

test('every page of a paginated archive, in all three families, is required to carry the collection node', () => {
  for (const route of ['/blog/page/2', '/blog/category/governance/page/2', '/blog/tag/ai-governance/page/2']) {
    assert.deepEqual(requiredTypesFor(route), ['CollectionPage', 'BreadcrumbList'], route);
  }
});

test('a paginated archive route that is not page-number shaped matches no family and fails closed', () => {
  for (const route of ['/blog/tag/ai-governance/page', '/blog/tag/ai-governance/page/two', '/blog/tag/page/2']) {
    assert.equal(requiredTypesFor(route), undefined, route);
  }
});

test('a route matching no family yields no requirements instead of an empty pass', () => {
  assert.equal(requiredTypesFor('/blog/tags/extra'), undefined);
  assert.equal(requiredTypesFor('/speaking'), undefined);
  assert.equal(requiredTypesFor('/freshly-invented-route'), undefined);
});

test('a series page is required to carry the collection node and a version page the article node', () => {
  assert.deepEqual(requiredTypesFor('/spec/evals-baseline'), ['CollectionPage', 'BreadcrumbList']);
  assert.deepEqual(requiredTypesFor('/spec/evals-baseline/1.0'), ['TechArticle', 'BreadcrumbList']);
  assert.equal(requiredTypesFor('/spec'), undefined);
  assert.equal(requiredTypesFor('/spec/evals-baseline/1.0/extra'), undefined);
});

const ARTICLE_PROPERTIES =
  'url headline description datePublished dateModified version inLanguage image mainEntityOfPage author publisher license';
const VERSION_ID = 'https://x/spec/evals-baseline/1.0#spec';
const techArticle = () => ({
  '@type': 'TechArticle',
  '@id': VERSION_ID,
  ...Object.fromEntries(REQUIRED_PROPERTIES.TechArticle.map((prop) => [prop, 'x'])),
});

test('the article node of a version page is held to twelve properties, each reported by name when absent', () => {
  const missing = (node) => missingProperties([{ '@graph': [node] }], '/spec/evals-baseline/1.0');

  assert.deepEqual(REQUIRED_PROPERTIES.TechArticle, ARTICLE_PROPERTIES.split(' '));
  assert.deepEqual(missing(techArticle()), []);
  for (const prop of REQUIRED_PROPERTIES.TechArticle) {
    const node = Object.fromEntries(Object.entries(techArticle()).filter(([key]) => key !== prop));
    assert.deepEqual(missing(node), [`TechArticle node ${VERSION_ID} is missing required property ${prop}`], prop);
  }
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
  const dir = await withFixture({
    '/search': graphlessPage,
    '/now': page('{"@graph":[{"@type":"BreadcrumbList","@id":"https://x/now#breadcrumb","itemListElement":[]}]}'),
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

const breadcrumbNode = (id) => ({ '@type': 'BreadcrumbList', '@id': id, itemListElement: [] });
const graphPage = (...nodes) => page(JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }));
const validNow = graphPage(breadcrumbNode('https://x/now#breadcrumb'));

const runGate = async (pages) => {
  const dir = await withFixture(pages);
  const log = console.log;
  const error = console.error;
  const out = [];
  const err = [];
  console.log = (line) => out.push(line);
  console.error = (line) => err.push(line);
  process.exitCode = undefined;
  try {
    await main(dir);
    return { exitCode: process.exitCode, out, err };
  } finally {
    console.log = log;
    console.error = error;
    process.exitCode = undefined;
    await rm(dir, { recursive: true, force: true });
  }
};

test('script detection accepts double quotes, single quotes, no quotes, any attribute order and any case', () => {
  const variants = [
    '<script type="application/ld+json">{"@graph":[]}</script>',
    '<script type=\'application/ld+json\'>{"@graph":[]}</script>',
    '<script type=application/ld+json>{"@graph":[]}</script>',
    '<script id="a" type="application/ld+json" data-x="1">{"@graph":[]}</script>',
    '<script data-type="x" async type=application/ld+json defer>{"@graph":[]}</script>',
    '<SCRIPT TYPE="Application/LD+JSON">{"@graph":[]}</SCRIPT>',
    '<script type = "application/ld+json">{"@graph":[]}</script >',
    '<script\n  type="application/ld+json"\n>{"@graph":[]}</script>',
  ];
  for (const variant of variants) {
    assert.equal(extractGraphs(`<html>${variant}</html>`).length, 1, variant);
  }
});

test('script detection ignores scripts of another type', () => {
  const html =
    '<script type="module">1</script><script>2</script><script type="application/json">{}</script><script data-type="application/ld+json">3</script>';
  assert.equal(extractGraphs(html).length, 0);
});

test('a single-quoted or unquoted block that does not parse is still a failure', () => {
  assert.throws(() => extractGraphs("<script type='application/ld+json'>{</script>"), /parse/);
  assert.throws(() => extractGraphs('<script type=application/ld+json>{</script>'), /parse/);
});

test('every graph node whose id is missing, not a string or empty is reported by type', () => {
  const graphs = [
    {
      '@graph': [
        { '@type': 'BreadcrumbList' },
        { '@type': ['Person', 'Thing'], '@id': '' },
        { '@id': 7 },
        { '@type': 'WebSite', '@id': 'https://x/#website' },
      ],
    },
  ];
  assert.deepEqual(unidentifiedNodes(graphs), ['BreadcrumbList', 'Person|Thing', '(untyped)']);
});

test('a graph whose every node carries an id reports no unidentified node', () => {
  assert.deepEqual(unidentifiedNodes([{ '@graph': [{ '@type': 'WebSite', '@id': 'https://x/#website' }] }]), []);
});

test('a document without a graph array contributes no unidentified node', () => {
  assert.deepEqual(unidentifiedNodes([{ '@type': 'WebSite' }]), []);
});

test('the graph exemptions are exactly the error page, the search results and the styleguide, each with a reason', () => {
  assert.ok(GRAPH_EXEMPT instanceof Map);
  assert.deepEqual([...GRAPH_EXEMPT.keys()].sort(), ['/404', '/search', '/styleguide']);
  for (const reason of GRAPH_EXEMPT.values()) assert.ok(typeof reason === 'string' && reason.length > 0);
});

test('a page with one valid graph passes the gate', async () => {
  const { exitCode, err } = await runGate({ '/now': validNow });
  assert.deepEqual(err, []);
  assert.equal(exitCode, undefined);
});

test('a page with two ld+json scripts fails the gate naming the count', async () => {
  const second = '<script type="application/ld+json">{"@graph":[]}</script>';
  const { exitCode, err } = await runGate({ '/now': validNow.replace('</head>', `${second}</head>`) });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /now carries 2 ld+json scripts, expected one'), err.join('\n'));
});

test('a second script holding a uniquely identified node fails on the count alone', async () => {
  const second = `<script type="application/ld+json">${JSON.stringify({
    '@graph': [breadcrumbNode('https://x/now#second')],
  })}</script>`;
  const { exitCode, err } = await runGate({ '/now': validNow.replace('</head>', `${second}</head>`) });
  assert.equal(exitCode, 1);
  assert.deepEqual(err, ['JSONLD /now carries 2 ld+json scripts, expected one']);
});

test('a page whose only ld+json document is a bare node carries no graph', async () => {
  const bare = page(JSON.stringify(breadcrumbNode('https://x/now#breadcrumb')));
  const { exitCode, err } = await runGate({ '/now': bare });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /now carries no ld+json graph'), err.join('\n'));
});

test('a graph node with no id fails the gate naming its type', async () => {
  const { exitCode, err } = await runGate({
    '/now': graphPage(breadcrumbNode('https://x/now#breadcrumb'), { '@type': 'BreadcrumbList', itemListElement: [] }),
  });
  assert.equal(exitCode, 1);
  assert.deepEqual(err, ['JSONLD /now has a BreadcrumbList node with no @id']);
});

test('a graph node with an empty id fails the gate', async () => {
  const { exitCode, err } = await runGate({ '/now': graphPage({ ...breadcrumbNode(''), '@id': '' }) });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /now has a BreadcrumbList node with no @id'), err.join('\n'));
});

test('an untyped graph node with no id is labelled untyped', async () => {
  const { exitCode, err } = await runGate({ '/now': graphPage(breadcrumbNode('https://x/now#breadcrumb'), {}) });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /now has a (untyped) node with no @id'), err.join('\n'));
});

test('a duplicate id fails the gate', async () => {
  const { exitCode, err } = await runGate({
    '/now': graphPage(breadcrumbNode('https://x/now#breadcrumb'), breadcrumbNode('https://x/now#breadcrumb')),
  });
  assert.equal(exitCode, 1);
  assert.deepEqual(err, ['JSONLD /now declares https://x/now#breadcrumb twice']);
});

test('a reference that resolves nowhere fails the gate', async () => {
  const { exitCode, err } = await runGate({
    '/now': graphPage(breadcrumbNode('https://x/now#breadcrumb'), {
      '@type': 'WebSite',
      '@id': 'https://x/#website',
      publisher: { '@id': 'https://x/#org' },
    }),
  });
  assert.equal(exitCode, 1);
  assert.deepEqual(err, ['JSONLD /now references undeclared https://x/#org']);
});

test('a graph-less route outside the exceptions fails the gate', async () => {
  const { exitCode, err } = await runGate({ '/now': graphlessPage, '/about': graphlessPage });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /now carries no ld+json graph'), err.join('\n'));
  assert.ok(err.includes('JSONLD /about carries no ld+json graph'), err.join('\n'));
});

test('every graph-less exempt route passes beside a valid page', async () => {
  const { exitCode, err } = await runGate({
    '/now': validNow,
    '/404': graphlessPage,
    '/search': graphlessPage,
    '/styleguide': graphlessPage,
  });
  assert.deepEqual(err, []);
  assert.equal(exitCode, undefined);
});

test('an exempt route whose graph repeats an id still fails the gate', async () => {
  const { exitCode, err } = await runGate({
    '/now': validNow,
    '/search': graphPage(breadcrumbNode('https://x/search#breadcrumb'), breadcrumbNode('https://x/search#breadcrumb')),
  });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /search declares https://x/search#breadcrumb twice'), err.join('\n'));
});

test('an exempt route carrying two scripts or an unidentified node fails the gate', async () => {
  const second = '<script type="application/ld+json">{"@graph":[]}</script>';
  const { exitCode, err } = await runGate({
    '/now': validNow,
    '/404': graphPage({ '@type': 'BreadcrumbList', itemListElement: [] }).replace('</head>', `${second}</head>`),
  });
  assert.equal(exitCode, 1);
  assert.ok(err.includes('JSONLD /404 carries 2 ld+json scripts, expected one'), err.join('\n'));
  assert.ok(err.includes('JSONLD /404 has a BreadcrumbList node with no @id'), err.join('\n'));
});

test('an exempt route with a graph is not asked for a route family or required types', async () => {
  const { exitCode, err } = await runGate({
    '/now': validNow,
    '/search': graphPage(breadcrumbNode('https://x/search#breadcrumb')),
  });
  assert.deepEqual(err, []);
  assert.equal(exitCode, undefined);
});

test('an empty dist fails because nothing was read', async () => {
  const { exitCode, err, out } = await runGate({});
  assert.equal(exitCode, 1);
  assert.deepEqual(err, ['JSONLD no route carried a graph, so nothing was checked']);
  assert.deepEqual(out, ['jsonld: 0 of 0 routes carry a graph, 0 scripts and 0 nodes read, 0 exempt']);
});

test('a dist holding only exempt graph-less routes fails because nothing was read', async () => {
  const { exitCode, err } = await runGate({ '/404': graphlessPage, '/search': graphlessPage });
  assert.equal(exitCode, 1);
  assert.deepEqual(err, ['JSONLD no route carried a graph, so nothing was checked']);
});

test('the summary line counts routes with a graph, scripts, nodes and the exempt routes present', async () => {
  const { out } = await runGate({
    '/now': validNow,
    '/404': graphlessPage,
    '/search': graphlessPage,
  });
  assert.deepEqual(out, ['jsonld: 1 of 3 routes carry a graph, 1 scripts and 1 nodes read, 2 exempt (/404, /search)']);
});

test('the summary line prints a bare zero when no exempt route is in the dist', async () => {
  const { out } = await runGate({
    '/now': validNow,
    '/approach': graphPage(breadcrumbNode('https://x/approach#breadcrumb'), {
      '@type': 'WebSite',
      '@id': 'https://x/#website',
    }),
  });
  assert.deepEqual(out, ['jsonld: 2 of 2 routes carry a graph, 2 scripts and 3 nodes read, 0 exempt']);
});

const specBreadcrumb = (route) => breadcrumbNode(`https://x${route}#breadcrumb`);
const seriesGraph = graphPage(
  {
    '@type': 'CollectionPage',
    '@id': 'https://x/spec/evals-baseline#page',
    url: 'https://x/spec/evals-baseline',
    name: 'evals-baseline specification',
    isPartOf: { '@id': 'https://x/#website' },
  },
  { '@type': 'WebSite', '@id': 'https://x/#website' },
  specBreadcrumb('/spec/evals-baseline')
);
const versionGraph = () => graphPage(techArticle(), specBreadcrumb('/spec/evals-baseline/1.0'));

test('a series page and a version page that satisfy their families pass the gate', async () => {
  const { exitCode, err, out } = await runGate({
    '/spec/evals-baseline': seriesGraph,
    '/spec/evals-baseline/1.0': versionGraph(),
  });

  assert.deepEqual(err, []);
  assert.equal(exitCode, undefined);
  assert.deepEqual(out, ['jsonld: 2 of 2 routes carry a graph, 2 scripts and 5 nodes read, 0 exempt']);
});

test('a series page without its collection node and a version page without its article node fail the gate', async () => {
  const { exitCode, err } = await runGate({
    '/spec/evals-baseline': graphPage(specBreadcrumb('/spec/evals-baseline')),
    '/spec/evals-baseline/1.0': graphPage(specBreadcrumb('/spec/evals-baseline/1.0')),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(err, [
    'JSONLD /spec/evals-baseline has no CollectionPage node',
    'JSONLD /spec/evals-baseline/1.0 has no TechArticle node',
  ]);
});
