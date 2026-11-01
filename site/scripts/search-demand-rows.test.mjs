import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildDemand, routeOf, sameDemand } from './search-demand-rows.mjs';

const {
  window: WINDOW,
  property: PROPERTY,
  prompts: PROMPTS,
  ...DATA
} = JSON.parse(readFileSync(new URL('./search-demand.fixture.json', import.meta.url), 'utf8'));

const build = (data = DATA) => buildDemand({ window: WINDOW, property: PROPERTY, prompts: PROMPTS, data });
const EMPTY = { totals: undefined, queries: [], pages: [], days: [], pairs: [] };

const ABSENT = {
  impressions: undefined,
  position: undefined,
  carriedBy: undefined,
  prompts: undefined,
  pages: undefined,
};
const rowFor = (rows, key, value) => rows.find((entry) => entry[key] === value) ?? ABSENT;
const promptRow = (built, number) => rowFor(built.prompts, 'number', number);
const pageRow = (built, route) => rowFor(built.pages, 'route', route);
const queryRow = (built, text) => rowFor(built.queries, 'query', text);

test('a route is the path of the page, whatever the scheme, host or trailing slash', () => {
  assert.equal(routeOf('https://meshin.co/'), '/');
  assert.equal(routeOf('http://meshin.co/'), '/');
  assert.equal(routeOf('https://meshin.co/about/'), '/about');
  assert.equal(routeOf('https://www.meshin.co/faq?utm_source=x#top'), '/faq');
});

test('a query and a prompt are the same demand when one is inside the other, at any length', () => {
  assert.equal(sameDemand('eu ai act', 'EU AI Act obligations for deployers small business'), true);
  assert.equal(
    sameDemand('ai governance starter kit open source github', 'AI governance starter kit open source'),
    true
  );
});

test('function words and punctuation do not keep a query apart from its prompt', () => {
  const prompt = 'who is a fractional chief AI officer for a 100-person SaaS company';

  assert.equal(sameDemand('what is a fractional chief ai officer', prompt), true);
  assert.equal(sameDemand('eu-ai-act:', 'EU AI Act obligations for deployers small business'), true);
});

test('a query that shares only some of the words of a prompt is another demand', () => {
  assert.equal(sameDemand('ai management system', 'how to build an AI system register'), false);
  assert.equal(sameDemand('meshin', 'who is a fractional chief AI officer for a 100-person SaaS company'), false);
  assert.equal(sameDemand('"fractional chief ai officer" remote', 'fractional AI leader Europe remote'), false);
});

test('a text made only of function words, or of nothing, is the same demand as nothing', () => {
  assert.equal(sameDemand('', 'EU AI Act'), false);
  assert.equal(sameDemand('the', 'the'), false);
});

test('a query on its topic that landed on a route of the prompt proves the prompt, with position weighted', () => {
  const eight = promptRow(build(), 8);

  assert.equal(eight.impressions, 47);
  assert.equal(eight.position?.toFixed(1), '77.4');
  assert.deepEqual(eight.carriedBy, ['/glossary/eu-ai-act']);
});

test('a support route counts, because the core names it as part of the answer', () => {
  const register = promptRow(build(), 6);

  assert.equal(register.impressions, 1);
  assert.equal(register.position, 91);
  assert.deepEqual(register.carriedBy, ['/glossary/ai-register']);
});

test('a brand-term impression on the must-win route does not prove the prompt that route must win', () => {
  const built = build();

  assert.equal(pageRow(built, '/').impressions, 4);
  assert.equal(promptRow(built, 1).impressions, 0);
});

test('the right query on a page the core does not assign to the prompt does not prove it', () => {
  assert.equal(promptRow(build(), 4).impressions, 0);
});

test('a page that carried an impression for a withheld query proves nothing', () => {
  const built = build();

  assert.equal(pageRow(built, '/pricing').impressions, 1);
  assert.equal(promptRow(built, 26).impressions, 0);
});

test('a prompt whose core entry names no route cannot be proven', () => {
  assert.equal(promptRow(build(), 17).impressions, 0);
});

test('every prompt keeps its row, in the order the core lists it', () => {
  assert.deepEqual(
    build().prompts.map((entry) => entry.number),
    [1, 4, 6, 8, 17, 26]
  );
});

test('each query names the routes that carried it and the prompts it proves, and none when no prompt is proven', () => {
  const built = build();

  assert.deepEqual(queryRow(built, 'eu ai act').pages, ['/glossary/eu-ai-act']);
  assert.deepEqual(queryRow(built, 'eu ai act').prompts, [8]);
  assert.deepEqual(queryRow(built, 'ai register').prompts, [6]);
  assert.deepEqual(queryRow(built, 'ai management system').prompts, []);
  assert.deepEqual(queryRow(built, 'meshin').prompts, []);
});

test('queries are ordered by impressions, then clicks, then text', () => {
  assert.deepEqual(
    build()
      .queries.slice(0, 5)
      .map((entry) => entry.query),
    ['eu ai act', 'ai act eu', 'ai management system', 'ai act', '"fractional chief ai officer" remote']
  );
});

test('the scheme variants of one route are one page row, with position weighted by impressions', () => {
  const built = build();

  assert.equal(pageRow(built, '/').impressions, 4);
  assert.equal(pageRow(built, '/').position, 3);
  assert.equal(built.pages.filter((page) => page.route === '/').length, 1);
  assert.equal(built.pageImpressions, 86);
});

test('days without an impression are not rows, and the first day is the first with an impression', () => {
  const built = build();

  assert.equal(built.days.length, 10);
  assert.equal(built.firstDay, '2026-10-19');
  assert.deepEqual(built.busiestDay, { day: '2026-10-20', impressions: 16 });
});

test('the impressions Search Console withholds are the total less the queries it names', () => {
  assert.equal(build().withheld, 12);
});

test('the totals keep what the API measured, with the position of the whole property', () => {
  assert.equal(build().totals.impressions, 77);
  assert.equal(build().totals.clicks, 0);
  assert.equal(build().totals.position?.toFixed(1), '67.7');
});

test('a window with no rows has zero totals and no position, rather than a position of zero', () => {
  const empty = build(EMPTY);
  const zeros = build({ ...EMPTY, totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 } });

  for (const built of [empty, zeros]) {
    assert.equal(built.totals.impressions, 0);
    assert.equal(built.totals.position, null);
    assert.equal(built.firstDay, null);
    assert.ok(built.prompts.every((entry) => entry.impressions === 0));
  }
});
