import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readClaim } from './autowriter-claim-store.mjs';
import { readLedger } from './autowriter-ledger.mjs';
import { entryPath, entryRoute } from './entry-files.mjs';
import { readRecord } from './generation-record.mjs';
import { classifyPullRequest, slugOfBranch } from './pr-classify.mjs';
import { readSnapshot } from './pr-github.mjs';
import { locateRecord, recordDirectory, recordPath } from './record-layout.mjs';
import { draftOfEntry, publishDateOf } from './repair-draft.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { passageOf } from './route-derive.mjs';

const SEMANTIC_CORE = 'docs/SEMANTIC-CORE.md';

const readText = (repoRoot, file) => readFileSync(join(repoRoot, file), 'utf8');
const stale = (message) => new RepairStop('stale', message);

async function confirmedHead({ repoRoot, head, run }) {
  const checkedOut = (await run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot })).stdout.trim();
  if (checkedOut !== head) throw stale('the working tree is at ' + checkedOut + ', not at the judged head ' + head);
}

async function repairableSnapshot({ api, number, head, now, snapshotOf, classify }) {
  const snapshot = await snapshotOf(api, number);
  const { pullRequest } = snapshot;
  if (pullRequest.head.sha !== head) throw stale('the head moved from ' + head + ' to ' + pullRequest.head.sha);
  const judged = classify({ ...snapshot, now });
  if (judged.verdict !== 'repairable')
    throw stale('the pull request is now judged ' + judged.verdict + ' (' + judged.reason + ')');
  const slug = slugOfBranch(pullRequest.head.ref);
  if (slug === null) throw stale(pullRequest.head.ref + ' is not a branch of the writer');
  return { slug, branch: pullRequest.head.ref, run: judged.evidence.run };
}

function claimFileOf(repoRoot, slug) {
  const path = locateRecord(repoRoot, 'claim', slug);
  if (path === null)
    throw new RepairStop('failed', recordDirectory('claim') + ' holds no claim named ' + slug + '.json');
  return join(repoRoot, path);
}

function readEntry({ repoRoot, slug }) {
  const claim = readClaim(claimFileOf(repoRoot, slug));
  if (!claim.prompt)
    throw new RepairStop(
      'failed',
      slug +
        ' has no buyer prompt, so ' +
        SEMANTIC_CORE +
        ' holds no passage for it and a repair has no passage to keep word for word; a person repairs it'
    );
  const record = readRecord(join(repoRoot, recordPath('generation', slug, claim.claimedAt)));
  const ledger = readLedger(join(repoRoot, recordPath('ledger', slug, claim.claimedAt)));
  const route = entryRoute(claim);
  const passage = passageOf(readText(repoRoot, SEMANTIC_CORE), { promptNumber: claim.prompt.number, route });
  if (passage === null) throw new RepairStop('failed', SEMANTIC_CORE + ' holds no passage for ' + route);
  const entryText = readText(repoRoot, entryPath(claim));
  const before = draftOfEntry({ claim, entryText, claimTable: record.claimTable, passage });
  return { claim, record, ledger, route, before, runDate: publishDateOf(entryText) };
}

export async function openRepair({
  api,
  repoRoot,
  number,
  head,
  now,
  run,
  snapshotOf = readSnapshot,
  classify = classifyPullRequest,
}) {
  await confirmedHead({ repoRoot, head, run });
  const pullRequest = await repairableSnapshot({ api, number, head, now, snapshotOf, classify });
  return { ...pullRequest, head, ...readEntry({ repoRoot, slug: pullRequest.slug }) };
}
