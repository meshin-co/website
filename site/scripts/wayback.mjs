import { archiveSnapshot, archiveUrlFor, capturedOn, isSnapshotOf } from '../src/utils/archive-url.mjs';
import { autowriterAgent } from './site-brand.mjs';

export const SNAPSHOT_WINDOW_DAYS = 180;
export const AVAILABILITY_ENDPOINT = 'https://archive.org/wayback/available';
export const PLAYBACK_ORIGIN = 'https://web.archive.org';
export const ENDPOINT_VARIABLES = { availability: 'WAYBACK_AVAILABILITY_URL', playback: 'WAYBACK_PLAYBACK_ORIGIN' };

const REQUEST_TIMEOUT_MS = 30_000;
const LONGEST_WAIT_SECONDS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const READABLE_TYPES = new Set(['text/html', 'application/xhtml+xml']);

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const none = (reason) => ({ kind: 'none', reason });
const unavailable = (reason) => ({ kind: 'unavailable', reason });
const unreadable = (reason) => ({ kind: 'unreadable', reason });
const retryable = (status) => status === 429 || status >= 500;
const httpsForm = (address) => (typeof address === 'string' ? address.replace(/^http:\/\//, 'https://') : address);
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / MILLISECONDS_PER_DAY;

function baseAddress(env, name, fallback) {
  const given = typeof env[name] === 'string' ? env[name].trim() : '';
  return given === '' ? fallback : given.replace(/\/+$/, '');
}

function secondsToWait(retryAfter, attempt) {
  const seconds = /^\d+$/.test(retryAfter ?? '') ? Number(retryAfter) : 2 ** attempt;
  return Math.min(seconds, LONGEST_WAIT_SECONDS);
}

function describeFailure(error) {
  const message = error?.message ?? String(error);
  const cause = error?.cause?.code ?? error?.cause?.message;
  return cause === undefined ? message : `${message}: ${cause}`;
}

async function attemptOnce({ fetch, address, headers, accept }) {
  try {
    const response = await fetch(address, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!retryable(response.status)) return { answer: await accept(response) };
    return { failure: `HTTP ${response.status}`, retryAfter: response.headers.get('retry-after') };
  } catch (error) {
    return { failure: describeFailure(error), retryAfter: null };
  }
}

async function ask({ fetch, address, attempts, sleep, accept }) {
  const headers = { 'User-Agent': autowriterAgent() };
  let outcome = { failure: 'no request was made' };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    outcome = await attemptOnce({ fetch, address, headers, accept });
    if ('answer' in outcome) return outcome;
    if (attempt < attempts) await sleep(secondsToWait(outcome.retryAfter, attempt) * 1000);
  }
  return { failure: `the archive could not be asked after ${attempts} attempts: ${outcome.failure}` };
}

function assertCalendarDay(citedOn) {
  const parsed = typeof citedOn === 'string' && CALENDAR_DAY.test(citedOn) ? new Date(`${citedOn}T00:00:00Z`) : null;
  if (parsed === null || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== citedOn) {
    throw new TypeError(`citedOn must be a calendar date written YYYY-MM-DD, got ${String(citedOn)}`);
  }
}

const readAvailability = async (response) => ({
  status: response.status,
  text: response.ok ? await response.text() : '',
});

function parseAvailability(text) {
  let answer;
  try {
    answer = JSON.parse(text);
  } catch {
    return { malformed: 'the archive answered with something that is not JSON' };
  }
  const snapshots = answer?.archived_snapshots;
  if (snapshots === null || typeof snapshots !== 'object') {
    return { malformed: 'the archive answered with JSON that has no archived_snapshots object' };
  }
  const { closest } = snapshots;
  if (closest !== undefined && (closest === null || typeof closest !== 'object')) {
    return { malformed: 'the archive answered with a closest snapshot that is not an object' };
  }
  return { closest };
}

function judgeClosest(closest, { url, citedOn, windowDays }) {
  if (closest.available !== true) return none('the archive does not report its nearest snapshot as available');
  if (closest.status !== '200') return none(`the nearest snapshot's status is ${closest.status}, not 200`);
  const captured = archiveSnapshot(httpsForm(closest.url));
  if (captured === null) return none('the nearest snapshot address is not a web.archive.org capture address');
  const { timestamp, original } = captured;
  if (timestamp !== closest.timestamp) {
    return none(`the nearest snapshot address names capture ${timestamp}, not its timestamp ${closest.timestamp}`);
  }
  const snapshotUrl = archiveUrlFor(captured);
  if (!isSnapshotOf(snapshotUrl, url)) return none(`the nearest snapshot is of ${original}, not of ${url}`);
  const day = capturedOn(snapshotUrl);
  if (day === null) return none(`the nearest snapshot timestamp ${timestamp} is not a calendar date`);
  const distanceDays = Math.abs(dayNumber(day) - dayNumber(citedOn));
  if (distanceDays > windowDays) {
    return none(
      `the nearest snapshot was captured on ${day}, ${distanceDays} days from the citation date ${citedOn}; the limit is ${windowDays} days`
    );
  }
  return { kind: 'found', snapshot: { url: snapshotUrl, timestamp, capturedOn: day, distanceDays, original } };
}

function judge(answer, request) {
  if (answer.status !== 200) return unavailable(`the archive answered HTTP ${answer.status}`);
  const { malformed, closest } = parseAvailability(answer.text);
  if (malformed !== undefined) return unavailable(malformed);
  if (closest === undefined) return none(`the archive holds no snapshot of ${request.url}`);
  return judgeClosest(closest, request);
}

export async function closestSnapshot({
  url,
  citedOn,
  fetch = globalThis.fetch,
  env = process.env,
  sleep = pause,
  attempts = 3,
  windowDays = SNAPSHOT_WINDOW_DAYS,
}) {
  assertCalendarDay(citedOn);
  const endpoint = baseAddress(env, ENDPOINT_VARIABLES.availability, AVAILABILITY_ENDPOINT);
  const address = `${endpoint}?url=${encodeURIComponent(url)}&timestamp=${citedOn.replaceAll('-', '')}`;
  const { answer, failure } = await ask({ fetch, address, attempts, sleep, accept: readAvailability });
  return failure === undefined ? judge(answer, { url, citedOn, windowDays }) : unavailable(failure);
}

async function readText(response, maxBytes) {
  const decoder = new TextDecoder();
  let text = '';
  let bytesRead = 0;
  for await (const chunk of response.body ?? []) {
    const kept = chunk.subarray(0, maxBytes - bytesRead);
    text += decoder.decode(kept, { stream: true });
    bytesRead += kept.length;
    if (bytesRead >= maxBytes) break;
  }
  return text;
}

async function readCapture(response, maxBytes) {
  if (response.status !== 200) return unreadable(`the archive answered HTTP ${response.status} for the capture`);
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!READABLE_TYPES.has(contentType)) {
    const what = contentType === '' ? 'declares no content type' : `is ${contentType}`;
    return unreadable(`the capture ${what}, which the machine cannot read; a person must judge it`);
  }
  return { kind: 'page', contentType, text: await readText(response, maxBytes) };
}

export async function readSnapshot({
  snapshot,
  fetch = globalThis.fetch,
  env = process.env,
  sleep = pause,
  attempts = 3,
  maxBytes = 2 * 1024 * 1024,
}) {
  const origin = baseAddress(env, ENDPOINT_VARIABLES.playback, PLAYBACK_ORIGIN);
  const address = `${origin}/web/${snapshot.timestamp}id_/${snapshot.original}`;
  const accept = (response) => readCapture(response, maxBytes);
  const { answer, failure } = await ask({ fetch, address, attempts, sleep, accept });
  return failure === undefined ? answer : unavailable(failure);
}
