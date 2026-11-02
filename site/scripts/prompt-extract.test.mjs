import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockBetween, bulletAt, declarationAt, promptBlockAt, sectionAt } from './prompt-extract.mjs';
import { WriterError } from './writer-error.mjs';

const refusal = (run, ...named) => {
  assert.throws(run, (error) => {
    assert.ok(error instanceof WriterError, 'the refusal is a WriterError');
    assert.equal(error.kind, 'config');
    for (const part of named) assert.ok(error.message.includes(part), `the message names ${part}: ${error.message}`);
    return true;
  });
};

const AGENTS = [
  '## Hard rules',
  '',
  '- Copy tone: direct and engineering. Numbers and dates instead of adjectives. No "leading",',
  '  "expert", "passionate".',
  '- Design lane: "engineering brief".',
  '- Never invent an owner fact. Unknown',
  '  facts become TODO(owner).',
  '',
  '## Tests',
].join('\n');

test('a bullet is read from its opening words through its indented continuation, and no further', () => {
  assert.equal(
    bulletAt(AGENTS, 'AGENTS.md', 'Copy tone:'),
    '- Copy tone: direct and engineering. Numbers and dates instead of adjectives. No "leading",\n  "expert", "passionate".'
  );
  assert.equal(
    bulletAt(AGENTS, 'AGENTS.md', 'Never invent an owner fact'),
    '- Never invent an owner fact. Unknown\n  facts become TODO(owner).'
  );
});

test('a bullet whose opening words changed is refused, naming the file and the opening words', () => {
  refusal(() => bulletAt(AGENTS, 'AGENTS.md', 'Copy tone is'), 'AGENTS.md', '- Copy tone is');
  refusal(
    () => bulletAt(AGENTS.replace('- Copy tone:', '- Voice:'), 'AGENTS.md', 'Copy tone:'),
    'AGENTS.md',
    '- Copy tone:'
  );
});

const GATE = [
  '# Gate',
  '',
  '### Every content page',
  '',
  '1. One h1.',
  '',
  '#### A deeper heading',
  '',
  'Kept.',
  '',
  '```',
  '# not a heading, a comment in a fence',
  '```',
  '',
  '### Articles additionally',
  '',
  '11. Takeaways.',
  '',
  '---',
  '',
  '## Half B',
  '',
  'Not part of it.',
].join('\n');

test('a section runs to the next heading of the same or a higher level and keeps deeper headings and fences', () => {
  const section = sectionAt(GATE, 'docs/GATE.md', '### Every content page');
  assert.ok(section.startsWith('### Every content page'));
  assert.ok(section.includes('#### A deeper heading'));
  assert.ok(section.includes('# not a heading, a comment in a fence'));
  assert.ok(!section.includes('Articles additionally'));
});

test('the last section before a higher heading drops the rule line that closes it', () => {
  const section = sectionAt(GATE, 'docs/GATE.md', '### Articles additionally');
  assert.equal(section, '### Articles additionally\n\n11. Takeaways.');
});

test('a heading is found by its text or by its text followed by a suffix, never by a longer word', () => {
  const core = '### Family strategy — intent, citable unit\n\nTable.\n\n### The 30 buyer prompts\n';
  assert.equal(
    sectionAt(core, 'docs/CORE.md', '### Family strategy'),
    '### Family strategy — intent, citable unit\n\nTable.'
  );
  refusal(
    () => sectionAt('### Every content pages\n\nx', 'docs/GATE.md', '### Every content page'),
    'docs/GATE.md',
    '### Every content page'
  );
});

test('a section whose heading is gone is refused, naming the file and the heading', () => {
  refusal(() => sectionAt(GATE, 'docs/GATE.md', '### Honesty rows'), 'docs/GATE.md', '### Honesty rows');
});

const CONFIG = [
  'const CATEGORIES = [1] as const;',
  '',
  'const source = z.object({',
  '  title: z.string(),',
  '});',
  '',
  'const postCollection = defineCollection({',
  '  loader: glob({}),',
  '});',
  '',
  'const glossaryCollection = defineCollection({',
  '  schema: z.object({',
  '    term: z.string(),',
  '  }),',
  '});',
  '',
  'export const collections = {};',
].join('\n');

test('a declaration is read from its opening line to the first line that closes it', () => {
  assert.equal(
    declarationAt(CONFIG, 'site/src/content.config.ts', 'const glossaryCollection = defineCollection('),
    'const glossaryCollection = defineCollection({\n  schema: z.object({\n    term: z.string(),\n  }),\n});'
  );
});

test('a declaration that is gone is refused, naming the file and its opening line', () => {
  refusal(
    () => declarationAt(CONFIG, 'site/src/content.config.ts', 'const serviceCollection = defineCollection('),
    'site/src/content.config.ts',
    'const serviceCollection = defineCollection('
  );
  refusal(
    () =>
      declarationAt(
        'const x = defineCollection({\n  a: 1,\n',
        'site/src/content.config.ts',
        'const x = defineCollection('
      ),
    'site/src/content.config.ts',
    '});'
  );
});

test('the shared helpers run from their first line up to the first collection, which they do not include', () => {
  const helpers = blockBetween(
    CONFIG,
    'site/src/content.config.ts',
    'const CATEGORIES',
    'const postCollection = defineCollection('
  );
  assert.equal(helpers, 'const CATEGORIES = [1] as const;\n\nconst source = z.object({\n  title: z.string(),\n});');
});

test('a block with either boundary gone is refused, naming the file and that boundary', () => {
  refusal(
    () => blockBetween(CONFIG, 'site/src/content.config.ts', 'const MISSING', 'const postCollection'),
    'const MISSING'
  );
  refusal(
    () => blockBetween(CONFIG, 'site/src/content.config.ts', 'const CATEGORIES', 'const MISSING'),
    'const MISSING'
  );
});

const PROMPTS = [
  '#### Entity and offer prompts',
  '',
  '**1. who is a fractional chief AI officer**',
  'Must win: `/`.',
  'Passage: "one."',
  '',
  '**10. LLM gateway for governance**',
  'Must win: ten.',
  '',
  '**16. fractional AI officer Israel**',
  '**17. fractional AI leader Europe remote**',
  'Must win: nothing.',
  '',
  '#### Engineering prompts',
  '',
  '**30. board memo**',
  'Must win: last.',
].join('\n');

test('a buyer prompt block runs from its number to the next number, and one is not ten', () => {
  assert.equal(
    promptBlockAt(PROMPTS, 'docs/SEMANTIC-CORE.md', 1),
    '**1. who is a fractional chief AI officer**\nMust win: `/`.\nPassage: "one."'
  );
  assert.equal(
    promptBlockAt(PROMPTS, 'docs/SEMANTIC-CORE.md', 10),
    '**10. LLM gateway for governance**\nMust win: ten.'
  );
});

test('a buyer prompt block stops at a heading, at the next number and at the end of the file', () => {
  assert.equal(promptBlockAt(PROMPTS, 'docs/SEMANTIC-CORE.md', 16), '**16. fractional AI officer Israel**');
  assert.equal(
    promptBlockAt(PROMPTS, 'docs/SEMANTIC-CORE.md', 17),
    '**17. fractional AI leader Europe remote**\nMust win: nothing.'
  );
  assert.equal(promptBlockAt(PROMPTS, 'docs/SEMANTIC-CORE.md', 30), '**30. board memo**\nMust win: last.');
});

test('a buyer prompt number with no block is refused, naming the file and the number anchor', () => {
  refusal(() => promptBlockAt(PROMPTS, 'docs/SEMANTIC-CORE.md', 4), 'docs/SEMANTIC-CORE.md', '**4. ');
});
