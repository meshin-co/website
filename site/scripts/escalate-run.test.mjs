import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { newLedger, readLedger, validateLedger, writeLedger } from './autowriter-ledger.mjs';
import { EscalationError } from './escalate.mjs';
import { raiseOnRun, runCli } from './escalate-run.mjs';

const TOKEN = 'ghp_SECRETtokenVALUE0123456789';
const WEBHOOK_PATH = '/services/T0SECRET/B0SECRET/xoxSECRETpath';
const WEBHOOK = 'https://hooks.slack.test' + WEBHOOK_PATH;
const ENV = {
  GITHUB_TOKEN: TOKEN,
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_SERVER_URL: 'https://github.test',
  GITHUB_RUN_ID: '777',
  SLACK_WEBHOOK_URL: WEBHOOK,
};
const NOW = () => new Date('2026-11-02T10:00:00.000Z');
const SLUG = 'demand-refresh-2026-11-02';
const TITLE = 'Search Console refresh failed';
const DETAIL = 'The refresh answered HTTP 401.';
const COMMIT = 'a'.repeat(40);
const DEBT = { mergedCommit: COMMIT, fingerprint: 'd'.repeat(64), recordedAt: NOW().toISOString(), clear: 'gate:lh' };
const RUN_FIELD = '*Workflow run*\n<https://github.test/meshin-co/website/actions/runs/777|run 777>';
const ISSUE_FIELD = '*Issue*\n<https://github.test/meshin-co/website/issues/12|#12>';

const created = (number = 12) =>
  new Response(JSON.stringify({ number, html_url: 'https://github.test/meshin-co/website/issues/' + number }), {
    status: 201,
  });
const answer = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

function scripted(...answers) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, ...init, body: JSON.parse(init.body) });
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

async function inDirectory(run) {
  const dir = mkdtempSync(join(tmpdir(), 'escalate-run-'));
  try {
    return await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function capture() {
  const out = [];
  const err = [];
  return { out, err, stdout: (line) => out.push(line), stderr: (line) => err.push(line) };
}

const flags = (dir, overrides = {}) => {
  const values = { 'ledger-dir': dir, slug: SLUG, kind: 'credential', title: TITLE, detail: DETAIL, ...overrides };
  return Object.entries(values).flatMap(([name, value]) => [`--${name}`, value]);
};

async function run(dir, { overrides, env = ENV, fetch } = {}) {
  const sink = capture();
  const code = await runCli(flags(dir, overrides), { env, fetch, now: NOW, stdout: sink.stdout, stderr: sink.stderr });
  return { code, ...sink };
}

const ledgerIn = (dir, slug = SLUG) => readLedger(join(dir, slug + '.json'));
const raise = (dir, { kind = 'credential', env = ENV, fetch, slug = SLUG } = {}) =>
  raiseOnRun({ ledgerDir: dir, slug, kind, title: TITLE, detail: DETAIL, env, fetch, now: NOW });

const blocksOf = ({ blocks }) => {
  assert.ok(Array.isArray(blocks), 'the Slack body carries no blocks');
  return blocks;
};
const columnsOf = (body) => blocksOf(body).flatMap((block) => (block.fields ?? []).map(({ text }) => text));

test('a refresh failure with no ledger creates one, delivers both channels and records the verdict', () =>
  inDirectory(async (dir) => {
    const { fetch, calls } = scripted(created(), answer(200, 'ok'));
    const result = await run(dir, { fetch });
    assert.equal(result.code, 0);
    assert.equal(calls.length, 2);
    assert.deepEqual(readdirSync(dir), [SLUG + '.json']);
    const ledger = ledgerIn(dir);
    assert.deepEqual(validateLedger(ledger), []);
    assert.equal(ledger.slug, SLUG);
    assert.equal(ledger.runId, '777');
    assert.equal(ledger.pullRequest, null);
    assert.equal(ledger.escalations.length, 1);
    assert.deepEqual(
      ledger.escalations[0].receipts.map(({ channel, delivered }) => [channel, delivered]),
      [
        ['issue', true],
        ['slack', true],
      ]
    );
    assert.deepEqual(ledger.verdict, { state: 'escalated', reason: TITLE, decidedAt: '2026-11-02T10:00:00.000Z' });
    assert.equal(result.out.length, 2);
    assert.match(result.out[0], /escalate: esc-1 issue delivered \(HTTP 201, issue #12\)/);
    assert.match(result.out[1], /escalate: esc-1 slack delivered \(HTTP 200\)/);
    assert.deepEqual(result.err, []);
  }));

test('a blank GITHUB_RUN_ID gives the ledger the run id local, and raiseOnRun returns the escalation', () =>
  inDirectory(async (dir) => {
    const { fetch } = scripted(created(), answer(200, 'ok'));
    const escalation = await raise(dir, { env: { ...ENV, GITHUB_RUN_ID: '  ' }, fetch });
    assert.equal(ledgerIn(dir).runId, 'local');
    assert.deepEqual(escalation, ledgerIn(dir).escalations[0]);
  }));

test('the Slack message of a refresh failure links the workflow run and the issue, and names no pull request', () =>
  inDirectory(async (dir) => {
    const { fetch, calls } = scripted(created(), answer(200, 'ok'));
    await run(dir, { fetch });
    assert.deepEqual(columnsOf(calls[1].body), [RUN_FIELD, ISSUE_FIELD]);
  }));

test('with no run named in the environment the Slack message links no run, whatever the ledger calls it', () =>
  inDirectory(async (dir) => {
    const { fetch, calls } = scripted(created(), answer(200, 'ok'));
    await run(dir, { env: { ...ENV, GITHUB_RUN_ID: '  ' }, fetch });
    assert.deepEqual(columnsOf(calls[1].body), [ISSUE_FIELD]);
    assert.equal(calls[1].body.text.includes('actions/runs'), false);
  }));

test('hard-stop needs only the issue', () =>
  inDirectory(async (dir) => {
    const { fetch, calls } = scripted(created());
    const result = await run(dir, { overrides: { kind: 'hard-stop' }, fetch });
    assert.equal(result.code, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(
      ledgerIn(dir).escalations[0].receipts.map(({ channel }) => channel),
      ['issue']
    );
    assert.equal(ledgerIn(dir).verdict.state, 'escalated');
  }));

test('a Slack failure leaves a failed receipt, an escalated verdict and exit 1', () =>
  inDirectory(async (dir) => {
    const { fetch } = scripted(created(), answer(404, 'no_service'));
    const result = await run(dir, { fetch });
    assert.equal(result.code, 1);
    const ledger = ledgerIn(dir);
    assert.deepEqual(validateLedger(ledger), []);
    assert.equal(ledger.escalations[0].receipts[1].delivered, false);
    assert.equal(ledger.escalations[0].receipts[1].status, 404);
    assert.deepEqual(ledger.verdict, { state: 'escalated', reason: TITLE, decidedAt: '2026-11-02T10:00:00.000Z' });
    assert.equal(result.out.length, 2);
    assert.match(result.out[0], /issue delivered/);
    assert.match(result.out[1], /escalate: esc-1 slack NOT delivered: /);
  }));

test('raiseOnRun rethrows the EscalationError only after the verdict is on disk', () =>
  inDirectory(async (dir) => {
    const { fetch } = scripted(created(), answer(404, 'no_service'));
    const error = await raise(dir, { fetch }).then(
      () => assert.fail('expected EscalationError'),
      (thrown) => thrown
    );
    assert.ok(error instanceof EscalationError);
    assert.deepEqual(error.missing, ['slack']);
    assert.equal(ledgerIn(dir).verdict.state, 'escalated');
  }));

const receipt = (channel) => ({
  channel,
  attemptedAt: '2026-11-01T08:00:00.000Z',
  delivered: true,
  status: channel === 'issue' ? 201 : 200,
  issue: channel === 'issue' ? 9 : null,
  error: null,
});
const earlierEscalation = (id) => ({
  id,
  kind: 'credential',
  title: 'Earlier ' + id,
  detail: 'Earlier detail.',
  raisedAt: '2026-11-01T08:00:00.000Z',
  receipts: [receipt('issue'), receipt('slack')],
});

function busyLedger() {
  const ledger = newLedger({ slug: 'post-one', runId: 'run-1', pullRequest: 12 });
  const attempt = {
    number: 1,
    judgedCommit: COMMIT,
    recordedAt: '2026-11-01T07:00:00.000Z',
    failingRule: 'content',
    failingPath: 'src/data/posts/post-one.md',
    tokens: { input: 1200, output: 300 },
    costUsd: 0.75,
  };
  const generation = { tokens: { input: 5000, output: 900 }, costUsd: 1.25 };
  ledger.attempts.push(attempt);
  ledger.generation = generation;
  ledger.spend = { tokens: { input: 6200, output: 1200 }, costUsd: 2 };
  ledger.refusals = [{ title: 'Held', reason: 'slug-held', against: 'other-post', detail: 'Another claim holds it.' }];
  ledger.escalations.push(earlierEscalation('esc-1'));
  return ledger;
}

test('an existing ledger keeps its attempts, spend, generation, refusals and escalations', () =>
  inDirectory(async (dir) => {
    const path = join(dir, 'post-one.json');
    const before = busyLedger();
    writeLedger(path, before);
    const { fetch } = scripted(created(13), answer(200, 'ok'));
    await raise(dir, { slug: 'post-one', fetch });
    const after = readLedger(path);
    assert.deepEqual(validateLedger(after), []);
    for (const field of ['runId', 'pullRequest', 'attempts', 'generation', 'spend', 'refusals'])
      assert.deepEqual(after[field], before[field], field);
    assert.deepEqual(after.escalations[0], before.escalations[0]);
    assert.deepEqual(
      after.escalations.map(({ id }) => id),
      ['esc-1', 'esc-2']
    );
    assert.equal(after.verdict.state, 'escalated');
  }));

const SETTLED = [
  ['merged', null],
  ['escalated', 'First reason'],
];

for (const [state, reason] of SETTLED)
  test('an already ' + state + ' verdict is not overwritten', () =>
    inDirectory(async (dir) => {
      const path = join(dir, 'post-one.json');
      const ledger = newLedger({ slug: 'post-one', runId: 'run-1', pullRequest: 12 });
      if (state === 'escalated') ledger.escalations.push(earlierEscalation('esc-1'));
      if (state === 'merged') ledger.measurementDebt = DEBT;
      ledger.verdict = { state, reason, decidedAt: '2026-11-01T09:00:00.000Z' };
      writeLedger(path, ledger);
      const { fetch } = scripted(created(), answer(200, 'ok'));
      await raise(dir, { slug: 'post-one', fetch });
      assert.deepEqual(readLedger(path).verdict, ledger.verdict);
    })
  );

const USAGE_CASES = [
  ['a blank detail', { detail: '   ' }],
  ['a blank title', { title: '' }],
  ['a blank slug', { slug: ' ' }],
  ['a blank ledger dir', { 'ledger-dir': '' }],
  ['an unknown kind', { kind: 'panic' }],
];

for (const [name, overrides] of USAGE_CASES)
  test('usage error, exit 2 and no file: ' + name, () =>
    inDirectory(async (dir) => {
      const { fetch, calls } = scripted(created(), answer(200, 'ok'));
      const result = await run(dir, { overrides, fetch });
      assert.equal(result.code, 2);
      assert.equal(result.out.length, 0);
      assert.equal(result.err.length, 1);
      assert.match(result.err[0], /Usage:/);
      assert.match(result.err[0], /--ledger-dir <dir> --slug <slug> --kind <kind> --title <text> --detail <text>/);
      assert.equal(calls.length, 0);
      assert.deepEqual(readdirSync(dir), []);
    })
  );

test('usage error, exit 2: a missing flag, an unknown flag and a flag without a value', () =>
  inDirectory(async (dir) => {
    const cases = [
      ['--ledger-dir', dir, '--slug', SLUG, '--kind', 'credential', '--title', TITLE],
      [...flags(dir), '--extra', 'x'],
      ['--ledger-dir', dir, '--slug'],
      [],
    ];
    for (const argv of cases) {
      const sink = capture();
      assert.equal(await runCli(argv, { env: ENV, now: NOW, stdout: sink.stdout, stderr: sink.stderr }), 2);
      assert.match(sink.err[0], /Usage:/);
    }
    assert.deepEqual(readdirSync(dir), []);
  }));

test('a slug that is not a valid ledger name exits 1 and writes no file', () =>
  inDirectory(async (dir) => {
    const { fetch, calls } = scripted(created(), answer(200, 'ok'));
    const result = await run(dir, { overrides: { slug: 'Not A Slug' }, fetch });
    assert.equal(result.code, 1);
    assert.match(result.err[0], /^escalate-run: /);
    assert.equal(calls.length, 0);
    assert.deepEqual(readdirSync(dir), []);
  }));

const LEAKY_ANSWERS = [
  [
    answer(403, { message: 'token ' + TOKEN + ' rejected' }),
    answer(404, 'unknown ' + WEBHOOK + ' and ' + WEBHOOK_PATH),
  ],
  [new Error('connect failed via ' + WEBHOOK + ' with ' + TOKEN), new Error('reset ' + TOKEN + ' ' + WEBHOOK)],
  [created(), answer(500, 'y'.repeat(190) + TOKEN + 'z'.repeat(50))],
];
const SECRET_FRAGMENTS = [TOKEN, TOKEN.slice(0, 12), WEBHOOK, WEBHOOK_PATH, 'T0SECRET', 'B0SECRET', 'xoxSECRETpath'];

for (const [index, answers] of LEAKY_ANSWERS.entries())
  test('no secret reaches the ledger, stdout, stderr or a posted body: scenario ' + (index + 1), () =>
    inDirectory(async (dir) => {
      const { fetch, calls } = scripted(...answers);
      const result = await run(dir, { fetch });
      assert.equal(result.code, 1);
      const posted = calls.map(({ body }) => body);
      assert.ok(
        posted.some(({ blocks }) => blocks?.length > 0),
        'no Slack message with blocks was posted'
      );
      const written = [readFileSync(join(dir, SLUG + '.json'), 'utf8'), ...result.out, ...result.err];
      const everything = [...written, ...posted.map((body) => JSON.stringify(body))].join('\n');
      for (const fragment of SECRET_FRAGMENTS) assert.ok(!everything.includes(fragment), fragment);
    })
  );
