import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { claimFor, cleanDraft } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { buildPrompt, PROMPT_SOURCES, promptSourcesFor } from './writer-prompt.mjs';
import { readSources } from './writer-prompt-read.mjs';
import { buildRepairPrompt } from './writer-prompt-repair.mjs';

const FACTS_FILE = 'site/content-facts.json';
const FORMATS = ['term', 'article'];
const RUN_DATE = '2026-11-02';

const roots = [];
const rootWithNumbers = (numbers) => {
  const root = makeRepo();
  roots.push(root);
  if (numbers !== undefined) {
    const facts = JSON.parse(readFileSync(join(root, FACTS_FILE), 'utf8'));
    writeFileSync(join(root, FACTS_FILE), JSON.stringify({ ...facts, numbers }));
  }
  return root;
};
after(() => roots.forEach(removeRepo));

const numbersParagraphs = (root, format) => {
  const { system } = buildPrompt({ repoRoot: root, claim: claimFor(format), runDate: RUN_DATE });
  return system.slice(system.indexOf('# Numbers'), system.indexOf('# Banned phrases')).trim().split('\n\n');
};

for (const format of FORMATS) {
  test(`the ${format} prompt tells an empty list of allowed numbers in one plain sentence: no other number is verified, so none is written`, () => {
    const [heading, body, rule] = numbersParagraphs(rootWithNumbers([]), format);
    assert.equal(heading, '# Numbers');
    assert.match(
      body,
      /^Write no number except years, dates and standard or article numbers \(.+\)\. No other number is verified, so write none\.$/
    );
    assert.ok(!body.includes('allowed numbers'));
    assert.match(rule, /^Any other figure fails the gate as unsourced-number\./);
  });

  test(`the ${format} prompt tells a list of allowed numbers whole, and the sentence of the empty list never shows beside it`, () => {
    const root = rootWithNumbers();
    const { numbers } = JSON.parse(readFileSync(join(root, FACTS_FILE), 'utf8'));
    assert.ok(numbers.length > 0);
    const [, body] = numbersParagraphs(root, format);
    assert.ok(body.endsWith(`, and the allowed numbers: ${numbers.join(', ')}.`));
    assert.ok(!body.includes('is verified'));
  });
}

const CORE = 'docs/SEMANTIC-CORE.md';
const ATTEMPT = { number: 1, of: 3 };

const withoutPrompt = (overrides) => {
  const rest = Object.fromEntries(Object.entries(claimFor('article')).filter(([key]) => key !== 'prompt'));
  return { ...rest, ...overrides };
};

const WEAK = withoutPrompt({
  origin: 'weak-demand',
  weakness: ['no-buyer-prompt'],
  demand: { impressions: 37, position: 14.8 },
});
const CATEGORY = withoutPrompt({
  origin: 'category',
  category: 'agentic-architecture',
  demand: { impressions: 0, position: null },
});
const PROMPTLESS = { 'weak-demand': WEAK, category: CATEGORY };

const hereRoot = makeRepo();
after(() => removeRepo(hereRoot));

const build = (claim, repoRoot = hereRoot) => buildPrompt({ repoRoot, claim, runDate: RUN_DATE });
const linesOf = (text, opener) => text.split('\n').filter((line) => line.startsWith(opener));
const countOf = (text, word) => text.split(word).length - 1;
const withoutOrigin = (text) =>
  text
    .split('\n')
    .filter((line) => !line.startsWith('- Origin:'))
    .join('\n');
const kindsOf = (sources) =>
  sources.flatMap(({ take }) => take.map(({ kind }) => kind)).filter((kind) => kind !== 'promptBlock');

test('the sources of a claim with a buyer prompt are the sources of the module, unchanged', () => {
  assert.deepEqual(promptSourcesFor(claimFor('article')), PROMPT_SOURCES);
  assert.deepEqual(promptSourcesFor(claimFor('term')), PROMPT_SOURCES);
});

for (const [origin, claim] of Object.entries(PROMPTLESS)) {
  test(`${origin}: the sources of a claim with no buyer prompt hold no promptBlock and keep every other take`, () => {
    const sources = promptSourcesFor(claim);
    assert.ok(!sources.some(({ take }) => take.some(({ kind }) => kind === 'promptBlock')));
    assert.deepEqual(
      sources.map(({ path }) => path),
      PROMPT_SOURCES.map(({ path }) => path)
    );
    assert.deepEqual(kindsOf(sources), kindsOf(PROMPT_SOURCES));
    assert.ok(PROMPT_SOURCES.some(({ take }) => take.some(({ kind }) => kind === 'promptBlock')));
  });

  test(`${origin}: reading the sources of the claim yields no promptBlock and still reads the core file`, () => {
    const read = readSources({ repoRoot: hereRoot, claim, sources: promptSourcesFor(claim) });
    assert.ok(!('promptBlock' in read.data));
    assert.ok(read.files.some(({ path }) => path === CORE));
    assert.ok(read.texts.some(({ path }) => path === CORE));
  });

  test(`${origin}: the block of the buyer prompt is not read, so a core that lacks every prompt block still builds`, () => {
    const bare = makeRepo();
    try {
      const text = readFileSync(join(bare, CORE), 'utf8');
      writeFileSync(join(bare, CORE), text.replace(/^\*\*\d+\. /gm, 'GONE '));
      assert.throws(() => build(claimFor('article'), bare), /SEMANTIC-CORE/);
      assert.doesNotThrow(() => build(claim, bare));
    } finally {
      removeRepo(bare);
    }
  });

  test(`${origin}: no buyer-prompt sentence is in the claim text, the length rule or the passage rule`, () => {
    const { system, user } = build(claim);
    const [length] = linesOf(system, '- length of the body');
    const [passage] = linesOf(system, '- passage:');
    for (const text of [length, passage, withoutOrigin(user)])
      assert.ok(!/buyer prompt/i.test(text), text.slice(0, 80));
    assert.ok(!user.includes('The block of docs/SEMANTIC-CORE.md'));
    assert.ok(length.includes(`for the query "${claim.query}"`));
    assert.ok(passage.includes('should quote for the query.'));
  });

  test(`${origin}: the user prompt holds no undefined and no null, and the system prompt holds no more than the demand one`, () => {
    const { system, user } = build(claim);
    const demand = build(claimFor('article'));
    assert.ok(!/undefined|null|\[object/.test(user));
    for (const word of ['undefined', 'null', '[object'])
      assert.equal(countOf(system, word), countOf(demand.system, word), word);
  });

  test(`${origin}: the repair prompt holds no undefined, no buyer-prompt line and names the origin`, () => {
    const { user } = buildRepairPrompt({
      repoRoot: hereRoot,
      claim,
      before: cleanDraft('article'),
      findings: [{ gate: 'gate:content', rule: 'banned-phrase', subjects: [], detail: '', excerpt: '' }],
      allowances: [],
      attempt: ATTEMPT,
    });
    assert.ok(!/undefined/.test(user));
    assert.ok(!/buyer prompt/i.test(withoutOrigin(user)));
    assert.ok(user.includes(`- Origin: ${origin}.`));
  });
}

test('weak-demand: the entry is said to rest on a measured query with its impressions and position and no buyer prompt', () => {
  const { user } = build(WEAK);
  const [origin] = linesOf(user, '- Origin:');
  assert.ok(origin.startsWith('- Origin: weak-demand.'));
  assert.ok(origin.includes('Search Console'));
  assert.ok(origin.includes('37 impressions'));
  assert.ok(origin.includes('average position 14.8'));
  assert.ok(origin.includes('no buyer prompt backs it'));
  assert.ok(origin.includes(WEAK.query));
});

test('category: the entry is said to cover the named category with the target query and no measured demand', () => {
  const { user } = build(CATEGORY);
  const [origin] = linesOf(user, '- Origin:');
  assert.ok(origin.startsWith('- Origin: category.'));
  assert.ok(origin.includes('agentic-architecture'));
  assert.ok(origin.includes(CATEGORY.query));
  assert.ok(origin.includes('no measured demand exists for it yet'));
  assert.ok(origin.includes('exactly one question'));
  assert.ok(origin.includes('define no concept that the concept register of docs/SEMANTIC-CORE.md assigns elsewhere'));
  assert.ok(!origin.includes('Search Console'));
});

test('category: the user prompt tells the model to set the category field to the claim category, and the other origins do not', () => {
  const [origin] = linesOf(build(CATEGORY).user, '- Origin:');
  assert.ok(origin.includes('Set the category field of the entry to "agentic-architecture".'));
  assert.ok(!linesOf(build(WEAK).user, '- Origin:')[0].includes('Set the category field'));
});

test('a claim with a buyer prompt keeps its buyer-prompt sentences and gains no origin line', () => {
  const claim = claimFor('article');
  const { system, user } = build(claim);
  assert.ok(user.includes(`- Buyer prompt ${claim.prompt.number}: ${claim.prompt.text}`));
  assert.ok(user.includes('The block of docs/SEMANTIC-CORE.md for this buyer prompt, copied from the file:\n**22. '));
  assert.ok(system.includes(`for buyer prompt ${claim.prompt.number}, "${claim.prompt.text}".`));
  assert.ok(system.includes('a passage of the block of that buyer prompt or a source you cite'));
  assert.ok(system.includes('asks a question a buyer asks on the way to that prompt'));
  assert.ok(system.includes('should quote for the buyer prompt.'));
  assert.ok(!user.includes('- Origin:'));
});
