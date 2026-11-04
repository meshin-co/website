import { readEngineConfig } from './engine-config.mjs';

export const WRITE_TIMES_UTC = readEngineConfig().loop.writeTimesUtc;
export const WRITE_DAILY_PATH = '.github/workflows/write-daily.yml';
export const REGENERATE_COMMAND = 'npm run assets:schedule';
export const SCHEDULE_COMMENT = `# written by ${REGENERATE_COMMAND} from loop.writeTimesUtc; give each time a minute off the top of the hour, where scheduled runs queue`;

const ON_KEY = /^on:\s*$/;
const TOP_LEVEL = /^[^\s#]/;
const SCHEDULE_KEY = /^ {2}schedule:/;
const SIBLING = /^ {0,2}\S/;
const CRON_ENTRY = /^\s*-\s*cron:\s*(['"]?)(.*?)\1\s*$/;
const BLANK = /^\s*$/;

export const sortedTimes = (times) => [...times].sort();

export function cronOf(time) {
  const [hour, minute] = time.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

export const scheduleLines = (times) => [
  '  schedule:',
  `    ${SCHEDULE_COMMENT}`,
  ...sortedTimes(times).map((time) => `    - cron: '${cronOf(time)}'`),
];

function triggersOf(lines) {
  const start = lines.findIndex((line) => ON_KEY.test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1).findIndex((line) => TOP_LEVEL.test(line));
  return { start, end: rest === -1 ? lines.length : start + 1 + rest };
}

function blockEnd(lines, from, limit) {
  let end = from + 1;
  while (end < limit && !SIBLING.test(lines[end])) end += 1;
  while (end > from + 1 && BLANK.test(lines[end - 1])) end -= 1;
  return end;
}

function scheduleBlocks(lines, triggers) {
  const blocks = [];
  for (let at = triggers.start + 1; at < triggers.end; at += 1) {
    if (!SCHEDULE_KEY.test(lines[at])) continue;
    const end = blockEnd(lines, at, triggers.end);
    blocks.push({ start: at, end });
    at = end - 1;
  }
  return blocks;
}

export function withSchedule(text, times) {
  const lines = text.split('\n');
  const triggers = triggersOf(lines);
  if (triggers === null) throw new Error(`${WRITE_DAILY_PATH} has no on: key, so there is nowhere to put the schedule`);
  const [first, ...others] = scheduleBlocks(lines, triggers);
  const generated = scheduleLines(times);
  for (const { start, end } of others.reverse()) lines.splice(start, end - start);
  if (first === undefined) lines.splice(triggers.start + 1, 0, ...generated);
  else lines.splice(first.start, first.end - first.start, ...generated);
  return lines.join('\n');
}

const finding = (rule, detail) => ({
  rule,
  detail: `${detail}; run ${REGENERATE_COMMAND} to write it again from loop.writeTimesUtc`,
});

const noun = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function entriesOf(lines, { start, end }) {
  return lines
    .slice(start + 1, end)
    .map((text, at) => ({ line: start + at + 2, cron: CRON_ENTRY.exec(text)?.[2] }))
    .filter(({ cron }) => cron !== undefined);
}

function withoutOne(list, value) {
  const at = list.findIndex((candidate) => candidate.cron === value);
  return at === -1 ? list : [...list.slice(0, at), ...list.slice(at + 1)];
}

function unmatched(from, against) {
  return against.reduce((left, { cron }) => withoutOne(left, cron), from);
}

function cronFindings(entries, times) {
  const wanted = sortedTimes(times).map((time) => ({ time, cron: cronOf(time) }));
  const extra = unmatched(entries, wanted);
  const missing = unmatched(wanted, entries);
  const paired = Math.min(extra.length, missing.length);
  const differs = extra
    .slice(0, paired)
    .map(({ line, cron }, at) =>
      finding(
        'cron-differs',
        `line ${line} holds "${cron}", but loop.writeTimesUtc gives "${missing[at].cron}" for ${missing[at].time}`
      )
    );
  const surplus = extra
    .slice(paired)
    .map(({ line, cron }) =>
      finding('cron-extra', `line ${line} holds "${cron}", which no time in loop.writeTimesUtc produces`)
    );
  const lacking = missing
    .slice(paired)
    .map(({ time, cron }) =>
      finding('cron-missing', `no cron entry runs the writer at ${time} (loop.writeTimesUtc), which would be "${cron}"`)
    );
  const reordered =
    extra.length === 0 && missing.length === 0 && entries.some(({ cron }, at) => cron !== wanted[at].cron)
      ? [
          finding(
            'cron-order',
            `the cron entries are not in ascending order of time; loop.writeTimesUtc sorted is ${wanted.map(({ time }) => time).join(', ')}`
          ),
        ]
      : [];
  return [...differs, ...surplus, ...lacking, ...reordered];
}

export function scheduleFindings(text, times) {
  const lines = text.split('\n');
  const triggers = triggersOf(lines);
  const blocks = triggers === null ? [] : scheduleBlocks(lines, triggers);
  if (blocks.length === 0) {
    const listed = sortedTimes(times).join(', ');
    return [
      finding(
        'schedule-missing',
        `the workflow has no schedule: key under on:, so it never starts on its own; loop.writeTimesUtc lists ${noun(times.length, 'time')} (${listed})`
      ),
    ];
  }
  const twice =
    blocks.length > 1
      ? [
          finding(
            'schedule-twice',
            `schedule: appears ${blocks.length} times under on: (lines ${blocks.map(({ start }) => start + 1).join(', ')}); the workflow carries a schedule nothing generated`
          ),
        ]
      : [];
  const found = [...twice, ...cronFindings(entriesOf(lines, blocks[0]), times)];
  if (found.length === 0 && withSchedule(text, times) !== text) {
    return [
      finding(
        'schedule-block-differs',
        `the schedule block is not the text ${REGENERATE_COMMAND} writes (a comment, a quote or a key was changed by hand)`
      ),
    ];
  }
  return found;
}
