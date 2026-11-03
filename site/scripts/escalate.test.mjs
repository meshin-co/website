import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { newLedger, readLedger, writeLedger } from './autowriter-ledger.mjs';
import { EscalationError, escalate, redeliver, runCli } from './escalate.mjs';
import { autowriterAgent } from './site-brand.mjs';

const SITE = resolve(import.meta.dirname, '..');
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
const without = (...names) => Object.fromEntries(Object.entries(ENV).filter(([name]) => !names.includes(name)));
const NOW = () => new Date('2026-11-02T10:00:00.000Z');
const TITLE = 'Spend ceiling reached';
const DETAIL = 'Monthly spend is 25.10 USD.';
const ISSUE_URL = 'https://github.test/meshin-co/website/issues/12';
const NOT_SET = {
  token: 'GITHUB_TOKEN is not set; pass a token with Issues: write in the workflow env',
  repository: 'GITHUB_REPOSITORY is not set; pass owner/name in the workflow env',
  webhook: 'SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
};

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

async function withLedger(run, edit = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'escalate-'));
  const path = join(dir, 'post-one.json');
  try {
    const ledger = newLedger({ slug: 'post-one', runId: 'run-1', pullRequest: 12 });
    edit(ledger);
    writeLedger(path, ledger);
    return await run({ path, dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const raise = (path, { kind = 'credential', env = ENV, fetch, title = TITLE, detail = DETAIL } = {}) =>
  escalate({ ledgerPath: path, kind, title, detail, env, fetch, now: NOW });
const failure = (promise) =>
  promise.then(
    () => assert.fail('expected EscalationError'),
    (error) => error
  );
const stored = (path) => readLedger(path).escalations;

test('both channels delivered: exact requests and receipts on disk', () =>
  withLedger(async ({ path }) => {
    const { fetch, calls } = scripted(created(), answer(200, 'ok'));
    const escalation = await raise(path, { fetch });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.github.com/repos/meshin-co/website/issues');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].headers, {
      Authorization: 'Bearer ' + TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': autowriterAgent(),
    });
    assert.deepEqual(calls[0].body, {
      title: TITLE,
      body:
        DETAIL +
        '\n\n---\nKind: credential\nLedger: ' +
        path +
        '\nSlug: post-one\nPull request: #12\nActions run: https://github.test/meshin-co/website/actions/runs/777',
    });
    assert.equal(calls[1].url, WEBHOOK);
    assert.equal(calls[1].method, 'POST');
    assert.deepEqual(calls[1].headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(calls[1].body, {
      text:
        'Autowriter escalation (credential): ' + TITLE + '\n' + DETAIL + '\nLedger: ' + path + '\nIssue: ' + ISSUE_URL,
    });
    const receipts = [
      {
        channel: 'issue',
        attemptedAt: '2026-11-02T10:00:00.000Z',
        delivered: true,
        status: 201,
        issue: 12,
        error: null,
      },
      {
        channel: 'slack',
        attemptedAt: '2026-11-02T10:00:00.000Z',
        delivered: true,
        status: 200,
        issue: null,
        error: null,
      },
    ];
    assert.deepEqual(escalation.receipts, receipts);
    assert.deepEqual(stored(path), [
      { id: 'esc-1', kind: 'credential', title: TITLE, detail: DETAIL, raisedAt: '2026-11-02T10:00:00.000Z', receipts },
    ]);
  }));

test('GITHUB_API_URL redirects the issue request and a ledger without a pull request omits the line', () =>
  withLedger(
    async ({ path }) => {
      const { fetch, calls } = scripted(created());
      await raise(path, {
        kind: 'hard-stop',
        env: { ...without('GITHUB_RUN_ID'), GITHUB_API_URL: 'https://api.github.test' },
        fetch,
      });
      assert.equal(calls[0].url, 'https://api.github.test/repos/meshin-co/website/issues');
      assert.equal(calls[0].body.body, DETAIL + '\n\n---\nKind: hard-stop\nLedger: ' + path + '\nSlug: post-one');
    },
    (ledger) => {
      ledger.pullRequest = null;
    }
  ));

test('missing webhook secret: issue delivered, failed Slack receipt recorded, EscalationError thrown', () =>
  withLedger(async ({ path }) => {
    const { fetch, calls } = scripted(created());
    const error = await failure(raise(path, { env: without('SLACK_WEBHOOK_URL'), fetch }));
    assert.ok(error instanceof EscalationError);
    assert.match(error.message, /SLACK_WEBHOOK_URL/);
    assert.deepEqual(error.missing, ['slack']);
    assert.equal(calls.length, 1);
    const [issue, slack] = stored(path)[0].receipts;
    assert.equal(issue.delivered, true);
    assert.deepEqual(slack, {
      channel: 'slack',
      attemptedAt: '2026-11-02T10:00:00.000Z',
      delivered: false,
      status: null,
      issue: null,
      error: NOT_SET.webhook,
    });
    assert.deepEqual(error.escalation, stored(path)[0]);
  }));

test('missing token and missing repository: no GitHub request, Slack still attempted', () =>
  withLedger(async ({ path }) => {
    const first = scripted(answer(200, 'ok'));
    const noToken = await failure(raise(path, { env: without('GITHUB_TOKEN'), fetch: first.fetch }));
    assert.deepEqual(noToken.missing, ['issue']);
    assert.deepEqual(
      first.calls.map(({ url }) => url),
      [WEBHOOK]
    );
    assert.equal(
      first.calls[0].body.text,
      'Autowriter escalation (credential): ' + TITLE + '\n' + DETAIL + '\nLedger: ' + path
    );
    assert.equal(noToken.escalation.receipts[0].error, NOT_SET.token);
    const second = scripted(answer(200, 'ok'));
    const noRepository = await failure(raise(path, { env: without('GITHUB_REPOSITORY'), fetch: second.fetch }));
    assert.equal(noRepository.escalation.receipts[0].error, NOT_SET.repository);
    const third = scripted();
    const neither = await failure(
      raise(path, { env: without('GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'SLACK_WEBHOOK_URL'), fetch: third.fetch })
    );
    assert.equal(third.calls.length, 0);
    assert.equal(neither.escalation.receipts[0].error, NOT_SET.token + '; ' + NOT_SET.repository);
    assert.deepEqual(neither.missing, ['issue', 'slack']);
  }));

test('GitHub 403 with a JSON message records the message and Slack is still attempted', () =>
  withLedger(async ({ path }) => {
    const { fetch, calls } = scripted(
      answer(403, { message: 'Resource not accessible by integration' }),
      answer(200, 'ok')
    );
    const error = await failure(raise(path, { fetch }));
    assert.deepEqual(error.missing, ['issue']);
    assert.equal(calls.length, 2);
    assert.deepEqual(stored(path)[0].receipts[0], {
      channel: 'issue',
      attemptedAt: '2026-11-02T10:00:00.000Z',
      delivered: false,
      status: 403,
      issue: null,
      error: 'GitHub answered HTTP 403: Resource not accessible by integration',
    });
    assert.ok(!calls[1].body.text.includes('Issue:'));
  }));

test('GitHub failures without a JSON message use the first 200 characters, one line', () =>
  withLedger(async ({ path }) => {
    const { fetch } = scripted(answer(502, 'bad\ngateway ' + 'x'.repeat(400)), answer(200, 'ok'));
    const error = await failure(raise(path, { fetch }));
    const message = error.escalation.receipts[0].error;
    assert.equal(message, ('GitHub answered HTTP 502: ' + 'bad gateway ' + 'x'.repeat(400)).slice(0, 26 + 200));
    assert.ok(message.length <= 300 && !message.includes('\n'));
  }));

test('a 200 or an issue-less 201 from GitHub is not a delivery', () =>
  withLedger(async ({ path }) => {
    const { fetch } = scripted(answer(200, { number: 1 }), answer(201, { ok: true }));
    const error = await failure(raise(path, { kind: 'hard-stop', fetch }));
    assert.equal(error.escalation.receipts[0].status, 200);
    assert.equal(error.escalation.receipts[0].delivered, false);
    const again = await failure(raise(path, { kind: 'hard-stop', fetch: scripted(answer(201, { ok: true })).fetch }));
    assert.equal(again.escalation.receipts[0].status, 201);
    assert.match(again.escalation.receipts[0].error, /^GitHub answered HTTP 201 without an issue number/);
  }));

test('Slack 404 records the status and the first 200 characters', () =>
  withLedger(async ({ path }) => {
    const { fetch } = scripted(created(), answer(404, 'no_service'));
    const error = await failure(raise(path, { fetch }));
    assert.deepEqual(error.missing, ['slack']);
    assert.equal(stored(path)[0].receipts[1].status, 404);
    assert.equal(stored(path)[0].receipts[1].error, 'Slack answered HTTP 404: no_service');
  }));

test('a thrown fetch records status null and the message', () =>
  withLedger(async ({ path }) => {
    const { fetch, calls } = scripted(new Error('socket hang up'), new Error('getaddrinfo ENOTFOUND'));
    const error = await failure(raise(path, { fetch }));
    assert.equal(calls.length, 2);
    assert.deepEqual(error.missing, ['issue', 'slack']);
    const [issue, slack] = stored(path)[0].receipts;
    assert.deepEqual([issue.status, issue.error], [null, 'request failed: socket hang up']);
    assert.deepEqual([slack.status, slack.error], [null, 'request failed: getaddrinfo ENOTFOUND']);
  }));

test('digest kinds open the issue and never call Slack', () =>
  withLedger(async ({ path }) => {
    for (const kind of ['hard-stop', 'unrepairable']) {
      const { fetch, calls } = scripted(created());
      const escalation = await raise(path, { kind, fetch });
      assert.deepEqual(
        calls.map(({ url }) => url),
        ['https://api.github.com/repos/meshin-co/website/issues']
      );
      assert.deepEqual(
        escalation.receipts.map(({ channel }) => channel),
        ['issue']
      );
    }
  }));

test('unknown kind, blank text and an invalid ledger throw before any request and leave the file untouched', () =>
  withLedger(async ({ path, dir }) => {
    const before = readFileSync(path, 'utf8');
    const { fetch, calls } = scripted(created());
    await assert.rejects(raise(path, { kind: 'cosmic', fetch }), /unknown escalation kind cosmic/);
    await assert.rejects(raise(path, { title: '  ', fetch }), /title/);
    await assert.rejects(raise(path, { detail: '', fetch }), /detail/);
    const broken = join(dir, 'broken.json');
    writeFileSync(broken, '{"schema":2}\n');
    await assert.rejects(raise(broken, { fetch }), /broken\.json does not match the ledger schema/);
    await assert.rejects(raise(join(dir, 'absent.json'), { fetch }), /absent\.json/);
    const misnamed = join(dir, 'other-name.json');
    writeFileSync(misnamed, before);
    await assert.rejects(raise(misnamed, { fetch }), /does not match the file name/);
    assert.equal(calls.length, 0);
    assert.equal(readFileSync(path, 'utf8'), before);
    assert.equal(readFileSync(broken, 'utf8'), '{"schema":2}\n');
    assert.equal(readFileSync(misnamed, 'utf8'), before);
  }));

const seeded = (ledger) => {
  ledger.attempts.push({
    number: 1,
    judgedCommit: 'a'.repeat(40),
    recordedAt: '2026-11-02T07:00:00.000Z',
    failingRule: null,
    failingPath: null,
    tokens: { input: 10, output: 5 },
    costUsd: 0.5,
  });
  ledger.spend = { tokens: { input: 10, output: 5 }, costUsd: 0.5 };
};

test('ids count up and attempts, spend and verdict are never touched', () =>
  withLedger(async ({ path }) => {
    const before = readLedger(path);
    await raise(path, { fetch: scripted(created(), answer(200, 'ok')).fetch });
    const second = await raise(path, { kind: 'hard-stop', fetch: scripted(created(13)).fetch });
    assert.equal(second.id, 'esc-2');
    const after = readLedger(path);
    assert.deepEqual(
      after.escalations.map(({ id }) => id),
      ['esc-1', 'esc-2']
    );
    for (const field of ['attempts', 'spend', 'verdict', 'slug', 'runId', 'pullRequest'])
      assert.deepEqual(after[field], before[field]);
  }, seeded));

test('redeliver retries only the undelivered channel, appends receipts, and a second call is a no-op', () =>
  withLedger(async ({ path }) => {
    await failure(raise(path, { env: without('SLACK_WEBHOOK_URL'), fetch: scripted(created()).fetch }));
    const retry = scripted(answer(200, 'ok'));
    const escalation = await redeliver({ ledgerPath: path, id: 'esc-1', env: ENV, fetch: retry.fetch, now: NOW });
    assert.deepEqual(
      retry.calls.map(({ url }) => url),
      [WEBHOOK]
    );
    assert.equal(retry.calls[0].body.text.split('\n').at(-1), 'Issue: ' + ISSUE_URL);
    assert.deepEqual(
      escalation.receipts.map(({ channel, delivered }) => [channel, delivered]),
      [
        ['issue', true],
        ['slack', false],
        ['slack', true],
      ]
    );
    assert.equal(stored(path).length, 1);
    assert.deepEqual(stored(path)[0], escalation);
    const idle = scripted();
    await redeliver({ ledgerPath: path, id: 'esc-1', env: ENV, fetch: idle.fetch, now: NOW });
    assert.equal(idle.calls.length, 0);
    assert.equal(stored(path)[0].receipts.length, 3);
  }));

test('redeliver of a failed issue channel retries the issue only and throws while it still fails', () =>
  withLedger(async ({ path }) => {
    await failure(raise(path, { env: without('GITHUB_TOKEN'), fetch: scripted(answer(200, 'ok')).fetch }));
    const retry = scripted(answer(401, { message: 'Bad credentials' }));
    const error = await failure(redeliver({ ledgerPath: path, id: 'esc-1', env: ENV, fetch: retry.fetch, now: NOW }));
    assert.deepEqual(error.missing, ['issue']);
    assert.equal(retry.calls.length, 1);
    assert.deepEqual(
      stored(path)[0].receipts.map(({ channel, status }) => [channel, status]),
      [
        ['issue', null],
        ['slack', 200],
        ['issue', 401],
      ]
    );
  }));

test('redeliver of an unknown id names the id and the file and calls nothing', () =>
  withLedger(async ({ path }) => {
    const { fetch, calls } = scripted();
    await assert.rejects(redeliver({ ledgerPath: path, id: 'esc-9', env: ENV, fetch, now: NOW }), (error) => {
      assert.ok(!(error instanceof EscalationError));
      assert.ok(error.message.includes('esc-9') && error.message.includes(path));
      return true;
    });
    assert.equal(calls.length, 0);
  }));

const leakyAnswers = () => [
  [
    answer(403, { message: 'token ' + TOKEN + ' rejected' }),
    answer(404, 'unknown ' + WEBHOOK + ' and ' + WEBHOOK_PATH),
  ],
  [
    new Error('connect failed via ' + WEBHOOK + ' with ' + TOKEN),
    new Error('POST ' + WEBHOOK_PATH + ' bearer ' + TOKEN),
  ],
  [answer(500, 'y'.repeat(190) + TOKEN + 'z'.repeat(50)), answer(500, WEBHOOK)],
];
const RAISE_ARGS = (path) => ['raise', '--ledger', path, '--kind', 'credential', '--title', TITLE, '--detail', DETAIL];
const SECRET_FRAGMENTS = [TOKEN, TOKEN.slice(0, 12), WEBHOOK, 'xoxSECRETpath', 'T0SECRET'];

test('secrets never reach the ledger, a receipt, an error message or the CLI output', () =>
  withLedger(async ({ path }) => {
    const seen = [];
    for (const index of [0, 1, 2]) {
      const error = await failure(raise(path, { fetch: scripted(...leakyAnswers()[index]).fetch }));
      seen.push(error.message, JSON.stringify(error.escalation));
      const lines = [];
      const io = { env: ENV, fetch: scripted(...leakyAnswers()[index]).fetch, now: NOW };
      await runCli(RAISE_ARGS(path), { ...io, stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) });
      seen.push(...lines);
    }
    seen.push(readFileSync(path, 'utf8'));
    const everything = seen.join('\n');
    for (const fragment of SECRET_FRAGMENTS) assert.ok(!everything.includes(fragment), fragment + ' leaked');
    assert.ok(everything.includes('[GITHUB_TOKEN]'));
    assert.ok(everything.includes('[SLACK_WEBHOOK_URL]'));
  }));

test('runCli prints one line per receipt and exits 0 when every required channel is delivered', () =>
  withLedger(async ({ path }) => {
    const out = [];
    const code = await runCli(
      ['raise', '--ledger', path, '--kind', 'credential', '--title', TITLE, '--detail', DETAIL],
      {
        env: ENV,
        fetch: scripted(created(), answer(200, 'ok')).fetch,
        now: NOW,
        stdout: (line) => out.push(line),
        stderr: () => {},
      }
    );
    assert.equal(code, 0);
    assert.deepEqual(out, [
      'escalate: esc-1 issue delivered (HTTP 201, issue #12)',
      'escalate: esc-1 slack delivered (HTTP 200)',
    ]);
  }));

const cli = (args, env = { PATH: process.env.PATH }) =>
  spawnSync(process.execPath, ['scripts/escalate.mjs', ...args], { cwd: SITE, env, encoding: 'utf8' });

test('CLI usage errors exit 2 and print the usage to stderr', () => {
  const bad = [
    [],
    ['unknown'],
    ['raise', '--ledger', 'x.json', '--kind', 'credential', '--title', 't'],
    ['raise', '--ledger', 'x.json', '--kind', 'cosmic', '--title', 't', '--detail', 'd'],
    ['raise', '--ledger', 'x.json', '--kind', 'credential', '--title', 't', '--detail', 'd', '--verbose', 'yes'],
    ['raise', '--ledger'],
    ['redeliver', '--ledger', 'x.json'],
  ];
  for (const args of bad) {
    const result = cli(args);
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, '');
  }
});

test('CLI with no variables exits 1, names the missing variables and records failed receipts', () =>
  withLedger(async ({ path }) => {
    const raised = cli(['raise', '--ledger', path, '--kind', 'credential', '--title', TITLE, '--detail', DETAIL]);
    assert.equal(raised.status, 1);
    assert.match(raised.stdout, /escalate: esc-1 issue NOT delivered: GITHUB_TOKEN is not set/);
    assert.match(raised.stdout, /escalate: esc-1 slack NOT delivered: SLACK_WEBHOOK_URL is not set/);
    assert.deepEqual(
      stored(path)[0].receipts.map(({ channel, delivered }) => [channel, delivered]),
      [
        ['issue', false],
        ['slack', false],
      ]
    );
    const retried = cli(['redeliver', '--ledger', path, '--id', 'esc-1']);
    assert.equal(retried.status, 1);
    assert.match(retried.stdout, /SLACK_WEBHOOK_URL is not set/);
    assert.equal(stored(path)[0].receipts.length, 4);
    const absent = cli(['redeliver', '--ledger', path, '--id', 'esc-7']);
    assert.equal(absent.status, 1);
    assert.match(absent.stderr, /esc-7/);
  }));
