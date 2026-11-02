import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { claimFor, cleanDraft, RUN_DATE } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { MAY } from './repair-guard.mjs';
import { buildPrompt } from './writer-prompt.mjs';
import { ALLOWANCE_TEXT, buildRepairPrompt, repairCorrectionMessage } from './writer-prompt-repair.mjs';

const FORMATS = ['term', 'article'];
const ATTEMPT = { number: 2, of: 3 };
const FINDINGS = [
  {
    gate: 'gate:content',
    rule: 'banned-phrase',
    subjects: ['/blog/the-slug', 'site/src/data/post/the-slug.md'],
    detail: 'the phrase "leverage" is banned',
    excerpt: 'We leverage the pilot plan to unblock the team.',
  },
  { gate: 'gate:links', rule: 'dead-anchor', subjects: ['/blog/the-slug'], detail: '', excerpt: '' },
];

const root = makeRepo();
after(() => removeRepo(root));

const repair = (format, overrides = {}) =>
  buildRepairPrompt({
    repoRoot: root,
    claim: claimFor(format),
    before: cleanDraft(format),
    findings: FINDINGS,
    allowances: [],
    attempt: ATTEMPT,
    ...overrides,
  });
const write = (format) => buildPrompt({ repoRoot: root, claim: claimFor(format), runDate: RUN_DATE });

test('every allowance of the guard has a sentence, and no sentence has no allowance', () => {
  assert.deepEqual(Object.keys(ALLOWANCE_TEXT).sort(), [...MAY].sort());
  for (const text of Object.values(ALLOWANCE_TEXT)) assert.ok(text.endsWith('.') && text.length > 20);
});

test('the words-down allowance says the entry may shrink to three quarters and never by dropping a sentence', () => {
  assert.match(ALLOWANCE_TEXT['words-down'], /three quarters/);
  assert.match(ALLOWANCE_TEXT['words-down'], /never by dropping a sentence/);
});

for (const format of FORMATS) {
  test(`${format}: the repair system message is the system message of the write prompt`, () => {
    assert.equal(repair(format).system, write(format).system);
  });

  test(`${format}: the user message opens with the repair line and carries the claim facts and the attempt`, () => {
    const { user } = repair(format);
    const claim = claimFor(format);
    assert.ok(user.startsWith('Repair this entry.\n\n- Format: '));
    assert.ok(user.includes(`- Slug: ${claim.slug}`));
    assert.ok(user.includes(`- Buyer prompt ${claim.prompt.number}: ${claim.prompt.text}`));
    assert.ok(user.includes('- Attempt: 2 of 3.'));
    assert.match(user, /published date and the updated date are not yours to change/);
  });

  test(`${format}: every finding reaches the model with its rule, subjects, detail and excerpt`, () => {
    const { user } = repair(format);
    const found = user.slice(user.indexOf('# What CI found'), user.indexOf('# What a repair never does'));
    for (const { gate, rule, subjects, detail, excerpt } of FINDINGS) {
      assert.ok(found.includes(gate) && found.includes(rule));
      assert.ok(found.includes(subjects.join(', ')));
      if (detail) assert.ok(found.includes(`detail: ${detail}`));
      if (excerpt) assert.ok(found.includes(`text: ${excerpt}`));
    }
    assert.match(found, /1\. /);
    assert.match(found, /2\. /);
  });

  test(`${format}: the entry, the frozen passage, the block of the buyer prompt and the context lists are in the user message`, () => {
    const { user } = repair(format);
    const before = cleanDraft(format);
    const sentence = before.body.split('\n').find((line) => line.length > 40);
    assert.ok(user.includes(JSON.stringify(before, null, 2)));
    assert.ok(user.includes(sentence.trim()));
    assert.ok(user.includes(before.passage));
    assert.ok(user.includes('```json'));
    const written = write(format).user;
    const tail = written.slice(written.indexOf('Routes that exist'));
    assert.ok(user.includes(tail));
    const block = written.slice(
      written.indexOf('The block of docs/SEMANTIC-CORE.md'),
      written.indexOf('Routes that exist')
    );
    assert.ok(user.includes(block.split(':\n').slice(1).join(':\n').trim()));
  });

  test(`${format}: the user message has no run date and is not a write request`, () => {
    const { user } = repair(format, { allowances: [...MAY] });
    assert.ok(!user.includes('Run date'));
    assert.ok(!user.includes('Write this entry'));
  });

  test(`${format}: the user message ends by asking for the complete corrected output`, () => {
    const { user } = repair(format);
    const last = user.split('\n').at(-1);
    assert.match(last, /complete corrected output/);
    assert.match(last, /every member/);
    assert.match(last, /same JSON shape/);
  });

  test(`${format}: the schema digest is the one of the write prompt, the digest moves with a finding`, () => {
    const base = repair(format);
    assert.equal(base.schemaDigest, write(format).schemaDigest);
    assert.equal(base.maxOutputTokens, write(format).maxOutputTokens);
    assert.deepEqual(base.files, write(format).files);
    const changed = repair(format, { findings: [{ ...FINDINGS[0], rule: 'other-rule' }, FINDINGS[1]] });
    assert.notEqual(changed.digest, base.digest);
    assert.notEqual(base.digest, write(format).digest);
  });
}

test('a repair never deletes: the section says so and prints the passage to keep', () => {
  const { user } = repair('article');
  const never = user.slice(user.indexOf('# What a repair never does'), user.indexOf('# The entry as it stands'));
  assert.match(never, /never deletes/);
  assert.match(never, /refuse a rewrite that lost any/);
  assert.match(never, /every heading, FAQ item, key takeaway, source and claim row/);
  assert.ok(never.includes(cleanDraft('article').passage));
  assert.match(never, /adds no fact/);
});

test('the allowances section lists each allowance asked for with its text, and is absent when none is', () => {
  const asked = repair('article', { allowances: ['words-down', 'faq'] }).user;
  const section = asked.slice(asked.indexOf('# What the failing rules allow'));
  assert.ok(asked.includes('# What the failing rules allow'));
  assert.ok(section.includes(ALLOWANCE_TEXT['words-down']));
  assert.ok(section.includes(ALLOWANCE_TEXT.faq));
  assert.ok(!section.includes(ALLOWANCE_TEXT.sources));
  const none = repair('article', { allowances: [] }).user;
  assert.ok(!none.includes('# What the failing rules allow'));
  assert.ok(!none.includes(ALLOWANCE_TEXT['words-down']));
});

test('a finding with an empty excerpt prints no text line, and an empty detail prints no detail line', () => {
  const { user } = repair('article', { findings: [FINDINGS[1]] });
  const found = user.slice(user.indexOf('# What CI found'), user.indexOf('# What a repair never does'));
  assert.ok(!found.includes('text:'));
  assert.ok(!found.includes('detail:'));
  assert.ok(found.includes('dead-anchor'));
});

test('an allowance the guard does not know is refused', () => {
  assert.throws(() => repair('article', { allowances: ['everything'] }), RangeError);
});

const PROBLEMS = [
  { rule: 'word-range', detail: 'the body has 900 words' },
  { rule: 'claim-row', detail: 'sentence 4 has no row' },
];

test('the repair correction message numbers the problems and asks for the whole output', () => {
  const lines = repairCorrectionMessage(PROBLEMS).split('\n');
  assert.ok(lines.includes('1. word-range: the body has 900 words'));
  assert.ok(lines.includes('2. claim-row: sentence 4 has no row'));
  assert.ok(
    lines.indexOf('1. word-range: the body has 900 words') < lines.indexOf('2. claim-row: sentence 4 has no row')
  );
  assert.match(repairCorrectionMessage(PROBLEMS), /every member/);
});

test('the repair correction message never tells the model to remove text', () => {
  const message = repairCorrectionMessage(PROBLEMS);
  assert.ok(!message.includes('remove the text'));
  assert.ok(!/or remove/.test(message));
  assert.ok(message.includes('never delete'));
  assert.match(message, /Reword instead of removing/);
  assert.match(message, /add no fact/);
});

test('there is no repair correction message for no problems', () => {
  assert.throws(() => repairCorrectionMessage([]), RangeError);
});
