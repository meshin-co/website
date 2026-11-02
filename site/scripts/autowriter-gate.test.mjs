import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { claimFile } from './autowriter-claims.mjs';
import { ledgerFile, newLedger } from './autowriter-ledger.mjs';
import { autowriterReport, summaryLine } from './autowriter-gate.mjs';
import {
  ENTRY_PATH,
  RECORD_PATH,
  asJson,
  entryText,
  bandSceneFiles,
  recordWith,
} from './fixtures/record-rules-scene.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const SUFFIX = ' — meshin.co';
const NOW = new Date('2026-11-02T07:00:00.000Z');
const T0 = '2026-11-02T07:00:00.000Z';
const HASH = 'b'.repeat(40);
const CORE = readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8');
const WORKFLOW = readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8');

const attempt = (number) => ({
  number,
  judgedCommit: HASH,
  recordedAt: T0,
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/x.md',
  tokens: { input: 10, output: 5 },
  costUsd: 0.5,
});
const receipt = (channel, extra = {}) => ({
  channel,
  attemptedAt: T0,
  delivered: true,
  status: channel === 'issue' ? 201 : 200,
  issue: channel === 'issue' ? 7 : null,
  error: null,
  ...extra,
});
const escalation = (receipts, kind = 'no-convergence') => ({
  id: 'esc-1',
  kind,
  title: 'The loop will not converge',
  detail: 'Same rule three times.',
  raisedAt: T0,
  receipts,
});
const ledger = (extra = {}) => ({ ...newLedger({ slug: 'what-is-aims', runId: '9', pullRequest: 5 }), ...extra });
const withAttempts = (count, extra = {}) =>
  ledger({
    attempts: Array.from({ length: count }, (_, index) => attempt(index + 1)),
    spend: { tokens: { input: 10 * count, output: 5 * count }, costUsd: 0.5 * count },
    ...extra,
  });
const escalated = (...escalations) =>
  withAttempts(3, {
    verdict: { state: 'escalated', reason: 'same rule three times', decidedAt: T0 },
    escalations,
  });

const claim = (extra = {}) => ({
  schema: 1,
  slug: 'what-is-a-model-card',
  title: 'What is a model card?',
  format: 'term',
  query: 'model card',
  demand: { impressions: 14, position: 11.2 },
  prompt: { number: 7, text: 'How do I document a model?' },
  runId: '9001',
  status: 'claimed',
  claimedAt: '2026-11-01T07:00:00.000Z',
  expiresAt: '2026-11-15T07:00:00.000Z',
  ...extra,
});

const ledgerAt = (name, value) => ({ path: ledgerFile(name), text: JSON.stringify(value) });
const claimAt = (name, value) => ({ path: claimFile(name), text: JSON.stringify(value) });
const report = (extra = {}) =>
  autowriterReport({ ledgers: [], claims: [], core: CORE, workflow: WORKFLOW, suffix: SUFFIX, now: NOW, ...extra });
const findings = (extra) => report(extra).findings;
const one = (extra) => {
  const found = findings(extra);
  assert.equal(found.length, 1, JSON.stringify(found));
  return found[0];
};

test('the repository as committed has nothing for the gate to find, and the report says what it read', () => {
  const { findings: found, counts } = report();
  assert.deepEqual(found, []);
  assert.equal(counts.ledgers, 0);
  assert.equal(counts.claims, 0);
  assert.ok(counts.titles > 50, 'the generated layer gave ' + counts.titles + ' titles');
  assert.equal(counts.jobs, 6);
});

test('a well-formed open ledger, a settled one and a delivered escalation pass', () => {
  const settled = escalated(escalation([receipt('issue'), receipt('slack')]));
  assert.deepEqual(findings({ ledgers: [ledgerAt('what-is-aims', ledger()), ledgerAt('what-is-aims', settled)] }), []);
  assert.equal(report({ ledgers: [ledgerAt('what-is-aims', settled)] }).counts.ledgers, 1);
});

test('a ledger that is not JSON is named, with the parser message', () => {
  const found = one({ ledgers: [{ path: ledgerFile('what-is-aims'), text: '{ not json' }] });
  assert.equal(found.rule, 'ledger-unreadable');
  assert.equal(found.path, 'audits/autowriter/what-is-aims.json');
  assert.match(found.detail, /^not readable JSON: /);
});

test('a ledger off its schema names the file and the field, one finding per problem', () => {
  const bad = { ...ledger(), note: 'x', attempts: [{ ...attempt(1), judgedCommit: 'abc1234' }] };
  const found = findings({ ledgers: [ledgerAt('what-is-aims', bad)] });
  assert.deepEqual(
    found.map(({ rule, path, detail }) => [rule, path, detail]),
    [
      [
        'ledger-schema',
        'audits/autowriter/what-is-aims.json',
        'attempts[0].judgedCommit must match pattern ^[0-9a-f]{40}$',
      ],
      ['ledger-schema', 'audits/autowriter/what-is-aims.json', 'note has an unexpected key'],
    ]
  );
});

test('a ledger filed under another slug is named, so one run cannot overwrite another', () => {
  const found = one({ ledgers: [ledgerAt('other', ledger())] });
  assert.deepEqual(found, {
    rule: 'ledger-name',
    path: 'audits/autowriter/other.json',
    detail: 'slug what-is-aims does not match the file name other.json',
  });
});

test('an attempt count above the cap is named with the count and the cap', () => {
  const found = one({ ledgers: [ledgerAt('what-is-aims', withAttempts(4))] });
  assert.deepEqual(found, {
    rule: 'attempt-cap',
    path: 'audits/autowriter/what-is-aims.json',
    detail: '4 attempts recorded, the cap is 3',
  });
  assert.deepEqual(findings({ ledgers: [ledgerAt('what-is-aims', withAttempts(3))] }), []);
});

test('an escalation with no receipt at all is named, once for each channel its kind requires', () => {
  const found = findings({ ledgers: [ledgerAt('what-is-aims', escalated(escalation([])))] });
  assert.deepEqual(
    found.map(({ rule, detail }) => [rule, detail]),
    [
      ['escalation-undelivered', 'escalations[0] esc-1 (no-convergence) has no delivery receipt for issue'],
      ['escalation-undelivered', 'escalations[0] esc-1 (no-convergence) has no delivery receipt for slack'],
    ]
  );
});

test('an escalation whose only receipt says delivery failed is named with the reason the receipt gives', () => {
  const failed = receipt('slack', {
    delivered: false,
    status: null,
    error: 'SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
  });
  const found = one({ ledgers: [ledgerAt('what-is-aims', escalated(escalation([receipt('issue'), failed])))] });
  assert.deepEqual(found, {
    rule: 'escalation-undelivered',
    path: 'audits/autowriter/what-is-aims.json',
    detail:
      'escalations[0] esc-1 (no-convergence) was not delivered to slack: SLACK_WEBHOOK_URL is not set; create the repository secret of that name',
  });
});

test('a morning-digest escalation needs only its issue delivered', () => {
  const stop = escalated(escalation([receipt('issue')], 'hard-stop'));
  assert.deepEqual(findings({ ledgers: [ledgerAt('what-is-aims', stop)] }), []);
});

test('a ledger off its schema is not also judged on its cap or delivery, so one mistake is one finding', () => {
  const bad = { ...escalated(escalation([])), runId: '' };
  const found = findings({ ledgers: [ledgerAt('what-is-aims', bad)] });
  assert.deepEqual(
    found.map(({ rule }) => rule),
    ['ledger-schema']
  );
});

test('a claim that is not JSON, off its schema or filed under another slug is named', () => {
  assert.equal(one({ claims: [{ path: claimFile('x'), text: '[' }] }).rule, 'claim-unreadable');
  const schema = one({ claims: [claimAt('what-is-a-model-card', claim({ format: 'video' }))] });
  assert.deepEqual(schema, {
    rule: 'claim-schema',
    path: 'audits/autowriter/claims/what-is-a-model-card.json',
    detail: 'format must be one of "term", "article"',
  });
  assert.deepEqual(one({ claims: [claimAt('other', claim())] }), {
    rule: 'claim-name',
    path: 'audits/autowriter/claims/other.json',
    detail: 'slug what-is-a-model-card does not match the file name other.json',
  });
});

test('a claim whose title is already a title in the generated layer is named with the route that owns it', () => {
  const taken = claim({ slug: 'what-is-an-ai-management-system', title: 'What is an AI management system?' });
  const found = one({ claims: [claimAt('what-is-an-ai-management-system', taken)] });
  assert.equal(found.rule, 'title-collision');
  assert.equal(found.path, 'audits/autowriter/claims/what-is-an-ai-management-system.json');
  assert.match(
    found.detail,
    /^title "What is an AI management system\?" is already the title of \/glossary\/ai-management-system in the generated layer of docs\/SEMANTIC-CORE\.md \("What is an AI management system\? — meshin\.co"\)$/
  );
});

test('a claim that repeats the punctuation and case of an existing title still collides', () => {
  const shouty = claim({ slug: 'shouty', title: 'WHAT IS AN AI MANAGEMENT SYSTEM' });
  assert.equal(one({ claims: [claimAt('shouty', shouty)] }).rule, 'title-collision');
});

test('two open claims on one title are both named', () => {
  const found = findings({
    claims: [
      claimAt('what-is-a-card', claim({ slug: 'what-is-a-card', title: 'What is a card?' })),
      claimAt('card-explained', claim({ slug: 'card-explained', title: 'what is a card' })),
    ],
  });
  assert.deepEqual(
    found.map(({ rule }) => rule),
    ['title-collision', 'title-collision']
  );
});

test('a lapsed claim and a written claim never collide, and the report counts the lapsed one', () => {
  const lapsed = claim({
    slug: 'what-is-an-ai-management-system',
    title: 'What is an AI management system?',
    expiresAt: '2026-10-20T07:00:00.000Z',
    claimedAt: '2026-10-01T07:00:00.000Z',
  });
  const written = claim({ slug: 'what-is-an-eu-ai-act', title: 'What is the EU AI Act?', status: 'written' });
  const { findings: found, counts } = report({
    claims: [claimAt('what-is-an-ai-management-system', lapsed), claimAt('what-is-an-eu-ai-act', written)],
  });
  assert.deepEqual(found, []);
  assert.equal(counts.claims, 2);
  assert.equal(counts.lapsed, 1);
});

test('a claim that failed its own schema is not compared on title, so one mistake is one finding', () => {
  const broken = claim({
    slug: 'what-is-an-ai-management-system',
    title: 'What is an AI management system?',
    format: 'video',
  });
  assert.deepEqual(
    findings({ claims: [claimAt('what-is-an-ai-management-system', broken)] }).map(({ rule }) => rule),
    ['claim-schema']
  );
});

test('a missing core, a core without its markers and a core with no titles are each named, never read as empty', () => {
  assert.deepEqual(one({ core: null }), {
    rule: 'core-unreadable',
    path: 'docs/SEMANTIC-CORE.md',
    detail: 'docs/SEMANTIC-CORE.md is missing',
  });
  const unmarked = one({ core: '# Semantic core' });
  assert.equal(unmarked.rule, 'core-unreadable');
  assert.match(unmarked.detail, /no generated layer between its two markers/);
  const empty = one({ core: '<!-- semantic-core:begin generated -->\n<!-- semantic-core:end generated -->' });
  assert.deepEqual(empty, {
    rule: 'core-no-titles',
    path: 'docs/SEMANTIC-CORE.md',
    detail: 'its generated layer lists no titles, so no claim can be checked against it',
  });
});

test('the workflow findings carry the workflow path, and an unparsable or missing workflow is named', () => {
  const lost = WORKFLOW.replace(
    'needs: [changes, build, types-and-units, cheap-gates, visual-and-axe, deploy-preview]',
    'needs: [changes, build, types-and-units, cheap-gates, deploy-preview]'
  );
  assert.notEqual(lost, WORKFLOW);
  const found = findings({ workflow: lost });
  assert.deepEqual([...new Set(found.map(({ path }) => path))], ['.github/workflows/ci.yml']);
  assert.ok(
    found.some(({ rule }) => rule === 'aggregate-uncovered'),
    JSON.stringify(found)
  );
  assert.equal(one({ workflow: 'jobs: [' }).rule, 'workflow-unreadable');
  assert.deepEqual(one({ workflow: null }), {
    rule: 'workflow-unreadable',
    path: '.github/workflows/ci.yml',
    detail: '.github/workflows/ci.yml is missing, so no job carries the verdict of the required jobs',
  });
});

test('the summary line says how many files were read, so a gate that read nothing cannot read as a pass', () => {
  const line = summaryLine({
    findings: [],
    counts: { ledgers: 2, claims: 3, lapsed: 1, titles: 117, jobs: 7, commits: 12, records: 4 },
  });
  assert.equal(
    line,
    'autowriter: 2 ledgers, 3 claims (1 lapsed), 117 generated titles, 7 CI jobs under the aggregate check, 12 pipeline commits judged, 4 generation records, 0 findings'
  );
  assert.match(
    summaryLine({
      findings: [{}, {}],
      counts: { ledgers: 0, claims: 0, lapsed: 0, titles: 0, jobs: 0, records: 0 },
    }),
    /, 2 findings$/
  );
});

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-'));
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': 'site:\n  name: meshin.co\n',
      'docs/SEMANTIC-CORE.md': CORE,
      '.github/workflows/ci.yml': WORKFLOW,
      ...bandSceneFiles(),
      ...plant,
    })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const gate = (root) =>
  spawnSync(process.execPath, ['scripts/autowriter-gate.mjs', root], { cwd: SITE, encoding: 'utf8' });

test('the command exits 0 and prints the summary on a repository with nothing planted', () =>
  inTempRepo({}, (root) => {
    const run = gate(root);
    assert.equal(run.status, 0, run.stderr);
    assert.match(
      run.stdout,
      /^autowriter: 0 ledgers, 0 claims \(0 lapsed\), \d+ generated titles, 6 CI jobs under the aggregate check, pipeline commits not judged, 0 generation records, 0 findings$/m
    );
    assert.equal(run.stderr, '');
  }));

test('the command exits 1 and names the file and the rule for each defect planted in a repository', () =>
  inTempRepo(
    {
      [ledgerFile('what-is-aims')]: JSON.stringify(withAttempts(4)),
      [ledgerFile('second-run')]: JSON.stringify(escalated(escalation([receipt('issue')]))),
      [claimFile('what-is-an-ai-management-system')]: JSON.stringify(
        claim({
          slug: 'what-is-an-ai-management-system',
          title: 'What is an AI management system?',
          expiresAt: '2099-01-01T00:00:00.000Z',
        })
      ),
    },
    (root) => {
      const run = gate(root);
      assert.equal(run.status, 1);
      const lines = run.stderr.trim().split('\n');
      assert.ok(
        lines.includes('AUTOWRITER attempt-cap audits/autowriter/what-is-aims.json: 4 attempts recorded, the cap is 3'),
        run.stderr
      );
      assert.ok(
        lines.some((line) =>
          line.startsWith(
            'AUTOWRITER ledger-name audits/autowriter/second-run.json: slug what-is-aims does not match the file name second-run.json'
          )
        ),
        run.stderr
      );
      assert.ok(
        lines.includes(
          'AUTOWRITER escalation-undelivered audits/autowriter/second-run.json: escalations[0] esc-1 (no-convergence) has no delivery receipt for slack'
        ),
        run.stderr
      );
      assert.ok(
        lines.some((line) =>
          line.startsWith(
            'AUTOWRITER title-collision audits/autowriter/claims/what-is-an-ai-management-system.json: title "What is an AI management system?" is already the title of /glossary/ai-management-system'
          )
        ),
        run.stderr
      );
      assert.match(
        run.stdout,
        /2 ledgers, 1 claims \(0 lapsed\), \d+ generated titles, 6 CI jobs under the aggregate check, pipeline commits not judged, 0 generation records, 4 findings$/m
      );
    }
  ));

const BAND_PATH = 'audits/sentence-band.json';
const sceneBand = () => JSON.parse(bandSceneFiles()[BAND_PATH]);

test('a valid generation record and its entry pass, and the summary counts the record', () =>
  inTempRepo({ [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })), [ENTRY_PATH]: entryText() }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /, 1 generation records, 0 findings$/m);
  }));

test('the command names the file and the rule of a corrupted record and of a stale band record', () => {
  const band = sceneBand();
  band.bands.article.medianFloor += 1;
  const corrupted = { ...recordWith({ band: sceneBand() }), schema: 2 };
  inTempRepo(
    {
      [RECORD_PATH]: asJson(corrupted),
      [ENTRY_PATH]: entryText(),
      [BAND_PATH]: asJson(band),
    },
    (root) => {
      const run = gate(root);
      assert.equal(run.status, 1);
      const lines = run.stderr.trim().split('\n');
      assert.ok(lines.includes(`AUTOWRITER generation-schema ${RECORD_PATH}: schema must equal 1`), run.stderr);
      assert.ok(
        lines.some((line) => line.startsWith(`AUTOWRITER record-bands-stale ${BAND_PATH}: `)),
        run.stderr
      );
      assert.match(run.stdout, /, 1 generation records, 2 findings$/m);
    }
  );
});

test('the command run against the real repository finds nothing, which is what CI runs', () => {
  const run = gate(REPO);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /, 0 findings$/m);
});
