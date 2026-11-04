import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { restoredEntryText, upgradedEntryText } from './citation-rewrites.mjs';
import { searchStandIns } from './citations.mjs';
import { REGISTER_PATH, planRegister } from './link-rot-register.mjs';
import { supportsCitation, visibleText } from './snapshot-support.mjs';

export const MAX_REEXAMINED_PER_RUN = 20;

const DAY_MS = 86_400_000;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const LEFT_AS_IT_IS = 'the citation was left as it is and is asked again when the rotation comes round';

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const keyOf = ({ original, entry }) => JSON.stringify([original, entry]);

function dayNumber(today) {
  const moment = new Date(`${today}T00:00:00Z`);
  if (!CALENDAR_DAY.test(today) || Number.isNaN(moment.getTime()) || moment.toISOString().slice(0, 10) !== today) {
    throw new RangeError(`today must be a calendar day written YYYY-MM-DD, got ${String(today)}`);
  }
  return moment.getTime() / DAY_MS;
}

export function rotationOf({ originals, today, limit = MAX_REEXAMINED_PER_RUN }) {
  const sorted = [...new Set(originals)].sort();
  const first = dayNumber(today) * limit;
  if (sorted.length <= limit) return sorted;
  return Array.from({ length: limit }, (_, offset) => sorted[(first + offset) % sorted.length]);
}

function backAgain({ live, title, today }) {
  if (live.kind === 'unchecked') {
    const why = `on ${today} the original address answers again. It was accepted unchecked because ${live.reason}`;
    return { restore: { checked: false, why } };
  }
  if (live.kind !== 'page') return {};
  const found = supportsCitation({ text: visibleText(live.text), title, spans: [] });
  if (found.ok) {
    return {
      restore: {
        checked: true,
        why: `on ${today} the original address answers again and its page carries the source title`,
      },
    };
  }
  return { missing: `the original address answers, but its page does not carry the source title: ${found.reason}` };
}

function whyUnknown({ probe, live }) {
  if (live?.kind === 'unreadable')
    return `the original address answered, but its page could not be read (${live.reason})`;
  return probe?.verdict === 'unverified' ? `the original address could not be asked (${probe.reason})` : null;
}

async function judgeRow({ row, probe, live, rung, today }) {
  const { restore, missing } = live === null ? {} : backAgain({ live, title: row.sourceTitle, today });
  if (restore !== undefined) return { kind: 'restore', ...restore };
  const placed = await rung.place({ address: row.original, citedOn: row.citedOn, title: row.sourceTitle });
  if (placed.kind === 'archive') {
    return {
      kind: 'upgrade',
      archiveUrl: placed.archiveUrl,
      why: missing === undefined ? placed.why : `${placed.why}; ${missing}`,
    };
  }
  if (placed.kind === 'waiting') return { kind: 'waiting', why: placed.why };
  const unknown = whyUnknown({ probe, live });
  if (unknown === null) return { kind: 'stay' };
  return { kind: 'waiting', why: `${unknown}, and ${placed.why}; ${LEFT_AS_IT_IS}` };
}

async function decideOriginal({ original, rows, probe, readLivePage, rung, today }) {
  const live = probe?.verdict === 'answered' ? await readLivePage({ address: original }) : null;
  const decisions = [];
  for (const row of rows) decisions.push({ row, ...(await judgeRow({ row, probe, live, rung, today })) });
  return decisions;
}

function jobsOf(decisions) {
  const jobs = new Map();
  for (const decision of decisions.filter(({ kind }) => kind === 'restore' || kind === 'upgrade')) {
    const { row, kind, archiveUrl = null } = decision;
    const key = JSON.stringify([row.path, row.original, kind, archiveUrl]);
    const job = jobs.get(key) ?? { path: row.path, original: row.original, kind, archiveUrl, decisions: [] };
    job.decisions.push(decision);
    jobs.set(key, job);
  }
  return [...jobs.values()];
}

function rewritten(text, { original, kind, archiveUrl, decisions }) {
  const positions = decisions.map(({ row }) => row.position);
  return kind === 'restore'
    ? restoredEntryText({ text, original, positions })
    : upgradedEntryText({ text, original, archiveUrl, positions });
}

function applyJobs({ repoRoot, pending, decisions }) {
  const texts = new Map();
  const held = new Set();
  const failures = [];
  for (const job of jobsOf(decisions)) {
    try {
      const text = texts.get(job.path) ?? pending.get(job.path) ?? readFileSync(join(repoRoot, job.path), 'utf8');
      texts.set(job.path, rewritten(text, job));
      job.decisions.forEach((decision) => held.add(decision));
    } catch (error) {
      const message = `${job.path}: ${error.message}`;
      failures.push(...job.decisions.map(({ row }) => ({ original: row.original, entry: row.path, message })));
    }
  }
  return { texts, held, failures };
}

const earliestSeen = (known, { original, entry }) =>
  known.find((row) => keyOf(row) === keyOf({ original, entry }))?.firstSeenDead ??
  known
    .filter((row) => row.original === original)
    .map(({ firstSeenDead }) => firstSeenDead)
    .sort()[0];

function registerEffect({ decisions, held, known, today }) {
  const groups = Map.groupBy(decisions, ({ row }) => keyOf({ original: row.original, entry: row.path }));
  const found = [];
  const removed = [];
  for (const group of groups.values()) {
    if (!group.every((decision) => held.has(decision))) continue;
    const [{ row }] = group;
    const upgrade = group.find(({ kind }) => kind === 'upgrade');
    if (upgrade === undefined) removed.push({ original: row.original, entry: row.path });
    else found.push(upgradedRow({ decision: upgrade, known, today }));
  }
  return { found, removed };
}

function upgradedRow({ decision: { row, archiveUrl, why }, known, today }) {
  const identity = { original: row.original, entry: row.path };
  return {
    ...identity,
    outcome: 'archive',
    replacement: archiveUrl,
    citedOn: row.citedOn,
    firstSeenDead: earliestSeen(known, identity) ?? today,
    why,
  };
}

function reportsOf({ decisions, held, known, today }) {
  const done = (kind) => decisions.filter((decision) => decision.kind === kind && held.has(decision));
  const dated = (row) => earliestSeen(known, { original: row.original, entry: row.path }) ?? null;
  return {
    restored: done('restore').map(({ row, checked, why }) => ({
      original: row.original,
      entry: row.path,
      citedOn: row.citedOn,
      firstSeenDead: dated(row),
      checked,
      why,
    })),
    upgraded: done('upgrade').map((decision) => upgradedRow({ decision, known, today })),
    waiting: decisions
      .filter(({ kind }) => kind === 'waiting')
      .map(({ row, why }) => ({ original: row.original, entry: row.path, why })),
  };
}

export async function reexamineSearchRows({
  repoRoot,
  today,
  existing = null,
  pending = new Map(),
  skip = new Set(),
  probeAll,
  readLivePage,
  rung,
  maxOriginals = MAX_REEXAMINED_PER_RUN,
}) {
  const { standIns, unreadable } = searchStandIns({ repoRoot });
  const pool = standIns.filter(({ original }) => !skip.has(original));
  const originals = new Set(pool.map(({ original }) => original));
  const examined = rotationOf({ originals: [...originals], today, limit: maxOriginals });
  const probed = examined.length === 0 ? new Map() : await probeAll(examined);
  const known = existing?.rows ?? [];

  const failures = unreadable.map(({ path, message }) => ({ original: null, entry: path, message }));
  const decisions = [];
  for (const original of examined) {
    const rows = pool.filter((row) => row.original === original);
    try {
      decisions.push(
        ...(await decideOriginal({ original, rows, probe: probed.get(original), readLivePage, rung, today }))
      );
    } catch (error) {
      const message = `the re-examination of ${original} failed: ${error.message}`;
      failures.push(...rows.map(({ path }) => ({ original, entry: path, message })));
    }
  }

  const applied = applyJobs({ repoRoot, pending, decisions });
  const { held } = applied;
  return {
    of: originals.size,
    examined,
    ...reportsOf({ decisions, held, known, today }),
    failures: [...failures, ...applied.failures],
    texts: applied.texts,
    entries: [...applied.texts.keys()].sort(),
    register: registerEffect({ decisions, held, known, today }),
  };
}

export function mergeReexamined({ swept, reexamined, today }) {
  const layered = planRegister({
    existing: swept.register.register,
    found: reexamined.register.found,
    removed: reexamined.register.removed,
    today,
  });
  const plan = layered.changed ? layered : swept.register;
  const changed = swept.register.changed || layered.changed;
  const entries = [...new Set([...swept.entries, ...reexamined.entries])].sort();
  const files = new Map(entries.map((path) => [path, reexamined.texts.get(path) ?? swept.files.get(path)]));
  if (changed) files.set(REGISTER_PATH, plan.text);
  return {
    ...swept,
    files,
    entries,
    register: { changed, register: plan.register, text: changed ? plan.text : null },
    restored: reexamined.restored,
    upgraded: reexamined.upgraded,
    reexamineWaiting: reexamined.waiting,
    reexamineFailures: reexamined.failures,
    reexamined: { of: reexamined.of, examined: reexamined.examined.length },
    counts: {
      ...swept.counts,
      waiting: swept.counts.waiting + reexamined.waiting.length,
      restored: reexamined.restored.length,
      upgraded: reexamined.upgraded.length,
    },
  };
}

export function reexaminationLines({ reexamined: { of, examined }, reexamineFailures }) {
  const scope =
    of === 0
      ? []
      : [
          `repair-links: re-examined ${examined} of ${plural(of, 'address', 'addresses')} that ${of === 1 ? 'rests' : 'rest'} on a search link`,
        ];
  return [
    ...scope,
    ...reexamineFailures.map(({ message }) => `repair-links: a search link was left as it is: ${message}`),
  ];
}
