import { siteBrand } from './site-brand.mjs';

export const ATTEMPTS = 3;
export const ATTEMPT_TIMEOUT_MS = 30_000;
export const BACKOFF_MS = [2_000, 8_000];
export const RETRY_AFTER_CAP_MS = 30_000;
export const HOST_GAP_MS = 500;
export const CONCURRENCY = 8;
export const STREAK_BEFORE_SKIPPING_A_HOST = 2;

export const probeUserAgent = (brand = siteBrand()) =>
  `Mozilla/5.0 (compatible; ${brand.name.split('.')[0]}-link-check; +https://${brand.name})`;

const GONE = new Set([404, 410]);
const CONCLUSIVE = new Set(['answered', 'dead']);
const LOOKUP_FAILED = 'ENOTFOUND';
const TIMEOUT_NAMES = new Set(['TimeoutError', 'AbortError']);

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryAfterMs(value, now) {
  if (value === null || value === undefined) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - now());
}

function lookupFailedFor(error, address) {
  const { code, hostname } = error?.cause ?? {};
  return code === LOOKUP_FAILED && (hostname === undefined || hostname === URL.parse(address)?.hostname);
}

async function observe(address, { fetch, timeoutMs, now, userAgent }) {
  try {
    const response = await fetch(address, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel().catch(() => {});
    const { status } = response;
    const outcome = status >= 200 && status < 300 ? 'answered' : GONE.has(status) ? 'gone' : 'inconclusive';
    return {
      outcome,
      status,
      detail: String(status),
      finalUrl: response.url || address,
      waitMs: retryAfterMs(response.headers?.get('retry-after'), now),
    };
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;
    const detail = TIMEOUT_NAMES.has(error?.name) ? 'timed out' : (code ?? error?.message);
    const outcome = lookupFailedFor(error, address) ? 'unresolved' : 'inconclusive';
    return { outcome, status: null, detail: String(detail), finalUrl: null, waitMs: 0 };
  }
}

const countOf = (tries, outcome) => tries.filter((attempt) => attempt.outcome === outcome).length;

function verdictOf(tries) {
  if (countOf(tries, 'answered') > 0) return 'answered';
  if (countOf(tries, 'gone') >= 2) return 'dead';
  return tries.length >= 2 && countOf(tries, 'unresolved') === tries.length ? 'unresolved' : 'unverified';
}

export async function probe(
  address,
  {
    fetch = globalThis.fetch,
    sleep = realSleep,
    now = Date.now,
    attempts = ATTEMPTS,
    timeoutMs = ATTEMPT_TIMEOUT_MS,
    backoffMs = BACKOFF_MS,
    userAgent = probeUserAgent(),
  } = {}
) {
  const tries = [];
  while (tries.length < attempts) {
    const attempt = await observe(address, { fetch, timeoutMs, now, userAgent });
    tries.push(attempt);
    if (CONCLUSIVE.has(verdictOf(tries)) || tries.length === attempts) break;
    const backoff = backoffMs[Math.min(tries.length - 1, backoffMs.length - 1)] ?? 0;
    await sleep(Math.min(Math.max(backoff, attempt.waitMs), RETRY_AFTER_CAP_MS));
  }

  const verdict = verdictOf(tries);
  const decisive = [...tries].reverse().find((attempt) => attempt.status !== null);
  return {
    url: address,
    verdict,
    status: decisive?.status ?? null,
    finalUrl: decisive?.finalUrl ?? null,
    reason: tries.map((attempt) => attempt.detail).join(', '),
    tries: tries.map(({ outcome, status, detail }) => ({ outcome, status, detail })),
  };
}

const notAsked = (address) => ({
  url: address,
  verdict: 'unverified',
  status: null,
  finalUrl: null,
  reason: `not asked: the host did not answer the ${STREAK_BEFORE_SKIPPING_A_HOST} addresses before this one`,
  tries: [],
});

const notResolved = (address, asked) => ({
  url: address,
  verdict: 'unresolved',
  status: null,
  finalUrl: null,
  reason: `not asked: the host name did not resolve for ${asked}`,
  tries: [],
});

function groupByHost(addresses) {
  const hosts = new Map();
  for (const address of addresses) {
    const host = URL.canParse(address) ? new URL(address).host : '';
    hosts.set(host, [...(hosts.get(host) ?? []), address]);
  }
  return [...hosts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, group]) => group);
}

export async function probeAll(
  addresses,
  { probeOne = probe, concurrency = CONCURRENCY, hostGapMs = HOST_GAP_MS, sleep = realSleep, ...options } = {}
) {
  const sorted = [...new Set(addresses)].sort();
  const queue = groupByHost(sorted);
  const results = new Map();

  const worker = async () => {
    for (let group = queue.shift(); group !== undefined; group = queue.shift()) {
      let streak = 0;
      let unresolvedFor = null;
      for (const [index, address] of group.entries()) {
        if (unresolvedFor !== null) {
          results.set(address, notResolved(address, unresolvedFor));
          continue;
        }
        if (streak >= STREAK_BEFORE_SKIPPING_A_HOST) {
          results.set(address, notAsked(address));
          continue;
        }
        if (index > 0) await sleep(hostGapMs);
        const result = await probeOne(address, { sleep, ...options });
        results.set(address, result);
        if (result.verdict === 'unresolved') unresolvedFor = address;
        streak = result.verdict === 'unverified' ? streak + 1 : 0;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

  return new Map(sorted.map((address) => [address, results.get(address)]));
}
