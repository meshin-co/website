import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { blockKitProblems } from './fixtures/block-kit.mjs';
import { WEBHOOK, withScene } from './fixtures/spend-run.mjs';
import { createScene, ledgerOf } from './fixtures/spend-scene.mjs';
import { recordPath } from './record-layout.mjs';
import { runCli } from './spend-ended.mjs';
import { noticeFile, noticeSlug } from './spend-notice.mjs';

const NOW = new Date('2026-11-10T09:00:00.000Z');
const IN_NOVEMBER = '2026-11-03T08:00:00Z';
const RAISED = '2026-11-10T08:30:00Z';
const MONTH_LINE_OPEN = '2026-11 so far: 0.625 USD spent of the 25.00 USD monthly ceiling, 24.375 USD left.';
const MONTH_LINE_REACHED =
  '2026-11 so far: 25.00 USD spent of the 25.00 USD monthly ceiling, none left: the ceiling is reached, so the writer does not run for the rest of the month.';
const HEADER = '2026-11 spend against the monthly ceiling';
const SLUG = 'a-post';
const LEDGER_PATH = recordPath('ledger', SLUG, IN_NOVEMBER);
const WORKFLOW_ENV = {
  SLACK_WEBHOOK_URL: WEBHOOK,
  GITHUB_SERVER_URL: 'https://github.test',
  GITHUB_REPOSITORY: 'meshin-co/website',
  GITHUB_RUN_ID: '777',
};
const RUN_COLUMN = '*Workflow run*\n<https://github.test/meshin-co/website/actions/runs/777|run 777>';
const RUN_LINE = 'Workflow run: <https://github.test/meshin-co/website/actions/runs/777|run 777>';
const CEILING_TOLD =
  "No entry was written on 2026-11-10: the month's spend reached the ceiling, so the writer did not run. The run cost 0.00 USD.";
const STOPPED_TOLD =
  'No entry was written on 2026-11-10: the write stopped on a-post (output). The run cost 0.625 USD.';
const SECRETS = [WEBHOOK, new URL(WEBHOOK).pathname, 'T0SECRET', 'B0SECRET', 'xoxSECRETpath'];
const ISSUE_REFUSED = {
  channel: 'issue',
  delivered: false,
  status: 403,
  issue: null,
  error: 'GitHub answered HTTP 403: forbidden',
};
const SLACK_DELIVERED = { channel: 'slack', delivered: true, status: 200, issue: null, error: null };

const happened = (sentence) => `*No entry was written on 2026-11-10*\n${sentence}`;
const cost = (usd) => `*What the run cost*\n${usd} USD`;
const issueColumn = (number) =>
  `*Escalation issue*\n<https://github.test/meshin-co/website/issues/${number}|#${number}>`;
const issueLine = (number) => `Escalation issue: <https://github.test/meshin-co/website/issues/${number}|#${number}>`;
const issueOpened = (number) => ({ channel: 'issue', delivered: true, status: 201, issue: number, error: null });
const escalationOf = (id, kind, at, ...receipts) => ({
  id,
  kind,
  title: `Escalation ${id}`,
  detail: 'The run stopped.',
  raisedAt: at,
  receipts: receipts.map((receipt) => ({ ...receipt, attemptedAt: at })),
});

const withFiles = (body) =>
  withScene(async (scene) => {
    const files = mkdtempSync(join(tmpdir(), 'spend-ended-'));
    const put = (name, value) => {
      const path = join(files, name);
      writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
      return path;
    };
    try {
      await body(scene, put);
    } finally {
      rmSync(files, { recursive: true, force: true });
    }
  });

function runner(
  scene,
  { env = { SLACK_WEBHOOK_URL: WEBHOOK }, answer = () => new Response('ok', { status: 200 }) } = {}
) {
  const out = [];
  const err = [];
  const posted = [];
  const fetch = async (url, init) => {
    posted.push({ url, body: JSON.parse(init.body) });
    return answer();
  };
  const run = (argv) =>
    runCli([...argv, '--repo-root', scene.root], {
      env,
      fetch,
      now: () => NOW,
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });
  return { run, out, err, posted, printed: () => [...out, ...err].join('\n') };
}

const viewOf = ({ text, blocks = [] }) => ({
  header: blocks[0]?.text?.text,
  happened: blocks.find((block) => block.text?.text.startsWith('*No entry was written on '))?.text.text,
  columns: blocks.find((block) => block.fields)?.fields.map((field) => field.text),
  fallback: text.split(/\n+/),
});

const views = ({ posted }) => posted.map(({ body }) => viewOf(body));
const partsOf = (hook, part) => views(hook).map((view) => view[part]);
const told = (hook) =>
  partsOf(hook, 'fallback').map((lines) => lines.find((line) => line.startsWith('No entry was written on ')));

const leaks = (hook) => {
  const shown = [hook.printed(), ...hook.posted.map(({ body }) => JSON.stringify(body))].join('\n');
  return SECRETS.filter((secret) => shown.includes(secret));
};

const stoppedRun = () => ledgerOf({ slug: SLUG, generationUsd: 0.125, attempts: [{ at: IN_NOVEMBER, usd: 0.5 }] });

const putCostedLedger = (scene, escalations = []) => {
  scene.put(LEDGER_PATH, { ...stoppedRun(), escalations });
  scene.commit('the run ledger');
};

const putSpentMonth = (scene) => {
  scene.put(
    recordPath('ledger', 'big-post', IN_NOVEMBER),
    ledgerOf({ slug: 'big-post', attempts: [{ at: IN_NOVEMBER, usd: 25 }] })
  );
  scene.commit('spent');
};

const putNotice = (scene, month, escalations) => {
  scene.put(noticeFile(month), { ...ledgerOf({ slug: noticeSlug(month) }), escalations });
  scene.commit(`the notice of ${month}`);
};

const decisionOf = (extra = {}) => ({ schema: 1, decision: 'write', ledgerPath: LEDGER_PATH, ...extra });
const failedResult = { ok: false, kind: 'output', message: 'no draft passed', spend: { costUsd: 0.625 } };

test(
  'ceiling reached: posts the ceiling reason, a cost of 0.00 and the month against the ceiling, and reads no ledger of the run',
  withFiles(async (scene) => {
    putSpentMonth(scene);
    const hook = runner(scene);
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(views(hook), [
      {
        header: HEADER,
        happened: happened("The month's spend reached the ceiling, so the writer did not run."),
        columns: [cost('0.00')],
        fallback: [MONTH_LINE_REACHED, CEILING_TOLD],
      },
    ]);
  })
);

test(
  'nothing picked: carries the picker reason and costs 0.00, with no ledger to read',
  withFiles(async (scene, put) => {
    scene.put(LEDGER_PATH, stoppedRun());
    scene.commit('an earlier run');
    const decision = put('decision.json', {
      schema: 1,
      decision: 'none',
      reason: 'every candidate was set aside: no query had enough impressions.',
      advisories: [],
    });
    const hook = runner(scene);
    assert.equal(await hook.run(['pick', '--decision', decision]), 0);
    assert.deepEqual(views(hook), [
      {
        header: HEADER,
        happened: happened(
          'The picker chose nothing to write: every candidate was set aside: no query had enough impressions.'
        ),
        columns: [cost('0.00')],
        fallback: [
          MONTH_LINE_OPEN,
          'No entry was written on 2026-11-10: the picker chose nothing to write: every candidate was set aside: no query had enough impressions. The run cost 0.00 USD.',
        ],
      },
    ]);
  })
);

test(
  'a strengthen decision writes nothing either, and the message carries its choice',
  withFiles(async (scene, put) => {
    const decision = put('decision.json', {
      schema: 1,
      decision: 'strengthen',
      choice: 'Strengthen /blog/x for "query"',
      advisories: [],
    });
    const hook = runner(scene);
    assert.equal(await hook.run(['pick', '--decision', decision]), 0);
    assert.deepEqual(partsOf(hook, 'happened'), [
      happened('The picker chose to strengthen a page and wrote nothing: Strengthen /blog/x for "query".'),
    ]);
    assert.deepEqual(told(hook), [
      'No entry was written on 2026-11-10: the picker chose to strengthen a page and wrote nothing: Strengthen /blog/x for "query". The run cost 0.00 USD.',
    ]);
  })
);

test(
  'a picker reason that spans lines and ends in several full stops is one clean sentence in the block and in the text',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const decision = put('decision.json', {
      schema: 1,
      decision: 'none',
      reason: 'no query had enough impressions\nand the rest were set aside...  ',
      advisories: [],
    });
    const hook = runner(scene);
    assert.equal(await hook.run(['pick', '--decision', decision]), 0);
    assert.deepEqual(partsOf(hook, 'happened'), [
      happened('The picker chose nothing to write: no query had enough impressions and the rest were set aside.'),
    ]);
    assert.deepEqual(partsOf(hook, 'fallback'), [
      [
        MONTH_LINE_OPEN,
        'No entry was written on 2026-11-10: the picker chose nothing to write: no query had enough impressions and the rest were set aside. The run cost 0.00 USD.',
      ],
    ]);
  })
);

test(
  'a write that ended with no entry: names the skipped drafts and the cost its ledger records',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', {
      ok: true,
      entries: [],
      skipped: [{ slug: 'a-term', format: 'term', reason: 'no draft passed', spend: {} }],
    });
    const hook = runner(scene);
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(views(hook), [
      {
        header: HEADER,
        happened: happened('The write ended with no entry, because term a-term was skipped (no draft passed).'),
        columns: [cost('0.625')],
        fallback: [
          MONTH_LINE_OPEN,
          'No entry was written on 2026-11-10: the write ended with no entry, because term a-term was skipped (no draft passed). The run cost 0.625 USD.',
        ],
      },
    ]);
  })
);

test(
  'a write that ended with no entry and no skipped draft says so',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', { ok: true, entries: [], skipped: [] });
    const hook = runner(scene);
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'happened'), [
      happened('The write ended with no entry and named no skipped draft.'),
    ]);
    assert.deepEqual(told(hook), [
      'No entry was written on 2026-11-10: the write ended with no entry and named no skipped draft. The run cost 0.625 USD.',
    ]);
  })
);

test(
  'a write that stopped: names the slug and the failure kind, and the cost its ledger records',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', failedResult);
    const hook = runner(scene);
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(views(hook), [
      {
        header: HEADER,
        happened: happened('The write stopped on a-post (output).'),
        columns: [cost('0.625')],
        fallback: [MONTH_LINE_OPEN, STOPPED_TOLD],
      },
    ]);
  })
);

test(
  'a write that stopped without printing a result says so, and still names the slug',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', '');
    const hook = runner(scene);
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'happened'), [
      happened('The write stopped on a-post and the writer printed no result.'),
    ]);
    assert.deepEqual(told(hook), [
      'No entry was written on 2026-11-10: the write stopped on a-post and the writer printed no result. The run cost 0.625 USD.',
    ]);
  })
);

test(
  'the cost is the generation plus every attempt of the ledger, not the claim of the result line',
  withFiles(async (scene, put) => {
    scene.put(
      LEDGER_PATH,
      ledgerOf({
        slug: SLUG,
        generationUsd: 1.5,
        attempts: [
          { at: IN_NOVEMBER, usd: 0.25 },
          { at: IN_NOVEMBER, usd: 0.125 },
        ],
      })
    );
    scene.commit('three calls');
    const hook = runner(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', { ...failedResult, spend: { costUsd: 99 } });
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('1.875')]]);
    assert.deepEqual(told(hook), [
      'No entry was written on 2026-11-10: the write stopped on a-post (output). The run cost 1.875 USD.',
    ]);
  })
);

test(
  'a ledger with no generation costs its attempts alone',
  withFiles(async (scene, put) => {
    scene.put(LEDGER_PATH, ledgerOf({ slug: SLUG, attempts: [{ at: IN_NOVEMBER, usd: 0.5 }] }));
    scene.commit('attempts only');
    const hook = runner(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', failedResult);
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.50')]]);
    assert.deepEqual(told(hook), [
      'No entry was written on 2026-11-10: the write stopped on a-post (output). The run cost 0.50 USD.',
    ]);
  })
);

test(
  'the run of the workflow is a link beside the cost, built from the server, the repository and the run the environment names',
  withFiles(async (scene) => {
    putSpentMonth(scene);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.00'), RUN_COLUMN]]);
    assert.deepEqual(partsOf(hook, 'fallback'), [[MONTH_LINE_REACHED, CEILING_TOLD, RUN_LINE]]);
  })
);

test(
  'with no server, repository or run named there is no link at all and the cost stands alone',
  withFiles(async (scene) => {
    const hook = runner(scene);
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.00')]]);
    assert.doesNotMatch(JSON.stringify(hook.posted.map(({ body }) => body)), /https?:|Workflow run/);
  })
);

test(
  'the issue that a stopped write opened is a third column, beside the cost and the run',
  withFiles(async (scene, put) => {
    putCostedLedger(scene, [escalationOf('esc-1', 'hard-stop', RAISED, issueOpened(41), SLACK_DELIVERED)]);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', failedResult);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.625'), RUN_COLUMN, issueColumn(41)]]);
    assert.deepEqual(partsOf(hook, 'fallback'), [[MONTH_LINE_OPEN, STOPPED_TOLD, RUN_LINE, issueLine(41)]]);
  })
);

test(
  'the newest issue the ledger delivered is the one linked, and an issue that was refused is skipped',
  withFiles(async (scene, put) => {
    putCostedLedger(scene, [
      escalationOf('esc-1', 'hard-stop', '2026-11-10T08:00:00Z', issueOpened(40)),
      escalationOf('esc-2', 'hard-stop', RAISED, issueOpened(41)),
      escalationOf('esc-3', 'hard-stop', '2026-11-10T08:50:00Z', ISSUE_REFUSED),
    ]);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', failedResult);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.625'), RUN_COLUMN, issueColumn(41)]]);
    assert.deepEqual(partsOf(hook, 'fallback'), [[MONTH_LINE_OPEN, STOPPED_TOLD, RUN_LINE, issueLine(41)]]);
  })
);

test(
  'an escalation whose issue was refused leaves no issue column, though its Slack post was delivered',
  withFiles(async (scene, put) => {
    putCostedLedger(scene, [escalationOf('esc-1', 'credential', RAISED, ISSUE_REFUSED, SLACK_DELIVERED)]);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', failedResult);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.625'), RUN_COLUMN]]);
    assert.deepEqual(partsOf(hook, 'fallback'), [[MONTH_LINE_OPEN, STOPPED_TOLD, RUN_LINE]]);
  })
);

test(
  'a ceiling ending links the issue that the notice of the month opened',
  withFiles(async (scene) => {
    putSpentMonth(scene);
    putNotice(scene, '2026-11', [escalationOf('esc-1', 'spend-ceiling', RAISED, issueOpened(41), SLACK_DELIVERED)]);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.00'), RUN_COLUMN, issueColumn(41)]]);
    assert.deepEqual(partsOf(hook, 'fallback'), [[MONTH_LINE_REACHED, CEILING_TOLD, RUN_LINE, issueLine(41)]]);
  })
);

test(
  'the notice of another month is not the notice of this month, so a ceiling ending links no issue',
  withFiles(async (scene) => {
    putSpentMonth(scene);
    putNotice(scene, '2026-10', [
      escalationOf('esc-1', 'spend-ceiling', '2026-10-20T08:00:00Z', issueOpened(40), SLACK_DELIVERED),
    ]);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.00'), RUN_COLUMN]]);
    assert.deepEqual(partsOf(hook, 'fallback'), [[MONTH_LINE_REACHED, CEILING_TOLD, RUN_LINE]]);
  })
);

test(
  'a ceiling ending whose notice delivered no issue links no issue, and its delivered Slack receipt is not an issue',
  withFiles(async (scene) => {
    putSpentMonth(scene);
    putNotice(scene, '2026-11', [escalationOf('esc-1', 'spend-ceiling', RAISED, ISSUE_REFUSED, SLACK_DELIVERED)]);
    const hook = runner(scene, { env: WORKFLOW_ENV });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(partsOf(hook, 'columns'), [[cost('0.00'), RUN_COLUMN]]);
  })
);

test(
  'a delivery that fails exits 0, prints one warning line on stderr and nothing on stdout, and never prints the webhook',
  withFiles(async (scene) => {
    const hook = runner(scene, { answer: () => new Response(`${WEBHOOK}\nfailed\non two lines`, { status: 500 }) });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(hook.out, []);
    assert.equal(hook.err.length, 1);
    assert.match(hook.err[0], /^::warning::spend ended: slack NOT delivered: Slack answered HTTP 500/);
    assert.doesNotMatch(hook.err[0], /\n/);
    assert.deepEqual(leaks(hook), []);
  })
);

test(
  'a request that cannot be made is the same warning, and the webhook in the network error is removed from it',
  withFiles(async (scene) => {
    const unreachable = () => {
      throw new Error(`getaddrinfo ENOTFOUND while posting to ${WEBHOOK}`);
    };
    const hook = runner(scene, { answer: unreachable });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(hook.out, []);
    assert.equal(hook.err.length, 1);
    assert.match(hook.err[0], /^::warning::spend ended: slack NOT delivered: request failed: getaddrinfo ENOTFOUND/);
    assert.deepEqual(leaks(hook), []);
  })
);

test(
  'a webhook that is not set exits 0 without a request, and the warning names the secret to create',
  withFiles(async (scene) => {
    const hook = runner(scene, { env: {} });
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(hook.posted, []);
    assert.deepEqual(hook.out, []);
    assert.equal(hook.err.length, 1);
    assert.match(hook.err[0], /^::warning::spend ended: slack NOT delivered: SLACK_WEBHOOK_URL is not set/);
  })
);

test(
  'a delivered message is a Block Kit message posted once to the webhook, reported on stdout alone and free of the webhook',
  withFiles(async (scene) => {
    const hook = runner(scene);
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(
      hook.posted.map(({ url, body }) => [url, blockKitProblems(body)]),
      [[WEBHOOK, []]]
    );
    assert.deepEqual(hook.out, ['spend ended: slack delivered (HTTP 200)']);
    assert.deepEqual(hook.err, []);
    assert.deepEqual(leaks(hook), []);
  })
);

test('a month line that cannot be read is an error exit and posts nothing', async () => {
  const scene = createScene();
  try {
    const hook = runner(scene);
    scene.put(recordPath('ledger', 'broken-post', IN_NOVEMBER), '{ not json');
    const status = await hook.run(['ceiling']);
    assert.equal(status, 1);
    assert.deepEqual(hook.posted, []);
    assert.match(hook.err.join('\n'), /^spend ended: /);
  } finally {
    scene.cleanup();
  }
});

test(
  'a write ending whose ledger is missing is an error exit and posts nothing',
  withFiles(async (scene, put) => {
    const hook = runner(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', failedResult);
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 1);
    assert.deepEqual(hook.posted, []);
    assert.match(hook.err.join('\n'), /^spend ended: /);
  })
);

test(
  'a write result with entries is not an ending without an entry: exit 2 and no request',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const hook = runner(scene);
    const decision = put('decision.json', decisionOf());
    const result = put('result.json', { ok: true, entries: [{ slug: 'a-post' }], skipped: [] });
    assert.equal(await hook.run(['write', '--decision', decision, '--result', result]), 2);
    assert.deepEqual(hook.posted, []);
  })
);

test(
  'a pick ending refuses a decision that says write, and a write ending refuses one that does not',
  withFiles(async (scene, put) => {
    putCostedLedger(scene);
    const hook = runner(scene);
    const writing = put('writing.json', decisionOf());
    const none = put('none.json', { schema: 1, decision: 'none', reason: 'nothing', advisories: [] });
    const result = put('result.json', failedResult);
    assert.equal(await hook.run(['pick', '--decision', writing]), 2);
    assert.equal(await hook.run(['write', '--decision', none, '--result', result]), 2);
    assert.deepEqual(hook.posted, []);
  })
);

test(
  'usage errors exit 2 and name the usage',
  withFiles(async (scene) => {
    const hook = runner(scene);
    for (const argv of [[], ['sleep'], ['pick'], ['write', '--decision', 'x'], ['ceiling', '--bogus', 'x']])
      assert.equal(await hook.run(argv), 2, argv.join(' '));
    assert.deepEqual(hook.posted, []);
    assert.match(hook.err.join('\n'), /Usage: node scripts\/spend-ended\.mjs/);
  })
);
