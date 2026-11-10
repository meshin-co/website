import assert from 'node:assert/strict';
import { test } from 'node:test';

import { titleSuffix } from '../../src/utils/brand.mjs';
import { GENERATED_BEGIN, GENERATED_END, generatedTitles } from '../autowriter-claims.mjs';
import { docDriftFindings, parseBuyerPrompts, renderFamilies } from '../semantic-core.mjs';
import { siteBrand } from '../site-brand.mjs';
import { readPromptSources } from '../topic-core.mjs';
import { readConceptRegister } from '../topic-owners.mjs';
import { SCENE_CORE, SCENE_PROMPTS, SCENE_ROWS, sceneCore } from './semantic-core-scene.mjs';

const SUFFIX = titleSuffix(siteBrand());
const termRoutes = (rows) => rows.filter(({ family }) => family === 'term').map(({ route }) => route);

test('the generated layer is what the generator writes for the rows, so it cannot be a hand-typed lookalike', () => {
  assert.deepEqual(docDriftFindings(SCENE_CORE, renderFamilies(SCENE_ROWS)), []);
});

test('the generated layer gives one title per row in every family it names, each ending in the title suffix of the site', () => {
  const titles = generatedTitles(SCENE_CORE);
  assert.deepEqual(
    titles.map(({ family, route }) => [family, route]),
    SCENE_ROWS.map(({ family, route }) => [family, route])
  );
  assert.ok(titles.every(({ title }) => title.endsWith(SUFFIX)));
  assert.equal(new Set(titles.map(({ title }) => title)).size, titles.length);
  assert.ok(titles.some(({ family }) => family === 'term'));
});

test('the two markers of the generated layer appear once each, so a reader finds exactly one layer', () => {
  assert.equal(SCENE_CORE.split(GENERATED_BEGIN).length, 2);
  assert.equal(SCENE_CORE.split(GENERATED_END).length, 2);
});

test('the concept register holds one concept per term row, defined by the route of that row', () => {
  assert.deepEqual(
    readConceptRegister(SCENE_CORE).map(({ route }) => route),
    termRoutes(SCENE_ROWS)
  );
});

test('the buyer prompts parse with routes that must win, and every route they name is a row of the layer', () => {
  const rows = new Set(SCENE_ROWS.map(({ route }) => route));
  const prompts = parseBuyerPrompts(SCENE_CORE);
  assert.deepEqual(
    prompts.map(({ number }) => number),
    SCENE_PROMPTS.map(({ number }) => number)
  );
  for (const { mustWinRoutes, passages } of prompts) {
    assert.ok(mustWinRoutes.length > 0 && mustWinRoutes.every((route) => rows.has(route)));
    assert.ok(passages.length > 0 && passages.every(({ route }) => rows.has(route)));
  }
  const sources = readPromptSources(SCENE_CORE);
  assert.deepEqual(
    [...sources.keys()],
    SCENE_PROMPTS.map(({ number }) => number)
  );
  assert.ok([...sources.values()].every(({ retired }) => retired === false));
});

test('other rows regenerate the layer and the registers, and leave the buyer prompts of the document as they were', () => {
  const [, ...kept] = SCENE_ROWS;
  const smaller = sceneCore({ rows: kept });
  assert.deepEqual(
    generatedTitles(smaller).map(({ route }) => route),
    kept.map(({ route }) => route)
  );
  assert.deepEqual(
    readConceptRegister(smaller).map(({ route }) => route),
    termRoutes(kept)
  );
  assert.deepEqual(parseBuyerPrompts(smaller), parseBuyerPrompts(SCENE_CORE));
});
