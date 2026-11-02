import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { claimFile } from './autowriter-claims.mjs';
import { ledgerFile, newLedger, readLedger } from './autowriter-ledger.mjs';
import { entryPath, renderEntry } from './entry-files.mjs';
import { RUN_DATE, claimFor, cleanDraft } from './fixtures/writer-drafts.mjs';
import { ROUTES, adapterOn, completed, modelList, reply } from './fixtures/writer-vendors.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { generationFile, validateRecord } from './generation-record.mjs';
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

function scene({ claims = [POST, TERM] } = {}) {
  const root = makeRepo();
  roots.push(root);
  for (const claim of claims) put(root, claimFile(claim.slug), claim);
  put(root, ledgerFile(claims[0].slug), newLedger({ slug: claims[0].slug, runId: claims[0].runId, pullRequest: null }));
  const decision = {
    schema: 1,
    decision: 'write',
    ledgerPath: ledgerFile(claims[0].slug),
    entries: claims.map((claim) => ({
      claimPath: claimFile(claim.slug),
      claim,
      row: { '#': String(claim.prompt.number), Prompt: claim.prompt.text },
      table: claim.format === 'term' ? 'Queries' : 'Buyer prompts',
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

async function drive({ claims, steps, assemble, commit, adapterOptions, adapter: supplied } = {}) {
  const { root, decision } = scene({ claims });
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
const storedLedger = (root, slug) => readLedger(join(root, ledgerFile(slug)));

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
    for (const path of [entryPath(claim), generationFile(claim.slug), claimFile(claim.slug)])
      assert.ok(paths.includes(path), `${path} is not in the commit`);
  assert.ok(paths.includes(ledgerFile(POST.slug)));
  assert.equal(new Set(paths).size, paths.length);
});

test('each entry keeps its own record with its own calls, and the claims are written', async () => {
  const run = await drive({ steps: [answer(1, cleanDraft('article')), answer(2, cleanDraft('term'))] });
  const texts = textsOf(run.commitCalls[0]);
  const post = JSON.parse(texts[generationFile(POST.slug)]);
  const term = JSON.parse(texts[generationFile(TERM.slug)]);
  assert.deepEqual(validateRecord(post), []);
  assert.deepEqual(validateRecord(term), []);
  assert.equal(post.calls.length, 1);
  assert.equal(term.calls.length, 1);
  assert.equal(post.totals.costUsd, 0.0015);
  assert.equal(term.totals.costUsd, 0.003);
  assert.equal(post.ledger, ledgerFile(POST.slug));
  assert.equal(term.ledger, ledgerFile(POST.slug));
  assert.equal(post.demand.report.table, 'Buyer prompts');
  assert.equal(term.demand.report.table, 'Queries');
  assert.equal(JSON.parse(texts[claimFile(POST.slug)]).status, 'written');
  assert.equal(JSON.parse(texts[claimFile(TERM.slug)]).status, 'written');
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
    const record = JSON.parse(texts[generationFile(claim.slug)]);
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
  const ledger = JSON.parse(textsOf(run.commitCalls[0])[ledgerFile(POST.slug)]);
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
  assert.equal(paths.includes(claimFile(TERM.slug)), false);
  assert.equal(paths.includes(generationFile(TERM.slug)), false);
  assert.deepEqual(
    run.summary.skipped.map(({ slug, format, spend }) => [slug, format, spend.costUsd]),
    [[TERM.slug, 'term', 0.003]]
  );
  assert.equal(run.summary.spend.costUsd, 0.0045);
  const ledger = JSON.parse(textsOf(run.commitCalls[0])[ledgerFile(POST.slug)]);
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
  const ledger = storedLedger(run.root, POST.slug);
  assert.equal(ledger.verdict.state, 'stopped');
  assert.equal(ledger.generation.costUsd, 0.0015);
  assert.match(ledger.verdict.reason, /output/);
});

test('a failure that costs nothing leaves the ledger as it was', async () => {
  const run = await drive({ steps: [new WriterError('vendor', 'openai answered HTTP 500', { status: 500 })] });
  assert.equal(run.error?.kind, 'vendor');
  assert.equal(storedLedger(run.root, POST.slug).verdict.state, 'open');
  assert.equal(storedLedger(run.root, POST.slug).generation, undefined);
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
  assert.equal(storedLedger(run.root, POST.slug).generation.costUsd, 0.0015);
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
    run.commitCalls[0].files.some(({ path }) => path === claimFile(TERM.slug)),
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
  assert.equal(storedLedger(run.root, POST.slug).verdict.state, 'stopped');
  assert.equal(storedLedger(run.root, POST.slug).generation.costUsd, 0.0015);
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
  assert.equal(storedLedger(run.root, POST.slug).generation.costUsd, 0.0045);
  assert.equal(JSON.parse(readFileSync(join(run.root, claimFile(POST.slug)), 'utf8')).status, 'claimed');
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
  const record = JSON.parse(texts[generationFile(POST.slug)]);
  assert.deepEqual(validateRecord(record), []);
  assert.equal(record.totals.costUsd, 0.0015);
  assert.equal(record.provider, 'openai');
  assert.equal(record.model, 'gpt-6.1-terra');
  assert.deepEqual(record.modelChecks[0].shutdownDate, '2027-01-01');
  for (const { text } of run.commitCalls[0].files) assert.equal(text.includes(KEY), false);
  assert.equal(run.commitCalls[0].message.includes(KEY), false);
});
