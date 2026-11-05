import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ORIGINS, WEAKNESS_REASONS, validateClaim } from './autowriter-claims.mjs';
import {
  ARTICLE_SLUG,
  CLAIMED_AT,
  LEDGER,
  MODEL,
  MODEL_VARIABLE,
  QUERIES_ROW,
  RESOLVED_MODEL,
  TERM_SLUG,
  callOf,
  categoryInput,
  recordInput,
  termInput,
  weakDemandInput,
} from './fixtures/generation-input.mjs';
import { buildRecord, callRecord, callTotals, validateRecord } from './generation-record.mjs';
import { recordDirectory, recordPath } from './record-layout.mjs';

const base = buildRecord(recordInput());
const schemaText = readFileSync(new URL('./generation-record.schema.json', import.meta.url), 'utf8');
const schema = JSON.parse(schemaText);

test('a record lives under audits/autowriter/generations, in the month of its claim, and is named for its slug', () => {
  assert.equal(recordDirectory('generation'), 'audits/autowriter/generations');
  assert.equal(
    recordPath('generation', ARTICLE_SLUG, CLAIMED_AT),
    `audits/autowriter/generations/2026/11/${ARTICLE_SLUG}.json`
  );
});

test('the claims of the fixtures are claims the claim store would accept', () => {
  assert.deepEqual(validateClaim(recordInput().claim), []);
  assert.deepEqual(validateClaim(termInput().claim), []);
  assert.deepEqual(validateClaim(weakDemandInput().claim), []);
  assert.deepEqual(validateClaim(categoryInput().claim), []);
});

test('a record built from a run has no problems and carries the schema keys in the schema order', () => {
  assert.deepEqual(validateRecord(base), []);
  assert.deepEqual(Object.keys(base), Object.keys(schema.properties));
});

test('the record knows nothing of a bake-off, a mode, an epoch or a judge', () => {
  for (const key of ['mode', 'epoch', 'bakeOff']) {
    assert.ok(!Object.hasOwn(schema.properties, key), `${key} is still in the schema`);
    assert.ok(!Object.hasOwn(base, key), `${key} is still in the record`);
  }
  assert.deepEqual(schema.$defs.call.properties.role.enum, [
    'topic',
    'draft',
    'correction',
    'repair',
    'repair-correction',
  ]);
  assert.deepEqual(schema.$defs.format.enum, ['article', 'term']);
  assert.ok(!/anthropic|bake-?off|epoch|judge/i.test(schemaText));
});

test('it names the provider, the resolved model id and the response id of the published call', () => {
  assert.deepEqual([base.provider, base.model, base.responseId], ['openai', RESOLVED_MODEL, 'resp-article-correction']);
  assert.deepEqual(base.published, { callIndex: 1 });
  const input = recordInput();
  input.published = { callIndex: 0 };
  const draft = buildRecord(input);
  assert.equal(draft.responseId, 'resp-article-draft');
  assert.deepEqual(validateRecord(draft), []);
});

test('a second vendor under its own registry key is a valid record without any change to the schema', () => {
  const input = recordInput();
  input.calls = input.calls.map((call) => ({ ...call, vendor: 'acme-ai' }));
  input.modelChecks = [{ ...input.modelChecks[0], vendor: 'acme-ai' }];
  const record = buildRecord(input);
  assert.equal(record.provider, 'acme-ai');
  assert.deepEqual(validateRecord(record), []);
});

test('it carries the whole demand row verbatim, the claim demand and where the row was measured', () => {
  const input = recordInput();
  const record = buildRecord(input);
  assert.deepEqual(record.demand.row, input.decision.row);
  assert.notEqual(record.demand.row, input.decision.row);
  assert.deepEqual(base.demand.report, {
    path: 'audits/search-demand.md',
    measured: '2026-11-01',
    windowStart: '2026-08-01',
    windowEnd: '2026-10-30',
    table: 'Buyer prompts',
  });
  assert.deepEqual([base.demand.impressions, base.demand.position], [9, 91.8]);
});

test('it carries the claim, the run, the entry and the ledger that holds the spend, and none of the bookkeeping', () => {
  assert.deepEqual(base.claim, {
    title: 'How do you build an AI bill of materials?',
    query: 'how to build an ai bill of materials',
    prompt: { number: 6, text: 'Which artefacts should an AI register hold for each model?' },
  });
  assert.deepEqual([base.slug, base.runId, base.ledger], [ARTICLE_SLUG, '1234567890', LEDGER]);
  assert.equal(base.ledger, recordPath('ledger', base.slug, recordInput().claim.claimedAt));
  assert.equal(base.generatedAt, '2026-11-02T07:05:09.123Z');
  assert.deepEqual(base.entry, {
    format: 'article',
    route: `/blog/${ARTICLE_SLUG}`,
    path: `site/src/data/post/${ARTICLE_SLUG}.md`,
  });
  const text = JSON.stringify(base);
  for (const leaked of ['claimedAt', 'expiresAt', 'claimPath', 'ledgerPath', 'refusals', '"status"', 'sc-domain']) {
    assert.ok(!text.includes(leaked), `${leaked} reached the record`);
  }
});

test('the term of a run has its own record and its own calls and names the ledger of the post', () => {
  const term = buildRecord(termInput());
  assert.deepEqual(validateRecord(term), []);
  assert.deepEqual([term.slug, term.entry.format, term.ledger], [TERM_SLUG, 'term', LEDGER]);
  assert.notEqual(term.ledger, recordPath('ledger', term.slug, CLAIMED_AT));
  assert.deepEqual(
    term.calls.map((call) => call.responseId),
    ['resp-term-draft']
  );
  assert.deepEqual(term.totals, { tokens: { input: 6000, output: 1200 }, costUsd: 0.012 });
  assert.deepEqual([term.demand.impressions, term.demand.position], [0, null]);
});

test('it carries the prompt digest, the files the prompt was built from and the parent tree fingerprint', () => {
  const input = recordInput();
  assert.deepEqual(base.prompt, input.prompt);
  assert.deepEqual(base.tree, input.tree);
  assert.match(base.tree.fingerprint, /^[0-9a-f]{64}$/);
});

test('every call is carried with its tokens, cost and price, and the totals are computed as their sums', () => {
  assert.deepEqual(base.calls, recordInput().calls);
  assert.deepEqual(
    base.calls.map((call) => call.costUsd),
    [0.027, 0.023]
  );
  assert.deepEqual(base.totals, { tokens: { input: 25000, output: 5000 }, costUsd: 0.05 });
});

test('the claim table, the band, the model checks and the gate results are carried as given', () => {
  const input = recordInput();
  assert.deepEqual(base.claimTable, input.claimTable);
  assert.deepEqual(base.band, input.band);
  assert.deepEqual(base.modelChecks, input.modelChecks);
  assert.deepEqual(base.gates, input.gates);
});

test('the files of the commit are listed in sorted order whatever order they arrive in', () => {
  const arrived = recordInput().files;
  assert.notDeepEqual(arrived, [...arrived].sort());
  assert.deepEqual(base.files, [...arrived].sort());
  assert.deepEqual(buildRecord({ ...recordInput(), files: [...arrived].reverse() }).files, base.files);
});

test('building a record leaves its input as it found it', () => {
  const input = recordInput();
  const before = structuredClone(input);
  buildRecord(input);
  assert.deepEqual(input, before);
});

test('the record shares no object with the input it was built from', () => {
  const input = recordInput();
  const record = buildRecord(input);
  input.decision.row['#'] = 'changed';
  input.claimTable[0].sentence = 'changed';
  input.calls[0].tokens.input = 1;
  input.modelChecks[0].model = 'changed';
  input.band.limits.threshold = 99;
  input.prompt.files[0].path = 'changed';
  input.published.callIndex = 0;
  assert.deepEqual(record, base);
});

test('a run whose first draft passed has one call, published, and is a valid record', () => {
  const input = recordInput();
  input.calls = [input.calls[0]];
  input.published = { callIndex: 0 };
  const record = buildRecord(input);
  assert.deepEqual(validateRecord(record), []);
  assert.deepEqual(record.totals, { tokens: { input: 12000, output: 3000 }, costUsd: 0.027 });
});

test('a key the schema does not list never reaches the record, at any depth', () => {
  const input = recordInput();
  const strays = [
    input.calls[0],
    input.calls[0].tokens,
    input.calls[0].price,
    input.claimTable[0].source,
    input.prompt.files[0],
    input.band.limits,
    input.modelChecks[0],
    input.gates[0],
    input.decision.report,
    input.published,
    input.claim.prompt,
  ];
  for (const stray of strays) stray.stray = 'x'.repeat(8);
  input.extra = 'x'.repeat(8);
  const record = buildRecord(input);
  assert.deepEqual(record, base);
  assert.ok(!JSON.stringify(record).includes('xxxxxxxx'));
});

test('no secret value from a vendor entry reaches the record', () => {
  const secret = randomBytes(24).toString('hex');
  const vendor = Object.defineProperty(
    {
      id: 'openai',
      keyName: 'AUTOWRITER_OPENAI_API_KEY',
      modelVariable: MODEL_VARIABLE,
      model: MODEL,
      rates: { inputPerMillion: 1, outputPerMillion: 5 },
    },
    'apiKey',
    { value: secret, enumerable: false }
  );
  const sample = callOf('draft');
  const result = {
    json: { draft: true },
    text: '{"draft":true}',
    responseId: sample.responseId,
    resolvedModel: sample.resolvedModel,
    usage: { ...sample.tokens, apiKey: secret },
    stopReason: sample.stopReason,
    costUsd: sample.costUsd,
    price: { ...sample.price, apiKey: secret },
    requestDigest: sample.requestDigest,
    headers: { authorization: `Bearer ${secret}` },
  };
  const call = callRecord({ role: 'draft', adapter: vendor, result });
  const input = recordInput();
  input.calls = [Object.defineProperty({ ...call, vendor: vendor.id }, 'apiKey', { value: secret, enumerable: true })];
  input.published = { callIndex: 0 };
  input.modelChecks = [{ ...input.modelChecks[0], vendor: vendor.id, vendorEntry: vendor, apiKey: secret }];
  const record = buildRecord(input);
  assert.deepEqual(validateRecord(record), []);
  const text = JSON.stringify(record);
  assert.ok(!text.includes(secret), 'a secret value reached the record');
  assert.ok(!text.includes('Bearer'), 'an authorization header reached the record');
  assert.ok(!text.includes('AUTOWRITER_OPENAI_API_KEY'), 'the name of the key reached the record');
});

const CLAIM_KEYS = ['title', 'query', 'prompt', 'origin', 'category', 'weakness', 'catchUp'];

test('the claim block lists the origin fields beside the prompt, with the origins and reasons of the claim itself', () => {
  const { claim } = schema.properties;
  assert.deepEqual(Object.keys(claim.properties), CLAIM_KEYS);
  assert.deepEqual(claim.required, ['title', 'query']);
  assert.deepEqual(claim.properties.origin.enum, ORIGINS);
  assert.deepEqual(claim.properties.weakness.items.enum, WEAKNESS_REASONS);
});

test('every claim field the schema lists reaches the record, and no other claim field does', () => {
  for (const input of [recordInput(), weakDemandInput(), categoryInput()]) {
    const record = buildRecord({ ...input, claim: { ...input.claim, stray: 'x' } });
    const expected = CLAIM_KEYS.filter((key) => input.claim[key] !== undefined);
    assert.deepEqual(Object.keys(record.claim), expected, input.claim.slug);
  }
});

test('a demand claim that names its origin keeps it, and a claim written before the origin has none to keep', () => {
  const named = buildRecord({ ...recordInput(), claim: { ...recordInput().claim, origin: 'demand' } });
  assert.deepEqual(validateRecord(named), []);
  assert.equal(named.claim.origin, 'demand');
  assert.equal(Object.hasOwn(base.claim, 'origin'), false);
});

test('a weak-demand record names the origin and the weakness, holds no prompt and keeps the row of the query', () => {
  const input = weakDemandInput();
  const weak = buildRecord(input);
  assert.deepEqual(validateRecord(weak), []);
  assert.deepEqual(weak.claim, {
    title: input.claim.title,
    query: input.claim.query,
    origin: 'weak-demand',
    weakness: ['no-buyer-prompt'],
  });
  assert.equal(weak.demand.report.table, 'Queries');
  assert.deepEqual(weak.demand.row, QUERIES_ROW);
  assert.deepEqual([weak.demand.impressions, weak.demand.position], [9, 91.8]);
});

test('a category record names the origin and the category and holds no prompt, no report row and no report table', () => {
  const input = categoryInput();
  const record = buildRecord(input);
  assert.deepEqual(validateRecord(record), []);
  assert.deepEqual(record.claim, {
    title: input.claim.title,
    query: input.claim.query,
    origin: 'category',
    category: 'governance',
  });
  assert.equal(record.demand.row, null);
  assert.equal(record.demand.report.table, null);
  assert.deepEqual([record.demand.impressions, record.demand.position], [0, null]);
});

test('the proposal call of a category entry comes first, and the published call is the last draft call, not call 0', () => {
  const record = buildRecord(categoryInput());
  assert.deepEqual(
    record.calls.map(({ role }) => role),
    ['topic', 'draft', 'correction']
  );
  assert.deepEqual(record.published, { callIndex: 2 });
  assert.deepEqual([record.provider, record.model], ['openai', RESOLVED_MODEL]);
  assert.equal(record.responseId, 'resp-article-correction');
  assert.deepEqual(record.totals, { tokens: { input: 26800, output: 5060 }, costUsd: 0.0521 });
  assert.deepEqual(record.totals, callTotals(record.calls));
});
