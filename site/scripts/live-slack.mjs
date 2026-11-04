import { LIMITS, assemble, bold, context, cut, escapeText, fields, link, section, sections } from './slack-blocks.mjs';
import { countText } from './spend-report-text.mjs';
import { RULE, column, entryTables, figures, monthPart, reference } from './spend-slack.mjs';

export const ENTRIES_PER_MESSAGE = 3;

const MAX_SHOWN = 5;
const TITLE_LIMIT = 150;
const PROMPT_LIMIT = 300;
const NOTHING = { blocks: [], text: '' };
const PERSON = 'A person has something to do';
const SURFACE_HEADING = 'A surface of an entry that is live does not answer';
const SURFACE_ADVICE =
  'find out why the published build lacks what is named above. A later publish does not check an announced entry again.';
const PAGE_HEADING = 'An entry that merged is not reachable';
const PAGE_ADVICE =
  'find out why the page is not served. No entry named above is recorded as announced, so the next publish checks each one again and posts this warning again until its page answers.';

const oneLine = (text) => text.replace(/\s+/g, ' ').trim();
const plain = (text, limit) => escapeText(cut(oneLine(text), limit));
const utc = (instant) => `${instant.slice(0, 10)} ${instant.slice(11, 19)} UTC`;
const pathOf = (url) => new URL(url).pathname;
const sentenceCase = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const answeredPage = ({ page }) => page.probe.reachable;
const chunked = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, at) => list.slice(at * size, (at + 1) * size));

export const messageGroups = (entries) => chunked(entries, ENTRIES_PER_MESSAGE);

function requireEntries(what, entries) {
  if (!Array.isArray(entries) || entries.length < 1) throw new Error(`${what} needs at least one entry`);
}

const failureOf = ({ failure, attempts, checkedAt }) =>
  `${escapeText(oneLine(failure))} after ${countText(attempts, 'attempt', 'attempts')}, last checked ${utc(checkedAt)}`;

const refusedSurface = ({ url, probe }) =>
  `${escapeText(pathOf(url))} (${escapeText(oneLine(probe.failure))}, checked ${utc(probe.checkedAt)})`;

const shownSurface = (surface) =>
  surface.probe.reachable ? link(surface.url, pathOf(surface.url)) : refusedSurface(surface);

const surfaceColumn = (surface) => column(escapeText(sentenceCase(surface.label)), shownSurface(surface));
const surfaceLine = (surface) => `${escapeText(sentenceCase(surface.label))}: ${shownSurface(surface)}`;
const columnBlocks = (surfaces) => chunked(surfaces.map(surfaceColumn), LIMITS.fields).map(fields);

function entryPart(entry) {
  const { slug, format, title, prompt, page } = entry;
  const surfaces = [page, ...entry.surfaces];
  const quoted = `Buyer prompt ${prompt.number}: “${plain(prompt.text, PROMPT_LIMIT)}”`;
  const checked = `The page answered HTTP ${page.probe.status} on attempt ${page.probe.attempts}, checked ${utc(page.probe.checkedAt)}.`;
  return {
    blocks: [
      section(`${bold(plain(title, TITLE_LIMIT))}\n${format} \`${escapeText(slug)}\`\n_${quoted}_`),
      section(entryTables([entry], [format])),
      ...columnBlocks(surfaces),
      context(checked),
    ],
    text: [
      plain(title, TITLE_LIMIT),
      `${format} ${escapeText(slug)}`,
      quoted,
      figures(entry),
      ...surfaces.map(surfaceLine),
      checked,
    ].join('\n'),
  };
}

function warningPart({ heading, bullets, advice }) {
  const shown = bullets.slice(0, MAX_SHOWN);
  const rest = bullets.length - shown.length;
  const more = rest > 0 ? [`and ${rest} more`] : [];
  return {
    blocks: sections(
      [bold(heading), ...shown.map(({ block }) => `• ${block}`), ...more, `${PERSON}: ${advice}`].join('\n')
    ),
    text: [`${heading}. ${PERSON}.`, ...shown.map(({ line }) => line), ...more, sentenceCase(advice)].join('\n'),
  };
}

function surfaceWarning(entries) {
  const failed = entries.flatMap((entry) =>
    entry.surfaces.filter(({ probe }) => !probe.reachable).map((surface) => ({ entry, surface }))
  );
  if (failed.length === 0) return NOTHING;
  const bullets = failed.map(({ entry, surface: { label, url, probe } }) => {
    const said = `${escapeText(label)} ${escapeText(pathOf(url))}, ${failureOf(probe)}`;
    return { block: `\`${escapeText(entry.slug)}\`: ${said}`, line: `${escapeText(entry.slug)}: ${said}` };
  });
  return warningPart({ heading: SURFACE_HEADING, bullets, advice: SURFACE_ADVICE });
}

const footerPart = ({ run }) =>
  run === null || run === undefined
    ? NOTHING
    : { blocks: [context(`Workflow run ${reference(run)}`)], text: `Workflow run: ${reference(run)}` };

function headlinePart(entries) {
  const said = entries.length === 1 ? 'The entry is live' : `${entries.length} entries are live`;
  return { blocks: [section(bold(said))], text: `${said}.` };
}

export function liveMessage({ status, entries, links }) {
  requireEntries('a live message', entries);
  if (entries.length > ENTRIES_PER_MESSAGE)
    throw new Error(`a live message holds at most ${ENTRIES_PER_MESSAGE} entries, not ${entries.length}`);
  const silent = entries.find((entry) => !answeredPage(entry));
  if (silent) throw new Error(`${silent.slug} is not reachable, so it cannot be announced as live`);
  return assemble(
    monthPart(status),
    RULE,
    headlinePart(entries),
    ...entries.map(entryPart),
    surfaceWarning(entries),
    footerPart(links)
  );
}

function pageBullet({ slug, page }) {
  const address = link(page.url, page.url);
  const clause = failureOf(page.probe);
  return {
    block: `\`${escapeText(slug)}\`: ${address}, ${clause}`,
    line: `${escapeText(slug)}: ${address}, ${clause}`,
  };
}

const runColumn = ({ run }) =>
  run === null || run === undefined
    ? NOTHING
    : { blocks: [fields([column('Workflow run', reference(run))])], text: `Workflow run: ${reference(run)}` };

export function unreachableMessage({ status, entries, links }) {
  requireEntries('a warning', entries);
  const answered = entries.find(answeredPage);
  if (answered) throw new Error(`${answered.slug} answered, so it is not an entry that is unreachable`);
  return assemble(
    monthPart(status),
    RULE,
    warningPart({ heading: PAGE_HEADING, bullets: entries.map(pageBullet), advice: PAGE_ADVICE }),
    runColumn(links)
  );
}
