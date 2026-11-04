import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { newLedger, readLedger, validateLedger } from './autowriter-ledger.mjs';
import { entryPath, renderEntry } from './entry-files.mjs';
import { QUERIES_ROW, callOf } from './fixtures/generation-input.mjs';
import { RUN_DATE, claimFor, cleanDraft } from './fixtures/writer-drafts.mjs';
import { ROUTES, adapterOn, completed, modelList, reply } from './fixtures/writer-vendors.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { callTotals, ledgerWithGeneration, validateRecord } from './generation-record.mjs';
import { familyOf, filingProblems, recordPath } from './record-layout.mjs';
import { REPORT_PATH, usdText } from './spend-report-text.mjs';
import { recordMicro } from './spend-sum.mjs';
import { generateRun } from './write-run.mjs';
import { readWriterConfig } from './writer-config.mjs';
import { WriterError } from './writer-error.mjs';

const roots = [];
after(() => roots.forEach(removeRepo));

const NOW = new Date(`${RUN_DATE}T06:00:00Z`);
const PRICE = { inputPerMillion: 1, outputPerMillion: 5 };
const KEY = `sk-test-${'k'.repeat(24)}`;
const POST = claimFor('article');
const TERM = claimFor('term');
const claimPathOf = ({ slug, claimedAt }) => recordPath('claim', slug, claimedAt);
const generationPathOf = ({ slug, claimedAt }) => recordPath('generation', slug, claimedAt);
const ledgerPathOf = ({ slug, claimedAt }) => recordPath('ledger', slug, claimedAt);

const withoutPrompt = (claim) => Object.fromEntries(Object.entries(claim).filter(([key]) => key !== 'prompt'));
const CATEGORY_POST = {
  ...withoutPrompt(POST),
  demand: { impressions: 0, position: null },
  origin: 'category',
  category: 'governance',
};
const WEAK_POST = {
  ...withoutPrompt(POST),
  demand: { impressions: 9, position: 91.8 },
  origin: 'weak-demand',
  weakness: ['no-buyer-prompt', 'impressions-at-floor'],
};
const PROPOSAL_CALL = {
  ...callOf('topic', { input: 1800, output: 60 }, 'category-topic'),
  modelVariable: 'OPENAI_WRITING_MODEL',
  configuredModel: 'gpt-6.1-terra',
  resolvedModel: 'gpt-6.1-terra',
};
const CATEGORY_SHAPES = { [CATEGORY_POST.slug]: { row: null, table: null, proposal: { calls: [PROPOSAL_CALL] } } };
const WEAK_SHAPES = { [WEAK_POST.slug]: { row: QUERIES_ROW, table: 'Queries' } };
const TOPIC_COST = 0.0021;
const ENTRY_COST = 0.0036;

const put = (root, path, value) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};

const answer = (n, json) => ({
  json,
  text: JSON.stringify(json),
  responseId: `resp_${n}`,
  resolvedModel: 'gpt-6.1-terra',
  usage: { input: 1000 * n, output: 100 * n },
  stopReason: 'completed',
  costUsd: 0.0015 * n,
  price: PRICE,
  requestDigest: createHash('sha256').update(String(n)).digest('hex'),
});

function adapterWith(steps, { note = null, shutdownDate = null } = {}) {
  const seen = [];
  return {
    seen,
    id: 'openai',
    keyName: 'AUTOWRITER_OPENAI_API_KEY',
    modelVariable: 'OPENAI_WRITING_MODEL',
    model: 'gpt-6.1-terra',
    verifyModel: async () => ({ id: 'gpt-6.1-terra', shutdownDate, note }),
    async complete(request) {
      seen.push(request);
      const step = steps[seen.length - 1];
      if (step instanceof Error) throw step;
      return step;
    },
  };
}

const defaultShape = (claim) => ({
  row: { '#': String(claim.prompt.number), Prompt: claim.prompt.text },
  table: claim.format === 'term' ? 'Queries' : 'Buyer prompts',
});

function scene({ claims = [POST, TERM], shapes = {} } = {}) {
  const root = makeRepo();
  roots.push(root);
  for (const claim of claims) put(root, claimPathOf(claim), claim);
  const [anchor] = claims;
  const opened = newLedger({ slug: anchor.slug, runId: anchor.runId, pullRequest: null });
  const picked = shapes[anchor.slug]?.proposal?.calls ?? [];
  put(root, ledgerPathOf(anchor), picked.length === 0 ? opened : ledgerWithGeneration(opened, callTotals(picked)));
  const decision = {
    schema: 1,
    decision: 'write',
    ledgerPath: ledgerPathOf(anchor),
    entries: claims.map((claim) => ({
      claimPath: claimPathOf(claim),
      claim,
      ...(shapes[claim.slug] ?? defaultShape(claim)),
      choice: `Choice: ${claim.slug}`,
    })),
    report: {
      path: 'audits/search-demand.md',
      measured: '2026-11-01',
      windowStart: '2026-08-01',
      windowEnd: '2026-10-30',
    },
    refusals: [],
  };
  return { root, decision };
}

const config = () =>
  readWriterConfig({
    WRITING_PROVIDER: 'openai',
    OPENAI_WRITING_MODEL: 'gpt-6.1-terra',
    OPENAI_WRITING_INPUT_USD_PER_MILLION: '1',
    OPENAI_WRITING_OUTPUT_USD_PER_MILLION: '5',
    AUTOWRITER_OPENAI_API_KEY: KEY,
  });

const assembled = ({ entries }) => ({
  files: [
    ...entries.map(({ claim, draft }) => {
      const { path, text } = renderEntry({ claim, draft, runDate: RUN_DATE });
      return { path, text };
    }),
    { path: 'site/content-facts.json', text: '{}\n' },
    { path: 'docs/SEMANTIC-CORE.md', text: 'core\n' },
  ],
  gates: [
    { name: 'gate:registers', exit: 0 },
    { name: 'gate:content', exit: 0 },
  ],
});

async function drive({ claims, shapes, steps, assemble, commit, adapterOptions, adapter: supplied } = {}) {
  const { root, decision } = scene({ claims, shapes });
  const adapter = supplied ?? adapterWith(steps, adapterOptions);
  const assembleCalls = [];
  const commitCalls = [];
  const outcome = await generateRun({
    repoRoot: root,
    decision,
    config: config(),
    now: () => NOW,
    fetch: async () => {
      throw new Error('unreachable');
    },
    run: () => {
      throw new Error('no process may run');
    },
    makeAdapter: () => adapter,
    assemble: async (input) => {
      assembleCalls.push(input);
      return (assemble ?? assembled)(input);
    },
    commit: async (input) => {
      commitCalls.push(input);
      return commit ? commit(input) : { commit: 'a'.repeat(40), branch: input.branch };
    },
    treeOf: async () => ({ parent: 'b'.repeat(40), fingerprint: 'c'.repeat(64) }),
  }).then(
    (summary) => ({ summary }),
    (error) => ({ error })
  );
  return { root, adapter, assembleCalls, commitCalls, ...outcome };
}

const textsOf = (commitCall) => Object.fromEntries(commitCall.files.map(({ path, text }) => [path, text]));
const storedLedger = (root, claim) => readLedger(join(root, ledgerPathOf(claim)));

test('a post and a term are drafted in turn, assembled together once and committed once', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  assert.ifError(run.error);
  assert.equal(run.adapter.seen.length, 2);
  assert.equal(run.assembleCalls.length, 1);
  assert.deepEqual(
    run.assembleCalls[0].entries.map(({ claim }) => claim.format),
    ['article', 'term']
  );
  assert.equal(run.commitCalls.length, 1);
  assert.equal(run.commitCalls[0].branch, `autowriter/${POST.slug}`);
  const paths = run.commitCalls[0].files.map(({ path }) => path);
  for (const claim of [POST, TERM])
    for (const path of [entryPath(claim), generationPathOf(claim), claimPathOf(claim)])
      assert.ok(paths.includes(path), `${path} is not in the commit`);
  assert.ok(paths.includes(ledgerPathOf(POST)));
  assert.equal(new Set(paths).size, paths.length);
});

test('each entry keeps its own record with its own calls, and the claims are written', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  const texts = textsOf(run.commitCalls[0]);
  const post = JSON.parse(texts[generationPathOf(POST)]);
  const term = JSON.parse(texts[generationPathOf(TERM)]);
  assert.deepEqual(validateRecord(post), []);
  assert.deepEqual(validateRecord(term), []);
  assert.equal(post.calls.length, 1);
  assert.equal(term.calls.length, 1);
  assert.equal(post.totals.costUsd, 0.0015);
  assert.equal(term.totals.costUsd, 0.003);
  assert.equal(post.ledger, ledgerPathOf(POST));
  assert.equal(term.ledger, ledgerPathOf(POST));
  assert.equal(post.demand.report.table, 'Buyer prompts');
  assert.equal(term.demand.report.table, 'Queries');
  assert.equal(JSON.parse(texts[claimPathOf(POST)]).status, 'written');
  assert.equal(JSON.parse(texts[claimPathOf(TERM)]).status, 'written');
});

test('every record the commit carries is filed under the month of its claim', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  assert.ifError(run.error);
  const records = run.commitCalls[0].files.map(({ path }) => path).filter((path) => familyOf(path) !== null);
  assert.deepEqual(records.map(familyOf).sort(), ['claim', 'claim', 'generation', 'generation', 'ledger']);
  assert.deepEqual(filingProblems({ paths: records, claims: [POST, TERM] }), []);
});

test('each record is filed under the month of its own claim, and the ledger under the month of the post', async () => {
  const post = claimFor('article', { claimedAt: '2026-10-31T23:59:59.999Z' });
  const run = await drive({
    claims: [post, TERM],
    steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))],
  });
  assert.ifError(run.error);
  const ledger = `audits/autowriter/2026/10/${POST.slug}.json`;
  const postRecord = `audits/autowriter/generations/2026/10/${POST.slug}.json`;
  const termRecord = `audits/autowriter/generations/2026/11/${TERM.slug}.json`;
  const paths = run.commitCalls[0].files.map(({ path }) => path);
  for (const path of [
    ledger,
    postRecord,
    termRecord,
    `audits/autowriter/claims/2026/10/${POST.slug}.json`,
    `audits/autowriter/claims/2026/11/${TERM.slug}.json`,
  ])
    assert.ok(paths.includes(path), `${path} is not in the commit`);
  const texts = textsOf(run.commitCalls[0]);
  assert.equal(JSON.parse(texts[postRecord]).ledger, ledger);
  assert.equal(JSON.parse(texts[termRecord]).ledger, ledger);
});

test('the commit message names the generation record of each entry at its month path', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  for (const claim of [POST, TERM])
    assert.ok(run.commitCalls[0].message.includes(`Provenance: ${generationPathOf(claim)}`), claim.slug);
});

test('the one commit also holds the spend report, with a row for each entry at the cost its record stores', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  assert.ifError(run.error);
  const texts = textsOf(run.commitCalls[0]);
  assert.ok(Object.hasOwn(texts, REPORT_PATH), 'the commit holds no spend report');
  const report = texts[REPORT_PATH];
  assert.match(report, new RegExp(`^Generated-from: ${'b'.repeat(40)}$`, 'm'));
  const rows = report
    .split('\n')
    .filter((line) => line.startsWith('| 20'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    );
  for (const claim of [POST, TERM]) {
    const record = JSON.parse(texts[recordPath('generation', claim.slug, claim.claimedAt)]);
    const row = rows.find((cells) => cells[2] === claim.slug);
    assert.ok(row, `no row for ${claim.slug}`);
    assert.equal(row[1], record.entry.format);
    assert.equal(row[5], usdText(recordMicro(record)));
  }
  assert.doesNotMatch(report, /No entry yet/);
});

test('the one ledger adds up both entries and the summary reports them apart', async () => {
  const run = await drive({
    steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))],
    adapterOptions: {
      note: 'OPENAI_WRITING_MODEL is gpt-6.1-terra, which its vendor has announced it will shut down on 2027-01-01.',
      shutdownDate: '2027-01-01',
    },
  });
  const ledger = JSON.parse(textsOf(run.commitCalls[0])[ledgerPathOf(POST)]);
  assert.equal(ledger.generation.costUsd, 0.0045);
  assert.equal(ledger.spend.costUsd, 0.0045);
  const { summary } = run;
  assert.deepEqual(
    summary.entries.map(({ slug, format, spend }) => [slug, format, spend.costUsd]),
    [
      [POST.slug, 'article', 0.0015],
      [TERM.slug, 'term', 0.003],
    ]
  );
  assert.equal(summary.spend.costUsd, 0.0045);
  assert.deepEqual(summary.skipped, []);
  assert.equal(summary.branch, `autowriter/${POST.slug}`);
  assert.equal(summary.slug, POST.slug);
  assert.equal(summary.notes.length, 1);
  assert.match(summary.notes[0], /2027-01-01/);
});

test('a term that cannot be drafted is left out, its billed call still lands in the ledger, and the post ships alone', async () => {
  const refused = new WriterError('output', 'the response was cut off', { call: answer(2, {}) });
  const run = await drive({ steps: [answer(1, cleanDraft('article')), refused] });
  assert.ifError(run.error);
  assert.deepEqual(
    run.assembleCalls[0].entries.map(({ claim }) => claim.slug),
    [POST.slug]
  );
  const paths = run.commitCalls[0].files.map(({ path }) => path);
  assert.equal(paths.includes(claimPathOf(TERM)), false);
  assert.equal(paths.includes(generationPathOf(TERM)), false);
  assert.deepEqual(
    run.summary.skipped.map(({ slug, format, spend }) => [slug, format, spend.costUsd]),
    [[TERM.slug, 'term', 0.003]]
  );
  assert.equal(run.summary.spend.costUsd, 0.0045);
  const ledger = JSON.parse(textsOf(run.commitCalls[0])[ledgerPathOf(POST)]);
  assert.equal(ledger.generation.costUsd, 0.0045);
});

test('a failing post stops the run before the term costs anything and keeps the spend in the ledger', async () => {
  const refused = new WriterError('output', 'the response was cut off', { call: answer(1, {}) });
  const run = await drive({ steps: [refused, answer(2, cleanDraft('term'))] });
  assert.equal(run.error?.kind, 'output');
  assert.equal(run.adapter.seen.length, 1);
  assert.equal(run.assembleCalls.length, 0);
  assert.equal(run.commitCalls.length, 0);
  assert.equal(run.error.spend.costUsd, 0.0015);
  const ledger = storedLedger(run.root, POST);
  assert.equal(ledger.verdict.state, 'stopped');
  assert.equal(ledger.generation.costUsd, 0.0015);
  assert.match(ledger.verdict.reason, /output/);
});

test('a failure that costs nothing leaves the ledger as it was', async () => {
  const run = await drive({ steps: [new WriterError('vendor', 'openai answered HTTP 500', { status: 500 })] });
  assert.equal(run.error?.kind, 'vendor');
  assert.equal(storedLedger(run.root, POST).verdict.state, 'open');
  assert.equal(storedLedger(run.root, POST).generation, undefined);
});

test('a credential failure on the term stops the whole run, it is never a skipped term', async () => {
  const run = await drive({
    steps: [
      answer(1, cleanDraft('article')),
      new WriterError('credential', 'AUTOWRITER_OPENAI_API_KEY was refused', { status: 401 }),
    ],
  });
  assert.equal(run.error?.kind, 'credential');
  assert.equal(run.commitCalls.length, 0);
  assert.equal(storedLedger(run.root, POST).generation.costUsd, 0.0015);
});

test('an assembly that fails with the term included is retried with the post alone', async () => {
  let attempts = 0;
  const run = await drive({
    steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))],
    assemble: (input) => {
      attempts += 1;
      if (attempts === 1)
        throw new WriterError('build', 'npm run gate:editorial exited with status 1:\nroute /glossary/x failed');
      return assembled(input);
    },
  });
  assert.ifError(run.error);
  assert.equal(run.assembleCalls.length, 2);
  assert.equal(run.assembleCalls[1].entries.length, 1);
  assert.match(
    run.summary.skipped[0].reason,
    /assembly failed while it was included: npm run gate:editorial exited with status 1/
  );
  assert.equal(run.summary.skipped[0].spend.costUsd, 0.003);
  assert.equal(
    run.commitCalls[0].files.some(({ path }) => path === claimPathOf(TERM)),
    false
  );
});

test('an assembly that fails for the post alone fails the run and keeps the spend', async () => {
  const run = await drive({
    steps: [answer(1, cleanDraft('article'))],
    claims: [POST],
    assemble: () => {
      throw new WriterError('build', 'npm run build exited with status 1');
    },
  });
  assert.equal(run.error?.kind, 'build');
  assert.equal(run.assembleCalls.length, 1);
  assert.equal(run.commitCalls.length, 0);
  assert.equal(storedLedger(run.root, POST).verdict.state, 'stopped');
  assert.equal(storedLedger(run.root, POST).generation.costUsd, 0.0015);
});

test('a commit that fails keeps the spend in the ledger on disk and nothing else', async () => {
  const run = await drive({
    steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))],
    commit: () => {
      throw new WriterError('commit', 'git commit failed');
    },
  });
  assert.equal(run.error?.kind, 'commit');
  assert.equal(run.error.spend.costUsd, 0.0045);
  assert.equal(storedLedger(run.root, POST).generation.costUsd, 0.0045);
  assert.equal(JSON.parse(readFileSync(join(run.root, claimPathOf(POST)), 'utf8')).status, 'claimed');
});

test('a key echoed into a draft never reaches a file: the run fails and commits nothing', async () => {
  const leaking = cleanDraft('article');
  leaking.body = `${leaking.body}\n\n${KEY}`;
  const run = await drive({ steps: [answer(1, leaking), answer(2, cleanDraft('term'))] });
  assert.ok(run.error, 'the run did not fail');
  assert.equal(run.commitCalls.length, 0);
  assert.equal(String(run.error.message).includes(KEY), false);
});

test('a term-only decision is written with the term as the anchor', async () => {
  const run = await drive({ claims: [TERM], steps: [answer(1, cleanDraft('term'))] });
  assert.ifError(run.error);
  assert.equal(run.commitCalls[0].branch, `autowriter/${TERM.slug}`);
  assert.equal(run.summary.slug, TERM.slug);
});

test('the real adapter on a fake vendor: one model check, one structured request, a valid record and no key in any file', async () => {
  const { adapter, calls } = adapterOn({
    apiKey: KEY,
    routes: {
      [ROUTES.models]: () => reply(modelList({ shutdownDates: { 'gpt-6.1-terra': '2027-01-01' } })),
      [ROUTES.responses]: () =>
        reply(completed({ text: JSON.stringify(cleanDraft('article')), input: 1000, output: 100 })),
    },
  });
  const run = await drive({ claims: [POST], adapter });
  assert.ifError(run.error);
  assert.deepEqual(
    calls.map(({ route }) => route),
    [ROUTES.models, ROUTES.responses]
  );
  const request = calls[1].json;
  assert.equal(request.model, 'gpt-6.1-terra');
  assert.equal(request.store, false);
  assert.deepEqual(request.prompt_cache_options, { mode: 'explicit' });
  assert.equal(calls[1].key, KEY);
  assert.match(run.summary.notes[0], /2027-01-01/);
  const texts = textsOf(run.commitCalls[0]);
  const record = JSON.parse(texts[generationPathOf(POST)]);
  assert.deepEqual(validateRecord(record), []);
  assert.equal(record.totals.costUsd, 0.0015);
  assert.equal(record.provider, 'openai');
  assert.equal(record.model, 'gpt-6.1-terra');
  assert.deepEqual(record.modelChecks[0].shutdownDate, '2027-01-01');
  for (const { text } of run.commitCalls[0].files) assert.equal(text.includes(KEY), false);
  assert.equal(run.commitCalls[0].message.includes(KEY), false);
});

test('the spend report in the one commit is stamped with the instant of the run clock', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  assert.ifError(run.error);
  const report = textsOf(run.commitCalls[0])[REPORT_PATH];
  assert.equal(report.split('\n')[3], `Generated-at: ${NOW.toISOString()}`);
});

const savedOf = (run, claim) => {
  const texts = textsOf(run.commitCalls[0]);
  return { record: JSON.parse(texts[generationPathOf(claim)]), ledger: JSON.parse(texts[ledgerPathOf(claim)]) };
};
const driveCategory = (steps) => drive({ claims: [CATEGORY_POST], shapes: CATEGORY_SHAPES, steps });

test('a category entry counts its proposal call and its draft call once each, and publishes its draft call', async () => {
  const run = await driveCategory([answer(1, cleanDraft('article'))]);
  assert.ifError(run.error);
  const { record, ledger } = savedOf(run, CATEGORY_POST);
  assert.deepEqual([validateRecord(record), validateLedger(ledger)], [[], []]);
  assert.deepEqual(
    record.calls.map(({ role }) => role),
    ['topic', 'draft']
  );
  assert.deepEqual(record.published, { callIndex: 1 });
  assert.equal(record.responseId, 'resp_1');
  assert.deepEqual(record.totals, { tokens: { input: 2800, output: 160 }, costUsd: ENTRY_COST });
  assert.deepEqual(ledger.generation, record.totals);
  assert.equal(ledger.spend.costUsd, ENTRY_COST);
  assert.equal(run.summary.spend.costUsd, ENTRY_COST);
  assert.equal(run.adapter.seen.length, 1);
  assert.equal(CATEGORY_SHAPES[CATEGORY_POST.slug].proposal.calls.length, 1);
});

test('a category entry is written with its origin and category, no prompt, no report row and no report table', async () => {
  const run = await driveCategory([answer(1, cleanDraft('article'))]);
  assert.ifError(run.error);
  const { record } = savedOf(run, CATEGORY_POST);
  assert.deepEqual(record.claim, {
    title: CATEGORY_POST.title,
    query: CATEGORY_POST.query,
    origin: 'category',
    category: 'governance',
  });
  assert.deepEqual([record.demand.row, record.demand.report.table], [null, null]);
  const { message } = run.commitCalls[0];
  assert.match(message, /^Origin: category$/m);
  assert.match(message, /^Category: governance$/m);
  assert.doesNotMatch(message, /Serves buyer prompt/);
  assert.doesNotMatch(run.adapter.seen[0].messages[0].content, /Search Console row it was chosen from/);
});

for (const [name, step, kind, cost] of [
  ['billed and refused', new WriterError('output', 'cut off', { call: answer(1, {}) }), 'output', ENTRY_COST],
  ['free and failed', new WriterError('vendor', 'openai answered HTTP 500', { status: 500 }), 'vendor', TOPIC_COST],
])
  test(`a category entry whose draft is ${name} keeps the proposal spend in the stopped ledger`, async () => {
    const run = await driveCategory([step]);
    assert.equal(run.error?.kind, kind);
    assert.equal(run.error.spend.costUsd, cost);
    const ledger = storedLedger(run.root, CATEGORY_POST);
    assert.deepEqual([ledger.verdict.state, ledger.generation.costUsd, validateLedger(ledger)], ['stopped', cost, []]);
  });

test('a weak-demand entry is written with its row and weakness, no prompt and no proposal, and the message says so', async () => {
  const run = await drive({ claims: [WEAK_POST], shapes: WEAK_SHAPES, steps: [answer(1, cleanDraft('article'))] });
  assert.ifError(run.error);
  const { record } = savedOf(run, WEAK_POST);
  assert.deepEqual(validateRecord(record), []);
  assert.deepEqual(record.claim, {
    title: WEAK_POST.title,
    query: WEAK_POST.query,
    origin: 'weak-demand',
    weakness: WEAK_POST.weakness,
  });
  assert.deepEqual(
    [record.demand.row, record.demand.report.table, record.published],
    [QUERIES_ROW, 'Queries', { callIndex: 0 }]
  );
  const { message } = run.commitCalls[0];
  assert.match(message, /^Origin: weak-demand$/m);
  assert.match(message, /^Weak query: no-buyer-prompt, impressions-at-floor$/m);
  assert.doesNotMatch(message, /Serves buyer prompt|^Category:/m);
});

test('a demand entry keeps the line that says which buyer prompt it serves, and has no origin line', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  assert.ifError(run.error);
  const { message } = run.commitCalls[0];
  for (const { prompt } of [POST, TERM])
    assert.ok(message.includes(`Serves buyer prompt ${prompt.number}: ${prompt.text}`));
  assert.doesNotMatch(message, /^(Origin|Category|Weak query):/m);
});
