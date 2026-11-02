import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { writeClaim } from './autowriter-claim-store.mjs';
import { newLedger, writeLedger } from './autowriter-ledger.mjs';
import { resolveClaimTable } from './claim-sources.mjs';
import { renderEntry } from './entry-files.mjs';
import { buildRecord, writeRecord } from './generation-record.mjs';
import { recordInput } from './fixtures/generation-input.mjs';
import { claimFor, cleanDraft } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { sameEntry } from './repair-draft.mjs';
import { openRepair } from './repair-open.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { insertPassage } from './route-derive.mjs';

const HEAD = 'a'.repeat(40);
const NOW = new Date('2026-11-02T08:00:00.000Z');
const RUN_DATE = '2026-10-28';
const claim = claimFor('article');
const draft = cleanDraft('article');
const ENTRY = 'site/src/data/post/' + claim.slug + '.md';
const ROUTE = '/blog/' + claim.slug;

const roots = [];
after(() => roots.forEach(removeRepo));

function repository() {
  const root = makeRepo();
  roots.push(root);
  const put = (file, text) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  writeClaim(join(root, 'audits/autowriter/claims/' + claim.slug + '.json'), claim);
  writeRecord(
    join(root, 'audits/autowriter/generations/' + claim.slug + '.json'),
    buildRecord({
      ...recordInput(),
      claim,
      format: 'article',
      route: ROUTE,
      entryPath: ENTRY,
      ledger: 'audits/autowriter/' + claim.slug + '.json',
      claimTable: resolveClaimTable(draft),
      files: [
        ENTRY,
        'audits/autowriter/generations/' + claim.slug + '.json',
        'docs/SEMANTIC-CORE.md',
        'site/content-facts.json',
      ],
    })
  );
  writeLedger(
    join(root, 'audits/autowriter/' + claim.slug + '.json'),
    newLedger({ slug: claim.slug, runId: claim.runId, pullRequest: 7 })
  );
  put(ENTRY, renderEntry({ claim, draft, runDate: RUN_DATE }).text);
  const core = readFileSync(join(root, 'docs/SEMANTIC-CORE.md'), 'utf8');
  put(
    'docs/SEMANTIC-CORE.md',
    insertPassage(core, { promptNumber: claim.prompt.number, passage: draft.passage, route: ROUTE })
  );
  return root;
}

const repairable = () => ({
  verdict: 'repairable',
  reason: 'content-gate',
  evidence: { head: HEAD, run: { id: 99, attempt: 2 }, failing: [] },
});
const snapshotOf =
  (head = HEAD) =>
  async () => ({
    pullRequest: { number: 7, head: { sha: head, ref: 'autowriter/' + claim.slug } },
    commits: [],
    checkRuns: {},
    runs: {},
    jobs: {},
    ledger: null,
  });
const checkedOut = (sha) => async () => ({ status: 0, stdout: sha + '\n', stderr: '' });

const open = (changes = {}) =>
  openRepair({
    api: {},
    repoRoot: repository(),
    number: 7,
    head: HEAD,
    now: NOW,
    run: checkedOut(HEAD),
    snapshotOf: snapshotOf(),
    classify: repairable,
    ...changes,
  });
const stale = (pattern) => (error) =>
  error instanceof RepairStop && error.outcome === 'stale' && pattern.test(error.message);

test('a repairable pull request opens into the entry as it stands, with its claim, record, ledger and failing run', async () => {
  const situation = await open();

  assert.equal(situation.slug, claim.slug);
  assert.equal(situation.branch, 'autowriter/' + claim.slug);
  assert.deepEqual(situation.run, { id: 99, attempt: 2 });
  assert.equal(situation.route, ROUTE);
  assert.equal(situation.runDate, RUN_DATE);
  assert.equal(situation.ledger.attempts.length, 0);
  assert.equal(situation.claim.slug, claim.slug);
  assert.equal(situation.record.slug, claim.slug);
  assert.ok(sameEntry(situation.before, draft), 'the entry on disk reads back as the draft that wrote it');
});

test('a working tree that is not at the judged head is stale', async () => {
  await assert.rejects(open({ run: checkedOut('b'.repeat(40)) }), stale(/bbbb.*aaaa/));
});

test('a pull request whose head moved since the watcher judged it is stale', async () => {
  await assert.rejects(open({ snapshotOf: snapshotOf('d'.repeat(40)) }), stale(/moved/));
});

test('a pull request the classifier no longer calls repairable is stale, naming the verdict', async () => {
  const classify = () => ({ verdict: 'merge', reason: 'green-after-quarantine', evidence: {} });
  await assert.rejects(open({ classify }), stale(/merge.*green-after-quarantine/));
});
