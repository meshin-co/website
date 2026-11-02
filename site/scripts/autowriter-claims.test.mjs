import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CLAIM_DIR,
  CLAIM_FORMATS,
  CLAIM_STATUSES,
  claimFile,
  claimFileProblem,
  GENERATED_BEGIN,
  GENERATED_END,
  generatedTitles,
  isHolding,
  normaliseTitle,
  titleCollisions,
  validateClaim,
} from './autowriter-claims.mjs';
import { describeProblem } from './autowriter-records.mjs';

const SUFFIX = ' — meshin.co';
const NOW = new Date('2026-11-02T07:00:00.000Z');
const CLAIMED = '2026-11-01T07:00:00.000Z';
const LIVE = '2026-11-15T07:00:00.000Z';
const LAPSED = '2026-10-20T07:00:00.000Z';

const claim = (extra = {}) => ({
  schema: 1,
  slug: 'what-is-a-model-card',
  title: 'What is a model card?',
  format: 'term',
  query: 'model card',
  demand: { impressions: 14, position: 11.2 },
  prompt: { number: 7, text: 'How do I document a model for a security review?' },
  runId: '9001',
  status: 'claimed',
  claimedAt: CLAIMED,
  expiresAt: LIVE,
  ...extra,
});
const filed = (name, extra = {}) => ({ path: claimFile(name), claim: claim({ slug: name, ...extra }) });
const problemsText = (value) => validateClaim(value).map(describeProblem);

const CORE = [
  'intro',
  '<!-- semantic-core:begin generated -->',
  '### static (2)',
  '',
  'title `{page name} — meshin.co`',
  '',
  '| Route    | Query | Title                                | Description |',
  '| -------- | ----- | ------------------------------------ | ----------- |',
  '| `/`      | home  | Fractional Chief AI Officer — meshin.co | text |',
  '| `/about` | about | About Dmitri Meshin — meshin.co      | text |',
  '',
  '### term (2)',
  '',
  '| Route                  | Query          | Title                                  | Description | H1 |',
  '| ---------------------- | -------------- | -------------------------------------- | ----------- | -- |',
  '| `/glossary/ai-system`  | ai system      | What is an AI system? — meshin.co      | text | AI system |',
  "| `/glossary/bias`       | bias           | What's algorithmic bias? — meshin.co   | text | Bias |",
  '<!-- semantic-core:end generated -->',
  'outro',
].join('\n');

test('claims live beside the ledgers, one file per slug, in the two formats the writer writes', () => {
  assert.equal(CLAIM_DIR, 'audits/autowriter/claims');
  assert.equal(claimFile('what-is-a-model-card'), 'audits/autowriter/claims/what-is-a-model-card.json');
  assert.deepEqual(CLAIM_FORMATS, ['term', 'article']);
  assert.deepEqual(CLAIM_STATUSES, ['claimed', 'written']);
});

test('a well-formed claim has no problems, for an unproven prompt as much as for a measured one', () => {
  assert.deepEqual(validateClaim(claim()), []);
  assert.deepEqual(validateClaim(claim({ demand: { impressions: 0, position: null } })), []);
  assert.deepEqual(validateClaim(claim({ status: 'written' })), []);
});

const withoutQuery = Object.fromEntries(Object.entries(claim()).filter(([key]) => key !== 'query'));

const DEFECTS = [
  ['an unknown field', { ...claim(), score: 3 }, 'score has an unexpected key'],
  ['a missing field', withoutQuery, 'query is required'],
  ['an unknown format', claim({ format: 'video' }), 'format must be one of "term", "article"'],
  ['an unknown status', claim({ status: 'done' }), 'status must be one of "claimed", "written"'],
  ['a blank title', claim({ title: ' ' }), 'title must match pattern \\S'],
  ['an upper-case slug', claim({ slug: 'What-Is' }), 'slug must match pattern ^[a-z0-9]+(-[a-z0-9]+)*$'],
  [
    'fractional impressions',
    claim({ demand: { impressions: 1.5, position: 9 } }),
    'demand.impressions must be of type integer',
  ],
  ['a position above the first', claim({ demand: { impressions: 3, position: 0.4 } }), 'demand.position must be >= 1'],
  ['a prompt number of zero', claim({ prompt: { number: 0, text: 'x' } }), 'prompt.number must be >= 1'],
  [
    'an impossible calendar day',
    claim({ claimedAt: '2026-02-31T00:00:00.000Z' }),
    'claimedAt must be a real calendar instant, got "2026-02-31T00:00:00.000Z"',
  ],
  [
    'an expiry before the claim',
    claim({ expiresAt: '2026-10-31T07:00:00.000Z' }),
    'expiresAt must be later than claimedAt',
  ],
  ['an expiry equal to the claim', claim({ expiresAt: CLAIMED }), 'expiresAt must be later than claimedAt'],
  [
    'impressions that have no position',
    claim({ demand: { impressions: 9, position: null } }),
    'demand.position must be a number when impressions is above 0',
  ],
  [
    'a position that has no impressions',
    claim({ demand: { impressions: 0, position: 12 } }),
    'demand.position must be null when impressions is 0',
  ],
];

for (const [name, value, expected] of DEFECTS) {
  test('a claim with ' + name + ' is refused naming the field', () => {
    assert.ok(problemsText(value).includes(expected), problemsText(value).join(' | '));
  });
}

test('a claim that is not an object is refused as a whole', () => {
  assert.deepEqual(problemsText('x'), ['the file must be of type object']);
  assert.deepEqual(problemsText(null), ['the file must be of type object']);
});

test('the file name must be the slug, so one slug cannot be held by two files', () => {
  assert.equal(claimFileProblem('audits/autowriter/claims/what-is-a-model-card.json', claim()), null);
  assert.equal(
    claimFileProblem('audits/autowriter/claims/other.json', claim()),
    'slug what-is-a-model-card does not match the file name other.json'
  );
});

test('a title compares equal after case folding, accents, apostrophes, punctuation and the brand suffix', () => {
  const same = [
    'What is an AI system?',
    'what is an ai system',
    'WHAT IS AN AI SYSTEM!!',
    'What is an AI system? — meshin.co',
    '  What  is an  AI-system ',
  ];
  for (const title of same) assert.equal(normaliseTitle(title, SUFFIX), 'what is an ai system', title);
  assert.equal(normaliseTitle("What's algorithmic bias?", SUFFIX), normaliseTitle('Whats algorithmic bias', SUFFIX));
  assert.equal(normaliseTitle('Café policy', SUFFIX), normaliseTitle('cafe policy', SUFFIX));
  assert.notEqual(normaliseTitle('What is an AI system?', SUFFIX), normaliseTitle('What is an AI agent?', SUFFIX));
  assert.equal(normaliseTitle('Beta 2 test', SUFFIX) === normaliseTitle('Beta 3 test', SUFFIX), false);
});

test('the generated layer yields every row title with its route and family, and nothing outside the markers', () => {
  assert.deepEqual(generatedTitles(CORE), [
    { family: 'static', route: '/', title: 'Fractional Chief AI Officer — meshin.co' },
    { family: 'static', route: '/about', title: 'About Dmitri Meshin — meshin.co' },
    { family: 'term', route: '/glossary/ai-system', title: 'What is an AI system? — meshin.co' },
    { family: 'term', route: '/glossary/bias', title: "What's algorithmic bias? — meshin.co" },
  ]);
  const outside = CORE.replace('outro', '| `/outside` | q | Outside the markers — meshin.co | d |');
  assert.equal(
    generatedTitles(outside).some(({ route }) => route === '/outside'),
    false
  );
});

test('a core without both markers is refused by name instead of reading as an empty layer', () => {
  assert.throws(() => generatedTitles('# no markers'), /no generated layer/);
  assert.throws(() => generatedTitles(CORE.replace('<!-- semantic-core:end generated -->', '')), /no generated layer/);
});

test('an open claim holds its title until it expires, and a written claim holds it for good', () => {
  assert.equal(isHolding(claim(), NOW), true);
  assert.equal(isHolding(claim({ expiresAt: LAPSED }), NOW), false);
  assert.equal(isHolding(claim({ expiresAt: NOW.toISOString() }), NOW), false);
  assert.equal(isHolding(claim({ status: 'written', expiresAt: LAPSED }), NOW), true);
});

const generated = generatedTitles(CORE);
const collide = (claims) => titleCollisions({ claims, generated, suffix: SUFFIX, now: NOW });

test('an open claim whose title is already a title in the generated layer is refused, naming the route', () => {
  const found = collide([filed('what-is-an-ai-system', { title: 'what is an AI system' })]);
  assert.deepEqual(found, [
    {
      path: 'audits/autowriter/claims/what-is-an-ai-system.json',
      detail:
        'title "what is an AI system" is already the title of /glossary/ai-system in the generated layer of docs/SEMANTIC-CORE.md ("What is an AI system? — meshin.co")',
    },
  ]);
});

test('a title is checked in every family of the layer, not only the one the claim names', () => {
  const found = collide([filed('about', { title: 'About Dmitri Meshin', format: 'term' })]);
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /already the title of \/about in the generated layer/);
});

test('two open claims on one title are both refused, each naming the other', () => {
  const found = collide([
    filed('what-is-a-card', { title: 'What is a card?' }),
    filed('card-explained', { title: 'what is a card' }),
  ]);
  assert.deepEqual(
    found.map(({ path }) => path),
    [claimFile('what-is-a-card'), claimFile('card-explained')]
  );
  assert.match(found[0].detail, /also claimed by audits\/autowriter\/claims\/card-explained\.json/);
  assert.match(found[1].detail, /also claimed by audits\/autowriter\/claims\/what-is-a-card\.json/);
});

test('an open claim that repeats a written claim is refused, and the written claim is left alone', () => {
  const found = collide([
    filed('what-is-a-card', { title: 'What is a card?', status: 'written' }),
    filed('card-explained', { title: 'what is a card' }),
  ]);
  assert.deepEqual(
    found.map(({ path }) => path),
    [claimFile('card-explained')]
  );
});

test('a written claim repeating the layer is not a collision, because its own entry is the layer title', () => {
  assert.deepEqual(collide([filed('what-is-an-ai-system', { title: 'What is an AI system?', status: 'written' })]), []);
});

test('a lapsed claim holds nothing: it neither collides nor makes another claim collide', () => {
  const lapsed = filed('what-is-a-ledger', { title: 'What is a ledger?', expiresAt: LAPSED });
  assert.deepEqual(collide([lapsed]), []);
  const other = filed('ledgers-explained', { title: 'what is a ledger' });
  assert.deepEqual(collide([lapsed, other]), []);
  assert.deepEqual(collide([other, lapsed]), []);
});

test('no claims, or claims on new titles, are no collisions', () => {
  assert.deepEqual(collide([]), []);
  assert.deepEqual(collide([filed('what-is-a-model-card')]), []);
});

test('the real generated layer is read whole: one title per route row, in every family the core names', () => {
  const doc = readFileSync(new URL('../../docs/SEMANTIC-CORE.md', import.meta.url), 'utf8');
  const block = doc.slice(doc.indexOf(GENERATED_BEGIN), doc.indexOf(GENERATED_END));
  const routeRows = block.split('\n').filter((line) => line.startsWith('| `'));
  const rows = generatedTitles(doc);
  assert.equal(rows.length, routeRows.length);
  assert.ok(rows.length > 50, `only ${rows.length} titles read`);
  assert.ok(
    rows.every(({ title }) => title.endsWith(SUFFIX)),
    'a title lost its brand suffix'
  );
  for (const family of ['static', 'term', 'faq-answer', 'article']) {
    assert.ok(
      rows.some((row) => row.family === family),
      `no ${family} title was read`
    );
  }
});

test('the markers are the ones semantic-core.mjs writes, so the two files cannot drift apart', async () => {
  const core = await import('./semantic-core.mjs');
  assert.equal(GENERATED_BEGIN, core.GENERATED_BEGIN);
  assert.equal(GENERATED_END, core.GENERATED_END);
});
