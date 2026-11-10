import assert from 'node:assert/strict';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { SCENE_CORE } from './fixtures/semantic-core-scene.mjs';
import { buildKeywords, expandPhrases, readRouteFacts, servedBy, termTitles } from './keyword-demand-rows.mjs';
import { siteBrand } from './site-brand.mjs';
import { readConceptRegister } from './topic-owners.mjs';

const SUFFIX = ' — example.test';

const coreWith = (...tables) => ['# Core', '', ...tables].join('\n');
const familyTable = (rows) =>
  [
    '| Route | Query | Title | Description | H1 |',
    '| ----- | ----- | ----- | ----------- | -- |',
    ...rows.map(([route, query, title]) => `| \`${route}\` | ${query} | ${title} | d | h |`),
    '',
  ].join('\n');

test('every route of every family table is read with its query and its title, and the site name is cut from the title', () => {
  const core = coreWith(
    '### static (1)',
    familyTable([['/', 'example query', `Example page${SUFFIX}`]]),
    '### term (2)',
    familyTable([
      ['/glossary/shadow-ai', 'shadow ai', `What is shadow AI?${SUFFIX}`],
      ['/glossary/dpia', 'dpia', `What is a DPIA?${SUFFIX}`],
    ])
  );

  assert.deepEqual(readRouteFacts(core, SUFFIX), [
    { route: '/', query: 'example query', title: 'Example page' },
    { route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' },
    { route: '/glossary/dpia', query: 'dpia', title: 'What is a DPIA?' },
  ]);
});

test('a table without a route, a query and a title column is not a family table, and a title without the suffix stays whole', () => {
  const other = ['| Route | Why |', '| ----- | --- |', '| `/404` | error page |', ''].join('\n');
  const core = coreWith(other, familyTable([['/about', 'about', 'About us']]));

  assert.deepEqual(readRouteFacts(core, SUFFIX), [{ route: '/about', query: 'about', title: 'About us' }]);
  assert.deepEqual(readRouteFacts('no table here', SUFFIX), []);
  assert.deepEqual(readRouteFacts(undefined, SUFFIX), []);
});

test('the glossary titles are those of the routes under its prefix, so the glossary index is not one', () => {
  const routes = [
    { route: '/glossary', query: 'glossary', title: 'Glossary' },
    { route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' },
    { route: '/blog/shadow-ai-policy', query: 'shadow ai policy', title: 'A shadow AI policy' },
  ];

  assert.deepEqual(termTitles(routes, '/glossary/'), ['What is shadow AI?']);
});

const CONCEPTS = ['Shadow AI', 'DPIA'];
const TITLES = ['What is shadow AI?', 'What is a DPIA?'];

test('a concept shape is filled once per concept and a title shape once per title, shape by shape', () => {
  const phrases = expandPhrases({
    concepts: CONCEPTS,
    titles: TITLES,
    templates: ['{concept} policy', '{title}', 'best {concept}'],
  });

  assert.deepEqual(phrases, [
    'shadow ai policy',
    'dpia policy',
    'what is shadow ai',
    'what is a dpia',
    'best shadow ai',
    'best dpia',
  ]);
});

test('a phrase is written in lower case, without a question mark and with single spaces', () => {
  const phrases = expandPhrases({
    concepts: ['  Retrieval   Augmented\tGeneration? '],
    titles: [],
    templates: ['What is {concept}?'],
  });

  assert.deepEqual(phrases, ['what is retrieval augmented generation']);
});

test('a phrase that two shapes build is priced once, where it first appeared', () => {
  const phrases = expandPhrases({ concepts: CONCEPTS, titles: TITLES, templates: ['{title}', 'what is {concept}'] });

  assert.deepEqual(phrases, ['what is shadow ai', 'what is a dpia', 'what is dpia']);
});

test('a phrase made only of function words is dropped, because every route would count as serving it', () => {
  const phrases = expandPhrases({ concepts: ['Is it', 'DPIA'], titles: [], templates: ['what is {concept}'] });

  assert.deepEqual(phrases, ['what is dpia']);
});

test('a shape whose source is empty builds nothing, and no template builds nothing from nothing', () => {
  assert.deepEqual(expandPhrases({ concepts: CONCEPTS, titles: [], templates: ['{title}'] }), []);
  assert.deepEqual(expandPhrases({ concepts: CONCEPTS, titles: TITLES, templates: [] }), []);
});

test('a subject that holds a replacement pattern is written as it is', () => {
  assert.deepEqual(expandPhrases({ concepts: ['cost $& per $1 seat'], titles: [], templates: ['{concept}'] }), [
    'cost $& per $1 seat',
  ]);
});

const ROUTES = [
  { route: '/glossary/shadow-ai', query: 'shadow ai', title: 'What is shadow AI?' },
  { route: '/blog/staff-rules', query: 'rules for staff', title: 'Using chatbots at work' },
  { route: '/about', query: 'about the author', title: 'About' },
];

test('a route serves a phrase when its query holds every word of the phrase, function words set aside', () => {
  assert.deepEqual(servedBy('what is shadow ai', ROUTES), ['/glossary/shadow-ai']);
  assert.deepEqual(servedBy('rules staff', ROUTES), ['/blog/staff-rules']);
  assert.deepEqual(servedBy('about author', ROUTES), ['/about']);
});

test('a route serves a phrase when its title holds every word, though its query does not', () => {
  assert.deepEqual(servedBy('chatbots at work', ROUTES), ['/blog/staff-rules']);
});

test('a longer phrase is not served by a shorter query, so a templated phrase can be a candidate', () => {
  const onlyTheGlossary = ROUTES.slice(0, 1);

  assert.deepEqual(servedBy('shadow ai policy', onlyTheGlossary), []);
  assert.deepEqual(servedBy('shadow ai examples', onlyTheGlossary), []);
});

test('the words must all stand in the query or all in the title, never split between the two', () => {
  const split = [{ route: '/split', query: 'shadow ai', title: 'Governance basics' }];

  assert.deepEqual(servedBy('shadow governance', split), []);
});

test('a phrase with no word beyond the function words is served by no route', () => {
  assert.deepEqual(servedBy('what is it', ROUTES), []);
  assert.deepEqual(servedBy('', ROUTES), []);
});

test('the routes that serve a phrase are listed once each, in alphabetical order', () => {
  const routes = [
    { route: '/b', query: 'shadow ai', title: 'Shadow AI' },
    { route: '/a', query: 'shadow ai', title: 'Shadow AI' },
    { route: '/b', query: 'shadow ai', title: 'Shadow AI again' },
  ];

  assert.deepEqual(servedBy('shadow ai', routes), ['/a', '/b']);
});

const week = (day, exact, broad) => ({ day, exact, broad });
const MARKET = { country: 'us', language: 'en-US' };
const buildFrom = (stats, routes = ROUTES) => buildKeywords({ measured: '2026-11-08', market: MARKET, stats, routes });

test('each phrase adds up its weekly counts, counts its weeks, names the routes that serve it and carries the day of the run', () => {
  const { phrases } = buildFrom([
    { phrase: 'what is shadow ai', weeks: [week('2026-10-24', 10, 30), week('2026-10-31', 5, 6)] },
  ]);

  assert.deepEqual(phrases, [
    {
      phrase: 'what is shadow ai',
      exact: 15,
      broad: 36,
      weeks: 2,
      measured: '2026-11-08',
      servedBy: ['/glossary/shadow-ai'],
    },
  ]);
});

test('phrases are ordered by exact impressions, then broad impressions, then text', () => {
  const { phrases } = buildFrom([
    { phrase: 'b', weeks: [week('2026-10-31', 5, 1)] },
    { phrase: 'a', weeks: [week('2026-10-31', 5, 1)] },
    { phrase: 'c', weeks: [week('2026-10-31', 5, 9)] },
    { phrase: 'd', weeks: [week('2026-10-31', 50, 0)] },
    { phrase: 'e', weeks: [] },
  ]);

  assert.deepEqual(
    phrases.map(({ phrase }) => phrase),
    ['d', 'c', 'a', 'b', 'e']
  );
});

test('a phrase Bing holds no data for keeps its row with zero counts and zero weeks', () => {
  const { phrases } = buildFrom([{ phrase: 'unheard of phrase', weeks: [] }]);

  assert.deepEqual(phrases, [
    { phrase: 'unheard of phrase', exact: 0, broad: 0, weeks: 0, measured: '2026-11-08', servedBy: [] },
  ]);
});

test('the window runs from the first to the last week any phrase returned, and the market and date pass through', () => {
  const { window, market } = buildFrom([
    { phrase: 'a', weeks: [week('2026-10-24', 1, 1), week('2026-10-31', 1, 1)] },
    { phrase: 'b', weeks: [week('2026-06-06', 1, 1)] },
    { phrase: 'c', weeks: [] },
  ]);

  assert.deepEqual(window, { measured: '2026-11-08', startDate: '2026-06-06', endDate: '2026-10-31' });
  assert.deepEqual(market, MARKET);
});

test('a measurement that returned no week at all has no window dates, rather than invented ones', () => {
  const { window } = buildFrom([{ phrase: 'a', weeks: [] }]);

  assert.deepEqual(window, { measured: '2026-11-08', startDate: null, endDate: null });
});

test('a candidate has an exact impression and no route serving it, and keeps the order of the phrase table', () => {
  const { candidates } = buildFrom([
    { phrase: 'what is shadow ai', weeks: [week('2026-10-31', 900, 900)] },
    { phrase: 'shadow ai examples', weeks: [week('2026-10-31', 40, 80)] },
    { phrase: 'shadow ai risks', weeks: [week('2026-10-31', 70, 70)] },
    { phrase: 'shadow ai checklist', weeks: [week('2026-10-31', 0, 25)] },
    { phrase: 'shadow ai template', weeks: [] },
    { phrase: 'chatbots at work', weeks: [week('2026-10-31', 12, 12)] },
  ]);

  assert.deepEqual(candidates, [
    { phrase: 'shadow ai risks', exact: 70, broad: 70 },
    { phrase: 'shadow ai examples', exact: 40, broad: 80 },
  ]);
});

test('the register, routes and shapes of a core build a list of distinct phrases, and no glossary title keeps the site name', () => {
  const suffix = titleSuffix(siteBrand());
  const { keywords, content } = readEngineConfig();
  const routes = readRouteFacts(SCENE_CORE, suffix);
  const titles = termTitles(routes, content.formats.term.routePrefix);
  const concepts = readConceptRegister(SCENE_CORE).map(({ concept }) => concept);
  const phrases = expandPhrases({ concepts, titles, templates: keywords.templates });

  assert.ok(routes.length > 0, `${routes.length} routes`);
  assert.ok(titles.length > 0 && concepts.length > 0);
  assert.ok(
    titles.every((title) => !title.endsWith(suffix)),
    titles.join(' | ')
  );
  assert.equal(new Set(phrases).size, phrases.length);
  assert.ok(phrases.every((phrase) => phrase === phrase.toLowerCase().trim() && !phrase.includes('?')));
  assert.ok(phrases.length >= concepts.length);
});
