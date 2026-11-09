import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  KEYWORDS,
  PHRASES,
  THROTTLE,
  answer,
  assertKeyAbsent,
  discardScenes,
  keywordRun,
  refusal,
  reportOf,
  week,
} from './fixtures/keyword-run.mjs';
import { figures, previousReport } from './fixtures/previous-keyword-report.mjs';
import { THROTTLE_ATTEMPTS, THROTTLE_WAIT_MS } from './keyword-demand.mjs';
import { readKeywordReport } from './keyword-report.mjs';

const GATE = fileURLToPath(new URL('./keyword-demand-gate.mjs', import.meta.url));
const GAP = KEYWORDS.requestGapMs;
const STUCK = PHRASES[3];
const REACHED = PHRASES.slice(0, 3);
const UNREACHED = PHRASES.slice(3);
const FIGURES = { [PHRASES[0]]: [answer(week('2026-10-24', 400, 500), week('2026-10-31', 560, 600))] };
const PARTIAL_NOTE =
  'Partial run: Bing throttled the key, so it never answered for 2 of 5 phrases. They are not zero-volume phrases: their volume is unknown. The report lists them under Not measured, and the next run asks Bing for them again.';
const THROTTLE_WAITS = Array.from({ length: THROTTLE_ATTEMPTS - 1 }, (_, at) => THROTTLE_WAIT_MS * (at + 1));

after(discardScenes);

const throttledAt = (phrase) => ({ ...FIGURES, [phrase]: [THROTTLE] });
const asked = ({ requests }) => requests.map(({ phrase }) => phrase);
const sorted = (names) => [...names].sort();

test('a throttle that holds after 3 of 5 phrases writes a report that prices those 3, names the 2 never reached, and exits 0', () => {
  const outcome = keywordRun({ replies: throttledAt(STUCK) });
  const { phrases, unmeasured, run } = readKeywordReport(reportOf(outcome));

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.equal(outcome.result.stderr, '');
  assert.deepEqual(asked(outcome), [...REACHED, ...Array(THROTTLE_ATTEMPTS).fill(STUCK)]);
  assert.deepEqual(outcome.waits, [GAP, GAP, GAP, ...THROTTLE_WAITS]);
  assert.deepEqual(sorted(phrases.map(({ phrase }) => phrase)), sorted(REACHED));
  assert.deepEqual(unmeasured, sorted(UNREACHED));
  assert.deepEqual(run, { built: 5, priced: 3, carried: 0, unanswered: 2 });
  assert.equal(phrases.find(({ phrase }) => phrase === PHRASES[0]).exact, 960);
});

test('a phrase the report never reached is listed as unknown and never as a row of zeros', () => {
  const text = reportOf(keywordRun({ replies: throttledAt(STUCK) }));
  const { phrases } = readKeywordReport(text);

  for (const phrase of UNREACHED) {
    assert.equal(
      phrases.some((row) => row.phrase === phrase),
      false,
      `${phrase} must not have a row in the phrase table`
    );
  }
  assert.ok(text.split('\n').includes(PARTIAL_NOTE));
  assert.ok(
    text.split('\n').includes('Run: phrases built 5, priced this run 3, carried from the cache 0, never answered 2')
  );
});

test('the command says on stdout what the report says: how many were priced, carried and never answered, and that they are unknown', () => {
  const outcome = keywordRun({ replies: throttledAt(STUCK) });

  assert.deepEqual(outcome.result.stdout.trimEnd().split('\n'), [
    'audit:keywords: wrote ../audits/keyword-demand.md (phrases priced: 3; with an exact impression: 1; candidates: 0)',
    'audit:keywords: Run: phrases built 5, priced this run 3, carried from the cache 0, never answered 2',
    `audit:keywords: ${PARTIAL_NOTE}`,
  ]);
});

test('a throttle that holds from the first request still writes the phrases carried from the cache beside every phrase it could not ask for', () => {
  const previous = previousReport([figures(PHRASES[0], 10, 960)]);
  const outcome = keywordRun({ previous, replies: { [PHRASES[1]]: [THROTTLE] } });
  const { phrases, unmeasured, run } = readKeywordReport(reportOf(outcome));

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.deepEqual(asked(outcome), Array(THROTTLE_ATTEMPTS).fill(PHRASES[1]));
  assert.deepEqual(
    phrases.map(({ phrase }) => phrase),
    [PHRASES[0]]
  );
  assert.deepEqual(unmeasured, sorted(PHRASES.slice(1)));
  assert.deepEqual(run, { built: 5, priced: 0, carried: 1, unanswered: 4 });
  assert.match(reportOf(outcome), /No phrase was priced this run, so this run has no window\./);
});

test('a second run asks Bing only for the phrases the first run never reached, and then the report is whole', () => {
  const first = keywordRun({ replies: throttledAt(STUCK) });
  const second = keywordRun({ previous: reportOf(first), replies: FIGURES });
  const { phrases, unmeasured, run } = readKeywordReport(reportOf(second));

  assert.equal(second.result.status, 0, second.result.stderr);
  assert.deepEqual(asked(second), UNREACHED);
  assert.deepEqual(sorted(phrases.map(({ phrase }) => phrase)), sorted(PHRASES));
  assert.deepEqual(unmeasured, []);
  assert.deepEqual(run, { built: 5, priced: 2, carried: 3, unanswered: 0 });
  assert.doesNotMatch(second.result.stdout, /Partial run/);
});

test('the report of a partial run is one gate:keywords accepts, because a phrase it names as unknown is no finding', () => {
  const outcome = keywordRun({ replies: throttledAt(STUCK) });
  const gate = spawnSync(process.execPath, [GATE, outcome.root], { encoding: 'utf8' });

  assert.equal(gate.status, 0, gate.stderr);
  assert.match(gate.stdout, /, 3 phrases, 0 candidates, 0 findings$/m);
});

test('a key Bing refuses after a throttle and some priced phrases still stops the run, writes no report and keeps the earlier one', () => {
  const previous = previousReport([figures(PHRASES[0], 10, 960)]);
  const replies = {
    [PHRASES[1]]: [THROTTLE, answer(week('2026-10-31', 3, 4))],
    [PHRASES[2]]: [refusal(401, { Message: 'Unauthorized' })],
  };
  const outcome = keywordRun({ previous, replies });

  assert.equal(outcome.result.status, 3, outcome.result.stderr);
  assert.match(outcome.result.stderr, /Bing refused the key in BING_WEBMASTER_API_KEY \(HTTP 401/);
  assert.deepEqual(asked(outcome), [PHRASES[1], PHRASES[1], PHRASES[2]]);
  assert.equal(readFileSync(outcome.out, 'utf8'), previous, 'a refused run must leave the report as it was');
  assert.equal(outcome.result.stdout, '');
  assertKeyAbsent([outcome.result.stdout, outcome.result.stderr]);
});
