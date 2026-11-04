import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLASSES, RULES, classify, isSeed, partition, routeOfPage, seedTarget } from './engine-partition.mjs';
import { partitionFacts } from './fixtures/partition-facts.mjs';

const facts = partitionFacts();
const ruleOf = (file, scene = facts) => classify(file, scene).rule;
const classOf = (file, scene = facts) => classify(file, scene).class;

test('a file under the seed root with the seed suffix is engine, and its target is the path without them', () => {
  assert.equal(isSeed('seed/site/src/config.yaml.seed'), true);
  assert.equal(seedTarget('seed/site/src/config.yaml.seed'), 'site/src/config.yaml');
  assert.deepEqual(classify('seed/docs/SEMANTIC-CORE.md.seed', facts), {
    file: 'seed/docs/SEMANTIC-CORE.md.seed',
    class: 'engine',
    rule: 'seed-template',
  });
});

test('a file under the seed root without the suffix fits no rule, so a stray file there is a finding', () => {
  assert.equal(isSeed('seed/site/src/config.yaml'), false);
  assert.equal(classOf('seed/site/src/config.yaml'), null);
});

test('a file the engine ships a seed for belongs to the site, whatever its location would say', () => {
  assert.deepEqual(classify('site/src/config.yaml', facts), {
    file: 'site/src/config.yaml',
    class: 'site',
    rule: 'seeded',
  });
});

test('closed and in-flight change records, audits, investigations, screenshots and captures are evidence', () => {
  const evidence = [
    'openspec/changes/archive/2026-10-13-01-initialization/proposal.md',
    'openspec/changes/26-extract-the-engine-cleanly/tasks.md',
    'audits/search-demand.md',
    'audits/phase-4/REPORT.md',
    'investigation/01-absorption-from-donor-harness.md',
    'site/tests/__screenshots__/linux/home.png',
    'docs/sources/prd-v2.mhtml',
  ];
  for (const file of evidence) assert.equal(classOf(file), 'evidence', file);
});

test('an entry of a defined collection is site, and so is a vocabulary file that sits beside the collections', () => {
  assert.equal(ruleOf('site/src/data/post/a-post.md'), 'collection-entry');
  assert.equal(ruleOf('site/src/data/author/someone.md'), 'collection-entry');
  assert.equal(ruleOf('site/src/data/tags.mjs'), 'site-vocabulary');
  assert.equal(ruleOf('site/src/data/home.ts'), 'site-vocabulary');
});

test('a test beside the collections stays engine, and a directory no collection defines fits no rule', () => {
  assert.equal(ruleOf('site/src/data/tags.test.mjs'), 'test');
  assert.equal(classOf('site/src/data/mystery/entry.md'), null);
});

test('the route of a page file is derived from its path', () => {
  assert.equal(routeOfPage('site/src/pages/index.astro'), '/');
  assert.equal(routeOfPage('site/src/pages/about.astro'), '/about');
  assert.equal(routeOfPage('site/src/pages/blog/index.astro'), '/blog');
  assert.equal(routeOfPage('site/src/pages/404.astro'), '/404');
});

test('a static page is site copy unless the engine serves its route as machinery', () => {
  assert.equal(ruleOf('site/src/pages/about.astro'), 'authored-page');
  assert.equal(ruleOf('site/src/pages/blog/index.astro'), 'authored-page');
  assert.equal(ruleOf('site/src/pages/search.astro'), 'page-machinery');
  assert.equal(ruleOf('site/src/pages/404.astro'), 'page-machinery');
});

test('a dynamic template and an endpoint are engine', () => {
  assert.equal(ruleOf('site/src/pages/blog/[id].astro'), 'page-machinery');
  assert.equal(ruleOf('site/src/pages/rss.xml.ts'), 'page-machinery');
  assert.equal(ruleOf('site/src/pages/search-entries.json.ts'), 'page-machinery');
});

test('a served static asset is site, while client code under public is engine', () => {
  assert.equal(ruleOf('site/public/logo.svg'), 'generated-output');
  assert.equal(ruleOf('site/public/brand/hand-drawn.png'), 'site-asset');
  assert.equal(ruleOf('site/public/robots.txt'), 'site-asset');
  assert.equal(ruleOf('site/public/.well-known/security.txt'), 'site-asset');
  assert.equal(ruleOf('site/src/assets/images/og-default.png'), 'site-asset');
  assert.equal(classOf('site/public/search/box.mjs'), 'engine');
});

test('the partitioned search index is engine, as source, as build and measuring scripts and as client runtime', () => {
  for (const file of [
    'site/src/utils/search-index.mjs',
    'site/scripts/build-search-index.mjs',
    'site/scripts/measure-search.mjs',
    'site/public/search/index-model.mjs',
  ]) {
    assert.equal(classOf(file), 'engine', file);
  }
});

test('automation, tests, scripts, skills and specs are engine', () => {
  assert.equal(ruleOf('.github/workflows/ci.yml'), 'automation');
  assert.equal(ruleOf('.githooks/pre-push'), 'automation');
  assert.equal(ruleOf('site/scripts/brand-gate.test.mjs'), 'test');
  assert.equal(ruleOf('site/scripts/fixtures/anything.json'), 'test');
  assert.equal(ruleOf('site/playwright.config.ts'), 'test');
  assert.equal(ruleOf('site/scripts/brand-gate.mjs'), 'script');
  assert.equal(ruleOf('site/scripts/logo-geometry.json'), 'script');
  assert.equal(ruleOf('site/.agents/skills/run-the-gate.md'), 'skill');
  assert.equal(ruleOf('openspec/specs/content/content-gate/spec.md'), 'specification');
  assert.equal(ruleOf('openspec/config.yaml'), 'specification');
  assert.equal(ruleOf('.omp/rules/openspec.md'), 'specification');
});

test('source code and stylesheets that reach the built site are engine', () => {
  assert.equal(ruleOf('site/src/utils/brand.mjs'), 'shipped-source');
  assert.equal(ruleOf('site/src/components/site/Hero.astro'), 'shipped-source');
  assert.equal(ruleOf('site/src/assets/styles/tailwind.css'), 'shipped-source');
  assert.equal(ruleOf('site/src/assets/fonts/Fraunces-SemiBold.ttf'), 'shipped-source');
  assert.equal(ruleOf('site/vendor/integration/index.ts'), 'vendored-integration');
});

test('a configuration file at the project root is engine tooling, at the repository root or in site', () => {
  assert.equal(ruleOf('site/package.json'), 'project-tooling');
  assert.equal(ruleOf('site/.nvmrc'), 'project-tooling');
  assert.equal(ruleOf('site/astro.config.ts'), 'project-tooling');
  assert.equal(ruleOf('.gitignore'), 'project-tooling');
  assert.equal(classOf('site/deep/nested/tool.json'), null);
});

test('a document is engine only when the facts say an engine file names it, and prose nobody reads is site', () => {
  assert.equal(ruleOf('docs/plan/reference/calibration-gate.md'), 'engine-document');
  assert.equal(ruleOf('docs/PRD.md'), 'unread-prose');
  assert.equal(classOf('docs/diagram.png'), null);
});

test('the files that point an agent at the law, configure the editor, carry a licence or explain a directory are engine', () => {
  assert.equal(ruleOf('CLAUDE.md'), 'agent-pointer');
  assert.equal(ruleOf('site/AGENTS.md'), 'agent-pointer');
  assert.equal(ruleOf('site/.vscode/launch.json'), 'editor-config');
  assert.equal(ruleOf('site/LICENSE.md'), 'licence');
  assert.equal(ruleOf('site/src/assets/icons/README.md'), 'directory-readme');
});

test('the root law names the site, so it fits no rule until a seed claims it', () => {
  assert.equal(classOf('AGENTS.md', partitionFacts({ seeded: new Set() })), null);
  assert.equal(ruleOf('AGENTS.md'), 'seeded');
});

test('a fixture file is engine whatever directory it sits in, and an export manifest is engine', () => {
  assert.equal(ruleOf('site/scripts/search-demand.fixture.json'), 'fixture-data');
  assert.equal(ruleOf('engine-export.json'), 'export-manifest');
});

test('every rule names its class, carries a reason and is one of the three classes', () => {
  const ids = RULES.map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of RULES) {
    assert.ok(CLASSES.includes(rule.class), rule.id);
    assert.ok(rule.why.length > 20, rule.id);
    assert.equal(typeof rule.test, 'function', rule.id);
  }
});

test('the partition counts each class and lists every file that fits no rule', () => {
  const files = ['audits/routes.json', 'site/src/data/post/a.md', 'site/scripts/brand-gate.mjs', 'stray.bin'];
  const result = partition(files, facts);
  assert.deepEqual(result.counts, { engine: 1, site: 1, evidence: 1 });
  assert.deepEqual(result.unclassified, ['stray.bin']);
  assert.equal(result.rows.length, files.length);
});

test('a file named with the .site marker belongs to one site and is never exported; the same name without it is engine', () => {
  assert.deepEqual(classify('site/scripts/topic-core.site.test.mjs', facts), {
    file: 'site/scripts/topic-core.site.test.mjs',
    class: 'site',
    rule: 'site-marked',
  });
  assert.deepEqual(classify('site/.agents/skills/navigate-the-plan.site.md', facts), {
    file: 'site/.agents/skills/navigate-the-plan.site.md',
    class: 'site',
    rule: 'site-marked',
  });
  assert.equal(ruleOf('site/scripts/topic-core.test.mjs'), 'test');
  assert.equal(ruleOf('site/.agents/skills/navigate-the-plan.md'), 'skill');
  assert.equal(classOf('site/src/utils/pipeline.site.test.mjs'), 'site');
});
