export const PROBE_DELAYS_MS = Object.freeze([0, 5_000, 10_000, 15_000, 20_000, 30_000, 30_000, 30_000]);
export const PROBE_TIMEOUT_MS = 10_000;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isLive = (status) => status >= 200 && status <= 299;
const release = (response) => Promise.resolve(response.body?.cancel()).catch(() => {});

function failureOf(error, timeoutMs) {
  if (error?.name === 'TimeoutError') return `no answer within ${timeoutMs / 1000} s`;
  const reason = error?.cause?.code ?? error?.cause?.message ?? error?.message ?? String(error);
  return `request failed: ${reason}`;
}

function requireBounds({ attempts, delaysMs }) {
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('a probe needs at least one attempt');
  if (!Array.isArray(delaysMs) || delaysMs.length < 1)
    throw new Error('a probe needs a list of waits with at least one wait');
}

async function ask({ url, fetch, timeoutMs }) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    await release(response);
    return { status: response.status };
  } catch (error) {
    return { failure: failureOf(error, timeoutMs) };
  }
}

export async function probeUntilLive({
  url,
  fetch = globalThis.fetch,
  sleep = defaultSleep,
  now = () => new Date(),
  attempts = PROBE_DELAYS_MS.length,
  delaysMs = PROBE_DELAYS_MS,
  timeoutMs = PROBE_TIMEOUT_MS,
}) {
  requireBounds({ attempts, delaysMs });
  let verdict;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const wait = delaysMs[Math.min(attempt, delaysMs.length) - 1];
    if (wait > 0) await sleep(wait);
    const answer = await ask({ url, fetch, timeoutMs });
    const checkedAt = now().toISOString();
    if (answer.status !== undefined && isLive(answer.status))
      return { reachable: true, status: answer.status, attempts: attempt, checkedAt, failure: null };
    verdict = {
      reachable: false,
      status: answer.status ?? null,
      attempts: attempt,
      checkedAt,
      failure: answer.failure ?? `HTTP ${answer.status}`,
    };
  }
  return verdict;
}
