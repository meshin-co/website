import { MAX_REEXAMINED_PER_RUN } from './link-repair-reexamine.mjs';
import { MAX_ADDRESSES_PER_RUN } from './link-repair-sweep.mjs';
import { REGISTER_PATH } from './link-rot-register.mjs';
import { RUNS_BEFORE_DEAD, lapseEvidence } from './link-rot-watch.mjs';
import { BRANCH_PREFIX as WRITER_BRANCH_PREFIX } from './pr-classify.mjs';

export const BRANCH_PREFIX = `${WRITER_BRANCH_PREFIX}link-rot-`;
export const LISTED_PER_SECTION = 100;
export const PAGES_PER_UNPLACED_ROW = 5;
export const LAPSED_HOSTS_LISTED = 20;
export const MAX_BODY_LENGTH = 60_000;

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const branchFor = (today, attempt = 1) => `${BRANCH_PREFIX}${today}${attempt > 1 ? `-${attempt}` : ''}`;

export function summaryLine({ counts, pullRequest, note }) {
  const { dead, archive, search, unplaced, waiting, watching, restored, upgraded } = counts;
  const fields = `dead=${dead} archive=${archive} search=${search} unplaced=${unplaced} waiting=${waiting} watching=${watching} restored=${restored} upgraded=${upgraded}`;
  return `repair-links: ${fields} pr=${pullRequest ?? 'none'}${note ? ` (${note})` : ''}`;
}

export function pullRequestTitle({ today, counts }) {
  const { archive, search, unplaced, restored = 0, upgraded = 0 } = counts;
  const repair = archive + search > 0 ? [`repair ${plural(archive + search, 'dead citation')}`] : [];
  const fromSearch = [
    ...(restored > 0 ? [`restore ${plural(restored, 'citation')}`] : []),
    ...(upgraded > 0 ? [`move ${plural(upgraded, 'citation')} up`] : []),
  ];
  const clauses = fromSearch.length === 0 ? repair : [...repair, `${fromSearch.join(' and ')} from a search link`];
  if (clauses.length > 0) return `fix(links): ${clauses.join(', ')} (${today})`;
  return `chore(links): record ${plural(unplaced, 'dead address', 'dead addresses')} no entry can be repaired for (${today})`;
}

export const commitMessage = ({ today, counts }) => pullRequestTitle({ today, counts });

const LISTING_STEPS = [
  {
    archive: LISTED_PER_SECTION,
    search: LISTED_PER_SECTION,
    unplaced: LISTED_PER_SECTION,
    upgraded: LISTED_PER_SECTION,
    restored: LISTED_PER_SECTION,
    failures: LISTED_PER_SECTION,
  },
  { archive: 20, search: LISTED_PER_SECTION, unplaced: 20, upgraded: 20, restored: 20, failures: 20 },
  { archive: 5, search: 40, unplaced: 5, upgraded: 5, restored: 5, failures: 5 },
  { archive: 2, search: 10, unplaced: 2, upgraded: 2, restored: 2, failures: 2 },
];
const LISTING_NONE = { archive: 0, search: 0, unplaced: 0, upgraded: 0, restored: 0, failures: 0 };

const inRegister = (left) => `- ${left} more rows are in ${REGISTER_PATH}.`;
const inTheDiff = (left) => `- ${left} more citations are in the diff of this pull request.`;
const inTheLog = (left) => `- ${left} more are in the log of the run.`;

function listed(lines, limit, more) {
  const shown = lines.slice(0, limit);
  const left = lines.length - shown.length;
  return left > 0 ? [...shown, more(left)] : shown;
}

const repairLine = ({ entry, original, replacement, citedOn, why }) =>
  `- \`${entry}\`, cited ${citedOn}: ${original} became ${replacement} (${why})`;

const restoredLine = ({ entry, original, citedOn, firstSeenDead, why }) => {
  const since = firstSeenDead === null ? '' : `first seen dead ${firstSeenDead}; `;
  return `- \`${entry}\`, cited ${citedOn}: ${original} went back to the address that was cited (${since}${why})`;
};

function pagesOf(pages) {
  const shown = pages.slice(0, PAGES_PER_UNPLACED_ROW);
  const left = pages.length - shown.length;
  return left > 0 ? `${shown.join(', ')} and ${plural(left, 'more page')}` : shown.join(', ');
}

const unplacedLine = ({ original, pages, why }) => `- ${original}, on ${pagesOf(pages)}: ${why}`;

function section(heading, intro, lines, limit, more = inRegister) {
  return lines.length === 0 ? [] : [`## ${heading}`, '', intro, '', ...listed(lines, limit, more), ''];
}

function namedUpToCap(entries) {
  const shown = entries.slice(0, LISTED_PER_SECTION).map(({ entry }) => `\`${entry}\``);
  const left = entries.length - shown.length;
  return left > 0 ? `${shown.join(', ')} and ${left} more` : shown.join(', ');
}

function waitingLines({ waitingForCap, waitingForArchive, reexamineWaiting = [] }) {
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
  return [...cap, ...archive, ...searchWaitingLines(reexamineWaiting)];
}

function searchWaitingLines(waiting) {
  const one = waiting.length === 1;
  const entries = [...new Map(waiting.map((citation) => [citation.entry, citation])).values()];
  if (waiting.length === 0) return [];
  return [
    `- ${plural(waiting.length, 'citation that rests', 'citations that rest')} on a search link ${one ? 'was' : 'were'} left as ${one ? 'it is' : 'they are'} because the original address or the Internet Archive could not be asked, and the next run that reaches ${one ? 'it' : 'them'} asks again: ${namedUpToCap(entries)}.`,
  ];
}

const LAPSED_INTRO = `A name that did not resolve on ${RUNS_BEFORE_DEAD} consecutive scheduled runs, on ${RUNS_BEFORE_DEAD} different days, belongs to a lapsed or withdrawn domain and not a resolver having a bad moment, so every address on it counts as dead and went through the same repair as an address that answered "gone". Any other answer for the host starts the count again. A name only counts on a run in which at least one other host answered, so a runner whose network was down never adds to the count.`;

function lapsedLines(lapsed) {
  const shown = lapsed
    .slice(0, LAPSED_HOSTS_LISTED)
    .map(
      (lapse) =>
        `- ${lapseEvidence(lapse)}, so ${plural(lapse.addresses.length, 'address', 'addresses')} on it counted as dead.`
    );
  const left = lapsed.length - shown.length;
  return left > 0 ? [...shown, `- and ${plural(left, 'more host')} did not resolve either.`] : shown;
}

function reexaminedSentence(reexamined) {
  if (reexamined === null || reexamined.of === 0) return '';
  const { examined, of } = reexamined;
  const addresses = plural(of, 'original address', 'original addresses');
  return ` It also asked again about ${examined} of the ${addresses} that citations reach only through a search link, at most ${MAX_REEXAMINED_PER_RUN} a run, so each is reached over time.`;
}

function foundSentence({ checked, counts, lapsed, reexamined = null }) {
  const onLapsedHosts = lapsed.reduce((sum, { addresses }) => sum + addresses.length, 0);
  const gone = `${counts.dead - onLapsedHosts} answered "gone" (404 or 410) twice and never answered successfully.`;
  const hosts = lapsed.length === 1 ? 'a host whose name' : `${lapsed.length} hosts whose names`;
  const unresolved =
    onLapsedHosts === 0
      ? ''
      : ` ${onLapsedHosts} more ${onLapsedHosts === 1 ? 'is' : 'are'} on ${hosts} did not resolve on ${RUNS_BEFORE_DEAD} consecutive scheduled runs.`;
  return `The probe asked ${plural(checked, 'outbound address', 'outbound addresses')} in the build. ${gone}${unresolved}${reexaminedSentence(reexamined)}`;
}

const MOVED_UP_INTRO =
  'Each of these rested on a search link, and the Internet Archive now holds a capture that carries the source title, so the source row points at the capture nearest the day the source was cited, never the newest capture. The address that was cited stays in the row as `original`.';
const RESTORED_INTRO =
  'The original address of each of these answers again and carries the source title, so the row points at it again and the search link is gone. A page the machine cannot read, such as a PDF, is accepted unchecked and its line says so: read it.';
const FAILED_INTRO =
  'The machine examined each of these and could not read or rewrite the entry, so each stays on its search link and a person decides what to do.';

function render({ today, result, runUrl, limits }) {
  const { rows, lapsed, restored = [], upgraded = [], reexamineFailures = [] } = result;
  const of = (outcome) => rows.filter((row) => row.outcome === outcome);
  const waiting = waitingLines(result);
  return [
    `Link repair of ${today}.`,
    '',
    foundSentence(result),
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
      'Moved up from a search link to the Internet Archive',
      MOVED_UP_INTRO,
      upgraded.map(repairLine),
      limits.upgraded
    ),
    ...section(
      'Restored to the original address',
      RESTORED_INTRO,
      restored.map(restoredLine),
      limits.restored,
      inTheDiff
    ),
    ...section(
      'Left on a search link',
      FAILED_INTRO,
      reexamineFailures.map(({ message }) => `- ${message}`),
      limits.failures,
      inTheLog
    ),
    ...section(
      'Not placed',
      'These are recorded and not changed. A person must edit the page or template that links each one, or remove the link.',
      of('unplaced').map(unplacedLine),
      limits.unplaced
    ),
    ...(lapsed.length === 0
      ? []
      : ['## Hosts that no longer resolve', '', LAPSED_INTRO, '', ...lapsedLines(lapsed), '']),
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
