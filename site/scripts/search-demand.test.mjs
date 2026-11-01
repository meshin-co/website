import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import {
  collectDemand,
  credentialsFrom,
  measuredWindow,
  queryRejection,
  queryRequest,
  queryUrl,
  signAssertion,
  tokenRejection,
  tokenRequestBody,
} from './search-demand.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const CLIENT_EMAIL = 'reader@example-project.iam.gserviceaccount.com';
const PROPERTY = 'sc-domain:example.com';
const ENV = {
  GSC_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: 'service_account',
    client_email: CLIENT_EMAIL,
    private_key: privateKey,
  }),
  GSC_PROPERTY: PROPERTY,
};

const refusal = (env) => {
  try {
    credentialsFrom(env);
  } catch (error) {
    return error.message;
  }
  return assert.fail('credentialsFrom accepted an environment it should refuse');
};

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

test('the window ends two days before the day it was measured and reaches 90 days back', () => {
  assert.deepEqual(measuredWindow('2026-11-01'), {
    measured: '2026-11-01',
    startDate: '2026-08-01',
    endDate: '2026-10-30',
  });
});

test('the window crosses a month and a year boundary without drifting', () => {
  assert.deepEqual(measuredWindow('2026-03-01'), {
    measured: '2026-03-01',
    startDate: '2025-11-29',
    endDate: '2026-02-27',
  });
});

test('a service-account key and a property are read from the environment', () => {
  assert.deepEqual(credentialsFrom(ENV), { clientEmail: CLIENT_EMAIL, privateKey, property: PROPERTY });
});

test('an absent or blank key is refused, naming the variable and the file it belongs in', () => {
  for (const value of [undefined, '', '   ']) {
    const message = refusal({ ...ENV, GSC_SERVICE_ACCOUNT_JSON: value });
    assert.match(message, /GSC_SERVICE_ACCOUNT_JSON is not set\./);
    assert.match(message, /site\/\.env/);
    assert.match(message, /npm run audit:demand/);
  }
});

test('a key that is not JSON is refused without echoing any of it', () => {
  const message = refusal({ ...ENV, GSC_SERVICE_ACCOUNT_JSON: '{"private_key": "TOPSECRET-MARKER", broken' });

  assert.match(message, /GSC_SERVICE_ACCOUNT_JSON is not valid JSON\./);
  assert.match(message, /site\/\.env/);
  assert.doesNotMatch(message, /TOPSECRET-MARKER/);
});

test('JSON that is not a service-account key is refused, whatever shape it has', () => {
  const shapes = [
    'null',
    '[]',
    '"text"',
    '{}',
    '{"client_email":"a@b.c"}',
    '{"private_key":"-----BEGIN PRIVATE KEY-----"}',
    '{"client_email":"a@b.c","private_key":"TOPSECRET-MARKER"}',
  ];
  for (const shape of shapes) {
    const message = refusal({ ...ENV, GSC_SERVICE_ACCOUNT_JSON: shape });
    assert.match(message, /GSC_SERVICE_ACCOUNT_JSON/, shape);
    assert.match(message, /site\/\.env/, shape);
    assert.doesNotMatch(message, /TOPSECRET-MARKER/, shape);
  }
});

test('an absent property is refused, naming the variable and the file it belongs in', () => {
  const message = refusal({ ...ENV, GSC_PROPERTY: '' });

  assert.match(message, /GSC_PROPERTY/);
  assert.match(message, /site\/\.env/);
  assert.match(message, /npm run audit:demand/);
});

test('the assertion is an RS256 token that asks for read-only Search Console access and lasts an hour', () => {
  const [head, claims] = signAssertion({ clientEmail: CLIENT_EMAIL, privateKey, now: 1_800_000_000 }).split('.');

  assert.deepEqual(decode(head), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(decode(claims), {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: 1_800_000_000,
    exp: 1_800_003_600,
  });
});

test('the assertion carries a signature the service account public key verifies', () => {
  const assertion = signAssertion({ clientEmail: CLIENT_EMAIL, privateKey, now: 1_800_000_000 });
  const [head, claims, signature] = assertion.split('.');

  const verified = createVerify('RSA-SHA256')
    .update(`${head}.${claims}`)
    .verify(publicKey, Buffer.from(signature, 'base64url'));

  assert.equal(verified, true);
});

test('a private key that cannot sign is refused, naming the variable and the file, without echoing it', () => {
  assert.throws(
    () => signAssertion({ clientEmail: CLIENT_EMAIL, privateKey: 'not-a-key-TOPSECRET-MARKER', now: 1 }),
    (error) => {
      assert.match(error.message, /GSC_SERVICE_ACCOUNT_JSON/);
      assert.match(error.message, /site\/\.env/);
      assert.doesNotMatch(error.message, /TOPSECRET-MARKER/);
      return true;
    }
  );
});

test('the token request is the jwt-bearer grant carrying the assertion', () => {
  const form = new URLSearchParams(tokenRequestBody('head.claims.signature'));

  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(form.get('assertion'), 'head.claims.signature');
});

test("a token request Google refuses names the key variable and the file, with Google's reason", () => {
  const message = tokenRejection(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }).message;

  assert.match(message, /GSC_SERVICE_ACCOUNT_JSON/);
  assert.match(message, /site\/\.env/);
  assert.match(message, /npm run audit:demand/);
  assert.match(message, /invalid_grant: Invalid JWT Signature\./);
});

test('the query address encodes the property, so a domain property and a url property both resolve', () => {
  assert.equal(
    queryUrl('sc-domain:example.com'),
    'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query'
  );
  assert.equal(
    queryUrl('https://example.com/'),
    'https://searchconsole.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.com%2F/searchAnalytics/query'
  );
});

test('a query request names the window, the dimensions, web search and the row limit', () => {
  assert.deepEqual(queryRequest({ startDate: '2026-08-01', endDate: '2026-10-30', dimensions: ['query', 'page'] }), {
    startDate: '2026-08-01',
    endDate: '2026-10-30',
    dimensions: ['query', 'page'],
    searchType: 'web',
    rowLimit: 25000,
    startRow: 0,
  });
});

test('a refusal of the property names the property, the key, the file and the permission that fixes it', () => {
  const message = queryRejection(
    403,
    { error: { code: 403, message: "User does not have sufficient permission for site 'sc-domain:example.com'." } },
    PROPERTY
  ).message;

  assert.match(message, /GSC_PROPERTY=sc-domain:example\.com/);
  assert.match(message, /GSC_SERVICE_ACCOUNT_JSON/);
  assert.match(message, /site\/\.env/);
  assert.match(message, /npm run audit:demand/);
  assert.match(message, /Restricted/);
  assert.match(message, /does not have sufficient permission/);
});

test('a server error is reported with its status and message, and is not blamed on the key', () => {
  const message = queryRejection(503, { error: { message: 'Backend Error' } }, PROPERTY).message;

  assert.match(message, /503/);
  assert.match(message, /Backend Error/);
  assert.doesNotMatch(message, /GSC_SERVICE_ACCOUNT_JSON/);
});

test('the five reads are totals, query, page, date, then query by page, over one window', async () => {
  const sent = [];
  const post = async (request) => {
    sent.push(request);
    return {};
  };

  await collectDemand({ post, startDate: '2026-08-01', endDate: '2026-10-30' });

  assert.deepEqual(
    sent.map((request) => request.dimensions),
    [[], ['query'], ['page'], ['date'], ['query', 'page']]
  );
  assert.ok(sent.every((request) => request.startDate === '2026-08-01' && request.endDate === '2026-10-30'));
  assert.ok(sent.every((request) => request.searchType === 'web'));
});

test('a read that fills its page is followed by the next one, so no query is lost at the row limit', async () => {
  const pagesOfQueries = [[{ keys: ['a'] }, { keys: ['b'] }], [{ keys: ['c'] }]];
  const startRows = [];
  const post = async (request) => {
    if (request.dimensions.join() !== 'query') return {};
    startRows.push(request.startRow);
    return { rows: pagesOfQueries[request.startRow / 2] ?? [] };
  };

  const data = await collectDemand({ post, startDate: '2026-08-01', endDate: '2026-10-30', rowLimit: 2 });

  assert.deepEqual(
    data.queries.map((entry) => entry.keys[0]),
    ['a', 'b', 'c']
  );
  assert.deepEqual(startRows, [0, 2]);
});

test('the totals are the single row of the read that has no dimension', async () => {
  const post = async (request) =>
    request.dimensions.length === 0 ? { rows: [{ clicks: 0, impressions: 77, ctr: 0, position: 67.7 }] } : {};

  const data = await collectDemand({ post, startDate: '2026-08-01', endDate: '2026-10-30' });

  assert.equal(data.totals?.impressions, 77);
});
