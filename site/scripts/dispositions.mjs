import { createHash } from 'node:crypto';

const VALID_STATUS = new Set(['rewritten', 'verified', 'owner-blocked']);

const normaliseTarget = (target) => target.replace(/^\.\//, '').replace(/^site\//, '');

const rowsFor = (rows, target, location) => {
  const wanted = normaliseTarget(target);
  return rows.filter(
    (row) =>
      row.usedIn.some((used) => normaliseTarget(used) === wanted) &&
      (location === undefined || row.location === location)
  );
};

export function digestFor(rows, target) {
  const texts = rowsFor(rows, target)
    .map((row) => `${row.location}\u0000${row.text}`)
    .sort();
  return createHash('sha256').update(texts.join('\u0001')).digest('hex').slice(0, 12);
}

export function applyDispositions(rows, dispositions) {
  const applied = rows.map((row) => ({ ...row }));
  const stale = [];
  const unmatched = [];

  for (const disposition of dispositions) {
    const { target, location, status, reason, digest } = disposition;
    const matched = rowsFor(applied, target, location);

    if (matched.length === 0) {
      unmatched.push(disposition);
      continue;
    }
    if (!VALID_STATUS.has(status) || (status === 'owner-blocked' && !reason)) {
      stale.push({ ...disposition, why: 'status is not one of rewritten, verified, owner-blocked with a reason' });
      continue;
    }
    if (digest !== digestFor(applied, target)) {
      stale.push({ ...disposition, why: 'the text changed since it was dispositioned' });
      continue;
    }

    for (const row of matched) {
      row.status = status;
      if (reason) row.reason = reason;
    }
  }

  return { rows: applied, stale, unmatched };
}

const REVIEWED = new Set(['rewritten', 'verified', 'owner-blocked']);

const comparable = (text) =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d'"]/g, '');

const escapeForPattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const numberedPage = (source, suffix) =>
  new RegExp(`^${escapeForPattern(source)} \\d+${suffix === '' ? '' : `\\s*${escapeForPattern(suffix)}`}$`);

const isRendered = (row) => row.usedIn.every((used) => used.startsWith('/'));

function inheritSourceStatus(rows, suffix) {
  const sources = rows.filter((row) => REVIEWED.has(row.status) && !isRendered(row));
  return rows.map((row) => {
    if (REVIEWED.has(row.status) || !isRendered(row)) return row;
    const rendered = comparable(row.text);
    const source = sources.find((candidate) => {
      const text = comparable(candidate.text);
      return (
        text.includes(rendered) ||
        numberedPage(text, '').test(rendered) ||
        (suffix !== '' && numberedPage(text, suffix).test(rendered))
      );
    });
    return source
      ? {
          ...row,
          status: source.status,
          ...(source.reason ? { reason: source.reason } : {}),
          derivedFrom: source.usedIn[0],
        }
      : row;
  });
}

const WORDING_LOCATION = 'constant.PAGE_HEADING_FORMAT';
const NUMBERED_ROUTE = /^(.+)\/page\/(\d+)$/;
const FIRST_PAGE_TAG = /^\/blog\/tag\/([^/]+)$/;
const DATED_LINE = /^\d{2} [A-Za-z]{3,4} \d{4}(?: · \d+ min read)?(?: · (.+))?$/;
const LINE_SEPARATOR = ' · ';
const CATEGORY_SOURCE = 'src/data/categories.mjs';

const isReviewed = (row) => REVIEWED.has(row.status);
const isNumbered = (route) => NUMBERED_ROUTE.test(route);

const expandWording = (format, heading, number) =>
  format.replace(/\{(heading|number)\}/g, (_, name) => (name === 'heading' ? heading : number));

const derivedFrom = (row, parent, from) => ({
  ...row,
  status: parent.status,
  ...(parent.reason ? { reason: parent.reason } : {}),
  derivedFrom: from,
});

export function inheritPaginatedStatus(rows, { titleSuffix = '' } = {}) {
  const suffix = comparable(titleSuffix);
  const wording = rows.find((row) => row.location === WORDING_LOCATION && isReviewed(row) && !isRendered(row));
  const format = wording ? comparable(wording.text) : null;
  const reviewedOn = (route) => rows.filter((row) => isReviewed(row) && row.usedIn.includes(route));
  const firstPageTags = new Set(
    rows.flatMap((row) => row.usedIn).flatMap((used) => FIRST_PAGE_TAG.exec(used)?.slice(1) ?? [])
  );
  const categoryNames = new Map(
    rows
      .filter((row) => isReviewed(row) && !isRendered(row) && row.usedIn.includes(CATEGORY_SOURCE))
      .map((row) => [row.text, row])
  );

  const headingFrom = (parent, number, text) => {
    const heading = comparable(parent.text);
    const bare = suffix !== '' && heading.endsWith(suffix) ? heading.slice(0, -suffix.length).trim() : null;
    const expected =
      bare === null ? expandWording(format, heading, number) : `${expandWording(format, bare, number)} ${suffix}`;
    return comparable(expected) === text;
  };

  const headingParent = (row) => {
    if (format === null || !row.usedIn.every(isNumbered)) return null;
    const text = comparable(row.text);
    const parents = row.usedIn.map((route) => {
      const [, base, number] = NUMBERED_ROUTE.exec(route);
      return reviewedOn(base).find((parent) => headingFrom(parent, number, text));
    });
    return parents.every(Boolean) ? { parent: parents[0], from: NUMBERED_ROUTE.exec(row.usedIn[0])[1] } : null;
  };

  const cardLineParent = (row) => {
    if (!row.usedIn.every(isNumbered)) return null;
    const tags = row.text.split(LINE_SEPARATOR);
    if (tags.every((tag) => firstPageTags.has(tag))) {
      const parents = tags.map((tag) => reviewedOn(`/blog/tag/${tag}`)[0]);
      return parents.every(Boolean) ? { parent: parents[0], from: `/blog/tag/${tags[0]}` } : null;
    }
    const category = categoryNames.get(DATED_LINE.exec(row.text)?.[1]);
    return category ? { parent: category, from: CATEGORY_SOURCE } : null;
  };

  return rows.map((row) => {
    if (isReviewed(row) || !isRendered(row)) return row;
    const source = headingParent(row) ?? (row.location === 'body.p' ? cardLineParent(row) : null);
    return source ? derivedFrom(row, source.parent, source.from) : row;
  });
}

export const inheritDerivedStatus = (rows, { titleSuffix = '' } = {}) =>
  inheritPaginatedStatus(inheritSourceStatus(rows, comparable(titleSuffix)), { titleSuffix });

export function applyConditionalCopy(dead, declarations) {
  const valid = declarations.filter((entry) => entry.reason);
  const invalid = dead.filter((entry) =>
    declarations.some((declared) => declared.text === entry.text && !declared.reason)
  );
  const declaredTexts = new Set(valid.map((entry) => entry.text));
  const deadTexts = new Set(dead.map((entry) => entry.text));
  return {
    remaining: dead.filter((entry) => !declaredTexts.has(entry.text)),
    invalid,
    stale: valid.filter((entry) => !deadTexts.has(entry.text)),
  };
}
