import './fixtures/no-network.mjs';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { parse } from 'yaml';

import { readEngineConfig } from './engine-config.mjs';
import {
  REGENERATE_COMMAND,
  SCHEDULE_COMMENT,
  WRITE_DAILY_PATH,
  WRITE_TIMES_UTC,
  cronOf,
  scheduleFindings,
  scheduleLines,
  sortedTimes,
  withSchedule,
} from './schedule-workflow.mjs';

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
const rulesOf = (text, times = TIMES) => scheduleFindings(text, times).map(({ rule }) => rule);

test('the committed workflow holds one cron entry per configured time, in ascending order, and nothing else is scheduled', () => {
  const configured = readEngineConfig().loop.writeTimesUtc;
  const wanted = [...configured].sort().map((time) => {
    const [hour, minute] = time.split(':').map(Number);
    return { cron: `${minute} ${hour} * * *` };
  });
  assert.deepEqual(parse(COMMITTED).on.schedule, wanted);
  assert.equal(withSchedule(COMMITTED, configured), COMMITTED);
  assert.deepEqual(scheduleFindings(COMMITTED, configured), []);
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
  assert.match(found.detail, /^line 8 holds "0 22 \* \* \*", which no time in loop\.writeTimesUtc produces;/);
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
