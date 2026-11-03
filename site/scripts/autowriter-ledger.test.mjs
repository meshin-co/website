import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  ATTEMPT_CAP,
  CHANNELS,
  DIGEST_KINDS,
  IMMEDIATE_KINDS,
  LEDGER_DIR,
  MONTHLY_SPEND_CEILING_USD,
  QUARANTINE_HOURS,
  attemptCapProblem,
  deliveryProblems,
  fileStemProblem,
  ledgerFile,
  newLedger,
  readLedger,
  requiredChannels,
  validateLedger,
  writeLedger,
} from './autowriter-ledger.mjs';
import { describeProblem } from './autowriter-records.mjs';

const HASH = 'a'.repeat(40);
const T0 = '2026-11-02T07:00:00.000Z';

const attempt = (number, extra = {}) => ({
  number,
  judgedCommit: HASH,
  recordedAt: T0,
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/x.md',
  tokens: { input: 100, output: 50 },
  costUsd: 0.25,
  ...extra,
});
const receipt = (channel, extra = {}) => ({
  channel,
  attemptedAt: T0,
  delivered: true,
  status: channel === 'issue' ? 201 : 200,
  issue: channel === 'issue' ? 12 : null,
  error: null,
  ...extra,
});
const failedReceipt = (channel, error, extra = {}) =>
  receipt(channel, { delivered: false, status: null, issue: null, error, ...extra });
const escalation = (extra = {}) => ({
  id: 'esc-1',
  kind: 'no-convergence',
  title: 'The loop will not converge',
  detail: 'Three attempts, one rule.',
  raisedAt: T0,
  receipts: [receipt('issue'), receipt('slack')],
  ...extra,
});
const open = () => newLedger({ slug: 'what-is-aims', runId: '1234', pullRequest: 42 });
const settled = (extra = {}) => ({
  ...open(),
  attempts: [attempt(1), attempt(2), attempt(3)],
  spend: { tokens: { input: 300, output: 150 }, costUsd: 0.75 },
  verdict: { state: 'escalated', reason: 'the same rule failed three times', decidedAt: T0 },
  escalations: [escalation()],
  ...extra,
});
const withEscalations = (...escalations) => settled({ escalations });
const withReceipts = (...receipts) => withEscalations(escalation({ receipts }));
const problemsText = (ledger) => validateLedger(ledger).map(describeProblem);
const deliveryText = (ledger) => deliveryProblems(ledger).map(describeProblem);

test('the bounds are the ones the owner set: twelve hours, three attempts, twenty-five dollars', () => {
  assert.equal(QUARANTINE_HOURS, 12);
  assert.equal(ATTEMPT_CAP, 3);
  assert.equal(MONTHLY_SPEND_CEILING_USD, 25);
  assert.equal(LEDGER_DIR, 'audits/autowriter');
  assert.equal(ledgerFile('what-is-aims'), 'audits/autowriter/what-is-aims.json');
});

test('Slack carries exactly three kinds at once, and every other kind waits for the morning digest', () => {
  assert.deepEqual(IMMEDIATE_KINDS, ['spend-ceiling', 'credential', 'no-convergence']);
  assert.deepEqual(DIGEST_KINDS, ['hard-stop', 'unrepairable']);
  for (const kind of IMMEDIATE_KINDS) assert.deepEqual(requiredChannels(kind), ['issue', 'slack']);
  for (const kind of DIGEST_KINDS) assert.deepEqual(requiredChannels(kind), ['issue']);
  assert.deepEqual(CHANNELS, ['issue', 'slack', 'digest']);
  assert.throws(() => requiredChannels('weather'), /unknown escalation kind weather/);
});

test('a new ledger is open, empty, spends nothing and matches its own schema', () => {
  const ledger = open();
  assert.deepEqual(validateLedger(ledger), []);
  assert.deepEqual(ledger.attempts, []);
  assert.deepEqual(ledger.spend, { tokens: { input: 0, output: 0 }, costUsd: 0 });
  assert.deepEqual(ledger.verdict, { state: 'open', reason: null, decidedAt: null });
  assert.equal(ledger.pullRequest, 42);
});

test('a settled ledger with three attempts, summed spend and a delivered escalation has no problems', () => {
  assert.deepEqual(validateLedger(settled()), []);
});

const withoutRunId = Object.fromEntries(Object.entries(settled()).filter(([key]) => key !== 'runId'));

const DEFECTS = [
  ['an unknown field', { ...settled(), note: 'hi' }, 'note has an unexpected key'],
  ['a missing field', withoutRunId, 'runId is required'],
  ['a wrong schema version', { ...settled(), schema: 2 }, 'schema must equal 1'],
  ['a blank run id', { ...settled(), runId: ' ' }, 'runId must match pattern \\S'],
  ['a pull request of zero', { ...settled(), pullRequest: 0 }, 'pullRequest must be >= 1'],
  [
    'a short commit hash',
    { ...settled(), attempts: [attempt(1, { judgedCommit: 'abc1234' })] },
    'attempts[0].judgedCommit must match pattern ^[0-9a-f]{40}$',
  ],
  [
    'an instant that is not on the calendar',
    { ...settled(), attempts: [attempt(1, { recordedAt: '2026-02-31T00:00:00.000Z' })] },
    'attempts[0].recordedAt must be a real calendar instant, got "2026-02-31T00:00:00.000Z"',
  ],
  ['attempts numbered out of order', { ...settled(), attempts: [attempt(2)] }, 'attempts[0].number must be 1, got 2'],
  ['negative cost', { ...settled(), attempts: [attempt(1, { costUsd: -1 })] }, 'attempts[0].costUsd must be >= 0'],
  [
    'spend that is not the sum of the attempts',
    settled({ spend: { tokens: { input: 300, output: 150 }, costUsd: 9 } }),
    'spend.costUsd is 9 but its attempts add up to 0.75',
  ],
  [
    'token spend that is not the sum',
    settled({ spend: { tokens: { input: 1, output: 150 }, costUsd: 0.75 } }),
    'spend.tokens.input is 1 but its attempts add up to 300',
  ],
  [
    'an open verdict with a decision time',
    { ...settled(), verdict: { state: 'open', reason: null, decidedAt: T0 } },
    'verdict.decidedAt must be null while the verdict is open',
  ],
  [
    'an open verdict with a reason',
    { ...settled(), verdict: { state: 'open', reason: 'waiting', decidedAt: null } },
    'verdict.reason must be null while the verdict is open',
  ],
  [
    'an escalated verdict with no reason',
    settled({ verdict: { state: 'escalated', reason: null, decidedAt: T0 } }),
    'verdict.reason must say why the run is escalated',
  ],
  [
    'a stopped verdict with no time',
    { ...settled(), verdict: { state: 'stopped', reason: 'owner held it', decidedAt: null } },
    'verdict.decidedAt must be an instant once the verdict is stopped',
  ],
  [
    'a merged verdict with no time',
    { ...settled(), verdict: { state: 'merged', reason: null, decidedAt: null } },
    'verdict.decidedAt must be an instant once the verdict is merged',
  ],
  [
    'an escalated verdict that escalated nothing',
    settled({ escalations: [] }),
    'verdict.state is escalated but escalations is empty, so nothing was ever delivered',
  ],
  [
    'an unknown escalation kind',
    withEscalations(escalation({ kind: 'weather' })),
    'escalations[0].kind must be one of "spend-ceiling", "credential", "no-convergence", "hard-stop", "unrepairable"',
  ],
  [
    'an escalation id that is not esc-<n>',
    withEscalations(escalation({ id: 'first' })),
    'escalations[0].id must match pattern ^esc-[1-9][0-9]*$',
  ],
  [
    'a repeated escalation id',
    withEscalations(escalation(), escalation()),
    'escalations[1].id esc-1 repeats an earlier escalation',
  ],
  [
    'a delivered receipt with a 500',
    withReceipts(receipt('issue', { status: 500 })),
    'escalations[0].receipts[0].status must be a 2xx status when delivered is true, got 500',
  ],
  [
    'a delivered receipt with no status',
    withReceipts(receipt('slack', { status: null })),
    'escalations[0].receipts[0].status must be a 2xx status when delivered is true, got null',
  ],
  [
    'a failed receipt that says nothing',
    withReceipts(receipt('slack', { delivered: false, status: 500 })),
    'escalations[0].receipts[0].error must say why delivery failed',
  ],
  [
    'a delivered issue receipt without an issue number',
    withReceipts(receipt('issue', { issue: null })),
    'escalations[0].receipts[0].issue must be the issue number once the issue channel is delivered',
  ],
  [
    'an issue number on the slack channel',
    withReceipts(receipt('slack', { issue: 3 })),
    'escalations[0].receipts[0].issue must be null on the slack channel',
  ],
  [
    'an unknown channel',
    withReceipts(receipt('email')),
    'escalations[0].receipts[0].channel must be one of "issue", "slack", "digest"',
  ],
];

for (const [name, ledger, expected] of DEFECTS) {
  test('a ledger with ' + name + ' is refused naming the field', () => {
    assert.ok(problemsText(ledger).includes(expected), problemsText(ledger).join(' | '));
  });
}

test('a ledger that is not an object, or is an array, is refused as a whole', () => {
  assert.deepEqual(problemsText('x'), ['the file must be of type object']);
  assert.deepEqual(problemsText([]), ['the file must be of type object']);
  assert.deepEqual(problemsText(null), ['the file must be of type object']);
});

test('the cross-field rules wait for a ledger of the right shape, so one mistake is not reported twice', () => {
  const broken = { ...settled(), spend: { tokens: { input: 1, output: 1 }, costUsd: 'free' } };
  assert.deepEqual(problemsText(broken), ['spend.costUsd must be of type number']);
});

test('an escalation is delivered only when every channel its kind requires has a delivered receipt', () => {
  assert.deepEqual(deliveryText(settled()), []);
  assert.deepEqual(deliveryText(open()), []);
  assert.deepEqual(deliveryText(withReceipts()), [
    'escalations[0] esc-1 (no-convergence) has no delivery receipt for issue',
    'escalations[0] esc-1 (no-convergence) has no delivery receipt for slack',
  ]);
  assert.deepEqual(deliveryText(withReceipts(receipt('issue'))), [
    'escalations[0] esc-1 (no-convergence) has no delivery receipt for slack',
  ]);
});

test('a failed receipt is not a delivery, and the reader is told why it failed', () => {
  const unset = 'SLACK_WEBHOOK_URL is not set; create the repository secret of that name';
  assert.deepEqual(deliveryText(withReceipts(receipt('issue'), failedReceipt('slack', unset))), [
    'escalations[0] esc-1 (no-convergence) was not delivered to slack: ' + unset,
  ]);
});

test('a later delivered receipt makes up for an earlier failed one, and the failure stays on record', () => {
  const ledger = withReceipts(
    failedReceipt('issue', 'GitHub answered HTTP 403: Resource not accessible by personal access token', {
      status: 403,
    }),
    receipt('slack'),
    receipt('issue', { attemptedAt: '2026-11-02T09:00:00.000Z' })
  );
  assert.deepEqual(deliveryText(ledger), []);
  assert.equal(ledger.escalations[0].receipts.length, 3);
});

test('a morning digest needs only the issue now, and a digest receipt never stands in for a required channel', () => {
  const stop = (...receipts) => withEscalations(escalation({ kind: 'hard-stop', receipts }));
  assert.deepEqual(deliveryText(stop(receipt('issue'))), []);
  assert.deepEqual(deliveryText(stop(receipt('slack'))), [
    'escalations[0] esc-1 (hard-stop) has no delivery receipt for issue',
  ]);
  assert.deepEqual(deliveryText(stop(receipt('digest', { status: 200 }))), [
    'escalations[0] esc-1 (hard-stop) has no delivery receipt for issue',
  ]);
});

test('every escalation is judged on its own, under its own index', () => {
  const ledger = withEscalations(
    escalation(),
    escalation({ id: 'esc-2', kind: 'credential', receipts: [receipt('issue')] })
  );
  assert.deepEqual(deliveryText(ledger), ['escalations[1] esc-2 (credential) has no delivery receipt for slack']);
});

test('the attempt cap is a separate finding, so four well-formed attempts are a valid shape over the cap', () => {
  const four = settled({
    attempts: [attempt(1), attempt(2), attempt(3), attempt(4)],
    spend: { tokens: { input: 400, output: 200 }, costUsd: 1 },
  });
  assert.deepEqual(validateLedger(four), []);
  assert.equal(attemptCapProblem(four), '4 attempts recorded, the cap is 3');
  assert.equal(attemptCapProblem(settled()), null);
});

test('the file name must be the slug, so a ledger cannot be filed under another run', () => {
  assert.equal(fileStemProblem('audits/autowriter/what-is-aims.json', open()), null);
  assert.equal(
    fileStemProblem('audits/autowriter/other.json', open()),
    'slug what-is-aims does not match the file name other.json'
  );
});

function inTemp(check) {
  const root = mkdtempSync(join(tmpdir(), 'ledger-'));
  try {
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a written ledger reads back equal, ends in a newline and leaves no temporary file behind', () => {
  inTemp((root) => {
    const path = join(root, LEDGER_DIR, 'what-is-aims.json');
    writeLedger(path, settled());
    assert.deepEqual(readLedger(path), settled());
    assert.equal(readFileSync(path, 'utf8').endsWith('}\n'), true);
    assert.deepEqual(readdirSync(join(root, LEDGER_DIR)), ['what-is-aims.json']);
  });
});

test('a ledger that breaks its schema, its cap or its file name is refused before a byte is written', () => {
  inTemp((root) => {
    const path = join(root, 'what-is-aims.json');
    assert.throws(
      () => writeLedger(path, { ...open(), note: 'x' }),
      /does not match the ledger schema.*note has an unexpected key/
    );
    const four = settled({
      attempts: [attempt(1), attempt(2), attempt(3), attempt(4)],
      spend: { tokens: { input: 400, output: 200 }, costUsd: 1 },
    });
    assert.throws(() => writeLedger(path, four), /4 attempts recorded, the cap is 3/);
    assert.throws(() => writeLedger(join(root, 'other.json'), open()), /does not match the file name other\.json/);
    assert.equal(existsSync(path), false);
    assert.equal(existsSync(join(root, 'other.json')), false);
  });
});

test('a ledger that is not JSON, or does not match, is refused by name when it is read', () => {
  inTemp((root) => {
    const path = join(root, 'what-is-aims.json');
    writeFileSync(path, '{ not json');
    assert.throws(() => readLedger(path), /what-is-aims\.json is not readable JSON/);
    writeFileSync(path, JSON.stringify({ ...open(), runId: '' }));
    assert.throws(
      () => readLedger(path),
      /what-is-aims\.json does not match the ledger schema: runId must match pattern \\S/
    );
  });
});
