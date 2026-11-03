import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { addTargetQuery } from './route-derive.mjs';
import { WriterError } from './writer-error.mjs';

const FACTS = `{
  "targetQuery": {
    "/": "fractional chief ai officer",
    "/glossary": "ai governance glossary",
    "/faq": "questions",
    "/glossary/alpha": "alpha",
    "/glossary/charlie": "charlie",
    "/glossary/echo": "echo",
    "/blog/zulu": "zulu question",
    "/blog/bravo": "bravo question",
    "/blog/tags": "tag pages",
    "/imprint": "imprint"
  },
  "numbers": [
    "30"
  ]
}
`;

const rowsOf = (text) => Object.entries(JSON.parse(text).targetQuery);
const withoutLine = (text, needle) =>
  text
    .split('\n')
    .filter((line) => !line.includes(needle))
    .join('\n');

test('a glossary row goes into its sorted place among the glossary rows', () => {
  const text = addTargetQuery(FACTS, '/glossary/delta', 'delta');

  assert.deepEqual(
    rowsOf(text).map(([route]) => route),
    [
      '/',
      '/glossary',
      '/faq',
      '/glossary/alpha',
      '/glossary/charlie',
      '/glossary/delta',
      '/glossary/echo',
      '/blog/zulu',
      '/blog/bravo',
      '/blog/tags',
      '/imprint',
    ]
  );
  assert.equal(JSON.parse(text).targetQuery['/glossary/delta'], 'delta');
});

test('a row that sorts before and after every sibling goes first or last among them', () => {
  const first = rowsOf(addTargetQuery(FACTS, '/glossary/aardvark', 'aardvark')).map(([route]) => route);
  const last = rowsOf(addTargetQuery(FACTS, '/glossary/zebra', 'zebra')).map(([route]) => route);

  assert.equal(first[first.indexOf('/glossary/alpha') - 1], '/glossary/aardvark');
  assert.equal(last[last.indexOf('/glossary/echo') + 1], '/glossary/zebra');
});

test('among rows that are not sorted, the new one goes after the last sibling', () => {
  const routes = rowsOf(addTargetQuery(FACTS, '/blog/alpha-post', 'alpha post')).map(([route]) => route);

  assert.equal(routes[routes.indexOf('/blog/tags') + 1], '/blog/alpha-post');
});

test('a row with no sibling goes at the end of the object, and the old last row gets its comma', () => {
  const text = addTargetQuery(FACTS, '/resources/kit', 'kit');
  const lines = text.split('\n');

  assert.equal(lines[lines.indexOf('    "/imprint": "imprint",') + 1], '    "/resources/kit": "kit"');
  assert.equal(rowsOf(text).at(-1)[0], '/resources/kit');
});

test('everything else in the file is byte for byte what it was', () => {
  for (const [route, query] of [
    ['/glossary/delta', 'delta'],
    ['/glossary/zebra', 'zebra'],
    ['/blog/alpha-post', 'alpha post'],
  ]) {
    const line = `    ${JSON.stringify(route)}: ${JSON.stringify(query)},`;
    const text = addTargetQuery(FACTS, route, query);

    assert.equal(withoutLine(text, line), withoutLine(FACTS, line), route);
    assert.equal(text.split('\n').length, FACTS.split('\n').length + 1);
  }
  const atEnd = addTargetQuery(FACTS, '/resources/kit', 'kit');
  assert.equal(atEnd.replace('    "/resources/kit": "kit"\n', '').replace('"imprint",', '"imprint"'), FACTS);
});

test('characters JSON escapes are escaped, and the file still parses to the old rows plus one', () => {
  const text = addTargetQuery(FACTS, '/glossary/quote', 'what is "quoted", café and a \\ backslash?');
  const before = JSON.parse(FACTS).targetQuery;
  const after = JSON.parse(text).targetQuery;

  assert.equal(after['/glossary/quote'], 'what is "quoted", café and a \\ backslash?');
  assert.deepEqual({ ...after, '/glossary/quote': undefined }, { ...before, '/glossary/quote': undefined });
  assert.deepEqual(JSON.parse(text).numbers, ['30']);
});

test('a route that already has a row is refused, naming the route', () => {
  assert.throws(
    () => addTargetQuery(FACTS, '/glossary/alpha', 'a different query'),
    (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes('/glossary/alpha')
  );
});

test('a query that is already the target of another route is refused, naming that route', () => {
  assert.throws(
    () => addTargetQuery(FACTS, '/glossary/delta', 'charlie'),
    (error) => error instanceof WriterError && error.kind === 'build' && error.message.includes('/glossary/charlie')
  );
});

test('a file whose targetQuery object is not laid out one row per line is refused', () => {
  for (const text of [
    '{ "targetQuery": { "/a": "a" } }\n',
    '{\n  "numbers": []\n}\n',
    FACTS.replace('    "/glossary/alpha": "alpha",', '    "/glossary/alpha": "alpha", "/x": "x",'),
    FACTS.replace('    "/glossary/alpha": "alpha",', '    // note\n    "/glossary/alpha": "alpha",'),
  ])
    assert.throws(
      () => addTargetQuery(text, '/glossary/delta', 'delta'),
      (error) => error instanceof WriterError && error.kind === 'build'
    );
});

const REAL_FACTS = readFileSync(fileURLToPath(new URL('../content-facts.json', import.meta.url)), 'utf8');

test('on the real file one line is added in the family it belongs to and nothing else moves', () => {
  for (const [route, query] of [
    ['/glossary/model-registry', 'model registry'],
    ['/blog/how-to-write-an-ai-incident-runbook', 'ai incident runbook'],
  ]) {
    const line = `    ${JSON.stringify(route)}: ${JSON.stringify(query)},`;
    const text = addTargetQuery(REAL_FACTS, route, query);
    const routes = rowsOf(text).map(([name]) => name);
    const at = routes.indexOf(route);

    assert.equal(withoutLine(text, line), withoutLine(REAL_FACTS, line), route);
    assert.deepEqual(JSON.parse(text).numbers, JSON.parse(REAL_FACTS).numbers);
    assert.equal(routes.length, Object.keys(JSON.parse(REAL_FACTS).targetQuery).length + 1);
    assert.ok(
      routes[at - 1].startsWith(`/${route.split('/')[1]}/`) || routes[at + 1].startsWith(`/${route.split('/')[1]}/`),
      route
    );
  }
});

test('on the real file a new term lands between the terms that sort around it', () => {
  const route = '/glossary/model-registry';
  const termsOf = (text) => rowsOf(text).flatMap(([name]) => (name.startsWith('/glossary/') ? [name] : []));
  const before = termsOf(REAL_FACTS);
  const after = termsOf(addTargetQuery(REAL_FACTS, route, 'model registry'));
  const at = after.indexOf(route);

  assert.ok(at >= 0, route);
  assert.deepEqual(
    after.slice(0, at),
    before.filter((name) => name < route)
  );
  assert.deepEqual(
    after.slice(at + 1),
    before.filter((name) => name > route)
  );
});

test('a route and a query the real file already holds are both refused', () => {
  const [route, query] = Object.entries(JSON.parse(REAL_FACTS).targetQuery).find(([name]) =>
    name.startsWith('/glossary/')
  );

  assert.throws(() => addTargetQuery(REAL_FACTS, route, 'a new query'), WriterError);
  assert.throws(() => addTargetQuery(REAL_FACTS, '/glossary/brand-new', query), WriterError);
});
