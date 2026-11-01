import { createSign } from 'node:crypto';

const KEY_VARIABLE = 'GSC_SERVICE_ACCOUNT_JSON';
const PROPERTY_VARIABLE = 'GSC_PROPERTY';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const ROW_LIMIT = 25000;

const WINDOW_DAYS = 90;
const DATA_LAG_DAYS = 2;
const ASSERTION_SECONDS = 3600;
const DAY_MS = 86_400_000;
const DETAIL_LIMIT = 300;

const AGAIN = 'Then run npm run audit:demand again.';

const keyError = (problem) =>
  new Error(
    `${KEY_VARIABLE} ${problem}. Put the whole service-account JSON on one line in site/.env; site/.env.example says where to get it. ${AGAIN}`
  );

export function credentialsFrom(env) {
  const raw = String(env[KEY_VARIABLE] ?? '').trim();
  if (raw === '') throw keyError('is not set');

  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw keyError('is not valid JSON');
  }
  const { client_email: clientEmail, private_key: privateKey } = account ?? {};
  const usable =
    typeof clientEmail === 'string' &&
    clientEmail !== '' &&
    typeof privateKey === 'string' &&
    privateKey.includes('PRIVATE KEY');
  if (!usable) throw keyError('has no client_email and private_key');

  const property = String(env[PROPERTY_VARIABLE] ?? '').trim();
  if (property === '') {
    throw new Error(
      `${PROPERTY_VARIABLE} is not set. Put the Search Console property in site/.env, for example ${PROPERTY_VARIABLE}=sc-domain:example.com; site/.env.example explains it. ${AGAIN}`
    );
  }
  return { clientEmail, privateKey, property };
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signAssertion({ clientEmail, privateKey, now }) {
  const unsigned = [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + ASSERTION_SECONDS }),
  ].join('.');
  try {
    return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url')}`;
  } catch {
    throw keyError('holds a private_key that cannot sign');
  }
}

export const tokenRequestBody = (assertion) =>
  new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString();

export function tokenRejection(status, body) {
  const detail = [body?.error, body?.error_description].filter(Boolean).join(': ') || `HTTP ${status}`;
  return new Error(
    `Google refused the service account in ${KEY_VARIABLE} (${String(detail).slice(0, DETAIL_LIMIT)}). Replace that line in site/.env with a fresh key for an account that exists. ${AGAIN}`
  );
}

export const queryUrl = (property) =>
  `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;

export const queryRequest = ({ startDate, endDate, dimensions, startRow = 0, rowLimit = ROW_LIMIT }) => ({
  startDate,
  endDate,
  dimensions,
  searchType: 'web',
  rowLimit,
  startRow,
});

export function queryRejection(status, body, property) {
  const detail = String(body?.error?.message ?? `HTTP ${status}`).slice(0, DETAIL_LIMIT);
  if (status === 401 || status === 403) {
    return new Error(
      `Search Console refused ${PROPERTY_VARIABLE}=${property} for the service account in ${KEY_VARIABLE} (${detail}). Add that account's client_email to the property in Search Console, Settings, Users and permissions, with Restricted permission, or correct ${PROPERTY_VARIABLE} in site/.env. If the message says the API is disabled, enable the Search Console API in the Google Cloud project that owns the key. ${AGAIN}`
    );
  }
  return new Error(`Search Console answered HTTP ${status} (${detail}); no report was written`);
}

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function measuredWindow(measured) {
  const end = Date.parse(`${measured}T00:00:00Z`) - DATA_LAG_DAYS * DAY_MS;
  return { measured, startDate: isoDay(end - WINDOW_DAYS * DAY_MS), endDate: isoDay(end) };
}

export async function collectDemand({ post, startDate, endDate, rowLimit = ROW_LIMIT }) {
  const read = (dimensions, startRow) => post(queryRequest({ startDate, endDate, dimensions, startRow, rowLimit }));

  async function readAll(dimensions) {
    const rows = [];
    for (let startRow = 0; ; startRow += rowLimit) {
      const page = (await read(dimensions, startRow)).rows ?? [];
      rows.push(...page);
      if (page.length < rowLimit) return rows;
    }
  }

  const totals = (await read([], 0)).rows?.[0];
  return {
    totals,
    queries: await readAll(['query']),
    pages: await readAll(['page']),
    days: await readAll(['date']),
    pairs: await readAll(['query', 'page']),
  };
}
