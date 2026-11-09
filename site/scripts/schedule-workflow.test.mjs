import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

import { readEngineConfig } from './engine-config.mjs';
import {
  CATCH_UP_AFTER_MINUTES,
  REGENERATE_COMMAND,
  SCHEDULE_COMMENT,
  WRITE_DAILY_PATH,
  WRITE_TIMES_UTC,
  cronOf,
  cronPlan,
  scheduleFindings,
  scheduleLines,
  sortedTimes,
  withSchedule,
} from './schedule-workflow.mjs';
import { slotStanding } from './slot-standing.mjs';

const REPOSITORY = resolve(import.meta.dirname, '..', '..');
const COMMITTED = readFileSync(resolve(REPOSITORY, WRITE_DAILY_PATH), 'utf8');
const TIMES = ['03:17', '15:17'];

const cronEntries = (...entries) => entries.map((cron) => `    - cron: '${cron}'`);

const workflowOf = (...scheduleBlocks) =>
  [
    'name: Sample',
    '',
    'on:',
    ...scheduleBlocks.flat(),
    '  workflow_dispatch:',
    '',
    'concurrency:',
    '  group: sample',
    '',
  ].join('\n');

const blockOf = (...entries) => ['  schedule:', `    ${SCHEDULE_COMMENT}`, ...cronEntries(...entries)];
const GENERATED = workflowOf(blockOf('17 3 * * *', '17 15 * * *'));
const rulesOf = (text, times = TIMES, delays = []) => scheduleFindings(text, times, delays).map(({ rule }) => rule);

const CATCH_UP = [120, 240];
const CAUGHT = ['17 3 * * *', '17 5 * * *', '17 7 * * *', '17 15 * * *', '17 17 * * *', '17 19 * * *'];
const WITH_CATCH_UP = workflowOf(blockOf(...CAUGHT));

test('the committed workflow holds one cron entry per configured time and one per time and delay of catch-up, each set the configured lead before the time it serves, in the order of those times, and nothing else is scheduled', () => {
  const { writeTimesUtc: configured, catchUpAfterMinutes: delays, cronLeadMinutes: lead } = readEngineConfig().loop;
  const minutes = [...configured].flatMap((time) => {
    const [hour, minute] = time.split(':').map(Number);
    return [0, ...delays].map((delay) => hour * 60 + minute + delay);
  });
  const wanted = minutes
    .sort((first, second) => first - second)
    .map((total) => (total - lead + 1440) % 1440)
    .map((total) => ({ cron: `${total % 60} ${Math.floor(total / 60)} * * *` }));
  assert.equal(wanted.length, configured.length * (1 + delays.length));
  assert.deepEqual(parse(COMMITTED).on.schedule, wanted);
  assert.equal(withSchedule(COMMITTED, configured, delays, lead), COMMITTED);
  assert.deepEqual(scheduleFindings(COMMITTED, configured, delays, lead), []);
});

test('the delays the catch-up crons are generated from are the loop.catchUpAfterMinutes of the engine configuration, and cannot be changed', () => {
  assert.deepEqual(CATCH_UP_AFTER_MINUTES, readEngineConfig().loop.catchUpAfterMinutes);
  assert.throws(() => CATCH_UP_AFTER_MINUTES.push(30), TypeError);
});

test('every write time brings one catch-up entry for each delay, written into the same ascending block', () => {
  assert.deepEqual(scheduleLines(['15:17', '03:17'], CATCH_UP), blockOf(...CAUGHT));
  assert.deepEqual(scheduleLines(TIMES, []), blockOf('17 3 * * *', '17 15 * * *'));
});

test('a generated workflow with catch-up is valid YAML that GitHub reads as the write crons and the catch-up crons', () => {
  const loaded = parse(withSchedule(workflowOf(blockOf('1 1 * * *')), TIMES, CATCH_UP));
  assert.deepEqual(
    loaded.on.schedule,
    CAUGHT.map((cron) => ({ cron }))
  );
});

test('a workflow generated before catch-up existed is behind the configuration, and the gate names the four crons it lacks', () => {
  assert.deepEqual(rulesOf(GENERATED, TIMES, CATCH_UP), [
    'cron-missing',
    'cron-missing',
    'cron-missing',
    'cron-missing',
  ]);
  assert.equal(withSchedule(GENERATED, TIMES, CATCH_UP), WITH_CATCH_UP);
});

test('a catch-up cron moved by hand is named as differing, and the finding says which slot it retries', () => {
  const [found, ...others] = scheduleFindings(WITH_CATCH_UP.replace("'17 5 * * *'", "'17 6 * * *'"), TIMES, CATCH_UP);
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'cron-differs');
  assert.match(
    found.detail,
    /^line 7 holds "17 6 \* \* \*", but loop\.catchUpAfterMinutes gives "17 5 \* \* \*" for 05:17 \(120 minutes after 03:17\);/
  );
});

test('a catch-up cron deleted by hand is named as missing, with the slot and delay it served', () => {
  const [found, ...others] = scheduleFindings(WITH_CATCH_UP.replace("    - cron: '17 19 * * *'", ''), TIMES, CATCH_UP);
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'cron-missing');
  assert.match(
    found.detail,
    /^no cron entry retries the 15:17 slot 240 minutes late \(loop\.catchUpAfterMinutes\), which would be "17 19 \* \* \*";/
  );
});

test('a cron that neither a write time nor a catch-up produces is extra, so a hand-written attempt cannot hide among the generated ones', () => {
  const [found, ...others] = scheduleFindings(
    WITH_CATCH_UP.replace("    - cron: '17 19 * * *'", "    - cron: '17 19 * * *'\n    - cron: '47 21 * * *'"),
    TIMES,
    CATCH_UP
  );
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'cron-extra');
  assert.match(found.detail, /which no time in loop\.writeTimesUtc or loop\.catchUpAfterMinutes produces;/);
});

test('a configuration with the catch-ups turned off makes every committed catch-up cron extra', () => {
  assert.deepEqual(rulesOf(WITH_CATCH_UP, TIMES, []), ['cron-extra', 'cron-extra', 'cron-extra', 'cron-extra']);
});

test('the times the schedule is generated from are the loop.writeTimesUtc of the engine configuration, and cannot be changed', () => {
  assert.deepEqual(WRITE_TIMES_UTC, readEngineConfig().loop.writeTimesUtc);
  assert.throws(() => WRITE_TIMES_UTC.push('01:01'), TypeError);
});

test('the workflow path is the one the daily run lives at, relative to the repository root', () => {
  assert.equal(WRITE_DAILY_PATH, '.github/workflows/write-daily.yml');
  assert.equal(REGENERATE_COMMAND, 'npm run assets:schedule');
});

for (const [time, cron] of [
  ['03:17', '17 3 * * *'],
  ['15:17', '17 15 * * *'],
  ['00:00', '0 0 * * *'],
  ['09:05', '5 9 * * *'],
  ['23:59', '59 23 * * *'],
]) {
  test(`${time} UTC becomes the cron expression ${cron}, which GitHub reads in UTC with no zone conversion`, () => {
    assert.equal(cronOf(time), cron);
  });
}

test('times sort ascending as clock times and the input list is left as it was', () => {
  const input = ['15:17', '03:17', '09:05', '00:00'];
  assert.deepEqual(sortedTimes(input), ['00:00', '03:17', '09:05', '15:17']);
  assert.deepEqual(input, ['15:17', '03:17', '09:05', '00:00']);
});

test('the generated block is one comment naming its source and its generator, then one cron entry per time', () => {
  assert.equal(SCHEDULE_COMMENT.startsWith('# '), true);
  assert.match(SCHEDULE_COMMENT, /loop\.writeTimesUtc/);
  assert.match(SCHEDULE_COMMENT, /npm run assets:schedule/);
  assert.match(SCHEDULE_COMMENT, /loop\.cronLeadMinutes/);
  assert.match(SCHEDULE_COMMENT, /off the top of the hour/);
  assert.deepEqual(scheduleLines(['15:17', '03:17']), blockOf('17 3 * * *', '17 15 * * *'));
  assert.equal(scheduleLines(TIMES).filter((line) => line.trim().startsWith('#')).length, 1);
});

test('a generated workflow is valid YAML that GitHub reads as the configured crons plus a manual trigger', () => {
  const loaded = parse(withSchedule(workflowOf(blockOf('1 1 * * *')), ['05:30', '17:45', '00:10']));
  assert.deepEqual(loaded.on.schedule, [{ cron: '10 0 * * *' }, { cron: '30 5 * * *' }, { cron: '45 17 * * *' }]);
  assert.deepEqual(Object.keys(loaded.on), ['schedule', 'workflow_dispatch']);
});

test('only the schedule block is replaced: every byte before and after it is the text that was committed', () => {
  const outdated = workflowOf(['  schedule:', "    # first owner's time zone", "    - cron: '5 4 * * *'"]);
  const regenerated = withSchedule(outdated, TIMES);
  assert.equal(regenerated, GENERATED);
  const [before, after] = outdated.split(/ {2}schedule:[^]*?(?= {2}workflow_dispatch:)/);
  assert.ok(regenerated.startsWith(before));
  assert.ok(regenerated.endsWith(after));
});

test('regenerating twice gives the same text as regenerating once', () => {
  const once = withSchedule(workflowOf(blockOf('1 1 * * *')), TIMES);
  assert.equal(withSchedule(once, TIMES), once);
});

test('a workflow with no schedule block gets one directly under on:, before the other triggers', () => {
  assert.equal(withSchedule(workflowOf(), TIMES), GENERATED);
});

test('a schedule written twice is collapsed into the one generated block', () => {
  const doubled = workflowOf(blockOf('17 3 * * *', '17 15 * * *'), blockOf('0 6 * * 1'));
  assert.equal(withSchedule(doubled, TIMES), GENERATED);
});

test('a workflow with no on: key has nowhere to put the schedule, so it is refused and not guessed at', () => {
  assert.throws(() => withSchedule('name: Sample\n\njobs: {}\n', TIMES), /no on: key/);
});

test('triggers that follow the schedule, and comments at the margin of on:, are carried over unchanged', () => {
  const outdated = [
    'name: Sample',
    'on:',
    '  schedule:',
    "    - cron: '5 4 * * *'",
    '  push:',
    '    branches: [main]',
    '# a note at the margin',
    'jobs:',
    '  schedule: not-a-trigger',
    '',
  ].join('\n');
  const regenerated = withSchedule(outdated, TIMES);
  assert.ok(
    regenerated.includes('  push:\n    branches: [main]\n# a note at the margin\njobs:\n  schedule: not-a-trigger\n')
  );
  assert.deepEqual(parse(regenerated).on.schedule, [{ cron: '17 3 * * *' }, { cron: '17 15 * * *' }]);
});

test('a configured schedule of one time is one cron entry', () => {
  assert.deepEqual(parse(withSchedule(GENERATED, ['04:44'])).on.schedule, [{ cron: '44 4 * * *' }]);
});

const replacing = (from, to) => (text) => text.replace(from, to);

const DRIFTS = [
  ['a cron line edited by hand', replacing("'17 3 * * *'", "'17 4 * * *'"), ['cron-differs']],
  ['a cron line edited to another minute', replacing("'17 15 * * *'", "'0 15 * * *'"), ['cron-differs']],
  [
    'an extra cron entry',
    replacing("    - cron: '17 15 * * *'", "    - cron: '17 15 * * *'\n    - cron: '17 21 * * *'"),
    ['cron-extra'],
  ],
  ['a cron entry removed', replacing("    - cron: '17 15 * * *'\n", ''), ['cron-missing']],
  [
    'the entries in the wrong order',
    replacing(
      "    - cron: '17 3 * * *'\n    - cron: '17 15 * * *'",
      "    - cron: '17 15 * * *'\n    - cron: '17 3 * * *'"
    ),
    ['cron-order'],
  ],
  ['no schedule block', () => workflowOf(), ['schedule-missing']],
  [
    'the schedule block present twice',
    () => workflowOf(blockOf('17 3 * * *', '17 15 * * *'), blockOf('0 6 * * 1')),
    ['schedule-twice'],
  ],
  ['the generated comment removed', replacing(`    ${SCHEDULE_COMMENT}\n`, ''), ['schedule-block-differs']],
  ['a cron entry written with double quotes', replacing("'17 3 * * *'", '"17 3 * * *"'), ['schedule-block-differs']],
  [
    'an extra key inside the block',
    replacing("    - cron: '17 15 * * *'", "    - cron: '17 15 * * *'\n    timezone: UTC"),
    ['schedule-block-differs'],
  ],
];

for (const [label, drift, rules] of DRIFTS) {
  test(`${label} is named as ${rules.join(' and ')}, and regenerating puts the generated text back`, () => {
    const drifted = drift(GENERATED);
    assert.notEqual(drifted, GENERATED);
    assert.deepEqual(rulesOf(drifted), rules);
    assert.equal(withSchedule(drifted, TIMES), GENERATED);
  });

  test(`${label} is reported with the command that fixes it`, () => {
    const found = scheduleFindings(drift(GENERATED), TIMES);
    assert.ok(found.length > 0);
    for (const { detail } of found) assert.match(detail, /run npm run assets:schedule/);
  });
}

test('a hand-edited cron line is named with its line, what it holds, what the configuration gives and for which time', () => {
  const [found, ...others] = scheduleFindings(GENERATED.replace("'17 3 * * *'", "'17 4 * * *'"), TIMES);
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'cron-differs');
  assert.match(found.detail, /^line 6 holds "17 4 \* \* \*", but loop\.writeTimesUtc gives "17 3 \* \* \*" for 03:17;/);
});

test('a configured time with no cron entry is named with the entry it needs', () => {
  const [found] = scheduleFindings(workflowOf(blockOf('17 3 * * *')), TIMES);
  assert.equal(found.rule, 'cron-missing');
  assert.match(
    found.detail,
    /^no cron entry runs the writer at 15:17 \(loop\.writeTimesUtc\), which would be "17 15 \* \* \*";/
  );
});

test('a cron entry with no configured time is named with its line', () => {
  const [found] = scheduleFindings(workflowOf(blockOf('17 3 * * *', '17 15 * * *', '0 22 * * *')), TIMES);
  assert.equal(found.rule, 'cron-extra');
  assert.match(
    found.detail,
    /^line 8 holds "0 22 \* \* \*", which no time in loop\.writeTimesUtc or loop\.catchUpAfterMinutes produces;/
  );
});

test('a hand edit to several lines at once is named once for each line, never as one vague difference', () => {
  const drifted = GENERATED.replace("'17 3 * * *'", "'17 4 * * *'").replace("'17 15 * * *'", "'17 16 * * *'");
  assert.deepEqual(rulesOf(drifted), ['cron-differs', 'cron-differs']);
});

test('a schedule that is right for other times is wrong for these, so a changed configuration is caught', () => {
  assert.deepEqual(rulesOf(GENERATED, ['03:17']), ['cron-extra']);
  assert.deepEqual(rulesOf(GENERATED, ['03:17', '15:17', '21:17']), ['cron-missing']);
  assert.deepEqual(rulesOf(GENERATED, ['04:17', '15:17']), ['cron-differs']);
});

test('a workflow with no on: key has no schedule, and the gate says so and does not crash', () => {
  assert.deepEqual(rulesOf('name: Sample\n\njobs: {}\n'), ['schedule-missing']);
});

test('an unsorted configuration is checked against the sorted schedule, so the order of the list never matters', () => {
  assert.deepEqual(scheduleFindings(GENERATED, ['15:17', '03:17']), []);
});

const WANTED = ['06:00', '15:00'];
const DELAYS = [120, 240];
const SHIPPED_DELAYS = [30, 120, 240];
const LEAD = 440;
const AT_LEAD = [
  { time: '06:00', slot: '06:00', delay: 0, cron: '40 22 * * *' },
  { time: '08:00', slot: '06:00', delay: 120, cron: '40 0 * * *' },
  { time: '10:00', slot: '06:00', delay: 240, cron: '40 2 * * *' },
  { time: '15:00', slot: '15:00', delay: 0, cron: '40 7 * * *' },
  { time: '17:00', slot: '15:00', delay: 120, cron: '40 9 * * *' },
  { time: '19:00', slot: '15:00', delay: 240, cron: '40 11 * * *' },
];

const LED = workflowOf(blockOf(...AT_LEAD.map(({ cron }) => cron)));
const findingsAt = (text, lead = LEAD) => scheduleFindings(text, WANTED, DELAYS, lead);
const rulesIn = (findings) => findings.map(({ rule }) => rule);
const cronsOf = (lead) => cronPlan(WANTED, DELAYS, lead).map(({ cron }) => cron);

test('a lead sets every cron that many minutes before the time it serves, and wraps across midnight to the evening before', () => {
  assert.deepEqual(cronPlan(WANTED, DELAYS, LEAD), AT_LEAD);
});

test('a lead of 0 leaves every cron at the time it serves, and so does leaving the lead out', () => {
  const atTheirTimes = ['0 6 * * *', '0 8 * * *', '0 10 * * *', '0 15 * * *', '0 17 * * *', '0 19 * * *'];
  assert.deepEqual(cronsOf(0), atTheirTimes);
  assert.deepEqual(cronPlan(WANTED, DELAYS), cronPlan(WANTED, DELAYS, 0));
});

for (const [time, lead, cron] of [
  ['06:00', 440, '40 22 * * *'],
  ['00:10', 30, '40 23 * * *'],
  ['00:00', 1, '59 23 * * *'],
  ['07:20', 440, '0 0 * * *'],
  ['03:17', 1439, '18 3 * * *'],
  ['23:59', 1439, '0 0 * * *'],
  ['12:00', 0, '0 12 * * *'],
]) {
  test(`${time} UTC with a lead of ${lead} minutes becomes the cron expression ${cron}, and its time, slot and delay stay as they were`, () => {
    assert.deepEqual(cronPlan([time], [], lead), [{ time, slot: time, delay: 0, cron }]);
  });
}

test('the catch-up entries take the same lead as the entries of the times themselves', () => {
  const retries = cronPlan(WANTED, DELAYS, LEAD).filter(({ delay }) => delay > 0);
  assert.deepEqual(
    retries.map(({ time, cron }) => [time, cron]),
    [
      ['08:00', '40 0 * * *'],
      ['10:00', '40 2 * * *'],
      ['17:00', '40 9 * * *'],
      ['19:00', '40 11 * * *'],
    ]
  );
});

test('the lead changes only the cron of an entry: its time, slot and delay are what the findings quote and the slot decision measures against', () => {
  const quoted = (lead) => cronPlan(WANTED, DELAYS, lead).map(({ time, slot, delay }) => ({ time, slot, delay }));
  for (const lead of [1, 20, LEAD, 1439]) assert.deepEqual(quoted(lead), quoted(0), `lead ${lead}`);
});

test('with a lead the entries are listed in the order of the times they serve, so the entry that wraps to the evening before comes first', () => {
  assert.deepEqual(scheduleLines(['15:00', '06:00'], [], LEAD), blockOf('40 22 * * *', '40 7 * * *'));
});

test('a generated workflow with a lead is valid YAML that GitHub reads as the shifted crons', () => {
  const loaded = parse(withSchedule(workflowOf(blockOf('1 1 * * *')), WANTED, DELAYS, LEAD));
  assert.deepEqual(
    loaded.on.schedule,
    AT_LEAD.map(({ cron }) => ({ cron }))
  );
  assert.equal(withSchedule(LED, WANTED, DELAYS, LEAD), LED);
});

test('a workflow generated with the lead passes, and one generated without it or with another lead is behind the configuration', () => {
  assert.deepEqual(findingsAt(LED), []);
  const unled = workflowOf(blockOf(...cronsOf(0)));
  assert.deepEqual(rulesIn(findingsAt(unled)), Array(6).fill('cron-differs'));
  assert.deepEqual(rulesIn(findingsAt(LED, 0)), Array(6).fill('cron-differs'));
  assert.deepEqual(rulesIn(findingsAt(LED, LEAD - 1)), Array(6).fill('cron-differs'));
  assert.equal(withSchedule(unled, WANTED, DELAYS, LEAD), LED);
});

test('a cron moved by hand is named with the time and the slot it serves, in the words it has without a lead', () => {
  const [found, ...others] = findingsAt(LED.replace("'40 0 * * *'", "'40 1 * * *'"));
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'cron-differs');
  assert.equal(
    found.detail,
    'line 7 holds "40 1 * * *", but loop.catchUpAfterMinutes gives "40 0 * * *" for 08:00 (120 minutes after 06:00); run npm run assets:schedule to write it again from loop.writeTimesUtc'
  );
});

test('a cron missing from a workflow with a lead is named with the time it serves and not the clock it fires at', () => {
  const [found, ...others] = findingsAt(LED.replace("    - cron: '40 22 * * *'\n", ''));
  assert.deepEqual(others, []);
  assert.equal(found.rule, 'cron-missing');
  assert.equal(
    found.detail,
    'no cron entry runs the writer at 06:00 (loop.writeTimesUtc), which would be "40 22 * * *"; run npm run assets:schedule to write it again from loop.writeTimesUtc'
  );
});

test('entries in the order of their own clock are out of order, because the order is the one of the times they serve', () => {
  const byClock = workflowOf(
    blockOf('40 0 * * *', '40 2 * * *', '40 7 * * *', '40 9 * * *', '40 11 * * *', '40 22 * * *')
  );
  assert.deepEqual(rulesIn(findingsAt(byClock)), ['cron-order']);
  assert.equal(withSchedule(byClock, WANTED, DELAYS, LEAD), LED);
});

const MINUTE_MS = 60_000;
const DAY_MS = 1440 * MINUTE_MS;
const FIRST_DAY = Date.UTC(2026, 10, 2);
const DAYS = 5;

function startsAfterLag(lead, lag) {
  const instants = [];
  for (let day = -1; day < DAYS; day += 1) {
    for (const { cron } of cronPlan(WANTED, SHIPPED_DELAYS, lead)) {
      const [minute, hour] = cron.split(' ').map(Number);
      instants.push(FIRST_DAY + day * DAY_MS + (hour * 60 + minute + lag) * MINUTE_MS);
    }
  }
  return instants.sort((first, second) => first - second);
}

function writtenAt(instants) {
  const claims = [];
  for (const instant of instants) {
    const now = new Date(instant);
    if (!slotStanding({ times: WANTED, catchUpMinutes: SHIPPED_DELAYS, claims, now }).due) continue;
    const claim = {
      slug: `entry-${claims.length}`,
      format: 'article',
      status: 'written',
      claimedAt: now.toISOString(),
    };
    claims.push({ claim });
  }
  return claims.map(({ claim }) => claim.claimedAt);
}

const dayOf = (day) => new Date(FIRST_DAY + day * DAY_MS).toISOString().slice(0, 10);

for (const lag of [0, 417, 440, 458, 461]) {
  test(`runs that all start ${lag} minutes after their cron write one article for each slot of every day and never an extra one`, () => {
    const written = writtenAt(startsAfterLag(LEAD, lag));
    for (let day = 0; day < DAYS; day += 1) {
      assert.equal(written.filter((at) => at.startsWith(dayOf(day))).length, WANTED.length, dayOf(day));
    }
  });
}

test('a run that starts exactly the lead after its cron writes at the times the articles are wanted', () => {
  assert.deepEqual(
    writtenAt(startsAfterLag(LEAD, LEAD)).filter((at) => at.startsWith(dayOf(1))),
    ['2026-11-03T06:00:00.000Z', '2026-11-03T15:00:00.000Z']
  );
});

test('a run that starts 23 minutes before its slot owes nothing, and the first catch-up writes it 7 minutes late', () => {
  assert.deepEqual(
    writtenAt(startsAfterLag(LEAD, 417)).filter((at) => at.startsWith(dayOf(1))),
    ['2026-11-03T06:07:00.000Z', '2026-11-03T15:07:00.000Z']
  );
});

test('every measured delay writes the slot within the half hour after it, early arrival included', () => {
  for (const lag of [417, 440, 458, 461]) {
    const [morning] = writtenAt(startsAfterLag(LEAD, lag)).filter((at) => at.startsWith(dayOf(1)));
    const minutes = (Date.parse(morning) - Date.parse(`${dayOf(1)}T06:00:00.000Z`)) / 60_000;
    assert.ok(minutes >= 0 && minutes <= 30, `${lag} minutes of delay wrote the 06:00 slot ${minutes} minutes late`);
  }
});

for (const lead of [0, 1, 59, 440, 1439]) {
  test(`with a lead of ${lead} minutes a runner that never starts late writes one article for each slot of every day and never an extra one`, () => {
    const written = writtenAt(startsAfterLag(lead, 0));
    for (let day = 0; day < DAYS; day += 1) {
      assert.equal(written.filter((at) => at.startsWith(dayOf(day))).length, WANTED.length, dayOf(day));
    }
  });
}

test('the due job records which cron entry fired, because the run list cannot say', () => {
  const steps = parse(COMMITTED).jobs.due.steps;
  const step = steps.find(({ run }) => typeof run === 'string' && run.includes('GITHUB_STEP_SUMMARY'));
  assert.ok(step, 'no step in the due job writes to the step summary');
  assert.equal(step.env.SCHEDULE, '${{ github.event.schedule }}');
  assert.match(step.run, /cron:/);
  assert.ok(!step.run.includes('${{'), 'the value reaches the shell through env, never interpolated into the script');
  assert.ok(
    steps.indexOf(step) < steps.findIndex(({ id }) => id === 'slot'),
    'the cron is recorded before the run may stop'
  );
});
