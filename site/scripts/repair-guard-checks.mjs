import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = {
  guard: 'scripts/repair-guard.mjs',
  drafts: 'scripts/fixtures/writer-drafts.mjs',
  scope: 'scripts/repair-scope.mjs',
  ledger: 'scripts/autowriter-ledger.mjs',
};
const ENTRY = { slug: 'zz-specimen', format: 'article' };
const OUTSIDE = 'site/src/pages/index.astro';
const REFUSED = 'audits/lighthouse-green.json';
const CAP = 3;
const ATTEMPT = {
  judgedCommit: 'c'.repeat(40),
  recordedAt: '2026-11-02T07:00:00.000Z',
  failingRule: 'banned-phrase',
  failingPath: 'site/src/data/post/zz-specimen.md',
  tokens: { input: 10, output: 5 },
  costUsd: 0.5,
};

const pass = (reason) => ({ ok: true, reason });
const fail = (reason) => ({ ok: false, reason });
const rulesOf = (problems) => problems.map(({ rule }) => rule);

export function removalCheck({ guard, drafts }) {
  const before = drafts.cleanDraft('article');
  if ((before.fields.keyTakeaways ?? []).length === 0) return fail('the draft fixture holds no key takeaway to drop');
  const dropped = { ...before, fields: { ...before.fields, keyTakeaways: [] } };
  const unchanged = guard.removalProblems({ before, after: before });
  if (unchanged.length > 0)
    return fail(`the removal guard flagged an entry handed back unchanged: ${unchanged[0].rule}`);
  if (!rulesOf(guard.removalProblems({ before, after: dropped })).includes('takeaway-removed'))
    return fail('the removal guard stayed green when every key takeaway was dropped');
  if (rulesOf(guard.removalProblems({ before, after: dropped, may: ['takeaways'] })).includes('takeaway-removed'))
    return fail('the removal guard ignored the takeaways allowance');
  return pass('takeaway-removed on dropped takeaways; none when handed back unchanged or when takeaways are allowed');
}

export function scopeCheck({ scope }) {
  const own = scope.ownPaths(ENTRY);
  const ownProblems = scope.scopeProblems({ ...ENTRY, paths: own });
  if (ownProblems.length > 0)
    return fail(
      `the scope check flagged the files of the entry itself: ${ownProblems[0].path} ${ownProblems[0].problem}`
    );
  const named = new Set(scope.scopeProblems({ ...ENTRY, paths: [...own, OUTSIDE, REFUSED] }).map(({ path }) => path));
  const missed = [OUTSIDE, REFUSED].find((path) => !named.has(path));
  if (missed !== undefined) return fail(`the scope check stayed green on ${missed}`);
  return pass(`${OUTSIDE} is outside the entry and ${REFUSED} is refused; the files of the entry itself pass`);
}

export function attemptCapCheck({ ledger }) {
  let held = ledger.newLedger({ slug: ENTRY.slug, runId: '1', pullRequest: null });
  for (let number = 1; number <= CAP; number += 1) {
    try {
      held = ledger.ledgerWithAttempt(held, ATTEMPT);
    } catch (error) {
      return fail(`attempt ${number} was refused below the cap: ${error.message}`);
    }
  }
  try {
    ledger.ledgerWithAttempt(held, ATTEMPT);
  } catch (error) {
    return error.message.includes(`the cap is ${CAP}`)
      ? pass(`attempt ${CAP + 1} is refused and the refusal says the cap is ${CAP}`)
      : fail(`the refusal of attempt ${CAP + 1} does not name the cap: ${error.message}`);
  }
  return fail(`attempt ${CAP + 1} was recorded`);
}

export const REPAIR_CHECKS = {
  'repair-removal': removalCheck,
  'repair-scope': scopeCheck,
  'repair-attempt-cap': attemptCapCheck,
};

export async function loadRepairModules(copySite) {
  const loaded = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => [key, await import(pathToFileURL(join(copySite, file)).href)])
  );
  return Object.fromEntries(loaded);
}

export async function runRepairCheck(name, copySite) {
  if (!Object.hasOwn(REPAIR_CHECKS, name)) throw new Error(`no repair check named ${name}`);
  return REPAIR_CHECKS[name](await loadRepairModules(copySite));
}
