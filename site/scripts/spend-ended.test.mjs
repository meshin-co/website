import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { WEBHOOK, withScene } from './fixtures/spend-run.mjs';
import { createScene, ledgerOf } from './fixtures/spend-scene.mjs';
import { recordPath } from './record-layout.mjs';
import { messageOf, runCli } from './spend-ended.mjs';

const NOW = new Date('2026-11-10T09:00:00.000Z');
const IN_NOVEMBER = '2026-11-03T08:00:00Z';
const MONTH_LINE_OPEN = '2026-11 so far: 0.625 USD spent of the 25.00 USD monthly ceiling, 24.375 USD left.';
const MONTH_LINE_REACHED =
  '2026-11 so far: 25.00 USD spent of the 25.00 USD monthly ceiling, none left: the ceiling is reached, so the writer does not run for the rest of the month.';
const SLUG = 'a-post';
const LEDGER_PATH = recordPath('ledger', SLUG, IN_NOVEMBER);

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

const stoppedRun = () => ledgerOf({ slug: SLUG, generationUsd: 0.125, attempts: [{ at: IN_NOVEMBER, usd: 0.5 }] });

const putCostedLedger = (scene) => {
  scene.put(LEDGER_PATH, stoppedRun());
  scene.commit('the run ledger');
};

const decisionOf = (extra = {}) => ({ schema: 1, decision: 'write', ledgerPath: LEDGER_PATH, ...extra });
const failedResult = { ok: false, kind: 'output', message: 'no draft passed', spend: { costUsd: 0.625 } };

test('the message is two lines: what happened and what it cost, then the month line', () => {
  const text = messageOf({
    date: '2026-11-10',
    reason: 'the writer did not run',
    runMicro: 0,
    line: MONTH_LINE_OPEN,
  });
  assert.equal(
    text,
    ['No entry was written on 2026-11-10: the writer did not run. The run cost 0.00 USD.', MONTH_LINE_OPEN].join('\n')
  );
});

test('a reason that ends in a full stop or spans lines still gives exactly two lines', () => {
  const text = messageOf({
    date: '2026-11-10',
    reason: 'the picker chose nothing: nothing\nis ready.  ',
    runMicro: 1,
    line: MONTH_LINE_OPEN,
  });
  const [first, second, ...rest] = text.split('\n');
  assert.equal(
    first,
    'No entry was written on 2026-11-10: the picker chose nothing: nothing is ready. The run cost 0.000001 USD.'
  );
  assert.equal(second, MONTH_LINE_OPEN);
  assert.deepEqual(rest, []);
});

test(
  'ceiling reached: posts the ceiling reason, a cost of 0.00 and the month line, and reads no ledger of the run',
  withFiles(async (scene) => {
    scene.put(
      recordPath('ledger', 'big-post', IN_NOVEMBER),
      ledgerOf({ slug: 'big-post', attempts: [{ at: IN_NOVEMBER, usd: 25 }] })
    );
    scene.commit('spent');
    const hook = runner(scene);
    assert.equal(await hook.run(['ceiling']), 0);
    assert.deepEqual(
      hook.posted.map(({ url, body }) => [url, body.text]),
      [
        [
          WEBHOOK,
          [
            "No entry was written on 2026-11-10: the month's spend reached the ceiling, so the writer did not run. The run cost 0.00 USD.",
            MONTH_LINE_REACHED,
          ].join('\n'),
        ],
      ]
    );
    assert.deepEqual(hook.out, ['spend ended: slack delivered (HTTP 200)']);
    assert.deepEqual(hook.err, []);
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
    assert.deepEqual(
      hook.posted.map(({ body }) => body.text),
      [
        [
          'No entry was written on 2026-11-10: the picker chose nothing to write: every candidate was set aside: no query had enough impressions. The run cost 0.00 USD.',
          MONTH_LINE_OPEN,
        ].join('\n'),
      ]
    );
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
    const [first] = hook.posted[0].body.text.split('\n');
    assert.equal(
      first,
      'No entry was written on 2026-11-10: the picker chose to strengthen a page and wrote nothing: Strengthen /blog/x for "query". The run cost 0.00 USD.'
    );
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
    assert.deepEqual(
      hook.posted.map(({ body }) => body.text),
      [
        [
          'No entry was written on 2026-11-10: the write ended with no entry, because term a-term was skipped (no draft passed). The run cost 0.625 USD.',
          MONTH_LINE_OPEN,
        ].join('\n'),
      ]
    );
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
    assert.equal(
      hook.posted[0].body.text.split('\n')[0],
      'No entry was written on 2026-11-10: the write ended with no entry and named no skipped draft. The run cost 0.625 USD.'
    );
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
    assert.deepEqual(
      hook.posted.map(({ body }) => body.text),
      [
        [
          'No entry was written on 2026-11-10: the write stopped on a-post (output). The run cost 0.625 USD.',
          MONTH_LINE_OPEN,
        ].join('\n'),
      ]
    );
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
    assert.equal(
      hook.posted[0].body.text.split('\n')[0],
      'No entry was written on 2026-11-10: the write stopped on a-post and the writer printed no result. The run cost 0.625 USD.'
    );
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
    assert.match(hook.posted[0].body.text.split('\n')[0], /The run cost 1\.875 USD\.$/);
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
    assert.match(hook.posted[0].body.text.split('\n')[0], /The run cost 0\.50 USD\.$/);
  })
);

test(
  'a delivery that fails exits 1, prints one receipt line on stderr and never prints the webhook',
  withFiles(async (scene) => {
    const hook = runner(scene, { answer: () => new Response(WEBHOOK, { status: 500 }) });
    assert.equal(await hook.run(['ceiling']), 1);
    assert.equal(hook.out.length, 0);
    assert.equal(hook.err.length, 1);
    assert.match(hook.err[0], /^spend ended: slack NOT delivered: Slack answered HTTP 500/);
    for (const secret of ['T0SECRET', 'B0SECRET', 'xoxSECRETpath', WEBHOOK])
      assert.ok(!hook.printed().includes(secret), secret);
  })
);

test(
  'a webhook that is not set exits 1 without a request',
  withFiles(async (scene) => {
    const hook = runner(scene, { env: {} });
    assert.equal(await hook.run(['ceiling']), 1);
    assert.deepEqual(hook.posted, []);
    assert.match(hook.err.join('\n'), /^spend ended: slack NOT delivered: /);
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
