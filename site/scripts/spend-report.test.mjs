import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { newLedger } from './autowriter-ledger.mjs';
import { entryRoute } from './entry-files.mjs';
import { blockKitProblems } from './fixtures/block-kit.mjs';
import {
  GENERATED_AT,
  filesOf,
  ledgerOf,
  mergedLedger,
  recordOf,
  writingCall,
} from './fixtures/spend-report-corpus.mjs';
import { siteOrigin } from './links-gate.mjs';
import { SITE_CONFIG } from './site-brand.mjs';
import { corpusFiles, runCli, spendReportFile } from './spend-report.mjs';
import { REPORT_PATH, monthLine, reportText } from './spend-report-text.mjs';

const WEBHOOK_PATH = '/services/T0SECRET/B0SECRET/xoxSECRETpath';
const WEBHOOK = `https://hooks.slack.test${WEBHOOK_PATH}`;
const TOKEN = 'ghp_SECRETtokenVALUE0123456789';
const SECRETS = /xoxSECRET|T0SECRET|hooks\.slack|ghp_SECRET/;
const NEWEST = '2026-11-02T07:00:00.000Z';
const TERM_AT = '2026-11-02T07:00:01.000Z';
const SHIPPED_STATUS = { month: '2026-11', spentMicro: 62_000, ceilingUsd: 25 };
const SHIPPED_MONTH_LINE = monthLine({ month: '2026-11', spentMicro: 62_000, ceilingMicro: 25_000_000 });

const DRAFT = writingCall({ input: 12000, output: 3000, tag: 'draft' });
const CORRECTION = writingCall({ role: 'correction', input: 13000, output: 2000, tag: 'correction' });
const TERM_DRAFT = writingCall({ input: 6000, output: 1200, tag: 'term' });

const post = recordOf({ slug: 'a-post', at: NEWEST, calls: [DRAFT, CORRECTION] });
const term = recordOf({ slug: 'a-term', format: 'term', at: TERM_AT, ledgerSlug: 'a-post', calls: [TERM_DRAFT] });
const ledger = ledgerOf({ slug: 'a-post', calls: [...post.calls, ...term.calls] });
const SHIPPED = filesOf({ ledgers: [ledger], records: [post, term] });

const entriesOf = (...slugs) => ({ ok: true, slug: slugs[0], entries: slugs.map((slug) => ({ slug })) });

async function withRepo(body) {
  const base = mkdtempSync(join(tmpdir(), 'spend-report-'));
  const root = join(base, 'repo');
  mkdirSync(root);
  const put = (files) => {
    for (const { path, text } of files) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  };
  const listing = () => readdirSync(root, { recursive: true }).sort();
  const result = (value) => {
    const path = join(base, 'write-result.json');
    writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
    return path;
  };
  const repo = { root, put, listing, result, read: (path) => readFileSync(join(root, path), 'utf8') };
  try {
    return await body(repo);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

const shipped = (repo) => repo.put([...SHIPPED.ledgers, ...SHIPPED.records]);

function harness({ revision = 'abc1234', env = { SLACK_WEBHOOK_URL: WEBHOOK }, answer } = {}) {
  const out = [];
  const err = [];
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    if (answer) return answer(url);
    return new Response('ok', { status: 200 });
  };
  return {
    out,
    err,
    requests,
    io: {
      env,
      fetch,
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
      revisionOf: () => revision,
      now: () => new Date(GENERATED_AT),
      statusOf: () => SHIPPED_STATUS,
    },
    printed: () => [...out, ...err].join('\n'),
  };
}

test('the corpus is the json files of the ledger and the record families at any depth, sorted, with repository paths', () =>
  withRepo((repo) => {
    repo.put([
      { path: 'audits/autowriter/b.json', text: '{}' },
      { path: 'audits/autowriter/a.json', text: '[]' },
      { path: 'audits/autowriter/notes.md', text: 'not json' },
      { path: 'audits/autowriter/2026/11/m.json', text: '{"m":1}' },
      { path: 'audits/autowriter/claims/c.json', text: '{}' },
      { path: 'audits/autowriter/claims/2026/11/d.json', text: '{}' },
      { path: 'audits/autowriter/generations/z.json', text: '1' },
      { path: 'audits/autowriter/generations/y.json', text: '2' },
      { path: 'audits/autowriter/generations/2026/11/w.json', text: '3' },
      { path: 'audits/autowriter/generations/2026/11/extra/v.json', text: '4' },
    ]);
    assert.deepEqual(corpusFiles(repo.root), {
      ledgers: [
        { path: 'audits/autowriter/2026/11/m.json', text: '{"m":1}' },
        { path: 'audits/autowriter/a.json', text: '[]' },
        { path: 'audits/autowriter/b.json', text: '{}' },
      ],
      records: [
        { path: 'audits/autowriter/generations/2026/11/extra/v.json', text: '4' },
        { path: 'audits/autowriter/generations/2026/11/w.json', text: '3' },
        { path: 'audits/autowriter/generations/y.json', text: '2' },
        { path: 'audits/autowriter/generations/z.json', text: '1' },
      ],
    });
  }));

test('with no folder at all the corpus is empty', () =>
  withRepo((repo) => assert.deepEqual(corpusFiles(repo.root), { ledgers: [], records: [] })));

test('with no record the report file says that no entry has been generated and holds no number outside the month', () =>
  withRepo((repo) => {
    const file = spendReportFile({ repoRoot: repo.root, revision: 'abc1234', at: GENERATED_AT });
    assert.equal(file.path, REPORT_PATH);
    assert.equal(file.text, reportText({ ledgers: [], records: [] }, 'abc1234', GENERATED_AT));
    assert.match(file.text, /No entry has been generated, so this file holds no entry row, no entry total and no rate/);
    const unstamped = file.text.replace(/^Generated-(from|at): .*\n/gm, '');
    assert.doesNotMatch(unstamped.replace(/## This month[\s\S]*?(?=## No entry yet)/, ''), /\d/);
  }));

test('an open claim ledger on disk and no record is no entry and no warning', () =>
  withRepo((repo) => {
    repo.put(filesOf({ ledgers: [newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null })] }).ledgers);
    const { text } = spendReportFile({ repoRoot: repo.root, revision: 'abc1234', at: GENERATED_AT });
    assert.match(text, /No entry has been generated/);
    assert.doesNotMatch(text, /^## Warnings$/m);
  }));

test('the files a run is about to commit replace the ones on disk, so the report counts the new entries', () =>
  withRepo((repo) => {
    repo.put(filesOf({ ledgers: [newLedger({ slug: 'a-post', runId: 'run-1', pullRequest: null })] }).ledgers);
    const { text } = spendReportFile({
      repoRoot: repo.root,
      written: [...SHIPPED.records, ...SHIPPED.ledgers],
      revision: 'abc1234',
      at: GENERATED_AT,
    });
    assert.equal(text, reportText(SHIPPED, 'abc1234', GENERATED_AT));
    assert.doesNotMatch(text, /^## Warnings$/m);
  }));

test('a written file outside the two folders is not part of the corpus', () =>
  withRepo((repo) => {
    const stray = [
      { path: 'audits/autowriter/claims/a-post.json', text: '{}' },
      { path: 'site/src/data/post/a-post.md', text: '# x' },
    ];
    const { text } = spendReportFile({ repoRoot: repo.root, written: stray, revision: 'abc1234', at: GENERATED_AT });
    assert.match(text, /No entry has been generated/);
  }));

test('the same corpus gives the same bytes at any revision, so the file moves only when a record does', () =>
  withRepo((repo) => {
    shipped(repo);
    const first = spendReportFile({ repoRoot: repo.root, revision: 'aaaaaaa', at: GENERATED_AT });
    repo.put([first]);
    const second = spendReportFile({ repoRoot: repo.root, revision: 'bbbbbbb', at: GENERATED_AT });
    assert.equal(second.text, first.text);
    assert.match(second.text, /^Generated-from: aaaaaaa$/m);
    const next = recordOf({ slug: 'newer-post', at: '2026-11-03T07:00:00.000Z', runId: 'run-2', calls: [DRAFT] });
    const moved = spendReportFile({
      repoRoot: repo.root,
      written: filesOf({ records: [next] }).records,
      revision: 'bbbbbbb',
      at: GENERATED_AT,
    });
    assert.notEqual(moved.text, first.text);
    assert.match(moved.text, /^Generated-from: bbbbbbb$/m);
  }));

test('a file that was edited by hand is rewritten from the records, with the new stamp', () =>
  withRepo((repo) => {
    shipped(repo);
    const first = spendReportFile({ repoRoot: repo.root, revision: 'aaaaaaa', at: GENERATED_AT });
    repo.put([{ path: REPORT_PATH, text: first.text.replace('| 0.062', '| 0.001') }]);
    const repaired = spendReportFile({ repoRoot: repo.root, revision: 'bbbbbbb', at: GENERATED_AT });
    assert.equal(repaired.text, first.text.replace('Generated-from: aaaaaaa', 'Generated-from: bbbbbbb'));
  }));

test('write puts the report where the pipeline and the gate look for it, and says what it holds', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const run = harness();
    assert.equal(await runCli(['--repo-root', repo.root], run.io), 0);
    assert.equal(repo.read(REPORT_PATH), reportText(corpusFiles(repo.root), 'abc1234', GENERATED_AT));
    assert.deepEqual(run.out, ['spend report: wrote audits/spend-report.md (2 entries, 0 warnings)']);
    assert.deepEqual(run.err, []);
    assert.deepEqual(run.requests, [], 'writing the report sent a message');
  }));

test('write twice from one corpus leaves the file untouched, even when the revision has moved', () =>
  withRepo(async (repo) => {
    shipped(repo);
    await runCli(['--repo-root', repo.root], harness({ revision: 'aaaaaaa' }).io);
    const before = repo.read(REPORT_PATH);
    const modified = statSync(join(repo.root, REPORT_PATH)).mtimeMs;
    const again = harness({ revision: 'bbbbbbb' });
    assert.equal(await runCli(['write', '--repo-root', repo.root], again.io), 0);
    assert.equal(repo.read(REPORT_PATH), before);
    assert.equal(statSync(join(repo.root, REPORT_PATH)).mtimeMs, modified);
    assert.deepEqual(again.out, ['spend report: audits/spend-report.md is already current (2 entries, 0 warnings)']);
  }));

test('write with nothing generated writes the file that says so and reports no entry', () =>
  withRepo(async (repo) => {
    const run = harness();
    assert.equal(await runCli(['--repo-root', repo.root], run.io), 0);
    assert.match(repo.read(REPORT_PATH), /No entry has been generated/);
    assert.deepEqual(run.out, ['spend report: wrote audits/spend-report.md (no entry generated yet)']);
  }));

test('write prints each warning on stderr and still writes the file', () =>
  withRepo(async (repo) => {
    repo.put(filesOf({ ledgers: [mergedLedger(ledgerOf({ slug: 'lost-post', calls: [DRAFT] }))] }).ledgers);
    const run = harness();
    assert.equal(await runCli(['--repo-root', repo.root], run.io), 0);
    assert.deepEqual(run.err, [
      'spend report: warning: lost-post: its ledger records a generation of 0.027 USD (verdict: merged) but no generation record names this ledger, so no entry is counted for it',
    ]);
    assert.match(run.out[0], /^spend report: wrote audits\/spend-report\.md \(no entry counted, 1 warning\)$/);
  }));

test('an unknown flag, a stray word and a flag without a value are usage errors that exit 2 and change nothing', () =>
  withRepo(async (repo) => {
    for (const argv of [['--bogus', 'x'], ['publish'], ['--repo-root'], ['notify'], ['write', '--result', 'x']]) {
      const run = harness();
      assert.equal(await runCli(argv, run.io), 2, argv.join(' '));
      assert.match(run.err.join('\n'), /^spend report: .+\nUsage: /s, argv.join(' '));
      assert.deepEqual(run.requests, []);
    }
    assert.deepEqual(repo.listing(), []);
  }));

const notify = (repo, result, options) => {
  const run = harness(options);
  return runCli(['notify', '--result', repo.result(result), '--repo-root', repo.root], run.io).then((code) => ({
    code,
    ...run,
  }));
};

const ORIGIN = siteOrigin(SITE_CONFIG);
const WORKFLOW_ENV = {
  GITHUB_SERVER_URL: 'https://github.test',
  GITHUB_REPOSITORY: 'o/r',
  GITHUB_RUN_ID: '777',
  PULL_REQUEST: '84',
  SLACK_WEBHOOK_URL: WEBHOOK,
};
const PULL_REQUEST_LINK = '<https://github.test/o/r/pull/84|#84>';
const RUN_LINK = '<https://github.test/o/r/actions/runs/777|run 777>';
const ENTRY_ADDRESSES = [
  `${ORIGIN}${entryRoute({ format: 'article', slug: 'a-post' })}`,
  `${ORIGIN}${entryRoute({ format: 'term', slug: 'a-term' })}`,
];
const ENTRY_LINKS = [`<${ENTRY_ADDRESSES[0]}|a-post>`, `<${ENTRY_ADDRESSES[1]}|a-term>`];
const HEADER = { type: 'header', text: { type: 'plain_text', text: '2026-11 spend against the monthly ceiling' } };
const WARNING = '::warning::spend report: slack NOT delivered:';

const linksOf = (text) => [...text.matchAll(/<(https?:\/\/[^|>]+)\|/g)].map(([, address]) => address);
const addressesIn = (text) => [...new Set(linksOf(text))];
const labelled = (text) => text.replaceAll(/<[^|>]+\|([^>]*)>/g, '$1');

test('notify posts one message of text and blocks that Slack accepts, and says it was delivered', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { code, requests, out, err } = await notify(repo, entriesOf('a-post', 'a-term'));
    assert.equal(code, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, WEBHOOK);
    assert.deepEqual(blockKitProblems(requests[0].body), []);
    assert.deepEqual(out, ['spend report: slack delivered (HTTP 200)']);
    assert.deepEqual(err, []);
  }));

test('the message of notify opens with the month against the ceiling: the header names the month and the text opens with its sentence', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { requests } = await notify(repo, entriesOf('a-post', 'a-term'));
    const { text, blocks } = requests[0].body;
    assert.deepEqual(blocks[0], HEADER);
    assert.equal(text.split('\n')[0], SHIPPED_MONTH_LINE);
  }));

test('notify reports the entries named in the write result and no others', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { requests } = await notify(repo, entriesOf('a-post'));
    const { text, blocks } = requests[0].body;
    const entries = text.split('\n\n').find((chunk) => chunk.startsWith('This entry'));
    assert.deepEqual(labelled(entries).split('\n'), [
      'This entry',
      'article a-post: 25,000 input tokens, 5,000 output tokens, 0.05 USD',
    ]);
    assert.match(text, /\nall: 2 entries, 31,000 input tokens, 6,200 output tokens, 0\.062 USD\n/);
    assert.doesNotMatch(JSON.stringify(blocks), /a-term/);
  }));

test('with the environment of the workflow the pull request and the workflow run are links, in the text and in the blocks', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { requests } = await notify(repo, entriesOf('a-post', 'a-term'), { env: WORKFLOW_ENV });
    const { text, blocks } = requests[0].body;
    for (const link of [PULL_REQUEST_LINK, RUN_LINK]) {
      assert.ok(text.includes(link), `the text lacks ${link}`);
      assert.ok(JSON.stringify(blocks).includes(link), `the blocks lack ${link}`);
    }
  }));

test('each entry is a link to its page on the site, at the origin of the site configuration and the route of its format', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { requests } = await notify(repo, entriesOf('a-post', 'a-term'), { env: WORKFLOW_ENV });
    const { text, blocks } = requests[0].body;
    for (const link of ENTRY_LINKS) {
      assert.ok(text.includes(link), `the text lacks ${link}`);
      assert.ok(JSON.stringify(blocks).includes(link), `the blocks lack ${link}`);
    }
  }));

test('with no server, repository, run or pull request named the only links are the entries, and no column is left for the others', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { requests } = await notify(repo, entriesOf('a-post', 'a-term'));
    const { text, blocks } = requests[0].body;
    assert.deepEqual(addressesIn(text), ENTRY_ADDRESSES);
    assert.deepEqual(addressesIn(JSON.stringify(blocks)), ENTRY_ADDRESSES);
    assert.doesNotMatch(text, /Pull request|Workflow run/);
    assert.deepEqual(
      blocks.filter((block) => block.fields !== undefined),
      []
    );
  }));

test('a pull request number that is not a positive integer gives no pull request link, and the run keeps its own', () =>
  withRepo(async (repo) => {
    shipped(repo);
    for (const number of [undefined, 'abc', '0', '-3', '1.5', '']) {
      const env = { ...WORKFLOW_ENV, PULL_REQUEST: number };
      const { requests } = await notify(repo, entriesOf('a-post'), { env });
      const { text, blocks } = requests[0].body;
      assert.ok(text.includes(RUN_LINK), String(number));
      assert.doesNotMatch(text, /Pull request|\/pull\//, String(number));
      assert.doesNotMatch(JSON.stringify(blocks), /Pull request|\/pull\//, String(number));
    }
  }));

test('notify posts nothing and exits 0 when the write produced no entry', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { code, requests, out } = await notify(repo, { ok: true, slug: null, entries: [] });
    assert.equal(code, 0);
    assert.deepEqual(requests, []);
    assert.deepEqual(out, ['spend report: the write produced no entry, so no message was posted']);
  }));

test('notify with no record at all posts nothing, not a row of zeros, and exits 1 naming the entry', () =>
  withRepo(async (repo) => {
    const { code, requests, err, out } = await notify(repo, entriesOf('a-post'));
    assert.equal(code, 1);
    assert.deepEqual(requests, []);
    assert.deepEqual(out, []);
    assert.deepEqual(err, ['spend report: no generation record holds a-post, so no message was posted']);
  }));

test('notify names every entry no record holds, and posts nothing even when another entry has its record', () =>
  withRepo(async (repo) => {
    const partial = filesOf({ ledgers: [ledger], records: [post] });
    repo.put([...partial.ledgers, ...partial.records]);
    const { code, requests, err } = await notify(repo, entriesOf('a-post', 'a-term', 'a-third'));
    assert.equal(code, 1);
    assert.deepEqual(requests, []);
    assert.deepEqual(err, ['spend report: no generation record holds a-term, a-third, so no message was posted']);
  }));

test('notify refuses a result that is not a successful write, and posts nothing', () =>
  withRepo(async (repo) => {
    shipped(repo);
    for (const result of ['{not json', { ok: false, error: 'boom' }, { ok: true }, 'null', '[]']) {
      const { code, requests, err } = await notify(repo, result);
      assert.equal(code, 2, JSON.stringify(result));
      assert.deepEqual(requests, []);
      assert.match(err.join('\n'), /is not the result of a successful write/);
    }
  }));

test('a refused message is a warning and not a failed run: exit 0, one line on stderr, nothing on stdout, no webhook in it', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const answer = () => new Response(`invalid_token for ${WEBHOOK}`, { status: 500 });
    const { code, out, err, printed } = await notify(repo, entriesOf('a-post'), { answer });
    assert.equal(code, 0);
    assert.deepEqual(out, []);
    assert.deepEqual(err, [`${WARNING} Slack answered HTTP 500: invalid_token for [SLACK_WEBHOOK_URL]`]);
    assert.doesNotMatch(printed(), SECRETS);
  }));

test('a request that fails is a warning and not a failed run, with its reason and without the webhook', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const answer = () => {
      throw new Error(`getaddrinfo ENOTFOUND while posting to ${WEBHOOK}`);
    };
    const { code, out, err, printed } = await notify(repo, entriesOf('a-post'), { answer });
    assert.equal(code, 0);
    assert.deepEqual(out, []);
    assert.deepEqual(err, [`${WARNING} request failed: getaddrinfo ENOTFOUND while posting to [SLACK_WEBHOOK_URL]`]);
    assert.doesNotMatch(printed(), SECRETS);
  }));

test('with no webhook set nothing is sent and the missing secret is named in a warning, as an escalation names it', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const { code, requests, out, err } = await notify(repo, entriesOf('a-post'), { env: {} });
    assert.equal(code, 0);
    assert.deepEqual(requests, []);
    assert.deepEqual(out, []);
    assert.deepEqual(err, [`${WARNING} SLACK_WEBHOOK_URL is not set; create the repository secret of that name`]);
  }));

test('a missed message does nothing else: one request, to Slack only, and no file is written or changed', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const before = repo.listing();
    const stamps = before.map((name) => statSync(join(repo.root, name)).mtimeMs);
    const { requests } = await notify(repo, entriesOf('a-post'), {
      answer: () => new Response('no_service', { status: 500 }),
    });
    assert.deepEqual(
      requests.map(({ url }) => url),
      [WEBHOOK]
    );
    assert.deepEqual(repo.listing(), before);
    assert.deepEqual(
      before.map((name) => statSync(join(repo.root, name)).mtimeMs),
      stamps
    );
  }));

test('the posted message and every printed line are free of the webhook and the token, whether Slack takes it, refuses it or cannot be reached', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const env = { ...WORKFLOW_ENV, GITHUB_TOKEN: TOKEN };
    const refusing = () => new Response(`${WEBHOOK} ${TOKEN}`, { status: 500 });
    const failing = () => {
      throw new Error(`socket closed while posting to ${WEBHOOK} with ${TOKEN}`);
    };
    for (const answer of [undefined, refusing, failing]) {
      const { requests, printed } = await notify(repo, entriesOf('a-post', 'a-term'), { env, answer });
      assert.equal(requests.length, 1);
      assert.ok(requests[0].body.blocks.length > 0);
      assert.doesNotMatch(JSON.stringify(requests[0].body), SECRETS);
      assert.doesNotMatch(printed(), SECRETS);
    }
  }));

const STAMPED_AT = '2026-11-03T09:00:00.000Z';
const LATER_AT = '2026-11-05T09:00:00.000Z';
const clockAt = (instant) => () => new Date(instant);
const CEILING_STATUS = { month: '2026-11', spentMicro: 3_500_000, ceilingUsd: 25 };

test('the written file says the instant of the clock on its fourth line, and the same records on a later day leave it alone', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const first = harness();
    assert.equal(await runCli(['--repo-root', repo.root], { ...first.io, now: clockAt(STAMPED_AT) }), 0);
    const written = repo.read(REPORT_PATH);
    assert.equal(written.split('\n')[3], `Generated-at: ${STAMPED_AT}`);
    const second = harness();
    assert.equal(await runCli(['--repo-root', repo.root], { ...second.io, now: clockAt(LATER_AT) }), 0);
    assert.match(second.out.join('\n'), /is already current/);
    assert.equal(repo.read(REPORT_PATH), written);
  }));

test('a record that changed gets the file re-stamped with the instant of the later run', () =>
  withRepo(async (repo) => {
    repo.put([...SHIPPED.ledgers, ...SHIPPED.records].filter(({ path }) => !path.includes('a-term')));
    await runCli(['--repo-root', repo.root], { ...harness().io, now: clockAt(STAMPED_AT) });
    shipped(repo);
    await runCli(['--repo-root', repo.root], { ...harness().io, now: clockAt(LATER_AT) });
    assert.equal(repo.read(REPORT_PATH).split('\n')[3], `Generated-at: ${LATER_AT}`);
  }));

test('a file that carries no Generated-at line is rewritten with one, never kept', () =>
  withRepo(async (repo) => {
    shipped(repo);
    repo.put([
      { path: REPORT_PATH, text: reportText(SHIPPED, 'abc1234', STAMPED_AT).replace(/^Generated-at: .*\n/m, '') },
    ]);
    await runCli(['--repo-root', repo.root], { ...harness().io, now: clockAt(LATER_AT) });
    assert.equal(repo.read(REPORT_PATH).split('\n')[3], `Generated-at: ${LATER_AT}`);
  }));

test('a file is never made without an instant, and one that needs no change is returned without one', () =>
  withRepo((repo) => {
    shipped(repo);
    assert.throws(() => spendReportFile({ repoRoot: repo.root, revision: 'abc1234' }), /not a UTC instant/);
    const made = spendReportFile({ repoRoot: repo.root, revision: 'abc1234', at: STAMPED_AT });
    repo.put([{ path: made.path, text: made.text }]);
    assert.equal(spendReportFile({ repoRoot: repo.root, revision: 'abc1234' }).text, made.text);
  }));

test('the files being written are counted, and the model comes back with the instant the file is stamped with', () =>
  withRepo((repo) => {
    const made = spendReportFile({
      repoRoot: repo.root,
      written: [...SHIPPED.ledgers, ...SHIPPED.records],
      revision: 'abc1234',
      at: STAMPED_AT,
    });
    assert.equal(made.model.rows.length, 2);
    assert.equal(made.model.thisMonth.at, STAMPED_AT);
    assert.equal(made.text.split('\n')[3], `Generated-at: ${STAMPED_AT}`);
  }));

test('the month of the message of notify is the ceiling status, asked for with the repository and the clock', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const run = harness();
    const asked = [];
    const statusOf = (options) => {
      asked.push(options);
      return CEILING_STATUS;
    };
    const code = await runCli(
      ['notify', '--repo-root', repo.root, '--result', repo.result(entriesOf('a-post', 'a-term'))],
      {
        ...run.io,
        now: clockAt(STAMPED_AT),
        statusOf,
      }
    );
    assert.equal(code, 0, run.printed());
    assert.deepEqual(asked, [{ repoRoot: repo.root, now: new Date(STAMPED_AT) }]);
    const { text } = run.requests[0].body;
    assert.equal(text.split('\n')[0], monthLine({ month: '2026-11', spentMicro: 3_500_000, ceilingMicro: 25_000_000 }));
  }));

test('when the ceiling status cannot be read nothing is posted, and the run fails with the reason', () =>
  withRepo(async (repo) => {
    shipped(repo);
    const run = harness();
    const statusOf = () => {
      throw new Error('git for-each-ref failed in the repository, so the spend cannot be read');
    };
    const code = await runCli(['notify', '--repo-root', repo.root, '--result', repo.result(entriesOf('a-post'))], {
      ...run.io,
      now: clockAt(STAMPED_AT),
      statusOf,
    });
    assert.equal(code, 1);
    assert.deepEqual(run.requests, []);
    assert.match(run.err.join('\n'), /spend report: git for-each-ref failed/);
  }));

test('blocks Slack refuses with a 4xx are followed by the plain text: exit 0, two requests, the second text alone, one warning on stderr', () =>
  withRepo(async (repo) => {
    shipped(repo);
    let sent = 0;
    const answer = () => (sent++ === 0 ? new Response('invalid_blocks', { status: 400 }) : new Response('ok'));
    const { code, requests, out, err, printed } = await notify(repo, entriesOf('a-post'), { answer });
    assert.equal(code, 0);
    assert.equal(requests.length, 2);
    assert.deepEqual(Object.keys(requests[1].body), ['text']);
    assert.ok(requests[1].body.text.startsWith(requests[0].body.text));
    assert.deepEqual(out, []);
    assert.deepEqual(err, [
      '::warning::spend report: slack delivered as plain text (HTTP 200): the formatted message was refused: Slack answered HTTP 400: invalid_blocks',
    ]);
    assert.doesNotMatch(printed(), SECRETS);
  }));
