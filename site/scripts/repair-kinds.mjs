import { MAY } from './repair-guard.mjs';
import { CONTENT_KINDS } from './repair-kinds-content.mjs';
import { HUMAN_KINDS } from './repair-kinds-human.mjs';
import { EDITORIAL_KINDS, REGISTER_KINDS } from './repair-kinds-ledger.mjs';
import { MACHINE_KINDS } from './repair-kinds-machine.mjs';

export const RULES = Object.freeze({
  'gate:content': CONTENT_KINDS,
  'gate:human': HUMAN_KINDS,
  'gate:editorial': EDITORIAL_KINDS,
  'gate:machine': MACHINE_KINDS,
  'gate:registers': REGISTER_KINDS,
});

export const REASONS = Object.freeze(['unclassified-rule', 'not-prose', 'unattributed', 'outside-entry']);

const NOT_CLASSIFIED = Object.freeze({ repairable: false, how: null, may: Object.freeze([]), why: 'not classified' });
const SHOWN_CHARACTERS = 60;
const SHOWN_SUBJECTS = 3;

const own = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);

const rowOf = (kind) =>
  own(RULES, kind?.gate) && own(RULES[kind.gate], kind.rule) ? RULES[kind.gate][kind.rule] : null;

export const classifyRule = (kind) => rowOf(kind) ?? NOT_CLASSIFIED;

export const knownRule = (kind) => rowOf(kind) !== null;

export const listRows = () =>
  Object.entries(RULES).flatMap(([gate, kinds]) =>
    Object.entries(kinds).map(([rule, row]) => ({ gate, rule, ...row }))
  );

export function allowancesOf(accepted) {
  if (!Array.isArray(accepted?.rewrite)) throw new TypeError('allowancesOf needs { rewrite }, a list of findings');
  const granted = new Set(accepted.rewrite.flatMap((item) => classifyRule(item).may));
  return MAY.filter((name) => granted.has(name));
}

const shown = (value) => {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > SHOWN_CHARACTERS ? `${text.slice(0, SHOWN_CHARACTERS - 3)}...` : text;
};

const listed = (subjects) => {
  const names = subjects.slice(0, SHOWN_SUBJECTS).map(shown).join(', ');
  return subjects.length > SHOWN_SUBJECTS ? `${names} and ${subjects.length - SHOWN_SUBJECTS} more` : names;
};

const isRoute = (subject) => typeof subject === 'string' && subject.startsWith('/');

const subjectsOf = (finding) => (Array.isArray(finding?.subjects) ? finding.subjects : []);

const shares = (left, right) => left.some((subject) => typeof subject === 'string' && right.includes(subject));

function ownedBy(entry) {
  const { route, paths } = entry ?? {};
  if (typeof route !== 'string' || route === '') throw new TypeError('entry.route must be the route of the entry');
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string'))
    throw new TypeError('entry.paths must be a list of repository paths');
  return new Set([route, ...paths]);
}

function outsideOf({ subjects, row, owned }) {
  const outside = subjects.filter((subject) => !owned.has(subject));
  const entryIsAmong = subjects.some((subject) => owned.has(subject));
  return row.shared === true && entryIsAmong ? outside.filter((subject) => !isRoute(subject)) : outside;
}

const hasPartner = ({ finding, findings, row }) =>
  findings.some((other) => other?.rule === row.needs && shares(subjectsOf(other), subjectsOf(finding)));

function verdictOf({ gate, finding, findings, owned }) {
  const row = rowOf({ gate, rule: finding?.rule });
  if (row === null)
    return { reason: 'unclassified-rule', why: `the table has no row for ${shown(gate)} ${shown(finding?.rule)}` };
  if (!row.repairable) return { reason: 'not-prose', why: row.why };
  if (row.needs !== undefined && !hasPartner({ finding, findings, row }))
    return {
      reason: 'not-prose',
      why: `${row.why} No ${row.needs} finding names the same text, so there is nothing to restate.`,
    };
  const subjects = subjectsOf(finding);
  if (subjects.length === 0) return { reason: 'unattributed', why: 'the gate could not say whose fault it is' };
  const outside = outsideOf({ subjects, row, owned });
  if (outside.length > 0)
    return { reason: 'outside-entry', why: `it names ${listed(outside)}, which the entry does not own` };
  return { row };
}

const textOf = (value) => (typeof value === 'string' ? value : '');

const acceptedItem = (gate, finding) => ({
  gate,
  rule: finding.rule,
  subjects: [...finding.subjects],
  detail: textOf(finding.detail),
  excerpt: textOf(finding.excerpt),
});

const refusedItem = (gate, finding, { reason, why }) => ({
  gate,
  rule: typeof finding?.rule === 'string' ? finding.rule : null,
  subjects: [...subjectsOf(finding)],
  detail: textOf(finding?.detail),
  excerpt: textOf(finding?.excerpt),
  reason,
  why,
});

function judgeDocument(document, owned, result) {
  const gate = typeof document?.gate === 'string' ? document.gate : null;
  if (!Array.isArray(document?.findings)) {
    result.refused.push(
      refusedItem(gate, null, { reason: 'unclassified-rule', why: 'the document does not hold a list of findings' })
    );
    return;
  }
  for (const finding of document.findings) {
    const verdict = verdictOf({ gate, finding, findings: document.findings, owned });
    if (verdict.row === undefined) result.refused.push(refusedItem(gate, finding, verdict));
    else result[verdict.row.how].push(acceptedItem(gate, finding));
  }
}

export function judgeFindings({ documents, entry }) {
  if (!Array.isArray(documents)) throw new TypeError('documents must be a list of { gate, findings }');
  const owned = ownedBy(entry);
  const result = { rewrite: [], restate: [], refused: [] };
  for (const document of documents) judgeDocument(document, owned, result);
  return result;
}
