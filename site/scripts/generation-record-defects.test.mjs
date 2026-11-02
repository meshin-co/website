import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ledgerFile } from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { ARTICLE_SLUG, MODEL, MODEL_VARIABLE, RESOLVED_MODEL, recordInput } from './fixtures/generation-input.mjs';
import { buildRecord, validateRecord } from './generation-record.mjs';
import { shutdownNote } from './writer-models.mjs';

const base = buildRecord(recordInput());
const mutated = (change) => {
  const copy = structuredClone(base);
  change(copy);
  return copy;
};
const problemsText = (record) => validateRecord(record).map(describeProblem);
const hasProblem = (record, expected) => problemsText(record).some((text) => text.startsWith(expected));

test('the ledger pattern accepts the path of a ledger file and no other file of the directory tree', () => {
  assert.deepEqual(validateRecord(mutated((r) => (r.ledger = ledgerFile('any-slug')))), []);
  for (const other of ['audits/autowriter/claims/x.json', 'audits/autowriter/generations/x.json', 'audits/x.json']) {
    assert.ok(
      hasProblem(
        mutated((r) => (r.ledger = other)),
        'ledger must match pattern'
      ),
      other
    );
  }
});

const SHAPE_DEFECTS = [
  ['an unknown field', (r) => (r.note = 'hi'), 'note has an unexpected key'],
  ['a missing field', (r) => delete r.tree, 'tree is required'],
  ['a wrong schema version', (r) => (r.schema = 2), 'schema must equal 1'],
  ['a slug that is not kebab-case', (r) => (r.slug = 'What Is'), 'slug must match pattern ^[a-z0-9]+(-[a-z0-9]+)*$'],
  [
    'an instant that is not on the calendar',
    (r) => (r.generatedAt = '2026-02-31T00:00:00.000Z'),
    'generatedAt must be a real calendar instant, got "2026-02-31T00:00:00.000Z"',
  ],
  [
    'a band date that is not on the calendar',
    (r) => (r.band.measuredOn = '2026-02-30'),
    'band.measuredOn must be a real calendar date, got "2026-02-30"',
  ],
  [
    'a report date that is not on the calendar',
    (r) => (r.demand.report.windowEnd = '2026-13-01'),
    'demand.report.windowEnd must be a real calendar date, got "2026-13-01"',
  ],
  ['a missing ledger', (r) => delete r.ledger, 'ledger is required'],
  ['a ledger that is not a ledger path', (r) => (r.ledger = 'ledger.json'), 'ledger must match pattern'],
  [
    'a faq answer, which the writer no longer writes',
    (r) => (r.entry.format = 'faq-answer'),
    'entry.format must be one of "article", "term"',
  ],
  [
    'a provider that is not a registry key',
    (r) => (r.provider = 'OpenAI'),
    'provider must match pattern ^[a-z][a-z0-9-]*$',
  ],
  [
    'a call vendor that is not a registry key',
    (r) => (r.calls[0].vendor = 'Open AI'),
    'calls[0].vendor must match pattern',
  ],
  [
    'a model check vendor that is not a registry key',
    (r) => (r.modelChecks[0].vendor = ''),
    'modelChecks[0].vendor must match pattern',
  ],
  ['a prompt digest that is not sha-256', (r) => (r.prompt.digest = 'abc'), 'prompt.digest must match pattern'],
  ['a short parent commit', (r) => (r.tree.parent = 'abc1234'), 'tree.parent must match pattern ^[0-9a-f]{40}$'],
  ['an absolute entry path', (r) => (r.entry.path = '/Users/someone/x.md'), 'entry.path must match pattern'],
  [
    'a path that climbs out of the repository',
    (r) => (r.files[0] = 'site/../etc/passwd'),
    'files[0] must match pattern',
  ],
  ['a route without its leading slash', (r) => (r.entry.route = 'glossary/x'), 'entry.route must match pattern'],
  [
    'a judge call, which the writer no longer makes',
    (r) => (r.calls[0].role = 'judge'),
    'calls[0].role must be one of "draft", "correction", "repair", "repair-correction"',
  ],
  ['negative tokens', (r) => (r.calls[0].tokens.input = -1), 'calls[0].tokens.input must be >= 0'],
  ['fractional tokens', (r) => (r.calls[0].tokens.output = 1.5), 'calls[0].tokens.output must be of type integer'],
  [
    'a price without its output rate',
    (r) => delete r.calls[0].price.outputPerMillion,
    'calls[0].price.outputPerMillion is required',
  ],
  [
    'a request digest that is not sha-256',
    (r) => (r.calls[0].requestDigest = 'xyz'),
    'calls[0].requestDigest must match pattern',
  ],
  ['a demand cell that is not a string', (r) => (r.demand.row['#'] = 6), 'demand.row.# must be of type string'],
  ['a report without its table', (r) => delete r.demand.report.table, 'demand.report.table is required'],
  ['a report key nobody defined', (r) => (r.demand.report.extra = 'x'), 'demand.report.extra has an unexpected key'],
  ['a band without one limit', (r) => delete r.band.limits.justBelowCap, 'band.limits.justBelowCap is required'],
  ['a share above one', (r) => (r.band.measured.shareJustBelow = 1.5), 'band.measured.shareJustBelow must be <= 1'],
  ['a band without its format', (r) => delete r.band.limits.format, 'band.limits.format is required'],
  [
    'a band format nobody defined',
    (r) => (r.band.limits.format = 'faq-answer'),
    'band.limits.format must be one of "article", "term"',
  ],
  [
    'a band without its minimum sentence count',
    (r) => delete r.band.limits.minimumSentences,
    'band.limits.minimumSentences is required',
  ],
  [
    'a median that is not a whole number of words',
    (r) => (r.band.measured.median = 15.5),
    'band.measured.median must be of type integer',
  ],
  ['no calls at all', (r) => (r.calls = []), 'calls must have at least 1 items'],
  [
    'a claim marker nobody defined',
    (r) => (r.claimTable[0].marker = 'maybe'),
    'claimTable[0].marker must be one of "sourced", "own-reading"',
  ],
  [
    'a source that is not a web address',
    (r) => (r.claimTable[0].source.url = 'ftp://x'),
    'claimTable[0].source.url must match pattern',
  ],
  ['a negative gate exit', (r) => (r.gates[0].exit = -1), 'gates[0].exit must be >= 0'],
  ['the same file listed twice', (r) => r.files.push(r.files[0]), 'files must have unique items'],
  ['no model check', (r) => (r.modelChecks = []), 'modelChecks must have at least 1 items'],
];

for (const [name, change, expected] of SHAPE_DEFECTS) {
  test(`validateRecord names ${name}`, () => {
    const record = mutated(change);
    assert.ok(hasProblem(record, expected), `${expected} not in ${problemsText(record).join(' | ')}`);
  });
}

const shutdown = (change) => (r) => Object.assign(r.modelChecks[0], { shutdownDate: '2026-12-15' }, change);
const note = shutdownNote({ model: MODEL, modelVariable: MODEL_VARIABLE, shutdownDate: '2026-12-15' });

const CROSS_DEFECTS = [
  [
    'input tokens that are not the sum of the calls',
    (r) => (r.totals.tokens.input = 1),
    'totals.tokens.input is 1 but its calls add up to 25000',
  ],
  [
    'output tokens that are not the sum of the calls',
    (r) => (r.totals.tokens.output = 1),
    'totals.tokens.output is 1 but its calls add up to 5000',
  ],
  [
    'a cost that is not the sum of the calls',
    (r) => (r.totals.costUsd = 9),
    'totals.costUsd is 9 but its calls add up to 0.05',
  ],
  [
    'a total that is two microdollars off',
    (r) => (r.totals.costUsd = 0.050002),
    'totals.costUsd is 0.050002 but its calls add up to 0.05',
  ],
  [
    'a call cost that is not its tokens times its price',
    (r) => (r.calls[1].costUsd = 0.024),
    'calls[1].costUsd is 0.024 but its 13000 input and 2000 output tokens at its price come to 0.023',
  ],
  [
    'a call price that does not give its cost',
    (r) => (r.calls[0].price.inputPerMillion = 3),
    'calls[0].costUsd is 0.027 but its 12000 input and 3000 output tokens at its price come to 0.051',
  ],
  [
    'a published call outside the calls',
    (r) => (r.published.callIndex = 9),
    'published.callIndex points at call 9 but the record has 2 calls',
  ],
  [
    'a provider that is not the published call vendor',
    (r) => (r.provider = 'acme-ai'),
    'provider is "acme-ai" but call 1 says "openai"',
  ],
  [
    'the configured model in place of the resolved one',
    (r) => (r.model = MODEL),
    `model is "${MODEL}" but call 1 says "${RESOLVED_MODEL}"`,
  ],
  [
    'a response id that is not the published one',
    (r) => (r.responseId = 'resp-x'),
    'responseId is "resp-x" but call 1 says "resp-article-correction"',
  ],
  [
    'a published pointer that moved off the call the record copies',
    (r) => (r.published.callIndex = 0),
    'responseId is "resp-article-correction" but call 0 says "resp-article-draft"',
  ],
  [
    'a shutdown date with no note',
    shutdown({ note: null }),
    `modelChecks[0].note must be the digest sentence naming ${MODEL_VARIABLE}, ${MODEL} and 2026-12-15`,
  ],
  [
    'a shutdown note that skips the variable',
    shutdown({ note: `The model ${MODEL} shuts down on 2026-12-15.` }),
    `modelChecks[0].note must name ${MODEL_VARIABLE}`,
  ],
  [
    'a shutdown note that skips the model',
    shutdown({ note: `${MODEL_VARIABLE} shuts down on 2026-12-15.` }),
    `modelChecks[0].note must name ${MODEL}`,
  ],
  [
    'a shutdown note that skips the date',
    shutdown({ note: `${MODEL_VARIABLE} is ${MODEL}, which will stop working soon.` }),
    'modelChecks[0].note must name 2026-12-15',
  ],
  [
    'a shutdown date that is not on the calendar',
    shutdown({ shutdownDate: '2026-02-31', note: `${MODEL_VARIABLE} ${MODEL} 2026-02-31` }),
    'modelChecks[0].shutdownDate must be a real calendar date, got "2026-02-31"',
  ],
  [
    'an entry the commit does not list',
    (r) => (r.files = r.files.filter((file) => file !== r.entry.path)),
    `files must list the entry site/src/data/post/${ARTICLE_SLUG}.md`,
  ],
  [
    'a band measured against another threshold',
    (r) => (r.band.measured.threshold = 10),
    'band.measured.threshold is 10 but band.limits.threshold is 12',
  ],
  [
    'a band of another format than the entry',
    (r) => (r.band.limits.format = 'term'),
    'band.limits.format is "term" but the entry format is "article"',
  ],
  [
    'a measurement made against another format than the entry',
    (r) => (r.band.measured.format = 'term'),
    'band.measured.format is "term" but the entry format is "article"',
  ],
];

for (const [name, change, expected] of CROSS_DEFECTS) {
  test(`validateRecord names ${name}`, () => {
    const record = mutated(change);
    assert.ok(hasProblem(record, expected), `${expected} not in ${problemsText(record).join(' | ')}`);
  });
}

test('totals and costs within a microdollar of the arithmetic pass', () => {
  assert.deepEqual(validateRecord(mutated((r) => (r.totals.costUsd = 0.0500005))), []);
  const nearby = mutated((r) => (r.calls[0].costUsd = 0.0270004));
  assert.deepEqual(validateRecord(nearby), []);
});

test('a model with a shutdown date is recorded with a note that names the variable, the model and the date', () => {
  const record = mutated(shutdown({ note }));
  assert.deepEqual(validateRecord(record), []);
  const [check] = record.modelChecks;
  assert.deepEqual(
    [check.shutdownDate, check.note.includes(MODEL_VARIABLE), check.note.includes(MODEL)],
    ['2026-12-15', true, true]
  );
  assert.ok(JSON.stringify(record).includes(note));
});
