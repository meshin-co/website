import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { claimFileProblem, validateClaim } from './autowriter-claims.mjs';
import { describeProblem } from './autowriter-records.mjs';
import { readEngineConfig } from './engine-config.mjs';
import { recordFiles } from './record-layout.mjs';

export const CLAIM_LIFETIME_DAYS = readEngineConfig().loop.claimLifetimeDays;

const DAY_MS = 86_400_000;
const MAX_SHOWN = 5;

const present = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null));

export function newClaim({ slug, title, format, query, demand, prompt, origin, category, weakness, runId, now }) {
  return {
    schema: 1,
    slug,
    title,
    format,
    query,
    demand,
    ...present({ prompt, origin, category, weakness }),
    runId,
    status: 'claimed',
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CLAIM_LIFETIME_DAYS * DAY_MS).toISOString(),
  };
}

export class ClaimError extends Error {
  constructor(path, problems) {
    const shown = problems.slice(0, MAX_SHOWN).join('; ');
    const more = problems.length > MAX_SHOWN ? ` (and ${problems.length - MAX_SHOWN} more)` : '';
    super(`${path} does not match the claim schema: ${shown}${more}`);
    this.problems = problems;
  }
}

function refusals(path, claim) {
  const shape = validateClaim(claim).map(describeProblem);
  if (shape.length > 0) return shape;
  return [claimFileProblem(path, claim)].filter(Boolean);
}

export function readClaim(path) {
  let claim;
  try {
    claim = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is not readable JSON: ${error.message}`, { cause: error });
  }
  const problems = refusals(path, claim);
  if (problems.length > 0) throw new ClaimError(path, problems);
  return claim;
}

export function writeClaim(path, claim) {
  const problems = refusals(path, claim);
  if (problems.length > 0) throw new ClaimError(path, problems);
  mkdirSync(dirname(path), { recursive: true });
  const staged = `${path}.${process.pid}.tmp`;
  writeFileSync(staged, `${JSON.stringify(claim, null, 2)}\n`);
  renameSync(staged, path);
}

export const readClaims = (repo) =>
  recordFiles(repo, 'claim').map((path) => ({ path, claim: readClaim(join(repo, path)) }));
