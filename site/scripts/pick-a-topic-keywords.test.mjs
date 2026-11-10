import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { readLedger } from './autowriter-ledger.mjs';
import { keywordReportText, reportText, withPickRepo } from './fixtures/pick-scene.mjs';
import { AGENTIC, GOVERNANCE, QUERY_ACCEPTED, answerWith, modelRequests } from './fixtures/proposal-scene.mjs';
import { ROUTES, adapterOn, inSequence } from './fixtures/writer-vendors.mjs';
import { openRun } from './write-open.mjs';

const ROTATION = [GOVERNANCE, AGENTIC];
const POSTS = {
  'older-review': { title: 'Why governance reviews stall', category: GOVERNANCE, publishDate: '2026-09-01' },
  'review-board': { title: 'How a review board decides', category: GOVERNANCE, publishDate: '2026-10-01' },
  'agent-runbook': { title: 'What an agent runbook holds', category: AGENTIC, publishDate: '2026-09-15' },
};
const FREE = [
  ['ai governance policy', 32, 32],
  ['ai governance framework', 803, 1051],
];
const OWNED = [
  ['evals checklist', 1200, 1200],
  ['ai register template', 500, 500],
];
const KEYWORD_CHOICE = 'Choice: keyword, "ai governance framework", 803 exact impressions on Bing, measured 2026-11-09';

const written = (repo, argv = [], io = {}) =>
  repo.run(['--write', '--output', join(repo.root, 'out', 'decision.json'), ...argv], io);
const vendorAnswering = (...answers) => adapterOn({ routes: { [ROUTES.responses]: inSequence(...answers) } });
const withKeywordReport = (candidates, body, posts = POSTS) =>
  withPickRepo({ report: reportText(), keywords: keywordReportText({ candidates }), posts }, body);
const advisoryLine = (route, phrase, exact) =>
  `Strengthen: ${route}, "${phrase}", ${exact} impressions at position n/a: `;

test('a preview takes the keyword candidate with the most exact impressions ahead of the category rotation, and calls no model', async () => {
  await withKeywordReport(FREE, async (repo) => {
    const { exit, stdout, stderr } = await repo.run([], { rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.deepEqual(stdout, [
      KEYWORD_CHOICE,
      'article: AI governance framework, /blog/ai-governance-framework, keyword',
      'Examined 1 candidate, set aside 0.',
    ]);
    assert.deepEqual(repo.filesBelow('audits/autowriter'), []);
  });
});

for (const [name, keywords] of [
  ['no keyword report', null],
  ['an empty keyword report', ''],
  ['a keyword report with no candidate', keywordReportText()],
  ['a file that is no keyword report', 'not a report at all\n'],
]) {
  test(`with ${name} the preview is what it was before the keyword rung: the category rotation, and no error`, async () => {
    await withPickRepo({ report: reportText(), keywords, posts: POSTS }, async (repo) => {
      const { exit, stdout, stderr } = await repo.run([], { rotation: ROTATION });
      assert.equal(exit, 0, stderr.join('\n'));
      assert.deepEqual(stderr, []);
      const rotation = `Category rotation: ${AGENTIC}, ${GOVERNANCE}. No model is called without --write.`;
      assert.ok(stdout.includes(rotation), stdout.join('\n'));
      assert.equal(
        stdout.some((line) => /keyword/i.test(line)),
        false,
        stdout.join('\n')
      );
    });
  });
}

test('a written keyword pick files a claim of origin keyword with the exact impressions and no prompt, calls no model, and the writer can open it', async () => {
  await withKeywordReport(FREE, async (repo) => {
    const { exit, stderr } = await written(repo, [], { rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    const file = repo.json('out/decision.json');
    const [entry] = file.entries;
    assert.deepEqual(
      [entry.claim.origin, entry.claim.query, entry.row, entry.table],
      ['keyword', 'ai governance framework', null, null]
    );
    assert.deepEqual(entry.claim.demand, { impressions: 803, position: null });
    for (const field of ['prompt', 'category', 'weakness']) {
      assert.equal(Object.hasOwn(entry.claim, field), false, field);
    }
    assert.equal(entry.choice, KEYWORD_CHOICE);
    assert.equal(Object.hasOwn(entry, 'proposal'), false);
    assert.equal(openRun({ repoRoot: repo.root, decision: file }).entries[0].anchor, true);
  });
});

test('candidates that name a register concept are advisories: the run falls to the category rotation, writes there, and keeps the advisories and the refusals', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED));
  await withKeywordReport(OWNED, async (repo) => {
    const summary = join(repo.root, 'summary.md');
    const { exit, stdout, stderr } = await written(repo, ['--summary', summary], { vendor, rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.equal(modelRequests(vendor.calls).length, 1);
    const file = repo.json('out/decision.json');
    assert.equal(file.entries[0].claim.origin, 'category');
    const evals = advisoryLine('/glossary/evals', 'evals checklist', 1200);
    const register = advisoryLine('/glossary/ai-register', 'ai register template', 500);
    assert.ok(
      stdout.some((line) => line.startsWith(evals)),
      stdout.join('\n')
    );
    assert.ok(
      stdout.some((line) => line.startsWith(register)),
      stdout.join('\n')
    );
    const ledger = readLedger(join(repo.root, file.ledgerPath));
    assert.deepEqual(
      ledger.refusals.map(({ reason, against }) => [reason, against]),
      [
        ['register-owner', '/glossary/evals'],
        ['register-owner', '/glossary/ai-register'],
      ]
    );
    const text = repo.read('summary.md');
    assert.ok(text.includes('### Strengthen reports'), text);
    assert.ok(text.includes(`- ${evals}`), text);
  });
});

test('candidates a published article already covers are set aside, and the run falls to the category rotation with the refusals in the ledger', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED));
  const posts = {
    ...POSTS,
    'framework-for-a-bank': {
      title: 'AI governance framework for a small bank',
      category: GOVERNANCE,
      publishDate: '2026-10-05',
    },
  };
  await withKeywordReport(
    FREE,
    async (repo) => {
      const { exit, stderr } = await written(repo, [], { vendor, rotation: ROTATION });
      assert.equal(exit, 0, stderr.join('\n'));
      assert.equal(modelRequests(vendor.calls).length, 1);
      const file = repo.json('out/decision.json');
      assert.equal(file.entries[0].claim.origin, 'category');
      const ledger = readLedger(join(repo.root, file.ledgerPath));
      assert.deepEqual(
        ledger.refusals.map(({ reason }) => reason),
        ['same-subject', 'same-subject']
      );
    },
    posts
  );
});

const HANDLED_PATH = 'audits/keyword-handled.json';
const handledRow = (phrase, route, impressions) => ({
  phrase,
  route,
  impressions,
  handledOn: '2026-11-10',
  reason: 'Added a section that answers the phrase.',
});
const strengthenLines = (stdout) => stdout.filter((line) => line.startsWith('Strengthen:'));

test('a pair recorded as handled is no longer printed as a Strengthen advisory, and the pair that is not recorded still is', async () => {
  await withKeywordReport(OWNED, async (repo) => {
    const before = await repo.run([], { rotation: ROTATION });
    assert.equal(strengthenLines(before.stdout).length, 2, before.stdout.join('\n'));
    repo.put(HANDLED_PATH, [handledRow('evals checklist', '/glossary/evals', 1200)]);
    const { exit, stdout, stderr } = await repo.run([], { rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    const lines = strengthenLines(stdout);
    assert.equal(lines.length, 1, stdout.join('\n'));
    assert.ok(lines[0].startsWith(advisoryLine('/glossary/ai-register', 'ai register template', 500)), lines[0]);
  });
});

test('a handled pair whose exact impressions reached double and 50 more is printed again, and one just short of double is not', async () => {
  await withKeywordReport(OWNED, async (repo) => {
    repo.put(HANDLED_PATH, [handledRow('evals checklist', '/glossary/evals', 600)]);
    const grown = await repo.run([], { rotation: ROTATION });
    assert.equal(strengthenLines(grown.stdout).length, 2, grown.stdout.join('\n'));
    repo.put(HANDLED_PATH, [handledRow('evals checklist', '/glossary/evals', 601)]);
    const level = await repo.run([], { rotation: ROTATION });
    assert.equal(strengthenLines(level.stdout).length, 1, level.stdout.join('\n'));
  });
});

test('every candidate handled leaves no advisory and no error, and the run falls to the category rotation', async () => {
  await withKeywordReport(OWNED, async (repo) => {
    repo.put(HANDLED_PATH, [
      handledRow('evals checklist', '/glossary/evals', 1200),
      handledRow('ai register template', '/glossary/ai-register', 500),
    ]);
    const { exit, stdout, stderr } = await repo.run([], { rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    assert.deepEqual(strengthenLines(stdout), []);
    assert.ok(
      stdout.some((line) => line.startsWith('Category rotation:')),
      stdout.join('\n')
    );
  });
});

for (const [name, text] of [
  ['an empty ledger', ''],
  ['an empty list', '[]\n'],
  ['a ledger that is not JSON', '{ nope'],
]) {
  test(`with ${name} nothing is handled and the run is no different from one with no ledger`, async () => {
    await withKeywordReport(OWNED, async (repo) => {
      repo.put(HANDLED_PATH, text);
      const { exit, stdout, stderr } = await repo.run([], { rotation: ROTATION });
      assert.equal(exit, 0, stderr.join('\n'));
      assert.deepEqual(stderr, []);
      assert.equal(strengthenLines(stdout).length, 2, stdout.join('\n'));
    });
  });
}

test('a handled pair leaves the ledger refusal of the run as it was, so only the advice is quiet', async () => {
  const vendor = vendorAnswering(answerWith(QUERY_ACCEPTED));
  await withKeywordReport(OWNED, async (repo) => {
    repo.put(HANDLED_PATH, [handledRow('evals checklist', '/glossary/evals', 1200)]);
    const { exit, stderr } = await written(repo, [], { vendor, rotation: ROTATION });
    assert.equal(exit, 0, stderr.join('\n'));
    const file = repo.json('out/decision.json');
    const ledger = readLedger(join(repo.root, file.ledgerPath));
    assert.deepEqual(
      ledger.refusals.map(({ reason, against }) => [reason, against]),
      [
        ['register-owner', '/glossary/evals'],
        ['register-owner', '/glossary/ai-register'],
      ]
    );
  });
});
