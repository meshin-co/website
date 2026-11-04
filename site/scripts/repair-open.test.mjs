import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { after, test } from 'node:test';

import { writeClaim } from './autowriter-claim-store.mjs';
import { newLedger, writeLedger } from './autowriter-ledger.mjs';
import { resolveClaimTable } from './claim-sources.mjs';
import { renderEntry } from './entry-files.mjs';
import { buildRecord, writeRecord } from './generation-record.mjs';
import { recordInput } from './fixtures/generation-input.mjs';
import { PLACES, filedAt } from './fixtures/record-depths.mjs';
import { claimFor, cleanDraft } from './fixtures/writer-drafts.mjs';
import { makeRepo, removeRepo } from './fixtures/writer-repo.mjs';
import { recordPath } from './record-layout.mjs';
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
const FILED = filedAt(claim.claimedAt);
const CLAIMED_IN_OCTOBER = claimFor('article', {
  claimedAt: '2026-10-31T23:59:59.000Z',
  expiresAt: '2026-11-14T23:59:59.000Z',
});

const roots = [];
after(() => roots.forEach(removeRepo));

function repository({
  claimed = claim,
  claimPath = FILED.month('claim', claim.slug),
  filedIn = claimed.claimedAt,
  decoys = [],
} = {}) {
  const root = makeRepo();
  roots.push(root);
  const put = (file, text) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const generationFile = recordPath('generation', claim.slug, filedIn);
  const ledgerFile = recordPath('ledger', claim.slug, filedIn);
  if (claimPath !== null) writeClaim(join(root, claimPath), claimed);
  for (const path of decoys) writeClaim(join(root, path), claimFor('article', { slug: basename(path, '.json') }));
  writeRecord(
    join(root, generationFile),
    buildRecord({
      ...recordInput(),
      claim,
      format: 'article',
      route: ROUTE,
      entryPath: ENTRY,
      ledger: ledgerFile,
      claimTable: resolveClaimTable(draft),
      files: [ENTRY, generationFile, 'docs/SEMANTIC-CORE.md', 'site/content-facts.json'],
    })
  );
  writeLedger(join(root, ledgerFile), newLedger({ slug: claim.slug, runId: claim.runId, pullRequest: 7 }));
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

const open = ({ repoRoot = repository(), ...changes } = {}) =>
  openRepair({
    api: {},
    repoRoot,
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

const decoysAt = (places) => places.map((place) => FILED[place]('claim', 'other-' + place));

for (const [place, label] of Object.entries(PLACES)) {
  test(`a claim filed ${label} is found by its slug among claims that are not it, and the entry opens from it`, async () => {
    const others = Object.keys(PLACES).filter((other) => other !== place);
    const repoRoot = repository({ claimPath: FILED[place]('claim', claim.slug), decoys: decoysAt(others) });

    const situation = await open({ repoRoot });

    assert.equal(situation.claim.slug, claim.slug);
    assert.equal(situation.record.slug, claim.slug);
    assert.equal(situation.ledger.slug, claim.slug);
    assert.ok(sameEntry(situation.before, draft));
  });
}

test('a claim that no directory holds stops the repair as failed, even where claims of other slugs lie at every depth', async () => {
  const repoRoot = repository({ claimPath: null, decoys: decoysAt(Object.keys(PLACES)) });

  await assert.rejects(
    open({ repoRoot }),
    (error) =>
      error instanceof RepairStop &&
      error.outcome === 'failed' &&
      error.message === `audits/autowriter/claims holds no claim named ${claim.slug}.json`
  );
});

test('a claim filed twice stops the repair loudly, naming both files', async () => {
  const repoRoot = repository();
  writeClaim(join(repoRoot, FILED.flat('claim', claim.slug)), claim);

  await assert.rejects(open({ repoRoot }), (error) => {
    assert.match(error.message, new RegExp(`claim ${claim.slug} is filed more than once`));
    assert.ok(error.message.includes(FILED.flat('claim', claim.slug)), error.message);
    assert.ok(error.message.includes(FILED.month('claim', claim.slug)), error.message);
    return true;
  });
});

test('the record and the ledger are read from the month of the claim, not from the month of the run', async () => {
  const claimedAt = CLAIMED_IN_OCTOBER.claimedAt;
  const repoRoot = repository({
    claimed: CLAIMED_IN_OCTOBER,
    claimPath: filedAt(claimedAt).month('claim', claim.slug),
  });

  const situation = await open({ repoRoot });

  assert.equal(situation.claim.claimedAt, claimedAt);
  assert.equal(situation.record.slug, claim.slug);
  assert.equal(situation.ledger.slug, claim.slug);
});

test('a record and a ledger filed in another month than the month of the claim are not found, and the path looked for is named', async () => {
  const repoRoot = repository({
    claimed: CLAIMED_IN_OCTOBER,
    claimPath: filedAt(CLAIMED_IN_OCTOBER.claimedAt).month('claim', claim.slug),
    filedIn: NOW.toISOString(),
  });

  await assert.rejects(open({ repoRoot }), (error) => {
    assert.ok(error.message.includes(`audits/autowriter/generations/2026/10/${claim.slug}.json`), error.message);
    return true;
  });
});

const PROMPTLESS = {
  'weak-demand': { origin: 'weak-demand', weakness: ['no-buyer-prompt'] },
  category: { origin: 'category', category: 'governance', demand: { impressions: 0, position: null } },
};

for (const [origin, fields] of Object.entries(PROMPTLESS)) {
  test(`${origin}: an entry with no buyer prompt is refused as failed with the reason, never a TypeError`, async () => {
    const repoRoot = repository();
    const rest = Object.fromEntries(Object.entries(claim).filter(([key]) => key !== 'prompt'));
    const claimFile = join(repoRoot, FILED.month('claim', claim.slug));
    writeFileSync(claimFile, JSON.stringify({ ...rest, ...fields }, null, 2) + '\n');

    await assert.rejects(
      open({ repoRoot }),
      (error) =>
        error instanceof RepairStop &&
        error.outcome === 'failed' &&
        error.message.includes(claim.slug) &&
        error.message.includes('no buyer prompt') &&
        error.message.includes('no passage') &&
        error.message.includes('a person repairs it')
    );
  });
}
