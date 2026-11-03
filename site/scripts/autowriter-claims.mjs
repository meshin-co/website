import { fileStemProblem } from './autowriter-ledger.mjs';
import { instantProblems, readSchema } from './autowriter-records.mjs';
import { validateJsonSchema } from './json-schema.mjs';

export const GENERATED_BEGIN = '<!-- semantic-core:begin generated -->';
export const GENERATED_END = '<!-- semantic-core:end generated -->';

const CLAIM_SCHEMA = readSchema('autowriter-claim.schema.json');
const FAMILY_HEADING = /^### ([a-z-]+) \(\d+\)/;
const SEPARATOR_CELL = /^:?-+:?$/;

export const CLAIM_FORMATS = CLAIM_SCHEMA.properties.format.enum;
export const CLAIM_STATUSES = CLAIM_SCHEMA.properties.status.enum;

export const claimFileProblem = fileStemProblem;

const problem = (path, message) => ({ path, problem: message });

function expiryProblems({ claimedAt, expiresAt }) {
  return Date.parse(expiresAt) > Date.parse(claimedAt) ? [] : [problem('$.expiresAt', 'must be later than claimedAt')];
}

function demandProblems({ demand }) {
  if (demand.impressions > 0 && demand.position === null)
    return [problem('$.demand.position', 'must be a number when impressions is above 0')];
  if (demand.impressions === 0 && demand.position !== null)
    return [problem('$.demand.position', 'must be null when impressions is 0')];
  return [];
}

export function validateClaim(claim) {
  const shape = validateJsonSchema(CLAIM_SCHEMA, claim);
  if (shape.length > 0) return shape;
  const calendar = instantProblems([
    ['$.claimedAt', claim.claimedAt],
    ['$.expiresAt', claim.expiresAt],
  ]);
  if (calendar.length > 0) return calendar;
  return [...expiryProblems(claim), ...demandProblems(claim)];
}

export function normaliseTitle(title, suffix) {
  const bare = title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  return bare
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

export function generatedTitles(doc) {
  const begin = doc.indexOf(GENERATED_BEGIN);
  const end = doc.indexOf(GENERATED_END);
  if (begin === -1 || end === -1 || end < begin)
    throw new Error('docs/SEMANTIC-CORE.md has no generated layer between its two markers');
  const rows = [];
  let family = null;
  let titleColumn = -1;
  for (const line of doc.slice(begin + GENERATED_BEGIN.length, end).split('\n')) {
    const heading = FAMILY_HEADING.exec(line);
    if (heading) {
      family = heading[1];
      titleColumn = -1;
    } else if (line.startsWith('|')) {
      const cells = cellsOf(line);
      if (cells[0] === 'Route') titleColumn = cells.indexOf('Title');
      else if (!SEPARATOR_CELL.test(cells[0]) && titleColumn !== -1 && cells[titleColumn])
        rows.push({ family, route: cells[0].replaceAll('`', ''), title: cells[titleColumn] });
    }
  }
  return rows;
}

export const isHolding = ({ status, expiresAt }, now) => status === 'written' || Date.parse(expiresAt) > now.getTime();

function layerOwners(generated, suffix) {
  const owners = new Map();
  for (const row of generated) {
    const key = normaliseTitle(row.title, suffix);
    if (!owners.has(key)) owners.set(key, row);
  }
  return owners;
}

function holdersByTitle(holders, suffix) {
  const byTitle = new Map();
  for (const holder of holders) {
    const key = normaliseTitle(holder.claim.title, suffix);
    byTitle.set(key, [...(byTitle.get(key) ?? []), holder.path]);
  }
  return byTitle;
}

export function titleCollisions({ claims, generated, suffix, now }) {
  const owners = layerOwners(generated, suffix);
  const holders = claims.filter(({ claim }) => isHolding(claim, now));
  const byTitle = holdersByTitle(holders, suffix);
  return holders
    .filter(({ claim }) => claim.status === 'claimed')
    .flatMap(({ path, claim }) => {
      const key = normaliseTitle(claim.title, suffix);
      const owner = owners.get(key);
      const others = byTitle.get(key).filter((other) => other !== path);
      return [
        ...(owner
          ? [
              {
                path,
                detail: `title "${claim.title}" is already the title of ${owner.route} in the generated layer of docs/SEMANTIC-CORE.md ("${owner.title}")`,
              },
            ]
          : []),
        ...(others.length > 0
          ? [{ path, detail: `title "${claim.title}" is also claimed by ${others.join(', ')}` }]
          : []),
      ];
    });
}
