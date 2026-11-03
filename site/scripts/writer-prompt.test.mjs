import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { PRIMARY_DOMAINS } from './claim-sources.mjs';
import { LENGTH_FILE } from './entry-length.mjs';
import { CATEGORIES, COUNT_LIMITS, META_DESCRIPTION_MAX_CHARS, WORD_LIMITS } from './entry-limits.mjs';
import { claimFor } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { BAND_FILE } from './sentence-band.mjs';
import { WriterError } from './writer-error.mjs';
import { outputSchema } from './writer-output.mjs';
import { PASSAGE_WORD_CAP, SOURCE_MINIMUM } from './writer-preflight-fields.mjs';
import { buildPrompt, MAX_OUTPUT_TOKENS, PROMPT_SOURCES } from './writer-prompt.mjs';
import { readSources } from './writer-prompt-read.mjs';

const FORMATS = ['term', 'article'];
const RUN_DATE = '2026-11-02';
const SEPARATOR = '\n\u0000\n';
const EXPECTED_PATHS = [
  'AGENTS.md',
  'site/.agents/skills/write-copy.md',
  'site/.agents/skills/write-for-humans.md',
  'site/.agents/skills/place-a-new-text.md',
  'site/.agents/skills/add-collection-entry.md',
  'site/src/content.config.ts',
  'docs/CONTENT-GATE.md',
  'docs/SEMANTIC-CORE.md',
  'site/banned-phrases.json',
  'site/controlled-words.json',
  'site/content-facts.json',
  BAND_FILE,
  LENGTH_FILE,
  'audits/routes.json',
  'site/src/data/tags.mjs',
  'site/src/data/glossary',
  'site/src/data/resource',
];
const DATA_KEYS = [
  'band',
  'bannedPhrases',
  'controlledWords',
  'glossary',
  'length',
  'numbers',
  'promptBlock',
  'resource',
  'routes',
  'tags',
];
const DEMAND_ROW = { Query: 'gap assessment', Impressions: '14', Clicks: '0', Position: '11.2', Page: '-' };

const roots = [];
const freshRoot = () => {
  const root = makeRepo();
  roots.push(root);
  return root;
};
after(() => roots.forEach(removeRepo));

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const build = (root, format, overrides = {}) =>
  buildPrompt({ repoRoot: root, claim: claimFor(format), demandRow: DEMAND_ROW, runDate: RUN_DATE, ...overrides });
const fileOf = (root, path) => readFileSync(join(root, path), 'utf8');
const edit = (root, path, change) => writeFileSync(join(root, path), change(fileOf(root, path)));
const everything = ({ system, user }) => system + '\n' + user;
const isDirectory = (source) => source.take.every(({ kind }) => kind === 'slugs');
const promptOpener = (format, offset = 0) => '**' + (claimFor(format).prompt.number + offset) + '. ';
const AGENTS_RULE = '- ' + PROMPT_SOURCES.find(({ path }) => path === 'AGENTS.md').take[0].anchor;

const real = freshRoot();

test('PROMPT_SOURCES names the files the prompt is made from, each with the part it reads', () => {
  assert.deepEqual(
    PROMPT_SOURCES.map(({ path }) => path),
    EXPECTED_PATHS
  );
  for (const { part, take } of PROMPT_SOURCES) {
    assert.ok(typeof part === 'string' && part.length > 20, 'a source says which part it reads');
    assert.ok(take.length > 0);
  }
});

for (const format of FORMATS) {
  test('the ' + format + ' prompt names every file of PROMPT_SOURCES', () => {
    const prompt = build(real, format);
    for (const { path } of PROMPT_SOURCES) assert.ok(everything(prompt).includes(path), path + ' is not named');
  });

  test('the ' + format + ' prompt holds each extracted rule verbatim, copied from its file and not paraphrased', () => {
    const { texts } = readSources({ repoRoot: real, claim: claimFor(format), sources: PROMPT_SOURCES });
    const prompt = build(real, format);
    assert.ok(texts.length >= 8);
    for (const { path, blocks } of texts) {
      const file = fileOf(real, path);
      for (const block of blocks) {
        assert.ok(block.length > 40, path + ' gave an empty block');
        assert.ok(file.includes(block), path + ' does not contain the block the prompt carries');
        assert.ok(prompt.system.includes(block), 'the system prompt lacks a block of ' + path);
      }
    }
  });

  test('the ' + format + ' prompt holds the whole of each whole-file source', () => {
    const { system } = build(real, format);
    for (const path of PROMPT_SOURCES.filter(({ take }) => take[0].kind === 'whole').map((source) => source.path)) {
      assert.ok(system.includes(fileOf(real, path).trimEnd()), path + ' is not whole in the prompt');
    }
  });

  test('the ' + format + ' walk resolves every anchor of every source against the tree it reads', () => {
    const read = readSources({ repoRoot: real, claim: claimFor(format), sources: PROMPT_SOURCES });
    assert.ok(read.texts.every(({ blocks }) => blocks.length > 0));
    assert.deepEqual(Object.keys(read.data).sort(), DATA_KEYS);
    for (const value of Object.values(read.data)) assert.ok(Object.keys(value).length > 0);
    assert.equal(read.files.length, PROMPT_SOURCES.filter((source) => !isDirectory(source)).length);
  });

  test('the ' + format + ' prompt describes every member of the schema by name', () => {
    const { system } = build(real, format);
    const schema = outputSchema(format);
    const named = [
      ...Object.keys(schema.properties),
      ...Object.keys(schema.properties.fields.properties),
      ...Object.keys(schema.properties.sources.items.properties),
      ...Object.keys(schema.properties.claims.items.properties),
    ];
    for (const name of named) assert.ok(system.includes(name), name + ' is not described');
  });
}

test('a rule edited in the tree is the rule the prompt carries, so nothing is pasted', () => {
  const root = freshRoot();
  const before = build(root, 'article');
  const stated = fileOf(root, 'AGENTS.md')
    .split('\n')
    .find((line) => line.startsWith(AGENTS_RULE));
  edit(root, 'AGENTS.md', (text) => text.replace(AGENTS_RULE, AGENTS_RULE + ' SENTINEL-WORD'));
  edit(root, 'site/.agents/skills/write-copy.md', (text) => text + '\nSENTINEL-SKILL-LINE.\n');
  edit(root, 'site/banned-phrases.json', (text) => JSON.stringify([...JSON.parse(text), 'sentinel-phrase']));
  const after = build(root, 'article');
  assert.ok(after.system.includes('SENTINEL-WORD') && after.system.includes('SENTINEL-SKILL-LINE.'));
  assert.ok(after.system.includes('sentinel-phrase'));
  assert.ok(!before.system.includes('SENTINEL-WORD'));
  assert.ok(before.system.includes(stated) && !after.system.includes(stated));
  assert.notEqual(after.digest, before.digest);
});

test('text outside the anchors never reaches the prompt', () => {
  const root = freshRoot();
  edit(root, 'AGENTS.md', (text) => text + '\n- OUTSIDE-BULLET stays out.\n');
  edit(root, 'docs/SEMANTIC-CORE.md', (text) =>
    text.replace(promptOpener('term'), 'OUTSIDE-LINE\n\n' + promptOpener('term'))
  );
  const prompt = build(root, 'term');
  assert.ok(!everything(prompt).includes('OUTSIDE-BULLET') && !everything(prompt).includes('OUTSIDE-LINE'));
  assert.equal(prompt.digest, build(real, 'term').digest);
});

test('the files are read from the repository root it is given, not from the working tree', () => {
  const root = freshRoot();
  edit(
    root,
    'site/.agents/skills/place-a-new-text.md',
    () => 'ONLY-IN-THE-COPY, a rule long enough to count as a rule.\n'
  );
  assert.ok(build(root, 'term').system.includes('ONLY-IN-THE-COPY'));
  assert.ok(!build(real, 'term').system.includes('ONLY-IN-THE-COPY'));
});

test('the digest is the sha256 of the system and the user text around the separator the contract names', () => {
  const prompt = build(real, 'article');
  assert.equal(prompt.digest, sha256(prompt.system + SEPARATOR + prompt.user));
});

test('the prompt is deterministic for a fixed tree, whatever directory holds it', () => {
  const first = build(freshRoot(), 'article');
  const second = build(freshRoot(), 'article');
  assert.deepEqual(second, first);
  assert.ok(!everything(first).includes(real));
});

test('the digest moves with the claim, the run date and the demand row', () => {
  const base = build(real, 'term').digest;
  assert.notEqual(build(real, 'term', { runDate: '2026-11-03' }).digest, base);
  assert.notEqual(build(real, 'term', { claim: claimFor('term', { query: 'gap analysis' }) }).digest, base);
  assert.notEqual(build(real, 'term', { demandRow: { ...DEMAND_ROW, Impressions: '15' } }).digest, base);
});

for (const { path, take } of PROMPT_SOURCES.filter((source) => !isDirectory(source))) {
  test('one changed byte in ' + path + ' changes its sha256 in files and no other', () => {
    const root = freshRoot();
    const before = build(root, 'article');
    const content = fileOf(root, path);
    const changed = path.endsWith('.json') ? JSON.stringify(JSON.parse(content), null, 4) : content + '\n';
    assert.notEqual(changed, content);
    edit(root, path, () => changed);
    const after = build(root, 'article');
    const touched = after.files.filter((file, index) => file.sha256 !== before.files[index].sha256);
    assert.deepEqual(
      touched.map((file) => file.path),
      [path]
    );
    assert.equal(touched[0].sha256, sha256(changed));
    assert.ok(take.length > 0);
  });
}

for (const path of ['site/src/data/glossary', 'site/src/data/resource']) {
  test('a new entry in ' + path + ' changes the prompt digest', () => {
    const root = freshRoot();
    const before = build(root, 'term');
    writeFileSync(join(root, path, 'a-brand-new-entry.md'), '');
    const after = build(root, 'term');
    assert.notEqual(after.digest, before.digest);
    assert.ok(after.user.includes('a-brand-new-entry'));
  });
}

test('a new tag in the tag file changes the prompt digest', () => {
  const root = freshRoot();
  const before = build(root, 'article');
  edit(root, 'site/src/data/tags.mjs', (text) =>
    text.replace('export const TAGS = [', "export const TAGS = [\n  { slug: 'a-brand-new-tag', name: 'New' },")
  );
  const after = build(root, 'article');
  assert.notEqual(after.digest, before.digest);
  assert.ok(after.user.includes('a-brand-new-tag'));
});

test('files lists each file read with the sha256 of its bytes, in the order of PROMPT_SOURCES, and no directory', () => {
  const { files } = build(real, 'article');
  const expected = PROMPT_SOURCES.filter((source) => !isDirectory(source)).map(({ path }) => ({
    path,
    sha256: sha256(readFileSync(join(real, path))),
  }));
  assert.deepEqual(files, expected);
});

test('the schema digest is the sha256 of the serialised schema of the format, and the budget is the one the owner set', () => {
  for (const format of FORMATS) {
    const prompt = build(real, format);
    assert.equal(prompt.schemaDigest, sha256(JSON.stringify(outputSchema(format))));
    assert.equal(prompt.maxOutputTokens, MAX_OUTPUT_TOKENS);
  }
  assert.equal(MAX_OUTPUT_TOKENS, 32000);
  assert.notEqual(build(real, 'term').schemaDigest, build(real, 'article').schemaDigest);
});

const openerOf = {
  bullet: (anchor) => '- ' + anchor,
  section: (anchor) => anchor,
  declaration: (anchor) => anchor,
  between: ([from]) => from,
  promptBlock: (number) => '**' + number + '. ',
};

const ANCHORED = PROMPT_SOURCES.flatMap(({ path, take }) =>
  take.filter(({ kind }) => kind in openerOf).map((item) => [path, item])
);

for (const format of FORMATS) {
  for (const [path, take] of ANCHORED) {
    if (take.formats && !take.formats.includes(format)) continue;
    const anchor = typeof take.anchor === 'function' ? take.anchor(claimFor(format)) : take.anchor;
    const opener = openerOf[take.kind](anchor);
    test(
      'the ' + format + ' prompt fails naming ' + path + ' and ' + JSON.stringify(opener) + ' when that anchor is gone',
      () => {
        const root = freshRoot();
        edit(root, path, (text) => {
          const lines = text.split('\n');
          const found = lines.findIndex((line) => line.startsWith(opener));
          assert.ok(found >= 0, 'the real file lacks ' + opener);
          lines[found] = 'GONE ' + lines[found];
          return lines.join('\n');
        });
        assert.throws(
          () => build(root, format),
          (error) =>
            error instanceof WriterError &&
            error.kind === 'config' &&
            error.message.includes(path) &&
            error.message.includes(opener.trim().split('\n')[0])
        );
      }
    );
  }
}

test('a json source that lost its key fails naming the file and the key', () => {
  const root = freshRoot();
  edit(root, 'site/content-facts.json', (text) => JSON.stringify({ ...JSON.parse(text), numbers: undefined }));
  assert.throws(
    () => build(root, 'term'),
    (error) =>
      error instanceof WriterError &&
      error.message.includes('site/content-facts.json') &&
      error.message.includes('numbers')
  );
});

test('a skill file that is empty fails naming its path', () => {
  const root = freshRoot();
  writeFileSync(join(root, 'site/.agents/skills/write-copy.md'), '\n');
  assert.throws(
    () => build(root, 'term'),
    (error) => error instanceof WriterError && error.message.includes('site/.agents/skills/write-copy.md')
  );
});

test('a route list that is empty fails naming its path', () => {
  const root = freshRoot();
  edit(root, 'audits/routes.json', () => '[]');
  assert.throws(
    () => build(root, 'term'),
    (error) => error instanceof WriterError && error.message.includes('audits/routes.json')
  );
});

test('a band record that holds no band for the format fails naming the record', () => {
  const root = freshRoot();
  edit(root, BAND_FILE, (text) =>
    JSON.stringify({ ...JSON.parse(text), bands: { article: JSON.parse(text).bands.article } })
  );
  assert.throws(
    () => build(root, 'term'),
    (error) => error instanceof WriterError && error.message.includes(BAND_FILE)
  );
  assert.ok(build(root, 'article').system.length > 0);
});

test('a format the writer does not write is refused before anything is read', () => {
  assert.throws(() => build(real, 'term', { claim: claimFor('term', { format: 'faq-answer' }) }), /faq-answer/);
});

const user = (format, overrides) => build(real, format, overrides).user;

for (const format of FORMATS) {
  test('the ' + format + ' request carries the claim, the run date, the demand and the route', () => {
    const claim = claimFor(format);
    const text = user(format);
    for (const part of [
      claim.title,
      claim.slug,
      claim.query,
      claim.prompt.text,
      RUN_DATE,
      '14 impressions',
      '11.2',
      'Query: gap assessment',
      'Page: -',
    ]) {
      assert.ok(text.includes(part), 'the request lacks ' + part);
    }
    assert.ok(text.includes(format === 'term' ? '/glossary/' + claim.slug : '/blog/' + claim.slug));
  });

  test('the ' + format + ' request lists every route and every glossary, resource and tag slug that exists', () => {
    const text = user(format);
    for (const route of JSON.parse(fileOf(real, 'audits/routes.json')))
      assert.ok(text.includes(route), route + ' is not listed');
    const { data } = readSources({ repoRoot: real, claim: claimFor(format), sources: PROMPT_SOURCES });
    for (const slug of [...data.glossary, ...data.resource, ...data.tags])
      assert.ok(text.includes(slug), slug + ' is not listed');
    assert.ok(data.glossary.length > 0 && data.resource.length > 0 && data.tags.length > 0);
  });
}

test('a request names the page heading the gate reads: the term for a term, the title for an article', () => {
  assert.match(user('term'), /Page heading \(h1\): gap assessment\n/);
  assert.match(user('article'), /Page heading \(h1\): How to write an AI incident response plan\n/);
});

test('a null position is told as no position and a demand row is optional', () => {
  const text = user('term', {
    claim: claimFor('term', { demand: { impressions: 0, position: null } }),
    demandRow: undefined,
  });
  assert.match(text, /0 impressions/);
  assert.match(text, /no position/);
  assert.ok(!text.includes('Query: gap assessment'));
});

test('the request holds the buyer-prompt block of the claim only, never another block or the generated layer', () => {
  const core = fileOf(real, 'docs/SEMANTIC-CORE.md');
  const block = core.slice(core.indexOf(promptOpener('term')), core.indexOf(promptOpener('term', 1)));
  assert.ok(user('term').includes(block.trimEnd()));
  assert.ok(
    !user('term').includes(promptOpener('article')) &&
      !everything(build(real, 'term')).includes('semantic-core:begin generated')
  );
  assert.ok(everything(build(real, 'article')).includes('Family strategy'));
});

test('the rows of the articles section reach an article prompt and not a term prompt', () => {
  assert.ok(build(real, 'article').system.includes('### Articles additionally'));
  assert.ok(!build(real, 'term').system.includes('### Articles additionally'));
  assert.ok(build(real, 'term').system.includes('### Honesty rows (every page, no exceptions)'));
});

test('the collection of the format reaches the prompt and the collection of the other format does not', () => {
  assert.ok(build(real, 'term').system.includes('const glossaryCollection = defineCollection('));
  assert.ok(!build(real, 'term').system.includes('const postCollection = defineCollection('));
  assert.ok(build(real, 'article').system.includes('const postCollection = defineCollection('));
  assert.ok(!build(real, 'article').system.includes('const glossaryCollection = defineCollection('));
});

test('the band printed is the band of the claim format and nothing of the other format', () => {
  const record = JSON.parse(fileOf(real, BAND_FILE));
  const medians = (format) => [record.bands[format].medianFloor, record.bands[format].medianCeiling];
  const termSystem = build(real, 'term').system;
  const articleSystem = build(real, 'article').system;
  assert.ok(termSystem.includes('Median sentence: ' + medians('term').join(' to ') + ' words'));
  assert.ok(articleSystem.includes('Median sentence: ' + medians('article').join(' to ') + ' words'));
  assert.ok(!termSystem.includes('Median sentence: ' + medians('article').join(' to ') + ' words'));
  assert.ok(termSystem.includes('at least ' + record.bands.term.minimumSentences + ' sentences'));
  assert.ok(termSystem.includes(String(Math.floor(record.bands.term.belowThresholdCap * 1000) / 10) + '%'));
});

test('the allowed numbers, the banned phrases and the plain words are listed whole', () => {
  const { system } = build(real, 'article');
  for (const number of JSON.parse(fileOf(real, 'site/content-facts.json')).numbers)
    assert.ok(system.includes(number), number + ' is not listed');
  for (const phrase of JSON.parse(fileOf(real, 'site/banned-phrases.json')))
    assert.ok(system.includes(phrase), phrase + ' is not listed');
  for (const [word, use] of Object.entries(JSON.parse(fileOf(real, 'site/controlled-words.json')))) {
    assert.ok(system.includes(word + ' -> ' + use), word + ' is not listed');
  }
});

test('the limits the prompt states are the limits of the constants, not copies of them', () => {
  const article = build(real, 'article').system;
  const term = build(real, 'term').system;
  const range = ({ min, max }) => (min <= 1 ? 'at most ' + max + ' words' : min + ' to ' + max + ' words');
  for (const text of [
    range(WORD_LIMITS.shortAnswer),
    range(WORD_LIMITS.fullAnswer),
    COUNT_LIMITS.keyTakeaways.min + ' to ' + COUNT_LIMITS.keyTakeaways.max,
    COUNT_LIMITS.faq.min + ' to ' + COUNT_LIMITS.faq.max,
    CATEGORIES.join(', '),
  ]) {
    assert.ok(article.includes(text), 'the article prompt lacks ' + text);
  }
  for (const text of [range(WORD_LIMITS.shortDefinition), range(WORD_LIMITS.definition)])
    assert.ok(term.includes(text), 'the term prompt lacks ' + text);
  for (const system of [article, term])
    assert.ok(system.includes('at most ' + META_DESCRIPTION_MAX_CHARS + ' characters'));
  assert.ok(article.includes('at least ' + SOURCE_MINIMUM.article + ' sources'));
  assert.ok(term.includes('at least ' + SOURCE_MINIMUM.term + ' source'));
});

test('the prompt states the output contract: bound facts, interpretation-only own-reading, the number rule and the passage', () => {
  const { system } = build(real, 'article');
  assert.match(system, /own-reading[^\n]*interpretation only/);
  assert.match(system, /is never marked "own-reading"/);
  assert.match(system, /except years, dates and standard or article numbers/);
  assert.ok(system.includes('at most ' + PASSAGE_WORD_CAP + ' words'));
  assert.match(system, /primary/i);
  for (const domain of PRIMARY_DOMAINS) assert.ok(system.includes(domain));
  assert.match(system, /Do not write TODO\(owner\)/);
});
