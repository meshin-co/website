import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';

import {
  CLAIM_FORMATS,
  CLAIM_STATUSES,
  claimFileProblem,
  GENERATED_BEGIN,
  GENERATED_END,
  generatedTitles,
  isHolding,
  normaliseTitle,
  ORIGINS,
  originOf,
  originProblems,
  titleCollisions,
  validateClaim,
  WEAKNESS_REASONS,
} from './autowriter-claims.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { CATEGORIES } from './entry-limits.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';
import { siteBrand } from './site-brand.mjs';

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
const filed = (name, extra = {}) => {
  const value = claim({ slug: name, ...extra });
  return { path: recordPath('claim', name, value.claimedAt), claim: value };
};
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

test('claims live beside the ledgers, one file per slug filed by month, in the two formats the writer writes', () => {
  assert.equal(recordDirectory('claim'), 'audits/autowriter/claims');
  assert.equal(
    recordPath('claim', 'what-is-a-model-card', CLAIMED),
    'audits/autowriter/claims/2026/11/what-is-a-model-card.json'
  );
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
  assert.equal(claimFileProblem(recordPath('claim', 'what-is-a-model-card', CLAIMED), claim()), null);
  assert.equal(
    claimFileProblem(recordPath('claim', 'other', CLAIMED), claim()),
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
      path: recordPath('claim', 'what-is-an-ai-system', CLAIMED),
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
    [recordPath('claim', 'what-is-a-card', CLAIMED), recordPath('claim', 'card-explained', CLAIMED)]
  );
  assert.ok(
    found[0].detail.includes('is also claimed by ' + recordPath('claim', 'card-explained', CLAIMED)),
    found[0].detail
  );
  assert.ok(
    found[1].detail.includes('is also claimed by ' + recordPath('claim', 'what-is-a-card', CLAIMED)),
    found[1].detail
  );
});

test('two open claims on one title are refused when they were made in different months, each naming the other', () => {
  const found = collide([
    filed('what-is-a-card', { title: 'What is a card?', claimedAt: '2026-10-25T07:00:00.000Z' }),
    filed('card-explained', { title: 'what is a card' }),
  ]);
  const october = 'audits/autowriter/claims/2026/10/what-is-a-card.json';
  const november = 'audits/autowriter/claims/2026/11/card-explained.json';
  assert.deepEqual(
    found.map(({ path }) => path),
    [october, november]
  );
  assert.ok(found[0].detail.endsWith('is also claimed by ' + november), found[0].detail);
  assert.ok(found[1].detail.endsWith('is also claimed by ' + october), found[1].detail);
});

test('an open claim that repeats a written claim is refused, and the written claim is left alone', () => {
  const found = collide([
    filed('what-is-a-card', { title: 'What is a card?', status: 'written' }),
    filed('card-explained', { title: 'what is a card' }),
  ]);
  assert.deepEqual(
    found.map(({ path }) => path),
    [recordPath('claim', 'card-explained', CLAIMED)]
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
  const named = [...block.matchAll(/^### ([a-z-]+) \((\d+)\)/gm)].map(([, family, count]) => [family, Number(count)]);
  const rows = generatedTitles(doc);
  const suffix = titleSuffix(siteBrand());
  assert.equal(rows.length, routeRows.length);
  assert.ok(rows.length > 0, 'no title was read');
  assert.ok(
    rows.every(({ title }) => title.endsWith(suffix)),
    'a title lost its brand suffix'
  );
  assert.ok(named.length > 0, 'the core names no family');
  for (const [family, count] of named) {
    assert.equal(rows.filter((row) => row.family === family).length, count, `${family} titles read`);
  }
});

test('the markers are the ones semantic-core.mjs writes, so the two files cannot drift apart', async () => {
  const core = await import('./semantic-core.mjs');
  assert.equal(GENERATED_BEGIN, core.GENERATED_BEGIN);
  assert.equal(GENERATED_END, core.GENERATED_END);
});

const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const demandClaim = (extra = {}) => claim({ origin: 'demand', ...extra });
const weakClaim = (extra = {}) => ({
  ...without(claim(), 'prompt'),
  format: 'article',
  demand: { impressions: 9, position: 91.8 },
  origin: 'weak-demand',
  weakness: ['no-buyer-prompt'],
  ...extra,
});
const categoryClaim = (extra = {}) => ({
  ...without(claim(), 'prompt'),
  format: 'article',
  demand: { impressions: 0, position: null },
  origin: 'category',
  category: 'governance',
  ...extra,
});
const quoted = (values) => values.map((value) => JSON.stringify(value)).join(', ');

test('the origins are the three rungs of the picker, and the weakness reasons are the three things a weak query lacks', () => {
  assert.deepEqual(ORIGINS, ['demand', 'weak-demand', 'category']);
  assert.deepEqual(WEAKNESS_REASONS, ['no-buyer-prompt', 'impressions-at-floor', 'position-beyond-strengthen-band']);
});

test('a claim with no origin is a demand claim, because the picker had one rung before the origin existed', () => {
  assert.equal(originOf({}), 'demand');
  assert.equal(originOf(claim()), 'demand');
  for (const origin of ORIGINS) assert.equal(originOf({ origin }), origin);
});

test('a well-formed claim of every origin has no problems, and so has a claim written before the origin existed', () => {
  assert.deepEqual(validateClaim(claim()), []);
  assert.deepEqual(validateClaim(demandClaim()), []);
  assert.deepEqual(validateClaim(demandClaim({ demand: { impressions: 0, position: null } })), []);
  assert.deepEqual(validateClaim(weakClaim()), []);
  assert.deepEqual(validateClaim(weakClaim({ weakness: [...WEAKNESS_REASONS] })), []);
  for (const category of CATEGORIES) assert.deepEqual(validateClaim(categoryClaim({ category })), [], category);
});

const ORIGIN_DEFECTS = [
  ['a demand claim with no prompt', without(demandClaim(), 'prompt'), ['prompt is required when origin is demand']],
  ['a claim with no origin and no prompt', without(claim(), 'prompt'), ['prompt is required when origin is demand']],
  [
    'a demand claim that names a category',
    demandClaim({ category: 'governance' }),
    ['category must be absent when origin is demand'],
  ],
  [
    'a demand claim that names a weakness',
    demandClaim({ weakness: ['no-buyer-prompt'] }),
    ['weakness must be absent when origin is demand'],
  ],
  [
    'a weak-demand claim that carries a prompt',
    weakClaim({ prompt: { number: 7, text: 'x' } }),
    ['prompt must be absent when origin is weak-demand'],
  ],
  [
    'a weak-demand claim with no weakness',
    without(weakClaim(), 'weakness'),
    ['weakness is required when origin is weak-demand'],
  ],
  [
    'a weak-demand claim that names a category',
    weakClaim({ category: 'governance' }),
    ['category must be absent when origin is weak-demand'],
  ],
  [
    'a weak-demand claim that was never measured',
    weakClaim({ demand: { impressions: 0, position: null } }),
    [
      'demand.impressions must be at least 1 when origin is weak-demand',
      'demand.position must be a number when origin is weak-demand',
    ],
  ],
  [
    'a weak-demand claim with impressions and no position',
    weakClaim({ demand: { impressions: 4, position: null } }),
    [
      'demand.position must be a number when impressions is above 0',
      'demand.position must be a number when origin is weak-demand',
    ],
  ],
  ['a weak-demand claim with an empty weakness', weakClaim({ weakness: [] }), ['weakness must have at least 1 items']],
  [
    'a weak-demand claim that names one reason twice',
    weakClaim({ weakness: ['no-buyer-prompt', 'no-buyer-prompt'] }),
    ['weakness must have unique items'],
  ],
  [
    'a weak-demand claim with a reason nobody defined',
    weakClaim({ weakness: ['too-cheap'] }),
    [`weakness[0] must be one of ${quoted(WEAKNESS_REASONS)}`],
  ],
  [
    'a weak-demand claim whose weakness is a word and not a list',
    weakClaim({ weakness: 'no-buyer-prompt' }),
    ['weakness must be of type array'],
  ],
  [
    'a category claim that carries a prompt',
    categoryClaim({ prompt: { number: 7, text: 'x' } }),
    ['prompt must be absent when origin is category'],
  ],
  [
    'a category claim with no category',
    without(categoryClaim(), 'category'),
    ['category is required when origin is category'],
  ],
  [
    'a category claim naming a category nobody configured',
    categoryClaim({ category: 'finance' }),
    [`category must be one of ${quoted(CATEGORIES)}`],
  ],
  [
    'a category claim that names a weakness',
    categoryClaim({ weakness: ['no-buyer-prompt'] }),
    ['weakness must be absent when origin is category'],
  ],
  [
    'a category claim with measured demand',
    categoryClaim({ demand: { impressions: 5, position: 3 } }),
    ['demand.impressions must be 0 when origin is category', 'demand.position must be null when origin is category'],
  ],
  [
    'a category claim with a position and no impressions',
    categoryClaim({ demand: { impressions: 0, position: 12 } }),
    ['demand.position must be null when impressions is 0', 'demand.position must be null when origin is category'],
  ],
  ['an origin nobody defined', demandClaim({ origin: 'video' }), [`origin must be one of ${quoted(ORIGINS)}`]],
  [
    'a category claim whose prompt is null instead of absent',
    categoryClaim({ prompt: null }),
    ['prompt must be of type object'],
  ],
  ['a category claim whose category is not text', categoryClaim({ category: 5 }), ['category must be of type string']],
  [
    'a weak-demand claim for a term',
    weakClaim({ format: 'term' }),
    ['format must be article when origin is weak-demand'],
  ],
  [
    'a category claim for a term',
    categoryClaim({ format: 'term' }),
    ['format must be article when origin is category'],
  ],
];

for (const [name, value, expected] of ORIGIN_DEFECTS) {
  test(`validateClaim names ${name}, and nothing else`, () => {
    assert.deepEqual(problemsText(value), expected);
  });
}

test('the shape is judged first: a claim of the wrong shape is not also judged for its origin', () => {
  assert.deepEqual(problemsText(categoryClaim({ prompt: { number: 7, text: 'x' }, score: 3 })), [
    'score has an unexpected key',
  ]);
});

test('originProblems names the field with its path in the file and says what the origin wants of it', () => {
  assert.deepEqual(originProblems(claim()), []);
  assert.deepEqual(originProblems(categoryClaim()), []);
  assert.deepEqual(originProblems(categoryClaim({ prompt: { number: 7, text: 'x' } })), [
    { path: '$.prompt', problem: 'must be absent when origin is category' },
  ]);
  assert.deepEqual(originProblems(without(weakClaim(), 'weakness')), [
    { path: '$.weakness', problem: 'is required when origin is weak-demand' },
  ]);
  assert.deepEqual(originProblems(categoryClaim({ demand: { impressions: 2, position: null } })), [
    { path: '$.demand.impressions', problem: 'must be 0 when origin is category' },
  ]);
});

test('originProblems puts the claim fields under the path it is given and keeps the demand at the root of the file', () => {
  const claimLike = { ...categoryClaim({ prompt: { number: 7, text: 'x' } }), demand: { impressions: 3, position: 9 } };
  assert.deepEqual(originProblems(claimLike, '$.claim'), [
    { path: '$.claim.prompt', problem: 'must be absent when origin is category' },
    { path: '$.demand.impressions', problem: 'must be 0 when origin is category' },
    { path: '$.demand.position', problem: 'must be null when origin is category' },
  ]);
});

test('originProblems puts the format rule at the path it is given, and a demand term needs no rule', () => {
  assert.deepEqual(originProblems(categoryClaim({ format: 'term' })), [
    { path: '$.format', problem: 'must be article when origin is category' },
  ]);
  assert.deepEqual(originProblems(weakClaim({ format: 'term' }), '$.claim', '$.entry.format'), [
    { path: '$.entry.format', problem: 'must be article when origin is weak-demand' },
  ]);
  assert.deepEqual(originProblems(demandClaim({ format: 'term' })), []);
  assert.deepEqual(originProblems(demandClaim({ format: 'article' })), []);
});

test('originProblems refuses an unknown origin instead of letting it pass every rule', () => {
  assert.deepEqual(originProblems({ origin: 'video' }), [
    { path: '$.origin', problem: `must be one of ${quoted(ORIGINS)}` },
  ]);
});

test('originProblems reads a key set to undefined as absent and a key set to null as present', () => {
  assert.deepEqual(originProblems(categoryClaim({ prompt: undefined, weakness: undefined })), []);
  assert.deepEqual(originProblems(categoryClaim({ prompt: null })), [
    { path: '$.prompt', problem: 'must be absent when origin is category' },
  ]);
  assert.deepEqual(originProblems(without(demandClaim(), 'demand')), []);
});
