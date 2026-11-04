import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

import { titleSuffix } from '../src/utils/brand.mjs';

import { GENERATED_BEGIN, GENERATED_END, generatedTitles } from './autowriter-claims.mjs';
import { newLedger } from './autowriter-ledger.mjs';
import { autowriterReport, summaryLine } from './autowriter-gate.mjs';
import {
  ENTRY_PATH,
  RECORD_PATH,
  asJson,
  entryText,
  bandSceneFiles,
  recordWith,
} from './fixtures/record-rules-scene.mjs';
import { recordPath } from './record-layout.mjs';
import { GENERATED_AT } from './fixtures/spend-report-corpus.mjs';
import { spendReportFile } from './spend-report.mjs';
import { REPORT_PATH, reportText } from './spend-report-text.mjs';
import { siteBrand } from './site-brand.mjs';

const SITE = resolve(import.meta.dirname, '..');
const REPO = resolve(SITE, '..');
const SUFFIX = titleSuffix(siteBrand());
const NOW = new Date('2026-11-02T07:00:00.000Z');
const T0 = '2026-11-02T07:00:00.000Z';
const CLAIMED = '2026-11-01T07:00:00.000Z';
const HASH = 'b'.repeat(40);
const CORE = readFileSync(join(REPO, 'docs/SEMANTIC-CORE.md'), 'utf8');
const WORKFLOW = readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8');
const CI_FILE = { path: '.github/workflows/ci.yml', text: WORKFLOW };
const ROUTE_ROWS = CORE.slice(CORE.indexOf(GENERATED_BEGIN), CORE.indexOf(GENERATED_END))
  .split('\n')
  .filter((line) => line.startsWith('| `')).length;
const HELD_SLUG = 'a-title-the-layer-holds';

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
  claimedAt: CLAIMED,
  expiresAt: '2026-11-15T07:00:00.000Z',
  ...extra,
});

const ledgerPath = (name) => recordPath('ledger', name, CLAIMED);
const claimPath = (name) => recordPath('claim', name, CLAIMED);
const ledgerAt = (name, value) => ({ path: ledgerPath(name), text: JSON.stringify(value) });
const claimAt = (name, value) => ({ path: recordPath('claim', name, value.claimedAt), text: JSON.stringify(value) });
const report = (extra = {}) =>
  autowriterReport({ ledgers: [], claims: [], core: CORE, workflows: [CI_FILE], suffix: SUFFIX, now: NOW, ...extra });
const findings = (extra) => report(extra).findings;
const one = (extra) => {
  const found = findings(extra);
  assert.equal(found.length, 1, JSON.stringify(found));
  return found[0];
};

function heldTitle() {
  const [row] = generatedTitles(CORE);
  assert.ok(row, 'the generated layer of docs/SEMANTIC-CORE.md holds no title for a claim to collide with');
  const bare = row.title.endsWith(SUFFIX) ? row.title.slice(0, -SUFFIX.length) : row.title;
  return { bare, layerTitle: row.title, route: row.route };
}

test('the repository as committed has nothing for the gate to find, and the report says what it read', () => {
  const { findings: found, counts } = report();
  assert.deepEqual(found, []);
  assert.equal(counts.ledgers, 0);
  assert.equal(counts.claims, 0);
  assert.equal(counts.titles, ROUTE_ROWS, 'the generated layer gave ' + counts.titles + ' titles');
  assert.ok(counts.titles > 0, 'the generated layer gave no titles');
  assert.equal(counts.jobs, 6);
});

test('a well-formed open ledger, a settled one and a delivered escalation pass', () => {
  const settled = escalated(escalation([receipt('issue'), receipt('slack')]));
  assert.deepEqual(findings({ ledgers: [ledgerAt('what-is-aims', ledger()), ledgerAt('what-is-aims', settled)] }), []);
  assert.equal(report({ ledgers: [ledgerAt('what-is-aims', settled)] }).counts.ledgers, 1);
});

test('a ledger that is not JSON is named, with the parser message', () => {
  const found = one({ ledgers: [{ path: ledgerPath('what-is-aims'), text: '{ not json' }] });
  assert.equal(found.rule, 'ledger-unreadable');
  assert.equal(found.path, ledgerPath('what-is-aims'));
  assert.match(found.detail, /^not readable JSON: /);
});

test('a ledger off its schema names the file and the field, one finding per problem', () => {
  const bad = { ...ledger(), note: 'x', attempts: [{ ...attempt(1), judgedCommit: 'abc1234' }] };
  const found = findings({ ledgers: [ledgerAt('what-is-aims', bad)] });
  assert.deepEqual(
    found.map(({ rule, path, detail }) => [rule, path, detail]),
    [
      ['ledger-schema', ledgerPath('what-is-aims'), 'attempts[0].judgedCommit must match pattern ^[0-9a-f]{40}$'],
      ['ledger-schema', ledgerPath('what-is-aims'), 'note has an unexpected key'],
    ]
  );
});

test('a ledger filed under another slug is named, so one run cannot overwrite another', () => {
  const found = one({ ledgers: [ledgerAt('other', ledger())] });
  assert.deepEqual(found, {
    rule: 'ledger-name',
    path: ledgerPath('other'),
    detail: 'slug what-is-aims does not match the file name other.json',
  });
});

test('an attempt count above the cap is named with the count and the cap', () => {
  const found = one({ ledgers: [ledgerAt('what-is-aims', withAttempts(4))] });
  assert.deepEqual(found, {
    rule: 'attempt-cap',
    path: ledgerPath('what-is-aims'),
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
    path: ledgerPath('what-is-aims'),
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
  assert.equal(one({ claims: [{ path: claimPath('x'), text: '[' }] }).rule, 'claim-unreadable');
  const schema = one({ claims: [claimAt('what-is-a-model-card', claim({ format: 'video' }))] });
  assert.deepEqual(schema, {
    rule: 'claim-schema',
    path: claimPath('what-is-a-model-card'),
    detail: 'format must be one of "term", "article"',
  });
  assert.deepEqual(one({ claims: [claimAt('other', claim())] }), {
    rule: 'claim-name',
    path: claimPath('other'),
    detail: 'slug what-is-a-model-card does not match the file name other.json',
  });
});

test('a category claim for a term is named under the claim-schema finding', () => {
  const promptless = Object.fromEntries(Object.entries(claim()).filter(([key]) => key !== 'prompt'));
  const termClaim = {
    ...promptless,
    origin: 'category',
    category: 'governance',
    demand: { impressions: 0, position: null },
  };
  assert.deepEqual(one({ claims: [claimAt('what-is-a-model-card', termClaim)] }), {
    rule: 'claim-schema',
    path: claimPath('what-is-a-model-card'),
    detail: 'format must be article when origin is category',
  });
});

test('a claim whose title is already a title in the generated layer is named with the route that owns it', () => {
  const held = heldTitle();
  const taken = claim({ slug: HELD_SLUG, title: held.bare });
  const found = one({ claims: [claimAt(HELD_SLUG, taken)] });
  assert.equal(found.rule, 'title-collision');
  assert.equal(found.path, claimPath(HELD_SLUG));
  assert.equal(
    found.detail,
    `title "${held.bare}" is already the title of ${held.route} in the generated layer of docs/SEMANTIC-CORE.md ("${held.layerTitle}")`
  );
});

test('a claim that repeats the punctuation and case of an existing title still collides', () => {
  const { bare } = heldTitle();
  const shouty = claim({ slug: 'shouty', title: bare.toUpperCase().replace(/[?!.]*$/u, '!') });
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
  const found = findings({ workflows: [{ ...CI_FILE, text: lost }] });
  assert.deepEqual([...new Set(found.map(({ path }) => path))], ['.github/workflows/ci.yml']);
  assert.ok(
    found.some(({ rule }) => rule === 'aggregate-uncovered'),
    JSON.stringify(found)
  );
  assert.equal(one({ workflows: [{ ...CI_FILE, text: 'jobs: [' }] }).rule, 'workflow-unreadable');
  assert.deepEqual(one({ workflows: [] }), {
    rule: 'workflow-unreadable',
    path: '.github/workflows/ci.yml',
    detail: '.github/workflows/ci.yml is missing, so no job carries the verdict of the required jobs',
  });
});

test('the summary line says how many files were read, so a gate that read nothing cannot read as a pass', () => {
  const line = summaryLine({
    findings: [],
    counts: { ledgers: 2, claims: 3, lapsed: 1, titles: 117, jobs: 7, commits: 12, records: 4, dispositions: 13 },
  });
  assert.equal(
    line,
    'autowriter: 2 ledgers, 3 claims (1 lapsed), 117 generated titles, 7 CI jobs under the aggregate check, 12 pipeline commits judged, 4 generation records, 13 dispositions, 0 findings'
  );
  assert.match(
    summaryLine({
      findings: [{}, {}],
      counts: { ledgers: 0, claims: 0, lapsed: 0, titles: 0, jobs: 0, records: 0, dispositions: 0 },
    }),
    /, 2 findings$/
  );
});

function inTempRepo(plant, check) {
  const root = mkdtempSync(join(tmpdir(), 'autowriter-gate-'));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  try {
    for (const [path, text] of Object.entries({
      'site/src/config.yaml': `site:\n  name: ${siteBrand().name}\n`,
      'docs/SEMANTIC-CORE.md': CORE,
      '.github/workflows/ci.yml': WORKFLOW,
      ...bandSceneFiles(),
      ...plant,
    })) {
      if (text !== null) put(path, text);
    }
    if (!Object.hasOwn(plant, REPORT_PATH)) {
      const { path, text } = spendReportFile({ repoRoot: root, revision: 'abc1234', at: GENERATED_AT });
      put(path, text);
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
      /^autowriter: 0 ledgers, 0 claims \(0 lapsed\), \d+ generated titles, 6 CI jobs under the aggregate check, pipeline commits not judged, 0 generation records, 0 dispositions, 0 findings$/m
    );
    assert.equal(run.stderr, '');
  }));

test('the command exits 1 and names the file and the rule for each defect planted in a repository', () => {
  const held = heldTitle();
  return inTempRepo(
    {
      [ledgerPath('what-is-aims')]: JSON.stringify(withAttempts(4)),
      [ledgerPath('second-run')]: JSON.stringify(escalated(escalation([receipt('issue')]))),
      [claimPath(HELD_SLUG)]: JSON.stringify(
        claim({ slug: HELD_SLUG, title: held.bare, expiresAt: '2099-01-01T00:00:00.000Z' })
      ),
    },
    (root) => {
      const run = gate(root);
      assert.equal(run.status, 1);
      const lines = run.stderr.trim().split('\n');
      assert.ok(
        lines.includes(`AUTOWRITER attempt-cap ${ledgerPath('what-is-aims')}: 4 attempts recorded, the cap is 3`),
        run.stderr
      );
      assert.ok(
        lines.some((line) =>
          line.startsWith(
            `AUTOWRITER ledger-name ${ledgerPath('second-run')}: slug what-is-aims does not match the file name second-run.json`
          )
        ),
        run.stderr
      );
      assert.ok(
        lines.includes(
          `AUTOWRITER escalation-undelivered ${ledgerPath('second-run')}: escalations[0] esc-1 (no-convergence) has no delivery receipt for slack`
        ),
        run.stderr
      );
      assert.ok(
        lines.some((line) =>
          line.startsWith(
            `AUTOWRITER title-collision ${claimPath(HELD_SLUG)}: title "${held.bare}" is already the title of ${held.route}`
          )
        ),
        run.stderr
      );
      assert.match(
        run.stdout,
        /2 ledgers, 1 claims \(0 lapsed\), \d+ generated titles, 6 CI jobs under the aggregate check, pipeline commits not judged, 0 generation records, 0 dispositions, 4 findings$/m
      );
    }
  );
});

const BAND_PATH = 'audits/sentence-band.json';
const sceneBand = () => JSON.parse(bandSceneFiles()[BAND_PATH]);

test('a valid generation record and its entry pass, and the summary counts the record', () =>
  inTempRepo({ [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })), [ENTRY_PATH]: entryText() }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /, 1 generation records, 0 dispositions, 0 findings$/m);
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
      assert.match(run.stdout, /, 1 generation records, 0 dispositions, 2 findings$/m);
    }
  );
});

test('the command run against the real repository finds nothing, which is what CI runs', () => {
  const run = gate(REPO);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /, 0 findings$/m);
});

test('the command refuses a spend report that disagrees with the records, and names the line', () =>
  inTempRepo(
    {
      [RECORD_PATH]: asJson(recordWith({ band: sceneBand() })),
      [ENTRY_PATH]: entryText(),
      [REPORT_PATH]: reportText({ ledgers: [], records: [] }, 'abc1234', GENERATED_AT),
    },
    (root) => {
      const run = gate(root);
      assert.equal(run.status, 1);
      const lines = run.stderr.trim().split('\n');
      assert.ok(
        lines.some((line) => line.startsWith(`AUTOWRITER spend-report-differs ${REPORT_PATH}: line `)),
        run.stderr
      );
      assert.match(run.stdout, /, 1 generation records, 0 dispositions, 1 findings$/m);
    }
  ));

test('the command refuses a missing spend report even when there is nothing to report on', () =>
  inTempRepo({ [REPORT_PATH]: null }, (root) => {
    const run = gate(root);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stderr.trim().split('\n'), [
      `AUTOWRITER spend-report-missing ${REPORT_PATH}: the file does not exist; run npm run audit:spend to write it`,
    ]);
  }));
