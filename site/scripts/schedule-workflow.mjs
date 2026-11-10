import { readEngineConfig } from './engine-config.mjs';

const { writeTimesUtc, catchUpAfterMinutes, cronLeadMinutes, stoppedRunRetriesPerDay } = readEngineConfig().loop;
export const WRITE_TIMES_UTC = writeTimesUtc;
export const CATCH_UP_AFTER_MINUTES = catchUpAfterMinutes;
export const CRON_LEAD_MINUTES = cronLeadMinutes;
export const STOPPED_RUN_RETRIES_PER_DAY = stoppedRunRetriesPerDay;
export const WRITE_DAILY_PATH = '.github/workflows/write-daily.yml';
export const REGENERATE_COMMAND = 'npm run assets:schedule';
export const SCHEDULE_COMMENT = `# written by ${REGENERATE_COMMAND} from loop.writeTimesUtc, loop.catchUpAfterMinutes and loop.cronLeadMinutes: each cron is set loop.cronLeadMinutes before the time it serves, listed in the order of those times, because GitHub starts a scheduled run late; give each cron a minute off the top of the hour, where scheduled runs queue`;

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

const MINUTES_IN_DAY = 1440;
const pad = (value) => String(value).padStart(2, '0');
const minuteOfDay = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clockOf = (minute) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
const wrapped = (minute) => ((minute % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
const clockBefore = (time, minutes) => clockOf(wrapped(minuteOfDay(time) - minutes));

export function cronPlan(times, catchUpMinutes = [], leadMinutes = 0) {
  return sortedTimes(times)
    .flatMap((slot) => [
      { time: slot, slot, delay: 0 },
      ...catchUpMinutes.map((delay) => ({
        time: clockOf((minuteOfDay(slot) + delay) % MINUTES_IN_DAY),
        slot,
        delay,
      })),
    ])
    .sort((first, second) => (first.time < second.time ? -1 : first.time > second.time ? 1 : 0))
    .map((entry) => ({ ...entry, cron: cronOf(clockBefore(entry.time, leadMinutes)) }));
}

export const scheduleLines = (times, catchUpMinutes = [], leadMinutes = 0) => [
  '  schedule:',
  `    ${SCHEDULE_COMMENT}`,
  ...cronPlan(times, catchUpMinutes, leadMinutes).map(({ cron }) => `    - cron: '${cron}'`),
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

export function withSchedule(text, times, catchUpMinutes = [], leadMinutes = 0) {
  const lines = text.split('\n');
  const triggers = triggersOf(lines);
  if (triggers === null) throw new Error(`${WRITE_DAILY_PATH} has no on: key, so there is nowhere to put the schedule`);
  const [first, ...others] = scheduleBlocks(lines, triggers);
  const generated = scheduleLines(times, catchUpMinutes, leadMinutes);
  for (const { start, end } of others.reverse()) lines.splice(start, end - start);
  if (first === undefined) lines.splice(triggers.start + 1, 0, ...generated);
  else lines.splice(first.start, first.end - first.start, ...generated);
  return lines.join('\n');
}

export const withLoopSchedule = (text, { writeTimesUtc, catchUpAfterMinutes, cronLeadMinutes }) =>
  withSchedule(text, writeTimesUtc, catchUpAfterMinutes, cronLeadMinutes);

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

const isCatchUp = ({ delay }) => delay > 0;

const givenBy = (entry) =>
  isCatchUp(entry)
    ? `loop.catchUpAfterMinutes gives "${entry.cron}" for ${entry.time} (${entry.delay} minutes after ${entry.slot})`
    : `loop.writeTimesUtc gives "${entry.cron}" for ${entry.time}`;

const lackOf = (entry) =>
  isCatchUp(entry)
    ? `no cron entry retries the ${entry.slot} slot ${entry.delay} minutes late (loop.catchUpAfterMinutes), which would be "${entry.cron}"`
    : `no cron entry runs the writer at ${entry.time} (loop.writeTimesUtc), which would be "${entry.cron}"`;

function cronFindings(entries, wanted) {
  const extra = unmatched(entries, wanted);
  const missing = unmatched(wanted, entries);
  const paired = Math.min(extra.length, missing.length);
  const differs = extra
    .slice(0, paired)
    .map(({ line, cron }, at) => finding('cron-differs', `line ${line} holds "${cron}", but ${givenBy(missing[at])}`));
  const surplus = extra
    .slice(paired)
    .map(({ line, cron }) =>
      finding(
        'cron-extra',
        `line ${line} holds "${cron}", which no time in loop.writeTimesUtc or loop.catchUpAfterMinutes produces`
      )
    );
  const lacking = missing.slice(paired).map((entry) => finding('cron-missing', lackOf(entry)));
  const reordered =
    extra.length === 0 && missing.length === 0 && entries.some(({ cron }, at) => cron !== wanted[at].cron)
      ? [
          finding(
            'cron-order',
            `the cron entries are not in ascending order of time; the configuration, sorted, gives ${wanted.map(({ time }) => time).join(', ')}`
          ),
        ]
      : [];
  return [...differs, ...surplus, ...lacking, ...reordered];
}

export function scheduleFindings(text, times, catchUpMinutes = [], leadMinutes = 0) {
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
  const wanted = cronPlan(times, catchUpMinutes, leadMinutes);
  const found = [...twice, ...cronFindings(entriesOf(lines, blocks[0]), wanted)];
  if (found.length === 0 && withSchedule(text, times, catchUpMinutes, leadMinutes) !== text) {
    return [
      finding(
        'schedule-block-differs',
        `the schedule block is not the text ${REGENERATE_COMMAND} writes (a comment, a quote or a key was changed by hand)`
      ),
    ];
  }
  return found;
}
