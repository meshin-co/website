import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classify } from './engine-partition.mjs';
import {
  PartitionFactsError,
  VOCABULARY_FILES,
  identityTermIn,
  readPartitionFacts,
} from './engine-partition-facts.mjs';
import { partitionReport } from './engine-partition-gate.mjs';
import { SCENE_CONFIG, SCENE_FILES, sceneReader } from './fixtures/partition-scene.mjs';

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

test('the routes the engine marks noindex are the routes it declares as exceptions, and an empty collection is not one', () => {
  assert.deepEqual([...facts().noindexRoutes].sort(), ['/404', '/search']);
});

test('a tree whose route exceptions are missing or unreadable is refused with the file named, never read as none', () => {
  const EXCEPTIONS = 'site/src/utils/route-exceptions.mjs';
  for (const replacement of [null, 'export const ROUTE_EXCEPTIONS = makeThem();\n']) {
    assert.throws(
      () =>
        readPartitionFacts({
          files: SCENE_FILES,
          read: (path) => (path === EXCEPTIONS ? replacement : sceneReader()(path)),
        }),
      (error) => error instanceof PartitionFactsError && error.message.includes(EXCEPTIONS)
    );
  }
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

const CREDENTIALS = 'docs/plan/reference/search-credentials.md';
const CREDENTIALS_TEXT = 'Where each credential comes from, and where it is stored.\n';

const withASkillNaming = (skill, documentText = CREDENTIALS_TEXT) =>
  facts({ [skill]: `Where the key comes from: ${CREDENTIALS}\n`, [CREDENTIALS]: documentText }, [
    ...SCENE_FILES,
    skill,
    CREDENTIALS,
  ]);

const classified = (class_, rule) => ({ file: CREDENTIALS, class: class_, rule });

test('a document that only an engine skill names is classified engine, because the skill sends the next owner to it', () => {
  for (const skill of ['site/.agents/skills/measure-demand.md', 'site/.agents/skills/ai-agent-readiness/webmcp.md']) {
    assert.deepEqual(classify(CREDENTIALS, withASkillNaming(skill)), classified('engine', 'engine-document'), skill);
  }
});

test('a document that no engine file names at all stays site, however neutral it reads', () => {
  const unnamed = facts({ [CREDENTIALS]: CREDENTIALS_TEXT }, [...SCENE_FILES, CREDENTIALS]);
  assert.deepEqual(classify(CREDENTIALS, unnamed), classified('site', 'unread-prose'));
  assert.deepEqual(classify('docs/PRD.md', facts()), { file: 'docs/PRD.md', class: 'site', rule: 'unread-prose' });
});

test('a document that only a site-marked skill names stays site, because its author kept that skill with one site', () => {
  const found = withASkillNaming('site/.agents/skills/navigate-the-plan.site.md');
  assert.deepEqual(classify(CREDENTIALS, found), classified('site', 'unread-prose'));
});

test('a skill that names a document which names the site leaves that document with the site', () => {
  const found = withASkillNaming('site/.agents/skills/measure-demand.md', 'The credentials of example.test.\n');
  assert.deepEqual(classify(CREDENTIALS, found), classified('site', 'unread-prose'));
});

test('a test file that names a document does not carry it, because a test names documents as data', () => {
  const found = withASkillNaming('site/scripts/measure-demand.test.mjs');
  assert.deepEqual(classify(CREDENTIALS, found), classified('site', 'unread-prose'));
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

test('a copy knows its seeded files from the export manifest, because the seeds themselves stayed behind', () => {
  const manifest = JSON.stringify({ seeds: ['docs/only-in-the-manifest.md'] });
  const found = facts({ 'engine-export.json': manifest }, [...SCENE_FILES, 'engine-export.json']);
  assert.equal(found.seeded.has('docs/only-in-the-manifest.md'), true);
});

test('an export manifest that is not valid, or lists no seeds, is a fact the gate could not read', () => {
  for (const text of ['{', JSON.stringify({ counts: {} }), JSON.stringify({ seeds: [1] })]) {
    assert.throws(
      () => facts({ 'engine-export.json': text }, [...SCENE_FILES, 'engine-export.json']),
      (error) => error instanceof PartitionFactsError && /engine-export\.json/.test(error.message)
    );
  }
});

const ownedBy = (slug, name) => ({
  'site/engine.config.json': JSON.stringify({
    ...SCENE_CONFIG,
    content: {
      ...SCENE_CONFIG.content,
      formats: {
        ...SCENE_CONFIG.content.formats,
        article: { ...SCENE_CONFIG.content.formats.article, author: slug },
      },
    },
  }),
  [`site/src/data/author/${slug}.md`]: `---\nname: ${name}\n---\n`,
});

const hostedAt = (name, host) => ({ 'site/src/config.yaml': `site:\n  name: ${name}\n  site: 'https://${host}'\n` });

const naming = (word, count, { directory = 'site/scripts/', extension = '.mjs' } = {}) => {
  const files = Array.from({ length: count }, (_, index) => `${directory}names-${index}${extension}`);
  return { files, text: Object.fromEntries(files.map((file) => [file, `export const note = 'the ${word} of it';\n`])) };
};

const treeOf = (overrides, ...crowds) => ({
  files: [...SCENE_FILES, 'seed/site/engine.config.json.seed', ...crowds.flatMap(({ files }) => files)],
  overrides: Object.assign({}, overrides, ...crowds.map(({ text }) => text)),
});

const identityIn = (overrides, ...crowds) => {
  const { files, overrides: texts } = treeOf(overrides, ...crowds);
  return facts(texts, files).identity;
};

const siteBoundIn = (overrides, ...crowds) => {
  const { files, overrides: texts } = treeOf(overrides, ...crowds);
  return partitionReport({ files, read: sceneReader(texts) }).findings.filter(({ rule }) => rule === 'site-bound');
};

test('a word of the owner name that a dozen engine files use is vocabulary, not an identity term', () => {
  const identity = identityIn(ownedBy('ada', 'Ada Lovelace Quill'), naming('quill', VOCABULARY_FILES));
  assert.deepEqual(identity.terms, ['example.test', 'example', 'lovelace']);
  assert.deepEqual(identity.vocabulary, ['quill']);
});

test('the same word one file short of the count is still an identity term, so the count is measured and no word list decides it', () => {
  const identity = identityIn(ownedBy('ada', 'Ada Lovelace Quill'), naming('quill', VOCABULARY_FILES - 1));
  assert.deepEqual(identity.terms, ['example.test', 'example', 'lovelace', 'quill']);
  assert.deepEqual(identity.vocabulary, []);
});

test('an owner called Page gets the brand, the host and the stem, and no finding for a word the engine uses everywhere', () => {
  const crowd = naming('page', 40);
  const identity = identityIn(ownedBy('page', 'Page'), crowd);
  assert.deepEqual(identity.terms, ['example.test', 'example']);
  assert.deepEqual(identity.vocabulary, ['page']);
  assert.deepEqual(siteBoundIn(ownedBy('page', 'Page'), crowd), []);
});

test('a distinctive owner name still identifies the site beside a vocabulary word, and a file that names the owner is still found', () => {
  const owner = ownedBy('ada', 'Ada Lovelace Page');
  const crowd = naming('page', VOCABULARY_FILES);
  const identity = identityIn(owner, crowd);
  assert.equal(identityTermIn('Written by Lovelace.', identity), 'lovelace');
  assert.equal(identityTermIn('The page of the thing.', identity), null);
  const named = {
    files: ['site/scripts/names-the-owner.mjs'],
    text: { 'site/scripts/names-the-owner.mjs': '// Lovelace\n' },
  };
  const findings = siteBoundIn(owner, crowd, named);
  assert.deepEqual(
    findings.map(({ where, detail }) => [where, /names "lovelace"/.test(detail)]),
    [['site/scripts/names-the-owner.mjs', true]]
  );
});

test('a freshly exported copy, whose author is Example Author, finds nothing site-bound in files that say example and author', () => {
  const copy = { ...ownedBy('example-author', 'Example Author'), ...hostedAt('new-site.example', 'new-site.example') };
  const crowds = [naming('example', 50), naming('author', 50, { directory: 'site/src/utils/' })];
  const identity = identityIn(copy, ...crowds);
  assert.deepEqual(identity.terms, ['new-site.example', 'new-site', 'example-author']);
  assert.deepEqual(identity.vocabulary, ['example', 'author']);
  assert.deepEqual(siteBoundIn(copy, ...crowds), []);
});

test('files the site-bound check never reads do not make a name vocabulary: tests, and prose that stays with the site', () => {
  const crowds = [
    naming('lovelace', VOCABULARY_FILES, { extension: '.test.mjs' }),
    naming('lovelace', VOCABULARY_FILES, { directory: 'docs/notes/', extension: '.md' }),
  ];
  const identity = identityIn({}, ...crowds);
  assert.deepEqual(identity.terms, ['example.test', 'example', 'lovelace']);
  assert.deepEqual(identity.vocabulary, []);
});

test('the brand and the host are never set aside, however many files name them, so a brand spread through the engine is still found', () => {
  const site = hostedAt('Index Labs', 'index-labs.example');
  const crowd = naming('index labs', 40);
  const identity = identityIn(site, crowd, naming('index-labs.example', 40, { directory: 'site/src/utils/' }));
  assert.deepEqual(identity.terms.slice(0, 2), ['index labs', 'index-labs.example']);
  assert.equal(siteBoundIn(site, crowd).length, 40);
});

test('the stem of the host is a word too, and is set aside when the engine uses it everywhere', () => {
  const identity = identityIn(hostedAt('page.example', 'page.example'), naming('page', 40));
  assert.deepEqual(identity.terms, ['page.example', 'lovelace']);
  assert.deepEqual(identity.vocabulary, ['page']);
});
