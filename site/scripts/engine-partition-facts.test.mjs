import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PartitionFactsError, readPartitionFacts } from './engine-partition-facts.mjs';
import { SCENE_FILES, sceneReader } from './fixtures/partition-scene.mjs';

const facts = (overrides = {}, files = SCENE_FILES) => readPartitionFacts({ files, read: sceneReader(overrides) });

test('the layout facts come from the engine configuration, with the two test patterns compiled', () => {
  const found = facts();
  assert.equal(found.dataDirectory, 'site/src/data');
  assert.deepEqual(found.automationDirectories, ['.github/', '.githooks/']);
  assert.deepEqual(found.shippedDirectories, ['site/src/', 'site/public/']);
  assert.deepEqual(found.testTooling, ['site/playwright.config.ts']);
  assert.equal(found.testFile.test('a.test.mjs'), true);
  assert.equal(found.testFile.test('a.mjs'), false);
  assert.equal(found.testDirectory.test('site/scripts/fixtures/x.json'), true);
});

test('the collections are the keys the content schema exports, and nothing else in the file', () => {
  assert.deepEqual([...facts().collections].sort(), ['author', 'glossary', 'post', 'resource']);
});

test('the script roots are the directories an npm script runs a source file from, relative to the repository', () => {
  assert.deepEqual(facts().scriptRoots, ['site/scripts/']);
});

test('the routes the engine marks noindex are read from its own constant', () => {
  assert.deepEqual([...facts().noindexRoutes].sort(), ['/404', '/search']);
});

test('a file with a seed counterpart is seeded at its target path', () => {
  const { seeded } = facts();
  assert.equal(seeded.has('site/src/config.yaml'), true);
  assert.equal(seeded.has('docs/SEMANTIC-CORE.md'), true);
  assert.equal(seeded.has('seed/site/src/config.yaml.seed'), false);
});

test('an assets directory that holds images is a site asset directory, and one with fonts or styles is not', () => {
  assert.deepEqual(facts().siteAssetDirectories.sort(), ['site/src/assets/images/']);
});

test('a document is an engine document when code or a rule names it and it names no site', () => {
  assert.deepEqual([...facts().engineDocuments].sort(), [
    'docs/CONTENT-GATE.md',
    'docs/plan/reference/calibration-gate.md',
  ]);
});

test('a skill that cites a document does not make it an engine document', () => {
  const found = facts({ 'site/.agents/skills/run-the-gate.md': 'Read docs/PRD.md first.\n' });
  assert.equal(found.engineDocuments.has('docs/PRD.md'), false);
});

test('a document that names the site is not an engine document, however many files name it', () => {
  const found = facts({
    'docs/CONTENT-GATE.md': 'The rows of example.test.\n',
  });
  assert.equal(found.engineDocuments.has('docs/CONTENT-GATE.md'), false);
});

test('the files an assets script writes are generated outputs, including a path built from a template', () => {
  const found = facts(
    {
      'site/package.json': JSON.stringify({
        scripts: { 'assets:logo': 'node scripts/generate-logo.mjs', 'gate:docs': 'node scripts/run-docs-gate.mjs ..' },
      }),
      'site/scripts/generate-logo.mjs': [
        "writeFileSync('public/logo.svg', a);",
        `writeFileSync(\`public/brand/\${name}-512.png\`, b);`,
        "await writeFile(join(siteRoot, 'public', 'robots.txt'), c);",
        "writeFileSync('../docs/ledger.md', d);",
      ].join('\n'),
    },
    [...SCENE_FILES, 'site/public/brand/logo-light-512.png', 'site/public/robots.txt', 'docs/ledger.md']
  );
  assert.deepEqual([...found.generatedOutputs].sort(), [
    'docs/ledger.md',
    'site/public/brand/logo-light-512.png',
    'site/public/logo.svg',
    'site/public/robots.txt',
  ]);
});

test('a file an assets script only reads is not a generated output', () => {
  const found = facts({
    'site/package.json': JSON.stringify({ scripts: { 'assets:og': 'node scripts/generate-logo.mjs' } }),
    'site/scripts/generate-logo.mjs': "const brand = readFileSync('src/config.yaml', 'utf8');\n",
  });
  assert.equal(found.generatedOutputs.has('site/src/config.yaml'), false);
});

test('the identity terms are the brand, the host, its stem, the author slug and the author name, each of four letters or more', () => {
  assert.deepEqual(facts().identity.terms, ['example.test', 'example', 'lovelace']);
});

test('a missing engine configuration is named, so the gate can say what it could not read', () => {
  assert.throws(
    () => facts({ 'site/engine.config.json': undefined }),
    (error) => error instanceof PartitionFactsError && /site\/engine\.config\.json/.test(error.message)
  );
});

test('a content schema that exports no collections is named too', () => {
  assert.throws(
    () => facts({ 'site/src/content.config.ts': 'export const nothing = 1;' }),
    (error) => error instanceof PartitionFactsError && /collections/.test(error.message)
  );
});
