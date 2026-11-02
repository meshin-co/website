import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';

import { readClaim } from './autowriter-claim-store.mjs';
import { claimFile } from './autowriter-claims.mjs';
import { ledgerFile, newLedger, readLedger } from './autowriter-ledger.mjs';
import { COLLECTION_OF } from './entry-prose.mjs';
import { WriterError } from './writer-error.mjs';

export const DECISION_SCHEMA = 1;
export const DRAFT_ORDER = ['article', 'term'];

const WRITABLE = Object.keys(COLLECTION_OF);
const LEDGER_NAME = /^(.+)\.json$/;

const refuse = (message) => new WriterError('decision', message);

function readEntryClaim({ repoRoot, entry }) {
  const { claim, claimPath } = entry;
  if (!WRITABLE.includes(claim?.format))
    throw new WriterError(
      'claim',
      `the claim ${claim?.slug} has format ${JSON.stringify(claim?.format)}, which this writer does not write (it writes: ${DRAFT_ORDER.join(', ')})`
    );
  let stored;
  try {
    stored = readClaim(join(repoRoot, claimPath));
  } catch (error) {
    throw new WriterError('claim', error.message);
  }
  if (claim.slug !== stored.slug)
    throw new WriterError('claim', `the decision names ${claim.slug} but ${claimPath} holds ${stored.slug}`);
  if (claimPath !== claimFile(stored.slug))
    throw refuse(`the decision names the claim path ${claimPath}, the writer reads ${claimFile(stored.slug)}`);
  if (stored.status !== 'claimed')
    throw new WriterError('claim', `${stored.slug} is ${stored.status}; only a claimed topic is written`);
  return { claim: stored, row: entry.row, table: entry.table, choice: entry.choice };
}

function checkEntries(entries) {
  const slugs = entries.map(({ claim }) => claim.slug);
  if (new Set(slugs).size !== slugs.length) throw refuse(`the decision lists a slug twice: ${slugs.join(', ')}`);
  if (entries.filter(({ claim }) => claim.format === 'article').length > 1)
    throw refuse('the decision holds more than one article; a run writes one post');
  const runIds = [...new Set(entries.map(({ claim }) => claim.runId))];
  if (runIds.length > 1) throw refuse(`the claims belong to different runs: ${runIds.join(', ')}`);
  return runIds[0];
}

function anchorSlug({ ledgerPath, entries }) {
  const slug = LEDGER_NAME.exec(basename(ledgerPath ?? ''))?.[1];
  if (!entries.some(({ claim }) => claim.slug === slug) || ledgerPath !== ledgerFile(slug))
    throw refuse(
      `the decision names the ledger ${ledgerPath}, which is not the ledger of any of its entries (${entries.map(({ claim }) => ledgerFile(claim.slug)).join(', ')})`
    );
  return slug;
}

const byDraftOrder = (left, right) => DRAFT_ORDER.indexOf(left.claim.format) - DRAFT_ORDER.indexOf(right.claim.format);

export function openRun({ repoRoot, decision }) {
  if (decision.schema !== DECISION_SCHEMA)
    throw refuse(`the decision is schema ${decision.schema}, the writer reads schema ${DECISION_SCHEMA}`);
  if (!Array.isArray(decision.entries) || decision.entries.length === 0) throw refuse('the decision has no entries');
  const entries = decision.entries.map((entry) => readEntryClaim({ repoRoot, entry }));
  const runId = checkEntries(entries);
  const anchor = anchorSlug({ ledgerPath: decision.ledgerPath, entries });
  const ledgerPath = ledgerFile(anchor);
  const stored = join(repoRoot, ledgerPath);
  const ledger = existsSync(stored) ? readLedger(stored) : newLedger({ slug: anchor, runId, pullRequest: null });
  return {
    entries: entries.sort(byDraftOrder).map((entry) => ({ ...entry, anchor: entry.claim.slug === anchor })),
    ledger,
    ledgerPath,
    runId,
  };
}
