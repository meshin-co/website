import { MAX_ADDRESSES_PER_RUN } from './link-repair-sweep.mjs';
import { REGISTER_PATH } from './link-rot-register.mjs';
import { BRANCH_PREFIX as WRITER_BRANCH_PREFIX } from './pr-classify.mjs';

export const BRANCH_PREFIX = `${WRITER_BRANCH_PREFIX}link-rot-`;
export const LISTED_PER_SECTION = 100;
export const PAGES_PER_UNPLACED_ROW = 5;
export const MAX_BODY_LENGTH = 60_000;

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const branchFor = (today, attempt = 1) => `${BRANCH_PREFIX}${today}${attempt > 1 ? `-${attempt}` : ''}`;

export function summaryLine({ counts, pullRequest, note }) {
  const { dead, archive, search, unplaced, waiting } = counts;
  const fields = `dead=${dead} archive=${archive} search=${search} unplaced=${unplaced} waiting=${waiting}`;
  return `repair-links: ${fields} pr=${pullRequest ?? 'none'}${note ? ` (${note})` : ''}`;
}

export function pullRequestTitle({ today, counts }) {
  const repaired = counts.archive + counts.search;
  if (repaired > 0) return `fix(links): repair ${plural(repaired, 'dead citation')} (${today})`;
  return `chore(links): record ${plural(counts.unplaced, 'dead address', 'dead addresses')} no entry can be repaired for (${today})`;
}

export const commitMessage = ({ today, counts }) => pullRequestTitle({ today, counts });

const LISTING_STEPS = [
  { archive: LISTED_PER_SECTION, search: LISTED_PER_SECTION, unplaced: LISTED_PER_SECTION },
  { archive: 20, search: LISTED_PER_SECTION, unplaced: 20 },
  { archive: 5, search: 40, unplaced: 5 },
  { archive: 2, search: 10, unplaced: 2 },
];
const LISTING_NONE = { archive: 0, search: 0, unplaced: 0 };

function listed(lines, limit) {
  const shown = lines.slice(0, limit);
  const left = lines.length - shown.length;
  return left > 0 ? [...shown, `- ${left} more rows are in ${REGISTER_PATH}.`] : shown;
}

const repairLine = ({ entry, original, replacement, citedOn, why }) =>
  `- \`${entry}\`, cited ${citedOn}: ${original} became ${replacement} (${why})`;

function pagesOf(pages) {
  const shown = pages.slice(0, PAGES_PER_UNPLACED_ROW);
  const left = pages.length - shown.length;
  return left > 0 ? `${shown.join(', ')} and ${plural(left, 'more page')}` : shown.join(', ');
}

const unplacedLine = ({ original, pages, why }) => `- ${original}, on ${pagesOf(pages)}: ${why}`;

function section(heading, intro, lines, limit) {
  return lines.length === 0 ? [] : [`## ${heading}`, '', intro, '', ...listed(lines, limit), ''];
}

function namedUpToCap(entries) {
  const shown = entries.slice(0, LISTED_PER_SECTION).map(({ entry }) => `\`${entry}\``);
  const left = entries.length - shown.length;
  return left > 0 ? `${shown.join(', ')} and ${left} more` : shown.join(', ');
}

function waitingLines({ waitingForCap, waitingForArchive }) {
  const cap =
    waitingForCap.length === 0
      ? []
      : [
          `- The job acts on at most ${MAX_ADDRESSES_PER_RUN} addresses per run, so ${plural(waitingForCap.length, 'more dead address', 'more dead addresses')} wait for the next run.`,
        ];
  const archive =
    waitingForArchive.length === 0
      ? []
      : [
          `- ${plural(waitingForArchive.length, 'citation was', 'citations were')} left as ${waitingForArchive.length === 1 ? 'it is' : 'they are'} because the Internet Archive did not answer, and the next run asks again: ${namedUpToCap(waitingForArchive)}.`,
        ];
  return [...cap, ...archive];
}

function render({ today, result, runUrl, limits }) {
  const { rows, checked, counts } = result;
  const of = (outcome) => rows.filter((row) => row.outcome === outcome);
  const waiting = waitingLines(result);
  return [
    `Link repair of ${today}.`,
    '',
    `The probe asked ${plural(checked, 'outbound address', 'outbound addresses')} in the build. ${counts.dead} answered "gone" (404 or 410) twice and never answered successfully.`,
    '',
    ...section(
      'Repaired from the Internet Archive',
      'Each source row now points at the capture nearest the day the source was cited, never the newest capture, because the newest capture of a replaced page is a different document. The address that was cited stays in the row as `original`.',
      of('archive').map(repairLine),
      limits.archive
    ),
    ...section(
      'Resting on a search link',
      'A search page is not a source, and the claim beside it can no longer be checked against the page it cites. The rendered citation says the original page has gone. Read each one and decide whether the claim stays, changes or goes; the machine never edits prose.',
      of('search').map(repairLine),
      limits.search
    ),
    ...section(
      'Not placed',
      'These are recorded and not changed. A person must edit the page or template that links each one, or remove the link.',
      of('unplaced').map(unplacedLine),
      limits.unplaced
    ),
    ...(waiting.length === 0 ? [] : ['## Waiting', '', ...waiting, '']),
    `Only the address changed in each entry; no prose was edited, and a table that a longer address widened is re-aligned by Prettier, so its diff shows padding. \`${REGISTER_PATH}\` records every row and is generated by the job, so never edit it by hand: \`npm run gate:links\` fails on a hand edit.`,
    ...(runUrl ? ['', `Run: ${runUrl}`] : []),
    '',
  ].join('\n');
}

export function pullRequestBody(input) {
  for (const limits of LISTING_STEPS) {
    const body = render({ ...input, limits });
    if (body.length <= MAX_BODY_LENGTH) return body;
  }
  return render({ ...input, limits: LISTING_NONE });
}
