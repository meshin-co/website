import assert from 'node:assert/strict';
import { test } from 'node:test';

import { partitionReport, summaryLine } from './engine-partition-gate.mjs';
import { SCENE_FILES, sceneReader } from './fixtures/partition-scene.mjs';

const report = (overrides = {}, files = SCENE_FILES) => partitionReport({ files, read: sceneReader(overrides) });
const rulesOf = ({ findings }) => findings.map(({ rule }) => rule);
const without = (...paths) => SCENE_FILES.filter((file) => !paths.includes(file));
const plus = (...paths) => [...SCENE_FILES, ...paths];

test('a scene where every file fits a rule, no engine file names the site and every anchor is served has no finding', () => {
  const found = report();
  assert.deepEqual(found.findings, []);
  assert.equal(found.counts.engine + found.counts.site + found.counts.evidence, SCENE_FILES.length);
});

test('a file that fits no rule is a finding that names it and says what to decide', () => {
  const found = report({}, plus('mystery.bin'));
  assert.deepEqual(rulesOf(found), ['unclassified']);
  assert.equal(found.findings[0].where, 'mystery.bin');
  assert.match(found.findings[0].detail, /engine, site or evidence/);
});

test('an engine file that names the brand outside the config is a finding that names the term', () => {
  const found = report({ 'site/scripts/measure-sentence-band.mjs': "const origin = 'https://example.test';\n" });
  assert.deepEqual(rulesOf(found), ['site-bound']);
  assert.equal(found.findings[0].where, 'site/scripts/measure-sentence-band.mjs');
  assert.match(found.findings[0].detail, /example\.test/);
});

test('the author name is as binding as the brand, and a term shorter than four letters binds nothing', () => {
  const found = report({ 'site/.agents/skills/run-the-gate.md': 'Ask Ada Lovelace before you merge.\n' });
  assert.deepEqual(rulesOf(found), ['site-bound']);
  assert.match(found.findings[0].detail, /lovelace/);
  assert.deepEqual(report({ 'site/.agents/skills/run-the-gate.md': 'Ada is a name.\n' }).findings, []);
});

test('test files and fixture data may name the site, because they pin behaviour against an invented one', () => {
  const found = report(
    {
      'site/scripts/brand.test.mjs': "assert.equal(name, 'example.test');\n",
      'site/scripts/x.fixture.json': '"example.test"',
    },
    plus('site/scripts/brand.test.mjs', 'site/scripts/x.fixture.json')
  );
  assert.deepEqual(found.findings, []);
});

test('a site file may name the site, and so may the config that seeds it', () => {
  const found = report({ 'docs/PRD.md': 'The plan of example.test.\n' });
  assert.deepEqual(found.findings, []);
});

test('a seed that names the site it was cut from would carry the site to the next one', () => {
  const found = report({ 'seed/docs/SEMANTIC-CORE.md.seed': 'Prompts for example.test buyers.\n' });
  assert.deepEqual(rulesOf(found), ['site-bound']);
  assert.equal(found.findings[0].where, 'seed/docs/SEMANTIC-CORE.md.seed');
});

test('an anchor file that is neither shipped, seeded, generated nor produced is unserved', () => {
  const found = report({}, without('seed/docs/SEMANTIC-CORE.md.seed'));
  assert.deepEqual(rulesOf(found), ['anchor-unserved']);
  assert.equal(found.findings[0].where, 'docs/SEMANTIC-CORE.md');
});

test('an anchor directory is served by one seeded entry inside it, and unserved without one', () => {
  assert.deepEqual(rulesOf(report({}, without('seed/site/src/data/glossary/an-example-term.md.seed'))), [
    'anchor-unserved',
  ]);
  assert.deepEqual(report().findings, []);
});

test('an audits anchor is served when a measure script of its name exists, and unserved when none does', () => {
  const found = report({}, without('site/scripts/measure-sentence-band.mjs'));
  assert.deepEqual(rulesOf(found), ['anchor-unserved']);
  assert.equal(found.findings[0].where, 'audits/sentence-band.json');
});

test('an anchor that a seed or a script provides names the thing that serves it', () => {
  const served = report().served;
  assert.equal(served.get('docs/SEMANTIC-CORE.md'), 'seed/docs/SEMANTIC-CORE.md.seed');
  assert.equal(served.get('audits/sentence-band.json'), 'site/scripts/measure-sentence-band.mjs');
  assert.equal(served.get('site/.nvmrc'), 'site/.nvmrc');
});

test('the summary line states the three counts and the number of findings', () => {
  const found = report();
  assert.equal(
    summaryLine(found),
    `partition: ${found.counts.engine} engine, ${found.counts.site} site, ${found.counts.evidence} evidence files; 0 findings`
  );
  assert.match(summaryLine(report({}, plus('mystery.bin'))), /; 1 finding$/);
});
