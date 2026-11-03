import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SECRET } from './pr-watch.mjs';
import { describeItem, parseArguments, runCli, summarise } from './run-pr-resume.mjs';
import {
  MAIN_SHA,
  NOW,
  capture,
  codeCommitAfter,
  ledgerRecord,
  openPull,
  realLedger,
  withLastEscalation,
} from './fixtures/resume-world.mjs';
import { READER, WRITER, named, refusal, sweepWorld } from './fixtures/resume-sweep-harness.mjs';

const ENVIRONMENT = {
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_TOKEN: READER,
  [SECRET]: WRITER,
  GITHUB_REF_NAME: 'main',
};

async function cli(argv, world = {}, env = ENVIRONMENT) {
  const out = [];
  const err = [];
  const { io, calls } = sweepWorld(world);
  const status = await runCli(argv, {
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    env,
    io,
    fetch: async () => {
      throw new Error('the command reached for the network');
    },
    now: () => NOW,
  });
  return { status, out, err, calls };
}

const botIssues = () => capture('open-issues').issues.filter((issue) => issue.pull_request === undefined);
const closed = () => {
  const { merged, unmerged } = capture('closed-pull-requests');
  return { [merged.number]: merged, [unmerged.number]: unmerged };
};

test('no argument is a sweep, and a pull request number is a forced resume of that one pull request', () => {
  assert.deepEqual(parseArguments([]), { pullRequest: null });
  assert.deepEqual(parseArguments(['--pr', '84']), { pullRequest: 84 });
});

for (const argv of [
  ['--pr'],
  ['--pr', '0'],
  ['--pr', 'abc'],
  ['--pr', '8 4'],
  ['--pr', '-3'],
  ['84'],
  ['--all'],
  ['--pr', '84', '--x', '1'],
]) {
  test(`the arguments ${JSON.stringify(argv)} are a usage error, which is exit status 2 and prints the usage`, async () => {
    const { status, err, calls } = await cli(argv);

    assert.equal(status, 2);
    assert.match(err.join('\n'), /Usage: node scripts\/run-pr-resume\.mjs \[--pr <number>\]/);
    assert.equal(calls.length, 0);
  });
}

const MISSING = [
  ['GITHUB_REPOSITORY', /GITHUB_REPOSITORY is not set/],
  ['GITHUB_TOKEN', /GITHUB_TOKEN is not set/],
  [SECRET, new RegExp(`${SECRET} is not set; create a fine-grained personal access token`)],
  ['GITHUB_REF_NAME', /GITHUB_REF_NAME is not set/],
];

for (const [name, message] of MISSING) {
  test(`with ${name} missing the command says so and exits 1 before it asks GitHub anything`, async () => {
    const { [name]: omitted, ...rest } = ENVIRONMENT;
    const { status, err, calls } = await cli([], {}, rest);

    assert.ok(omitted);
    assert.equal(status, 1);
    assert.match(err.join('\n'), message);
    assert.equal(calls.length, 0);
  });
}

test('a blank variable counts as missing, as it does for the watcher', async () => {
  const { status, err } = await cli([], {}, { ...ENVIRONMENT, [SECRET]: '   ' });

  assert.equal(status, 1);
  assert.match(err.join('\n'), new RegExp(`${SECRET} is not set`));
});

test('with nothing to do the command prints only the summary and exits 0', async () => {
  const { status, out, err } = await cli([], { pulls: [], ledgers: [] });

  assert.deepEqual(out, ['pr-resume: 0 resumed, 0 left, 0 issues closed, 0 failed']);
  assert.deepEqual(err, []);
  assert.equal(status, 0);
});

test('the open pull request and issues of 2026-11-03 print one line each, the pull request first, and exit 0', async () => {
  const { status, out } = await cli([], { issues: botIssues(), closed: closed(), main: [] });

  assert.deepEqual(out, [
    '#84 left: no-main-change-since-decision',
    '#82 issue closed (pull request merged)',
    '#79 issue closed (pull request closed)',
    'pr-resume: 0 resumed, 1 left, 2 issues closed, 0 failed',
  ]);
  assert.equal(status, 0);
});

test('a resumed pull request prints how and on which main commit, and the tokens are the ones the variables name', async () => {
  const { status, out, calls } = await cli([], { main: [codeCommitAfter()] });

  assert.deepEqual(out, [
    '#84 resumed (main-change, main e8874d4)',
    'pr-resume: 1 resumed, 0 left, 0 issues closed, 0 failed',
  ]);
  assert.equal(status, 0);
  assert.equal(named(calls, 'putLedger')[0][1], WRITER);
  assert.equal(named(calls, 'readLedgerAt')[0][1], READER);
  assert.equal(named(calls, 'dispatchSuccessor')[0][2].ref, 'main');
});

test('a forced pull request prints as resumed by the owner, with no main commit, and exits 0', async () => {
  const world = { ledgers: [ledgerRecord(withLastEscalation(realLedger(), { kind: 'credential' }))], main: [] };
  const { status, out } = await cli(['--pr', '84'], world);

  assert.deepEqual(out, ['#84 resumed (owner)', 'pr-resume: 1 resumed, 0 left, 0 issues closed, 0 failed']);
  assert.equal(status, 0);
});

test('a forced pull request that stays escalated makes the run fail, so a green run always means it re-entered the loop', async () => {
  const capped = ledgerRecord({
    ...realLedger(),
    resumes: [
      { at: '2026-11-01T10:00:00.000Z', by: 'main-change', mainSha: MAIN_SHA, failedJobs: [] },
      { at: '2026-11-02T10:00:00.000Z', by: 'main-change', mainSha: MAIN_SHA, failedJobs: [] },
    ],
  });
  const { status, out, err } = await cli(['--pr', '84'], { ledgers: [capped] });

  assert.deepEqual(out, ['#84 left: cap-reached', 'pr-resume: 0 resumed, 1 left, 0 issues closed, 0 failed']);
  assert.match(err.join('\n'), /pr-resume: pull request #84 was not resumed: cap-reached/);
  assert.equal(status, 1);
});

test('a forced pull request that is not an open autowriter pull request is an error with its reason, exit 1', async () => {
  const { status, out, err } = await cli(['--pr', '84'], { pulls: [openPull({ state: 'closed' })] });

  assert.deepEqual(out, []);
  assert.match(err.join('\n'), /pr-resume: pull request #84 is not an open autowriter pull request of this repository/);
  assert.equal(status, 1);
});

test('a pull request that GitHub does not know, forced, is the GitHub error and exit 1', async () => {
  const { status, err } = await cli(['--pr', '9999'], {});

  assert.match(err.join('\n'), /pr-resume: GitHub GET pulls\/9999 answered 404: Not Found/);
  assert.equal(status, 1);
});

test('a resume whose dispatch failed prints the problem on its own line and exits 1, though the pull request was resumed', async () => {
  const denied = refusal(
    'POST',
    'actions/workflows/watch-pr.yml/dispatches',
    403,
    'Resource not accessible by personal access token'
  );
  const { status, out } = await cli([], { main: [codeCommitAfter()], failWith: { dispatchSuccessor: denied } });

  assert.match(
    out[0],
    /^#84 resumed \(main-change, main e8874d4\), but the watcher was not dispatched: GitHub POST .* answered 403/
  );
  assert.match(out[0], /start it with: gh workflow run watch-pr\.yml -f pr=84$/);
  assert.equal(out.at(-1), 'pr-resume: 1 resumed, 0 left, 0 issues closed, 1 failed');
  assert.equal(status, 1);
});

test('a failure on one pull request prints a failed line and exits 1, and the summary still counts the others', async () => {
  const conflict = refusal('PUT', 'contents/x.json', 409, 'the file changed');
  const { status, out } = await cli([], {
    main: [codeCommitAfter()],
    failWith: { putLedger: conflict },
    issues: botIssues(),
    closed: closed(),
  });

  assert.match(out[0], /^#84 failed: GitHub PUT contents\/x\.json answered 409: the file changed$/);
  assert.equal(out.at(-1), 'pr-resume: 0 resumed, 0 left, 2 issues closed, 1 failed');
  assert.equal(status, 1);
});

test('a section that cannot be read prints a failed line named for it, and exits 1', async () => {
  const down = refusal('GET', 'pulls?state=open&per_page=100', 500, 'Server Error');
  const { status, out } = await cli([], { failWith: { listOpenPullRequests: down } });

  assert.match(
    out[0],
    /^the open pull requests failed: GitHub GET pulls\?state=open&per_page=100 answered 500: Server Error$/
  );
  assert.equal(status, 1);
});

test('every kind of item has one line, and an issue left because its pull request is gone says so', () => {
  const lines = [
    [
      { kind: 'resumed', pullRequest: 84, by: 'approval-held', mainSha: null, problems: [] },
      '#84 resumed (approval-held)',
    ],
    [{ kind: 'left', pullRequest: 85, reason: 'cap-reached' }, '#85 left: cap-reached'],
    [{ kind: 'issue-closed', issue: 79, pullRequest: 78, merged: false }, '#79 issue closed (pull request closed)'],
    [{ kind: 'issue-closed', issue: 82, pullRequest: 81, merged: true }, '#82 issue closed (pull request merged)'],
    [
      { kind: 'issue-left', issue: 300, pullRequest: 999, reason: 'pull-request-not-found' },
      '#300 issue left (pull request #999 was not found)',
    ],
    [{ kind: 'failed', subject: '#84', message: 'boom' }, '#84 failed: boom'],
  ];

  for (const [item, line] of lines) assert.equal(describeItem(item), line);
});

test('the summary counts a resume with a problem as resumed and as failed, and an issue left as nothing at all', () => {
  const items = [
    { kind: 'resumed', pullRequest: 84, by: 'owner', mainSha: null, problems: [] },
    { kind: 'resumed', pullRequest: 85, by: 'owner', mainSha: null, problems: ['x'] },
    { kind: 'left', pullRequest: 86, reason: 'cap-reached' },
    { kind: 'issue-closed', issue: 79, pullRequest: 78, merged: true },
    { kind: 'issue-left', issue: 300, pullRequest: 999, reason: 'pull-request-not-found' },
    { kind: 'failed', subject: '#87', message: 'boom' },
  ];

  assert.equal(summarise(items), 'pr-resume: 2 resumed, 1 left, 1 issues closed, 2 failed');
});
