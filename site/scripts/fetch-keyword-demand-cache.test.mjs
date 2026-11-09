import assert from 'node:assert/strict';
import test, { after } from 'node:test';

import {
  KEYWORDS,
  PHRASES,
  PREVIOUS,
  answer,
  discardScenes,
  keywordRun,
  reportOf,
  week,
} from './fixtures/keyword-run.mjs';
import { daysAgo, figures, previousReport } from './fixtures/previous-keyword-report.mjs';
import { readKeywordReport } from './keyword-report.mjs';

after(discardScenes);

const INSIDE_THE_WINDOW = 10;
const OUTSIDE_THE_WINDOW = 60;
const NEW_FIGURES = answer(week('2026-10-31', 33, 44));

const asked = ({ requests }) => requests.map(({ phrase }) => phrase);
const requestsFor = (outcome, phrase) => asked(outcome).filter((name) => name === phrase).length;
const rowOf = (outcome, phrase) => readKeywordReport(reportOf(outcome)).phrases.find((row) => row.phrase === phrase);

test('a phrase measured inside the window costs no request and one measured outside it costs exactly one', () => {
  const [inside, outside] = PHRASES;
  const previous = previousReport([
    figures(inside, INSIDE_THE_WINDOW, 960),
    figures(outside, OUTSIDE_THE_WINDOW, 5),
    figures('a phrase no concept builds any more', INSIDE_THE_WINDOW, 8),
  ]);
  const outcome = keywordRun({ previous, replies: { [outside]: [NEW_FIGURES] } });

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.equal(requestsFor(outcome, inside), 0);
  assert.equal(requestsFor(outcome, outside), 1);
  assert.deepEqual(asked(outcome), PHRASES.slice(1));
  assert.deepEqual(rowOf(outcome, inside), {
    phrase: inside,
    exact: 960,
    broad: 961,
    weeks: 3,
    measured: daysAgo(INSIDE_THE_WINDOW),
    servedBy: ['/glossary/shadow-ai'],
  });
  assert.equal(rowOf(outcome, outside).exact, 33);
  assert.ok(outcome.days.includes(rowOf(outcome, outside).measured));
  assert.equal(rowOf(outcome, 'a phrase no concept builds any more'), undefined);
});

test('the gap is kept between two requests and not spent on a phrase that is carried, so the first request waits for nothing', () => {
  const previous = previousReport([figures(PHRASES[0], INSIDE_THE_WINDOW, 960)]);
  const outcome = keywordRun({ previous });

  assert.equal(asked(outcome).length, PHRASES.length - 1);
  assert.deepEqual(outcome.waits, Array(PHRASES.length - 2).fill(KEYWORDS.requestGapMs));
});

test('a run whose phrases all sit inside the window asks Bing nothing, waits for nothing and still writes its report', () => {
  const previous = previousReport(PHRASES.map((phrase, at) => figures(phrase, 3, at + 1)));
  const outcome = keywordRun({ previous });
  const { phrases, run } = readKeywordReport(reportOf(outcome));

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.deepEqual(outcome.requests, []);
  assert.deepEqual(outcome.waits, []);
  assert.deepEqual(run, { built: PHRASES.length, priced: 0, carried: PHRASES.length, unanswered: 0 });
  assert.ok(phrases.every(({ measured }) => measured === daysAgo(3)));
});

test('a previous report that cannot be read is ignored: every phrase is priced and the run succeeds', () => {
  for (const previous of [PREVIOUS, '', '| Phrase | Exact |\n| --- | --- |\n| a | b |\n']) {
    const outcome = keywordRun({ previous });

    assert.equal(outcome.result.status, 0, outcome.result.stderr);
    assert.deepEqual(asked(outcome), PHRASES);
  }
});

test('a report written for another market is not carried, because a figure measured elsewhere is no measurement here', () => {
  const previous = previousReport([figures(PHRASES[0], INSIDE_THE_WINDOW, 960)], { country: 'us', language: 'en-US' });
  const outcome = keywordRun({ previous });

  assert.deepEqual(asked(outcome), PHRASES);
  assert.equal(rowOf(outcome, PHRASES[0]).exact, 0);
});

test('a phrase measured today is carried, so a repeated run on the same day asks Bing nothing it was already given', () => {
  const first = keywordRun();
  const second = keywordRun({ previous: reportOf(first) });

  assert.equal(first.requests.length, PHRASES.length);
  assert.deepEqual(second.requests, []);
  assert.equal(second.result.status, 0, second.result.stderr);
});
