import { DETAIL_LIMIT, credentialError, credentialWording } from './audit-command.mjs';

const KEY_VARIABLE = 'BING_WEBMASTER_API_KEY';
const ENDPOINT = 'https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats';
const WORDING = credentialWording('audit:keywords');
const THROTTLED = /Throttle/i;
const REFUSED_KEY = /InvalidApiKey/i;
const OUT_OF_RANGE = /out of the range/i;
const EPOCH_DATE = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/;

export const THROTTLE_WAIT_MS = 5_000;
export const THROTTLE_ATTEMPTS = 6;

export function keyFrom(env, source = 'file') {
  const key = String(env[KEY_VARIABLE] ?? '').trim();
  if (key === '') {
    const { home, keyGuide, again } = WORDING[source];
    throw credentialError(`${KEY_VARIABLE} is not set. Put the key in ${home(KEY_VARIABLE)}${keyGuide}. ${again}`);
  }
  return key;
}

export function statsUrl({ phrase, country, language, key }) {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ q: phrase, country, language, apikey: key }).toString();
  return url.toString();
}

const KEY_FORMS = (key) => [key, encodeURIComponent(key), new URLSearchParams({ q: key }).toString().slice(2)];

const redacted = (text, key) => KEY_FORMS(key).reduce((clean, form) => clean.replaceAll(form, '[key]'), text);

export function requestFailure(failure, key) {
  const said = redacted(String(failure?.message ?? failure), key).slice(0, DETAIL_LIMIT);
  return new Error(`Bing could not be reached (${said}); no report was written`);
}

function keyRefusal(status, said, source) {
  const { home, again } = WORDING[source];
  const replace = source === 'file' ? 'Replace that line in' : 'Replace';
  return credentialError(
    `Bing refused the key in ${KEY_VARIABLE} (HTTP ${status}: ${said}). ${replace} ${home(KEY_VARIABLE)} with a fresh key from Bing Webmaster Tools, Settings, API access. ${again}`
  );
}

export function statsRejection(status, body, { key, source = 'file' }) {
  const said = redacted(String(body?.Message ?? `HTTP ${status}`), key).slice(0, DETAIL_LIMIT);
  if (status === 401 || status === 403 || REFUSED_KEY.test(said)) return keyRefusal(status, said, source);
  if (THROTTLED.test(said)) {
    return Object.assign(new Error(`Bing throttled the request (HTTP ${status}: ${said})`), { throttled: true });
  }
  if (OUT_OF_RANGE.test(said)) {
    return new Error(
      `Bing refused the request (HTTP ${status}: ${said}); no report was written. Check keywords.country and keywords.language in site/engine.config.json.`
    );
  }
  return new Error(`Bing answered HTTP ${status} (${said}); no report was written`);
}

const malformed = (what) => new Error(`Bing answered 200 with ${what}; no report was written`);

const dayOf = (stamp) => {
  const epoch = EPOCH_DATE.exec(String(stamp))?.[1];
  return epoch === undefined ? null : new Date(Number(epoch)).toISOString().slice(0, 10);
};

const isCount = (value) => Number.isInteger(value) && value >= 0;

const byDay = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);

export function weeksFrom(answer) {
  if (!Array.isArray(answer?.d)) throw malformed('no "d" list of weekly rows');
  return answer.d
    .map((week) => {
      const day = dayOf(week?.Date);
      if (day === null || !isCount(week.Impressions) || !isCount(week.BroadImpressions)) {
        throw malformed(`a weekly row it cannot read (${JSON.stringify(week).slice(0, DETAIL_LIMIT)})`);
      }
      return { day, exact: week.Impressions, broad: week.BroadImpressions };
    })
    .sort(byDay);
}

export const throttleExhausted = (phrase) =>
  new Error(`Bing throttled the key on "${phrase}" ${THROTTLE_ATTEMPTS} times in a row; no report was written`);

async function weeksUnlessThrottled({ get, phrase, wait }) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await get(phrase);
    } catch (failure) {
      if (!failure.throttled) throw failure;
      if (attempt === THROTTLE_ATTEMPTS) return null;
      await wait(THROTTLE_WAIT_MS * attempt);
    }
  }
}

export async function collectKeywords({ get, phrases, wait, gapMs }) {
  const stats = [];
  for (const [at, phrase] of phrases.entries()) {
    if (at > 0) await wait(gapMs);
    const weeks = await weeksUnlessThrottled({ get, phrase, wait });
    if (weeks === null) return { stats, unreached: phrases.slice(at) };
    stats.push({ phrase, weeks });
  }
  return { stats, unreached: [] };
}
