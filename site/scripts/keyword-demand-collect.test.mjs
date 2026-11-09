import assert from 'node:assert/strict';
import { test } from 'node:test';

import { THROTTLE_ATTEMPTS, THROTTLE_WAIT_MS, collectKeywords, throttleExhausted } from './keyword-demand.mjs';

const GAP_MS = 123;
const throttled = () => Object.assign(new Error('throttled'), { throttled: true });
const noWaiting = () => {
  const waits = [];
  return { waits, wait: async (ms) => void waits.push(ms) };
};
const priced = async (phrase) => [{ day: '2026-10-31', exact: phrase.length, broad: 0 }];
const throttleWaits = Array.from({ length: THROTTLE_ATTEMPTS - 1 }, (_, at) => THROTTLE_WAIT_MS * (at + 1));

test('every phrase is priced in order, with the gap between requests and none before the first', async () => {
  const { waits, wait } = noWaiting();
  const { stats, unreached } = await collectKeywords({
    get: priced,
    phrases: ['a', 'bb', 'ccc'],
    wait,
    gapMs: GAP_MS,
  });

  assert.deepEqual(
    stats.map(({ phrase, weeks }) => [phrase, weeks[0].exact]),
    [
      ['a', 1],
      ['bb', 2],
      ['ccc', 3],
    ]
  );
  assert.deepEqual(unreached, []);
  assert.deepEqual(waits, [GAP_MS, GAP_MS]);
});

test('no phrase to price makes no request and waits for nothing', async () => {
  const { waits, wait } = noWaiting();
  const get = async () => assert.fail('a request was made');

  assert.deepEqual(await collectKeywords({ get, phrases: [], wait, gapMs: GAP_MS }), { stats: [], unreached: [] });
  assert.deepEqual(waits, []);
});

test('a throttled phrase waits a longer time at each try and is then priced', async () => {
  const { waits, wait } = noWaiting();
  let calls = 0;
  const get = async (phrase) => {
    if (phrase === 'b' && (calls += 1) <= 2) throw throttled();
    return priced(phrase);
  };
  const { stats, unreached } = await collectKeywords({ get, phrases: ['a', 'b', 'c'], wait, gapMs: GAP_MS });

  assert.equal(stats.length, 3);
  assert.deepEqual(unreached, []);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [GAP_MS, THROTTLE_WAIT_MS, THROTTLE_WAIT_MS * 2, GAP_MS]);
});

test('a phrase that stays throttled stops the loop and hands back the phrases it never reached beside those it priced', async () => {
  const { waits, wait } = noWaiting();
  const asked = [];
  const get = async (phrase) => {
    asked.push(phrase);
    if (phrase === 'c') throw throttled();
    return priced(phrase);
  };
  const { stats, unreached } = await collectKeywords({ get, phrases: ['a', 'b', 'c', 'd', 'e'], wait, gapMs: GAP_MS });

  assert.deepEqual(
    stats.map(({ phrase }) => phrase),
    ['a', 'b']
  );
  assert.deepEqual(unreached, ['c', 'd', 'e']);
  assert.deepEqual(asked, ['a', 'b', ...Array(THROTTLE_ATTEMPTS).fill('c')]);
  assert.deepEqual(waits, [GAP_MS, GAP_MS, ...throttleWaits]);
});

test('a throttle that holds from the first phrase leaves nothing priced and every phrase unreached', async () => {
  const { wait } = noWaiting();
  const get = async () => {
    throw throttled();
  };

  assert.deepEqual(await collectKeywords({ get, phrases: ['a', 'b'], wait, gapMs: GAP_MS }), {
    stats: [],
    unreached: ['a', 'b'],
  });
});

test('a throttle on the last phrase leaves that phrase alone unreached', async () => {
  const { wait } = noWaiting();
  const get = async (phrase) => (phrase === 'c' ? Promise.reject(throttled()) : priced(phrase));
  const { stats, unreached } = await collectKeywords({ get, phrases: ['a', 'b', 'c'], wait, gapMs: GAP_MS });

  assert.equal(stats.length, 2);
  assert.deepEqual(unreached, ['c']);
});

test('a phrase with an empty answer is priced, not unreached, because no data is an answer', async () => {
  const { wait } = noWaiting();
  const { stats, unreached } = await collectKeywords({ get: async () => [], phrases: ['a'], wait, gapMs: GAP_MS });

  assert.deepEqual(stats, [{ phrase: 'a', weeks: [] }]);
  assert.deepEqual(unreached, []);
});

test('the error for a run that priced nothing names the phrase and the tries, and says no report was written', () => {
  assert.equal(
    throttleExhausted('b').message,
    `Bing throttled the key on "b" ${THROTTLE_ATTEMPTS} times in a row; no report was written`
  );
});

test('an error that is not a throttle stops the run at once, unchanged, without a second try', async () => {
  const { wait } = noWaiting();
  const refusal = Object.assign(new Error('Bing refused the key'), { credential: true });
  let calls = 0;
  const get = async () => {
    calls += 1;
    throw refusal;
  };

  await assert.rejects(
    collectKeywords({ get, phrases: ['a', 'b'], wait, gapMs: GAP_MS }),
    (error) => error === refusal
  );
  assert.equal(calls, 1);
});

test('an error that is not a throttle stops the run even after phrases were priced and others were throttled', async () => {
  const failures = [
    Object.assign(new Error('Bing refused the key'), { credential: true }),
    new Error('Bing answered 200 with no "d" list of weekly rows; no report was written'),
    new Error('Bing refused the request (HTTP 400: out of the range); no report was written'),
    new Error('Bing could not be reached (socket hang up); no report was written'),
  ];

  for (const failure of failures) {
    const { wait } = noWaiting();
    let throttledOnce = false;
    const get = async (phrase) => {
      if (phrase === 'b' && !throttledOnce) {
        throttledOnce = true;
        throw throttled();
      }
      if (phrase === 'c') throw failure;
      return priced(phrase);
    };

    await assert.rejects(
      collectKeywords({ get, phrases: ['a', 'b', 'c', 'd'], wait, gapMs: GAP_MS }),
      (error) => error === failure,
      failure.message
    );
  }
});
