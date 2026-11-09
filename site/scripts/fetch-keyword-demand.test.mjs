import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ENDPOINT,
  KEY,
  KEYWORDS,
  PHRASES,
  PREVIOUS,
  SERVED,
  UNSERVED,
  answer,
  assertKeyAbsent,
  discardScenes,
  keywordRun,
  reportOf,
  week,
} from './fixtures/keyword-run.mjs';
import { readKeywordReport } from './keyword-report.mjs';

const GATE = fileURLToPath(new URL('./keyword-demand-gate.mjs', import.meta.url));
const SHADOW_AI_PAGE = '/glossary/shadow-ai';
const DPIA_PAGE = '/glossary/dpia';
const FIGURES = {
  [SERVED]: [answer(week('2026-10-24', 400, 500), week('2026-10-31', 560, 600))],
  [UNSERVED]: [answer(week('2026-09-12', 70, 75))],
};

after(discardScenes);

const rowOf = (outcome, phrase) => readKeywordReport(reportOf(outcome)).phrases.find((row) => row.phrase === phrase);

test('a run prices every phrase the core builds from the configured templates, once and in order', () => {
  const outcome = keywordRun({ replies: FIGURES });

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.deepEqual(
    outcome.requests.map(({ phrase }) => phrase),
    PHRASES
  );
});

test('every request names the configured market and the key, carries a timeout and asks for nothing else', () => {
  const { requests } = keywordRun({ replies: FIGURES });

  assert.equal(requests.length, PHRASES.length);
  for (const { url, signalled } of requests) {
    const { origin, pathname, searchParams } = new URL(url);
    assert.equal(`${origin}${pathname}`, ENDPOINT);
    assert.deepEqual([...searchParams.keys()].sort(), ['apikey', 'country', 'language', 'q']);
    assert.equal(searchParams.get('country'), KEYWORDS.country);
    assert.equal(searchParams.get('language'), KEYWORDS.language);
    assert.equal(searchParams.get('apikey'), KEY);
    assert.equal(signalled, true, `${url} has no timeout`);
  }
});

test('the first request waits for nothing and every later one waits the configured gap', () => {
  const { events, waits } = keywordRun({ replies: FIGURES });

  assert.deepEqual(
    events.map((event) => ('url' in event ? 'request' : 'wait')),
    PHRASES.flatMap((_, at) => (at === 0 ? ['request'] : ['wait', 'request']))
  );
  assert.deepEqual(waits, Array(PHRASES.length - 1).fill(KEYWORDS.requestGapMs));
});

test('the report is stamped with the commit, dated today, and holds the window, the market and the figures of each phrase', () => {
  const outcome = keywordRun({ replies: FIGURES, previous: PREVIOUS });
  const report = readKeywordReport(reportOf(outcome));

  assert.equal(report.generatedFrom, outcome.head);
  assert.ok(outcome.days.includes(report.measured), `${report.measured} is not ${outcome.days.join(' or ')}`);
  assert.equal(report.windowStart, '2026-09-12');
  assert.equal(report.windowEnd, '2026-10-31');
  assert.equal(report.market, `country ${KEYWORDS.country}, language ${KEYWORDS.language}`);
  assert.deepEqual(report.phrases.map(({ phrase }) => phrase).sort(), [...PHRASES].sort());
  assert.deepEqual(rowOf(outcome, SERVED), {
    phrase: SERVED,
    exact: 960,
    broad: 1100,
    weeks: 2,
    measured: report.measured,
    servedBy: [SHADOW_AI_PAGE],
  });
  assert.deepEqual(rowOf(outcome, UNSERVED), {
    phrase: UNSERVED,
    exact: 70,
    broad: 75,
    weeks: 1,
    measured: report.measured,
    servedBy: [],
  });
  assert.deepEqual(rowOf(outcome, 'what is dpia'), {
    phrase: 'what is dpia',
    exact: 0,
    broad: 0,
    weeks: 0,
    measured: report.measured,
    servedBy: [DPIA_PAGE],
  });
});

test('a phrase with an exact impression that no route serves is a candidate, and the summary lines count it', () => {
  const outcome = keywordRun({ replies: FIGURES });

  assert.deepEqual(readKeywordReport(reportOf(outcome)).candidates, [{ phrase: UNSERVED, exact: 70, broad: 75 }]);
  assert.deepEqual(outcome.result.stdout.trimEnd().split('\n'), [
    `audit:keywords: wrote ../audits/keyword-demand.md (phrases priced: ${PHRASES.length}; with an exact impression: 2; candidates: 1)`,
    `audit:keywords: Run: phrases built ${PHRASES.length}, priced this run ${PHRASES.length}, carried from the cache 0, never answered 0`,
  ]);
});

test('the report a run writes is one gate:keywords accepts, and the gate counts its phrases and its candidate', () => {
  const outcome = keywordRun({ replies: FIGURES });
  const gate = spawnSync(process.execPath, [GATE, outcome.root], { encoding: 'utf8' });

  assert.equal(gate.status, 0, gate.stderr);
  assert.match(gate.stdout, new RegExp(`, ${PHRASES.length} phrases, 1 candidates, 0 findings$`, 'm'));
});

test('the key reaches no file the run wrote and no line it printed', () => {
  const outcome = keywordRun({ replies: FIGURES });

  assertKeyAbsent([reportOf(outcome), outcome.result.stdout, outcome.result.stderr]);
});

test('when Bing holds no data for any phrase the report says it has no window and lists every phrase at zero', () => {
  const outcome = keywordRun();
  const text = reportOf(outcome);
  const { phrases, candidates, windowStart } = readKeywordReport(text);

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.match(text, /Bing returned no weekly row for any phrase, so this run has no window\./);
  assert.equal(windowStart, null);
  assert.equal(phrases.length, PHRASES.length);
  assert.ok(phrases.every(({ exact, broad, weeks }) => exact === 0 && broad === 0 && weeks === 0));
  assert.deepEqual(candidates, []);
});

test('a run in a tree that holds no installed package still writes its report', () => {
  const outcome = keywordRun({ replies: FIGURES });

  assert.equal(existsSync(join(outcome.root, 'site', 'node_modules')), false);
  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.equal(existsSync(outcome.out), true);
});
