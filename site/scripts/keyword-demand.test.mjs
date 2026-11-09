import assert from 'node:assert/strict';
import { test } from 'node:test';

import { keyFrom, requestFailure, statsRejection, statsUrl, weeksFrom } from './keyword-demand.mjs';

const KEY = 'k3y-for-tests-0123456789abcdef';
const stamp = (day) => `/Date(${Date.parse(`${day}T00:00:00Z`)})/`;
const row = (day, exact, broad) => ({ Query: 'x', Date: stamp(day), Impressions: exact, BroadImpressions: broad });

test('the key is read from the variable and trimmed', () => {
  assert.equal(keyFrom({ BING_WEBMASTER_API_KEY: `  ${KEY}\n` }), KEY);
});

test('a missing or blank key is a credential error naming the variable, the file, the guide and the command', () => {
  for (const env of [{}, { BING_WEBMASTER_API_KEY: '' }, { BING_WEBMASTER_API_KEY: '   ' }]) {
    assert.throws(
      () => keyFrom(env),
      (error) =>
        error.credential === true &&
        error.message ===
          'BING_WEBMASTER_API_KEY is not set. Put the key in site/.env; site/.env.example says where to get it. Then run npm run audit:keywords again.'
    );
  }
});

test('in the workflow the missing key names the repository secret and the workflow, not the file', () => {
  assert.throws(
    () => keyFrom({}, 'secret'),
    (error) =>
      error.credential === true &&
      error.message ===
        'BING_WEBMASTER_API_KEY is not set. Put the key in the repository secret BING_WEBMASTER_API_KEY. Then run the Write daily workflow again.'
  );
});

test('the request names the phrase, the lowercase country, the language and the key, on the keyword endpoint', () => {
  const url = new URL(statsUrl({ phrase: 'What is shadow AI?', country: 'us', language: 'en-US', key: KEY }));

  assert.equal(`${url.origin}${url.pathname}`, 'https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    q: 'What is shadow AI?',
    country: 'us',
    language: 'en-US',
    apikey: KEY,
  });
});

test('a key Bing refuses is a credential error that names the variable and never the key', () => {
  const body = { ErrorCode: 3, Message: `ERROR!!! InvalidApiKey ${KEY}` };
  const fromFile = statsRejection(400, body, { key: KEY, source: 'file' });
  const fromSecret = statsRejection(400, body, { key: KEY, source: 'secret' });

  assert.equal(fromFile.credential, true);
  assert.equal(fromSecret.credential, true);
  assert.match(fromFile.message, /^Bing refused the key in BING_WEBMASTER_API_KEY \(HTTP 400: ERROR!!! InvalidApiKey /);
  assert.match(
    fromFile.message,
    /Replace that line in site\/\.env with a fresh key from Bing Webmaster Tools, Settings, API access\./
  );
  assert.match(fromFile.message, /Then run npm run audit:keywords again\.$/);
  assert.match(fromSecret.message, /Replace the repository secret BING_WEBMASTER_API_KEY with a fresh key/);
  assert.match(fromSecret.message, /Then run the Write daily workflow again\.$/);
  for (const error of [fromFile, fromSecret]) assert.equal(error.message.includes(KEY), false, error.message);
});

test('a refusal with status 401 or 403 is a credential error whatever the body says', () => {
  for (const status of [401, 403]) assert.equal(statsRejection(status, {}, { key: KEY }).credential, true);
});

test('a throttle answer is marked so the run waits and tries again, and it is no credential problem', () => {
  for (const Message of ['ERROR!!! ThrottleUser', 'ERROR!!! ThrottleIP']) {
    const error = statsRejection(400, { ErrorCode: 4, Message }, { key: KEY });

    assert.equal(error.throttled, true);
    assert.notEqual(error.credential, true);
  }
});

test('an argument Bing finds out of range points at the two configured values, and is no credential problem', () => {
  const error = statsRejection(
    400,
    {
      ErrorCode: 8,
      Message: "ERROR!!! Specified argument was out of the range of valid values. (Parameter 'country')",
    },
    { key: KEY }
  );

  assert.notEqual(error.credential, true);
  assert.notEqual(error.throttled, true);
  assert.match(error.message, /^Bing refused the request \(HTTP 400: ERROR!!! Specified argument was out of the range/);
  assert.match(error.message, /Check keywords\.country and keywords\.language in site\/engine\.config\.json\./);
  assert.match(error.message, /no report was written/);
});

test('any other status is an error that says no report was written, with the detail capped and the key removed', () => {
  const error = statsRejection(503, { Message: `${KEY} ${'x'.repeat(500)}` }, { key: KEY });

  assert.match(error.message, /^Bing answered HTTP 503 \(/);
  assert.match(error.message, /no report was written$/);
  assert.equal(error.message.includes(KEY), false);
  assert.ok(error.message.length < 400, `${error.message.length} characters`);
  assert.equal(
    statsRejection(500, undefined, { key: KEY }).message,
    'Bing answered HTTP 500 (HTTP 500); no report was written'
  );
});

test('a request that got no answer says no report was written, and never holds the key in any written form', () => {
  const key = 'a b/c+d';
  const forms = [key, encodeURIComponent(key), new URLSearchParams({ q: key }).toString().slice(2)];
  const error = requestFailure(
    new TypeError(`fetch to https://example.test/?apikey=${forms[2]} failed: ${forms[0]} ${forms[1]}`),
    key
  );

  assert.equal(
    error.message,
    'Bing could not be reached (fetch to https://example.test/?apikey=[key] failed: [key] [key]); no report was written'
  );
  assert.notEqual(error.credential, true);
  assert.notEqual(error.throttled, true);
  assert.ok(requestFailure(new Error('x'.repeat(500)), KEY).message.length < 400);
});

test('weekly rows are read as a day and two counts, oldest week first', () => {
  const weeks = weeksFrom({ d: [row('2026-10-31', 3, 9), row('2026-10-24', 0, 2)] });

  assert.deepEqual(weeks, [
    { day: '2026-10-24', exact: 0, broad: 2 },
    { day: '2026-10-31', exact: 3, broad: 9 },
  ]);
});

test('a date that carries a time zone offset is read as the same epoch day', () => {
  const epoch = Date.parse('2026-10-31T00:00:00Z');

  assert.deepEqual(weeksFrom({ d: [{ Date: `/Date(${epoch}-0700)/`, Impressions: 1, BroadImpressions: 1 }] }), [
    { day: '2026-10-31', exact: 1, broad: 1 },
  ]);
});

test('a phrase Bing has no data for answers an empty list, which is not an error', () => {
  assert.deepEqual(weeksFrom({ d: [] }), []);
});

test('an answer that is not a list of weekly rows is refused, because an empty read looks like nobody searched', () => {
  const malformed = [
    undefined,
    null,
    {},
    { d: 'rows' },
    { d: [null] },
    { d: [{ Date: 'tomorrow', Impressions: 1, BroadImpressions: 1 }] },
    { d: [{ Date: stamp('2026-10-31'), Impressions: -1, BroadImpressions: 1 }] },
    { d: [{ Date: stamp('2026-10-31'), Impressions: 1.5, BroadImpressions: 1 }] },
    { d: [{ Date: stamp('2026-10-31'), Impressions: '3', BroadImpressions: 1 }] },
    { d: [{ Date: stamp('2026-10-31'), Impressions: 1 }] },
  ];

  for (const answer of malformed) {
    assert.throws(
      () => weeksFrom(answer),
      /^Error: Bing answered 200 with .*; no report was written$/,
      JSON.stringify(answer)
    );
  }
});
