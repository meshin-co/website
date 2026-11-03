import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SEARCH_ORIGIN, searchFallbackUrl } from '../src/utils/archive-url.mjs';
import { RewriteError, archivedEntryText, citingEntries, searchedEntryText } from './citations.mjs';
import { ARCHIVE_SPACING_MS, archiveRung } from './link-repair-archive.mjs';
import { REGISTER_PATH, isSameRow, planRegister } from './link-rot-register.mjs';
import { readOutbound } from './outbound-links.mjs';

export const MAX_ADDRESSES_PER_RUN = 20;

const NOT_CITED = 'no collection entry cites it, so it is linked from a template or a page that only a person can edit';

export class SweepError extends Error {
  name = 'SweepError';
}

function isArchiveAddress(address) {
  if (!URL.canParse(address)) return false;
  const { hostname, pathname } = new URL(address);
  return hostname === 'web.archive.org' && pathname.startsWith('/web/');
}

const isStandIn = (address) => isArchiveAddress(address) || address.startsWith(SEARCH_ORIGIN);

function outboundOf({ dist, origin }) {
  if (!existsSync(dist)) throw new SweepError(`${dist} does not exist: build the site first (npm run build)`);
  if (readOutbound(dist, origin, { includeSkipped: true }).size === 0) {
    throw new SweepError(`${dist} holds no outbound address, so this run checked nothing`);
  }
  return readOutbound(dist, origin);
}

const earliest = (rows, address) =>
  rows
    .filter((row) => row.original === address)
    .map(({ firstSeenDead }) => firstSeenDead)
    .sort()[0];

const unplacedRow = ({ original, why, pages, firstSeenDead }) => ({
  original,
  entry: null,
  outcome: 'unplaced',
  replacement: null,
  citedOn: null,
  firstSeenDead,
  why,
  pages,
});

const failureText = (path, error) =>
  `${path}: ${error instanceof RewriteError ? error.message : `the repair of this citation failed: ${error.message}`}`;

function rewrite({ text, address, placed }) {
  return placed.kind === 'archive'
    ? archivedEntryText({ text, url: address, archiveUrl: placed.archiveUrl })
    : searchedEntryText({ text, url: address });
}

async function repairCitation({ citation, address, rung, texts, repoRoot, firstSeenDead }) {
  const { path, citedOn, sourceTitle, publisher } = citation;
  const placed = await rung.place({ address, citedOn, title: sourceTitle });
  if (placed.kind === 'waiting') return { waiting: { address, entry: path } };
  const text = texts.get(path) ?? readFileSync(join(repoRoot, path), 'utf8');
  texts.set(path, rewrite({ text, address, placed }));
  const replacement =
    placed.kind === 'archive' ? placed.archiveUrl : searchFallbackUrl({ title: sourceTitle, publisher });
  const row = {
    original: address,
    entry: path,
    outcome: placed.kind,
    replacement,
    citedOn,
    firstSeenDead,
    why: placed.why,
  };
  return { row };
}

async function repairAddress({ address, pages, repoRoot, rung, texts, firstSeenDead }) {
  const unplaced = (why) => unplacedRow({ original: address, why, pages, firstSeenDead });
  let citations;
  try {
    citations = citingEntries({ repoRoot, url: address });
  } catch (error) {
    return { rows: [unplaced(`the entries that cite it could not be read: ${error.message}`)], waiting: [] };
  }
  if (citations.length === 0) return { rows: [unplaced(NOT_CITED)], waiting: [] };

  const rows = [];
  const waiting = [];
  const failures = [];
  for (const citation of citations) {
    const saved = texts.get(citation.path);
    try {
      const done = await repairCitation({ citation, address, rung, texts, repoRoot, firstSeenDead });
      if (done.row) rows.push(done.row);
      if (done.waiting) waiting.push(done.waiting);
    } catch (error) {
      if (saved === undefined) texts.delete(citation.path);
      else texts.set(citation.path, saved);
      failures.push(failureText(citation.path, error));
    }
  }
  if (failures.length > 0) rows.push(unplaced(failures.join('; ')));
  return { rows, waiting };
}

const byPath = ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0);

export async function sweepLinks({
  repoRoot,
  dist,
  origin,
  today,
  existing = null,
  probeAll,
  closestSnapshot,
  readSnapshot,
  sleep,
  spacingMs = ARCHIVE_SPACING_MS,
  maxAddresses = MAX_ADDRESSES_PER_RUN,
}) {
  const outbound = outboundOf({ dist, origin });
  const candidates = [...outbound.keys()].filter((address) => !isStandIn(address));
  const probed = candidates.length === 0 ? new Map() : await probeAll(candidates);
  const verdictOf = (address) => probed.get(address)?.verdict;
  const dead = candidates.filter((address) => verdictOf(address) === 'dead');
  const acting = dead.slice(0, maxAddresses);
  const waitingForCap = dead.slice(maxAddresses);

  const rung = archiveRung({ closestSnapshot, readSnapshot, sleep, spacingMs });
  const known = existing?.rows ?? [];
  const texts = new Map();
  const rows = [];
  const waitingForArchive = [];
  for (const address of acting) {
    const firstSeenDead = earliest(known, address) ?? today;
    const done = await repairAddress({ address, pages: outbound.get(address), repoRoot, rung, texts, firstSeenDead });
    rows.push(...done.rows);
    waitingForArchive.push(...done.waiting);
  }

  const settled = new Set([
    ...candidates.filter((address) => verdictOf(address) === 'answered'),
    ...acting,
    ...known
      .filter(({ outcome, original }) => outcome === 'unplaced' && !outbound.has(original))
      .map(({ original }) => original),
  ]);
  const register = planRegister({ existing, found: rows, settled, today });
  const files = new Map([...texts].sort(byPath));
  if (register.changed) files.set(REGISTER_PATH, register.text);

  const count = (outcome) => rows.filter((row) => row.outcome === outcome).length;
  return {
    checked: candidates.length,
    dead,
    waitingForCap,
    waitingForArchive,
    rows,
    newUnplaced: rows.filter((row) => row.outcome === 'unplaced' && !known.some((old) => isSameRow(old, row))),
    entries: [...texts.keys()].sort(),
    files,
    register,
    counts: {
      dead: dead.length,
      archive: count('archive'),
      search: count('search'),
      unplaced: count('unplaced'),
      waiting: waitingForCap.length + waitingForArchive.length,
    },
  };
}
